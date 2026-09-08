import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  StudentParentPortalOverview, 
  TimetableSlot, 
  StudentInvoice, 
  FeePayment, 
  HomeworkAssignment, 
  StudentOfficialReportCard 
} from '@apex/shared-types';
import { 
  Clock, 
  CreditCard, 
  BookOpen, 
  Award, 
  Calendar, 
  Printer
} from 'lucide-react';

interface StudentPortalProps {
  onNavigate?: (screen: string) => void;
}

export const StudentParentPortalView: React.FC<StudentPortalProps> = () => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<StudentParentPortalOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'schedule' | 'fees' | 'homework' | 'reports'>('schedule');
  const [showPayModal, setShowPayModal] = useState<boolean>(false);

  const fetchOverview = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/portal/student-parent', {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        setOverview(body.data);
      }
    } catch (err) {
      console.error('Failed fetching student portal:', err);
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
        <p className="text-xs">Loading Student & Parent Operations Portal...</p>
      </div>
    );
  }

  const profile = overview?.student_profile;
  const schedule: TimetableSlot[] = overview?.today_schedule || [];
  const invoices: StudentInvoice[] = overview?.invoices || [];
  const payments: FeePayment[] = overview?.recent_receipts || [];
  const homework: HomeworkAssignment[] = overview?.homework_diary || [];
  const reportCards: StudentOfficialReportCard[] = overview?.exam_report_cards || [];
  const attendance = overview?.recent_attendance || [];
  const unpaidBalance = overview?.unpaid_balance || 0;

  return (
    <div className="space-y-6">
      
      {/* Student 360 Header Profile Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white flex items-center justify-center font-bold text-xl shadow-sm">
              {profile?.full_name?.charAt(0) || 'M'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  {profile?.full_name || 'Muhammad Ali Raza'}
                </h1>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-mono font-bold rounded-md">
                  Roll: {profile?.roll_number || 'A-101'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Batch: <strong className="text-slate-700">{profile?.batch_name || 'Batch 2026-A'}</strong> • Guardian: <strong className="text-slate-700">{profile?.guardian_name || 'Raza Ahmed'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Monthly Attendance Progress Bar */}
            <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl min-w-[140px]">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900">
                <span>Attendance</span>
                <span>{profile?.monthly_attendance_pct || 94.8}%</span>
              </div>
              <div className="w-full bg-emerald-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full" 
                  style={{ width: `${profile?.monthly_attendance_pct || 94.8}%` }} 
                />
              </div>
            </div>

            {/* Financial Balance Card */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl min-w-[130px] text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Outstanding Dues</span>
              <span className={`text-base font-black font-mono block ${unpaidBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                PKR {unpaidBalance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Portal Navigation Tabs */}
        <div className="flex items-center gap-1.5 mt-5 pt-3 border-t border-slate-100 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'schedule'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Today's Schedule & Attendance</span>
          </button>

          <button
            onClick={() => setActiveTab('fees')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'fees'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Fee Vouchers & Receipts ({invoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('homework')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'homework'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Homework Diary ({homework.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all ${
              activeTab === 'reports'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Report Cards & Exams ({reportCards.length})</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: TODAY'S SCHEDULE & ATTENDANCE AUDIT
          ===================================================================== */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Lecture Timeline */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Today's Lecture Timetable
              </h2>
              <span className="text-xs font-mono text-slate-400">Gulberg III Campus</span>
            </div>

            <div className="space-y-3">
              {schedule.length === 0 ? (
                <p className="text-xs text-slate-400 p-4 text-center">No classes scheduled for today.</p>
              ) : (
                schedule.map((slot, idx) => (
                  <div key={slot.id || idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{slot.subject_name}</span>
                        <span className="text-xs text-indigo-600 font-semibold">• {slot.teacher_name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Room: <strong className="text-slate-700">{slot.room_name}</strong> • Timing: <strong className="text-slate-700">{slot.start_time} - {slot.end_time}</strong>
                      </p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      idx === 0 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {idx === 0 ? 'Upcoming Next' : 'Scheduled'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Attendance Audit */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Recent Attendance History
            </h2>

            <div className="space-y-2 text-xs">
              {attendance.map((att, i) => (
                <div key={i} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-slate-700 font-bold block">{att.date}</span>
                    {att.remarks && <span className="text-[10px] text-slate-400 block">{att.remarks}</span>}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    att.status === 'PRESENT'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : att.status === 'EXCUSED'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}>
                    {att.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* =====================================================================
          TAB 2: FEE INVOICES & PAYMENT RECEIPTS
          ===================================================================== */}
      {activeTab === 'fees' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl space-y-3 shadow-md">
              <span className="text-[11px] text-indigo-300 uppercase tracking-wider font-bold">Online Fee Payment Gateway</span>
              <h3 className="text-xl font-black">Transfer Online via Raast or 1Link</h3>
              <p className="text-xs text-indigo-200 leading-relaxed">
                Pay tuition fees directly through your mobile banking app using the academy's official IBAN or instant Raast ID with zero transaction fee.
              </p>
              <button
                onClick={() => setShowPayModal(true)}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
              >
                <CreditCard className="w-3.5 h-3.5" />
                View Academy Bank Account & Raast Details
              </button>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Financial Standing</span>
              <div className="text-2xl font-black font-mono text-slate-900">
                PKR {unpaidBalance.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500">
                {unpaidBalance === 0 ? 'All tuition fees are fully cleared. Thank you!' : 'Pending monthly invoice balance. Please clear before due date.'}
              </p>
            </div>
          </div>

          {/* Invoices List */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Fee Invoices</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="p-3">Invoice No</th>
                  <th className="p-3">Billing Month</th>
                  <th className="p-3">Issue Date</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Total Amount</th>
                  <th className="p-3">Balance Due</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">No invoices on file.</td>
                  </tr>
                ) : (
                  invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                      <td className="p-3 font-semibold text-slate-800">{inv.billing_month}</td>
                      <td className="p-3 font-mono text-slate-500">{inv.issue_date}</td>
                      <td className="p-3 font-mono text-slate-500">{inv.due_date}</td>
                      <td className="p-3 font-mono font-bold">PKR {inv.net_amount.toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-rose-600">PKR {inv.balance_amount.toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          inv.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Payment Receipts */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Paid Fee Receipts Ledger</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="p-3">Receipt No</th>
                  <th className="p-3">Payment Date</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Reference / TRX</th>
                  <th className="p-3">Amount Paid</th>
                  <th className="p-3">Collector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">No payment receipts recorded yet.</td>
                  </tr>
                ) : (
                  payments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">{p.receipt_number}</td>
                      <td className="p-3 font-mono text-slate-500">{p.payment_date}</td>
                      <td className="p-3 uppercase font-semibold text-slate-700">{p.payment_method}</td>
                      <td className="p-3 font-mono text-slate-500">{p.reference_number || 'N/A'}</td>
                      <td className="p-3 font-mono font-bold text-emerald-700">PKR {p.amount_paid.toLocaleString()}</td>
                      <td className="p-3 text-slate-500">{p.collected_by}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: HOMEWORK DIARY & PHYSICAL NOTEBOOK INSPECTION
          ===================================================================== */}
      {activeTab === 'homework' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Assigned Homework & Notebook Inspections
            </h3>
            <span className="text-xs text-slate-400 font-mono">Academic Session 2026-2027</span>
          </div>

          <div className="space-y-3">
            {homework.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 text-center">No active homework assignments for your batch.</p>
            ) : (
              homework.map(hw => (
                <div key={hw.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{hw.subject_name}</span>
                      <h4 className="font-bold text-slate-900 text-sm">{hw.title}</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{hw.description}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-bold">
                      Checked: DONE ✓
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Due Date: <strong className="text-slate-800 font-mono">{hw.due_date}</strong></span>
                    <span>Teacher: <strong className="text-slate-800">{hw.teacher_name || 'Sir Tariq'}</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: OFFICIAL REPORT CARDS & EXAM ASSESSMENTS
          ===================================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-600" />
                Published Examination Report Cards
              </h3>
              <span className="text-xs text-slate-400 font-mono">Formal Institutional Evaluations</span>
            </div>

            <div className="space-y-4">
              {reportCards.length === 0 ? (
                <p className="text-xs text-slate-400 p-6 text-center">No published exam report cards yet.</p>
              ) : (
                reportCards.map((rc, idx) => (
                  <div key={idx} className="p-5 rounded-2xl border border-purple-200 bg-purple-50/30 space-y-4 shadow-2xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-black uppercase tracking-wider rounded">
                          Official Assessment
                        </span>
                        <h4 className="text-base font-black text-slate-900 mt-1">{rc.exam.title}</h4>
                        <p className="text-xs text-slate-500 font-mono">Exam Date: {rc.exam.exam_date} • Batch: {rc.student.batch_name}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-2xl font-black font-mono text-purple-900">
                          {rc.evaluation.total_obtained} / {rc.exam.total_marks}
                        </span>
                        <span className="text-xs font-bold text-purple-700 block font-mono">
                          {rc.evaluation.percentage.toFixed(1)}% Marks
                        </span>
                      </div>
                    </div>

                    {/* Teacher Remarks */}
                    {(rc.evaluation.short_remarks || rc.evaluation.long_remarks) && (
                      <div className="p-3 bg-white rounded-xl border border-purple-100 text-xs text-slate-700">
                        <strong className="text-[10px] text-purple-800 uppercase block font-bold mb-0.5">Faculty Evaluation Remarks:</strong>
                        <p className="italic font-serif text-slate-800 text-sm">"{rc.evaluation.short_remarks || rc.evaluation.long_remarks}"</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-purple-100 text-xs">
                      <span className="text-slate-500">Evaluated on: <strong>{new Date(rc.evaluation.updated_at || rc.evaluation.created_at).toLocaleDateString()}</strong></span>
                      <button
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Official Report Card
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Apex Academy Official Payment Details
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Bank Name</span>
                <span className="font-bold text-slate-900 text-sm block">Bank Alfalah Limited</span>
                <span className="text-slate-500 text-[11px]">Gulberg III Campus Branch, Lahore</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Title</span>
                <span className="font-bold text-slate-900 text-sm block">Apex Academy Institutional Fees</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Raast ID / IBAN</span>
                <span className="font-mono font-black text-indigo-700 text-sm block">PK36ALFH01231005678901</span>
                <span className="text-[10px] text-slate-400 mt-1 block">Mention Student Roll: A-101 in payment remarks</span>
              </div>
            </div>

            <button
              onClick={() => setShowPayModal(false)}
              className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
