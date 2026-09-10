import React, { useState, useEffect } from 'react';
import {
  Users,
  CreditCard,
  CalendarCheck,
  GraduationCap,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Batch,
  AcademicProgram,
  Student,
  StudentInvoice,
  Exam,
  StaffSalaryProfile,
} from '@apex/shared-types';

interface DashboardViewProps {
  onNavigate: (screenId: string) => void;
}

function money(n: number) {
  return `PKR ${Math.round(n).toLocaleString('en-US')}`;
}

function formatDay(iso?: string) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(d)} ${months[Number(m) - 1] || m}`;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-slate-300 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={`w-9 h-9 rounded-xl ${tone} text-white flex items-center justify-center shrink-0`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </button>
  );
}

function AttendanceRing({
  present,
  late,
  absent,
  marked,
}: {
  present: number;
  late: number;
  absent: number;
  marked: number;
}) {
  const total = marked || 1;
  const p = (present / total) * 100;
  const l = (late / total) * 100;
  const a = (absent / total) * 100;
  const pct = marked > 0 ? Math.round((present / marked) * 100) : null;
  const gradient = marked
    ? `conic-gradient(#10b981 0 ${p}%, #f59e0b ${p}% ${p + l}%, #f43f5e ${p + l}% ${p + l + a}%, #e2e8f0 ${p + l + a}% 100%)`
    : 'conic-gradient(#e2e8f0 0 100%)';

  return (
    <div className="relative w-36 h-36 mx-auto">
      <div className="absolute inset-0 rounded-full" style={{ background: gradient }} />
      <div className="absolute inset-[18%] rounded-full bg-white flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-slate-900">
          {pct === null ? '—' : `${pct}%`}
        </span>
        <span className="text-[11px] text-slate-500">{marked ? 'present' : 'not marked'}</span>
      </div>
    </div>
  );
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { token, tenant } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [feeStats, setFeeStats] = useState({
    totalBilled: 0,
    totalCollected: 0,
    unpaidCount: 0,
    unpaidAmount: 0,
  });
  const [live, setLive] = useState({
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    markedToday: 0,
    pendingAbsentees: 0,
    openComplaints: 0,
    homeworkOpen: 0,
    staffIn: 0,
    inquiries: 0,
    pendingLeaves: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const today = new Date().toISOString().slice(0, 10);

    const load = async () => {
      setLoading(true);
      try {
        const [
          studRes,
          batchRes,
          progRes,
          feeRes,
          attRes,
          absRes,
          examRes,
          hwRes,
          staffRes,
          inqRes,
          cmpRes,
          payRes,
          leaveRes,
        ] = await Promise.all([
          fetch('/api/v1/sis/students', { headers }).catch(() => null),
          fetch('/api/v1/academic/batches', { headers }).catch(() => null),
          fetch('/api/v1/academic/programs', { headers }).catch(() => null),
          fetch('/api/v1/finance/invoices', { headers }).catch(() => null),
          fetch(`/api/v1/attendance/students?date=${today}`, { headers }).catch(() => null),
          fetch('/api/v1/absentee/kpi', { headers }).catch(() => null),
          fetch('/api/v1/exams', { headers }).catch(() => null),
          fetch('/api/v1/homework', { headers }).catch(() => null),
          fetch(`/api/v1/geofence/staff?date=${today}`, { headers }).catch(() => null),
          fetch('/api/v1/sis/inquiries', { headers }).catch(() => null),
          fetch('/api/v1/complaints', { headers }).catch(() => null),
          fetch('/api/v1/payroll/profiles', { headers }).catch(() => null),
          fetch('/api/v1/attendance/leaves', { headers }).catch(() => null),
        ]);

        const json = async (res: Response | null) => (res && res.ok ? (await res.json()).data : null);

        const stud = await json(studRes);
        const batch = await json(batchRes);
        const prog = await json(progRes);
        const fees = await json(feeRes);
        const att = await json(attRes);
        const absKpi = await json(absRes);
        const examList = await json(examRes);
        const homework = await json(hwRes);
        const staff = await json(staffRes);
        const inquiries = await json(inqRes);
        const complaints = await json(cmpRes);
        const payroll = await json(payRes);
        const leaves = await json(leaveRes);

        if (Array.isArray(stud)) setStudents(stud);
        if (Array.isArray(batch)) setBatches(batch);
        if (Array.isArray(prog)) setPrograms(prog);
        if (Array.isArray(examList)) setExams(examList);

        if (Array.isArray(payroll)) {
          const unique = new Set(
            (payroll as StaffSalaryProfile[]).map(p => p.staff_id).filter(Boolean),
          );
          setStaffCount(unique.size || payroll.length);
        }

        if (Array.isArray(fees)) {
          const list = fees as StudentInvoice[];
          setInvoices(list);
          const billed = list.reduce((a, inv) => a + (inv.net_total || inv.net_amount || 0), 0);
          const collected = list.reduce((a, inv) => a + (inv.paid_amount || 0), 0);
          const unpaid = list.filter(inv => (inv.balance_due ?? inv.balance_amount ?? 0) > 0);
          setFeeStats({
            totalBilled: billed,
            totalCollected: collected,
            unpaidCount: unpaid.length,
            unpaidAmount: unpaid.reduce((a, inv) => a + (inv.balance_due ?? inv.balance_amount ?? 0), 0),
          });
        }

        const attRows = Array.isArray(att) ? att : [];
        const hwList = Array.isArray(homework) ? homework : [];
        const staffList = Array.isArray(staff) ? staff : [];
        const inqList = Array.isArray(inquiries) ? inquiries : [];
        const cmpList = Array.isArray(complaints) ? complaints : [];

        setLive({
          presentToday: attRows.filter((r: { status?: string }) => r.status === 'present').length,
          absentToday: attRows.filter((r: { status?: string }) => r.status === 'absent').length,
          lateToday: attRows.filter((r: { status?: string }) => r.status === 'late').length,
          markedToday: attRows.length,
          pendingAbsentees: Number(absKpi?.pending_count || absKpi?.pending || 0),
          openComplaints: cmpList.filter((c: { status?: string }) => c.status !== 'resolved' && c.status !== 'closed').length,
          homeworkOpen: hwList.length,
          staffIn: staffList.filter((s: { status?: string; check_in_at?: string; clock_in?: string; clock_in_time?: string }) =>
            s.status === 'in' || s.status === 'on_time' || s.status === 'late' || s.check_in_at || s.clock_in || s.clock_in_time,
          ).length,
          inquiries: inqList.length,
          pendingLeaves: (Array.isArray(leaves) ? leaves : []).filter((l: { status?: string }) => l.status === 'pending' || l.status === 'submitted').length,
        });
      } catch (err) {
        console.error('Dashboard load failed', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const activeStudents = students.filter(s => s.status === 'active').length;
  const waitlisted = students.filter(s => s.status === 'waitlisted').length;
  const attendancePct = live.markedToday > 0 ? Math.round((live.presentToday / live.markedToday) * 100) : null;
  const collectedPct = feeStats.totalBilled > 0
    ? Math.round((feeStats.totalCollected / feeStats.totalBilled) * 100)
    : 0;
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const todayIso = new Date().toISOString().slice(0, 10);
  const n = (v: number) => (loading ? '—' : v);

  const classRows = batches
    .map(batch => {
      const prog = programs.find(p => p.id === batch.program_id);
      const count = students.filter(s => s.batch_id === batch.id).length;
      return { batch, prog, count };
    })
    .sort((a, b) => b.count - a.count);
  const maxClass = Math.max(1, ...classRows.map(r => r.count));

  const unpaidInvoices = invoices
    .filter(inv => (inv.balance_due ?? inv.balance_amount ?? 0) > 0)
    .sort((a, b) => (b.balance_due ?? b.balance_amount ?? 0) - (a.balance_due ?? a.balance_amount ?? 0))
    .slice(0, 6);

  const upcomingExams = exams
    .filter(e => String(e.exam_date || '') >= todayIso)
    .sort((a, b) => String(a.exam_date).localeCompare(String(b.exam_date)))
    .slice(0, 5);

  const followUps = [
    live.absentToday > 0 && {
      label: `${live.absentToday} absent today`,
      go: 'attendance',
    },
    live.pendingAbsentees > 0 && {
      label: `${live.pendingAbsentees} absence follow-up${live.pendingAbsentees === 1 ? '' : 's'}`,
      go: 'absentee',
    },
    live.inquiries > 0 && {
      label: `${live.inquiries} admission inquir${live.inquiries === 1 ? 'y' : 'ies'}`,
      go: 'enrollment',
    },
    live.openComplaints > 0 && {
      label: `${live.openComplaints} open complaint${live.openComplaints === 1 ? '' : 's'}`,
      go: 'complaints',
    },
    live.homeworkOpen > 0 && {
      label: `${live.homeworkOpen} homework set`,
      go: 'homework',
    },
    live.pendingLeaves > 0 && {
      label: `${live.pendingLeaves} leave request${live.pendingLeaves === 1 ? '' : 's'}`,
      go: 'attendance',
    },
  ].filter(Boolean) as { label: string; go: string }[];

  const recentAdmissions = [...students]
    .sort((a, b) => String(b.admission_date || b.created_at).localeCompare(String(a.admission_date || a.created_at)))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {todayLabel}
            {tenant?.academic_session ? ` · ${tenant.academic_session}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Students"
          value={n(activeStudents)}
          hint={waitlisted ? `${waitlisted} waitlisted · ${students.length} on roll` : `${students.length} on roll`}
          icon={Users}
          tone="bg-indigo-600"
          onClick={() => onNavigate('enrollment')}
        />
        <StatCard
          label="Staff"
          value={n(staffCount)}
          hint={
            staffCount === 0
              ? 'Add staff in payroll'
              : live.staffIn
                ? `${live.staffIn} in today`
                : 'No clock-ins yet'
          }
          icon={GraduationCap}
          tone="bg-violet-600"
          onClick={() => onNavigate('geofence')}
        />
        <StatCard
          label="Attendance"
          value={loading ? '—' : attendancePct === null ? '—' : `${attendancePct}%`}
          hint={live.markedToday ? `${live.presentToday} present · ${live.absentToday} absent` : 'Not marked yet'}
          icon={CalendarCheck}
          tone="bg-emerald-600"
          onClick={() => onNavigate('attendance')}
        />
        <StatCard
          label="Fees due"
          value={loading ? '—' : money(feeStats.unpaidAmount)}
          hint={feeStats.unpaidCount ? `${feeStats.unpaidCount} unpaid challans` : 'All challans paid'}
          icon={CreditCard}
          tone="bg-amber-500"
          onClick={() => onNavigate('voucher')}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Inquiries', value: n(live.inquiries), go: 'enrollment' },
          { label: 'Batches', value: n(batches.length), go: 'classes' },
          { label: 'Homework', value: n(live.homeworkOpen), go: 'homework' },
          { label: 'Complaints', value: n(live.openComplaints), go: 'complaints' },
        ].map(item => (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate(item.go)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-left hover:border-slate-300"
          >
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{item.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Today’s attendance</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {live.markedToday ? `${live.markedToday} students marked` : 'No register saved today'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('attendance')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              Open
            </button>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-6">
            <AttendanceRing
              present={live.presentToday}
              late={live.lateToday}
              absent={live.absentToday}
              marked={live.markedToday}
            />
            <div className="flex-1 space-y-3 w-full">
              {[
                { label: 'Present', value: live.presentToday, color: 'bg-emerald-500' },
                { label: 'Late', value: live.lateToday, color: 'bg-amber-400' },
                { label: 'Absent', value: live.absentToday, color: 'bg-rose-500' },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3 text-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${row.color}`} />
                  <span className="flex-1 text-slate-600">{row.label}</span>
                  <span className="tabular-nums font-medium text-slate-900">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Fee collection</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {feeStats.totalBilled ? `${collectedPct}% of billed amount` : 'No invoices yet'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('voucher')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              Open
            </button>
          </div>

          <div className="mt-4">
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min(100, collectedPct)}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Collected</p>
                <p className="font-semibold tabular-nums text-slate-900">{loading ? '—' : money(feeStats.totalCollected)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Outstanding</p>
                <p className="font-semibold tabular-nums text-slate-900">{loading ? '—' : money(feeStats.unpaidAmount)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-500 mb-2">Unpaid challans</p>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : unpaidInvoices.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing outstanding.</p>
            ) : (
              <ul className="space-y-2">
                {unpaidInvoices.map(inv => (
                  <li key={inv.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate('voucher')}
                      className="w-full flex items-center gap-3 text-left text-sm"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium text-slate-900">
                          {inv.student_name || inv.invoice_number}
                        </span>
                        <span className="block text-xs text-slate-500 truncate">
                          {inv.batch_name || inv.invoice_number}
                        </span>
                      </span>
                      <span className="tabular-nums text-slate-900 shrink-0">
                        {money(inv.balance_due ?? inv.balance_amount ?? 0)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Class strength</h2>
              <p className="text-xs text-slate-500">
                {programs.length} programmes · {batches.length} batches
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('classes')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              Open
            </button>
          </div>
          {classRows.length === 0 ? (
            <div className="px-5 py-10 text-sm text-slate-500">
              No classes yet. Add a programme and a batch to start admissions.
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {classRows.slice(0, 8).map(({ batch, prog, count }) => (
                <li key={batch.id} className="px-5 py-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-40 sm:w-52 truncate font-medium text-slate-900">{batch.name}</span>
                    <span className="hidden sm:block flex-1 min-w-0">
                      <span className="block h-2 rounded-full bg-slate-100 overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-indigo-500"
                          style={{ width: `${Math.round((count / maxClass) * 100)}%` }}
                        />
                      </span>
                    </span>
                    <span className="text-xs text-slate-500 truncate hidden md:block w-32">
                      {prog?.name || '—'}
                    </span>
                    <span className="tabular-nums text-slate-900 w-8 text-right">{count}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-900">Coming up</h2>
          {loading ? (
            <p className="text-sm text-slate-400 mt-4">Loading…</p>
          ) : (
            <div className="mt-3 space-y-4">
              {upcomingExams.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Exams</p>
                  <ul className="space-y-2">
                    {upcomingExams.map(exam => (
                      <li key={exam.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate('exams')}
                          className="w-full flex items-start justify-between gap-3 text-left text-sm"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">{exam.title}</span>
                            <span className="block text-xs text-slate-500 truncate">
                              {[exam.subject_name, exam.batch_name].filter(Boolean).join(' · ') || 'Exam'}
                            </span>
                          </span>
                          <span className="text-xs text-slate-500 shrink-0 tabular-nums">
                            {formatDay(exam.exam_date)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {followUps.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Needs a look</p>
                  <ul className="divide-y divide-slate-100">
                    {followUps.map(item => (
                      <li key={item.label}>
                        <button
                          type="button"
                          onClick={() => onNavigate(item.go)}
                          className="w-full flex items-center justify-between py-2.5 text-sm text-slate-800 hover:text-slate-950"
                        >
                          {item.label}
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {recentAdmissions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Recent admissions</p>
                  <ul className="space-y-2">
                    {recentAdmissions.map(s => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate('enrollment')}
                          className="w-full flex items-center justify-between gap-3 text-left text-sm"
                        >
                          <span className="truncate font-medium text-slate-900">{s.full_name}</span>
                          <span className="text-xs text-slate-500 shrink-0">{s.admission_number}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {upcomingExams.length === 0 && followUps.length === 0 && recentAdmissions.length === 0 && (
                <p className="text-sm text-slate-500 mt-2">
                  Nothing waiting. Attendance, fees, and exams are clear.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
