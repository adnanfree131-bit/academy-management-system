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
  CreditCard,
  X,
  RefreshCw
} from 'lucide-react';
import {
  StaffSalaryProfile,
  StaffPayslip,
  PayrollEarningHead,
  PayrollDeductionHead,
  PaymentMethod
} from '@apex/shared-types';
import { academyLetterheadFromAuth, buildSimpleStatementPdf, downloadPdfBytes } from '../lib/officialDocumentPdf';

export const PayrollDeskView: React.FC = () => {
  const { token, tenant } = useAuth();

  // Data
  const [profiles, setProfiles] = useState<StaffSalaryProfile[]>([]);
  const [payslips, setPayslips] = useState<StaffPayslip[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('August 2026');
  const [loading, setLoading] = useState<boolean>(true);

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

  const fetchPayrollData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [profRes, payRes] = await Promise.all([
        fetch('/api/v1/payroll/profiles', { headers: { authorization: `Bearer ${token}` } }),
        fetch(`/api/v1/payroll/payslips?payroll_month=${encodeURIComponent(selectedMonth)}`, {
          headers: { authorization: `Bearer ${token}` }
        }),
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
      { id: crypto.randomUUID(), name: 'Extra Period Allowance', quantity: 1, unit_rate: 1200, total: 1200 }
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
      { id: crypto.randomUUID(), name: 'Unexcused Absenteeism', quantity: 1, unit_rate: 2500, total: 2500 }
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
          earnings,
          deductions,
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-indigo-600" />
            Staff Payroll & Salaries
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Calculate monthly staff salaries, record deductions and allowances, and generate payslips.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Payroll Month:</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none"
            >
              <option value="August 2026">August 2026</option>
              <option value="September 2026">September 2026</option>
              <option value="October 2026">October 2026</option>
            </select>
          </div>

          <button
            onClick={fetchPayrollData}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">Total Month Payroll</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{totalPayrollBilled.toLocaleString()} <span className="text-xs text-slate-400 font-normal">PKR</span></p>
          <p className="text-[11px] text-slate-400 mt-0.5">{payslips.length} Slips Generated</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] font-mono text-emerald-600 uppercase tracking-wider font-semibold">Disbursed / Paid</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{totalPayrollPaid.toLocaleString()} <span className="text-xs text-slate-400 font-normal">PKR</span></p>
          <p className="text-[11px] text-slate-400 mt-0.5">{payslips.filter(p => p.status === 'paid').length} Staff Members Cleared</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] font-mono text-amber-600 uppercase tracking-wider font-semibold">Pending Disbursement</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{(totalPayrollBilled - totalPayrollPaid).toLocaleString()} <span className="text-xs text-slate-400 font-normal">PKR</span></p>
          <p className="text-[11px] text-amber-600/80 mt-0.5">{payslips.filter(p => p.status === 'processed').length} Processed Awaiting Payout</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] font-mono text-indigo-600 uppercase tracking-wider font-semibold">Active Staff Contracts</p>
          <p className="text-xl font-bold text-indigo-600 mt-1">{profiles.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Profiles on Record</p>
        </div>
      </div>

      {/* Main Side-by-Side Processing Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 4 Cols: Attendance Summary & Staff Selector */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <h2 className="text-xs font-mono uppercase text-slate-500 font-bold tracking-wider">
              1. Select Staff Member
            </h2>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600 font-bold text-slate-900"
            >
              {profiles.map(p => (
                <option key={p.staff_id} value={p.staff_id}>
                  {p.staff_name} — {p.designation} ({p.base_amount.toLocaleString()} PKR)
                </option>
              ))}
            </select>
          </div>

          {/* Module 13 Attendance Summary Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                Attendance & Clock-In Summary
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Month: {selectedMonth}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-mono">Working Days</span>
                <span className="text-sm font-bold text-slate-800">26 Days</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="text-[10px] text-emerald-600 block font-mono">Present Days</span>
                <span className="text-sm font-bold text-emerald-700">25 Days</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <span className="text-[10px] text-amber-600 block font-mono">Late Arrivals</span>
                <span className="text-sm font-bold text-amber-700">1 Arrival</span>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                <span className="text-[10px] text-blue-600 block font-mono">Approved Leaves</span>
                <span className="text-sm font-bold text-blue-700">1 Leave</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Unexcused Absents:</span>
                <span className="font-bold text-slate-700 font-mono">0 Days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lectures Delivered:</span>
                <span className="font-bold text-slate-700 font-mono">48 Periods</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GPS Accuracy:</span>
                <span className="font-bold text-emerald-600 font-mono">100% Geofenced</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 8 Cols: Interactive Compensation Form */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Interactive Salary Calculator</h2>
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
                        placeholder="Earning description"
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
                    Deductions & Penalties (Attendance-Linked)
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
                        placeholder="Deduction description"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Administrative Notes</label>
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
                  <p className="text-2xl font-bold font-mono text-white">
                    {netPayable.toLocaleString()} <span className="text-xs font-normal text-slate-400">PKR</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Base: {baseSalary.toLocaleString()} + Additions: {totalEarnings.toLocaleString()} - Deductions: {totalDeductions.toLocaleString()}
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Process & Save Payslip
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
              Monthly Payslip Master Register ({selectedMonth})
            </h2>
            <p className="text-xs text-slate-500">Record of finalized payslips with payout status tracking.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
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
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded transition-colors"
                          >
                            Disburse
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setPrintPayslip(slip);
                            setShowPrintModal(true);
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] rounded transition-colors"
                          title="Print Official Payslip"
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
      </div>

      {/* DISBURSE / MARK PAID MODAL */}
      {showDisburseModal && activePayslip && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Confirm Salary Disbursement
              </h3>
              <button onClick={() => setShowDisburseModal(false)} className="text-slate-400 hover:text-slate-600">
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
                  placeholder="e.g. HBL-FT-8899201"
                  value={disburseRef}
                  onChange={e => setDisburseRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisburseModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
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
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download official payslip
                </button>
                <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Payslip Card */}
            <div className="border border-slate-300 p-6 rounded-xl bg-white space-y-4 text-xs font-mono">
              <div className="text-center border-b border-slate-300 pb-3 space-y-1">
                <h2 className="font-black text-slate-900 text-base uppercase tracking-tight">{tenant?.name || 'ACADEMY PORTAL'}</h2>
                <p className="text-[10px] text-slate-500">{tenant?.campus_name || 'Main Campus'} • Official Salary Disbursement Slip</p>
                <span className="inline-block px-3 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                  PAYSLIP FOR {printPayslip.payroll_month.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-slate-200 pb-3">
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

              <div className="grid grid-cols-2 gap-4">
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
