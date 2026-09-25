import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { TeacherPortalOverview, TimetableSlot, Batch, Exam } from '@apex/shared-types';
import { campusToday, campusMinutes, parseTimeToMinutes } from '../lib/campusDate';
import { InstitutionalLoader } from '../components/InstitutionalLoader';
import { 
  Clock, 
  CheckCircle2, 
  BookOpen, 
  FileCheck2, 
  ArrowRight,
  Users,
  ShieldCheck,
  AlertCircle,
  LogIn,
  LogOut,
  RefreshCw,
  AlertTriangle,
  SlidersHorizontal
} from 'lucide-react';

interface TeacherPortalProps {
  onNavigate: (screen: string) => void;
}

export const TeacherPortalView: React.FC<TeacherPortalProps> = ({ onNavigate }) => {
  const { user, token, tenant } = useAuth();
  const [overview, setOverview] = useState<TeacherPortalOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showMetrics, setShowMetrics] = useState(false);

  // Live Geofence Attendance for Logged-in Faculty
  const todayStr = campusToday();
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [attendanceMsg, setAttendanceMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTodayAttendance = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/geofence/attendance/staff/me?date=${todayStr}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        setTodayRecord(body.data || null);
      }
    } catch {
      // Non-blocking
    }
  };

  const handleAction = async (action: 'in' | 'out') => {
    if (!token) return;
    if (!navigator.geolocation) {
      setAttendanceMsg({ type: 'error', text: 'Geolocation is not supported by your browser.' });
      return;
    }

    setIsProcessing(true);
    setAttendanceMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const endpoint = action === 'in' 
            ? '/api/v1/geofence/attendance/staff/clock-in'
            : '/api/v1/geofence/attendance/staff/clock-out';

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            })
          });

          const body = await res.json();
          if (res.ok && body.success) {
            setTodayRecord(body.data);
            setAttendanceMsg({
              type: 'success',
              text: action === 'in'
                ? 'Clocked in.'
                : `Clocked out. ${Math.floor((body.data.work_duration_minutes || 0) / 60)}h ${(body.data.work_duration_minutes || 0) % 60}m.`
            });
            fetchOverview();
          } else {
            setAttendanceMsg({
              type: 'error',
              text: body.error?.message || (action === 'in' ? 'You are outside the campus area.' : `Clock-${action} failed.`)
            });
          }
        } catch {
          setAttendanceMsg({ type: 'error', text: `Network error processing clock-${action}.` });
        } finally {
          setIsProcessing(false);
        }
      },
      (err) => {
        setIsProcessing(false);
        setAttendanceMsg({
          type: 'error',
          text: `GPS Location error: ${err.message}. Please enable location permissions.`
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const fetchOverview = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/portal/teacher', {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        setOverview(body.data);
      }
    } catch (err) {
      console.error('Failed fetching teacher portal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchTodayAttendance();
  }, [token]);

  if (loading) {
    return <InstitutionalLoader variant="page" label="Loading teacher portal..." />;
  }

  const schedule: TimetableSlot[] = overview?.today_schedule || [];
  const batches: Batch[] = overview?.assigned_batches || [];
  const pendingAttendance: Batch[] = overview?.pending_attendance_batches || [];
  const pendingGrading: Exam[] = overview?.pending_grading_exams || [];

  const formatTimeStr = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  const formatStatus = (st?: string) => {
    if (!st) return 'Present';
    const s = st.toLowerCase();
    if (s === 'on_time') return 'Present';
    if (s === 'late') return 'Late';
    if (s === 'half_day') return 'Half day';
    if (s === 'on_leave') return 'Leave';
    if (s === 'absent') return 'Absent';
    return st;
  };

  const nowMinutes = campusMinutes(new Date().toISOString(), tenant?.settings?.timezone || 'Asia/Karachi');

  const isSlotActiveNow = (slot: TimetableSlot) => {
    const start = parseTimeToMinutes(slot.start_time);
    const end = parseTimeToMinutes(slot.end_time);
    if (start === null || end === null) return false;
    return nowMinutes >= start && nowMinutes < end;
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 shrink-0 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-slate-700" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Faculty Portal
                </h1>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono font-bold uppercase rounded-md">
                  {user?.full_name || 'Faculty Member'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {tenant?.campus_name || 'Main Campus'} • Lecture schedule, batch attendance & evaluations
              </p>
            </div>
          </div>

          {/* Institutional Geofence Attendance Action Widget */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className={`w-4 h-4 shrink-0 ${todayRecord?.clock_in_time ? 'text-emerald-600' : 'text-slate-400'}`} />
              <div>
                <span className="font-bold text-[11px] text-slate-900 block">
                  {todayRecord?.clock_out_time
                    ? `Shift Completed · ${formatStatus(todayRecord.status)}`
                    : todayRecord?.clock_in_time
                    ? `Clocked In · ${formatStatus(todayRecord.status)}`
                    : todayRecord?.status
                    ? `${formatStatus(todayRecord.status)}`
                    : 'Clock in'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block">
                  {todayRecord?.clock_out_time
                    ? `In: ${formatTimeStr(todayRecord.clock_in_time)} | Out: ${formatTimeStr(todayRecord.clock_out_time)}`
                    : todayRecord?.clock_in_time
                    ? `In at ${formatTimeStr(todayRecord.clock_in_time)}`
                    : todayRecord?.status
                    ? `Status: ${formatStatus(todayRecord.status)}`
                    : 'Mark your arrival and departure'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!todayRecord?.clock_in_time ? (
                <button
                  type="button"
                  onClick={() => handleAction('in')}
                  disabled={isProcessing}
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogIn className="w-3.5 h-3.5" />
                  )}
                  Clock In
                </button>
              ) : !todayRecord?.clock_out_time ? (
                <button
                  type="button"
                  onClick={() => handleAction('out')}
                  disabled={isProcessing}
                  className="h-8.5 px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5" />
                  )}
                  Clock Out
                </button>
              ) : (
                <span className="h-8.5 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-semibold font-mono flex items-center">
                  Recorded
                </span>
              )}

              <button
                type="button"
                onClick={() => onNavigate('geofence')}
                className="h-8.5 px-3 py-1 text-slate-600 hover:text-slate-900 text-xs font-semibold hover:bg-slate-200/60 rounded-lg transition-all flex items-center"
                title="View Personal Monthly Attendance Register"
              >
                Log
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Message */}
        {attendanceMsg && (
          <div className={`mt-3 p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
            attendanceMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {attendanceMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className="flex-1">{attendanceMsg.text}</span>
            <button
              type="button"
              onClick={() => setAttendanceMsg(null)}
              className="text-[10px] font-bold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Metric Toggle */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={() => setShowMetrics(!showMetrics)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showMetrics
                ? 'bg-[#081A2F] text-amber-400 border-[#173252]'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
        </div>

        {/* 4 Metric Cards (Sidebar Dark Navy Design) */}
        {showMetrics && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs animate-in fade-in duration-150">
            <div className="p-3 bg-[#081A2F] rounded-xl border border-[#173252] shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Today's Lectures</span>
              <span className="text-base sm:text-lg font-bold font-mono text-white mt-0.5 block">{schedule.length} Classes</span>
              <span className="text-[10px] text-slate-400">Academic Tracks</span>
            </div>

            <div className="p-3 bg-[#081A2F] rounded-xl border border-[#173252] shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Assigned Batches</span>
              <span className="text-base sm:text-lg font-bold font-mono text-white mt-0.5 block">{batches.length} Batches</span>
              <span className="text-[10px] text-slate-400">Enrolled Students</span>
            </div>

            <div className="p-3 bg-[#081A2F] rounded-xl border border-[#173252] shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Pending Attendance</span>
              <span className="text-base sm:text-lg font-bold font-mono text-white mt-0.5 block">{pendingAttendance.length} Batch</span>
              <span className="text-[10px] text-slate-400">Attendance Pending</span>
            </div>

            <div className="p-3 bg-[#081A2F] rounded-xl border border-[#173252] shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Exams to Grade</span>
              <span className="text-base sm:text-lg font-bold font-mono text-white mt-0.5 block">{pendingGrading.length} Exams</span>
              <span className="text-[10px] text-slate-400">Assessments</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Today's Schedule & Quick Action Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Today's Schedule */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-700" />
                Today's Teaching Schedule
              </h2>
              <span className="text-xs font-mono text-slate-400">
                {overview?.today_date} • Real-Time
              </span>
            </div>

            <div className="space-y-3">
              {schedule.length === 0 ? (
                <p className="text-xs text-slate-400 p-4 text-center">No scheduled lectures for today.</p>
              ) : (
                schedule.map((slot, idx) => (
                  <div key={slot.id || idx} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{slot.subject_name}</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-bold rounded">
                          {slot.batch_name}
                        </span>
                        {isSlotActiveNow(slot) && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Active Now
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                        <span>Room: <strong className="text-slate-700">{slot.room_name || 'Room not set'}</strong></span>
                        <span>•</span>
                        <span>Timing: <strong className="text-slate-700">{slot.start_time} - {slot.end_time}</strong></span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => {
                          if (slot.batch_id) {
                            sessionStorage.setItem('kampus.pendingBatch', slot.batch_id);
                          }
                          onNavigate('attendance');
                        }}
                        className="h-8 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Mark Attendance
                      </button>
                      <button
                        onClick={() => {
                          if (slot.batch_id) {
                            sessionStorage.setItem('kampus.pendingBatch', slot.batch_id);
                          }
                          if (slot.subject_id) {
                            sessionStorage.setItem('kampus.pendingSubject', slot.subject_id);
                          }
                          onNavigate('homework');
                        }}
                        className="h-8 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-slate-600" />
                        Diary
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Assigned Batches Quick Management */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              Assigned Academic Batches
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {batches.length === 0 ? (
                <div className="col-span-full py-8 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-700">No batches currently assigned</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    No classes assigned yet. Ask the office to assign them.
                  </p>
                </div>
              ) : (
                batches.map(b => (
                  <div key={b.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">{b.name}</h4>
                        <p className="text-[10px] text-slate-500">{b.shift.toUpperCase()} {b.start_time && b.end_time ? `• ${b.start_time} – ${b.end_time}` : ''}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] font-bold rounded">
                        {b.current_enrollment} Students
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          if (b.id) {
                            sessionStorage.setItem('kampus.pendingBatch', b.id);
                          }
                          onNavigate('attendance');
                        }}
                        className="flex-1 h-8 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold rounded-lg transition-all text-center border border-slate-200/60 flex items-center justify-center cursor-pointer"
                      >
                        Mark Attendance
                      </button>
                      <button
                        onClick={() => onNavigate('exams')}
                        className="flex-1 h-8 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold rounded-lg transition-all text-center flex items-center justify-center"
                      >
                        Assessments
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Pending Exams to Grade & Homework Quick Post */}
        <div className="space-y-4">
          
          {/* Pending Grading Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <FileCheck2 className="w-4 h-4 text-slate-700" />
                Exams Awaiting Grading
              </h3>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-bold rounded-full">
                {pendingGrading.length} Pending
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {pendingGrading.map(exam => (
                <div key={exam.id} className="py-2.5 space-y-2">
                  <div>
                    <h5 className="font-semibold text-slate-900 text-xs">{exam.title}</h5>
                    <p className="text-[10px] text-slate-500 font-mono">Date: {exam.exam_date} • Total: {exam.total_marks} Marks</p>
                  </div>
                  <button
                    onClick={() => onNavigate('exams')}
                    className="w-full h-8 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <span>Enter Marks & Remarks</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Diary & Physical Notebook Checking Shortcut */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white space-y-3 shadow-xs">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-300" />
              <h3 className="font-bold text-xs uppercase tracking-wider">Notebook Inspection</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Record student notebook completion status (Complete, Incomplete, Missing) for today's classes.
            </p>
            <button
              onClick={() => onNavigate('homework')}
              className="w-full h-8.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs rounded-lg shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Check Notebooks</span>
            </button>
          </div>

          {/* Quick Help Tip */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-slate-600" />
              <span>Attendance Notice</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Attendance marked during class notifies administration for parent absence follow-up.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
