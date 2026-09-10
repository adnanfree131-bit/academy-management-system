import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CheckCircle2, 
  CreditCard, 
  Clock, 
  Building2,
  BookOpen,
  ArrowRight,
  PlusCircle,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AcademyLogo } from '../components/AcademyLogo';
import { Batch, AcademicProgram, Student } from '@apex/shared-types';

interface DashboardViewProps {
  onNavigate: (screenId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { token, tenant } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [feeStats, setFeeStats] = useState({
    totalBilled: 0,
    totalCollected: 0,
    recoveryRate: 0,
    unpaidCount: 0,
    unpaidAmount: 0,
  });
  const [live, setLive] = useState({
    presentToday: 0,
    absentToday: 0,
    markedToday: 0,
    pendingAbsentees: 0,
    openComplaints: 0,
    homeworkOpen: 0,
    examsUpcoming: 0,
    staffIn: 0,
    inquiries: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!token) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const today = new Date().toISOString().slice(0, 10);

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

        if (studRes && studRes.ok) {
          const body = await studRes.json();
          if (body.data) setStudents(body.data);
        }
        if (batchRes && batchRes.ok) {
          const body = await batchRes.json();
          if (body.data) setBatches(body.data);
        }
        if (progRes && progRes.ok) {
          const body = await progRes.json();
          if (body.data) setPrograms(body.data);
        }
        if (feeRes && feeRes.ok) {
          const body = await feeRes.json();
          if (body.data && Array.isArray(body.data)) {
            const billed = body.data.reduce((acc: number, inv: any) => acc + (inv.net_total || inv.net_amount || 0), 0);
            const collected = body.data.reduce((acc: number, inv: any) => acc + (inv.paid_amount || 0), 0);
            const unpaid = body.data.filter((inv: any) => (inv.balance_due ?? inv.balance_amount ?? 0) > 0);
            const unpaidAmount = unpaid.reduce((acc: number, inv: any) => acc + (inv.balance_due ?? inv.balance_amount ?? 0), 0);
            const rate = billed > 0 ? Math.round((collected / billed) * 100) : 0;
            setFeeStats({
              totalBilled: billed,
              totalCollected: collected,
              recoveryRate: rate,
              unpaidCount: unpaid.length,
              unpaidAmount,
            });
          }
        }

        const att = attRes && attRes.ok ? (await attRes.json()).data : [];
        const attRows = Array.isArray(att) ? att : [];
        const presentToday = attRows.filter((r: any) => r.status === 'present' || r.status === 'late').length;
        const absentToday = attRows.filter((r: any) => r.status === 'absent').length;

        const absKpi = absRes && absRes.ok ? (await absRes.json()).data || {} : {};
        const exams = examRes && examRes.ok ? (await examRes.json()).data || [] : [];
        const homework = hwRes && hwRes.ok ? (await hwRes.json()).data || [] : [];
        const staff = staffRes && staffRes.ok ? (await staffRes.json()).data || [] : [];
        const inquiries = inqRes && inqRes.ok ? (await inqRes.json()).data || [] : [];
        const complaints = cmpRes && cmpRes.ok ? (await cmpRes.json()).data || [] : [];
        const examList = Array.isArray(exams) ? exams : [];
        const hwList = Array.isArray(homework) ? homework : [];
        const staffList = Array.isArray(staff) ? staff : [];
        const inqList = Array.isArray(inquiries) ? inquiries : [];
        const cmpList = Array.isArray(complaints) ? complaints : [];

        setLive({
          presentToday,
          absentToday,
          markedToday: attRows.length,
          pendingAbsentees: Number(absKpi.pending_count || absKpi.pending || 0),
          openComplaints: cmpList.filter((c: any) => c.status !== 'resolved' && c.status !== 'closed').length,
          homeworkOpen: hwList.filter((h: any) => h.status !== 'closed' && h.status !== 'archived').length || hwList.length,
          examsUpcoming: examList.filter((e: any) => String(e.exam_date || '') >= today).length,
          staffIn: staffList.filter((s: any) => s.status === 'in' || s.check_in_at || s.clock_in).length,
          inquiries: inqList.filter((i: any) => i.status === 'open' || i.status === 'new' || !i.status).length || inqList.length,
        });
      } catch (err) {
        console.error('Error fetching dashboard statistics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [token]);

  const activeStudentsCount = students.filter(s => s.status === 'active').length;
  const academyName = tenant?.name || 'Academy Management System';
  const campusBranch = tenant?.campus_name || 'Main Campus';
  const sessionName = tenant?.academic_session || '2026–2027';

  const setupSteps = [
    { id: 'settings', label: 'Academy settings & logo', done: Boolean(tenant?.logo_url || tenant?.name) },
    { id: 'classes', label: 'Create a class / program', done: programs.length > 0 },
    { id: 'classes', label: 'Create a batch', done: batches.length > 0 },
    { id: 'enrollment', label: 'Admit first student', done: students.length > 0 },
  ];
  const setupIncomplete = setupSteps.some(s => !s.done);

  return (
    <div className="space-y-6 font-sans">
      {setupIncomplete && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-2">Finish academy setup</h2>
          <p className="text-xs text-slate-500 mb-3">Complete these in order so admissions, attendance, and fees have something to attach to.</p>
          <ol className="grid sm:grid-cols-2 gap-2">
            {setupSteps.map((step, i) => (
              <li key={step.label}>
                <button
                  type="button"
                  onClick={() => onNavigate(step.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold ${
                    step.done ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-400'
                  }`}
                >
                  {i + 1}. {step.label} {step.done ? '— done' : ''}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      
      {/* Academy Header Strip */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <AcademyLogo src={tenant?.logo_url} name={academyName} size={44} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{academyName}</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {campusBranch} • Academic Session {sessionName}
            </p>
          </div>
        </div>

        {/* Quick Operations Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => onNavigate('enrollment')}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Admit Student</span>
          </button>
          <button 
            onClick={() => onNavigate('attendance')}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Attendance</span>
          </button>
          <button 
            onClick={() => onNavigate('voucher')}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-slate-500" />
            <span>Fee Challans</span>
          </button>
        </div>
      </div>

      {/* 4 Standard Metric Cards (Real Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Active Students */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Active Students</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {loading ? '—' : activeStudentsCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {students.length} total enrolled
          </p>
        </div>

        {/* Classes & Batches */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Active Batches</span>
            <BookOpen className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {loading ? '—' : batches.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Across {programs.length} academic program{programs.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Academic Programs */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Programs / Classes</span>
            <GraduationCap className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {loading ? '—' : programs.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Curriculum streams defined
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Fee Recovery</span>
            <CreditCard className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {loading ? '—' : `${feeStats.recoveryRate}%`}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            PKR {feeStats.totalCollected.toLocaleString()} collected
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Present today</p>
          <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{loading ? '—' : live.presentToday}</p>
          <p className="text-[11px] text-slate-500 mt-1">{live.absentToday} absent · {live.markedToday} marked</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Unpaid challans</p>
          <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{loading ? '—' : feeStats.unpaidCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">PKR {feeStats.unpaidAmount.toLocaleString()} still due</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Absence follow-up</p>
          <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{loading ? '—' : live.pendingAbsentees}</p>
          <p className="text-[11px] text-slate-500 mt-1">Open parent follow-ups</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Upcoming exams</p>
          <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{loading ? '—' : live.examsUpcoming}</p>
          <p className="text-[11px] text-slate-500 mt-1">Dated today or later</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Homework</p>
          <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{loading ? '—' : live.homeworkOpen}</p>
          <p className="text-[11px] text-slate-500 mt-1">Open assignments</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Staff on campus</p>
          <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{loading ? '—' : live.staffIn}</p>
          <p className="text-[11px] text-slate-500 mt-1">Clocked in today</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Open complaints</p>
          <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{loading ? '—' : live.openComplaints}</p>
          <p className="text-[11px] text-slate-500 mt-1">Not yet closed</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Admissions inquiries</p>
          <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{loading ? '—' : live.inquiries}</p>
          <p className="text-[11px] text-slate-500 mt-1">Waiting in the queue</p>
        </div>

      </div>

      {/* Main Grid: Batches Roster vs Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Active Batches / Setup Overview */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <span>Academic Classes & Batches</span>
            </h2>
            <button
              onClick={() => onNavigate('classes')}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 cursor-pointer"
            >
              Manage Academic Structure <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading academic records...
            </div>
          ) : batches.length === 0 ? (
            <div className="py-8 px-4 text-center bg-slate-50 border border-slate-200/80 rounded-lg space-y-3">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto stroke-1" />
              <div>
                <p className="text-xs font-semibold text-slate-800">No Academic Batches Configured</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Begin setup by defining your first academic program (e.g. Class 9, Class 10, Matric, F.Sc) and creating batch sections.
                </p>
              </div>
              <button
                onClick={() => onNavigate('classes')}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Configure Academic Structure</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {batches.map((batch) => {
                const batchStudents = students.filter(s => s.batch_id === batch.id);
                const prog = programs.find(p => p.id === batch.program_id);
                return (
                  <div 
                    key={batch.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{batch.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 capitalize">
                          {batch.shift}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Program: {prog?.name || 'Core Stream'} • Room: {batch.room_number || 'Room 1'} • Capacity: {batch.max_capacity}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-slate-900">{batchStudents.length}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">Students</span>
                      </div>
                      <button
                        onClick={() => onNavigate('attendance')}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                      >
                        Attendance
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick-Start Checklist / Operations Guide */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Today at a glance
          </h2>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
              <p className="font-semibold text-slate-900">Attendance</p>
              <p className="text-slate-600 mt-1">{live.presentToday} present · {live.absentToday} absent · {live.markedToday} marked</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
              <p className="font-semibold text-slate-900">Fees</p>
              <p className="text-slate-600 mt-1">{feeStats.unpaidCount} unpaid challans · PKR {feeStats.unpaidAmount.toLocaleString()} due</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
              <p className="font-semibold text-slate-900">Follow-up</p>
              <p className="text-slate-600 mt-1">{live.pendingAbsentees} absence calls · {live.openComplaints} complaints · {live.inquiries} inquiries</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
              <p className="font-semibold text-slate-900">Teaching</p>
              <p className="text-slate-600 mt-1">{live.examsUpcoming} exams ahead · {live.homeworkOpen} homework · {live.staffIn} staff in</p>
            </div>
          </div>
          <div className="hidden">
            <div 
              onClick={() => onNavigate('classes')}
              className="p-3 rounded-lg border border-slate-200/80 hover:border-slate-400 hover:bg-slate-50/50 transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>1. Academic Programs & Batches</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Define classes, subjects, elective tracks, shifts, and batch capacity limits.
              </p>
            </div>

            <div 
              onClick={() => onNavigate('enrollment')}
              className="p-3 rounded-lg border border-slate-200/80 hover:border-slate-400 hover:bg-slate-50/50 transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>2. Student Admissions</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Admit candidates, generate official roll numbers, and print student ID cards.
              </p>
            </div>

            <div 
              onClick={() => onNavigate('voucher')}
              className="p-3 rounded-lg border border-slate-200/80 hover:border-slate-400 hover:bg-slate-50/50 transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>3. Fee Invoicing & Challans</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Issue 3-part bank challans, record counter payments, and track fee ledgers.
              </p>
            </div>

            <div 
              onClick={() => onNavigate('attendance')}
              className="p-3 rounded-lg border border-slate-200/80 hover:border-slate-400 hover:bg-slate-50/50 transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>4. Attendance</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Mark the daily register and handle leave requests.
              </p>
            </div>
            <div 
              onClick={() => onNavigate('exams')}
              className="p-3 rounded-lg border border-slate-200/80 hover:border-slate-400 hover:bg-slate-50/50 transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>5. Exams</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Enter marks and download report cards.
              </p>
            </div>
            <div 
              onClick={() => onNavigate('id_cards')}
              className="p-3 rounded-lg border border-slate-200/80 hover:border-slate-400 hover:bg-slate-50/50 transition-all cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>6. ID cards</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Print student identity cards.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
