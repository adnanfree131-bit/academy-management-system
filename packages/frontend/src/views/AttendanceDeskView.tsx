import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { academyLetterheadFromAuth, buildSimpleStatementPdf, downloadPdfBytes } from '../lib/officialDocumentPdf';
import { 
  CheckSquare, 
  Users, 
  CheckCircle2, 
  ShieldCheck, 
  Plus, 
  RefreshCw, 
  FileText, 
  X,
  AlertTriangle
} from 'lucide-react';
import { 
  Batch, 
  Student, 
  StudentAttendanceRecord, 
  AttendanceStatus, 
  LeaveApplication, 
  LeaveCategory 
} from '@apex/shared-types';

export type DeskAttendanceStatus = AttendanceStatus | 'unmarked';

export const AttendanceDeskView: React.FC = () => {
  const { token, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'roster' | 'leaves'>('roster');

  // Metadata
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Attendance State
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, { status: DeskAttendanceStatus; remarks: string }>>({});
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Leave Modal State
  const [showNewLeaveModal, setShowNewLeaveModal] = useState(false);
  const [newLeaveForm, setNewLeaveForm] = useState({
    student_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    category: 'medical' as LeaveCategory,
    reason: '',
  });
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Review Modal State
  const [reviewingLeave, setReviewingLeave] = useState<LeaveApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  // Load Batches & Leaves
  const fetchBatchesAndLeaves = async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [bRes, lRes] = await Promise.all([
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/attendance/leaves', { headers }),
      ]);

      const [bData, lData] = await Promise.all([bRes.json(), lRes.json()]);

      if (bData.success && bData.data?.length > 0) {
        setBatches(bData.data);
        if (!selectedBatchId) {
          setSelectedBatchId(bData.data[0].id);
        }
      } else {
        setBatches([]);
        setIsLoading(false);
      }

      if (lData.success) {
        setLeaves(lData.data || []);
      }
    } catch (err) {
      console.error('Error fetching batches/leaves:', err);
      setIsLoading(false);
    }
  };

  // Load Students and Attendance for current batch and date
  const fetchBatchRoster = async () => {
    if (!token || !selectedBatchId) return;
    setIsLoading(true);
    setSaveSuccessMessage(null);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [studRes, attRes] = await Promise.all([
        fetch(`/api/v1/sis/students?batch_id=${selectedBatchId}`, { headers }),
        fetch(`/api/v1/attendance/attendance/students?batch_id=${selectedBatchId}&date=${selectedDate}`, { headers }),
      ]);

      const [studData, attData] = await Promise.all([studRes.json(), attRes.json()]);

      const allStudents: Student[] = studData.success ? studData.data : [];
      // Only active students appear on the daily attendance roster
      const studentList: Student[] = allStudents.filter(s => s.status === 'active');
      setStudents(studentList);

      const existingRecords: StudentAttendanceRecord[] = attData.success ? attData.data : [];

      // Determine active approved leaves covering this date
      const activeLeaves = leaves.filter(l => 
        l.status === 'approved' && l.start_date <= selectedDate && l.end_date >= selectedDate
      );
      const excusedStudentIds = new Set(activeLeaves.map(l => l.student_id));

      const todayStr = new Date().toISOString().split('T')[0];
      const isPastDate = selectedDate < todayStr;

      // Build state map
      const stateMap: Record<string, { status: DeskAttendanceStatus; remarks: string }> = {};
      studentList.forEach(s => {
        const found = existingRecords.find(r => r.student_id === s.id);
        if (found) {
          stateMap[s.id] = { status: found.status, remarks: found.remarks || '' };
        } else if (excusedStudentIds.has(s.id)) {
          stateMap[s.id] = { status: 'excused', remarks: 'Auto-Excused: Approved Leave' };
        } else if (isPastDate) {
          // Past unrecorded dates or partial attendance must remain unmarked
          stateMap[s.id] = { status: 'unmarked', remarks: '' };
        } else {
          // Default to present for rapid 1-click verification on today or future dates
          stateMap[s.id] = { status: 'present', remarks: '' };
        }
      });

      setAttendanceRecords(stateMap);
    } catch (err) {
      console.error('Error loading attendance roster:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchesAndLeaves();
  }, [token]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchRoster();
    }
  }, [token, selectedBatchId, selectedDate, leaves.length]);

  // Rapid 1-Tap Action: Mark All Present
  const markAllPresent = () => {
    const updated: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    const activeLeaves = leaves.filter(l => 
      l.status === 'approved' && l.start_date <= selectedDate && l.end_date >= selectedDate
    );
    const excusedStudentIds = new Set(activeLeaves.map(l => l.student_id));

    students.forEach(s => {
      if (excusedStudentIds.has(s.id)) {
        updated[s.id] = { status: 'excused', remarks: 'Auto-Excused: Approved Leave' };
      } else {
        updated[s.id] = { status: 'present', remarks: '' };
      }
    });
    setAttendanceRecords(updated);
  };

  // Update Individual Student Status
  const updateStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  // Update Remarks
  const updateStudentRemarks = (studentId: string, remarks: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks,
      },
    }));
  };

  // Save Attendance Submission
  const handleSaveAttendance = async () => {
    if (!token || !selectedBatchId) return;

    // Institutional integrity check: prevent saving unrecorded rows without explicit selection
    const unmarkedCount = students.filter(s => attendanceRecords[s.id]?.status === 'unmarked' || !attendanceRecords[s.id]?.status).length;
    if (unmarkedCount > 0) {
      alert(`Cannot save roster: ${unmarkedCount} student(s) remain unmarked. Please mark all students (Present, Absent, Late, Excused) or click "1-Tap: Mark All Present".`);
      return;
    }

    setIsSaving(true);
    setSaveSuccessMessage(null);

    const payload = {
      batch_id: selectedBatchId,
      date: selectedDate,
      records: students.map(s => {
        const effectiveStatus: AttendanceStatus = (attendanceRecords[s.id]?.status as AttendanceStatus) || 'present';
        return {
          student_id: s.id,
          status: effectiveStatus,
          remarks: attendanceRecords[s.id]?.remarks || undefined,
        };
      }),
    };

    try {
      const res = await fetch('/api/v1/attendance/attendance/students/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to record attendance');

      setSaveSuccessMessage(`Attendance successfully recorded for ${students.length} students.`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newLeaveForm.student_id) return;

    setIsSubmittingLeave(true);
    try {
      const res = await fetch('/api/v1/attendance/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newLeaveForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to submit leave application');

      setShowNewLeaveModal(false);
      setNewLeaveForm({
        student_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        category: 'medical',
        reason: '',
      });
      fetchBatchesAndLeaves();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // Review Leave Request
  const handleReviewLeave = async (status: 'approved' | 'rejected') => {
    if (!token || !reviewingLeave) return;

    setIsReviewing(true);
    try {
      const res = await fetch(`/api/v1/attendance/leaves/${reviewingLeave.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          review_notes: reviewNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to review leave application');

      setReviewingLeave(null);
      setReviewNotes('');
      fetchBatchesAndLeaves();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsReviewing(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let unmarked = 0;

    Object.values(attendanceRecords).forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'late') late++;
      else if (r.status === 'excused') excused++;
      else if (r.status === 'unmarked') unmarked++;
    });

    return { total: students.length, present, absent, late, excused, unmarked };
  }, [attendanceRecords, students.length]);

  const todayStr = new Date().toISOString().split('T')[0];
  const isPastDate = selectedDate < todayStr;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
            <CheckSquare className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Student Attendance & Leaves</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Record daily class attendance, review attendance records, and manage student leave requests.
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'roster'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Attendance Roster
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'leaves'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Leave Applications</span>
            {leaves.filter(l => l.status === 'pending').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'roster' ? (
        <>
          {/* Controls Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Batch Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Target Batch:</span>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.shift.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              {/* Date Picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            {/* Rapid Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markAllPresent}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>1-Tap: Mark All Present</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const academy = await academyLetterheadFromAuth(tenant);
                  const batch = batches.find(b => b.id === selectedBatchId);
                  const bytes = await buildSimpleStatementPdf({
                    title: 'Daily Attendance Register',
                    academy,
                    identity: [
                      { label: 'Batch', value: batch?.name || '—' },
                      { label: 'Date', value: selectedDate },
                      { label: 'Present', value: String(stats.present) },
                      { label: 'Absent', value: String(stats.absent) },
                      { label: 'Late', value: String(stats.late) },
                      { label: 'Excused', value: String(stats.excused) },
                    ],
                    columns: [
                      { key: 'roll', label: 'Roll', width: 70 },
                      { key: 'name', label: 'Student', width: 200 },
                      { key: 'status', label: 'Status', width: 90 },
                      { key: 'remarks', label: 'Remarks', width: 150 },
                    ],
                    rows: students.map(s => ({
                      roll: s.roll_number,
                      name: s.full_name,
                      status: (attendanceRecords[s.id]?.status || 'present').toUpperCase(),
                      remarks: attendanceRecords[s.id]?.remarks || '—',
                    })),
                  });
                  await downloadPdfBytes(bytes, `attendance-${selectedDate}.pdf`);
                }}
                disabled={students.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 text-xs font-bold transition-all disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                <span>Download register</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={isSaving || students.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all disabled:bg-slate-300"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{isSaving ? 'Submitting...' : 'Save Roster'}</span>
              </button>
            </div>
          </div>

          {/* Success Banner */}
          {saveSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          {/* Unmarked Historical Register Notice */}
          {isPastDate && stats.unmarked > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">Unmarked Historical Register:</span> Attendance has not been recorded for {stats.unmarked} {stats.unmarked === 1 ? 'student' : 'students'} on {selectedDate}. All students must be marked before saving.
                </div>
              </div>
              <button
                type="button"
                onClick={markAllPresent}
                className="px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold transition-all shrink-0"
              >
                1-Tap: Mark All Present
              </button>
            </div>
          )}

          {/* Stat Badges */}
          <div className={`grid grid-cols-2 ${stats.unmarked > 0 ? 'sm:grid-cols-6' : 'sm:grid-cols-5'} gap-3`}>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Enrolled Students</span>
              <span className="text-xl font-extrabold text-slate-900 mt-1 block">{stats.total}</span>
            </div>
            {stats.unmarked > 0 && (
              <div className="bg-amber-50/50 border border-amber-200/90 rounded-2xl p-3 shadow-2xs">
                <span className="text-[10px] font-mono uppercase text-amber-700 font-bold block">Unmarked</span>
                <span className="text-xl font-extrabold text-amber-800 mt-1 block">{stats.unmarked}</span>
              </div>
            )}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-emerald-600 font-bold block">Present</span>
              <span className="text-xl font-extrabold text-emerald-700 mt-1 block">{stats.present}</span>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-rose-600 font-bold block">Absent</span>
              <span className="text-xl font-extrabold text-rose-700 mt-1 block">{stats.absent}</span>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-amber-600 font-bold block">Late</span>
              <span className="text-xl font-extrabold text-amber-700 mt-1 block">{stats.late}</span>
            </div>
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-indigo-600 font-bold block">Approved Excused</span>
              <span className="text-xl font-extrabold text-indigo-700 mt-1 block">{stats.excused}</span>
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                <p className="text-xs font-mono">Loading batch student roster...</p>
              </div>
            ) : batches.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-bold text-slate-700">No academic batches yet</p>
                <p className="text-xs text-slate-400 mt-1">Create a class and batch under Classes & Batches, then return here to mark attendance.</p>
              </div>
            ) : students.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-bold text-slate-700">No active students enrolled in this batch</p>
                <p className="text-xs text-slate-400 mt-1">Enroll students via Admissions Desk to activate attendance.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4 text-center">Status Action</th>
                      <th className="py-3 px-4">Administrative Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map(student => {
                      const record = attendanceRecords[student.id] || { status: 'unmarked', remarks: '' };
                      const isAutoExcused = record.status === 'excused' && record.remarks.includes('Auto-Excused');
                      const isUnmarked = record.status === 'unmarked';

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            {student.roll_number}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{student.full_name}</span>
                              {isUnmarked && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold font-mono">
                                  Unmarked
                                </span>
                              )}
                              {student.subjects && student.subjects.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                                  {student.subjects.length} Subjects
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{student.admission_number}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map(status => {
                                const isSelected = record.status === status;
                                let activeStyles = '';
                                if (status === 'present') activeStyles = isSelected ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-700 hover:bg-emerald-50';
                                if (status === 'absent') activeStyles = isSelected ? 'bg-rose-600 text-white font-bold' : 'text-rose-700 hover:bg-rose-50';
                                if (status === 'late') activeStyles = isSelected ? 'bg-amber-600 text-white font-bold' : 'text-amber-700 hover:bg-amber-50';
                                if (status === 'excused') activeStyles = isSelected ? 'bg-indigo-600 text-white font-bold' : 'text-indigo-700 hover:bg-indigo-50';

                                return (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => updateStudentStatus(student.id, status)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] capitalize transition-all border border-transparent ${
                                      isSelected ? `${activeStyles} shadow-2xs` : `bg-slate-100 ${activeStyles}`
                                    }`}
                                  >
                                    {status}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {isAutoExcused ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <ShieldCheck className="w-3 h-3" /> Approved Leave Auto-Excused
                              </span>
                            ) : (
                              <input
                                type="text"
                                value={record.remarks}
                                onChange={e => updateStudentRemarks(student.id, e.target.value)}
                                placeholder="Optional note..."
                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 placeholder:text-slate-400 focus:outline-none"
                              />
                            )}
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
        /* Leave Applications Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">Student Formal Leave Requests</h2>
            <button
              onClick={() => setShowNewLeaveModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Submit Leave Application</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            {leaves.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-bold text-slate-700">No leave applications on record</p>
                <p className="text-xs text-slate-400 mt-1">Submit applications above to automate institutional absence excusing.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Date Range</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaves.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {l.student_name || 'Enrolled Student'}
                        </td>
                        <td className="py-3 px-4 capitalize">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                            {l.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {l.start_date} → {l.end_date}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {l.reason}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            l.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : l.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {l.status === 'pending' ? (
                            <button
                              onClick={() => {
                                setReviewingLeave(l);
                                setReviewNotes('');
                              }}
                              className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all"
                            >
                              Review
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">Reviewed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Leave Application Modal */}
      {showNewLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <h2 className="text-sm font-extrabold text-slate-900">Submit Student Leave Request</h2>
              <button onClick={() => setShowNewLeaveModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Student</label>
                <select
                  value={newLeaveForm.student_id}
                  onChange={e => setNewLeaveForm(prev => ({ ...prev, student_id: e.target.value }))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                  required
                >
                  <option value="">Choose enrolled student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.roll_number})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newLeaveForm.start_date}
                    onChange={e => setNewLeaveForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newLeaveForm.end_date}
                    onChange={e => setNewLeaveForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Leave Category</label>
                <select
                  value={newLeaveForm.category}
                  onChange={e => setNewLeaveForm(prev => ({ ...prev, category: e.target.value as LeaveCategory }))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                  required
                >
                  <option value="medical">Medical (Illness / Doctor Order)</option>
                  <option value="personal">Personal / Family Commitment</option>
                  <option value="emergency">Emergency / Urgent Matter</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Detailed Reason</label>
                <textarea
                  value={newLeaveForm.reason}
                  onChange={e => setNewLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Explain justification..."
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  required
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewLeaveModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLeave}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                >
                  {isSubmittingLeave ? 'Submitting...' : 'Submit Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Leave Modal */}
      {reviewingLeave && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <h2 className="text-sm font-extrabold text-slate-900">Review Leave Application</h2>
              <button onClick={() => setReviewingLeave(null)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-900">{reviewingLeave.student_name}</span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-bold text-slate-800">{reviewingLeave.start_date} to {reviewingLeave.end_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Category:</span>
                  <span className="font-bold capitalize text-slate-800">{reviewingLeave.category}</span>
                </div>
                <p className="text-slate-600 pt-1 border-t border-slate-200/60 text-[11px]">
                  "{reviewingLeave.reason}"
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Administrative Notes</label>
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="e.g. Medical certificate verified by registrar"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isReviewing}
                  onClick={() => handleReviewLeave('rejected')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={isReviewing}
                  onClick={() => handleReviewLeave('approved')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  Approve & Excuse Attendance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
