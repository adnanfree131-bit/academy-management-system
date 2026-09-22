import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  StudentParentPortalOverview, 
  TimetableSlot, 
  StudentInvoice, 
  FeePayment, 
  HomeworkAssignment, 
  StudentOfficialReportCard,
  LeaveApplication,
  DayOfWeek 
} from '@apex/shared-types';
import { 
  Clock, 
  BookOpen, 
  Award, 
  Calendar, 
  Printer, 
  FileText, 
  Send, 
  CheckCircle2, 
  X, 
  Users, 
  Key, 
  Eye, 
  EyeOff, 
  Lock, 
  AlertCircle, 
  RefreshCw, 
  Building2, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  MessageSquare, 
  Filter, 
  CheckSquare, 
  ArrowRight,
  HelpCircle,
  GraduationCap
} from 'lucide-react';
import { useMobileOverlay } from '../lib/mobileOverlay';

export interface StudentPortalProps {
  onNavigate?: (screen: string) => void;
  activeScreen?: string;
  forcedTab?: 'schedule' | 'fees' | 'homework' | 'reports';
  studentId?: string | null;
  isAdminPreview?: boolean;
}

const DAYS_OF_WEEK: { key: DayOfWeek; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
];

export const StudentParentPortalView: React.FC<StudentPortalProps> = ({ 
  activeScreen,
  forcedTab, 
  onNavigate,
  studentId,
  isAdminPreview 
}) => {
  const { token, tenant, refreshSession } = useAuth();
  const [overview, setOverview] = useState<StudentParentPortalOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Modals & Popups
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(studentId || null);
  const [printingReportCard, setPrintingReportCard] = useState<StudentOfficialReportCard | null>(null);
  const [selectedChallanInvoice, setSelectedChallanInvoice] = useState<StudentInvoice | null>(null);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);

  // Timetable Screen State: active day of week
  const todayDayIndex = new Date().getDay();
  const daysMap: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayDayKey = daysMap[todayDayIndex];
  const initialTimetableDay: DayOfWeek = (todayDayKey === 'sunday' ? 'monday' : todayDayKey) as DayOfWeek;
  const [selectedTimetableDay, setSelectedTimetableDay] = useState<DayOfWeek>(initialTimetableDay);

  // Attendance Screen State: status filter
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('ALL');

  // Homework Screen State: filters
  const [homeworkSubjectFilter, setHomeworkSubjectFilter] = useState<string>('ALL');
  const [homeworkStatusFilter, setHomeworkStatusFilter] = useState<string>('ALL');

  // Leave Application State (Parent Absence / Sick Note)
  const [showLeaveModal, setShowLeaveModal] = useState<boolean>(false);
  const [leaveStartDate, setLeaveStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [leaveEndDate, setLeaveEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [leaveCategory, setLeaveCategory] = useState<'medical' | 'personal' | 'emergency'>('medical');
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState<boolean>(false);
  const [leaveSuccessMsg, setLeaveSuccessMsg] = useState<string | null>(null);

  // Portal Account Password Change State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  useMobileOverlay(
    'sheet',
    Boolean(showLeaveModal || selectedChallanInvoice || printingReportCard || showChangePasswordModal),
    () => {
      setShowLeaveModal(false);
      setSelectedChallanInvoice(null);
      setPrintingReportCard(null);
      setShowChangePasswordModal(false);
    }
  );

  // Resolve current active screen view
  const currentView = activeScreen || (
    forcedTab === 'fees' ? 'voucher' :
    forcedTab === 'homework' ? 'homework' :
    forcedTab === 'reports' ? 'exams' :
    'student_portal'
  );

  const handleCopyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleNavigateScreen = (screen: string) => {
    if (onNavigate) {
      onNavigate(screen);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordChangeError('New password and confirm password do not match.');
      return;
    }
    if (newPasswordInput.length < 6) {
      setPasswordChangeError('New password must be at least 6 characters long.');
      return;
    }
    setIsChangingPassword(true);
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);

    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPasswordInput,
          new_password: newPasswordInput,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordChangeSuccess('Your portal password has been updated successfully.');
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        if (data.data?.token) {
          localStorage.setItem('apex_jwt_token', data.data.token);
          if (refreshSession) {
            await refreshSession();
          }
        }
      } else {
        setPasswordChangeError(data.error?.message || 'Failed to update password');
      }
    } catch (err: any) {
      setPasswordChangeError(err.message || 'Network error updating password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const fetchOverview = async (targetStudentIdParam?: string | null, targetEnrollmentIdParam?: string | null) => {
    if (!token) return;
    setLoading(true);
    setFetchError(null);
    try {
      const targetId = targetStudentIdParam !== undefined ? targetStudentIdParam : (studentId || selectedStudentId);
      const targetEnrId = targetEnrollmentIdParam !== undefined ? targetEnrollmentIdParam : selectedEnrollmentId;
      const params = new URLSearchParams();
      if (targetId) params.append('student_id', targetId);
      if (targetEnrId) params.append('enrollment_id', targetEnrId);
      const queryStr = params.toString();
      const url = queryStr ? `/api/v1/portal/student-parent?${queryStr}` : '/api/v1/portal/student-parent';
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${token}` }
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.data) {
        setOverview(body.data);
        if (!selectedStudentId && body.data?.student_profile?.id) {
          setSelectedStudentId(body.data.student_profile.id);
        }
        if (body.data?.selected_enrollment_id) {
          setSelectedEnrollmentId(body.data.selected_enrollment_id);
        }
      } else {
        const errorMsg = body?.error?.message || `Failed to load student portal overview (HTTP ${res.status})`;
        setFetchError(errorMsg);
      }
    } catch (err: any) {
      console.error('Failed fetching student portal:', err);
      setFetchError(err.message || 'Network error connecting to academy portal');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const sId = overview?.student_profile?.id;
    if (!token || !sId) {
      alert('Unable to identify student record for leave application');
      return;
    }
    if (leaveEndDate < leaveStartDate) {
      alert('Leave end date cannot be earlier than start date.');
      return;
    }
    setIsSubmittingLeave(true);
    setLeaveSuccessMsg(null);
    try {
      const res = await fetch('/api/v1/attendance/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_id: sId,
          start_date: leaveStartDate,
          end_date: leaveEndDate,
          category: leaveCategory,
          reason: leaveReason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLeaveSuccessMsg('Your leave notice has been sent to the academy administration.');
        setLeaveReason('');
        setTimeout(() => {
          setShowLeaveModal(false);
          setLeaveSuccessMsg(null);
          fetchOverview(selectedStudentId);
        }, 1500);
      } else {
        alert(data.error?.message || 'Failed to submit leave notice');
      }
    } catch (err) {
      console.error('Error submitting leave:', err);
      alert('Failed to submit leave notice');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      setSelectedStudentId(studentId);
      fetchOverview(studentId);
    } else {
      fetchOverview(selectedStudentId);
    }
  }, [token, studentId]);

  const profile = overview?.student_profile;
  const todaySchedule: TimetableSlot[] = overview?.today_schedule || [];
  const weeklySchedule: TimetableSlot[] = overview?.weekly_schedule || overview?.today_schedule || [];
  const invoices: StudentInvoice[] = overview?.invoices || [];
  const payments: FeePayment[] = overview?.recent_receipts || [];
  const homework: HomeworkAssignment[] = overview?.homework_diary || [];
  const reportCards: StudentOfficialReportCard[] = overview?.exam_report_cards || [];
  const attendance = overview?.recent_attendance || [];
  const leaveApplications: LeaveApplication[] = (overview as any)?.leave_applications || [];
  const unpaidBalance = overview?.unpaid_balance || 0;
  const tenantBanking = (overview as any)?.tenant_banking || {
    bank_name: '',
    account_title: '',
    account_number: '',
    iban: '',
    raast_id: '',
    whatsapp_number: '',
  };

  // Today's attendance record check
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayAttendance = useMemo(() => {
    return attendance.find(a => a.date === todayDateStr);
  }, [attendance, todayDateStr]);

  // Timetable slots for the currently selected weekday tab
  const activeDaySlots = useMemo(() => {
    return weeklySchedule
      .filter(s => s.day_of_week === selectedTimetableDay && !s.is_cancelled)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  }, [weeklySchedule, selectedTimetableDay]);

  // Attendance stats
  const attendanceStats = useMemo(() => {
    const totalCount = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'PRESENT').length;
    const lateCount = attendance.filter(a => a.status === 'LATE').length;
    const absentCount = attendance.filter(a => a.status === 'ABSENT').length;
    const excusedCount = attendance.filter(a => a.status === 'EXCUSED').length;
    const computedPct = profile?.monthly_attendance_pct != null ? profile.monthly_attendance_pct : 100;
    return { totalCount, presentCount, lateCount, absentCount, excusedCount, pct: computedPct };
  }, [attendance, profile?.monthly_attendance_pct]);

  // Filtered attendance records
  const filteredAttendance = useMemo(() => {
    if (attendanceFilter === 'ALL') return attendance;
    return attendance.filter(a => a.status === attendanceFilter);
  }, [attendance, attendanceFilter]);

  // Enrolled subjects extracted
  const enrolledSubjects = useMemo(() => {
    if (profile?.subjects && profile.subjects.length > 0) return profile.subjects;
    const set = new Set<string>();
    homework.forEach(h => { if (h.subject_name) set.add(h.subject_name); });
    weeklySchedule.forEach(s => { if (s.subject_name) set.add(s.subject_name); });
    return Array.from(set);
  }, [profile?.subjects, homework, weeklySchedule]);

  // Filtered homework list
  const filteredHomework = useMemo(() => {
    return homework.filter(hw => {
      if (homeworkSubjectFilter !== 'ALL' && hw.subject_name !== homeworkSubjectFilter) {
        return false;
      }
      if (homeworkStatusFilter !== 'ALL') {
        const s = (hw as any).submission_status || 'pending';
        if (homeworkStatusFilter === 'checked' && !(s === 'done' || s === 'complete')) return false;
        if (homeworkStatusFilter === 'incomplete' && s !== 'incomplete') return false;
        if (homeworkStatusFilter === 'missing' && s !== 'missing') return false;
        if (homeworkStatusFilter === 'pending' && s !== 'pending') return false;
      }
      return true;
    });
  }, [homework, homeworkSubjectFilter, homeworkStatusFilter]);

  // Financial summary
  const financialSummary = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.net_amount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    return { totalInvoiced, totalPaid, balance: unpaidBalance };
  }, [invoices, payments, unpaidBalance]);

  const getSlotTimingStatus = (startTime: string, endTime: string, isToday: boolean) => {
    if (!isToday) {
      return { text: 'Scheduled', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [sH, sM] = (startTime || '').split(':').map(Number);
      const [eH, eM] = (endTime || '').split(':').map(Number);
      const startMin = (sH || 0) * 60 + (sM || 0);
      const endMin = (eH || 0) * 60 + (eM || 0);

      if (currentMinutes >= startMin && currentMinutes <= endMin) {
        return { text: 'Happening Now', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold animate-pulse' };
      }
      if (currentMinutes < startMin) {
        return { text: 'Upcoming Next', cls: 'bg-indigo-50 text-indigo-800 border-indigo-200 font-medium' };
      }
      return { text: 'Completed', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
    } catch (_e) {
      return { text: 'Scheduled', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  if (loading && !overview) {
    return (
      <div className="p-16 text-center text-slate-500 space-y-3">
        <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold">Opening Parent & Student Portal...</p>
      </div>
    );
  }

  if (fetchError && !overview) {
    return (
      <div className="p-6 max-w-xl mx-auto my-8 bg-white border border-rose-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900">Unable to Load Child Records</h3>
            <p className="text-xs text-rose-700 mt-1 leading-relaxed">{fetchError}</p>
            <p className="text-[11px] text-slate-500 mt-2">
              If your child was recently enrolled, please ensure the administration office has confirmed the admission, or log in with your registered Father/Guardian CNIC.
            </p>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => fetchOverview(selectedStudentId)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  // Pre-calculated WhatsApp link details
  const rawWa = tenantBanking.whatsapp_number || tenant?.phone || '';
  let cleanWa = rawWa.replace(/[^0-9]/g, '');
  if (cleanWa.startsWith('03')) {
    cleanWa = '92' + cleanWa.substring(1);
  } else if (cleanWa.startsWith('3')) {
    cleanWa = '92' + cleanWa;
  }
  const waMsg = `Assalam-o-Alaikum, I have transferred the tuition fee for ${profile?.full_name || 'student'} (Adm #${profile?.admission_number || profile?.roll_number || '—'}, Class: ${profile?.program_name || '—'}, Section: ${profile?.batch_name || '—'}). Attached is the payment screenshot for your records.`;
  const waUrl = cleanWa ? `https://wa.me/${cleanWa}?text=${encodeURIComponent(waMsg)}` : '#';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Administrative Preview Mode Notice */}
      {isAdminPreview && profile && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between text-amber-900 text-xs shadow-xs no-print">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Admin Preview Mode:</strong> Viewing portal as <strong>{profile.full_name}</strong> (Adm #{profile.admission_number || profile.roll_number || '—'} • Batch: {profile.batch_name}).
            </span>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('enrollment')}
              className="px-3 py-1.5 bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Exit Preview
            </button>
          )}
        </div>
      )}

      {/* =====================================================================
          1. PARENT & STUDENT HEADER CARD
          ===================================================================== */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Child Identity Info */}
          <div className="flex items-center gap-3.5 sm:gap-4">
            {profile?.photo_url ? (
              <img 
                src={profile.photo_url} 
                alt={profile.full_name} 
                className="w-14 h-18 sm:w-16 sm:h-20 rounded-xl object-cover border border-slate-300 bg-slate-100 shrink-0 shadow-2xs" 
              />
            ) : (
              <div className="w-14 h-18 sm:w-16 sm:h-20 rounded-xl border border-slate-300 bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-xl font-mono shrink-0 shadow-2xs">
                {profile?.full_name?.charAt(0) || 'S'}
              </div>
            )}
            
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {profile?.full_name || 'Student Profile'}
                </h1>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold rounded-md">
                  Adm #{profile?.admission_number || profile?.roll_number || '—'}
                </span>
              </div>

              <p className="text-xs text-slate-600">
                Class: <strong className="text-slate-900 font-semibold">{profile?.program_name || '—'}</strong>
                {profile?.batch_name && (
                  <> • Section: <strong className="text-slate-900 font-semibold">{profile.batch_name}</strong></>
                )}
                {profile?.shift && (
                  <> • Shift: <strong className="text-slate-900 font-semibold capitalize">{profile.shift}</strong>{profile?.start_time && profile?.end_time ? <span className="font-mono text-slate-700"> ({profile.start_time} – {profile.end_time})</span> : ''}</>
                )}
                {profile?.guardian_name && (
                  <> • Guardian: <span className="text-slate-800">{profile.guardian_name}</span></>
                )}
              </p>

              {/* Today's Status Banner for Parent */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {todayAttendance ? (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    todayAttendance.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                    todayAttendance.status === 'LATE' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                    todayAttendance.status === 'EXCUSED' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                    'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>
                      {todayAttendance.status === 'PRESENT' ? 'Present in School Today' :
                       todayAttendance.status === 'LATE' ? 'Arrived Late Today' :
                       todayAttendance.status === 'EXCUSED' ? 'Approved Leave Today' : 'Marked Absent Today'}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Regular Academic Session</span>
                  </span>
                )}

                {/* Monthly Attendance summary */}
                <span className="text-[11px] text-slate-500 font-medium">
                  Monthly Attendance: <strong className="text-slate-900 font-bold font-mono">{attendanceStats.pct}%</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Password Security */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            {/* Sibling Child Switcher for Parents with Multiple Children */}
            {overview?.linked_children && overview.linked_children.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <Users className="w-3.5 h-3.5 text-slate-500 ml-1 shrink-0" />
                <span className="text-[10px] uppercase font-bold text-slate-500 px-1 shrink-0">Select Child:</span>
                {overview.linked_children.map(child => {
                  const isSelected = child.id === profile?.id;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(child.id);
                        fetchOverview(child.id);
                      }}
                      className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {child.full_name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Class Switcher for Multi-Class Enrolled Students */}
            {overview?.enrollments && overview.enrollments.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <GraduationCap className="w-3.5 h-3.5 text-slate-500 ml-1 shrink-0" />
                <span className="text-[10px] uppercase font-bold text-slate-500 px-1 shrink-0">Class:</span>
                {overview.enrollments.map(enr => {
                  const isSelected = enr.id === overview.selected_enrollment_id;
                  return (
                    <button
                      key={enr.id}
                      type="button"
                      onClick={() => {
                        setSelectedEnrollmentId(enr.id);
                        fetchOverview(selectedStudentId, enr.id);
                      }}
                      className={`min-h-[44px] px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <span>{enr.batch_name || enr.program_name}</span>
                      {(enr.admission_number || enr.roll_number) && (
                        <span className={`text-[10px] font-mono ${isSelected ? 'text-amber-100' : 'text-slate-500'}`}>
                          ({enr.admission_number || enr.roll_number})
                        </span>
                      )}
                      {enr.is_primary && (
                        <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isSelected ? 'bg-amber-700 text-amber-100' : 'bg-slate-100 text-slate-600'}`}>
                          Primary
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Change Password Button */}
            <button
              type="button"
              onClick={() => {
                setPasswordChangeError(null);
                setPasswordChangeSuccess(null);
                setCurrentPasswordInput('');
                setConfirmPasswordInput('');
                setShowChangePasswordModal(true);
              }}
              className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Key className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Change Password</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          VIEW 1: CHILD OVERVIEW (PARENT'S MAIN DASHBOARD)
          ===================================================================== */}
      {currentView === 'student_portal' && (
        <div className="space-y-6">

          {/* 4 Big, Friendly Visual Status Boxes (2x2 on phone) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

            {/* 1. Fee Status (Top priority for parents) */}
            <div className={`rounded-2xl p-5 border transition-all space-y-2 shadow-xs ${
              unpaidBalance === 0 
                ? 'bg-emerald-50/70 border-emerald-200' 
                : 'bg-rose-50/70 border-rose-200'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Tuition Fees</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                  unpaidBalance === 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                }`}>
                  {unpaidBalance === 0 ? 'All Paid' : 'Due'}
                </span>
              </div>
              <div className={`text-2xl font-bold font-mono ${unpaidBalance === 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                {unpaidBalance === 0 ? 'PKR 0' : `PKR ${unpaidBalance.toLocaleString()}`}
              </div>
              <p className="text-xs text-slate-600">
                {unpaidBalance === 0 
                  ? 'All tuition fees are fully cleared. Thank you!' 
                  : 'Pending monthly fee. Please clear before due date.'}
              </p>
              <button
                type="button"
                onClick={() => handleNavigateScreen('voucher')}
                className="text-xs font-bold text-slate-900 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
              >
                <span>{unpaidBalance === 0 ? 'View Payment Receipts' : 'View Bank Details to Pay'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* 2. Monthly Attendance */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Attendance</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                  This Month
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                {attendanceStats.pct}%
              </div>
              <p className="text-xs text-slate-600">
                {attendanceStats.presentCount} days present • {attendanceStats.absentCount} absent
              </p>
              <button
                type="button"
                onClick={() => handleNavigateScreen('attendance')}
                className="text-xs font-bold text-slate-900 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
              >
                <span>View Attendance Record</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* 3. Today's Classes */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Today's Schedule</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                  {new Date().toLocaleDateString('en-GB', { weekday: 'short' })}
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                {todaySchedule.length} Lectures
              </div>
              <p className="text-xs text-slate-600">
                {todaySchedule.length > 0 
                  ? `Next: ${todaySchedule[0].subject_name} (${todaySchedule[0].start_time})`
                  : 'No lectures scheduled for today'}
              </p>
              <button
                type="button"
                onClick={() => handleNavigateScreen('timetable')}
                className="text-xs font-bold text-slate-900 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
              >
                <span>View Full Timetable</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* 4. Latest Exam Marks */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Exam Results</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                  Latest Exam
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                {reportCards.length > 0 
                  ? `${(reportCards[0].evaluation.percentage != null ? Number(reportCards[0].evaluation.percentage).toFixed(0) : '0')}%`
                  : 'Active'}
              </div>
              <p className="text-xs text-slate-600">
                {reportCards.length > 0 
                  ? `Rank #${reportCards[0].rank || 1} in class (${reportCards[0].exam.title})`
                  : 'Regular academic standing'}
              </p>
              <button
                type="button"
                onClick={() => handleNavigateScreen('exams')}
                className="text-xs font-bold text-slate-900 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
              >
                <span>View Report Cards</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

          </div>

          {/* Quick Action Strip for Parents */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Parent Quick Actions:</span>
            </span>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span>Send Fee Screenshot on WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={() => setShowLeaveModal(true)}
                className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>+ Request Sick Leave / Absence</span>
              </button>
            </div>
          </div>

          {/* Linked Children & Multi-Class Enrolled Programs (Parent View) */}
          {overview?.linked_children && overview.linked_children.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-amber-600" />
                  <span>Enrolled Classes & Programs ({overview.linked_children.length} {overview.linked_children.length === 1 ? 'Child' : 'Children'})</span>
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">Academic Record</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {overview.linked_children.map(child => (
                  <div key={child.id} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                          {child.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900">{child.full_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">Adm # {child.admission_number}</div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-[10px] text-slate-400">Total Unpaid</div>
                        <div className={`text-xs font-bold ${child.unpaid_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          PKR {child.unpaid_balance.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {child.classes && child.classes.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        {child.classes.map((cls: any) => (
                          <div key={cls.id} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-800">{cls.program_name}</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600">{cls.batch_name}</span>
                              {cls.is_primary && (
                                <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[9px] font-bold">
                                  Primary
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                              <span className="text-slate-500">Adm: {cls.admission_number || cls.roll_number || '—'}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                                cls.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {cls.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">{child.program_name} • {child.batch_name}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Two-Column Section: Schedule + Bank Payment Instructions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left Column (7/12): Today's Classes & Simple Bank Details */}
            <div className="lg:col-span-7 space-y-6">

              {/* Today's Lectures */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-700" />
                      <span>Today's Classes</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigateScreen('timetable')}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Full Week Timetable →</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {todaySchedule.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl space-y-2">
                      <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">No classes scheduled for today.</p>
                      <p className="text-xs text-slate-500">Regular lectures take place Monday through Saturday.</p>
                      <button
                        type="button"
                        onClick={() => handleNavigateScreen('timetable')}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer mt-1 shadow-xs"
                      >
                        View Monday–Saturday Schedule
                      </button>
                    </div>
                  ) : (
                    todaySchedule.map((slot, idx) => {
                      const timeStatus = getSlotTimingStatus(slot.start_time, slot.end_time, true);
                      return (
                        <div key={slot.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{slot.subject_name}</span>
                              <span className="text-xs text-slate-600">• Teacher: {slot.teacher_name}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Timing: <strong className="text-slate-700 font-mono">{slot.start_time} - {slot.end_time}</strong> • Room: <strong className="text-slate-700">{slot.room_name || 'Main Hall'}</strong>
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs shrink-0 ${timeStatus.cls}`}>
                            {timeStatus.text}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Simple Step-by-Step Fee Payment Card */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="text-base font-bold">How to Pay Tuition Fees from Home</h3>
                      <p className="text-xs text-slate-400">Easy 2-step transfer via Mobile Banking or Raast</p>
                    </div>
                  </div>
                </div>

                {/* Step 1 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-900 flex items-center justify-center text-[11px] font-bold">1</span>
                    <span>Transfer fee to our official academy account:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
                    {tenantBanking.bank_name && (
                      <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Bank</span>
                        <strong className="text-slate-100 block text-sm">{tenantBanking.bank_name}</strong>
                      </div>
                    )}
                    {tenantBanking.account_title && (
                      <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Title</span>
                        <strong className="text-slate-100 block text-sm">{tenantBanking.account_title}</strong>
                      </div>
                    )}
                    {tenantBanking.account_number && (
                      <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Account #</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(tenantBanking.account_number!, 'o_acc')}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === 'o_acc' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === 'o_acc' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <span className="font-mono font-bold text-slate-100 text-sm block mt-0.5">{tenantBanking.account_number}</span>
                      </div>
                    )}
                    {tenantBanking.iban && (
                      <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 uppercase font-bold">IBAN</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(tenantBanking.iban, 'o_iban')}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === 'o_iban' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === 'o_iban' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <span className="font-mono font-bold text-slate-100 text-xs block mt-0.5 select-all">{tenantBanking.iban}</span>
                      </div>
                    )}
                    {Boolean(tenantBanking.raast_id && tenantBanking.raast_id.trim()) && (
                      <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-emerald-400 uppercase font-bold">Raast ID (Instant Transfer)</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(tenantBanking.raast_id!, 'o_raast')}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === 'o_raast' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === 'o_raast' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <span className="font-mono font-bold text-slate-100 text-sm block mt-0.5">{tenantBanking.raast_id}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2 */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-900 flex items-center justify-center text-[11px] font-bold">2</span>
                    <span>Send screenshot on WhatsApp for instant confirmation:</span>
                  </div>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Open WhatsApp & Send Screenshot</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                </div>
              </div>

            </div>

            {/* Right Column (5/12): Homework & Attendance Log */}
            <div className="lg:col-span-5 space-y-6">

              {/* Homework Due Soon */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-slate-700" />
                    <span>Homework Diary</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleNavigateScreen('homework')}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All →</span>
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  {homework.length === 0 ? (
                    <p className="text-xs text-slate-400 p-4 text-center border border-dashed border-slate-200 rounded-xl">
                      No active homework assignments right now.
                    </p>
                  ) : (
                    homework.slice(0, 3).map(hw => (
                      <div key={hw.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-700 text-[11px]">{hw.subject_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">Due: {hw.due_date}</span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-xs">{hw.title}</h4>
                        <p className="text-slate-600 text-[11px] line-clamp-2">{hw.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Attendance Log */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-700" />
                    <span>Recent Attendance</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowLeaveModal(true)}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Leave Request</span>
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  {attendance.length === 0 ? (
                    <p className="text-xs text-slate-400 p-4 text-center border border-dashed border-slate-200 rounded-xl">
                      No attendance marked yet.
                    </p>
                  ) : (
                    attendance.slice(0, 5).map((att, i) => (
                      <div key={i} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-slate-800 font-bold text-xs">{att.date}</span>
                          {att.remarks && <span className="text-[10px] text-slate-400 block">{att.remarks}</span>}
                        </div>
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          att.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          att.status === 'EXCUSED' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          att.status === 'LATE' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {att.status === 'PRESENT' ? 'Present' : att.status === 'EXCUSED' ? 'Leave' : att.status === 'LATE' ? 'Late' : 'Absent'}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleNavigateScreen('attendance')}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold text-center transition-colors cursor-pointer"
                >
                  View Full Attendance History →
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* =====================================================================
          VIEW 2: CLASS TIMETABLE
          ===================================================================== */}
      {currentView === 'timetable' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-700" />
                  <span>Class Timetable</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Class: <strong className="text-slate-800 font-semibold">{profile?.program_name || '—'}</strong> • Section: <strong className="text-slate-800 font-semibold">{profile?.batch_name || '—'}</strong>
                  {profile?.shift && (
                    <> • Shift: <strong className="text-slate-800 font-semibold capitalize">{profile.shift}</strong>{profile?.start_time && profile?.end_time ? <span className="font-mono text-slate-700"> ({profile.start_time} – {profile.end_time})</span> : ''}</>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto border border-slate-200"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Print Timetable</span>
              </button>
            </div>

            {/* Day of Week Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {DAYS_OF_WEEK.map(d => {
                const isSelected = selectedTimetableDay === d.key;
                const isToday = todayDayKey === d.key;
                const countForDay = weeklySchedule.filter(s => s.day_of_week === d.key && !s.is_cancelled).length;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setSelectedTimetableDay(d.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{d.label}</span>
                    {isToday && (
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-emerald-600'}`} title="Today" />
                    )}
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${isSelected ? 'bg-amber-700 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                      {countForDay}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Lecture Schedule Cards */}
            <div className="space-y-2.5">
              {activeDaySlots.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No classes scheduled for {selectedTimetableDay.charAt(0).toUpperCase() + selectedTimetableDay.slice(1)}.
                </div>
              ) : (
                activeDaySlots.map((slot, i) => {
                  const isToday = todayDayKey === selectedTimetableDay;
                  const timeStatus = getSlotTimingStatus(slot.start_time, slot.end_time, isToday);
                  return (
                    <div key={slot.id || i} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-bold text-xs rounded">
                            Period {i + 1}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm">{slot.subject_name}</h4>
                          <span className="text-xs text-slate-600">• Teacher: {slot.teacher_name}</span>
                          {slot.substitute_teacher_name && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                              Sub: {slot.substitute_teacher_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Timing: <strong className="text-slate-800 font-mono">{slot.start_time} - {slot.end_time}</strong> • Classroom: <strong className="text-slate-800">{slot.room_name || 'Main Hall'}</strong>
                        </p>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-xs shrink-0 self-start sm:self-auto ${timeStatus.cls}`}>
                        {timeStatus.text}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 3: ATTENDANCE & LEAVES
          ===================================================================== */}
      {currentView === 'attendance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-slate-700" />
                  <span>Attendance & Leaves</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily attendance history and leave requests for {profile?.full_name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowLeaveModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>+ Inform Academy of Sick Leave</span>
              </button>
            </div>

            {/* Attendance Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-xs text-slate-500 font-bold uppercase block">Attendance Rate</span>
                <span className={`text-2xl font-bold font-mono block ${attendanceStats.pct >= 75 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {attendanceStats.pct}%
                </span>
                <span className="text-[11px] text-slate-400">Regular</span>
              </div>

              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
                <span className="text-xs text-emerald-800 font-bold uppercase block">Days Present</span>
                <span className="text-2xl font-bold font-mono text-emerald-900 block">{attendanceStats.presentCount}</span>
                <span className="text-[11px] text-emerald-600">Classes Attended</span>
              </div>

              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-center">
                <span className="text-xs text-amber-800 font-bold uppercase block">Days Late</span>
                <span className="text-2xl font-bold font-mono text-amber-900 block">{attendanceStats.lateCount}</span>
                <span className="text-[11px] text-amber-600">Arrived Late</span>
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl text-center">
                <span className="text-xs text-rose-800 font-bold uppercase block">Days Absent</span>
                <span className="text-2xl font-bold font-mono text-rose-900 block">{attendanceStats.absentCount}</span>
                <span className="text-[11px] text-rose-600">Missed Classes</span>
              </div>
            </div>
          </div>

          {/* Daily Attendance History & Leaves */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Attendance Log Table (7/12) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Attendance History ({filteredAttendance.length})
                </h3>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 text-xs font-semibold">
                  {(['ALL', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setAttendanceFilter(f)}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        attendanceFilter === f 
                          ? 'bg-amber-600 text-white font-bold shadow-xs' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f === 'ALL' ? 'All' : f === 'EXCUSED' ? 'Leaves' : f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {filteredAttendance.length === 0 ? (
                  <p className="p-6 text-center text-slate-400 text-xs">No records matching this filter.</p>
                ) : (
                  filteredAttendance.map((att, i) => (
                    <div key={i} className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">{att.date}</span>
                        {att.remarks && <span className="text-[11px] text-slate-500">{att.remarks}</span>}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                        att.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' :
                        att.status === 'EXCUSED' ? 'bg-blue-100 text-blue-800' :
                        att.status === 'LATE' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {att.status === 'PRESENT' ? 'Present' : att.status === 'EXCUSED' ? 'Approved Leave' : att.status === 'LATE' ? 'Late' : 'Absent'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Submitted Leave Requests (5/12) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Submitted Leave Notices ({leaveApplications.length})
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                {leaveApplications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-1">
                    <p className="font-medium">No leave notices submitted.</p>
                    <p className="text-[11px]">Use the button above to inform the academy if your child is sick.</p>
                  </div>
                ) : (
                  leaveApplications.map(leave => (
                    <div key={leave.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {leave.start_date} to {leave.end_date}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          leave.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          leave.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {leave.status === 'approved' ? 'Approved' : leave.status === 'rejected' ? 'Rejected' : 'Under Review'}
                        </span>
                      </div>
                      <p className="text-slate-700 text-xs">
                        <strong className="capitalize">[{leave.category}]:</strong> {leave.reason}
                      </p>
                      {leave.review_notes && (
                        <div className="p-2 bg-white rounded border border-slate-200 text-[11px] text-slate-700 italic">
                          <strong className="not-italic block font-bold text-slate-500 uppercase text-[9px]">Academy Response:</strong>
                          {leave.review_notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 4: FEES & PAYMENTS
          ===================================================================== */}
      {currentView === 'voucher' && (
        <div className="space-y-6">

          {/* Simple Fee Status Banner */}
          <div className={`p-6 rounded-2xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            unpaidBalance === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
          }`}>
            <div>
              <span className={`text-xs font-bold uppercase tracking-wider block ${unpaidBalance === 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                {unpaidBalance === 0 ? 'Fee Status: Fully Cleared' : 'Fee Status: Payment Due'}
              </span>
              <div className={`text-3xl font-bold font-mono mt-1 ${unpaidBalance === 0 ? 'text-emerald-900' : 'text-rose-700'}`}>
                PKR {unpaidBalance.toLocaleString()}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {unpaidBalance === 0 
                  ? 'All tuition fees are paid. Thank you!' 
                  : 'Please transfer fee to our official bank account or Raast below.'}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600 font-medium">
                <span>Total Invoiced: <strong className="text-slate-900 font-mono">PKR {financialSummary.totalInvoiced.toLocaleString()}</strong></span>
                <span>•</span>
                <span>Total Paid: <strong className="text-emerald-800 font-mono">PKR {financialSummary.totalPaid.toLocaleString()}</strong></span>
              </div>
            </div>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Send Screenshot on WhatsApp</span>
            </a>
          </div>

          {/* Step-by-Step Payment Info Box */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <span>Official Academy Bank Transfer Particulars</span>
            </h3>
            <p className="text-xs text-slate-300">
              Transfer tuition fee directly from your banking app (Meezan, HBL, UBL, EasyPaisa, JazzCash, Raast).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              {tenantBanking.bank_name && (
                <div className="p-3.5 bg-slate-800 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Bank Name</span>
                  <strong className="text-slate-100 block text-sm">{tenantBanking.bank_name}</strong>
                </div>
              )}
              {tenantBanking.account_title && (
                <div className="p-3.5 bg-slate-800 rounded-xl border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Title</span>
                  <strong className="text-slate-100 block text-sm">{tenantBanking.account_title}</strong>
                </div>
              )}
              {tenantBanking.account_number && (
                <div className="p-3.5 bg-slate-800 rounded-xl border border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Account Number</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(tenantBanking.account_number!, 'f_acc')}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'f_acc' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'f_acc' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <span className="font-mono font-bold text-slate-100 text-sm block mt-0.5">{tenantBanking.account_number}</span>
                </div>
              )}
              {tenantBanking.iban && (
                <div className="p-3.5 bg-slate-800 rounded-xl border border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">IBAN</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(tenantBanking.iban, 'f_iban')}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'f_iban' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'f_iban' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <span className="font-mono font-bold text-slate-100 text-xs block mt-0.5 select-all">{tenantBanking.iban}</span>
                </div>
              )}
              {Boolean(tenantBanking.raast_id && tenantBanking.raast_id.trim()) && (
                <div className="p-3.5 bg-slate-800 rounded-xl border border-slate-700 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold">Raast ID (Instant Transfer)</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(tenantBanking.raast_id!, 'f_raast')}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'f_raast' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'f_raast' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <span className="font-mono font-bold text-slate-100 text-sm block mt-0.5">{tenantBanking.raast_id}</span>
                </div>
              )}
            </div>
          </div>

          {/* Fee Bills & Challans Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Fee Invoices & Bank Challans ({invoices.length})
              </h3>
            </div>
            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="p-3">Month</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Balance</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Bank Challan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">No invoices on file.</td>
                    </tr>
                  ) : (
                    invoices.map(inv => {
                      const balance = inv.balance_due ?? (inv as any).balance_amount ?? 0;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-900">{inv.billing_month}</td>
                          <td className="p-3 font-mono text-slate-500">{inv.due_date}</td>
                          <td className="p-3 font-mono font-bold">PKR {inv.net_amount.toLocaleString()}</td>
                          <td className={`p-3 font-mono font-bold ${balance > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            PKR {balance.toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedChallanInvoice(inv)}
                              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-600" />
                              <span>Print Challan</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Native Fee Cards (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {invoices.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No invoices on file.</div>
              ) : (
                invoices.map(inv => {
                  const balance = inv.balance_due ?? (inv as any).balance_amount ?? 0;
                  return (
                    <div key={inv.id} className="p-3.5 space-y-2 active:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{inv.billing_month}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {inv.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Total Billed</span>
                          <span className="font-bold text-slate-800">PKR {inv.net_amount.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Due / Balance</span>
                          <span className={`font-bold ${balance > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                            PKR {balance.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[11px] font-mono text-slate-500">Due: {inv.due_date}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedChallanInvoice(inv)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border border-slate-200"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600" />
                          <span>Challan</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Payment History Receipts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Payment History ({payments.length})
              </h3>
            </div>
            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="p-3">Receipt #</th>
                    <th className="p-3">Payment Date</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">No payment receipts recorded yet.</td>
                    </tr>
                  ) : (
                    payments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-900">{p.receipt_number}</td>
                        <td className="p-3 font-mono text-slate-500">{p.payment_date}</td>
                        <td className="p-3 uppercase font-semibold text-slate-700">{p.payment_method}</td>
                        <td className="p-3 font-mono font-bold text-emerald-700">PKR {p.amount_paid.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Native Payment Cards (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {payments.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No payment receipts recorded yet.</div>
              ) : (
                payments.map(p => (
                  <div key={p.id} className="p-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900 block">{p.receipt_number}</span>
                      <span className="text-[11px] font-mono text-slate-500 block mt-0.5">{p.payment_date} • <span className="uppercase text-slate-700 font-semibold">{p.payment_method}</span></span>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      PKR {p.amount_paid.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* =====================================================================
          VIEW 5: HOMEWORK DIARY
          ===================================================================== */}
      {currentView === 'homework' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-slate-700" />
                  <span>Homework Diary</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily homework tasks assigned by teachers for {profile?.full_name}
                </p>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-slate-700">Subject:</span>
                <select
                  value={homeworkSubjectFilter}
                  onChange={e => setHomeworkSubjectFilter(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="ALL">All Subjects</option>
                  {enrolledSubjects.map((sub, i) => (
                    <option key={i} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Status:</span>
                <select
                  value={homeworkStatusFilter}
                  onChange={e => setHomeworkStatusFilter(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="checked">Checked: Complete</option>
                  <option value="incomplete">Incomplete Work</option>
                  <option value="missing">Notebook Missing</option>
                  <option value="pending">Pending Inspection</option>
                </select>
              </div>
            </div>

            {/* Homework Cards */}
            <div className="space-y-3">
              {filteredHomework.length === 0 ? (
                <p className="text-xs text-slate-400 p-8 text-center border border-dashed border-slate-200 rounded-xl">
                  No homework assignments matching selected filter.
                </p>
              ) : (
                filteredHomework.map(hw => {
                  const status = (hw as any).submission_status || 'pending';
                  const statusBadge = 
                    (status === 'done' || status === 'complete')
                      ? { text: 'Checked: Complete', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
                      : status === 'incomplete'
                      ? { text: 'Incomplete Work', cls: 'bg-rose-50 text-rose-800 border-rose-200' }
                      : status === 'missing'
                      ? { text: 'Notebook Missing', cls: 'bg-rose-50 text-rose-800 border-rose-200' }
                      : status === 'late'
                      ? { text: 'Submitted Late', cls: 'bg-amber-50 text-amber-800 border-amber-200' }
                      : { text: 'Pending Inspection', cls: 'bg-slate-100 text-slate-600 border-slate-200' };

                  return (
                    <div key={hw.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <span className="text-[11px] font-bold text-indigo-700 uppercase">{hw.subject_name}</span>
                          <h4 className="font-bold text-slate-900 text-sm mt-0.5">{hw.title}</h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{hw.description}</p>
                          {hw.attachment_url && (
                            <div className="mt-2">
                              <a
                                href={hw.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Download Worksheet / File</span>
                              </a>
                            </div>
                          )}
                        </div>
                        <span className={`px-2.5 py-1 border rounded-lg text-xs font-bold shrink-0 ${statusBadge.cls}`}>
                          {statusBadge.text}
                        </span>
                      </div>

                      {(hw as any).check_remarks && (
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Teacher's Note:</span>
                          <p className="italic text-slate-800 mt-0.5">{(hw as any).check_remarks}</p>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                        <span>Due Date: <strong className="text-slate-800 font-mono">{hw.due_date}</strong></span>
                        <span>Teacher: <strong className="text-slate-800">{hw.teacher_name || 'Course Instructor'}</strong></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 6: EXAMS & RESULTS
          ===================================================================== */}
      {currentView === 'exams' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-slate-700" />
                  <span>Examination Results & Report Cards</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official test evaluations and printable report cards for {profile?.full_name}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {reportCards.length === 0 ? (
                <p className="text-xs text-slate-400 p-8 text-center border border-dashed border-slate-200 rounded-xl">
                  No examination report cards published yet.
                </p>
              ) : (
                reportCards.map((rc, idx) => (
                  <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-mono text-[10px] font-bold uppercase rounded">
                          Exam Assessment
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-1">{rc.exam.title}</h4>
                        <p className="text-xs text-slate-500">
                          Date: {rc.exam.exam_date} • Class Position: <strong className="text-slate-900 font-bold">Rank #{rc.rank || 1}</strong> of {rc.total_students || 1} students
                        </p>
                      </div>

                      <div className="sm:text-right">
                        <span className="text-2xl font-bold font-mono text-slate-900">
                          {rc.evaluation.total_obtained} / {rc.exam.total_marks} Marks
                        </span>
                        <span className="text-xs font-bold text-slate-600 block">
                          {(rc.evaluation.percentage != null ? Number(rc.evaluation.percentage).toFixed(1) : '0.0')}% Score
                        </span>
                      </div>
                    </div>

                    {(rc.evaluation.short_remarks || rc.evaluation.long_remarks) && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700">
                        <strong className="text-[10px] text-slate-500 uppercase block font-bold mb-0.5">Teacher's Evaluation:</strong>
                        <p className="italic text-slate-800 text-xs leading-relaxed">
                          "{rc.evaluation.short_remarks || rc.evaluation.long_remarks}"
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-end pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setPrintingReportCard(rc)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View & Print Official Report Card</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: SICK LEAVE / ABSENCE NOTICE FOR PARENTS
          ===================================================================== */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="mobile-sheet-card bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-700" />
                <span>Send Absence / Sick Leave Notice</span>
              </h3>
              <button 
                onClick={() => setShowLeaveModal(false)} 
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500">Student: </span>
                <strong className="text-slate-900 font-semibold">{profile?.full_name}</strong>
                <span className="text-slate-500 ml-2">({profile?.batch_name})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">From Date</label>
                  <input
                    type="date"
                    required
                    value={leaveStartDate}
                    onChange={e => setLeaveStartDate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">To Date</label>
                  <input
                    type="date"
                    required
                    value={leaveEndDate}
                    onChange={e => setLeaveEndDate(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Reason Category</label>
                <select
                  value={leaveCategory}
                  onChange={e => setLeaveCategory(e.target.value as any)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="medical">Medical / Sick Leave</option>
                  <option value="personal">Personal / Family Matter</option>
                  <option value="emergency">Family Emergency</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Message for Teacher / Administration</label>
                <textarea
                  required
                  rows={3}
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  placeholder="Explain why your child is absent (e.g. high fever, doctor advised rest)..."
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {leaveSuccessMsg && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs rounded-lg flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{leaveSuccessMsg}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="w-full sm:w-auto min-h-[48px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLeave}
                  className="w-full sm:w-auto min-h-[48px] px-5 py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingLeave ? 'Sending...' : 'Send Notice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: OFFICIAL FEE CHALLAN (Bank Copy, Academy Copy, Student Copy)
          ===================================================================== */}
      {selectedChallanInvoice && (
        <div className="no-sheet-overlay fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-60 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-300 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between rounded-t-2xl no-print">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold">Official Fee Challan</h3>
                  <p className="text-xs text-slate-400 font-mono">Invoice: {selectedChallanInvoice.invoice_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Challan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedChallanInvoice(null)}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto printable-document bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans text-slate-900">
                {(['Bank Copy', 'Academy Copy', 'Student Copy'] as const).map((copyTitle, idx) => (
                  <div key={idx} className="bg-white p-4 border border-slate-300 rounded-xl shadow-2xs space-y-3 text-[11px] flex flex-col justify-between">
                    <div>
                      {/* Copy Header */}
                      <div className="border-b border-slate-900 pb-2 text-center">
                        <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-mono font-bold uppercase tracking-widest rounded-sm">
                          {copyTitle}
                        </span>
                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-tight mt-1.5">
                          {tenant?.name || 'Academy Management System'}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium">{tenant?.campus_name || 'Main Campus'}</p>
                      </div>

                      {/* Bank Details */}
                      <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded space-y-0.5 text-[10px]">
                        <div><span className="text-slate-500 font-bold">Bank:</span> <strong className="text-slate-800">{tenantBanking.bank_name || '—'}</strong></div>
                        <div><span className="text-slate-500 font-bold">Title:</span> <strong className="text-slate-800">{tenantBanking.account_title || '—'}</strong></div>
                        <div><span className="text-slate-500 font-bold">IBAN:</span> <strong className="font-mono text-slate-900">{tenantBanking.iban || '—'}</strong></div>
                        {Boolean(tenantBanking.raast_id && tenantBanking.raast_id.trim()) && (
                          <div><span className="text-slate-500 font-bold">Raast:</span> <strong className="font-mono text-slate-900">{tenantBanking.raast_id}</strong></div>
                        )}
                      </div>

                      {/* Particulars */}
                      <div className="mt-2 space-y-1 text-[10px] border-b border-slate-200 pb-2">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-bold">Challan #:</span>
                          <span className="font-mono font-bold text-slate-900">{selectedChallanInvoice.invoice_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-bold">Month:</span>
                          <span className="font-bold text-slate-800">{selectedChallanInvoice.billing_month}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-bold">Due Date:</span>
                          <span className="font-mono font-bold text-rose-700">{selectedChallanInvoice.due_date}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-bold">Student:</span>
                          <span className="font-bold text-slate-900 truncate max-w-[140px]">{profile?.full_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-bold">Class & Section:</span>
                          <span className="font-mono text-slate-800">{profile?.program_name || 'Class'} ({profile?.batch_name || 'Section'}) • Adm #{profile?.admission_number || profile?.roll_number}</span>
                        </div>
                      </div>

                      {/* Fee Head Breakdown */}
                      <table className="w-full text-[10px] mt-2 border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[9px]">
                            <th className="py-1 text-left">Fee Head</th>
                            <th className="py-1 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedChallanInvoice.items && selectedChallanInvoice.items.length > 0 ? (
                            selectedChallanInvoice.items.map((item, i) => (
                              <tr key={i}>
                                <td className="py-1 text-slate-700">{(item as any).title || item.head_name || 'Academic Fee'}</td>
                                <td className="py-1 text-right font-mono">{((item as any).amount ?? item.net_amount ?? item.original_amount ?? 0).toLocaleString()}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="py-1 text-slate-700">Tuition & Academic Charges</td>
                              <td className="py-1 text-right font-mono">{selectedChallanInvoice.net_amount.toLocaleString()}</td>
                            </tr>
                          )}
                          {(selectedChallanInvoice.discount_amount || 0) > 0 && (
                            <tr className="text-emerald-700 font-bold">
                              <td className="py-1">Approved Concession</td>
                              <td className="py-1 text-right font-mono">- {selectedChallanInvoice.discount_amount?.toLocaleString()}</td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-900 font-bold text-slate-900">
                            <td className="py-1.5">Net Payable by Due Date</td>
                            <td className="py-1.5 text-right font-mono">
                              PKR {(selectedChallanInvoice.balance_due ?? (selectedChallanInvoice as any).balance_amount ?? selectedChallanInvoice.net_amount).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-t border-slate-200 font-bold text-rose-700 text-[10px]">
                            <td className="py-1">After Due Date</td>
                            <td className="py-1 text-right font-mono">
                              PKR {((selectedChallanInvoice.balance_due ?? (selectedChallanInvoice as any).balance_amount ?? selectedChallanInvoice.net_amount) + (selectedChallanInvoice.fine_amount || 500)).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Signatures */}
                    <div className="pt-6 grid grid-cols-2 gap-2 text-center text-[9px] text-slate-400">
                      <div>
                        <div className="border-t border-slate-300 pt-1">Cashier / Bank Stamp</div>
                      </div>
                      <div>
                        <div className="border-t border-slate-300 pt-1">Depositor Signature</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between rounded-b-2xl no-print">
              <span className="text-xs text-slate-500">Present all 3 copies at any bank branch before due date.</span>
              <button
                type="button"
                onClick={() => setSelectedChallanInvoice(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: OFFICIAL REPORT CARD PRINT VIEW
          ===================================================================== */}
      {printingReportCard && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-60 overflow-y-auto no-sheet-overlay">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between rounded-t-2xl no-print">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold">Official Student Progress Report & Assessment Sheet</h3>
                  <p className="text-xs text-slate-400 font-mono">Exam: {printingReportCard.exam.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Report Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingReportCard(null)}
                  className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-lg touch-press -mr-2 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto printable-document bg-slate-50">
              <div className="font-sans text-slate-900 bg-white p-8 max-w-3xl mx-auto border border-slate-300 shadow-xs">
                {/* Institutional Letterhead */}
                <div className="border-b-2 border-slate-900 pb-4 mb-5 text-center">
                  <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900">
                    {tenant?.name || 'ACADEMY MANAGEMENT SYSTEM'}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium uppercase tracking-widest mt-0.5">
                    {tenant?.campus_name || 'Main Campus'} • Examination Board
                  </p>
                  <div className="inline-block mt-3 px-4 py-1 bg-slate-100 border border-slate-400 text-xs font-bold uppercase tracking-widest">
                    Official Student Progress Report & Assessment Sheet
                  </div>
                </div>

                {/* Particulars Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-xs border border-slate-300 p-3 bg-slate-50/50">
                  <div className="space-y-1">
                    <div><span className="text-slate-500 font-bold uppercase text-[10px]">Student Name: </span><span className="font-bold text-slate-900">{printingReportCard.student.full_name}</span></div>
                    <div><span className="text-slate-500 font-bold uppercase text-[10px]">Admission Number: </span><span className="font-mono font-bold text-slate-900">{printingReportCard.student.admission_number || printingReportCard.student.roll_number || '—'}</span></div>
                    <div><span className="text-slate-500 font-bold uppercase text-[10px]">Class & Section: </span><span className="font-bold text-slate-900">{(printingReportCard.student as any).program_name || (printingReportCard.student as any).class_name ? `${(printingReportCard.student as any).program_name || (printingReportCard.student as any).class_name} • ` : ''}{printingReportCard.student.batch_name}</span></div>
                  </div>
                  <div className="space-y-1">
                    <div><span className="text-slate-500 font-bold uppercase text-[10px]">Father / Guardian: </span><span className="font-bold text-slate-900">{profile?.guardian_name || '—'}</span></div>
                    <div><span className="text-slate-500 font-bold uppercase text-[10px]">Guardian CNIC: </span><span className="font-mono font-bold text-slate-900">{profile?.guardian_id_card || '—'}</span></div>
                    <div><span className="text-slate-500 font-bold uppercase text-[10px]">Date of Issue: </span><span className="font-mono text-slate-900">{new Date().toLocaleDateString('en-GB')}</span></div>
                  </div>
                </div>

                {/* Marks Table */}
                <table className="w-full text-xs mb-5 border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 text-left">
                      <th className="p-2.5 border-r border-slate-300 font-bold uppercase text-[10px]">Assessment Paper</th>
                      <th className="p-2.5 border-r border-slate-300 font-bold uppercase text-[10px]">Date Held</th>
                      <th className="p-2.5 border-r border-slate-300 text-right font-bold uppercase text-[10px]">Total Marks</th>
                      <th className="p-2.5 border-r border-slate-300 text-right font-bold uppercase text-[10px]">Marks Obtained</th>
                      <th className="p-2.5 border-r border-slate-300 text-right font-bold uppercase text-[10px]">Percentage</th>
                      <th className="p-2.5 text-center font-bold uppercase text-[10px]">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="p-2.5 border-r border-slate-300 font-bold">{printingReportCard.exam.title}</td>
                      <td className="p-2.5 border-r border-slate-300 font-mono">{printingReportCard.exam.exam_date}</td>
                      <td className="p-2.5 border-r border-slate-300 text-right font-mono">{printingReportCard.exam.total_marks}</td>
                      <td className="p-2.5 border-r border-slate-300 text-right font-mono font-bold">{printingReportCard.evaluation.total_obtained}</td>
                      <td className="p-2.5 border-r border-slate-300 text-right font-mono font-bold">{(printingReportCard.evaluation?.percentage != null ? Number(printingReportCard.evaluation.percentage) : 0).toFixed(1)}%</td>
                      <td className="p-2.5 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${(printingReportCard.evaluation?.percentage ?? 0) >= 40 ? 'bg-slate-100 text-slate-900' : 'bg-slate-200 text-slate-900'}`}>
                          {(printingReportCard.evaluation?.percentage ?? 0) >= 40 ? 'PASSED' : 'RE-APPEAR'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={2} className="p-2.5 border-r border-slate-300 uppercase text-[10px]">Summary Total</td>
                      <td className="p-2.5 border-r border-slate-300 text-right font-mono">{printingReportCard.exam.total_marks}</td>
                      <td className="p-2.5 border-r border-slate-300 text-right font-mono text-slate-900">{printingReportCard.evaluation.total_obtained}</td>
                      <td className="p-2.5 border-r border-slate-300 text-right font-mono">{(printingReportCard.evaluation?.percentage != null ? Number(printingReportCard.evaluation.percentage) : 0).toFixed(1)}%</td>
                      <td className="p-2.5 text-center font-mono uppercase">{(printingReportCard.evaluation?.percentage ?? 0) >= 40 ? 'QUALIFIED' : 'UNSATISFACTORY'}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Evaluation Remarks */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 print:grid-cols-3">
                  <div className="sm:col-span-2 border border-slate-300 p-3 rounded print:col-span-2">
                    <span className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Teacher Remarks:</span>
                    <p className="italic text-slate-800 text-xs">
                      "{printingReportCard.evaluation.short_remarks || printingReportCard.evaluation.long_remarks || 'Satisfactory academic performance.'}"
                    </p>
                  </div>
                  <div className="border border-slate-300 p-3 rounded text-center">
                    <span className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Class Merit Rank</span>
                    <span className="text-xl font-bold font-mono text-slate-900 block">
                      #{printingReportCard.rank || 1} <span className="text-xs text-slate-500 font-normal">of {printingReportCard.total_students || 1}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Attendance: {profile?.monthly_attendance_pct != null ? profile.monthly_attendance_pct : 100}%</span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs">
                  <div>
                    <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">Class Teacher</div>
                    <div className="text-[10px] text-slate-400">Signature</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">Exam Controller</div>
                    <div className="text-[10px] text-slate-400">Seal</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">Principal</div>
                    <div className="text-[10px] text-slate-400">Stamp</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end rounded-b-2xl no-print">
              <button
                type="button"
                onClick={() => setPrintingReportCard(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CHANGE PASSWORD (PARENT / STUDENT)
          ===================================================================== */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5 m-0 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full shadow-2xl border border-slate-300 border-t-4 border-t-amber-500 overflow-hidden flex flex-col mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Portal Account Password</h3>
                  <p className="text-[11px] text-slate-300">Update your account login password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePasswordModal(false)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-lg touch-press -mr-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {passwordChangeSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{passwordChangeSuccess}</span>
                </div>
              )}

              {passwordChangeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{passwordChangeError}</span>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                <span className="text-[11px] text-slate-500 font-medium block">Login Username</span>
                <span className="font-mono font-semibold text-slate-900 text-sm block">
                  {profile?.admission_number || profile?.guardian_id_card || profile?.roll_number || 'Registered Identifier'}
                </span>
                <p className="text-[10px] text-slate-400">
                  Your username is your registered Student Admission Number or Father/Guardian CNIC.
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      value={currentPasswordInput}
                      onChange={e => setCurrentPasswordInput(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPasswordInput}
                      onChange={e => setNewPasswordInput(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Confirm New Password</label>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPasswordInput}
                    onChange={e => setConfirmPasswordInput(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900 font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowChangePasswordModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword || !currentPasswordInput || !newPasswordInput}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl font-semibold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[44px]"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isChangingPassword ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Print Stylesheet for Report Cards and Fee Challans */}
      <style>{`
        @media print {
          @page {
            ${selectedChallanInvoice ? 'size: A4 landscape; margin: 6mm;' : 'size: A4 portrait; margin: 8mm;'}
          }
          body * {
            visibility: hidden;
          }
          .printable-document, .printable-document * {
            visibility: visible;
          }
          .printable-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: ${selectedChallanInvoice ? '2mm' : '5mm'};
            background: white !important;
            z-index: 99999;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
