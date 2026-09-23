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
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Phone,
  MessageSquare,
  ArrowUpRight,
  BarChart2,
  CalendarDays,
  Check,
  Printer
} from 'lucide-react';
import { 
  Batch, 
  Student, 
  StudentAttendanceRecord, 
  AttendanceStatus, 
  LeaveApplication, 
  LeaveCategory,
  AcademicProgram
} from '@apex/shared-types';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';
import { hapticLight, hapticSuccess, hapticSelection } from '../lib/haptics';

export type DeskAttendanceStatus = AttendanceStatus | 'unmarked';

interface AttendanceDeskViewProps {
  onNavigate?: (screenId: string) => void;
}

const COMMON_REASONS = [
  'Medical / Illness',
  'Family Emergency',
  'Transport / Traffic Delay',
  'Official Academy Duty',
  'Uninformed / Truancy',
  'Fee Dispute',
  'Weather / Rain Disruption',
  'Other / Custom Remark'
];

export const AttendanceDeskView: React.FC<AttendanceDeskViewProps> = ({ onNavigate }) => {
  const { token, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'roster' | 'monthly' | 'defaulters' | 'leaves'>('roster');

  // Academic Hierarchy & Batch Filter
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('ALL');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  
  // Temporal State
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.slice(0, 7)); // YYYY-MM
  
  // Student Data
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, { status: DeskAttendanceStatus; remarks: string; reasonCategory: string }>>({});
  const [monthlyRecords, setMonthlyRecords] = useState<StudentAttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  
  // Roster Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'present' | 'absent' | 'late' | 'excused' | 'unmarked'>('ALL');

  // UI Status
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [lastSavedInfo, setLastSavedInfo] = useState<{ date: string; count: number; absents: number } | null>(null);

  // Leave Modal State
  const [showNewLeaveModal, setShowNewLeaveModal] = useState(false);
  const [newLeaveForm, setNewLeaveForm] = useState({
    student_id: '',
    start_date: todayStr,
    end_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    category: 'medical' as LeaveCategory,
    reason: '',
  });
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Review Modal State
  const [reviewingLeave, setReviewingLeave] = useState<LeaveApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  // Clean phone number for WhatsApp deep-linking
  const cleanPhoneForWhatsApp = (p?: string | null) => {
    if (!p) return '';
    let cleaned = p.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('03')) {
      cleaned = '92' + cleaned.slice(1);
    }
    return cleaned;
  };

  // Load Programs, Batches & Leaves
  const fetchMetadata = async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [progRes, bRes, lRes] = await Promise.all([
        fetch('/api/v1/academic/programs', { headers }),
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/attendance/leaves', { headers }),
      ]);

      const [progData, bData, lData] = await Promise.all([progRes.json(), bRes.json(), lRes.json()]);

      if (progData.success) {
        setPrograms(progData.data || []);
      }

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
      console.error('Error fetching attendance metadata:', err);
      setIsLoading(false);
    }
  };

  // Filter batches by program
  const filteredBatches = useMemo(() => {
    if (selectedProgramId === 'ALL') return batches;
    return batches.filter(b => b.program_id === selectedProgramId);
  }, [batches, selectedProgramId]);

  // When selectedProgramId changes, ensure selectedBatchId stays valid
  useEffect(() => {
    if (filteredBatches.length > 0) {
      if (!filteredBatches.some(b => b.id === selectedBatchId)) {
        setSelectedBatchId(filteredBatches[0].id);
      }
    } else {
      setSelectedBatchId('');
    }
  }, [filteredBatches]);

  // Load Students and Attendance for current batch and date
  const fetchBatchRoster = async () => {
    if (!token || !selectedBatchId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setSaveSuccessMessage(null);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [studRes, attRes] = await Promise.all([
        fetch(`/api/v1/sis/students?batch_id=${selectedBatchId}`, { headers }),
        fetch(`/api/v1/attendance/students?batch_id=${selectedBatchId}&date=${selectedDate}`, { headers }),
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

      const isPastDate = selectedDate < todayStr;

      // Build state map
      const stateMap: Record<string, { status: DeskAttendanceStatus; remarks: string; reasonCategory: string }> = {};
      studentList.forEach(s => {
        const found = existingRecords.find(r => r.student_id === s.id);
        if (found) {
          let cat = '';
          let rem = found.remarks || '';
          if (rem.startsWith('[') && rem.includes(']')) {
            const endIdx = rem.indexOf(']');
            cat = rem.slice(1, endIdx);
            rem = rem.slice(endIdx + 1).trim();
          }
          stateMap[s.id] = { status: found.status, remarks: rem, reasonCategory: cat };
        } else if (excusedStudentIds.has(s.id)) {
          stateMap[s.id] = { status: 'excused', remarks: 'Approved Leave Auto-Excused', reasonCategory: 'Medical / Illness' };
        } else if (isPastDate) {
          stateMap[s.id] = { status: 'unmarked', remarks: '', reasonCategory: '' };
        } else {
          stateMap[s.id] = { status: 'present', remarks: '', reasonCategory: '' };
        }
      });

      setAttendanceRecords(stateMap);
    } catch (err) {
      console.error('Error loading attendance roster:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Monthly Attendance Matrix
  const fetchMonthlyRecords = async () => {
    if (!token || !selectedBatchId || !selectedMonth) return;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch(`/api/v1/attendance/students?batch_id=${selectedBatchId}&month=${selectedMonth}`, { headers });
      const data = await res.json();
      if (data.success) {
        setMonthlyRecords(data.data || []);
      }
    } catch (err) {
      console.error('Error loading monthly attendance:', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [token]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchRoster();
    }
  }, [token, selectedBatchId, selectedDate, leaves.length]);

  useEffect(() => {
    if (activeTab === 'monthly' || activeTab === 'defaulters') {
      fetchMonthlyRecords();
    }
  }, [token, selectedBatchId, selectedMonth, activeTab]);

  // Date Navigation Helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(todayStr);
  };

  // Rapid Actions
  const markAllPresent = () => {
    hapticSuccess();
    const updated: Record<string, { status: DeskAttendanceStatus; remarks: string; reasonCategory: string }> = {};
    const activeLeaves = leaves.filter(l => 
      l.status === 'approved' && l.start_date <= selectedDate && l.end_date >= selectedDate
    );
    const excusedStudentIds = new Set(activeLeaves.map(l => l.student_id));

    students.forEach(s => {
      if (excusedStudentIds.has(s.id)) {
        updated[s.id] = { status: 'excused', remarks: 'Approved Leave Auto-Excused', reasonCategory: 'Medical / Illness' };
      } else {
        updated[s.id] = { status: 'present', remarks: '', reasonCategory: '' };
      }
    });
    setAttendanceRecords(updated);
  };

  const markAllAbsent = () => {
    hapticLight();
    const updated: Record<string, { status: DeskAttendanceStatus; remarks: string; reasonCategory: string }> = {};
    students.forEach(s => {
      updated[s.id] = { status: 'absent', remarks: 'Batch-wide absence logged', reasonCategory: 'Weather / Rain Disruption' };
    });
    setAttendanceRecords(updated);
  };

  const resetToUnmarked = () => {
    hapticLight();
    const updated: Record<string, { status: DeskAttendanceStatus; remarks: string; reasonCategory: string }> = {};
    students.forEach(s => {
      updated[s.id] = { status: 'unmarked', remarks: '', reasonCategory: '' };
    });
    setAttendanceRecords(updated);
  };

  // Update Individual Student Status
  const updateStudentStatus = (studentId: string, status: AttendanceStatus) => {
    hapticLight();
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

  // Update Reason Category
  const updateStudentReasonCategory = (studentId: string, reasonCategory: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        reasonCategory,
      },
    }));
  };

  // Save Attendance Submission
  const handleSaveAttendance = async () => {
    if (!token || !selectedBatchId) return;

    const unmarkedCount = students.filter(s => attendanceRecords[s.id]?.status === 'unmarked' || !attendanceRecords[s.id]?.status).length;
    if (unmarkedCount > 0) {
      alert(`Cannot save roster: ${unmarkedCount} student(s) remain unmarked. Please mark all students or click "1-Tap: Mark All Present".`);
      return;
    }

    setIsSaving(true);
    setSaveSuccessMessage(null);

    const payload = {
      batch_id: selectedBatchId,
      date: selectedDate,
      records: students.map(s => {
        const item = attendanceRecords[s.id];
        const effectiveStatus: AttendanceStatus = (item?.status as AttendanceStatus) || 'present';
        const formattedRemark = item?.reasonCategory 
          ? `[${item.reasonCategory}] ${item.remarks || ''}`.trim()
          : item?.remarks || undefined;

        return {
          student_id: s.id,
          status: effectiveStatus,
          remarks: formattedRemark,
        };
      }),
    };

    try {
      const res = await fetch('/api/v1/attendance/students/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to record attendance');

      const absentCount = students.filter(s => attendanceRecords[s.id]?.status === 'absent').length;
      setSaveSuccessMessage(`Attendance successfully recorded for ${students.length} students on ${selectedDate}.`);
      setLastSavedInfo({ date: selectedDate, count: students.length, absents: absentCount });
      setTimeout(() => setSaveSuccessMessage(null), 5000);

      fetchMonthlyRecords();
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
        start_date: todayStr,
        end_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        category: 'medical',
        reason: '',
      });
      fetchMetadata();
      fetchBatchRoster();
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
      fetchMetadata();
      fetchBatchRoster();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsReviewing(false);
    }
  };

  // Stats calculation
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

    const total = students.length;
    const marked = present + absent + late + excused;
    const attendancePct = marked > 0 ? Math.round(((present + late + excused) / marked) * 100) : null;

    return { total, present, absent, late, excused, unmarked, marked, attendancePct };
  }, [attendanceRecords, students.length]);

  // Filtered Students in Daily Roster
  const displayedStudents = useMemo(() => {
    return students.filter(student => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        student.full_name.toLowerCase().includes(q) ||
        student.admission_number.toLowerCase().includes(q) ||
        (student.guardian_name && student.guardian_name.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const record = attendanceRecords[student.id];
      const status = record ? record.status : 'unmarked';

      if (statusFilter === 'ALL') return true;
      return status === statusFilter;
    });
  }, [students, searchQuery, statusFilter, attendanceRecords]);

  // Days calculation for Monthly Matrix
  const monthDays = useMemo(() => {
    if (!selectedMonth) return [];
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const count = new Date(year, month, 0).getDate();

    const days = [];
    const weekdayInitials = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    for (let d = 1; d <= count; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr,
        weekday: weekdayInitials[dateObj.getDay()],
        isWeekend: dateObj.getDay() === 0,
        isToday: dateStr === todayStr
      });
    }
    return days;
  }, [selectedMonth, todayStr]);

  // Defaulters analysis (< 75% attendance)
  const defaultersList = useMemo(() => {
    return students.map(student => {
      const records = monthlyRecords.filter(r => r.student_id === student.id);
      const presentCount = records.filter(r => r.status === 'present' || r.status === 'late' || r.status === 'excused').length;
      const absentCount = records.filter(r => r.status === 'absent').length;
      const lateCount = records.filter(r => r.status === 'late').length;
      const totalSessions = records.length;
      const percentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

      return {
        student,
        presentCount,
        absentCount,
        lateCount,
        totalSessions,
        percentage,
        isDefaulter: totalSessions > 0 && percentage < 75
      };
    }).sort((a, b) => a.percentage - b.percentage);
  }, [students, monthlyRecords]);

  const activeBatchObj = batches.find(b => b.id === selectedBatchId);
  const isPastDate = selectedDate < todayStr;

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* Top Header */}
      <PageHeading
        title="Student Attendance"
        description="Daily class attendance registers, 31-day monthly matrix, absence tracking, and formal leave approvals."
        icon={<CheckSquare className="w-4 h-4 text-slate-700" />}
      />

      {/* Institutional Segmented Control Tabs */}
      {/* Mobile Tab Selector (Eliminates horizontal scrolling hurdle) */}
      {/* Mobile Tab Chips - Native Segmented Control */}
      <div className="sm:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all active:scale-95 ${
            activeTab === 'roster'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Daily Roster</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('monthly')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all active:scale-95 ${
            activeTab === 'monthly'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Monthly Register</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('defaulters')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all active:scale-95 ${
            activeTab === 'defaulters'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Defaulters</span>
          {defaultersList.filter(d => d.isDefaulter).length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'defaulters' ? 'bg-white text-amber-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {defaultersList.filter(d => d.isDefaulter).length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('leaves')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all active:scale-95 ${
            activeTab === 'leaves'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Leaves</span>
        </button>
      </div>

      {/* Desktop/Tablet Tab Bar - Segmented Control matching Image 1 */}
      <div className="hidden sm:flex items-center overflow-x-auto no-scrollbar max-w-full whitespace-nowrap bg-white p-0.5 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex-1 min-w-[90px] py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-press cursor-pointer ${
            activeTab === 'roster'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Calendar className={`w-3.5 h-3.5 ${activeTab === 'roster' ? 'text-white' : 'text-slate-500'}`} />
          <span>Daily Roster</span>
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 min-w-[100px] py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-press cursor-pointer ${
            activeTab === 'monthly'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CalendarDays className={`w-3.5 h-3.5 ${activeTab === 'monthly' ? 'text-white' : 'text-slate-500'}`} />
          <span>Monthly Register</span>
        </button>
        <button
          onClick={() => setActiveTab('defaulters')}
          className={`flex-1 min-w-[90px] py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-press cursor-pointer ${
            activeTab === 'defaulters'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BarChart2 className={`w-3.5 h-3.5 ${activeTab === 'defaulters' ? 'text-white' : 'text-slate-500'}`} />
          <span>Defaulters</span>
          {defaultersList.filter(d => d.isDefaulter).length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'defaulters' ? 'bg-white text-amber-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {defaultersList.filter(d => d.isDefaulter).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('leaves')}
          className={`flex-1 min-w-[80px] py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-press cursor-pointer ${
            activeTab === 'leaves'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className={`w-3.5 h-3.5 ${activeTab === 'leaves' ? 'text-white' : 'text-slate-500'}`} />
          <span>Leaves</span>
          {leaves.filter(l => l.status === 'pending').length > 0 && (
            <span className={`w-2 h-2 rounded-full animate-pulse ${activeTab === 'leaves' ? 'bg-white' : 'bg-rose-500'}`}></span>
          )}
        </button>
      </div>

      {/* TAB 1: DAILY ROSTER */}
      {activeTab === 'roster' && (
        <>
        <div className="space-y-3.5 sm:space-y-4">
          {/* Mobile Native Compact Session Bar (< 640px) */}
          <div className="sm:hidden bg-white border border-slate-200 rounded-2xl p-2.5 shadow-2xs space-y-2">
            {/* Line 1: Batch & Date Stepper */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                className="flex-1 min-w-0 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none"
              >
                {filteredBatches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.shift.toUpperCase()})</option>
                ))}
              </select>

              {/* Compact Date Stepper */}
              <div className="flex items-center gap-0.5 bg-slate-50 border border-slate-200 rounded-xl p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="p-1 text-slate-600 active:bg-slate-200 rounded-lg transition-colors touch-press"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-[11px] bg-transparent border-0 font-mono font-bold text-slate-900 focus:outline-none px-0.5 text-center w-[105px]"
                />
                <button
                  type="button"
                  onClick={handleNextDay}
                  className="p-1 text-slate-600 active:bg-slate-200 rounded-lg transition-colors touch-press"
                  aria-label="Next day"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Line 2: Quick Stats + 1-Tap All Present */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold">
                <span className="text-emerald-700">P:{stats.present}</span>
                <span className="text-amber-700">L:{stats.late}</span>
                <span className="text-rose-700">A:{stats.absent}</span>
                <span className="text-slate-300">·</span>
                <span className="text-indigo-700 font-bold">{stats.attendancePct === null ? '—' : `${stats.attendancePct}%`}</span>
              </div>
              <button
                type="button"
                onClick={markAllPresent}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200 text-emerald-800 text-[11px] font-bold touch-press cursor-pointer"
              >
                All Present
              </button>
            </div>
          </div>

          {/* Desktop Controls Bar (>= 640px) */}
          <div className="hidden sm:block bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-2xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Academic Hierarchy: Program & Batch Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-600">Class:</span>
                  <select
                    value={selectedProgramId}
                    onChange={e => setSelectedProgramId(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="ALL">All Classes / Programs</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-600">Batch:</span>
                  <select
                    value={selectedBatchId}
                    onChange={e => setSelectedBatchId(e.target.value)}
                    disabled={filteredBatches.length === 0}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-medium text-slate-800 focus:outline-none focus:border-indigo-600"
                  >
                    {filteredBatches.length === 0 ? (
                      <option value="">No batches found</option>
                    ) : (
                      filteredBatches.map(b => {
                        const progName = programs.find(p => p.id === b.program_id)?.name;
                        return (
                          <option key={b.id} value={b.id}>
                            {selectedProgramId === 'ALL' && progName ? `${progName} • ` : ''}{b.name} ({b.shift.toUpperCase()})
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                {activeBatchObj && (
                  <span className="text-[10.5px] font-mono px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 font-medium">
                    {students.length} Enrolled
                  </span>
                )}
              </div>

              {/* Temporal Navigation: < Previous Day, Date Picker, Today, Next Day > */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  title="Previous Day"
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-xs bg-transparent border-0 font-mono font-semibold text-slate-800 focus:outline-none px-1"
                />
                <button
                  type="button"
                  onClick={handleNextDay}
                  title="Next Day"
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  disabled={selectedDate === todayStr}
                  className="px-2 py-0.5 text-[10.5px] font-bold rounded transition-colors disabled:opacity-40 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Action Bar & Quick Marking Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={markAllPresent}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>1-Tap: Mark All Present</span>
                </button>

                <button
                  type="button"
                  onClick={markAllAbsent}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium transition-all"
                >
                  <span>Mark All Absent</span>
                </button>

                {isPastDate && (
                  <button
                    type="button"
                    onClick={resetToUnmarked}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium transition-all"
                  >
                    <span>Reset to Unmarked</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
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
                        { label: 'Enrolled', value: String(stats.total) },
                        { label: 'Present', value: String(stats.present) },
                        { label: 'Absent', value: String(stats.absent) },
                        { label: 'Late', value: String(stats.late) },
                        { label: 'Excused', value: String(stats.excused) },
                      ],
                      columns: [
                        { key: 'adm', label: 'Adm #', width: 75 },
                        { key: 'name', label: 'Student Name', width: 180 },
                        { key: 'guardian', label: 'Guardian & Mobile', width: 140 },
                        { key: 'status', label: 'Status', width: 75 },
                        { key: 'remarks', label: 'Remarks / Reason', width: 125 },
                      ],
                      rows: students.map(s => ({
                        adm: s.admission_number,
                        name: s.full_name,
                        guardian: `${s.guardian_name || '—'} (${s.guardian_phone || '—'})`,
                        status: (attendanceRecords[s.id]?.status || 'present').toUpperCase(),
                        remarks: attendanceRecords[s.id]?.reasonCategory 
                          ? `[${attendanceRecords[s.id]?.reasonCategory}] ${attendanceRecords[s.id]?.remarks || ''}`
                          : attendanceRecords[s.id]?.remarks || '—',
                      })),
                    });
                    await downloadPdfBytes(bytes, `attendance-${batch?.name || 'batch'}-${selectedDate}.pdf`);
                  }}
                  disabled={students.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Download Register</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={isSaving || students.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold shadow-[0_1px_2px_rgba(217,119,6,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-95 transition-all disabled:opacity-40"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isSaving ? 'Recording...' : 'Save Roster'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {saveSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveSuccessMessage}</span>
              </div>
              {lastSavedInfo && lastSavedInfo.absents > 0 && onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('absentee')}
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-md flex items-center gap-1 transition-colors"
                >
                  <span>Open Absentee Follow-Up Desk</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Unmarked Past Register Warning */}
          {isPastDate && stats.unmarked > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Unmarked Historical Register:</strong> {stats.unmarked} student(s) have unrecorded attendance for {selectedDate}. All students must have a recorded status before saving.
                </span>
              </div>
              <button
                type="button"
                onClick={markAllPresent}
                className="px-2.5 py-1 rounded-md bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold transition-all shrink-0"
              >
                1-Tap: Mark All Present
              </button>
            </div>
          )}

          {/* HIGH-DENSITY SUMMARY STRIP (Desktop only, mobile has session strip) */}
          <div className="hidden sm:flex bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Roster Strength:</span>
                <span className="font-mono text-indigo-600">{stats.total}</span>
              </div>

              <div className="h-3.5 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px]">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Present: <strong className="text-slate-900 font-bold">{stats.present}</strong>
                </span>
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Late: <strong className="text-slate-900 font-bold">{stats.late}</strong>
                </span>
                <span className="flex items-center gap-1.5 text-rose-700">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Absent: <strong className="text-slate-900 font-bold">{stats.absent}</strong>
                </span>
                <span className="flex items-center gap-1.5 text-indigo-700">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Excused: <strong className="text-slate-900 font-bold">{stats.excused}</strong>
                </span>
                {stats.unmarked > 0 && (
                  <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Unmarked: <strong>{stats.unmarked}</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                <span className="text-[10.5px] text-slate-500 font-medium">Rate:</span>
                <span className="font-mono font-bold text-slate-900 text-xs">
                  {stats.attendancePct === null ? '—' : `${stats.attendancePct}%`}
                </span>
              </div>
              {stats.absent > 0 && onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('absentee')}
                  className="text-[10.5px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-0.5 transition-colors"
                >
                  <span>{stats.absent} Absent (Follow-Up)</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Search & Status Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search student by name, admission number, or guardian..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 mr-1 text-[11px] font-medium">Filter:</span>
              {(['ALL', 'present', 'absent', 'late', 'excused', 'unmarked'] as const).map(s => {
                if (s === 'unmarked' && stats.unmarked === 0) return null;
                const isSel = statusFilter === s;
                let label = s.toUpperCase();
                if (s === 'ALL') label = `ALL (${stats.total})`;
                else if (s === 'present') label = `P (${stats.present})`;
                else if (s === 'absent') label = `A (${stats.absent})`;
                else if (s === 'late') label = `L (${stats.late})`;
                else if (s === 'excused') label = `E (${stats.excused})`;
                else if (s === 'unmarked') label = `U (${stats.unmarked})`;

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                      isSel
                        ? 'bg-amber-600 text-white font-bold shadow-xs' 
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                <p className="text-xs font-mono">Loading batch student roster...</p>
              </div>
            ) : batches.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-3">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <div>
                  <p className="text-sm font-bold text-slate-700">No academic batches yet</p>
                  <p className="text-xs text-slate-400 mt-1">Create a class and batch under Classes & Batches, then return here to mark attendance.</p>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('classes')}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  >
                    Go to Classes & Batches
                  </button>
                )}
              </div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-3">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <div>
                  <p className="text-sm font-bold text-slate-700">No active students enrolled in this batch</p>
                  <p className="text-xs text-slate-400 mt-1">Enroll students via Admissions Desk to activate attendance.</p>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('enrollment')}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  >
                    Go to Admissions Desk
                  </button>
                )}
              </div>
            ) : displayedStudents.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <p className="text-xs">No students matching the search query or status filter.</p>
              </div>
            ) : (
              <>
              {/* Desktop Attendance Table (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                      <th className="py-2 px-3 w-24">Adm #</th>
                      <th className="py-2 px-3">Student & Guardian Info</th>
                      <th className="py-2 px-3 w-28">Quick Contact</th>
                      <th className="py-2 px-3 text-center w-64">Status Action</th>
                      <th className="py-2 px-3">Administrative Reason & Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedStudents.map(student => {
                      const record = attendanceRecords[student.id] || { status: 'unmarked', remarks: '', reasonCategory: '' };
                      const isAutoExcused = record.status === 'excused' && record.remarks.includes('Auto-Excused');
                      const isUnmarked = record.status === 'unmarked';
                      const cleanGuardianPhone = cleanPhoneForWhatsApp(student.guardian_whatsapp || student.guardian_phone);

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Admission Number */}
                          <td className="py-2 px-3 font-mono font-bold text-slate-700">
                            {student.admission_number}
                          </td>

                          {/* Student & Guardian Info */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">{student.full_name}</span>
                              {isUnmarked && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold font-mono">
                                  Unmarked
                                </span>
                              )}
                              {student.fee_clearance_status === 'defaulter' ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold font-mono" title={`Overdue Balance: PKR ${(student.unpaid_balance ?? 0).toLocaleString()}`}>
                                  Fee Defaulter (PKR {(student.unpaid_balance ?? 0).toLocaleString()})
                                </span>
                              ) : student.fee_clearance_status === 'partial' ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold font-mono" title={`Pending Dues: PKR ${(student.unpaid_balance ?? 0).toLocaleString()}`}>
                                  Pending Dues (PKR {(student.unpaid_balance ?? 0).toLocaleString()})
                                </span>
                              ) : student.fee_clearance_status === 'cleared' ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold font-mono">
                                  Fee Cleared
                                </span>
                              ) : null}
                              {student.subjects && student.subjects.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                                  {student.subjects.length} Subjects
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span className="font-mono text-slate-400">{student.admission_number}</span>
                              {student.guardian_name && (
                                <>
                                  <span>•</span>
                                  <span>{student.guardian_name} {student.guardian_relation ? `(${student.guardian_relation})` : ''}</span>
                                </>
                              )}
                              {student.guardian_id_card && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-slate-400">CNIC: {student.guardian_id_card}</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Quick Contact Options */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              {student.guardian_phone ? (
                                <a
                                  href={`tel:${student.guardian_phone}`}
                                  title={`Call Guardian: ${student.guardian_phone}`}
                                  className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              ) : null}

                              {cleanGuardianPhone ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const text = `Assalam-o-Alaikum, this is regarding ${student.full_name} (Adm: ${student.admission_number}) from ${tenant?.name || 'the academy'}.`;
                                    window.open(`https://wa.me/${cleanGuardianPhone}?text=${encodeURIComponent(text)}`, '_blank');
                                  }}
                                  title={`WhatsApp Guardian: ${cleanGuardianPhone}`}
                                  className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md transition-colors"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              ) : null}

                              {!student.guardian_phone && !cleanGuardianPhone && (
                                <span className="text-[10px] text-slate-400 font-mono">—</span>
                              )}
                            </div>
                          </td>

                          {/* Status Action Buttons */}
                          <td className="py-2 px-3">
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
                                    className={`px-2 py-1 rounded text-xs capitalize transition-all border border-transparent ${
                                      isSelected ? `${activeStyles} shadow-2xs` : `bg-slate-100 ${activeStyles}`
                                    }`}
                                  >
                                    {status}
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          {/* Administrative Reason & Remarks */}
                          <td className="py-2 px-3">
                            {isAutoExcused ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <ShieldCheck className="w-3.5 h-3.5" /> Approved Leave Auto-Excused
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={record.reasonCategory || ''}
                                  onChange={e => updateStudentReasonCategory(student.id, e.target.value)}
                                  className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none max-w-[140px]"
                                >
                                  <option value="">-- Reason --</option>
                                  {COMMON_REASONS.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  placeholder="Specific note / remarks..."
                                  value={record.remarks}
                                  onChange={e => updateStudentRemarks(student.id, e.target.value)}
                                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Native Attendance Roster (< 768px, 68px–74px Dense Cells) */}
              <div className="md:hidden divide-y divide-slate-100 bg-white" data-testid="mobile-attendance-roster">
                {displayedStudents.map(student => {
                  const record = attendanceRecords[student.id] || { status: 'unmarked', remarks: '', reasonCategory: '' };
                  const cleanGuardianPhone = cleanPhoneForWhatsApp(student.guardian_whatsapp || student.guardian_phone);

                  return (
                    <div
                      key={student.id}
                      className="p-3 active:bg-slate-50 min-h-[70px] flex flex-col justify-center gap-1.5 transition-colors"
                      data-testid="attendance-roster-row"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Student Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5 truncate">
                            <span className="font-mono text-xs font-bold text-slate-700 shrink-0">
                              #{student.admission_number}
                            </span>
                            <span className="font-semibold text-[13.5px] text-slate-900 truncate leading-snug">
                              {student.full_name}
                            </span>
                            {student.fee_clearance_status === 'defaulter' && (
                              <span className="text-[9.5px] px-1 py-0.2 rounded bg-rose-100 text-rose-800 font-bold font-mono shrink-0">
                                Dues
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                            {student.guardian_name && (
                              <span className="truncate">{student.guardian_name}</span>
                            )}
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              {student.guardian_phone && (
                                <a
                                  href={`tel:${student.guardian_phone}`}
                                  className="p-1 text-slate-500 hover:text-slate-900 active:bg-slate-200 rounded transition-colors"
                                  title="Call"
                                >
                                  <Phone className="w-3 h-3" />
                                </a>
                              )}
                              {cleanGuardianPhone && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const text = `Assalam-o-Alaikum, this is regarding ${student.full_name} (Adm: ${student.admission_number}) from ${tenant?.name || 'the academy'}.`;
                                    window.open(`https://wa.me/${cleanGuardianPhone}?text=${encodeURIComponent(text)}`, '_blank');
                                  }}
                                  className="p-1 text-emerald-600 hover:text-emerald-800 active:bg-emerald-100 rounded transition-colors"
                                  title="WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 4-Segment Thumb Switch (P | L | A | E) */}
                        <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200/90 shrink-0">
                          {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map(status => {
                            const isSelected = record.status === status;
                            let activeClass = '';
                            let letter = 'P';
                            if (status === 'present') {
                              letter = 'P';
                              activeClass = isSelected ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'text-emerald-800 hover:bg-emerald-100/50';
                            } else if (status === 'late') {
                              letter = 'L';
                              activeClass = isSelected ? 'bg-amber-500 text-white shadow-2xs font-bold' : 'text-amber-800 hover:bg-amber-100/50';
                            } else if (status === 'absent') {
                              letter = 'A';
                              activeClass = isSelected ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'text-rose-800 hover:bg-rose-100/50';
                            } else {
                              letter = 'E';
                              activeClass = isSelected ? 'bg-indigo-600 text-white shadow-2xs font-bold' : 'text-indigo-800 hover:bg-indigo-100/50';
                            }

                            return (
                              <button
                                key={status}
                                type="button"
                                onClick={() => {
                                  hapticSelection();
                                  updateStudentStatus(student.id, status);
                                }}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-mono font-bold transition-all touch-press cursor-pointer ${activeClass}`}
                                aria-label={`Mark ${status}`}
                              >
                                {letter}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Reason / Remarks if Absent or Excused */}
                      {(record.status === 'absent' || record.status === 'excused' || record.remarks) && (
                        <div className="mt-1 flex items-center gap-1.5 pt-1 border-t border-slate-100">
                          <select
                            value={record.reasonCategory || ''}
                            onChange={e => updateStudentReasonCategory(student.id, e.target.value)}
                            className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 flex-1 min-w-0"
                          >
                            <option value="">Reason...</option>
                            {COMMON_REASONS.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Remarks..."
                            value={record.remarks || ''}
                            onChange={e => updateStudentRemarks(student.id, e.target.value)}
                            className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 flex-1 min-w-0"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Sticky Bottom Save Bar */}
        <div className="sm:hidden fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-0 right-0 p-3 bg-white/95 backdrop-blur-sm border-t border-slate-200 z-30 flex items-center justify-between gap-3 shadow-lg">
          <div className="text-xs">
            <span className="font-bold text-slate-900">{students.length} Students</span>
            <span className="text-slate-400 mx-1">•</span>
            <span className="text-emerald-700 font-bold">{Object.values(attendanceRecords).filter(r => r.status === 'present').length} Present</span>
          </div>
          <button
            type="button"
            onClick={() => {
              hapticSuccess();
              handleSaveAttendance();
            }}
            disabled={isSaving}
            className="h-12 min-h-[48px] px-5 py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold shadow-[0_1px_2px_rgba(217,119,6,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            <span>{isSaving ? 'Saving...' : 'Save Roster'}</span>
          </button>
        </div>
        </>
      )}

      {/* TAB 2: MONTHLY ATTENDANCE REGISTER MATRIX */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600">Batch:</span>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none"
                >
                  {batches.map(b => {
                    const progName = programs.find(p => p.id === b.program_id)?.name;
                    return (
                      <option key={b.id} value={b.id}>
                        {progName ? `${progName} • ` : ''}{b.name} ({b.shift.toUpperCase()})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600">Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Monthly Register</span>
            </button>
          </div>

          {/* Matrix Grid */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                  <tr className="text-slate-500 font-mono text-[10px] uppercase">
                    <th className="py-2.5 px-3 sticky left-0 bg-slate-50 z-20 w-20 border-r border-slate-200">Adm #</th>
                    <th className="py-2.5 px-3 sticky left-20 bg-slate-50 z-20 min-w-[140px] border-r border-slate-200">Student Name</th>
                    {monthDays.map(day => (
                      <th
                        key={day.dateStr}
                        className={`py-1 px-1 text-center min-w-[28px] border-r border-slate-200 ${
                          day.isToday ? 'bg-indigo-50 text-indigo-900 font-bold' : day.isWeekend ? 'bg-slate-100 text-slate-400' : ''
                        }`}
                      >
                        <div>{day.dayNumber}</div>
                        <div className="text-[10px] text-slate-400">{day.weekday}</div>
                      </th>
                    ))}
                    <th className="py-2.5 px-2 text-center text-emerald-700 bg-emerald-50/50">P</th>
                    <th className="py-2.5 px-2 text-center text-amber-700 bg-amber-50/50">L</th>
                    <th className="py-2.5 px-2 text-center text-rose-700 bg-rose-50/50">A</th>
                    <th className="py-2.5 px-2 text-center text-indigo-700 bg-indigo-50/50">E</th>
                    <th className="py-2.5 px-3 text-center bg-slate-100 font-semibold">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {students.map(student => {
                    let pCount = 0;
                    let aCount = 0;
                    let lCount = 0;
                    let eCount = 0;
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 sticky left-0 bg-white z-10 font-semibold border-r border-slate-200 text-slate-800">
                          {student.admission_number}
                        </td>
                        <td className="py-2 px-3 sticky left-20 bg-white z-10 font-sans font-medium text-slate-900 truncate max-w-[160px] border-r border-slate-200">
                          {student.full_name}
                        </td>
                        {monthDays.map(day => {
                          const rec = monthlyRecords.find(r => r.student_id === student.id && r.date === day.dateStr);
                          let code = '—';
                          let cellStyle = 'text-slate-300';

                          if (rec) {
                            if (rec.status === 'present') {
                              code = 'P';
                              cellStyle = 'text-emerald-700 bg-emerald-50 font-semibold';
                              pCount++;
                            } else if (rec.status === 'absent') {
                              code = 'A';
                              cellStyle = 'text-rose-700 bg-rose-50 font-semibold';
                              aCount++;
                            } else if (rec.status === 'late') {
                              code = 'L';
                              cellStyle = 'text-amber-700 bg-amber-50 font-semibold';
                              lCount++;
                            } else if (rec.status === 'excused') {
                              code = 'E';
                              cellStyle = 'text-indigo-700 bg-indigo-50 font-semibold';
                              eCount++;
                            }
                          }

                          return (
                            <td
                              key={day.dateStr}
                              className={`py-1 px-0.5 text-center text-[10px] border-r border-slate-100 ${cellStyle}`}
                              title={rec ? `${student.full_name} - ${day.dateStr}: ${rec.status.toUpperCase()} ${rec.remarks ? `(${rec.remarks})` : ''}` : undefined}
                            >
                              {code}
                            </td>
                          );
                        })}
                        <td className="py-2 px-2 text-center text-emerald-700 font-semibold bg-emerald-50/20">{pCount}</td>
                        <td className="py-2 px-2 text-center text-amber-700 font-semibold bg-amber-50/20">{lCount}</td>
                        <td className="py-2 px-2 text-center text-rose-700 font-semibold bg-rose-50/20">{aCount}</td>
                        <td className="py-2 px-2 text-center text-indigo-700 font-semibold bg-indigo-50/20">{eCount}</td>
                        <td className="py-2 px-3 text-center font-semibold bg-slate-50">
                          {pCount + aCount + lCount + eCount > 0 ? (
                            <span className={
                              Math.round(((pCount + lCount + eCount) / (pCount + aCount + lCount + eCount)) * 100) >= 75
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }>
                              {Math.round(((pCount + lCount + eCount) / (pCount + aCount + lCount + eCount)) * 100)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEFAULTERS & RETENTION ANALYTICS */}
      {activeTab === 'defaulters' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800">Attendance Threshold Analytics (&lt; 75%)</h3>
              <p className="text-[11px] text-slate-500">
                Identifies students at risk of falling behind due to chronic absenteeism.
              </p>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                {defaultersList.filter(d => d.isDefaulter).length} At-Risk Students
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                {defaultersList.filter(d => !d.isDefaulter && d.totalSessions > 0).length} Satisfactory
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-mono text-[11px] uppercase">
                    <th className="py-3 px-4">Adm #</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Guardian & Mobile</th>
                    <th className="py-3 px-4 text-center">Sessions Held</th>
                    <th className="py-3 px-4 text-center">Attended</th>
                    <th className="py-3 px-4 text-center">Missed</th>
                    <th className="py-3 px-4 text-center">Attendance %</th>
                    <th className="py-3 px-4 text-right">Intervention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {defaultersList.map(item => {
                    const cleanPhone = cleanPhoneForWhatsApp(item.student.guardian_whatsapp || item.student.guardian_phone);

                    return (
                      <tr key={item.student.id} className={item.isDefaulter ? 'bg-rose-50/30' : 'hover:bg-slate-50/60'}>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">{item.student.admission_number}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{item.student.full_name}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {item.student.guardian_name || '—'} {item.student.guardian_phone ? `(${item.student.guardian_phone})` : ''}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">{item.totalSessions}</td>
                        <td className="py-3 px-4 text-center font-mono text-emerald-700 font-bold">{item.presentCount}</td>
                        <td className="py-3 px-4 text-center font-mono text-rose-700 font-bold">{item.absentCount}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded ${
                            item.percentage >= 75 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : item.percentage >= 60 
                                ? 'bg-amber-50 text-amber-700' 
                                : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.totalSessions > 0 ? `${item.percentage}%` : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {cleanPhone && (
                            <button
                              type="button"
                              onClick={() => {
                                const msg = `Assalam-o-Alaikum, this is ${tenant?.name || 'Apex Academy'}. Important Notice: Your child ${item.student.full_name} (Adm: ${item.student.admission_number}) has an attendance rate of ${item.percentage}%, which is below our mandatory 75% threshold. Please contact the administration office.`;
                                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                              }}
                              className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold inline-flex items-center gap-1 transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp Notice</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LEAVE APPLICATIONS */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Student Formal Leave Applications</h2>
            <button
              onClick={() => setShowNewLeaveModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit Leave Application</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            {leaves.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-bold text-slate-700">No leave applications on record</p>
                <p className="text-xs text-slate-400 mt-1">Submit applications above to automate absence excusing on the daily roster.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Student Details</th>
                      <th className="py-3 px-4">Leave Duration</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaves.map(leave => {
                      const student = students.find(s => s.id === leave.student_id);

                      return (
                        <tr key={leave.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{student?.full_name || 'Student ID: ' + leave.student_id.slice(0, 8)}</span>
                            <span className="text-[11px] font-mono text-slate-500">{student?.admission_number || '—'}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {leave.start_date} to {leave.end_date}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold capitalize bg-slate-100 text-slate-700 border border-slate-200">
                              {leave.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                            {leave.reason}
                            {leave.review_notes && (
                              <span className="block text-[10px] text-slate-400 italic">Notes: {leave.review_notes}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                              leave.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              leave.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {leave.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {leave.status === 'pending' ? (
                              <button
                                type="button"
                                onClick={() => setReviewingLeave(leave)}
                                className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                              >
                                Review & Decide
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">Decided</span>
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
        </div>
      )}

      {/* MODAL: SUBMIT NEW LEAVE */}
      {showNewLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-xl space-y-4 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo title="New Leave Application" description="Submit formal absence excuse for approval" />
              <button
                type="button"
                onClick={() => setShowNewLeaveModal(false)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg touch-press -mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Student</label>
                <select
                  value={newLeaveForm.student_id}
                  onChange={e => setNewLeaveForm({ ...newLeaveForm, student_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                >
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newLeaveForm.start_date}
                    onChange={e => setNewLeaveForm({ ...newLeaveForm, start_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newLeaveForm.end_date}
                    onChange={e => setNewLeaveForm({ ...newLeaveForm, end_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={newLeaveForm.category}
                  onChange={e => setNewLeaveForm({ ...newLeaveForm, category: e.target.value as LeaveCategory })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                >
                  <option value="medical">Medical / Health Issue</option>
                  <option value="personal">Personal / Family Matter</option>
                  <option value="emergency">Emergency / Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Reason Description</label>
                <textarea
                  value={newLeaveForm.reason}
                  onChange={e => setNewLeaveForm({ ...newLeaveForm, reason: e.target.value })}
                  placeholder="Explain reason for student absence..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewLeaveModal(false)}
                  className="min-h-[44px] px-3.5 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLeave}
                  className="min-h-[44px] px-4 py-1.5 text-xs text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg font-semibold disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isSubmittingLeave ? 'Submitting...' : 'Submit Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REVIEW LEAVE */}
      {reviewingLeave && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-xl space-y-4 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo title="Review Leave Application" description="Approve or reject student leave request" />
              <button
                type="button"
                onClick={() => setReviewingLeave(null)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg touch-press -mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Duration:</span>
                <span className="font-mono font-semibold text-slate-800">{reviewingLeave.start_date} to {reviewingLeave.end_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="font-semibold capitalize text-slate-800">{reviewingLeave.category}</span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 block mb-1">Reason:</span>
                <p className="text-slate-800 italic bg-white p-2 rounded border border-slate-100">{reviewingLeave.reason}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Decision Notes (Optional)</label>
              <textarea
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="e.g. Medical certificate verified by academy nurse..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleReviewLeave('rejected')}
                disabled={isReviewing}
                className="min-h-[44px] px-3.5 py-1.5 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg font-bold transition-colors"
              >
                Reject Leave
              </button>
              <button
                type="button"
                onClick={() => handleReviewLeave('approved')}
                disabled={isReviewing}
                className="min-h-[44px] px-4 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold transition-colors"
              >
                Approve & Excuse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
