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
  X
} from 'lucide-react';
import { 
  Batch, 
  Subject, 
  Student, 
  HomeworkAssignment, 
  NotebookCheckRecord, 
  NotebookStatus 
} from '@apex/shared-types';

export const HomeworkDesk: React.FC = () => {
  const { token } = useAuth();

  // State
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<HomeworkAssignment | null>(null);
  
  // Checking State
  const [students, setStudents] = useState<Student[]>([]);
  const [checks, setChecks] = useState<Record<string, { status: NotebookStatus; remarks: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingChecks, setIsSavingChecks] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // New Assignment Modal
  const [showNewHwModal, setShowNewHwModal] = useState(false);
  const [newHwForm, setNewHwForm] = useState({
    batch_id: '',
    subject_id: '',
    title: '',
    description: '',
    assigned_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  });
  const [isSubmittingHw, setIsSubmittingHw] = useState(false);

  // Fetch initial batches & subjects
  const fetchMetadata = async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [bRes, sRes] = await Promise.all([
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/academic/subjects', { headers }),
      ]);

      const [bData, sData] = await Promise.all([bRes.json(), sRes.json()]);

      if (bData.success && bData.data?.length > 0) {
        setBatches(bData.data);
        if (!selectedBatchId) {
          setSelectedBatchId(bData.data[0].id);
          setNewHwForm(prev => ({ ...prev, batch_id: bData.data[0].id }));
        }
      }

      if (sData.success && sData.data?.length > 0) {
        setSubjects(sData.data);
        setNewHwForm(prev => ({ ...prev, subject_id: sData.data[0].id }));
      }
    } catch (err) {
      console.error('Error fetching homework metadata:', err);
    }
  };

  // Fetch homework assignments
  const fetchAssignments = async () => {
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
        setAssignments(data.data || []);
        if (data.data?.length > 0 && !selectedAssignment) {
          setSelectedAssignment(data.data[0]);
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
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [studRes, chkRes] = await Promise.all([
        fetch(`/api/v1/sis/students?batch_id=${selectedAssignment.batch_id}`, { headers }),
        fetch(`/api/v1/homework/homework/${selectedAssignment.id}/checks`, { headers }),
      ]);

      const [studData, chkData] = await Promise.all([studRes.json(), chkRes.json()]);

      const allBatchStudents: Student[] = studData.success ? studData.data : [];
      const studentList: Student[] = allBatchStudents.filter(s => 
        !s.subjects || s.subjects.length === 0 || s.subjects.includes(selectedAssignment.subject_id)
      );
      setStudents(studentList);

      const existingChecks: NotebookCheckRecord[] = chkData.success ? chkData.data : [];
      const checkMap: Record<string, { status: NotebookStatus; remarks: string }> = {};

      studentList.forEach(s => {
        const found = existingChecks.find(c => c.student_id === s.id);
        if (found) {
          checkMap[s.id] = { status: found.status, remarks: found.remarks || '' };
        } else {
          // Default to done for rapid check
          checkMap[s.id] = { status: 'done', remarks: '' };
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
    if (selectedAssignment) {
      fetchChecksForAssignment();
    }
  }, [token, selectedAssignment?.id]);

  // Create Homework Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmittingHw(true);
    try {
      const res = await fetch('/api/v1/homework/homework', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newHwForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to create homework');

      setShowNewHwModal(false);
      setNewHwForm({
        batch_id: selectedBatchId,
        subject_id: subjects[0]?.id || '',
        title: '',
        description: '',
        assigned_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      });
      fetchAssignments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingHw(false);
    }
  };

  // Save Notebook Checks
  const handleSaveChecks = async () => {
    if (!token || !selectedAssignment) return;

    setIsSavingChecks(true);
    setSaveSuccessMessage(null);

    const payload = {
      checks: students.map(s => ({
        student_id: s.id,
        status: checks[s.id]?.status || 'done',
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

      setSaveSuccessMessage(`Physical notebook checks recorded for ${students.length} students.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingChecks(false);
    }
  };

  // Check stats
  const checkStats = useMemo(() => {
    let done = 0;
    let incomplete = 0;
    let missing = 0;

    Object.values(checks).forEach(c => {
      if (c.status === 'done') done++;
      if (c.status === 'incomplete') incomplete++;
      if (c.status === 'missing') missing++;
    });

    return { total: students.length, done, incomplete, missing };
  }, [checks, students.length]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
            <BookOpen className="w-5 h-5 text-white" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Homework & Notebook Checking</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign homework topics, track due dates, and record notebook completion status.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowNewHwModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Assign Homework</span>
        </button>
      </div>

      {/* Main Grid: Left col Assignments, Right col Notebook Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Assignments List */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-slate-900">Homework Assignments</h2>
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 font-medium text-slate-800 focus:outline-none"
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
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
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200/80 font-bold text-slate-700">
                        {hw.subject_name || 'Subject'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Due {hw.due_date}
                      </span>
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
                <div>
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Physical Inspection Roster: {selectedAssignment.title}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Assigned by {selectedAssignment.teacher_name || 'Faculty'} • Due {selectedAssignment.due_date}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveChecks}
                  disabled={isSavingChecks || students.length === 0}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all disabled:bg-slate-300"
                >
                  {isSavingChecks ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{isSavingChecks ? 'Saving...' : 'Save Inspection'}</span>
                </button>
              </div>

              {saveSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{saveSuccessMessage}</span>
                </div>
              )}

              {/* Progress Counters */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10px] font-mono uppercase text-emerald-700 font-bold block">Done / Checked</span>
                  <span className="text-lg font-extrabold text-emerald-800 mt-0.5 block">{checkStats.done}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <span className="text-[10px] font-mono uppercase text-amber-700 font-bold block">Incomplete Work</span>
                  <span className="text-lg font-extrabold text-amber-800 mt-0.5 block">{checkStats.incomplete}</span>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <span className="text-[10px] font-mono uppercase text-rose-700 font-bold block">Missing Notebook</span>
                  <span className="text-lg font-extrabold text-rose-800 mt-0.5 block">{checkStats.missing}</span>
                </div>
              </div>

              {/* Notebook Verification Table */}
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                {students.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-xs font-bold text-slate-700">No students found in this batch</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[calc(100vh-26rem)] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200/80 z-10">
                        <tr className="text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-4">Roll</th>
                          <th className="py-2.5 px-4">Student Name</th>
                          <th className="py-2.5 px-4 text-center">Physical Inspection Status</th>
                          <th className="py-2.5 px-4">Notebook Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {students.map(student => {
                          const check = checks[student.id] || { status: 'done', remarks: '' };

                          return (
                            <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-slate-700">
                                {student.roll_number}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-900">
                                {student.full_name}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setChecks(prev => ({
                                      ...prev,
                                      [student.id]: { ...prev[student.id], status: 'done' },
                                    }))}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                      check.status === 'done'
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
                                      [student.id]: { ...prev[student.id], status: 'incomplete' },
                                    }))}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                      check.status === 'incomplete'
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
                                      [student.id]: { ...prev[student.id], status: 'missing' },
                                    }))}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                      check.status === 'missing'
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
                                  value={check.remarks}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setChecks(prev => ({
                                      ...prev,
                                      [student.id]: { ...prev[student.id], remarks: val },
                                    }));
                                  }}
                                  placeholder="e.g. Page 42 problem 3 omitted..."
                                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 placeholder:text-slate-400 focus:outline-none"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Select an assignment to open the notebook checking roster</p>
              <p className="text-xs text-slate-400 mt-1">Choose an assignment from the left column to verify student notebooks.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Homework Modal */}
      {showNewHwModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <h2 className="text-sm font-extrabold text-slate-900">Assign Institutional Homework</h2>
              <button onClick={() => setShowNewHwModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Batch</label>
                  <select
                    value={newHwForm.batch_id}
                    onChange={e => setNewHwForm(prev => ({ ...prev, batch_id: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                    required
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
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
                  placeholder="e.g. Chapter 4 Thermodynamics Practice Problems"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Physical Checking Instructions</label>
                <textarea
                  value={newHwForm.description}
                  onChange={e => setNewHwForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Instructions for notebook preparation, pages, and problems..."
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned Date</label>
                  <input
                    type="date"
                    value={newHwForm.assigned_date}
                    onChange={e => setNewHwForm(prev => ({ ...prev, assigned_date: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newHwForm.due_date}
                    onChange={e => setNewHwForm(prev => ({ ...prev, due_date: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewHwModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHw}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                >
                  {isSubmittingHw ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
