import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  RotateCcw,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
  AlertCircle,
  Filter,
  History,
  MessageSquare,
  SlidersHorizontal
} from 'lucide-react';
import { StudentInvoice, FeePayment } from '@apex/shared-types';
import { PageHeading } from '../components/PageHeading';
import { isSameBillingMonth, normalizeBillingMonth } from './FeeChallansView';

export const FeeReversalsView: React.FC = () => {
  const { token } = useAuth();

  // Navigation: Active Section Tab
  const [activeSection, setActiveSection] = useState<'desk' | 'logs'>('desk');

  // Core Data
  const [students, setStudents] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [_isLoading, setIsLoading] = useState<boolean>(true);

  // Primary Operational Filters (Default month is current month)
  const currentMonthName = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });
  const [selectedProgramId, setSelectedProgramId] = useState<string>('all');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // 'all' | 'paid' | 'partially_paid' | 'unpaid' | 'reversed'
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all'); // 'all' | 'cash' | 'bank_transfer' | 'easypaisa' | 'jazzcash' | 'cheque'
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Search & Selection State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Audit Logs Filter
  const [logsFilterScope, setLogsFilterScope] = useState<'all' | 'student'>('all');
  const [logsActionFilter, setLogsActionFilter] = useState<'all' | 'reversal' | 'deletion'>('all');
  const [logsProgramFilter, setLogsProgramFilter] = useState<string>('all');
  const [logsMonthFilter, setLogsMonthFilter] = useState<string>(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });
  const [logsSearchQuery, setLogsSearchQuery] = useState<string>('');

  // Reversal Modal State
  const [reverseTargetPayment, setReverseTargetPayment] = useState<FeePayment | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [isSubmittingReversal, setIsSubmittingReversal] = useState<boolean>(false);

  // Delete Modal State (Deletes both challan and attached receipt)
  const [deleteTargetChallan, setDeleteTargetChallan] = useState<StudentInvoice | null>(null);
  const [deleteChallanReason, setDeleteChallanReason] = useState<string>('');
  const [isSubmittingDeleteChallan, setIsSubmittingDeleteChallan] = useState<boolean>(false);

  // Notification Banner
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Click outside search container listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const [studRes, progRes, batchRes, invRes, payRes, logsRes] = await Promise.all([
        fetch('/api/v1/sis/students', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/programs', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/batches', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/invoices', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/payments', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/audit-logs', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
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

      if (logsRes && logsRes.ok) {
        const logsData = await logsRes.json();
        if (logsData.success) setAuditLogs(logsData.data || []);
      }
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

  // Available Billing Months across all invoices and audit logs (defaults to current month)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(currentMonthName);
    invoices.forEach(i => {
      if (i.billing_month) {
        months.add(normalizeBillingMonth(i.billing_month));
      }
    });
    auditLogs.forEach(l => {
      if (l.created_at) {
        const d = new Date(l.created_at);
        if (!isNaN(d.getTime())) {
          months.add(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
        }
      }
    });
    return Array.from(months);
  }, [invoices, auditLogs, currentMonthName]);

  // Filtered Batches based on selected program/class
  const filteredBatches = useMemo(() => {
    if (selectedProgramId === 'all') return batches;
    return batches.filter(b => b.program_id === selectedProgramId);
  }, [batches, selectedProgramId]);

  // Filtered Invoices based on all active filters
  const displayedInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.status === 'cancelled' || inv.status === 'voided') return false;

      const student = students.find(s => s.id === inv.student_id);

      // Filter by Student focus (if clicked)
      if (selectedStudentId && inv.student_id !== selectedStudentId) {
        return false;
      }

      // Filter by Program / Class
      if (selectedProgramId !== 'all') {
        const pId = inv.program_id || student?.program_id;
        if (pId !== selectedProgramId) return false;
      }

      // Filter by Batch / Section
      if (selectedBatchId !== 'all') {
        const bId = inv.batch_id || student?.batch_id;
        if (bId !== selectedBatchId) return false;
      }

      // Filter by Billing Month
      if (selectedMonth !== 'all') {
        if (!isSameBillingMonth(inv.billing_month, selectedMonth)) return false;
      }

      const linkedPayments = payments.filter(p => p.invoice_id === inv.id);
      const activePayments = linkedPayments.filter(p => p.status !== 'voided');
      const voidedPayments = linkedPayments.filter(p => p.status === 'voided');

      // Filter by Status / Actionability
      if (selectedStatus === 'paid') {
        if (activePayments.length === 0 && inv.status !== 'paid') return false;
      } else if (selectedStatus === 'partially_paid') {
        if (inv.status !== 'partially_paid') return false;
      } else if (selectedStatus === 'unpaid') {
        if (inv.status !== 'unpaid' || activePayments.length > 0) return false;
      } else if (selectedStatus === 'reversed') {
        if (voidedPayments.length === 0) return false;
      }

      // Filter by Payment Method
      if (selectedPaymentMethod !== 'all') {
        const hasMethod = activePayments.some(p => p.payment_method === selectedPaymentMethod);
        if (!hasMethod) return false;
      }

      // Filter by Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (inv.student_name || student?.full_name || '').toLowerCase().includes(q);
        const admMatch = (inv.admission_number || student?.admission_number || inv.roll_number || student?.roll_number || '').toLowerCase().includes(q);
        const invMatch = (inv.invoice_number || '').toLowerCase().includes(q);
        const phoneMatch = (student?.guardian_phone || student?.phone || '').toLowerCase().includes(q);
        const fatherMatch = (student?.father_name || student?.guardian_name || '').toLowerCase().includes(q);
        const receiptMatch = linkedPayments.some(p => (p.receipt_number || '').toLowerCase().includes(q));

        if (!nameMatch && !admMatch && !invMatch && !phoneMatch && !fatherMatch && !receiptMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    invoices,
    payments,
    students,
    selectedStudentId,
    selectedProgramId,
    selectedBatchId,
    selectedMonth,
    selectedStatus,
    selectedPaymentMethod,
    searchQuery,
  ]);

  // Payments matching the displayed invoices
  const displayedPayments = useMemo(() => {
    const invIds = new Set(displayedInvoices.map(i => i.id));
    return payments.filter(p => invIds.has(p.invoice_id) && p.status !== 'voided');
  }, [displayedInvoices, payments]);

  // Check if any filter deviates from default
  const hasActiveFilters = useMemo(() => {
    return (
      !isSameBillingMonth(selectedMonth, currentMonthName) ||
      selectedProgramId !== 'all' ||
      selectedBatchId !== 'all' ||
      selectedStatus !== 'all' ||
      selectedPaymentMethod !== 'all' ||
      searchQuery.trim().length > 0 ||
      selectedStudentId !== null
    );
  }, [
    selectedMonth,
    currentMonthName,
    selectedProgramId,
    selectedBatchId,
    selectedStatus,
    selectedPaymentMethod,
    searchQuery,
    selectedStudentId,
  ]);

  const handleResetFilters = () => {
    setSelectedMonth(currentMonthName);
    setSelectedProgramId('all');
    setSelectedBatchId('all');
    setSelectedStatus('all');
    setSelectedPaymentMethod('all');
    setSearchQuery('');
    setSelectedStudentId(null);
  };

  // Filtered Students for Dropdown (Only shown when search text is entered)
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return students
      .filter(s => {
        const nameMatch = (s.full_name || '').toLowerCase().includes(q);
        const admMatch = (s.admission_number || s.roll_number || '').toLowerCase().includes(q);
        const phoneMatch = (s.guardian_phone || s.phone || '').toLowerCase().includes(q);
        const cnicMatch = (s.guardian_id_card || '').toLowerCase().includes(q);
        return nameMatch || admMatch || phoneMatch || cnicMatch;
      })
      .slice(0, 15);
  }, [searchQuery, students]);

  // Filtered Audit Logs
  const displayedLogs = useMemo(() => {
    let list = auditLogs;
    // Fallback: If auditLogs endpoint hasn't populated yet, compute from voided payments
    if (list.length === 0 && payments.some(p => p.status === 'voided')) {
      list = payments
        .filter(p => p.status === 'voided')
        .map(p => {
          const stud = students.find(s => s.id === p.student_id);
          return {
            id: p.id,
            action: 'reversal',
            student_id: p.student_id,
            student_name: stud?.full_name || 'Student',
            admission_number: stud?.admission_number,
            roll_number: stud?.roll_number,
            reference_number: p.receipt_number,
            amount: p.amount_paid,
            reason: p.void_reason || 'Payment reversed',
            performed_by: p.voided_by || 'Admin',
            created_at: p.voided_at || p.payment_date || new Date().toISOString(),
          };
        });
    }

    if (logsFilterScope === 'student' && selectedStudentId) {
      list = list.filter(l => l.student_id === selectedStudentId);
    }
    if (logsActionFilter !== 'all') {
      list = list.filter(l => l.action === logsActionFilter);
    }
    if (logsProgramFilter !== 'all') {
      list = list.filter(l => {
        const stud = students.find(s => s.id === l.student_id);
        const pId = l.program_id || stud?.program_id;
        return pId === logsProgramFilter;
      });
    }
    if (logsMonthFilter !== 'all') {
      list = list.filter(l => {
        if (!l.created_at) return false;
        const d = new Date(l.created_at);
        const logMonth = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return isSameBillingMonth(logMonth, logsMonthFilter);
      });
    }
    if (logsSearchQuery.trim()) {
      const q = logsSearchQuery.toLowerCase().trim();
      list = list.filter(l =>
        (l.student_name || '').toLowerCase().includes(q) ||
        (l.reference_number || '').toLowerCase().includes(q) ||
        (l.admission_number || '').toLowerCase().includes(q) ||
        (l.roll_number || '').toLowerCase().includes(q) ||
        (l.reason || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [
    auditLogs,
    payments,
    students,
    logsFilterScope,
    logsActionFilter,
    logsProgramFilter,
    logsMonthFilter,
    logsSearchQuery,
    selectedStudentId,
  ]);

  // Check if any audit log filter deviates from default (Current Month, All Classes, All Actions, empty search, All Academy)
  const hasActiveLogsFilters = useMemo(() => {
    return (
      !isSameBillingMonth(logsMonthFilter, currentMonthName) ||
      logsProgramFilter !== 'all' ||
      logsActionFilter !== 'all' ||
      logsSearchQuery.trim().length > 0 ||
      logsFilterScope !== 'all'
    );
  }, [logsMonthFilter, currentMonthName, logsProgramFilter, logsActionFilter, logsSearchQuery, logsFilterScope]);

  const handleResetLogsFilters = () => {
    setLogsMonthFilter(currentMonthName);
    setLogsProgramFilter('all');
    setLogsActionFilter('all');
    setLogsSearchQuery('');
    setLogsFilterScope('all');
  };

  const getProgramName = (progId?: string) => {
    if (!progId) return 'Class';
    return programs.find(p => p.id === progId)?.name || 'Class';
  };

  const getBatchName = (batchId?: string) => {
    if (!batchId) return '';
    return batches.find(b => b.id === batchId)?.name || '';
  };

  // Reversal Execution (Reverses collected payment receipt, keeps challan active)
  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseTargetPayment || !token) return;

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
          void_reason: reversalReason.trim() || 'Payment reversed by administrator',
          reason: reversalReason.trim() || 'Payment reversed by administrator',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to reverse payment');
      }

      showNotification('success', `Payment receipt ${reverseTargetPayment.receipt_number} reversed successfully.`);
      setReverseTargetPayment(null);
      setReversalReason('');
      await fetchData();
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSubmittingReversal(false);
    }
  };

  // Permanent Delete Execution (Permanently deletes challan and any attached receipt)
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
        throw new Error(data.error?.message || 'Failed to delete fee challan');
      }

      // Optimistically remove from state so nothing shows as deleted or cancelled
      setInvoices(prev => prev.filter(inv => inv.id !== deleteTargetChallan.id));
      setPayments(prev => prev.filter(pay => pay.invoice_id !== deleteTargetChallan.id));
      showNotification('success', 'Challan deleted.');
      setDeleteTargetChallan(null);
      setDeleteChallanReason('');
      await fetchData();
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSubmittingDeleteChallan(false);
    }
  };

  // KPI Calculations
  const totalInvoiced = useMemo(() => {
    return displayedInvoices.reduce((sum, inv) => sum + (inv.net_amount || 0), 0);
  }, [displayedInvoices]);

  const totalCollected = useMemo(() => {
    return displayedInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
  }, [displayedInvoices]);

  const totalDue = useMemo(() => {
    return displayedInvoices.reduce((sum, inv) => sum + (inv.balance_amount || 0), 0);
  }, [displayedInvoices]);

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeading
        title="Fee Reversals"
        description="Reverse collected receipts and delete fee challans with full institutional audit trail."
      />

      {/* Navigation Section Tabs */}
      <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs w-fit text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveSection('desk')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            activeSection === 'desk'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Fee Reversal Desk</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('logs')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            activeSection === 'logs'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <History className={`w-3.5 h-3.5 ${activeSection === 'logs' ? 'text-white' : 'text-slate-600'}`} />
          <span>Audit Logs & Remarks</span>
          <span
            className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded ${
              activeSection === 'logs' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {displayedLogs.length}
          </span>
        </button>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg text-xs font-semibold flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
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

      {/* ========================================================================= */}
      {/* SECTION 1: FULL-WIDTH FEE REVERSALS DESK */}
      {/* ========================================================================= */}
      {activeSection === 'desk' && (
        <div className="space-y-3">
          {/* Unified Full-Width Financial Register Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            {/* Header & Fast Search Bar */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-white space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div ref={searchContainerRef} className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by student name, admission #, challan #, receipt #..."
                    value={searchQuery}
                    onFocus={() => setIsSearchOpen(true)}
                    onClick={() => setIsSearchOpen(true)}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-900 transition-colors placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setIsSearchOpen(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Instant Autocomplete Dropdown for Direct Student Selection */}
                  {isSearchOpen && searchQuery.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {filteredStudents.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-500">
                          No students found matching "{searchQuery}".
                        </div>
                      ) : (
                        filteredStudents.map(student => {
                          const studInvs = invoices.filter(
                            i => i.student_id === student.id && i.status !== 'cancelled' && i.status !== 'voided'
                          );
                          const dueAmt = studInvs.reduce((sum, i) => sum + (i.balance_amount || 0), 0);
                          const isCurrent = student.id === selectedStudentId;

                          return (
                            <div
                              key={student.id}
                              onClick={() => {
                                setSelectedStudentId(student.id);
                                setSearchQuery('');
                                setIsSearchOpen(false);
                              }}
                              className={`p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                                isCurrent ? 'bg-indigo-50/60' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 uppercase">
                                  {student.full_name?.charAt(0) || 'S'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900 text-xs">{student.full_name}</span>
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-semibold">
                                      Adm #{student.admission_number || student.roll_number || '—'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                    {getProgramName(student.program_id)}
                                    {getBatchName(student.batch_id) ? ` • ${getBatchName(student.batch_id)}` : ''}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span
                                  className={`text-xs font-mono font-bold block ${
                                    dueAmt > 0 ? 'text-rose-600' : 'text-emerald-600'
                                  }`}
                                >
                                  {dueAmt > 0 ? `PKR ${dueAmt.toLocaleString()}` : 'No Dues'}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono block">
                                  {studInvs.length} Challan{studInvs.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible Overview & Filters Toggle Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 transition-colors shadow-2xs relative cursor-pointer text-xs font-semibold ${
                      showFilters
                        ? 'bg-[#081A2F] text-amber-400 border-[#173252]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                    title="Filters & Overview"
                    aria-label="Filters & Overview"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Overview</span>
                    {hasActiveFilters && (
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                    )}
                  </button>

                  <span className="text-xs font-mono text-slate-500 px-2 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                    <strong className="text-slate-900">{displayedInvoices.length}</strong>
                  </span>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="px-2.5 py-1.5 text-xs text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Reset all filters"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Active Single-Student Focused Filter Banner */}
              {selectedStudent && (
                <div className="flex items-center justify-between p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-indigo-900 text-[11px] font-semibold">Filtered to student:</span>
                    <strong className="text-slate-900">{selectedStudent.full_name}</strong>
                    <span className="px-1.5 py-0.2 rounded bg-white text-slate-800 font-mono font-semibold text-[10px] border border-indigo-200">
                      Adm #{selectedStudent.admission_number || selectedStudent.roll_number || '—'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-semibold text-[10px]">
                      {getProgramName(selectedStudent.program_id)}
                      {getBatchName(selectedStudent.batch_id) ? ` • Sec ${getBatchName(selectedStudent.batch_id)}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentId(null)}
                    className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Show All Students
                  </button>
                </div>
              )}

              {/* Collapsible Overview & Secondary Filters Container */}
              <div className={`${showFilters ? 'block' : 'hidden'} space-y-3 pt-2 border-t border-slate-100 animate-in fade-in duration-150`}>
                {/* Metric Strip (Sidebar Dark Navy Design) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-[#081A2F] border border-[#173252] rounded-xl p-3 shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                      Total Invoiced
                    </span>
                    <span className="text-sm sm:text-base font-mono font-bold text-white mt-0.5 block">
                      PKR {totalInvoiced.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
                      {isSameBillingMonth(selectedMonth, currentMonthName) ? 'Current Month' : selectedMonth === 'all' ? 'All Months' : selectedMonth}
                    </span>
                  </div>

                  <div className="bg-[#081A2F] border border-[#173252] rounded-xl p-3 shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                      Total Collected
                    </span>
                    <span className="text-sm sm:text-base font-mono font-bold text-emerald-400 mt-0.5 block">
                      PKR {totalCollected.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-emerald-300 mt-0.5 block truncate">
                      Realized Receipts
                    </span>
                  </div>

                  <div className="bg-[#081A2F] border border-[#173252] rounded-xl p-3 shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                      Outstanding Balance
                    </span>
                    <span
                      className={`text-sm sm:text-base font-mono font-bold mt-0.5 block ${
                        totalDue > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      PKR {totalDue.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
                      Unpaid Dues
                    </span>
                  </div>

                  <div className="bg-[#081A2F] border border-[#173252] rounded-xl p-3 shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                      Active Receipts
                    </span>
                    <span className="text-sm sm:text-base font-mono font-bold text-slate-200 mt-0.5 block">
                      {displayedPayments.length} Receipt{displayedPayments.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
                      Eligible for Reversal
                    </span>
                  </div>
                </div>

                {/* 5-Column Filter Controls Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {/* 1. Billing Month */}
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1 font-mono">
                      <Filter className="w-3 h-3 text-slate-400" />
                      Billing Month
                    </label>
                    <select
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-indigo-600 cursor-pointer"
                    >
                      {availableMonths.map(m => (
                        <option key={m} value={m}>
                          {m} {isSameBillingMonth(m, currentMonthName) ? '(Current Month)' : ''}
                        </option>
                      ))}
                      <option value="all">All Months</option>
                    </select>
                  </div>

                  {/* 2. Class / Program */}
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1 font-mono">
                      Class / Program
                    </label>
                    <select
                      value={selectedProgramId}
                      onChange={e => {
                        setSelectedProgramId(e.target.value);
                        setSelectedBatchId('all');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-indigo-600 cursor-pointer"
                    >
                      <option value="all">All Classes</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Section / Batch */}
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1 font-mono">
                      Section / Batch
                    </label>
                    <select
                      value={selectedBatchId}
                      onChange={e => setSelectedBatchId(e.target.value)}
                      disabled={filteredBatches.length === 0}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-indigo-600 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="all">All Sections</option>
                      {filteredBatches.map(b => (
                        <option key={b.id} value={b.id}>
                          Section {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Fee Status */}
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1 font-mono">
                      Fee Status
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={e => setSelectedStatus(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-indigo-600 cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="paid">Paid (Reversible Receipts)</option>
                      <option value="partially_paid">Partially Paid</option>
                      <option value="unpaid">Unpaid (Deletable Challans)</option>
                      <option value="reversed">Reversed Receipts</option>
                    </select>
                  </div>

                  {/* 5. Payment Method */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1 font-mono">
                      Payment Method
                    </label>
                    <select
                      value={selectedPaymentMethod}
                      onChange={e => setSelectedPaymentMethod(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-indigo-600 cursor-pointer"
                    >
                      <option value="all">All Methods</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer (IBFT)</option>
                      <option value="easypaisa">EasyPaisa</option>
                      <option value="jazzcash">JazzCash</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Register Data Table */}
            {displayedInvoices.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <p className="font-semibold text-slate-600">No fee records found matching the selected filters.</p>
                <p className="text-[11px] text-slate-400">
                  Try adjusting the billing month, class, or status filter, or reset your filters.
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold mt-2 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset All Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop 10-Column Master Register (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-600 uppercase tracking-wider font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Student</th>
                        <th className="py-2.5 px-3">Challan #</th>
                        <th className="py-2.5 px-3">Receipt #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3 text-right">Net Amount</th>
                        <th className="py-2.5 px-3 text-right">Paid Amount</th>
                        <th className="py-2.5 px-3 text-right">Balance Due</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {displayedInvoices.map(inv => {
                        const student = students.find(s => s.id === inv.student_id);
                        const linkedPayments = payments.filter(p => p.invoice_id === inv.id);
                        const activePayment = linkedPayments.find(p => p.status !== 'voided');
                        const voidedPayments = linkedPayments.filter(p => p.status === 'voided');

                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Student */}
                            <td className="py-2.5 px-3 font-sans whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold text-slate-700 text-xs shrink-0 uppercase">
                                  {student?.full_name?.charAt(0) || inv.student_name?.charAt(0) || 'S'}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedStudentId(inv.student_id)}
                                      className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors text-left cursor-pointer"
                                      title="Click to focus on this student"
                                    >
                                      {student?.full_name || inv.student_name}
                                    </button>
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                                      Adm #{inv.admission_number || student?.admission_number || inv.roll_number || student?.roll_number || '—'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {getProgramName(inv.program_id || student?.program_id)}
                                    {getBatchName(inv.batch_id || student?.batch_id) ? ` • ${getBatchName(inv.batch_id || student?.batch_id)}` : ''}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Challan # */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-semibold text-slate-900 block">{inv.invoice_number}</span>
                              <span className="text-[10px] text-slate-500 font-sans block">{inv.billing_month}</span>
                            </td>

                            {/* Receipt # */}
                            <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                              {activePayment?.receipt_number || (voidedPayments.length > 0 ? `${voidedPayments[0].receipt_number} (Rev)` : '—')}
                            </td>

                            {/* Date */}
                            <td className="py-2.5 px-3 text-slate-600 font-sans whitespace-nowrap">
                              {activePayment?.payment_date || inv.issue_date || inv.due_date || '—'}
                            </td>

                            {/* Method */}
                            <td className="py-2.5 px-3 capitalize font-sans text-slate-600 whitespace-nowrap">
                              {activePayment ? activePayment.payment_method?.replace('_', ' ') : '—'}
                            </td>

                            {/* Net */}
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                              PKR {inv.net_amount.toLocaleString()}
                            </td>

                            {/* Paid */}
                            <td className="py-2.5 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                              PKR {(inv.paid_amount || 0).toLocaleString()}
                            </td>

                            {/* Balance */}
                            <td
                              className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${
                                inv.balance_amount > 0 ? 'text-rose-600' : 'text-emerald-600'
                              }`}
                            >
                              PKR {inv.balance_amount.toLocaleString()}
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3 text-center font-sans whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                                  inv.status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : inv.status === 'partially_paid'
                                    ? 'bg-amber-100 text-amber-800'
                                    : voidedPayments.length > 0
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {inv.status === 'unpaid' && voidedPayments.length > 0
                                  ? 'Reversed'
                                  : inv.status.replace('_', ' ')}
                              </span>
                            </td>

                            {/* Actions: Sleek Icon Buttons */}
                            <td className="py-2.5 px-3 text-right font-sans whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {activePayment && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReverseTargetPayment(activePayment);
                                      setReversalReason('');
                                    }}
                                    className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Reverse received payment"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteTargetChallan(inv);
                                    setDeleteChallanReason('');
                                  }}
                                  className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Permanently delete this fee challan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Flat Record Cards (< 768px) - Zero Card within Card */}
                <div className="md:hidden divide-y divide-slate-100">
                  {displayedInvoices.map(inv => {
                    const student = students.find(s => s.id === inv.student_id);
                    const linkedPayments = payments.filter(p => p.invoice_id === inv.id);
                    const activePayment = linkedPayments.find(p => p.status !== 'voided');
                    const voidedPayments = linkedPayments.filter(p => p.status === 'voided');

                    return (
                      <div key={inv.id} className="p-3.5 space-y-2">
                        {/* Top: Student & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold text-slate-700 text-xs shrink-0 uppercase">
                              {student?.full_name?.charAt(0) || inv.student_name?.charAt(0) || 'S'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-xs text-slate-900 truncate">
                                  {student?.full_name || inv.student_name}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  #{inv.admission_number || student?.admission_number || '—'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">
                                {getProgramName(inv.program_id || student?.program_id)}
                                {getBatchName(inv.batch_id || student?.batch_id) ? ` • ${getBatchName(inv.batch_id || student?.batch_id)}` : ''}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase shrink-0 ${
                              inv.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : inv.status === 'partially_paid'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : voidedPayments.length > 0
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {inv.status === 'unpaid' && voidedPayments.length > 0
                              ? 'Reversed'
                              : inv.status.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Challan & Receipt Info */}
                        <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span>Challan: <strong className="font-mono text-slate-800">{inv.invoice_number}</strong> ({inv.billing_month})</span>
                          {activePayment && (
                            <span>Receipt: <strong className="font-mono text-slate-800">{activePayment.receipt_number}</strong> ({activePayment.payment_method?.replace('_', ' ')})</span>
                          )}
                        </div>

                        {/* Financial Strip */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 font-mono">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">Net / Paid</span>
                            <span className="font-semibold text-slate-800">PKR {inv.net_amount.toLocaleString()}</span>
                            <span className="text-emerald-600 ml-1">({(inv.paid_amount || 0).toLocaleString()})</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-sans">Balance Due</span>
                            <span className={`font-semibold ${inv.balance_amount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              PKR {inv.balance_amount.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions: Sleek 32px Icon Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                          {activePayment && (
                            <button
                              type="button"
                              onClick={() => {
                                setReverseTargetPayment(activePayment);
                                setReversalReason('');
                              }}
                              className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center transition-colors cursor-pointer"
                              title="Reverse received payment"
                            >
                              <RotateCcw className="w-4 h-4 text-amber-700" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTargetChallan(inv);
                              setDeleteChallanReason('');
                            }}
                            className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center transition-colors cursor-pointer"
                            title="Delete fee challan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: FULL-WIDTH AUDIT LOGS & REMARKS REGISTER */}
      {/* ========================================================================= */}
      {activeSection === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          {/* Card Header: Title on left, Scope & Count & Reset on right */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Reversal & Deletion Audit Trail
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Full chronological ledger of administrative remarks and fee operations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Scope filter: All vs Student */}
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setLogsFilterScope('all')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    logsFilterScope === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Academy
                </button>
                <button
                  type="button"
                  disabled={!selectedStudentId}
                  onClick={() => setLogsFilterScope('student')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    logsFilterScope === 'student'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {selectedStudent ? selectedStudent.full_name : 'Selected Student'}
                </button>
              </div>

              <span className="text-xs font-mono text-slate-500 px-2.5 py-1 bg-slate-50 rounded border border-slate-200">
                <strong className="text-slate-900">{displayedLogs.length}</strong> record{displayedLogs.length !== 1 ? 's' : ''}
              </span>

              {hasActiveLogsFilters && (
                <button
                  type="button"
                  onClick={handleResetLogsFilters}
                  className="px-2.5 py-1 text-xs text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Dedicated Filter Toolbar Strip */}
          <div className="bg-slate-50/70 border-b border-slate-200/80 p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* 1. Search Box */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1 font-mono">
                  Search Logs
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter by student, admission #, ref #, remarks..."
                    value={logsSearchQuery}
                    onChange={e => setLogsSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-indigo-600 text-slate-900 placeholder:text-slate-400"
                  />
                  {logsSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setLogsSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Billing Month (Defaults to Current Month) */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1 font-mono">
                  <Filter className="w-3 h-3 text-slate-400" />
                  Month
                </label>
                <select
                  value={logsMonthFilter}
                  onChange={e => setLogsMonthFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 font-medium focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m}>
                      {m} {isSameBillingMonth(m, currentMonthName) ? '(Current Month)' : ''}
                    </option>
                  ))}
                  <option value="all">All Months</option>
                </select>
              </div>

              {/* 3. Class / Program Filter */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1 font-mono">
                  Class / Program
                </label>
                <select
                  value={logsProgramFilter}
                  onChange={e => setLogsProgramFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 font-medium focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="all">All Classes</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Operation Type Filter */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1 font-mono">
                  Operation
                </label>
                <select
                  value={logsActionFilter}
                  onChange={e => setLogsActionFilter(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 font-medium focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="all">All Operations</option>
                  <option value="reversal">Payment Reversals</option>
                  <option value="deletion">Challan Deletions</option>
                </select>
              </div>
            </div>
          </div>

          {/* High-Density Audit Table */}
          {displayedLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600">No audit log records found matching selected filters.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Try selecting "All Months" or resetting filters if the operation was performed in another period.
              </p>
              {hasActiveLogsFilters && (
                <button
                  type="button"
                  onClick={handleResetLogsFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold mt-3 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono">
                  <tr>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Operation</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Adm #</th>
                    <th className="py-2.5 px-3">Reference #</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Reason / Remarks</th>
                    <th className="py-2.5 px-3 text-right">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {displayedLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-sans whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                            log.action === 'reversal'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {log.action === 'reversal' ? 'Reversal' : 'Deletion'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900 whitespace-nowrap">
                        {log.student_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {log.admission_number || log.roll_number || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                        {log.reference_number}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        PKR {Number(log.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-sans max-w-xs">
                        <div className="flex items-start gap-1.5 p-1.5 bg-slate-50 rounded border border-slate-200/80 text-[11px] text-slate-800">
                          <MessageSquare className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                          <span className="italic">{log.reason || 'No remarks recorded'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans text-slate-500 whitespace-nowrap">
                        {log.performed_by || 'Admin'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REVERSE PAYMENT RECEIPT */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL: REVERSE PAYMENT RECEIPT */}
      {/* ========================================================================= */}
      {reverseTargetPayment &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
            <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
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
                  type="button"
                  onClick={() => setReverseTargetPayment(null)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 space-y-1.5 text-xs text-amber-900">
                <div className="flex justify-between font-mono font-bold">
                  <span>Amount to Reverse:</span>
                  <span>PKR {reverseTargetPayment.amount_paid.toLocaleString()}</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Reversing receipt <strong>{reverseTargetPayment.receipt_number}</strong> will mark the receipt as reversed, restore PKR{' '}
                  {reverseTargetPayment.amount_paid.toLocaleString()} unpaid balance to the student's fee challan, and counter-balance the cashbook entry.
                </p>
              </div>

              <form onSubmit={handleConfirmReversal} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reason for Reversal (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={reversalReason}
                    onChange={e => setReversalReason(e.target.value)}
                    placeholder="Enter operational reason (optional, e.g. Cheque returned, wrong cashier entry, refund granted)..."
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600 text-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReverseTargetPayment(null)}
                    className="h-8.5 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReversal}
                    className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isSubmittingReversal ? 'Reversing...' : 'Confirm Reversal'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE FEE CHALLAN & RECEIPT (PERMANENT PURGE) */}
      {/* ========================================================================= */}
      {deleteTargetChallan &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
            <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-md w-full p-5 shadow-2xl border border-rose-200 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Delete Fee Challan</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Challan #{deleteTargetChallan.invoice_number} • {deleteTargetChallan.billing_month}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTargetChallan(null)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3.5 space-y-2 text-xs text-rose-900">
                <p className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Confirm Permanent Deletion</span>
                </p>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Deleting this fee will permanently remove Fee Challan <strong>{deleteTargetChallan.invoice_number}</strong> and any linked payment receipts.
                </p>
                <div className="p-2.5 bg-white/80 rounded-md border border-rose-200 space-y-1 font-mono text-[11px] text-slate-700">
                  <div className="flex justify-between">
                    <span>Net Amount:</span>
                    <span className="font-bold">PKR {deleteTargetChallan.net_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paid Amount:</span>
                    <span className="font-bold text-emerald-700">PKR {(deleteTargetChallan.paid_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Balance Due:</span>
                    <span className="font-bold text-rose-600">PKR {deleteTargetChallan.balance_amount.toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-[10px] text-rose-700">
                  The fee record for this student will be completely wiped out.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Deletion (Optional)
                </label>
                <input
                  type="text"
                  value={deleteChallanReason}
                  onChange={e => setDeleteChallanReason(e.target.value)}
                  placeholder="e.g., Generated in error, revised challan issued, fee cancelled..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteTargetChallan(null)}
                  className="h-8.5 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteChallan}
                  disabled={isSubmittingDeleteChallan}
                  className="h-8.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isSubmittingDeleteChallan ? 'Deleting...' : 'Delete Fee'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
