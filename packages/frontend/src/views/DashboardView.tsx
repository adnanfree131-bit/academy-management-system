import React, { useState, useEffect } from 'react';
import { Users, CreditCard, CalendarCheck, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Batch, AcademicProgram, Student } from '@apex/shared-types';

interface DashboardViewProps {
  onNavigate: (screenId: string) => void;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { token, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
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
    examsUpcoming: 0,
    staffIn: 0,
    inquiries: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const today = new Date().toISOString().slice(0, 10);

    const load = async () => {
      setLoading(true);
      try {
        const [studRes, batchRes, progRes, feeRes, attRes, absRes, examRes, hwRes, staffRes, inqRes, cmpRes] = await Promise.all([
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
        ]);

        const json = async (res: Response | null) => (res && res.ok ? (await res.json()).data : null);

        const stud = await json(studRes);
        const batch = await json(batchRes);
        const prog = await json(progRes);
        const fees = await json(feeRes);
        const att = await json(attRes);
        const absKpi = await json(absRes);
        const exams = await json(examRes);
        const homework = await json(hwRes);
        const staff = await json(staffRes);
        const inquiries = await json(inqRes);
        const complaints = await json(cmpRes);

        if (Array.isArray(stud)) setStudents(stud);
        if (Array.isArray(batch)) setBatches(batch);
        if (Array.isArray(prog)) setPrograms(prog);

        if (Array.isArray(fees)) {
          const billed = fees.reduce((a: number, inv: any) => a + (inv.net_total || inv.net_amount || 0), 0);
          const collected = fees.reduce((a: number, inv: any) => a + (inv.paid_amount || 0), 0);
          const unpaid = fees.filter((inv: any) => (inv.balance_due ?? inv.balance_amount ?? 0) > 0);
          setFeeStats({
            totalBilled: billed,
            totalCollected: collected,
            unpaidCount: unpaid.length,
            unpaidAmount: unpaid.reduce((a: number, inv: any) => a + (inv.balance_due ?? inv.balance_amount ?? 0), 0),
          });
        }

        const attRows = Array.isArray(att) ? att : [];
        const examList = Array.isArray(exams) ? exams : [];
        const hwList = Array.isArray(homework) ? homework : [];
        const staffList = Array.isArray(staff) ? staff : [];
        const inqList = Array.isArray(inquiries) ? inquiries : [];
        const cmpList = Array.isArray(complaints) ? complaints : [];

        setLive({
          presentToday: attRows.filter((r: any) => r.status === 'present').length,
          absentToday: attRows.filter((r: any) => r.status === 'absent').length,
          lateToday: attRows.filter((r: any) => r.status === 'late').length,
          markedToday: attRows.length,
          pendingAbsentees: Number(absKpi?.pending_count || absKpi?.pending || 0),
          openComplaints: cmpList.filter((c: any) => c.status !== 'resolved' && c.status !== 'closed').length,
          homeworkOpen: hwList.length,
          examsUpcoming: examList.filter((e: any) => String(e.exam_date || '') >= today).length,
          staffIn: staffList.filter((s: any) => s.status === 'in' || s.check_in_at || s.clock_in).length,
          inquiries: inqList.length,
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
  const attendancePct = live.markedToday > 0 ? Math.round((live.presentToday / live.markedToday) * 100) : null;
  const firstName = (user?.full_name || 'there').split(' ')[0];
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const attention = [
    live.absentToday > 0 && { label: `${live.absentToday} student${live.absentToday === 1 ? '' : 's'} absent today`, go: 'attendance' },
    live.pendingAbsentees > 0 && { label: `${live.pendingAbsentees} absence follow-up${live.pendingAbsentees === 1 ? '' : 's'} waiting`, go: 'absentee' },
    feeStats.unpaidCount > 0 && { label: `${feeStats.unpaidCount} unpaid challan${feeStats.unpaidCount === 1 ? '' : 's'} · PKR ${feeStats.unpaidAmount.toLocaleString()}`, go: 'voucher' },
    live.inquiries > 0 && { label: `${live.inquiries} admission inquir${live.inquiries === 1 ? 'y' : 'ies'}`, go: 'enrollment' },
    live.openComplaints > 0 && { label: `${live.openComplaints} open complaint${live.openComplaints === 1 ? '' : 's'}`, go: 'complaints' },
    live.examsUpcoming > 0 && { label: `${live.examsUpcoming} exam${live.examsUpcoming === 1 ? '' : 's'} coming up`, go: 'exams' },
  ].filter(Boolean) as { label: string; go: string }[];

  const n = (v: number) => (loading ? '—' : v);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <p className="text-sm text-slate-500">{todayLabel}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Hello, {firstName}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Students"
          value={n(activeStudents)}
          hint={`${students.length} on roll`}
          icon={Users}
        />
        <StatCard
          label="Attendance today"
          value={loading ? '—' : attendancePct === null ? '—' : `${attendancePct}%`}
          hint={live.markedToday ? `${live.presentToday} present · ${live.absentToday} absent` : 'Not marked yet'}
          icon={CalendarCheck}
        />
        <StatCard
          label="Fees collected"
          value={loading ? '—' : `PKR ${feeStats.totalCollected.toLocaleString()}`}
          hint={`${feeStats.unpaidCount} challans still unpaid`}
          icon={CreditCard}
        />
        <StatCard
          label="Outstanding"
          value={loading ? '—' : `PKR ${feeStats.unpaidAmount.toLocaleString()}`}
          hint={feeStats.totalBilled ? `of PKR ${feeStats.totalBilled.toLocaleString()} billed` : 'No invoices yet'}
          icon={Wallet}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-900">Today’s attendance</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {live.markedToday ? `${live.markedToday} students marked` : 'No register saved today'}
          </p>
          <div className="mt-5 space-y-4">
            <BarRow label="Present" value={live.presentToday} total={live.markedToday || 1} color="bg-emerald-500" />
            <BarRow label="Late" value={live.lateToday} total={live.markedToday || 1} color="bg-amber-400" />
            <BarRow label="Absent" value={live.absentToday} total={live.markedToday || 1} color="bg-rose-500" />
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
          {loading ? (
            <p className="text-sm text-slate-400 mt-4">Loading…</p>
          ) : attention.length === 0 ? (
            <p className="text-sm text-slate-500 mt-4">Nothing waiting. Attendance, fees, and follow-ups are clear.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {attention.map(item => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.go)}
                    className="w-full text-left py-3 text-sm text-slate-800 hover:text-slate-950"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Classes</h2>
            <p className="text-sm text-slate-500">{programs.length} programmes · {batches.length} batches</p>
          </div>
          <button type="button" onClick={() => onNavigate('classes')} className="text-sm font-medium text-slate-700 hover:text-slate-950">
            Open
          </button>
        </div>
        {batches.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-500">
            No classes yet. Add a programme and a batch to start admissions and attendance.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="px-5 py-2.5 font-medium">Batch</th>
                <th className="px-5 py-2.5 font-medium">Programme</th>
                <th className="px-5 py-2.5 font-medium">Shift</th>
                <th className="px-5 py-2.5 font-medium text-right">Students</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(batch => {
                const prog = programs.find(p => p.id === batch.program_id);
                const count = students.filter(s => s.batch_id === batch.id).length;
                return (
                  <tr key={batch.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-900">{batch.name}</td>
                    <td className="px-5 py-3 text-slate-600">{prog?.name || '—'}</td>
                    <td className="px-5 py-3 text-slate-600 capitalize">{batch.shift || '—'}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-900">{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
