import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Wallet,
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Printer,
  Download,
  FileText,
  Users,
  Receipt,
  X,
  ChevronDown,
  Sliders
} from 'lucide-react';
import {
  StaffSalaryProfile,
  StaffPayslip,
  PayrollEarningHead,
  PayrollDeductionHead,
  PaymentMethod,
  StaffMonthlyAttendanceSummary
} from '@apex/shared-types';
import { academyLetterheadFromAuth, buildSimpleStatementPdf, downloadPdfBytes } from '../lib/officialDocumentPdf';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';

export const PayrollDeskView: React.FC = () => {
  const { token, tenant } = useAuth();

  // Data
  const [profiles, setProfiles] = useState<StaffSalaryProfile[]>([]);
  const [payslips, setPayslips] = useState<StaffPayslip[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [showKpis, setShowKpis] = useState<boolean>(false);

  // Active Processing Form State
  const [earnings, setEarnings] = useState<PayrollEarningHead[]>([]);
  const [deductions, setDeductions] = useState<PayrollDeductionHead[]>([]);
  const [adminNotes, setAdminNotes] = useState<string>('');

  // Disbursement Modal
  const [showDisburseModal, setShowDisburseModal] = useState<boolean>(false);
  const [activePayslip, setActivePayslip] = useState<StaffPayslip | null>(null);
  const [disburseMethod, setDisburseMethod] = useState<PaymentMethod>('bank_transfer');
  const [disburseRef, setDisburseRef] = useState<string>('');

  // Print Payslip Modal
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printPayslip, setPrintPayslip] = useState<StaffPayslip | null>(null);
  const [attSummaries, setAttSummaries] = useState<StaffMonthlyAttendanceSummary[]>([]);

  const getIsoMonth = (mStr: string) => {
    const months: Record<string, string> = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'May': '05', 'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };
    const [mName, yStr] = mStr.split(' ');
    if (months[mName] && yStr) {
      return `${yStr}-${months[mName]}`;
    }
    return new Date().toISOString().slice(0, 7);
  };

  const fetchPayrollData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const isoMonth = getIsoMonth(selectedMonth);
      const [profRes, payRes, attRes] = await Promise.all([
        fetch('/api/v1/payroll/profiles', { headers: { authorization: `Bearer ${token}` } }),
        fetch(`/api/v1/payroll/payslips?payroll_month=${encodeURIComponent(selectedMonth)}`, {
          headers: { authorization: `Bearer ${token}` }
        }),
        fetch(`/api/v1/geofence/attendance/monthly-summary?month=${encodeURIComponent(isoMonth)}`, {
          headers: { authorization: `Bearer ${token}` }
        }).catch(() => null),
      ]);

      if (profRes.ok) {
        const pData = (await profRes.json()).data || [];
        setProfiles(pData);
        if (pData.length > 0 && !selectedStaffId) {
          setSelectedStaffId(pData[0].staff_id);
        }
      }
      if (payRes.ok) {
        setPayslips((await payRes.json()).data || []);
      }
      if (attRes && attRes.ok) {
        const aData = await attRes.json();
        setAttSummaries(aData.data || []);
      }
    } catch (err) {
      console.error('Failed to load payroll data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollData();
  }, [token, selectedMonth]);

  const currentProfile = profiles.find(p => p.staff_id === selectedStaffId);

  // Dynamic Row Operations
  const handleAddEarning = () => {
    setEarnings(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: '', quantity: 1, unit_rate: 0, total: 0 }
    ]);
  };

  const handleUpdateEarning = (id: string, field: 'name' | 'quantity' | 'unit_rate', val: any) => {
    setEarnings(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, [field]: val };
        updated.total = Number(updated.quantity) * Number(updated.unit_rate);
        return updated;
      }
      return e;
    }));
  };

  const handleRemoveEarning = (id: string) => {
    setEarnings(prev => prev.filter(e => e.id !== id));
  };

  const handleAddDeduction = () => {
    setDeductions(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: '', quantity: 1, unit_rate: 0, total: 0 }
    ]);
  };

  const handleUpdateDeduction = (id: string, field: 'name' | 'quantity' | 'unit_rate', val: any) => {
    setDeductions(prev => prev.map(d => {
      if (d.id === id) {
        const updated = { ...d, [field]: val };
        updated.total = Number(updated.quantity) * Number(updated.unit_rate);
        return updated;
      }
      return d;
    }));
  };

  const handleRemoveDeduction = (id: string) => {
    setDeductions(prev => prev.filter(d => d.id !== id));
  };

  // Calculations
  const baseSalary = currentProfile?.base_amount || 0;
  const totalEarnings = earnings.reduce((s, e) => s + (Number(e.quantity) * Number(e.unit_rate)), 0);
  const totalDeductions = deductions.reduce((s, d) => s + (Number(d.quantity) * Number(d.unit_rate)), 0);
  const netPayable = Math.max(0, baseSalary + totalEarnings - totalDeductions);

  // Process and Save Payslip
  const handleProcessSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedStaffId) return;

    try {
      const res = await fetch('/api/v1/payroll/payslips/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          staff_id: selectedStaffId,
          payroll_month: selectedMonth,
          earnings: earnings.filter(e => e.name.trim() && Number(e.unit_rate) >= 0),
          deductions: deductions.filter(d => d.name.trim() && Number(d.unit_rate) >= 0),
          admin_notes: adminNotes
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`Payslip ${data.data.slip_number} processed and locked.`);
        fetchPayrollData();
      } else {
        alert(data.error?.message || 'Failed to process payslip');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Disburse / Mark Paid
  const handleConfirmDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePayslip || !token) return;

    try {
      const res = await fetch(`/api/v1/payroll/payslips/${activePayslip.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          payment_method: disburseMethod,
          reference: disburseRef || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowDisburseModal(false);
        setDisburseRef('');
        fetchPayrollData();
      } else {
        alert(data.error?.message || 'Failed to mark payslip as disbursed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Total Disbursed & Pending
  const totalPayrollBilled = payslips.reduce((s, p) => s + p.net_salary, 0);
  const totalPayrollPaid = payslips.filter(p => p.status === 'paid').reduce((s, p) => s + p.net_salary, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeading
        title="Payroll"
        description="Set salary, add allowances or deductions, then save a payslip."
        icon={<Wallet className="w-4 h-4 text-slate-700" />}
      >
        <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-500 font-medium">Month:</span>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date();
              d.setDate(1);
              d.setMonth(d.getMonth() - 6 + i);
              const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              return <option key={label} value={label}>{label}</option>;
            })}
          </select>
        </div>
      </PageHeading>

      {/* KPI Cards Strip with Mobile Toggle */}
      <div className="space-y-2">
        <div className="flex sm:hidden items-center justify-between">
          <button
            type="button"
            onClick={() => setShowKpis(!showKpis)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Metrics</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showKpis ? 'rotate-180' : ''}`} />
          </button>
          <span className="text-xs font-mono text-slate-500">
            {payslips.length} slips processed
          </span>
        </div>

        <div className={showKpis ? 'grid grid-cols-2 lg:grid-cols-4 gap-2.5' : 'hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5'}>
          {/* Card 1: Total Month Payroll */}
          <div className="bg-white border border-slate-200/85 border-l-[3.5px] border-l-indigo-600 rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Total Month Payroll
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-semibold text-slate-900 text-sm leading-none">
                  PKR {totalPayrollBilled.toLocaleString()}
                </span>
                <span className="text-xs font-medium text-slate-500 leading-none">
                  {payslips.length} Slips
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/70 shrink-0 shadow-2xs">
              <Receipt className="w-3.5 h-3.5 text-indigo-700" />
            </span>
          </div>

          {/* Card 2: Disbursed / Paid */}
          <div className="bg-white border border-slate-200/85 border-l-[3.5px] border-l-emerald-600 rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Disbursed / Paid
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-semibold text-emerald-700 text-sm leading-none">
                  PKR {totalPayrollPaid.toLocaleString()}
                </span>
                <span className="text-xs font-medium text-slate-500 leading-none">
                  {payslips.filter(p => p.status === 'paid').length} Cleared
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/70 shrink-0 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            </span>
          </div>

          {/* Card 3: Pending Disbursement */}
          <div className="bg-white border border-slate-200/85 border-l-[3.5px] border-l-amber-600 rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Pending Disbursement
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-semibold text-amber-700 text-sm leading-none">
                  PKR {(totalPayrollBilled - totalPayrollPaid).toLocaleString()}
                </span>
                <span className="text-xs font-medium text-slate-500 leading-none">
                  {payslips.filter(p => p.status === 'processed').length} Pending
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/70 shrink-0 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
            </span>
          </div>

          {/* Card 4: Active Staff Contracts */}
          <div className="bg-white border border-slate-200/85 border-l-[3.5px] border-l-slate-600 rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Active Staff Contracts
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-semibold text-slate-900 text-sm leading-none">
                  {profiles.length}
                </span>
                <span className="text-xs font-medium text-slate-500 leading-none">
                  Profiles
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-center border border-slate-200/70 shrink-0 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-slate-700" />
            </span>
          </div>
        </div>
      </div>

      {/* Main Side-by-Side Processing Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 4 Cols: Attendance Summary & Staff Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2.5">
            <h2 className="text-xs font-mono uppercase text-slate-500 font-semibold tracking-wider">
              Staff Member
            </h2>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium text-slate-800"
            >
              <option value="">Select staff</option>
              {profiles.map(p => (
                <option key={p.staff_id} value={p.staff_id}>
                  {p.staff_name} — {p.designation} ({p.base_amount.toLocaleString()} PKR)
                </option>
              ))}
            </select>
          </div>

          {/* Module 13 Attendance Summary Box - Clean Flat Surface */}
          {(() => {
            const staffAtt = attSummaries.find(s => s.staff_id === selectedStaffId);
            const workingDays = staffAtt ? staffAtt.total_working_days : 26;
            const presentDays = staffAtt ? staffAtt.present_days : 0;
            const lateDays = staffAtt ? staffAtt.late_days : 0;
            const leaveDays = staffAtt ? staffAtt.leave_days : 0;
            const absentDays = staffAtt ? staffAtt.absent_days : 0;
            const halfDays = staffAtt ? staffAtt.half_days : 0;
            const totalPunches = presentDays + lateDays + halfDays;
            const geofencePct = totalPunches > 0 && staffAtt
              ? Math.round((staffAtt.geofence_verified_count / totalPunches) * 100)
              : null;

            return (
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Attendance Summary
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">{selectedMonth}</span>
                </div>

                {/* Flat Stats Grid - Zero Card within Card */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Working Days</span>
                    <span className="text-sm font-semibold text-slate-800 font-mono">{workingDays} Days</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 block font-mono">Present Days</span>
                    <span className="text-sm font-semibold text-emerald-700 font-mono">{presentDays} Days</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-600 block font-mono">Late Arrivals</span>
                    <span className="text-sm font-semibold text-amber-700 font-mono">{lateDays} Arrivals</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-600 block font-mono">Approved Leaves</span>
                    <span className="text-sm font-semibold text-blue-700 font-mono">{leaveDays} Leaves</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unexcused Absents:</span>
                    <span className="font-semibold text-slate-700 font-mono">{absentDays} Days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Half-Day Shifts:</span>
                    <span className="font-semibold text-amber-700 font-mono">{halfDays} Shifts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">GPS verified punches:</span>
                    <span className="font-semibold text-slate-700 font-mono">{geofencePct === null ? '—' : `${geofencePct}%`}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right 8 Cols: Interactive Compensation Form */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Salary</h2>
                <p className="text-xs text-slate-500 font-mono">
                  {currentProfile?.staff_name} • {currentProfile?.designation}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Base Contract Salary</p>
                <p className="text-base font-bold font-mono text-slate-900">{baseSalary.toLocaleString()} PKR</p>
              </div>
            </div>

            <form onSubmit={handleProcessSalary} className="space-y-5">
              {/* Earnings Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    Additional Earnings & Allowances
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddEarning}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Line
                  </button>
                </div>

                <div className="space-y-2">
                  {earnings.map(e => (
                    <div key={e.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
                      <input
                        type="text"
                        value={e.name}
                        onChange={ev => handleUpdateEarning(e.id, 'name', ev.target.value)}
                        className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                        required
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[10px]">Qty:</span>
                        <input
                          type="number"
                          min="0"
                          value={e.quantity}
                          onChange={ev => handleUpdateEarning(e.id, 'quantity', Number(ev.target.value))}
                          className="w-16 px-2 py-1 text-center font-mono font-bold bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                          required
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[10px]">Rate:</span>
                        <input
                          type="number"
                          min="0"
                          value={e.unit_rate}
                          onChange={ev => handleUpdateEarning(e.id, 'unit_rate', Number(ev.target.value))}
                          className="w-20 px-2 py-1 text-right font-mono font-bold bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                          required
                        />
                      </div>
                      <div className="w-24 text-right font-mono font-bold text-emerald-600 text-xs pr-1">
                        +{(Number(e.quantity) * Number(e.unit_rate)).toLocaleString()}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEarning(e.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deductions Section */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    Deductions
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddDeduction}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Line
                  </button>
                </div>

                <div className="space-y-2">
                  {deductions.map(d => (
                    <div key={d.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
                      <input
                        type="text"
                        value={d.name}
                        onChange={ev => handleUpdateDeduction(d.id, 'name', ev.target.value)}
                        className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                        required
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[10px]">Qty:</span>
                        <input
                          type="number"
                          min="0"
                          value={d.quantity}
                          onChange={ev => handleUpdateDeduction(d.id, 'quantity', Number(ev.target.value))}
                          className="w-16 px-2 py-1 text-center font-mono font-bold bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                          required
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[10px]">Rate:</span>
                        <input
                          type="number"
                          min="0"
                          value={d.unit_rate}
                          onChange={ev => handleUpdateDeduction(d.id, 'unit_rate', Number(ev.target.value))}
                          className="w-20 px-2 py-1 text-right font-mono font-bold bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-600"
                          required
                        />
                      </div>
                      <div className="w-24 text-right font-mono font-bold text-rose-600 text-xs pr-1">
                        -{(Number(d.quantity) * Number(d.unit_rate)).toLocaleString()}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDeduction(d.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Net Payable Summary Card */}
              <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Calculated Net Salary</span>
                  <p className="text-lg sm:text-xl font-bold font-mono text-white">
                    {netPayable.toLocaleString()} <span className="text-xs font-normal text-slate-400">PKR</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Base: {baseSalary.toLocaleString()} + Additions: {totalEarnings.toLocaleString()} - Deductions: {totalDeductions.toLocaleString()}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!selectedStaffId || !currentProfile}
                  className="w-full sm:w-auto px-6 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save payslip
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Processed Payslips History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs space-y-3 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Payslips ({selectedMonth})
            </h2>
            <p className="text-xs text-slate-500">Processed slips for this month.</p>
          </div>
        </div>

        {/* Desktop 9-Column Master Register (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase">
              <tr>
                <th className="py-2.5 px-3">Slip #</th>
                <th className="py-2.5 px-3">Staff Member</th>
                <th className="py-2.5 px-3">Designation</th>
                <th className="py-2.5 px-3 text-right">Base Salary</th>
                <th className="py-2.5 px-3 text-right">Additions</th>
                <th className="py-2.5 px-3 text-right">Deductions</th>
                <th className="py-2.5 px-3 text-right">Net Payable</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">Loading payroll records...</td>
                </tr>
              ) : payslips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">No payslips processed for {selectedMonth}.</td>
                </tr>
              ) : (
                payslips.map(slip => (
                  <tr key={slip.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-indigo-700">{slip.slip_number}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{slip.staff_name}</td>
                    <td className="py-3 px-3 text-slate-500">{slip.designation}</td>
                    <td className="py-3 px-3 text-right font-mono">{slip.base_salary.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-600">+{slip.total_earnings.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono text-rose-600">-{slip.total_deductions.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{slip.net_salary.toLocaleString()} PKR</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                        slip.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {slip.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {slip.status !== 'paid' && (
                          <button
                            onClick={() => {
                              setActivePayslip(slip);
                              setShowDisburseModal(true);
                            }}
                            className="w-7 h-7 flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition-colors"
                            title="Disburse Salary"
                            aria-label="Disburse Salary"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setPrintPayslip(slip);
                            setShowPrintModal(true);
                          }}
                          className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                          title="Print Official Payslip"
                          aria-label="Print Official Payslip"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Native Payslip Cards (< 768px) - Flat, zero card-in-card */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-6 text-center text-slate-400 text-xs font-mono">Loading payroll records...</div>
          ) : payslips.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">No payslips processed for {selectedMonth}.</div>
          ) : (
            payslips.map(slip => (
              <div key={slip.id} className="p-3.5 space-y-2.5 active:bg-slate-50 transition-colors">
                {/* Header: Slip # + Status Pill */}
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium text-xs text-indigo-700">{slip.slip_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium font-mono uppercase ${
                    slip.status === 'paid'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {slip.status}
                  </span>
                </div>

                {/* Staff Name & Role */}
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{slip.staff_name}</h4>
                  <p className="text-xs text-slate-500">{slip.designation}</p>
                </div>

                {/* Financial 3-Pillar Breakdown - Flat divider lines, no nested card */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Base</span>
                    <span className="text-xs font-medium text-slate-700">{slip.base_salary.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 block">+Earnings</span>
                    <span className="text-xs font-medium text-emerald-700">+{slip.total_earnings.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-600 block">-Deductions</span>
                    <span className="text-xs font-medium text-rose-700">-{slip.total_deductions.toLocaleString()}</span>
                  </div>
                </div>

                {/* Net Amount & Sleek Icon Actions */}
                <div className="flex items-center justify-between pt-0.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Net Payable</span>
                    <span className="text-sm font-semibold font-mono text-slate-900">{slip.net_salary.toLocaleString()} PKR</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {slip.status !== 'paid' && (
                      <button
                        onClick={() => {
                          setActivePayslip(slip);
                          setShowDisburseModal(true);
                        }}
                        className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors shadow-2xs"
                        title="Disburse Salary"
                        aria-label="Disburse Salary"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setPrintPayslip(slip);
                        setShowPrintModal(true);
                      }}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center border border-slate-200 transition-colors"
                      title="Print Official Payslip"
                      aria-label="Print Official Payslip"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DISBURSE / MARK PAID MODAL */}
      {showDisburseModal && activePayslip && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo
                title="Salary Disbursement"
                description="Confirm staff payout details and record reference number"
              />
              <button
                type="button"
                onClick={() => setShowDisburseModal(false)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDisburse} className="space-y-3.5">
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                <p className="font-bold text-slate-900">{activePayslip.staff_name} ({activePayslip.designation})</p>
                <p className="text-slate-500 font-mono">Slip: {activePayslip.slip_number} • Month: {activePayslip.payroll_month}</p>
                <p className="text-base font-bold font-mono text-emerald-600 mt-1">
                  Net Amount: {activePayslip.net_salary.toLocaleString()} PKR
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Disbursement Mode</label>
                <select
                  value={disburseMethod}
                  onChange={e => setDisburseMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                >
                  <option value="bank_transfer">Direct Online Bank Transfer</option>
                  <option value="cash">Cash Counter Disbursement</option>
                  <option value="cheque">Official Bank Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Ref / Cheque #</label>
                <input
                  type="text"
                  value={disburseRef}
                  onChange={e => setDisburseRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisburseModal(false)}
                  className="h-8.5 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
                >
                  Confirm Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT OFFICIAL PAYSLIP MODAL */}
      {showPrintModal && printPayslip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto no-sheet-overlay">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-2xl space-y-4 my-0 sm:my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 print:hidden">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                Staff Salary Slip (Official PDF Format)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const academy = await academyLetterheadFromAuth(tenant);
                    const slip = printPayslip;
                    const bytes = await buildSimpleStatementPdf({
                      title: 'Staff Salary Payslip',
                      academy,
                      identity: [
                        { label: 'Staff', value: slip.staff_name },
                        { label: 'Designation', value: slip.designation },
                        { label: 'Month', value: slip.payroll_month },
                        { label: 'Slip No', value: slip.slip_number },
                        { label: 'Status', value: slip.status },
                        { label: 'Net payable', value: `PKR ${slip.net_salary.toLocaleString()}` },
                      ],
                      columns: [
                        { key: 'item', label: 'Item', width: 220 },
                        { key: 'qty', label: 'Qty', width: 60, align: 'right' },
                        { key: 'rate', label: 'Rate', width: 90, align: 'right' },
                        { key: 'total', label: 'Amount', width: 110, align: 'right' },
                      ],
                      rows: [
                        { item: 'Base salary', qty: '1', rate: String(slip.base_salary), total: String(slip.base_salary) },
                        ...slip.earnings.map(e => ({ item: `Earning: ${e.name}`, qty: String(e.quantity), rate: String(e.unit_rate), total: String(e.total) })),
                        ...slip.deductions.map(d => ({ item: `Deduction: ${d.name}`, qty: String(d.quantity), rate: String(d.unit_rate), total: `-${d.total}` })),
                      ],
                      footerNote: slip.admin_notes || undefined,
                    });
                    await downloadPdfBytes(bytes, `payslip-${slip.slip_number}.pdf`);
                  }}
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download official payslip
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Payslip Card */}
            <div className="border border-slate-300 p-4 sm:p-6 rounded-xl bg-white space-y-4 text-xs font-mono">
              <div className="text-center border-b border-slate-300 pb-3 space-y-1">
                <h2 className="font-bold text-slate-900 text-base uppercase tracking-tight">{tenant?.name || 'ACADEMY PORTAL'}</h2>
                <p className="text-[10px] text-slate-500">{tenant?.campus_name || 'Main Campus'} • Official Salary Disbursement Slip</p>
                <span className="inline-block px-3 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                  PAYSLIP FOR {printPayslip.payroll_month.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] border-b border-slate-200 pb-3 print:grid-cols-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">Staff Name & Role:</span>
                  <span className="font-bold text-slate-900">{printPayslip.staff_name} ({printPayslip.designation})</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Slip Serial #:</span>
                  <span className="font-bold text-indigo-800">{printPayslip.slip_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Attendance Verified:</span>
                  <span>{printPayslip.attendance_summary.present_days} Days Present / {printPayslip.attendance_summary.late_count} Lates</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Status:</span>
                  <span className="font-bold uppercase text-emerald-700">{printPayslip.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
                {/* Earnings Column */}
                <div className="border border-slate-200 rounded p-2.5 space-y-2">
                  <p className="font-bold text-slate-900 border-b pb-1 text-[11px]">EARNINGS</p>
                  <div className="flex justify-between">
                    <span>Base Salary:</span>
                    <span>{printPayslip.base_salary.toLocaleString()}</span>
                  </div>
                  {printPayslip.earnings.map((e, idx) => (
                    <div key={idx} className="flex justify-between text-slate-600">
                      <span>{e.name}:</span>
                      <span>+{e.total.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold border-t pt-1 text-emerald-700">
                    <span>Total Earnings:</span>
                    <span>{(printPayslip.base_salary + printPayslip.total_earnings).toLocaleString()}</span>
                  </div>
                </div>

                {/* Deductions Column */}
                <div className="border border-slate-200 rounded p-2.5 space-y-2">
                  <p className="font-bold text-slate-900 border-b pb-1 text-[11px]">DEDUCTIONS</p>
                  {printPayslip.deductions.map((d, idx) => (
                    <div key={idx} className="flex justify-between text-slate-600">
                      <span>{d.name}:</span>
                      <span>-{d.total.toLocaleString()}</span>
                    </div>
                  ))}
                  {printPayslip.deductions.length === 0 && (
                    <p className="text-slate-400 italic">No deductions</p>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1 text-rose-700">
                    <span>Total Deductions:</span>
                    <span>-{printPayslip.total_deductions.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center text-sm font-bold">
                <span>NET DISBURSED AMOUNT:</span>
                <span className="text-indigo-900 text-base">{printPayslip.net_salary.toLocaleString()} PKR</span>
              </div>

              <div className="pt-6 grid grid-cols-2 gap-8 text-[10px] text-slate-500">
                <div className="text-center border-t border-slate-400 pt-1">
                  Director / Principal Signature
                </div>
                <div className="text-center border-t border-slate-400 pt-1">
                  Staff Member Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
