import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { TeacherPortalOverview, TimetableSlot, Batch, Exam } from '@apex/shared-types';
import { 
  GraduationCap, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  BookOpen, 
  FileCheck2, 
  ArrowRight,
  Sparkles,
  Users,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface TeacherPortalProps {
  onNavigate: (screen: string) => void;
}

export const TeacherPortalView: React.FC<TeacherPortalProps> = ({ onNavigate }) => {
  const { user, token } = useAuth();
  const [overview, setOverview] = useState<TeacherPortalOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
  }, [token]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs">Loading Faculty Academic Desk...</p>
      </div>
    );
  }

  const schedule: TimetableSlot[] = overview?.today_schedule || [];
  const batches: Batch[] = overview?.assigned_batches || [];
  const pendingAttendance: Batch[] = overview?.pending_attendance_batches || [];
  const pendingGrading: Exam[] = overview?.pending_grading_exams || [];
  const geofence = overview?.geofence_status;

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Faculty Academic Desk
                </h1>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold uppercase rounded-md">
                  {user?.full_name || 'Sir Tariq Physics'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Gulberg III Campus • Daily Lecture Schedule, Batch Attendance & Assessment Evaluator
              </p>
            </div>
          </div>

          {/* Geofence Clock-In Status */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="font-bold block text-[11px]">Geofence Clocked-In</span>
                <span className="text-[10px] text-emerald-700">At {geofence?.clocked_in_at || '08:24 AM'} ({geofence?.distance_meters || 18}m from gate)</span>
              </div>
            </div>
            <button
              onClick={() => onNavigate('geofence')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all"
            >
              <MapPin className="w-3.5 h-3.5" />
              GPS Desk
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Lectures</span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">{schedule.length} Classes</span>
            <span className="text-[10px] text-slate-500">MDCAT & FSc Tracks</span>
          </div>

          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/70">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Assigned Batches</span>
            <span className="text-2xl font-black text-indigo-950 mt-0.5 block">{batches.length} Batches</span>
            <span className="text-[10px] text-indigo-700">92 Enrolled Students</span>
          </div>

          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Pending Register</span>
            <span className="text-2xl font-black text-amber-900 mt-0.5 block">{pendingAttendance.length} Batch</span>
            <span className="text-[10px] text-amber-700">Awaiting Roll Call</span>
          </div>

          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/70">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Exams to Grade</span>
            <span className="text-2xl font-black text-purple-950 mt-0.5 block">{pendingGrading.length} Exams</span>
            <span className="text-[10px] text-purple-700">Mid-Term Assessments</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Schedule & Quick Action Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Today's Schedule */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
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
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[10px] font-bold rounded">
                          {slot.batch_name}
                        </span>
                        {idx === 0 && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Active Now
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                        <span>Room: <strong className="text-slate-700">{slot.room_name}</strong></span>
                        <span>•</span>
                        <span>Timing: <strong className="text-slate-700">{slot.start_time} - {slot.end_time}</strong></span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => onNavigate('attendance')}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Mark Attendance
                      </button>
                      <button
                        onClick={() => onNavigate('homework')}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-lg transition-all"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
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
              <Users className="w-4 h-4 text-emerald-600" />
              Assigned Academic Batches
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {batches.map(b => (
                <div key={b.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{b.name}</h4>
                      <p className="text-[10px] text-slate-500">{b.shift.toUpperCase()} • Room: {b.room_number || 'Hall 1'}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] font-bold rounded">
                      {b.current_enrollment} Students
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => onNavigate('attendance')}
                      className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg transition-all text-center"
                    >
                      Roll Call
                    </button>
                    <button
                      onClick={() => onNavigate('exams')}
                      className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold rounded-lg transition-all text-center"
                    >
                      Assessments
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Pending Exams to Grade & Homework Quick Post */}
        <div className="space-y-4">
          
          {/* Pending Grading Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <FileCheck2 className="w-4 h-4 text-purple-600" />
                Exams Awaiting Grading
              </h3>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded-full">
                {pendingGrading.length} Pending
              </span>
            </div>

            <div className="space-y-2.5">
              {pendingGrading.map(exam => (
                <div key={exam.id} className="p-3 bg-purple-50/40 rounded-xl border border-purple-100 space-y-2">
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">{exam.title}</h5>
                    <p className="text-[10px] text-slate-500 font-mono">Date: {exam.exam_date} • Total: {exam.total_marks} Marks</p>
                  </div>
                  <button
                    onClick={() => onNavigate('exams')}
                    className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded-lg shadow-xs flex items-center justify-center gap-1 transition-all"
                  >
                    <span>Enter Question Marks & Remarks</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Diary & Physical Notebook Checking Shortcut */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-5 text-white space-y-3 shadow-md">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-xs uppercase tracking-wider">Physical Notebook Inspection</h3>
            </div>
            <p className="text-xs text-indigo-200 leading-relaxed">
              Rapidly record physical notebook inspection checks (Done, Incomplete, Missing) for today's batches.
            </p>
            <button
              onClick={() => onNavigate('homework')}
              className="w-full py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Launch Notebook Checklist</span>
            </button>
          </div>

          {/* Quick Help Tip */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-indigo-600" />
              <span>Faculty Tip</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Attendance marked within the first 15 minutes of class triggers instant absentee follow-up rosters for front-desk staff.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
