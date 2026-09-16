import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  RotateCcw,
  Trash2,
  AlertTriangle,
  FileText,
  Receipt,
  X,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { StudentInvoice, FeePayment } from '@apex/shared-types';
import { PageHeading } from '../components/PageHeading';
import { isSameBillingMonth } from './FeeChallansView';

export const FeeReversalsView: React.FC = () => {
  const { token } = useAuth();

  // Core Data
  const [students, setStudents] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Selection
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchPopup, setShowSearchPopup] = useState<boolean>(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [ledgerMonth, setLedgerMonth] = useState<string>(() =>
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  // Reversal Modal State
  const [reverseTargetPayment, setReverseTargetPayment] = useState<FeePayment | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [isSubmittingReversal, setIsSubmittingReversal] = useState<boolean>(false);

  // Delete Payment Modal State
  const [deleteTargetPayment, setDeleteTargetPayment] = useState<FeePayment | null>(null);
  const [isSubmittingDeletePayment, setIsSubmittingDeletePayment] = useState<boolean>(false);

  // Delete Challan Modal State
  const [deleteTargetChallan, setDeleteTargetChallan] = useState<StudentInvoice | null>(null);
  const [deleteChallanReason, setDeleteChallanReason] = useState<string>('');
  const [isSubmittingDeleteChallan, setIsSubmittingDeleteChallan] = useState<boolean>(false);

  // Notification Banner
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 6000);
  };

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const [studRes, progRes, batchRes, invRes, payRes] = await Promise.all([
        fetch('/api/v1/sis/students', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/programs', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/batches', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/invoices', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/payments', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [studData, progData, batchData, invData, payData] = await Promise.all([
        studRes.json(),
        progRes.json(),
        batchRes.json(),
        invRes.json(),
        payRes.json(),
      ]);

      if (studData.success) setStudents(studData.data || []);
      if (progData.success) setPrograms(progData.data || []);
      if (batchData.success) setBatches(batchData.data || []);
      if (invData.success) setInvoices(invData.data || []);
      if (payData.success) setPayments(payData.data || []);
    } catch (err: any) {
      showNotification('error', `Failed to load records: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Selected Student Object
  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return students.find(s => s.id === selectedStudentId) || null;
  }, [selectedStudentId, students]);

  // Student's Invoices & Payments
  const studentInvoices = useMemo(() => {
    if (!selectedStudentId) return [];
    return invoices.filter(i => i.student_id === selectedStudentId);
  }, [selectedStudentId, invoices]);

  const studentPayments = useMemo(() => {
    if (!selectedStudentId) return [];
    return payments.filter(p => p.student_id === selectedStudentId);
  }, [selectedStudentId, payments]);

  const monthChoices = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    });
  }, []);

  const monthInvoices = useMemo(() => {
    return studentInvoices.filter(i => isSameBillingMonth(i.billing_month, ledgerMonth));
  }, [studentInvoices, ledgerMonth]);

  const monthInvoiceIds = useMemo(() => new Set(monthInvoices.map(i => i.id)), [monthInvoices]);

  const monthPayments = useMemo(() => {
    return studentPayments.filter(p => monthInvoiceIds.has(p.invoice_id) || isSameBillingMonth(String((p as any).billing_month || ''), ledgerMonth));
  }, [studentPayments, monthInvoiceIds, ledgerMonth]);

  // Filtered Students for Search
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return students.filter(s => {
      const nameMatch = (s.full_name || '').toLowerCase().includes(q);
      const rollMatch = (s.roll_number || '').toLowerCase().includes(q);
      const admMatch = (s.admission_number || '').toLowerCase().includes(q);
      const phoneMatch = (s.guardian_phone || s.phone || '').toLowerCase().includes(q);
      const cnicMatch = (s.guardian_id_card || '').toLowerCase().includes(q);
      return nameMatch || rollMatch || admMatch || phoneMatch || cnicMatch;
    }).slice(0, 50);
  }, [searchQuery, students]);

  const getProgramName = (progId?: string) => {
    if (!progId) return 'Class';
    return programs.find(p => p.id === progId)?.name || 'Class';
  };

  const getBatchName = (batchId?: string) => {
    if (!batchId) return '';
    return batches.find(b => b.id === batchId)?.name || '';
  };

  // Reversal Execution
  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseTargetPayment || !reversalReason.trim() || !token) return;

    try {
      setIsSubmittingReversal(true);
      const res = await fetch(`/api/v1/finance/payments/${reverseTargetPayment.id}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          void_reason: reversalReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to reverse payment');
      }

      showNotification('success', `Payment receipt ${reverseTargetPayment.receipt_number} reversed successfully. Challan dues restored.`);
      setReverseTargetPayment(null);
      setReversalReason('');
      await fetchData();
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSubmittingReversal(false);
    }
  };

  // Permanent Delete Payment Execution
  const handleConfirmDeletePayment = async () => {
    if (!deleteTargetPayment || !token) return;

    try {
      setIsSubmittingDeletePayment(true);
      const res = await fetch(`/api/v1/finance/payments/${deleteTargetPayment.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        },
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete payment');
      }

      showNotification('success', `Payment receipt ${deleteTargetPayment.receipt_number} permanently deleted and removed from records.`);
      setDeleteTargetPayment(null);
      await fetchData();
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSubmittingDeletePayment(false);
    }
  };

  // Delete Challan Execution (Cascade)
  const handleConfirmDeleteChallan = async () => {
    if (!deleteTargetChallan || !token) return;

    try {
      setIsSubmittingDeleteChallan(true);
      const res = await fetch(`/api/v1/finance/invoices/${deleteTargetChallan.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          reason: deleteChallanReason.trim() || 'Administrative deletion',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete challan');
      }

      showNotification('success', `Fee challan ${deleteTargetChallan.invoice_number} and all connected receipts were deleted successfully.`);
      setDeleteTargetChallan(null);
      setDeleteChallanReason('');
      await fetchData();
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSubmittingDeleteChallan(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeading
        title="Fee Reversals"
        description="Void a receipt or cancel a challan. Records are kept."
      />

      {/* Notification Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="p-1 hover:bg-black/5 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Instant Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Name, roll no, phone, or CNIC"
              value={searchQuery}
              onChange={e => {
                const next = e.target.value;
                setSearchQuery(next);
                if (next.trim()) setShowSearchPopup(true);
                else setShowSearchPopup(false);
              }}
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-900 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (searchQuery.trim()) setShowSearchPopup(true);
            }}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-2 transition-colors shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>Select Student</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1 border-t border-slate-100">
          <span>Type a name or roll number, then Select Student.</span>
          {isLoading && (
            <span className="flex items-center gap-1 text-indigo-600">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Syncing...
            </span>
          )}
        </div>
      </div>

      {/* No Student Selected State */}
      {!selectedStudent && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <h3 className="text-sm font-semibold text-slate-900">Search a student</h3>
          <p className="text-xs text-slate-500 mt-1">Void a receipt or cancel an unpaid challan.</p>
        </div>
      )}

      {/* Student Dossier Active */}
      {selectedStudent && (
        <div className="space-y-5">
          {/* Student Profile Banner */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-base shrink-0 uppercase shadow-2xs">
                  {selectedStudent.full_name?.charAt(0) || 'S'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900">{selectedStudent.full_name}</h3>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-mono font-bold">
                      Roll #{selectedStudent.roll_number || '—'}
                    </span>
                    {selectedStudent.admission_number && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-mono">
                        Adm #{selectedStudent.admission_number}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                      {getProgramName(selectedStudent.program_id)}
                      {getBatchName(selectedStudent.batch_id) ? ` • Section ${getBatchName(selectedStudent.batch_id)}` : ''}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                    <span>Father / Guardian: <strong className="text-slate-700">{selectedStudent.father_name || selectedStudent.guardian_name || '—'}</strong></span>
                    {(selectedStudent.guardian_phone || selectedStudent.phone) && (
                      <span>• Phone: <strong className="text-slate-700 font-mono">{selectedStudent.guardian_phone || selectedStudent.phone}</strong></span>
                    )}
                    {selectedStudent.guardian_id_card && (
                      <span>• CNIC: <strong className="text-slate-700 font-mono">{selectedStudent.guardian_id_card}</strong></span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudentId(null);
                    setSearchQuery('');
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search Another</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
            <p className="text-[11px] text-slate-500">This month only. Open another month with a button. Void and cancel keep the row; printed reports are not rewritten.</p>
            <div className="flex flex-wrap gap-1.5">
              {monthChoices.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setLedgerMonth(m)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                    ledgerMonth === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {m === monthChoices[0] ? `This month` : m}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Metrics Strip */}
          {(() => {
            const totalDue = monthInvoices
              .filter(i => i.status !== 'paid' && i.balance_amount > 0)
              .reduce((s, i) => s + i.balance_amount, 0);
            const totalPaid = monthInvoices
              .filter(i => i.status !== 'cancelled' && i.status !== 'voided')
              .reduce((s, i) => s + (i.paid_amount || 0), 0);
            const clearedReceipts = monthPayments.filter(p => p.status !== 'voided');
            const voidedReceipts = monthPayments.filter(p => p.status === 'voided');

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Current Due Balance</span>
                  <span className={`text-base font-mono font-bold mt-1 block ${totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    PKR {totalDue.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
                    {monthInvoices.length} Challan{monthInvoices.length !== 1 ? 's' : ''} this month
                  </span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Total Paid</span>
                  <span className="text-base font-mono font-bold text-emerald-700 mt-1 block">
                    PKR {totalPaid.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">Active collections</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Active Receipts</span>
                  <span className="text-base font-mono font-bold text-slate-900 mt-1 block">
                    {clearedReceipts.length} Receipt{clearedReceipts.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">Eligible for reversal</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Voided / Reversed</span>
                  <span className="text-base font-mono font-bold text-rose-700 mt-1 block">
                    {voidedReceipts.length} Reversed
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">Prior voided entries</span>
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* SECTION 1: ISSUED CHALLANS (CHALLAN DELETION DESK) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Issued Fee Challans</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Cancel an unpaid challan. The row stays on the books as cancelled. Already printed reports are not changed.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-mono font-bold rounded-lg self-start sm:self-auto">
                {monthInvoices.length} this month
              </span>
            </div>

            {monthInvoices.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No fee challans found for this student.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Challan #</th>
                      <th className="py-2.5 px-3">Billing Month</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3 text-right">Net Amount</th>
                      <th className="py-2.5 px-3 text-right">Paid Amount</th>
                      <th className="py-2.5 px-3 text-right">Balance Due</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {monthInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {inv.invoice_number}
                          </td>
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                            {inv.billing_month}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {inv.due_date}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            PKR {inv.net_amount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            PKR {(inv.paid_amount || 0).toLocaleString()}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${inv.balance_amount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            PKR {inv.balance_amount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              inv.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.status === 'partially_paid'
                                ? 'bg-amber-100 text-amber-800'
                                : inv.status === 'cancelled'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-sans">
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTargetChallan(inv);
                                setDeleteChallanReason('');
                              }}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ml-auto"
                              title="Cancel this unpaid challan. Payments must be voided first."
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Cancel challan</span>
                            </button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: PAYMENT RECEIPTS (REVERSAL & DELETION DESK) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>Collected Payment Receipts</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Void a receipt to restore the challan balance. The receipt stays on file.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-mono font-bold rounded-lg self-start sm:self-auto">
                {monthPayments.length} this month
              </span>
            </div>

            {monthPayments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No payment receipts found for this student.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Receipt #</th>
                      <th className="py-2.5 px-3">Payment Date</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Ref / Bank</th>
                      <th className="py-2.5 px-3 text-right">Amount Paid</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {monthPayments.map(pay => {
                      const isVoided = pay.status === 'voided';
                      return (
                        <tr key={pay.id} className={isVoided ? 'bg-rose-50/20 text-slate-400' : 'hover:bg-slate-50'}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {pay.receipt_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-sans">
                            {pay.payment_date}
                          </td>
                          <td className="py-2.5 px-3 capitalize font-sans">
                            {pay.payment_method?.replace('_', ' ')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[10px]">
                            {pay.reference_number || pay.bank_name || '—'}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${isVoided ? 'line-through text-slate-400' : 'text-emerald-700'}`}>
                            PKR {pay.amount_paid.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            {isVoided ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-800">
                                Voided / Reversed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                                Cleared
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isVoided && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReverseTargetPayment(pay);
                                    setReversalReason('');
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                  title="Reverse receipt, restore challan dues, and create counter cashbook entry"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Reverse</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setDeleteTargetPayment(pay)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                title="Permanently delete receipt from database"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LIVE STUDENT SEARCH POPUP */}
      {/* ========================================================================= */}
      {showSearchPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-600" />
                  <span>Select Student for Reversal & Deletion</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} found
                  {searchQuery ? ` matching "${searchQuery}"` : ''}
                </p>
              </div>
              <button
                onClick={() => setShowSearchPopup(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* In-Modal Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Type name, roll #, admission #, guardian phone, or CNIC..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Results Roster */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {filteredStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No students found matching "{searchQuery}"</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Try searching by admission number, roll number, student name, guardian mobile, or CNIC.
                  </p>
                </div>
              ) : (
                filteredStudents.map(student => {
                  const studInvoices = invoices.filter(i => i.student_id === student.id);
                  const unpaidInvoices = studInvoices.filter(i => i.status !== 'paid' && i.balance_amount > 0);
                  const totalDue = unpaidInvoices.reduce((sum, inv) => sum + inv.balance_amount, 0);
                  const studPayments = payments.filter(p => p.student_id === student.id);

                  return (
                    <div
                      key={student.id}
                      onClick={() => {
                        setSelectedStudentId(student.id);
                        setShowSearchPopup(false);
                      }}
                      className="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 uppercase">
                          {student.full_name?.charAt(0) || 'S'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs">{student.full_name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-semibold">
                              Roll #{student.roll_number || '—'}
                            </span>
                            {student.admission_number && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 text-[10px] font-mono">
                                Adm #{student.admission_number}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            <strong className="text-slate-700">{getProgramName(student.program_id)}</strong>
                            {getBatchName(student.batch_id) ? ` • Section ${getBatchName(student.batch_id)}` : ''}
                            <span className="text-slate-300 mx-1">•</span>
                            Father: {student.father_name || student.guardian_name || '—'}
                            {student.guardian_phone || student.phone ? ` (${student.guardian_phone || student.phone})` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-right">
                          <span className={`text-xs font-mono font-bold block ${totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {totalDue > 0 ? `PKR ${totalDue.toLocaleString()} Due` : 'No Dues'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {studInvoices.length} Challan{studInvoices.length !== 1 ? 's' : ''} • {studPayments.length} Receipt{studPayments.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REVERSE PAYMENT RECEIPT */}
      {/* ========================================================================= */}
      {reverseTargetPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reverse Fee Receipt</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Receipt #{reverseTargetPayment.receipt_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReverseTargetPayment(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-900">
              <div className="flex justify-between font-mono font-bold">
                <span>Amount to Reverse:</span>
                <span>PKR {reverseTargetPayment.amount_paid.toLocaleString()}</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                This will void receipt <strong>{reverseTargetPayment.receipt_number}</strong>, restore PKR {reverseTargetPayment.amount_paid.toLocaleString()} unpaid balance to the student's challan, and record a counter-entry in the cashbook.
              </p>
            </div>

            <form onSubmit={handleConfirmReversal} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Reason for Reversal *
                </label>
                <textarea
                  rows={3}
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  placeholder="State operational reason (e.g. Cheque dishonored by bank, cashier entered wrong amount, duplicate receipt issued)..."
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 text-slate-900"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReverseTargetPayment(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReversal || !reversalReason.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isSubmittingReversal ? 'Reversing...' : 'Confirm Reversal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE PAYMENT RECEIPT (HARD PURGE) */}
      {/* ========================================================================= */}
      {deleteTargetPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Permanently Delete Payment</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Receipt #{deleteTargetPayment.receipt_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTargetPayment(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1.5 text-xs text-rose-900">
              <p className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Irreversible Permanent Purge</span>
              </p>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                This will permanently delete receipt <strong>{deleteTargetPayment.receipt_number}</strong> (PKR {deleteTargetPayment.amount_paid.toLocaleString()}), restore the unpaid balance on the challan, and purge its cashbook transaction.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTargetPayment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePayment}
                disabled={isSubmittingDeletePayment}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSubmittingDeletePayment ? 'Deleting...' : 'Permanently Delete Payment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE FEE CHALLAN (CASCADE DELETION) */}
      {/* ========================================================================= */}
      {deleteTargetChallan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Cancel challan</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Challan #{deleteTargetChallan.invoice_number} • {deleteTargetChallan.billing_month}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTargetChallan(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-2 text-xs text-rose-900">
              <p className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Cascade Deletion Warning</span>
              </p>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Deleting this fee challan will permanently purge:
              </p>
              <ul className="list-disc pl-4 text-[11px] space-y-1 text-rose-800">
                <li>The fee challan record (Net Amount: PKR {deleteTargetChallan.net_amount.toLocaleString()})</li>
                <li>All linked fee payment receipts (Paid: PKR {(deleteTargetChallan.paid_amount || 0).toLocaleString()})</li>
                <li>Connected double-entry cashbook ledger records</li>
                <li>Associated fee concessions and discount entries</li>
              </ul>
              <p className="text-[11px] font-semibold text-rose-900 pt-1">
                Student running dues will be recalculated automatically.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Administrative Deletion Reason (Optional)
              </label>
              <input
                type="text"
                value={deleteChallanReason}
                onChange={e => setDeleteChallanReason(e.target.value)}
                placeholder="e.g. Erroneously issued for wrong class, replaced by revised challan"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTargetChallan(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteChallan}
                disabled={isSubmittingDeleteChallan}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSubmittingDeleteChallan ? 'Cancelling…' : 'Cancel challan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
