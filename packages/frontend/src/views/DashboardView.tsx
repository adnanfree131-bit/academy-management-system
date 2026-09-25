import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronRight,
  CheckSquare,
  CreditCard,
  Plus,
  Users,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  UserCheck,
  PhoneCall,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Batch,
  AcademicProgram,
  Student,
  StudentInvoice,
  Exam,
} from '@apex/shared-types';
import { campusToday, campusDayOfWeek, formatCampusTime } from '../lib/campusDate';

interface DashboardViewProps {
  onNavigate: (screenId: string) => void;
}

interface TimetableSlot {
  id: string;
  batch_id: string;
  batch_name?: string;
  subject_id: string;
  subject_name?: string;
  teacher_id: string;
  teacher_name?: string;
  room_id?: string;
  room_name?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

interface StaffRosterItem {
  id?: string;
  user_id?: string;
  staff_id?: string;
  full_name?: string;
  staff_name?: string;
  department?: string;
  designation?: string;
  status?: string;
  clock_in_time?: string;
  minutes_late?: number;
}

interface HomeworkItem {
  id: string;
  title: string;
  subject_name?: string;
  batch_name?: string;
  teacher_name?: string;
  assigned_date: string;
  due_date: string;
}

interface InquiryItem {
  id: string;
  full_name: string;
  phone?: string;
  stage?: string;
  notes?: string;
}

function money(n: number) {
  return `PKR ${Math.round(n).toLocaleString('en-US')}`;
}

/* ─── Stream Distribution Donut Chart ─── */
function StreamDonut({
  items,
  total,
}: {
  items: { label: string; count: number; pct: number; color: string }[];
  total: number;
}) {
  const size = 100;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPct = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {items.map(item => {
            const dashLength = (item.pct / 100) * circumference;
            const dashOffset = -((accumulatedPct / 100) * circumference);
            accumulatedPct += item.pct;
            return (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
                fill="transparent"
                className="transition-all duration-300"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1 pointer-events-none">
          <span className="text-xl font-bold font-mono tracking-tight text-[#081A2F] leading-none">
            {total}
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5">Enrolled</span>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-700 font-medium truncate text-[11px]">{item.label}</span>
            </div>
            <span className="font-mono font-bold text-slate-900 text-[11px] shrink-0">
              {item.count} <span className="text-slate-400 font-normal">({item.pct}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user, tenant, token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [staffRoster, setStaffRoster] = useState<StaffRosterItem[]>([]);
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [inquiriesList, setInquiriesList] = useState<InquiryItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

  const loadData = async () => {
    if (!token) return;
    setIsRefreshing(true);
    const headers = { Authorization: `Bearer ${token}` };
    const today = campusToday();

    try {
      const [
        studRes,
        batchRes,
        progRes,
        feeRes,
        attRes,
        rosterRes,
        timeRes,
        hwRes,
        inqRes,
        examRes,
      ] = await Promise.all([
        fetch('/api/v1/sis/students', { headers }).catch(() => null),
        fetch('/api/v1/academic/batches', { headers }).catch(() => null),
        fetch('/api/v1/academic/programs', { headers }).catch(() => null),
        fetch('/api/v1/finance/invoices', { headers }).catch(() => null),
        fetch(`/api/v1/attendance/students?date=${today}`, { headers }).catch(() => null),
        fetch(`/api/v1/geofence/roster?date=${today}`, { headers }).catch(() => null),
        fetch(`/api/v1/timetable?day=${campusDayOfWeek(today)}`, { headers }).catch(() => null),
        fetch('/api/v1/homework', { headers }).catch(() => null),
        fetch('/api/v1/sis/inquiries', { headers }).catch(() => null),
        fetch('/api/v1/exams', { headers }).catch(() => null),
      ]);

      const json = async (res: Response | null) => (res && res.ok ? (await res.json()).data : null);

      const [
        stud,
        batch,
        prog,
        fees,
        att,
        roster,
        slots,
        hw,
        inquiries,
        examList,
      ] = await Promise.all([
        json(studRes),
        json(batchRes),
        json(progRes),
        json(feeRes),
        json(attRes),
        json(rosterRes),
        json(timeRes),
        json(hwRes),
        json(inqRes),
        json(examRes),
      ]);

      if (Array.isArray(stud)) setStudents(stud);
      if (Array.isArray(batch)) setBatches(batch);
      if (Array.isArray(prog)) setPrograms(prog);
      if (Array.isArray(fees)) setInvoices(fees);
      if (Array.isArray(att)) setAttendanceRecords(att);
      if (Array.isArray(roster)) setStaffRoster(roster);
      if (Array.isArray(slots)) {
        const todayWeekday = campusDayOfWeek(today);
        setTimetableSlots(slots.filter((s: TimetableSlot) => s.day_of_week === todayWeekday));
      }
      if (Array.isArray(hw)) setHomeworkList(hw);
      if (Array.isArray(inquiries)) setInquiriesList(inquiries);
      if (Array.isArray(examList)) setExams(examList);
    } catch (err) {
      console.error('Dashboard load failed', err);
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  /* ─── Ground Truth Metrics ─── */
  const activeStudents = students.filter(s => s.status === 'active').length;
  const batchesWithCapacity = batches.filter(b => typeof b.max_capacity === 'number' && b.max_capacity > 0);
  const totalCapacity = batchesWithCapacity.reduce((sum, b) => sum + (b.max_capacity as number), 0);
  const hasCapacity = batchesWithCapacity.length > 0 && totalCapacity > 0;
  const capacityPct = hasCapacity ? Math.round((activeStudents / totalCapacity) * 100) : 0;

  // Student Attendance
  const markedBatchIds = new Set(attendanceRecords.map((r: any) => r.batch_id).filter(Boolean));
  const markedBatchesCount = batches.filter(b => markedBatchIds.has(b.id)).length;
  const unmarkedBatches = batches.filter(b => !markedBatchIds.has(b.id));
  const presentCount = attendanceRecords.filter((r: any) => r.status === 'present').length;
  const lateCount = attendanceRecords.filter((r: any) => r.status === 'late').length;
  const absentCount = attendanceRecords.filter((r: any) => r.status === 'absent').length;
  const totalMarked = attendanceRecords.length;
  const isAttendanceSubmittedToday = totalMarked > 0;
  const attendanceRate = isAttendanceSubmittedToday
    ? Math.round(((presentCount + lateCount) / totalMarked) * 100)
    : 0;

  // Staff Attendance Roster
  const isStaffOnDuty = (status?: string) => {
    const st = (status || '').toLowerCase();
    return st === 'on_time' || st === 'present' || st === 'late' || st === 'half_day';
  };
  const presentStaffCount = staffRoster.filter(s => isStaffOnDuty(s.status)).length;
  const lateStaffCount = staffRoster.filter(s => (s.status || '').toLowerCase() === 'late').length;
  const halfDayStaffCount = staffRoster.filter(s => (s.status || '').toLowerCase() === 'half_day').length;
  const leaveStaffCount = staffRoster.filter(s => {
    const st = (s.status || '').toLowerCase();
    return st === 'on_leave' || st === 'leave';
  }).length;
  const totalStaffCount = staffRoster.length;
  const staffPresentPct = totalStaffCount > 0 ? Math.round((presentStaffCount / totalStaffCount) * 100) : 0;

  // Homework Diary Metrics
  const campusDateStr = campusToday();
  const sortedHomeworkList = [...homeworkList].sort((a, b) => {
    const d = (b.assigned_date || '').localeCompare(a.assigned_date || '');
    if (d !== 0) return d;
    return (b.id || '').localeCompare(a.id || '');
  });
  const todayHomework = sortedHomeworkList.filter(h => h.assigned_date === campusDateStr);
  const snippetHomework = todayHomework[0] || sortedHomeworkList[0];

  // Finance
  const liveInvoices = invoices.filter(inv => {
    const st = String(inv.status || '').toLowerCase();
    return st !== 'cancelled' && st !== 'voided' && st !== 'rolled_over';
  });
  const totalBilled = liveInvoices.reduce((a, inv) => a + (inv.net_total ?? inv.net_amount ?? 0), 0);
  const totalCollected = liveInvoices.reduce((a, inv) => a + (inv.paid_amount ?? 0), 0);
  const overdueInvoices = liveInvoices.filter(inv => {
    const bal = inv.balance_due ?? inv.balance_amount ?? 0;
    return bal > 0 && Boolean(inv.due_date) && inv.due_date! < campusDateStr;
  });
  const overdueAmount = overdueInvoices.reduce((a, inv) => a + (inv.balance_due ?? inv.balance_amount ?? 0), 0);
  const feeRealizationPct = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const displayName = user?.full_name || (
    user?.role === 'tenant_admin' ? 'Campus Admin' :
    user?.role === 'teacher' ? 'Faculty Member' :
    user?.role === 'student' ? 'Student' :
    user?.role === 'parent' ? 'Guardian' :
    user?.role === 'super_admin' ? 'Platform Admin' :
    'Campus Admin'
  );

  // Academic Donut calculation
  const colors = ['#081A2F', '#B88634', '#059669', '#0284C7', '#7C3AED'];
  const donutItems = programs.length > 0
    ? programs.map((p, idx) => {
        const stdCount = students.filter(s => {
          const b = batches.find(batch => batch.id === s.batch_id);
          return b?.program_id === p.id;
        }).length;
        const pct = activeStudents > 0 && stdCount > 0
          ? Math.round((stdCount / activeStudents) * 100)
          : 0;
        return {
          label: p.name,
          pct: pct,
          count: stdCount,
          color: colors[idx % colors.length],
        };
      })
    : [{ label: 'General Enrollment', pct: activeStudents > 0 ? 100 : 0, count: activeStudents, color: '#081A2F' }];

  if (isInitialLoading) {
    return (
      <div className="space-y-5 font-sans max-w-7xl mx-auto animate-pulse">
        <div className="bg-white border border-[#E6ECF2] rounded-2xl p-4 sm:p-5 shadow-2xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-200"></div>
            <div className="space-y-2">
              <div className="h-5 w-48 bg-slate-200 rounded-md"></div>
              <div className="h-3.5 w-32 bg-slate-100 rounded-md"></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-slate-100 rounded-xl"></div>
            <div className="h-8 w-24 bg-slate-200 rounded-xl"></div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[#081A2F] border border-[#173252] rounded-2xl p-4 h-36 flex flex-col justify-between shadow-[0_4px_16px_rgba(8,26,47,0.22)]">
              <div className="flex items-center justify-between">
                <div className="h-3 w-16 bg-white/20 rounded"></div>
                <div className="w-7 h-7 rounded-lg bg-white/10"></div>
              </div>
              <div className="space-y-2">
                <div className="h-6 w-20 bg-white/30 rounded"></div>
                <div className="h-3 w-28 bg-white/10 rounded"></div>
              </div>
              <div className="h-3 w-full bg-white/10 rounded"></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 bg-white border border-[#E6ECF2] rounded-2xl p-5 h-64">
            <div className="h-4 w-40 bg-slate-200 rounded mb-4"></div>
            <div className="h-44 bg-slate-100 rounded-xl"></div>
          </div>
          <div className="lg:col-span-4 bg-white border border-[#E6ECF2] rounded-2xl p-5 h-64">
            <div className="h-4 w-32 bg-slate-200 rounded mb-4"></div>
            <div className="h-44 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans max-w-7xl mx-auto">
      {/* ─── Institutional Header & Quick Actions Bar ─── */}
      <div className="bg-white border border-[#E6ECF2] rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 p-1 shrink-0 shadow-2xs flex items-center justify-center overflow-hidden">
            {!logoError && (tenant?.logo_url || (tenant as any)?.settings?.logo_url || '/tsa-logo.png') ? (
              <img
                src={tenant?.logo_url || (tenant as any)?.settings?.logo_url || '/tsa-logo.png'}
                alt={tenant?.name || 'Academy'}
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-full h-full rounded-lg bg-[#081A2F] text-amber-400 flex items-center justify-center font-bold text-lg font-mono">
                {(tenant?.name || 'A').charAt(0)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#081A2F] truncate">
                {tenant?.name || 'Apex Academy Lahore'}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200/80">
                Session {tenant?.academic_session || '2026–2027'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {tenant?.campus_name || 'Main Campus'} • {displayName}
            </p>
          </div>
        </div>

        {/* Date & Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-[#E6ECF2] rounded-xl text-xs font-semibold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-[#081A2F]" />
            <span className="font-mono text-[11px]">{formattedDate}</span>
          </div>

          <button
            type="button"
            onClick={loadData}
            title="Refresh Data"
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-[#E6ECF2] rounded-xl transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('new_admission')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Admission</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('voucher')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#081A2F] hover:bg-[#0E2A47] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Receive Fee</span>
          </button>
        </div>
      </div>

      {/* ─── 4 Executive Institutional KPI Cards (Sidebar Dark Navy Palette) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Active Enrollment */}
        <div
          onClick={() => onNavigate('enrollment')}
          className="bg-[#081A2F] border border-[#173252] hover:border-[#254B75] rounded-2xl p-4 shadow-[0_4px_16px_rgba(8,26,47,0.22)] transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">Students</span>
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">{activeStudents}</span>
              <span className="text-[11px] font-mono text-slate-400">/ {hasCapacity ? totalCapacity : '—'}</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              {hasCapacity ? (
                <>
                  <span className="font-mono font-semibold text-slate-200">{capacityPct}%</span> capacity occupied
                </>
              ) : (
                <span>—</span>
              )}
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#173252]">
            <span>{batches.length} Batches</span>
            <span className="text-amber-400 font-semibold hover:underline">Directory →</span>
          </div>
        </div>

        {/* Card 2: Fee Collections */}
        <div
          onClick={() => onNavigate('voucher')}
          className="bg-[#081A2F] border border-[#173252] hover:border-[#254B75] rounded-2xl p-4 shadow-[0_4px_16px_rgba(8,26,47,0.22)] transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">Collections</span>
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg sm:text-2xl font-bold font-mono text-white truncate">
                {money(totalCollected)}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 truncate">
              <span className="font-mono font-semibold text-slate-200">{feeRealizationPct}%</span> of {money(totalBilled)} billed
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#173252]">
            <span className={`font-mono ${overdueInvoices.length > 0 ? 'text-rose-400 font-semibold' : 'text-slate-400'}`}>{overdueInvoices.length} Overdue</span>
            <span className="text-amber-400 font-semibold hover:underline">Cashier →</span>
          </div>
        </div>

        {/* Card 3: Student Attendance Today */}
        <div
          onClick={() => onNavigate('attendance')}
          className="bg-[#081A2F] border border-[#173252] hover:border-[#254B75] rounded-2xl p-4 shadow-[0_4px_16px_rgba(8,26,47,0.22)] transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">Attendance</span>
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10 flex items-center justify-center">
              <CheckSquare className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">
                {isAttendanceSubmittedToday ? `${attendanceRate}%` : 'Pending'}
              </span>
              {isAttendanceSubmittedToday && (
                <span className="text-[11px] text-slate-200 font-semibold font-mono">
                  {presentCount} Present
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              {absentCount > 0 ? `${absentCount} Absent • ` : ''}{lateCount > 0 ? `${lateCount} Late • ` : ''}{markedBatchesCount}/{batches.length} Marked
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#173252]">
            <span>{unmarkedBatches.length > 0 ? `${unmarkedBatches.length} Pending` : 'All Batches Marked'}</span>
            <span className="text-amber-400 font-semibold hover:underline">Register →</span>
          </div>
        </div>

        {/* Card 4: Faculty & Staff Roster */}
        <div
          onClick={() => onNavigate('geofence')}
          className="bg-[#081A2F] border border-[#173252] hover:border-[#254B75] rounded-2xl p-4 shadow-[0_4px_16px_rgba(8,26,47,0.22)] transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">Staff present</span>
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10 flex items-center justify-center">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">
                {presentStaffCount} <span className="text-sm font-normal text-slate-400 font-sans">/ {totalStaffCount}</span>
              </span>
              <span className="text-[11px] text-slate-200 font-semibold font-mono">
                {staffPresentPct}% Duty
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 truncate">
              {lateStaffCount > 0 ? `${lateStaffCount} Late • ` : ''}{halfDayStaffCount > 0 ? `${halfDayStaffCount} Half Day • ` : ''}{leaveStaffCount > 0 ? `${leaveStaffCount} Leave • ` : ''}Active On Duty
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#173252]">
            <span>{timetableSlots.length} Periods Today</span>
            <span className="text-amber-400 font-semibold hover:underline">Roster →</span>
          </div>
        </div>
      </div>

      {/* ─── Operational Alerts (Attention Strips) ─── */}
      {(unmarkedBatches.length > 0 || overdueInvoices.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {unmarkedBatches.length > 0 && (
            <div
              onClick={() => onNavigate('attendance')}
              className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-amber-100/70 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-amber-900 font-medium truncate">
                  {unmarkedBatches.length === 1
                    ? `${unmarkedBatches[0].name} attendance has not been submitted yet.`
                    : `${unmarkedBatches.length} batches pending today's roll-call.`}
                </span>
              </div>
              <span className="font-semibold text-amber-800 shrink-0 hover:underline">
                Mark Roll Call →
              </span>
            </div>
          )}

          {overdueInvoices.length > 0 && (
            <div
              onClick={() => onNavigate('voucher')}
              className="p-3 bg-rose-50/80 border border-rose-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-rose-100/70 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CreditCard className="w-4 h-4 text-rose-700 shrink-0" />
                <span className="text-rose-900 font-medium truncate">
                  {overdueInvoices.length} fee challans overdue ({money(overdueAmount)}).
                </span>
              </div>
              <span className="font-semibold text-rose-800 shrink-0 hover:underline">
                Open Cashier →
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── Main Operations Split: 2-Column Responsive Matrix ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Daily Batch Register, Timetable Periods & Homework Diary */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Batches Register Table */}
          <div className="bg-white border border-[#E6ECF2] rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-[#081A2F]">
                  Daily Batches & Attendance Register
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Classroom occupancy and today's roll-call submission status
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('classes')}
                className="text-xs font-semibold text-[#081A2F] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>Batches</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* High-Density Batches List */}
            <div className="divide-y divide-slate-100">
              {batches.map(batch => {
                const enrolled = students.filter(s => s.batch_id === batch.id).length;
                const batchAttRecords = attendanceRecords.filter((r: any) => r.batch_id === batch.id);
                const isMarked = batchAttRecords.length > 0;
                const batchPresent = batchAttRecords.filter((r: any) => r.status === 'present').length;
                const batchRate = isMarked ? Math.round((batchPresent / batchAttRecords.length) * 100) : 0;

                return (
                  <div key={batch.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 truncate">{batch.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 capitalize">
                          {batch.shift || 'Morning'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {batch.room_number ? (batch.room_number.toLowerCase().includes('room') || batch.room_number.toLowerCase().includes('hall') || batch.room_number.toLowerCase().includes('lab') ? batch.room_number : `Room ${batch.room_number}`) : 'Room not set'} • Capacity: {enrolled}/{batch.max_capacity || 40}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {isMarked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Marked ({batchRate}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Pending Roll Call
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onNavigate('attendance')}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-[#B88634] hover:text-white text-slate-700 font-semibold text-[11px] border border-slate-200 transition-colors cursor-pointer"
                      >
                        {isMarked ? 'View' : 'Mark'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today's Timetable Schedule */}
          <div className="bg-white border border-[#E6ECF2] rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-[#081A2F]">
                  Today's Class Schedule & Periods
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Scheduled class timetable and assigned faculty roster
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('timetable')}
                className="text-xs font-semibold text-[#081A2F] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
              >
                <span>Full Timetable</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {timetableSlots.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {timetableSlots.map(slot => (
                  <div key={slot.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-amber-100/70 text-amber-900 border border-amber-200/60">
                          {slot.start_time} - {slot.end_time}
                        </span>
                        <span className="text-[10px] uppercase font-mono text-slate-400">{slot.day_of_week}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-xs">{slot.subject_name || 'Subject'}</h3>
                      <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                        {slot.teacher_name || 'Faculty Member'}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{slot.room_name || batches.find(b => b.id === slot.batch_id)?.room_number || 'Room not set'}</span>
                      <span className="truncate max-w-[120px] font-sans font-medium text-slate-600">{slot.batch_name || 'Batch'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">
                No timetable periods configured yet. <button onClick={() => onNavigate('timetable')} className="text-[#081A2F] font-semibold underline">Add slots in Timetables Desk</button>.
              </p>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Fee Clearance Queue, Staff Roster, Academic Donut, Inquiries */}
        <div className="lg:col-span-5 space-y-5">
          {/* Priority Fee Clearance Card */}
          <div className="bg-white border border-[#E6ECF2] rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-[#081A2F]">
                  Fee Clearance Queue
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Overdue invoices requiring cashier collection
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('challans')}
                className="text-xs font-semibold text-[#081A2F] hover:underline cursor-pointer"
              >
                Challans →
              </button>
            </div>

            {overdueInvoices.length > 0 ? (
              <div className="space-y-2">
                {overdueInvoices.slice(0, 3).map(inv => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 text-[11px]">
                          {inv.invoice_number || 'INV-2026-0001'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          {inv.status}
                        </span>
                      </div>
                      <p className="font-medium text-slate-700 truncate mt-0.5 text-xs">
                        {inv.student_name} • {inv.admission_number || 'A-101'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">Due: {inv.due_date || 'Sep 15, 2026'}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-sm text-rose-600">
                        {money(inv.balance_due ?? inv.balance_amount ?? 0)}
                      </p>
                      <button
                        type="button"
                        onClick={() => onNavigate('voucher')}
                        className="mt-1 px-2.5 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        Receive
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => onNavigate('voucher')}
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-[#FDF5E8] hover:bg-[#F6E3C0] text-[#B88634] font-semibold text-xs transition-colors text-center cursor-pointer shadow-2xs"
                >
                  Open Cashier Desk & Receive Fees
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">
                No overdue fee invoices for this billing cycle.
              </p>
            )}
          </div>

          {/* Staff today */}
          <div className="bg-white border border-[#E6ECF2] rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-[#081A2F]">
                  Staff today
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Today's clock-in status and attendance
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('geofence')}
                className="text-xs font-semibold text-[#081A2F] hover:underline cursor-pointer"
              >
                Staff attendance →
              </button>
            </div>

            {staffRoster.length > 0 ? (
              <div className="space-y-2">
                {staffRoster.slice(0, 4).map((staff, idx) => {
                  const sName = staff.staff_name || staff.full_name || 'Faculty Member';
                  const st = (staff.status || '').toLowerCase();
                  const isOnTime = st === 'on_time' || st === 'present';
                  const isLate = st === 'late';
                  const isHalfDay = st === 'half_day';
                  const isOnLeave = st === 'on_leave' || st === 'leave';
                  const isAbsent = st === 'absent';
                  const timeStr = formatCampusTime(staff.clock_in_time, tenant?.settings?.timezone || 'Asia/Karachi');

                  return (
                    <div key={staff.staff_id || staff.id || idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2.5 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#081A2F] text-amber-400 font-bold text-[11px] flex items-center justify-center shrink-0">
                          {sName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate text-xs">{sName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{staff.designation || staff.department || 'Academic Faculty'}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isOnTime && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {timeStr ? `${timeStr} • ` : ''}On Time
                          </span>
                        )}
                        {isLate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            {timeStr ? `${timeStr} • ` : ''}Late
                          </span>
                        )}
                        {isHalfDay && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-amber-50 text-amber-800 border border-amber-200">
                            {timeStr ? `${timeStr} • ` : ''}Half Day
                          </span>
                        )}
                        {isOnLeave && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            On Leave
                          </span>
                        )}
                        {isAbsent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-rose-50 text-rose-700 border border-rose-200">
                            Absent
                          </span>
                        )}
                        {!isOnTime && !isLate && !isHalfDay && !isOnLeave && !isAbsent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-slate-100 text-slate-500">
                            Not marked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">
                No staff attendance for today.
              </p>
            )}
          </div>

          {/* Academic Stream Distribution Donut */}
          <div className="bg-white border border-[#E6ECF2] rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-[#081A2F]">
                  Academic Programs & Streams
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Enrollment share across registered curriculums
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('enrollment')}
                className="text-xs font-semibold text-[#081A2F] hover:underline cursor-pointer"
              >
                Directory →
              </button>
            </div>

            <StreamDonut items={donutItems} total={activeStudents} />
          </div>

        </div>
      </div>

      {/* Executive Desks Summary Bar: Homework, Admissions Pipeline, and Examinations (Sidebar Dark Navy Palette) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Desk 1: Homework Diary */}
        <div
          onClick={() => onNavigate('homework')}
          className="bg-[#081A2F] border border-[#173252] hover:border-[#254B75] rounded-2xl p-4 shadow-[0_4px_16px_rgba(8,26,47,0.22)] transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">Academic Diary</span>
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">
                {todayHomework.length > 0 ? todayHomework.length : homeworkList.length}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {todayHomework.length > 0 ? 'Tasks Assigned Today' : 'Tasks in Diary'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 truncate">
              {snippetHomework ? (
                `${snippetHomework.title} (${snippetHomework.subject_name || 'Classwork'})`
              ) : (
                'All batches up to date'
              )}
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#173252]">
            <span>Diary & Notebooks</span>
            <span className="text-amber-400 font-semibold hover:underline">Open Desk →</span>
          </div>
        </div>

        {/* Desk 2: Prospective Inquiries */}
        <div
          onClick={() => onNavigate('enrollment')}
          className="bg-[#081A2F] border border-[#173252] hover:border-[#254B75] rounded-2xl p-4 shadow-[0_4px_16px_rgba(8,26,47,0.22)] transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">Admissions Pipeline</span>
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10 flex items-center justify-center">
              <PhoneCall className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">
                {inquiriesList.length}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Active Inquiries
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 truncate">
              {inquiriesList.filter(i => i.stage === 'new' || !i.stage).length > 0
                ? `${inquiriesList.filter(i => i.stage === 'new' || !i.stage).length} new leads pending review`
                : 'Follow-up pipeline clear'}
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#173252]">
            <span>Prospects & Inquiries</span>
            <span className="text-amber-400 font-semibold hover:underline">Review Pipeline →</span>
          </div>
        </div>

        {/* Desk 3: Examinations & Assessments */}
        <div
          onClick={() => onNavigate('exams')}
          className="bg-[#081A2F] border border-[#173252] hover:border-[#254B75] rounded-2xl p-4 shadow-[0_4px_16px_rgba(8,26,47,0.22)] transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">Examinations</span>
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">
                {exams.length}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Configured Papers
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 truncate">
              {exams.length > 0 ? (
                `${exams[0].title} • ${exams[0].status || 'Scheduled'}`
              ) : (
                'No papers currently scheduled'
              )}
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#173252]">
            <span>Assessment Results</span>
            <span className="text-amber-400 font-semibold hover:underline">Exams Desk →</span>
          </div>
        </div>
      </div>
    </div>
  );
};
