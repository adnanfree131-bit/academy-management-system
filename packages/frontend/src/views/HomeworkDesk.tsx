import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, 
  CheckCircle2, 
  Plus, 
  RefreshCw, 
  FileCheck, 
  ShieldCheck,
  Clock,
  X,
  Pencil,
  Trash2
} from 'lucide-react';
import { 
  AcademicProgram,
  Batch, 
  Subject, 
  Student, 
  HomeworkAssignment, 
  NotebookCheckRecord, 
  NotebookStatus 
} from '@apex/shared-types';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';
import { useMobileOverlay } from '../lib/mobileOverlay';
import { campusToday } from '../lib/campusDate';

export const HomeworkDesk: React.FC = () => {
  const { token, user } = useAuth();

  // State
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<HomeworkAssignment | null>(null);
  
  // Checking State
  const [students, setStudents] = useState<Student[]>([]);
  const [checks, setChecks] = useState<Record<string, { status?: NotebookStatus; remarks: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingChecks, setIsSavingChecks] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // New / Edit Assignment Modal
  const [showNewHwModal, setShowNewHwModal] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [newHwForm, setNewHwForm] = useState({
    batch_id: '',
    subject_id: '',
    title: '',
    description: '',
    assigned_date: campusToday(),
    due_date: campusToday(new Date(Date.now() + 86400000)),
  });
  const [isSubmittingHw, setIsSubmittingHw] = useState(false);

  useMobileOverlay('sheet', showNewHwModal, () => {
    setShowNewHwModal(false);
    setEditingAssignmentId(null);
  });

  // Calculate user batch scope
  const userBatchScope = useMemo(() => {
    if (!user) return 'all';
    if (user.role === 'tenant_admin' || user.role === 'super_admin') return 'all';
    if (user.access?.all_classes === 'view' || user.access?.all_classes === 'edit') return 'all';
    const assignments = (user.teaching_assignments || []) as Array<{ batch_id: string }>;
    if (user.role === 'teacher') {
      if (!assignments || assignments.length === 0) return [];
      return Array.from(new Set(assignments.map(a => a.batch_id).filter(Boolean)));
    }
    if (!assignments || assignments.length === 0) return 'all';
    return Array.from(new Set(assignments.map(a => a.batch_id).filter(Boolean)));
  }, [user]);

  const scopedBatches = useMemo(() => {
    if (userBatchScope === 'all') return batches;
    return batches.filter(b => userBatchScope.includes(b.id));
  }, [batches, userBatchScope]);

  // Fetch initial batches & subjects
  const fetchMetadata = async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [pRes, bRes, sRes] = await Promise.all([
        fetch('/api/v1/academic/programs', { headers }),
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/academic/subjects', { headers }),
      ]);

      const [pData, bData, sData] = await Promise.all([pRes.json(), bRes.json(), sRes.json()]);

      if (pData.success && pData.data?.length > 0) {
        setPrograms(pData.data);
      }

      const pendingBatch = sessionStorage.getItem('kampus.pendingBatch');
      const pendingSubject = sessionStorage.getItem('kampus.pendingSubject');

      if (bData.success && bData.data?.length > 0) {
        setBatches(bData.data);
        const filtered = userBatchScope === 'all'
          ? bData.data
          : bData.data.filter((b: Batch) => userBatchScope.includes(b.id));

        const matchedPending = pendingBatch && bData.data.find((b: Batch) => b.id === pendingBatch);
        const initialBatch = matchedPending || filtered[0] || bData.data[0];
        if (initialBatch) {
          setSelectedBatchId(initialBatch.id);
          setNewHwForm(prev => ({ ...prev, batch_id: initialBatch.id }));
        }
      }

      if (sData.success && sData.data?.length > 0) {
        setSubjects(sData.data);
        const matchedSubject = pendingSubject && sData.data.find((s: Subject) => s.id === pendingSubject);
        setNewHwForm(prev => ({
          ...prev,
          subject_id: matchedSubject?.id || prev.subject_id || sData.data[0].id,
        }));
      }

      if (pendingBatch) sessionStorage.removeItem('kampus.pendingBatch');
      if (pendingSubject) sessionStorage.removeItem('kampus.pendingSubject');
    } catch (err) {
      console.error('Error fetching homework metadata:', err);
    }
  };

  // Fetch homework assignments
  const fetchAssignments = async (deletedId?: string) => {
    if (!token) return;
    setIsLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const url = selectedBatchId 
        ? `/api/v1/homework/homework?batch_id=${selectedBatchId}` 
        : '/api/v1/homework/homework';
      const res = await fetch(url, { headers });
      const data = await res.json();

      if (data.success) {
        const rawList: HomeworkAssignment[] = data.data || [];
        const sorted = [...rawList].sort((a, b) => {
          const dComp = (b.assigned_date || '').localeCompare(a.assigned_date || '');
          if (dComp !== 0) return dComp;
          return (b.created_at || '').localeCompare(a.created_at || '');
        });
        setAssignments(sorted);
        const currentSelectedId = selectedAssignment?.id;
        if (currentSelectedId && currentSelectedId !== deletedId) {
          const fresh = sorted.find(h => h.id === currentSelectedId);
          setSelectedAssignment(fresh || (sorted.length > 0 ? sorted[0] : null));
        } else {
          setSelectedAssignment(sorted.length > 0 ? sorted[0] : null);
        }
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch students & notebook checks for selected assignment
  const fetchChecksForAssignment = async () => {
    if (!token || !selectedAssignment) return;
    const targetHwId = selectedAssignment.id;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [rosterRes, chkRes] = await Promise.all([
        fetch(`/api/v1/homework/homework/${targetHwId}/roster`, { headers }),
        fetch(`/api/v1/homework/homework/${targetHwId}/checks`, { headers }),
      ]);

      const [rosterData, chkData] = await Promise.all([rosterRes.json(), chkRes.json()]);

      // Guard against race conditions if assignment switched while fetching
      if (selectedAssignment?.id !== targetHwId) return;

      const rosterStudents: Student[] = rosterData.success ? rosterData.data : [];
      setStudents(rosterStudents);

      const existingChecks: NotebookCheckRecord[] = chkData.success ? chkData.data : [];
      const checkMap: Record<string, { status?: NotebookStatus; remarks: string }> = {};

      existingChecks.forEach(c => {
        if (c.status) {
          checkMap[c.student_id] = { status: c.status, remarks: c.remarks || '' };
        }
      });

      setChecks(checkMap);
    } catch (err) {
      console.error('Error loading notebook checks:', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [token]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchAssignments();
    }
  }, [token, selectedBatchId]);

  useEffect(() => {
    setStudents([]);
    setChecks({});
    if (selectedAssignment) {
      fetchChecksForAssignment();
    }
  }, [token, selectedAssignment?.id]);

  const handleOpenCreateModal = () => {
    setEditingAssignmentId(null);
    setNewHwForm({
      batch_id: selectedBatchId || (scopedBatches[0]?.id || batches[0]?.id || ''),
      subject_id: newHwForm.subject_id || subjects[0]?.id || '',
      title: '',
      description: '',
      assigned_date: campusToday(),
      due_date: campusToday(new Date(Date.now() + 86400000)),
    });
    setShowNewHwModal(true);
  };

  const handleOpenEditModal = (hw: HomeworkAssignment) => {
    setEditingAssignmentId(hw.id);
    setNewHwForm({
      batch_id: hw.batch_id,
      subject_id: hw.subject_id,
      title: hw.title,
      description: hw.description,
      assigned_date: hw.assigned_date,
      due_date: hw.due_date,
    });
    setShowNewHwModal(true);
  };

  const handleDeleteAssignment = async (hw: HomeworkAssignment) => {
    if (!window.confirm('Remove this homework and its notebook checks?')) return;
    if (!token) return;

    try {
      const res = await fetch(`/api/v1/homework/homework/${hw.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to delete homework');
      if (selectedAssignment?.id === hw.id) {
        setSelectedAssignment(null);
      }
      await fetchAssignments(hw.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Create or Update Homework Assignment
  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (newHwForm.due_date < newHwForm.assigned_date) {
      alert('Due date cannot be before assigned date.');
      return;
    }

    setIsSubmittingHw(true);
    try {
      const url = editingAssignmentId
        ? `/api/v1/homework/homework/${editingAssignmentId}`
        : '/api/v1/homework/homework';
      const method = editingAssignmentId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newHwForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Failed to ${editingAssignmentId ? 'update' : 'create'} homework`);

      setShowNewHwModal(false);
      setEditingAssignmentId(null);
      setNewHwForm({
        batch_id: selectedBatchId,
        subject_id: subjects[0]?.id || '',
        title: '',
        description: '',
        assigned_date: campusToday(),
        due_date: campusToday(new Date(Date.now() + 86400000)),
      });
      await fetchAssignments();
      if (data.data) {
        setSelectedAssignment(data.data);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingHw(false);
    }
  };

  // Save Notebook Checks
  const handleSaveChecks = async () => {
    if (!token || !selectedAssignment) return;

    const setStudents = students.filter(s => checks[s.id]?.status);
    if (setStudents.length === 0) return;

    setIsSavingChecks(true);
    setSaveSuccessMessage(null);

    const payload = {
      checks: setStudents.map(s => ({
        student_id: s.id,
        status: checks[s.id]!.status as NotebookStatus,
        remarks: checks[s.id]?.remarks || undefined,
      })),
    };

    try {
      const res = await fetch(`/api/v1/homework/homework/${selectedAssignment.id}/checks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to save notebook checks');

      setSaveSuccessMessage(`Physical notebook checks recorded for ${payload.checks.length} students.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingChecks(false);
    }
  };

  // Check stats (Done, Incomplete, Missing, Not checked)
  const checkStats = useMemo(() => {
    let done = 0;
    let incomplete = 0;
    let missing = 0;
    let setRows = 0;

    students.forEach(s => {
      const c = checks[s.id];
      if (c?.status === 'done') { done++; setRows++; }
      else if (c?.status === 'incomplete') { incomplete++; setRows++; }
      else if (c?.status === 'missing') { missing++; setRows++; }
    });

    const notChecked = Math.max(0, students.length - setRows);
    return { total: students.length, done, incomplete, missing, notChecked, setRows };
  }, [checks, students]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeading
        title="Homework"
        description="Assign homework topics, track due dates, and record notebook completion status."
        icon={<BookOpen className="w-4 h-4 text-slate-700" />}
      >
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 h-8.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Assign Homework</span>
        </button>
      </PageHeading>

      {/* Main Grid: Left col Assignments, Right col Notebook Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Assignments List */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 min-w-0">
            <SectionInfo title="Assignments" description="Class homework topics and due dates" />
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              className="w-full sm:w-auto max-w-full truncate text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 font-medium text-slate-800 focus:outline-none min-w-0"
            >
              {scopedBatches.map(b => {
                const progName = programs.find(p => p.id === b.program_id)?.name;
                return (
                  <option key={b.id} value={b.id}>
                    {progName ? `${progName} • ` : ''}{b.name}
                  </option>
                );
              })}
            </select>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
              <p className="text-xs font-mono">Loading assignments...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <BookOpen className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">No homework assigned yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Click "Assign Homework" above.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
              {assignments.map(hw => {
                const isSelected = selectedAssignment?.id === hw.id;
                return (
                  <div
                    key={hw.id}
                    onClick={() => setSelectedAssignment(hw)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-200 shadow-2xs'
                        : 'bg-slate-50/50 border-slate-200/70 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200/80 font-bold text-slate-700 truncate">
                        {hw.subject_name || 'Subject'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Due {hw.due_date}
                        </span>
                        <button
                          type="button"
                          title="Edit Homework"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(hw);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete Homework"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAssignment(hw);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1">{hw.title}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{hw.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 2 Columns: Physical Notebook Inspection Roster */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          {selectedAssignment ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <SectionInfo
                    title={`Notebook: ${selectedAssignment.title}`}
                    description={`Assigned by ${selectedAssignment.teacher_name || 'Teacher'} • Due ${selectedAssignment.due_date}`}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveChecks}
                  disabled={isSavingChecks || checkStats.setRows === 0}
                  className="flex items-center justify-center gap-1.5 h-8.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold shadow-xs transition-all disabled:bg-slate-300 cursor-pointer"
                >
                  {isSavingChecks ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{isSavingChecks ? 'Saving...' : 'Save notebook check'}</span>
                </button>
              </div>

              {saveSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{saveSuccessMessage}</span>
                </div>
              )}

              {/* Progress Counters (Sidebar Dark Navy Design) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="bg-[#081A2F] border border-[#173252] rounded-xl p-2.5 sm:p-3 shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                  <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block truncate">Done</span>
                  <span className="text-base sm:text-lg font-bold font-mono text-white mt-0.5 block">{checkStats.done}</span>
                </div>
                <div className="bg-[#081A2F] border border-[#173252] rounded-xl p-2.5 sm:p-3 shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                  <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block truncate">Incomplete</span>
                  <span className="text-base sm:text-lg font-bold font-mono text-white mt-0.5 block">{checkStats.incomplete}</span>
                </div>
                <div className="bg-[#081A2F] border border-[#173252] rounded-xl p-2.5 sm:p-3 shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                  <span className="text-[10px] font-mono uppercase text-rose-400 font-bold block truncate">Missing</span>
                  <span className="text-base sm:text-lg font-bold font-mono text-white mt-0.5 block">{checkStats.missing}</span>
                </div>
                <div className="bg-[#081A2F] border border-[#173252] rounded-xl p-2.5 sm:p-3 shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block truncate">Not checked</span>
                  <span className="text-base sm:text-lg font-bold font-mono text-white mt-0.5 block">{checkStats.notChecked}</span>
                </div>
              </div>

              {/* Notebook Verification Roster */}
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                {students.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-xs font-semibold text-slate-700">No students found in this batch</p>
                  </div>
                ) : (
                  <>
                  {/* Mobile Inspection List (< 640px) */}
                  <div className="sm:hidden divide-y divide-slate-100 bg-white">
                    {students.map(student => {
                      const check = checks[student.id];
                      const currentStatus = check?.status;

                      return (
                        <div key={student.id} className="p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900 text-xs truncate">{student.full_name}</span>
                            <span className="font-mono text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              {student.roll_number ? `${student.roll_number} • ` : ''}{student.admission_number}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1">
                            <button
                              type="button"
                              onClick={() => setChecks(prev => ({
                                ...prev,
                                [student.id]: { ...prev[student.id], status: 'done', remarks: prev[student.id]?.remarks || '' },
                              }))}
                              className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                currentStatus === 'done'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              onClick={() => setChecks(prev => ({
                                ...prev,
                                [student.id]: { ...prev[student.id], status: 'incomplete', remarks: prev[student.id]?.remarks || '' },
                              }))}
                              className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                currentStatus === 'incomplete'
                                  ? 'bg-amber-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              Incomplete
                            </button>
                            <button
                              type="button"
                              onClick={() => setChecks(prev => ({
                                ...prev,
                                [student.id]: { ...prev[student.id], status: 'missing', remarks: prev[student.id]?.remarks || '' },
                              }))}
                              className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                currentStatus === 'missing'
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              Missing
                            </button>
                          </div>

                          <input
                            type="text"
                            placeholder="Optional notebook remarks..."
                            value={check?.remarks || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setChecks(prev => ({
                                ...prev,
                                [student.id]: { ...prev[student.id], remarks: val },
                              }));
                            }}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Inspection Table (>= 640px) */}
                  <div className="hidden sm:block overflow-x-auto max-h-[calc(100vh-26rem)] overflow-y-auto mobile-table-scroll">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200/80 z-10">
                        <tr className="text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-4">Adm #</th>
                          <th className="py-2.5 px-4">Student Name</th>
                          <th className="py-2.5 px-4 text-center">Notebook</th>
                          <th className="py-2.5 px-4">Notebook Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map(student => {
                          const check = checks[student.id];
                          const currentStatus = check?.status;

                          return (
                            <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                                {student.roll_number ? `${student.roll_number} • ` : ''}{student.admission_number}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {student.full_name}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setChecks(prev => ({
                                      ...prev,
                                      [student.id]: { ...prev[student.id], status: 'done', remarks: prev[student.id]?.remarks || '' },
                                    }))}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                      currentStatus === 'done'
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                    }`}
                                  >
                                    Done
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setChecks(prev => ({
                                      ...prev,
                                      [student.id]: { ...prev[student.id], status: 'incomplete', remarks: prev[student.id]?.remarks || '' },
                                    }))}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                      currentStatus === 'incomplete'
                                        ? 'bg-amber-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                                    }`}
                                  >
                                    Incomplete
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setChecks(prev => ({
                                      ...prev,
                                      [student.id]: { ...prev[student.id], status: 'missing', remarks: prev[student.id]?.remarks || '' },
                                    }))}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                      currentStatus === 'missing'
                                        ? 'bg-rose-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                                    }`}
                                  >
                                    Missing
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={check?.remarks || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setChecks(prev => ({
                                      ...prev,
                                      [student.id]: { ...prev[student.id], remarks: val },
                                    }));
                                  }}
                                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Select an assignment to check notebooks.</p>
              <p className="text-xs text-slate-400 mt-1">Choose an assignment from the left column to verify student notebooks.</p>
            </div>
          )}
        </div>
      </div>

      {/* New / Edit Homework Modal */}
      {showNewHwModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl overflow-hidden mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <SectionInfo
                title={editingAssignmentId ? "Edit Homework" : "Assign Homework"}
                description={editingAssignmentId ? "Update homework topic details" : "Add homework for this class."}
              />
              <button
                type="button"
                onClick={() => {
                  setShowNewHwModal(false);
                  setEditingAssignmentId(null);
                }}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAssignment} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Batch</label>
                  <select
                    value={newHwForm.batch_id}
                    onChange={e => setNewHwForm(prev => ({ ...prev, batch_id: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                    required
                  >
                    {scopedBatches.map(b => {
                      const progName = programs.find(p => p.id === b.program_id)?.name;
                      return (
                        <option key={b.id} value={b.id}>
                          {progName ? `${progName} • ` : ''}{b.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Subject</label>
                  <select
                    value={newHwForm.subject_id}
                    onChange={e => setNewHwForm(prev => ({ ...prev, subject_id: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                    required
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Assignment Title</label>
                <input
                  type="text"
                  value={newHwForm.title}
                  onChange={e => setNewHwForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Physical Checking Instructions</label>
                <textarea
                  value={newHwForm.description}
                  onChange={e => setNewHwForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned Date</label>
                  <input
                    type="date"
                    value={newHwForm.assigned_date}
                    onChange={e => {
                      const newAssigned = e.target.value;
                      setNewHwForm(prev => ({
                        ...prev,
                        assigned_date: newAssigned,
                        due_date: prev.due_date < newAssigned ? newAssigned : prev.due_date,
                      }));
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newHwForm.due_date}
                    min={newHwForm.assigned_date}
                    onChange={e => setNewHwForm(prev => ({ ...prev, due_date: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewHwModal(false);
                    setEditingAssignmentId(null);
                  }}
                  className="h-8.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHw}
                  className="h-8.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingHw ? (editingAssignmentId ? 'Saving...' : 'Assigning...') : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
