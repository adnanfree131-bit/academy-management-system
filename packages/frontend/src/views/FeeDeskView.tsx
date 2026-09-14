import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Receipt,
  Plus,
  Search,
  Printer,
  CreditCard,
  CheckCircle2,
  FileText,
  DollarSign,
  Download,
  Building2,
  X,
  RefreshCw,
  Edit2,
  Trash2,
  TrendingUp
} from 'lucide-react';
import { academyLetterheadFromAuth, buildSimpleStatementPdf, downloadPdfBytes } from '../lib/officialDocumentPdf';
import {
  FeeHead,
  StudentInvoice,
  PaymentDistributionItem,
  FeeDiscount,
  DailyCashbookEntry,
  StudentLedgerEntry,
  PaymentMethod
} from '@apex/shared-types';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';

export const FeeDeskView: React.FC = () => {
  const { token, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'invoices' | 'cashier' | 'discounts' | 'fee_heads' | 'reports'>('invoices');

  // Core Data
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [discounts, setDiscounts] = useState<FeeDiscount[]>([]);
  const [cashbook, setCashbook] = useState<DailyCashbookEntry[]>([]);
  const [headSummary, setHeadSummary] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [showBatchInvoiceModal, setShowBatchInvoiceModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showDiscountModal, setShowDiscountModal] = useState<boolean>(false);
  const [showBulkRevisionModal, setShowBulkRevisionModal] = useState<boolean>(false);
  const [activeInvoice, setActiveInvoice] = useState<StudentInvoice | null>(null);

  // Bulk Fee Revision Form State
  const [bulkRevScope, setBulkRevScope] = useState<'all' | 'program' | 'batch'>('all');
  const [bulkRevProgramId, setBulkRevProgramId] = useState<string>('');
  const [bulkRevBatchId, setBulkRevBatchId] = useState<string>('');
  const [bulkRevType, setBulkRevType] = useState<'percentage' | 'fixed'>('percentage');
  const [bulkRevValue, setBulkRevValue] = useState<number>(10);
  const [bulkRevRounding, setBulkRevRounding] = useState<'none' | 'nearest_50' | 'nearest_100'>('nearest_100');
  const [bulkRevReason, setBulkRevReason] = useState<string>('Annual Tuition Fee Revision');
  const [isSubmittingBulkRev, setIsSubmittingBulkRev] = useState<boolean>(false);

  // Void Payment State
  const [voidPaymentModal, setVoidPaymentModal] = useState<DailyCashbookEntry | null>(null);
  const [voidReasonText, setVoidReasonText] = useState<string>('');
  const [voidSubmitting, setVoidSubmitting] = useState<boolean>(false);

  // Form States
  const [newInvStudentId, setNewInvStudentId] = useState<string>('');
  const [newInvMonth, setNewInvMonth] = useState<string>(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const [newInvDueDate, setNewInvDueDate] = useState<string>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString().split('T')[0]);
  const [newInvNotes, setNewInvNotes] = useState<string>('');
  const [newInvCustomItems, setNewInvCustomItems] = useState<{ fee_head_id: string; amount: number }[]>([]);

  // Batch Invoicing Form
  const [batchInvBatchId, setBatchInvBatchId] = useState<string>('');
  const [batchInvMonth, setBatchInvMonth] = useState<string>(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const [batchInvDueDate, setBatchInvDueDate] = useState<string>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString().split('T')[0]);

  // Collection & Cashier Review Override Form
  const [collectionAmount, setCollectionAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [distributionItems, setDistributionItems] = useState<PaymentDistributionItem[]>([]);
  const [isOverrideActive, setIsOverrideActive] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [lastPaymentReceipt, setLastPaymentReceipt] = useState<any | null>(null);

  // Discount Form
  const [discountStudentId, setDiscountStudentId] = useState<string>('');
  const [discountInvoiceId, setDiscountInvoiceId] = useState<string>('');
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [discountReason, setDiscountReason] = useState<string>('');

  // Ledger Search
  const [ledgerStudentId, setLedgerStudentId] = useState<string>('');
  const [studentLedger, setStudentLedger] = useState<StudentLedgerEntry[]>([]);

  // Fee Heads Management State
  const [showHeadModal, setShowHeadModal] = useState<boolean>(false);
  const [editingHead, setEditingHead] = useState<FeeHead | null>(null);
  const [headForm, setHeadForm] = useState({
    name: '',
    code: '',
    default_amount: '' as number | '',
    priority_order: '' as number | '',
    show_at_admission: true,
  });
  const [isSavingHead, setIsSavingHead] = useState<boolean>(false);

  // Fetch Core Data
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [invRes, headsRes, discRes, cashRes, sumRes, studRes, batchRes, progRes] = await Promise.all([
        fetch('/api/v1/finance/invoices', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/heads', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/discounts', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/reports/cashbook', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/reports/fee-head-summary', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/sis/students', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/batches', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/programs', { headers: { authorization: `Bearer ${token}` } }),
      ]);

      if (invRes.ok) setInvoices((await invRes.json()).data || []);
      if (headsRes.ok) setFeeHeads((await headsRes.json()).data || []);
      if (discRes.ok) setDiscounts((await discRes.json()).data || []);
      if (cashRes.ok) setCashbook((await cashRes.json()).data || []);
      if (sumRes.ok) setHeadSummary((await sumRes.json()).data || []);
      if (studRes.ok) {
        const studList = (await studRes.json()).data || [];
        setStudents(studList);
        if (studList.length > 0) {
          setLedgerStudentId(prev => prev || studList[0].id);
        }
      }
      if (batchRes.ok) setBatches((await batchRes.json()).data || []);
      if (progRes && progRes.ok) setPrograms((await progRes.json()).data || []);
    } catch (err) {
      console.error('Failed to load fee data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Bulk Fee Revision Calculations
  const affectedStudents = useMemo(() => {
    return students.filter(s => {
      if (s.status !== 'active') return false;
      if (bulkRevScope === 'program' && bulkRevProgramId && s.program_id !== bulkRevProgramId) return false;
      if (bulkRevScope === 'batch' && bulkRevBatchId && s.batch_id !== bulkRevBatchId) return false;
      return true;
    });
  }, [students, bulkRevScope, bulkRevProgramId, bulkRevBatchId]);

  const totalCurrentTuition = useMemo(() => {
    return affectedStudents.reduce((acc, s) => {
      const fee = s.fee_structure?.net_tuition ?? s.fee_structure?.base_tuition ?? 0;
      return acc + Number(fee);
    }, 0);
  }, [affectedStudents]);

  const totalEstimatedNewTuition = useMemo(() => {
    return affectedStudents.reduce((acc, s) => {
      const base = Number(s.fee_structure?.base_tuition ?? 0);
      const net = Number(s.fee_structure?.net_tuition ?? base);
      let newBase = base;
      if (bulkRevType === 'percentage') {
        newBase = base * (1 + (bulkRevValue || 0) / 100);
      } else {
        newBase = base + (bulkRevValue || 0);
      }
      if (bulkRevRounding === 'nearest_50') newBase = Math.round(newBase / 50) * 50;
      else if (bulkRevRounding === 'nearest_100') newBase = Math.round(newBase / 100) * 100;
      else newBase = Math.round(newBase);

      const discount = Math.max(0, base - net);
      let newNet = newBase;
      if (s.fee_structure?.concession_type === 'percentage' && s.fee_structure?.concession_val) {
        newNet = Math.round(newBase * (1 - s.fee_structure.concession_val / 100));
      } else {
        newNet = Math.max(0, newBase - discount);
      }
      return acc + newNet;
    }, 0);
  }, [affectedStudents, bulkRevType, bulkRevValue, bulkRevRounding]);

  const handleExecuteBulkRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || affectedStudents.length === 0) return;

    setIsSubmittingBulkRev(true);
    try {
      const res = await fetch('/api/v1/finance/fees/bulk-increment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope: bulkRevScope,
          program_id: bulkRevScope === 'program' ? bulkRevProgramId : undefined,
          batch_id: bulkRevScope === 'batch' ? bulkRevBatchId : undefined,
          increment_type: bulkRevType,
          increment_value: bulkRevValue,
          rounding: bulkRevRounding,
          reason: bulkRevReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to execute bulk fee revision');

      setShowBulkRevisionModal(false);
      alert(`Successfully revised tuition fees for ${data.data?.count || affectedStudents.length} students.`);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingBulkRev(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Load student ledger when selected
  useEffect(() => {
    if (token && ledgerStudentId) {
      fetch(`/api/v1/finance/reports/student-ledger/${ledgerStudentId}`, {
        headers: { authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(res => setStudentLedger(res.data || []))
        .catch(err => console.error(err));
    }
  }, [token, ledgerStudentId]);

  // Handle Collection Selection & Trigger Live Auto-Distribution
  const handleOpenCollectModal = async (inv: StudentInvoice) => {
    setActiveInvoice(inv);
    const amountToPay = inv.balance_amount;
    setCollectionAmount(amountToPay);
    setIsOverrideActive(false);
    setOverrideReason('');
    setLastPaymentReceipt(null);

    // Call distribution preview
    try {
      const res = await fetch('/api/v1/finance/distribute-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: inv.id, amount: amountToPay })
      });
      const data = await res.json();
      if (data.success) {
        setDistributionItems(data.data || []);
      }
    } catch (err) {
      console.error('Failed to preview distribution:', err);
    }
    setActiveTab('cashier');
  };

  // Recalculate auto-distribution when cashier changes total amount
  const handleAmountChange = async (amt: number | '') => {
    setCollectionAmount(amt);
    if (!activeInvoice || !token) return;
    const numAmt = amt === '' ? 0 : amt;
    try {
      const res = await fetch('/api/v1/finance/distribute-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: activeInvoice.id, amount: numAmt })
      });
      const data = await res.json();
      if (data.success) {
        setDistributionItems(data.data || []);
        setIsOverrideActive(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Cashier manually edits distributed cell
  const handleEditAllocation = (headId: string, val: number) => {
    setIsOverrideActive(true);
    setDistributionItems(prev => prev.map(item => {
      if (item.fee_head_id === headId) {
        return { ...item, allocated_amount: val };
      }
      return item;
    }));
  };

  // Submit Payment with Cashier Review Committal
  const handleCommitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice || !token) return;

    const numCollectionAmount = Number(collectionAmount) || 0;
    const totalAllocated = distributionItems.reduce((s, i) => s + Number(i.allocated_amount), 0);
    if (Math.abs(totalAllocated - numCollectionAmount) > 0.05) {
      alert(`Allocated sum (${totalAllocated} PKR) must match collected amount (${numCollectionAmount} PKR)`);
      return;
    }

    if (isOverrideActive && !overrideReason.trim()) {
      alert('Please provide a brief reason remark explaining the manual cashier allocation override.');
      return;
    }

    try {
      const res = await fetch('/api/v1/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          invoice_id: activeInvoice.id,
          amount_paid: numCollectionAmount,
          payment_method: paymentMethod,
          reference_number: paymentReference || undefined,
          is_override: isOverrideActive,
          override_reason: isOverrideActive ? overrideReason : undefined,
          allocations: distributionItems
        })
      });

      const data = await res.json();
      if (data.success) {
        setLastPaymentReceipt(data.data.payment);
        fetchData();
      } else {
        alert(data.error?.message || 'Payment committal failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Void Payment Receipt
  const handleVoidPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidPaymentModal || !token) return;
    if (!voidReasonText.trim()) {
      alert('A valid administrative reason is mandatory to void a payment receipt.');
      return;
    }

    setVoidSubmitting(true);
    try {
      const res = await fetch(`/api/v1/finance/payments/${voidPaymentModal.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ void_reason: voidReasonText.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setVoidPaymentModal(null);
        setVoidReasonText('');
        fetchData();
      } else {
        alert(data.error?.message || 'Failed to void payment receipt');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while voiding receipt');
    } finally {
      setVoidSubmitting(false);
    }
  };

  // Fee Heads Management Handlers
  const handleOpenHeadModal = (head?: FeeHead) => {
    if (head) {
      setEditingHead(head);
      setHeadForm({
        name: head.name,
        code: head.code,
        default_amount: head.default_amount,
        priority_order: head.priority_order,
        show_at_admission: head.show_at_admission !== false,
      });
    } else {
      setEditingHead(null);
      const nextPriority = feeHeads.length > 0 ? Math.max(...feeHeads.map(h => h.priority_order || 0)) + 1 : 1;
      setHeadForm({
        name: '',
        code: '',
        default_amount: 0,
        priority_order: nextPriority,
        show_at_admission: true,
      });
    }
    setShowHeadModal(true);
  };

  const handleSaveFeeHead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !headForm.name.trim() || !headForm.code.trim()) return;

    setIsSavingHead(true);
    try {
      const url = editingHead 
        ? `/api/v1/finance/heads/${editingHead.id}`
        : '/api/v1/finance/heads';
      const method = editingHead ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: headForm.name.trim(),
          code: headForm.code.trim().toUpperCase(),
          default_amount: Number(headForm.default_amount) || 0,
          priority_order: Number(headForm.priority_order) || 1,
          show_at_admission: headForm.show_at_admission,
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowHeadModal(false);
        setEditingHead(null);
        await fetchData();
      } else {
        alert(data.error?.message || 'Failed to save fee head');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving fee head');
    } finally {
      setIsSavingHead(false);
    }
  };

  const handleToggleShowAtAdmission = async (head: FeeHead) => {
    if (!token) return;
    const nextVal = !(head.show_at_admission !== false);
    // Optimistic UI update
    setFeeHeads(prev => prev.map(h => h.id === head.id ? { ...h, show_at_admission: nextVal } : h));

    try {
      const res = await fetch(`/api/v1/finance/heads/${head.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ show_at_admission: nextVal })
      });
      const data = await res.json();
      if (!data.success) {
        setFeeHeads(prev => prev.map(h => h.id === head.id ? { ...h, show_at_admission: !nextVal } : h));
        alert(data.error?.message || 'Failed to update setting');
      }
    } catch {
      setFeeHeads(prev => prev.map(h => h.id === head.id ? { ...h, show_at_admission: !nextVal } : h));
    }
  };

  const handleDeleteFeeHead = async (head: FeeHead) => {
    if (!token) return;
    if (head.code === 'TUITION') {
      alert('Monthly tuition is a core institutional head and cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete fee head "${head.name}" (${head.code})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/finance/heads/${head.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(data.error?.message || 'Failed to delete fee head');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting fee head');
    }
  };

  // Submit Single Invoice Generation
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newInvStudentId) return;

    try {
      const res = await fetch('/api/v1/finance/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          student_id: newInvStudentId,
          billing_month: newInvMonth,
          due_date: newInvDueDate,
          custom_items: newInvCustomItems.length > 0 ? newInvCustomItems : undefined,
          notes: newInvNotes || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowGenerateModal(false);
        fetchData();
      } else {
        alert(data.error?.message || 'Invoice generation failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Batch Invoicing
  const handleBatchInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !batchInvBatchId) return;

    try {
      const res = await fetch('/api/v1/finance/invoices/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          batch_id: batchInvBatchId,
          billing_month: batchInvMonth,
          due_date: batchInvDueDate
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`Successfully generated ${data.data.length} monthly fee vouchers for the batch.`);
        setShowBatchInvoiceModal(false);
        fetchData();
      } else {
        alert(data.error?.message || 'Batch generation failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Ad-Hoc Discount
  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !discountStudentId) return;

    if (!discountReason.trim()) {
      alert('Mandatory approval remarks are required to audit fee concessions.');
      return;
    }

    try {
      const res = await fetch('/api/v1/finance/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          student_id: discountStudentId,
          invoice_id: discountInvoiceId || undefined,
          discount_type: discountType,
          discount_value: Number(discountValue),
          mandatory_reason: discountReason
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('Concession applied and registered in the financial audit ledger.');
        setShowDiscountModal(false);
        setDiscountReason('');
        fetchData();
      } else {
        alert(data.error?.message || 'Concession application failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtered Invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesBatch = selectedBatch === 'all' || inv.batch_id === selectedBatch;
    return matchesSearch && matchesStatus && matchesBatch;
  });

  // KPI Calculations
  const totalBilled = invoices.reduce((s, i) => s + i.net_amount, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.paid_amount, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.balance_amount, 0);
  const unpaidCount = invoices.filter(i => i.status === 'unpaid' || i.status === 'partially_paid').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeading
        title="Fee Ledger"
        description="Issue monthly fee vouchers, record payments, manage concessions, and print challans."
        icon={<Receipt className="w-4 h-4 text-slate-700" />}
      >
        <button
          onClick={() => setShowBulkRevisionModal(true)}
          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5"
          title="Adjust tuition fees globally or by class/section"
        >
          <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
          Bulk Fee Revision
        </button>
        <button
          onClick={() => setShowBatchInvoiceModal(true)}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5"
        >
          <Building2 className="w-3.5 h-3.5" />
          Batch Invoicing
        </button>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New Invoice
        </button>
      </PageHeading>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">Total Invoiced</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{totalBilled.toLocaleString()} <span className="text-xs text-slate-400 font-normal">PKR</span></p>
          <p className="text-[11px] text-slate-400 mt-0.5">{invoices.length} Vouchers Issued</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] font-mono text-emerald-600 uppercase tracking-wider font-semibold">Total Collected</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{totalCollected.toLocaleString()} <span className="text-xs text-slate-400 font-normal">PKR</span></p>
          <p className="text-[11px] text-slate-400 mt-0.5">{cashbook.length} Direct Receipts</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] font-mono text-amber-600 uppercase tracking-wider font-semibold">Outstanding Dues</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{totalOutstanding.toLocaleString()} <span className="text-xs text-slate-400 font-normal">PKR</span></p>
          <p className="text-[11px] text-amber-600/80 mt-0.5">{unpaidCount} Pending Vouchers</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <p className="text-[11px] font-mono text-indigo-600 uppercase tracking-wider font-semibold">Concessions Audited</p>
          <p className="text-xl font-bold text-indigo-600 mt-1">{discounts.reduce((s, d) => s + d.actual_discount_amount, 0).toLocaleString()} <span className="text-xs text-slate-400 font-normal">PKR</span></p>
          <p className="text-[11px] text-slate-400 mt-0.5">{discounts.length} Approved Grants</p>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-4 sm:gap-6 text-sm font-medium overflow-x-auto no-scrollbar whitespace-nowrap">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'invoices' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Invoices & Challans
          {activeTab === 'invoices' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />}
        </button>
        <button
          onClick={() => setActiveTab('cashier')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'cashier' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Cashier Collection
          {activeTab === 'cashier' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />}
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'discounts' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Concessions
          {activeTab === 'discounts' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />}
        </button>
        <button
          onClick={() => setActiveTab('fee_heads')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'fee_heads' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Fee Heads & Admission
          {activeTab === 'fee_heads' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'reports' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Reports
          {activeTab === 'reports' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />}
        </button>
      </div>

      {/* TAB 1: INVOICES & CHALLANS */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-700"
              >
                <option value="all">All Payment Statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
              </select>

              <select
                value={selectedBatch}
                onChange={e => setSelectedBatch(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-700"
              >
                <option value="all">All Academic Batches</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <button
                onClick={fetchData}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3.5">Invoice #</th>
                    <th className="py-2.5 px-3.5">Student & Batch</th>
                    <th className="py-2.5 px-3.5">Billing Month</th>
                    <th className="py-2.5 px-3.5">Heads Breakdown</th>
                    <th className="py-2.5 px-3.5 text-right">Net Billed</th>
                    <th className="py-2.5 px-3.5 text-right">Paid / Balance</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">Loading invoices...</td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">No fee invoices found.</td>
                    </tr>
                  ) : (
                    filteredInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-semibold text-indigo-900">{inv.invoice_number}</td>
                        <td className="py-3 px-3.5">
                          <p className="font-bold text-slate-900">{inv.student_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">Roll: {inv.roll_number} • {inv.batch_name}</p>
                        </td>
                        <td className="py-3 px-3.5">
                          <p className="font-medium text-slate-800">{inv.billing_month}</p>
                          <p className="text-[10px] text-slate-400">Due: {inv.due_date}</p>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {inv.items.map(it => (
                              <span key={it.id} className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 font-mono">
                                {it.head_code}: {it.net_amount}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-slate-900 font-mono">
                          {inv.net_amount.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">PKR</span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono">
                          <p className="text-emerald-600 font-semibold">{inv.paid_amount.toLocaleString()}</p>
                          <p className="text-amber-600 font-bold">{inv.balance_amount.toLocaleString()}</p>
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                            inv.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.status === 'partially_paid'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {inv.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {inv.status !== 'paid' && (
                              <button
                                onClick={() => handleOpenCollectModal(inv)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] rounded transition-colors"
                              >
                                Collect
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setActiveInvoice(inv);
                                setShowPrintModal(true);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] rounded transition-colors"
                              title="Print 3-Part Challan"
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
        </div>
      )}

      {/* TAB 2: CASHIER COLLECTION & SMART AUTO-DISTRIBUTION */}
      {activeTab === 'cashier' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                Select Pending Challan
              </h2>
              <p className="text-xs text-slate-500">Pick an active invoice to initiate review-governed collection.</p>
              
              <div className="space-y-2">
                {invoices.filter(i => i.status !== 'paid').map(inv => (
                  <div
                    key={inv.id}
                    onClick={() => handleOpenCollectModal(inv)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      activeInvoice?.id === inv.id
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-xs text-slate-900">{inv.student_name}</p>
                      <span className="font-mono text-[10px] text-indigo-700 font-bold">{inv.invoice_number}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">Roll: {inv.roll_number} • {inv.billing_month}</p>
                    <div className="mt-2 flex justify-between items-center text-xs">
                      <span className="text-slate-400 text-[11px]">Due Balance:</span>
                      <span className="font-bold font-mono text-amber-700">{inv.balance_amount.toLocaleString()} PKR</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            {activeInvoice ? (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5">
                <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Review & Distribution Console</h2>
                    <p className="text-xs text-slate-500 font-mono">
                      Invoice: {activeInvoice.invoice_number} • Student: {activeInvoice.student_name} ({activeInvoice.roll_number})
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Outstanding Balance</p>
                    <p className="text-lg font-bold font-mono text-rose-600">{activeInvoice.balance_amount.toLocaleString()} PKR</p>
                  </div>
                </div>

                <form onSubmit={handleCommitPayment} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Payment Received (PKR)</label>
                      <input
                        type="number"
                        min="1"
                        max={activeInvoice.balance_amount * 2}
                        value={collectionAmount}
                        onChange={e => handleAmountChange(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                      >
                        <option value="cash">Cash (Counter)</option>
                        <option value="bank_transfer">Online Bank Transfer</option>
                        <option value="cheque">Bank Cheque</option>
                        <option value="wallet">Student Wallet Balance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Reference / Slip #</label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={e => setPaymentReference(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Priority Auto-Distribution Review Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 p-2.5 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        Payment Allocation Order (Review & Manual Override)
                      </span>
                      {isOverrideActive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Single-Transaction Override Active
                        </span>
                      )}
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/50 text-[11px] font-mono text-slate-500 uppercase border-b border-slate-100">
                        <tr>
                          <th className="py-2 px-3">Fee Head</th>
                          <th className="py-2 px-3 text-right">Head Balance</th>
                          <th className="py-2 px-3 text-right">Allocated Amount (PKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {distributionItems.map(item => {
                          const originalItem = activeInvoice.items.find(i => i.fee_head_id === item.fee_head_id);
                          return (
                            <tr key={item.fee_head_id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-medium text-slate-800">{item.head_name}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-500">
                                {originalItem?.balance_due?.toLocaleString() || 0}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.allocated_amount}
                                  onChange={e => handleEditAllocation(item.fee_head_id, Number(e.target.value))}
                                  className="w-28 px-2 py-1 text-right font-mono font-bold bg-white border border-slate-300 rounded focus:border-indigo-600 focus:outline-none"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td className="py-2.5 px-3">Total Allocated</td>
                          <td></td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm text-indigo-700">
                            {distributionItems.reduce((s, i) => s + Number(i.allocated_amount), 0).toLocaleString()} PKR
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {isOverrideActive && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                      <label className="block text-xs font-bold text-amber-900">
                        Override Reason (Mandatory for custom cashier allocations):
                      </label>
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded focus:outline-none focus:border-amber-600"
                        required
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm & Collect Fee
                    </button>
                  </div>
                </form>

                {lastPaymentReceipt && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Payment Recorded Successfully!
                      </span>
                      <span className="font-mono font-bold text-xs text-emerald-900">{lastPaymentReceipt.receipt_number}</span>
                    </div>
                    <p className="text-xs text-emerald-700">
                      Amount: {lastPaymentReceipt.amount_paid.toLocaleString()} PKR • Method: {lastPaymentReceipt.payment_method.toUpperCase()} • Collector: {lastPaymentReceipt.collected_by}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs">
                <Receipt className="w-8 h-8 mb-2 opacity-50" />
                Select a pending challan from the list on the left to review and collect.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AD-HOC CONCESSIONS & AUDIT LEDGER */}
      {activeTab === 'discounts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Ad-Hoc Concessions & Waivers</h2>
              <p className="text-xs text-slate-500">Apply discretionary fee discounts with strictly audited approval remarks.</p>
            </div>
            <button
              onClick={() => setShowDiscountModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Apply Concession
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3.5">Student Name</th>
                  <th className="py-2.5 px-3.5">Roll No</th>
                  <th className="py-2.5 px-3.5">Concession Type</th>
                  <th className="py-2.5 px-3.5 text-right">Waiver Amount</th>
                  <th className="py-2.5 px-3.5">Mandatory Audit Remark</th>
                  <th className="py-2.5 px-3.5">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {discounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">No concessions recorded.</td>
                  </tr>
                ) : (
                  discounts.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3.5 text-slate-400 font-mono">{d.applied_at.split('T')[0]}</td>
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">{d.student_name}</td>
                      <td className="py-2.5 px-3.5 font-mono text-slate-500">{d.roll_number}</td>
                      <td className="py-2.5 px-3.5">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 text-slate-700 font-bold uppercase">
                          {d.discount_type} ({d.discount_value})
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-rose-600">
                        -{d.actual_discount_amount.toLocaleString()} PKR
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-700 italic max-w-xs">{d.mandatory_reason}</td>
                      <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">{d.approved_by}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: FEE HEADS MANAGEMENT & ADMISSION SELECTOR */}
      {activeTab === 'fee_heads' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Institutional Fee Heads & Admission Configuration
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Manage dynamic institutional fee heads, default rate schedules, liquidation priority, and select which fee heads appear during student admission.
              </p>
            </div>
            <button
              onClick={() => handleOpenHeadModal()}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap ml-auto sm:ml-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Fee Head</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Fee Head Particulars</th>
                    <th className="py-3 px-4">Head Code</th>
                    <th className="py-3 px-4 text-right">Default Amount</th>
                    <th className="py-3 px-4 text-center">Liquidation Priority</th>
                    <th className="py-3 px-4 text-center">Show at Admission Desk</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {feeHeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No fee heads found.
                      </td>
                    </tr>
                  ) : (
                    feeHeads.map(head => (
                      <tr key={head.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{head.name}</div>
                          {head.code === 'TUITION' && (
                            <span className="text-[10px] text-indigo-600 font-medium font-mono">Core Monthly Schedule</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[11px] border border-slate-200">
                            {head.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {head.default_amount.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">PKR</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-slate-600">
                          #{head.priority_order}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleShowAtAdmission(head)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 transition-colors border ${
                              head.show_at_admission !== false
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Click to toggle whether this fee head appears on the admission form"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${head.show_at_admission !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <span>{head.show_at_admission !== false ? 'Active at Admission' : 'Hidden at Admission'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenHeadModal(head)}
                              className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors border border-slate-200 hover:border-indigo-200"
                              title="Edit Fee Head"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {head.code !== 'TUITION' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteFeeHead(head)}
                                className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition-colors border border-slate-200 hover:border-rose-200"
                                title="Delete Fee Head"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FINANCIAL REPORTS & LEDGERS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Daily Cashbook Register */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Daily Cashbook Register (Today's Collections)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Receipt #</th>
                    <th className="py-2 px-3">Student Name</th>
                    <th className="py-2 px-3">Roll No</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3 text-right">Amount (PKR)</th>
                    <th className="py-2 px-3">Cashier</th>
                    <th className="py-2 px-3 text-right">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashbook.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-slate-400">No collections for today yet.</td>
                    </tr>
                  ) : (
                    cashbook.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-500">{c.date}</td>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-700">{c.receipt_number}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{c.student_name}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{c.roll_number}</td>
                        <td className="py-2 px-3 font-mono uppercase text-[10px] text-slate-600">{c.payment_method}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                          {c.status === 'voided' ? (
                            <span className="line-through text-slate-400">{c.amount.toLocaleString()}</span>
                          ) : (
                            c.amount.toLocaleString()
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">{c.collected_by}</td>
                        <td className="py-2 px-3 text-right">
                          {c.status === 'voided' ? (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200"
                              title={c.void_reason || 'Receipt Voided'}
                            >
                              VOIDED
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidPaymentModal(c);
                                setVoidReasonText('');
                              }}
                              className="px-2 py-0.5 text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded transition-colors"
                            >
                              Void Receipt
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Student Running Ledger */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-600" />
                  Student Ledger Statement (Running Balance)
                </h2>
                <p className="text-xs text-slate-500">Bank-style running statement tracking debits, credits, and balance.</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={ledgerStudentId}
                  onChange={e => setLedgerStudentId(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.roll_number})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    const academy = await academyLetterheadFromAuth(tenant);
                    const student = students.find(s => s.id === ledgerStudentId);
                    const bytes = await buildSimpleStatementPdf({
                      title: 'Student Fee Ledger',
                      academy,
                      identity: [
                        { label: 'Student', value: student?.full_name || '—' },
                        { label: 'Roll No', value: student?.roll_number || '—' },
                        { label: 'Entries', value: String(studentLedger.length) },
                      ],
                      columns: [
                        { key: 'date', label: 'Date', width: 80 },
                        { key: 'description', label: 'Description', width: 200 },
                        { key: 'debit', label: 'Debit', width: 70, align: 'right' },
                        { key: 'credit', label: 'Credit', width: 70, align: 'right' },
                        { key: 'balance', label: 'Balance', width: 80, align: 'right' },
                      ],
                      rows: studentLedger.map(l => ({
                        date: l.date,
                        description: l.description,
                        debit: l.debit ? l.debit.toLocaleString() : '—',
                        credit: l.credit ? l.credit.toLocaleString() : '—',
                        balance: l.running_balance.toLocaleString(),
                      })),
                    });
                    await downloadPdfBytes(bytes, `ledger-${student?.roll_number || 'student'}.pdf`);
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg"
                >
                  Download ledger
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Debit (Invoiced)</th>
                    <th className="py-2 px-3 text-right">Credit (Paid)</th>
                    <th className="py-2 px-3 text-right">Running Balance (PKR)</th>
                    <th className="py-2 px-3">Ref #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">No ledger transactions found for student.</td>
                    </tr>
                  ) : (
                    studentLedger.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-500">{l.date}</td>
                        <td className="py-2 px-3 text-slate-800">{l.description}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-600">{l.debit > 0 ? l.debit.toLocaleString() : '-'}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-600">{l.credit > 0 ? l.credit.toLocaleString() : '-'}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{l.running_balance.toLocaleString()}</td>
                        <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">{l.reference}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fee Head Revenue Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-indigo-600" />
              Fee Head Collection Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase">
                  <tr>
                    <th className="py-2 px-3">Fee Head Name</th>
                    <th className="py-2 px-3 text-right">Total Billed</th>
                    <th className="py-2 px-3 text-right">Total Collected</th>
                    <th className="py-2 px-3 text-right">Outstanding Dues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {headSummary.map(h => (
                    <tr key={h.fee_head_id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-800">{h.head_name}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-900">{h.total_billed.toLocaleString()} PKR</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-600 font-semibold">{h.total_collected.toLocaleString()} PKR</td>
                      <td className="py-2 px-3 text-right font-mono text-rose-600 font-bold">{h.outstanding_balance.toLocaleString()} PKR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: GENERATE SINGLE INVOICE */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo title="New Invoice" description="Generate monthly fee voucher for student" />
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Student</label>
                <select
                  value={newInvStudentId}
                  onChange={e => setNewInvStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                  required
                >
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.roll_number})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Billing Month</label>
                  <input
                    type="text"
                    value={newInvMonth}
                    onChange={e => setNewInvMonth(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newInvDueDate}
                    onChange={e => setNewInvDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Custom Fee Heads (Optional Override)</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  {feeHeads.map(head => {
                    const active = newInvCustomItems.find(i => i.fee_head_id === head.id);
                    return (
                      <div key={head.id} className="flex justify-between items-center text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!active}
                            onChange={e => {
                              if (e.target.checked) {
                                setNewInvCustomItems([...newInvCustomItems, { fee_head_id: head.id, amount: head.default_amount || 0 }]);
                              } else {
                                setNewInvCustomItems(newInvCustomItems.filter(i => i.fee_head_id !== head.id));
                              }
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span>{head.name} ({head.code})</span>
                        </label>
                        {active && (
                          <input
                            type="number"
                            min="0"
                            value={active.amount}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setNewInvCustomItems(newInvCustomItems.map(i => i.fee_head_id === head.id ? { ...i, amount: val } : i));
                            }}
                            className="w-24 px-2 py-0.5 text-right font-mono bg-white border border-slate-300 rounded text-xs"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Internal Notes</label>
                <input
                  type="text"
                  value={newInvNotes}
                  onChange={e => setNewInvNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BATCH INVOICING */}
      {showBatchInvoiceModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo title="Batch Invoicing" description="Generate monthly fee vouchers for all students in a batch" />
              <button onClick={() => setShowBatchInvoiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBatchInvoice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Batch</label>
                <select
                  value={batchInvBatchId}
                  onChange={e => setBatchInvBatchId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                  required
                >
                  <option value="">-- Choose Batch --</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.academic_session})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Billing Month</label>
                <input
                  type="text"
                  value={batchInvMonth}
                  onChange={e => setBatchInvMonth(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={batchInvDueDate}
                  onChange={e => setBatchInvDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchInvoiceModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  Generate for Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2.5: BULK FEE REVISION */}
      {showBulkRevisionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[92vh] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Bulk Tuition Fee Revision</h3>
                    <p className="text-[11px] text-slate-500">Institutional adjustment of student baseline tuition fees</p>
                  </div>
                </div>
                <button onClick={() => setShowBulkRevisionModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleExecuteBulkRevision} id="bulkRevForm" className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pr-1">
                {/* 1. Revision Scope */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Target Cohort Scope</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'all', label: 'Entire Academy' },
                      { id: 'program', label: 'Specific Class' },
                      { id: 'batch', label: 'Specific Section' },
                    ].map(tab => (
                      <button
                        type="button"
                        key={tab.id}
                        onClick={() => {
                          setBulkRevScope(tab.id as any);
                          if (tab.id === 'program' && programs.length > 0 && !bulkRevProgramId) {
                            setBulkRevProgramId(programs[0].id);
                          }
                          if (tab.id === 'batch' && batches.length > 0 && !bulkRevBatchId) {
                            setBulkRevBatchId(batches[0].id);
                          }
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                          bulkRevScope === tab.id
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {bulkRevScope === 'program' && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Select Academic Class</label>
                      <select
                        value={bulkRevProgramId}
                        onChange={e => setBulkRevProgramId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                        required
                      >
                        <option value="" disabled>-- Select Class --</option>
                        {programs.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {bulkRevScope === 'batch' && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Select Section / Batch</label>
                      <select
                        value={bulkRevBatchId}
                        onChange={e => setBulkRevBatchId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                        required
                      >
                        <option value="" disabled>-- Select Section --</option>
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.academic_session})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 2. Adjustment Type & Value */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Method</label>
                    <select
                      value={bulkRevType}
                      onChange={e => setBulkRevType(e.target.value as 'percentage' | 'fixed')}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                    >
                      <option value="percentage">Percentage Hike (+%)</option>
                      <option value="fixed">Fixed Increment (+PKR)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {bulkRevType === 'percentage' ? 'Hike Percentage (%)' : 'Increment Amount (PKR)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={bulkRevType === 'percentage' ? 0.5 : 50}
                      value={bulkRevValue}
                      onChange={e => setBulkRevValue(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                      required
                    />
                  </div>
                </div>

                {/* 3. Rounding & Reason */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Rounding Rule</label>
                    <select
                      value={bulkRevRounding}
                      onChange={e => setBulkRevRounding(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                    >
                      <option value="nearest_100">Round to Nearest 100 PKR</option>
                      <option value="nearest_50">Round to Nearest 50 PKR</option>
                      <option value="none">Exact Calculation (No Rounding)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Audit Justification</label>
                    <input
                      type="text"
                      value={bulkRevReason}
                      onChange={e => setBulkRevReason(e.target.value)}
                      placeholder="e.g. Annual Tuition Fee Revision"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                      required
                    />
                  </div>
                </div>

                {/* 4. Financial Simulation Preview */}
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900 border-b border-indigo-200/60 pb-2">
                    <span>Revenue Simulation Preview</span>
                    <span className="font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                      {affectedStudents.length} Active Students
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Current Monthly</span>
                      <span className="font-bold text-slate-900">PKR {totalCurrentTuition.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Projected Monthly</span>
                      <span className="font-bold text-emerald-700">PKR {totalEstimatedNewTuition.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Net Monthly Delta</span>
                      <span className="font-bold text-indigo-700">
                        +{Math.max(0, totalEstimatedNewTuition - totalCurrentTuition).toLocaleString()} PKR
                      </span>
                    </div>
                  </div>

                  {affectedStudents.length > 0 && (
                    <div className="text-[11px] text-slate-600 pt-1 border-t border-indigo-200/40">
                      Sample Student: <span className="font-bold text-slate-900">{affectedStudents[0].full_name}</span> • Current: PKR {Number(affectedStudents[0].fee_structure?.net_tuition || affectedStudents[0].fee_structure?.base_tuition || 0).toLocaleString()} → New: <strong className="text-emerald-700">PKR {Math.round((affectedStudents[0].fee_structure?.base_tuition || 0) * (bulkRevType === 'percentage' ? 1 + bulkRevValue / 100 : 1) + (bulkRevType === 'fixed' ? bulkRevValue : 0)).toLocaleString()}/mo</strong>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkRevisionModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="bulkRevForm"
                disabled={isSubmittingBulkRev || affectedStudents.length === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>
                  {isSubmittingBulkRev ? 'Applying Revision...' : `Apply Revision (${affectedStudents.length} Students)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: APPLY CONCESSION */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo title="Fee Concession" description="Grant approved scholarship or hardship fee reduction" />
              <button onClick={() => setShowDiscountModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyDiscount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Student</label>
                <select
                  value={discountStudentId}
                  onChange={e => setDiscountStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                  required
                >
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.roll_number})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Attach to Invoice (Optional)</label>
                <select
                  value={discountInvoiceId}
                  onChange={e => setDiscountInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                >
                  <option value="">-- Academy-Level Concession --</option>
                  {invoices.filter(i => !discountStudentId || i.student_id === discountStudentId).map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.invoice_number} ({inv.billing_month} - Balance: {inv.balance_amount.toLocaleString()} PKR)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
                  <select
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="flat">Flat PKR Amount</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Value</label>
                  <input
                    type="number"
                    min="1"
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Approval Remark <span className="text-rose-600 font-mono">*</span>
                </label>
                <textarea
                  rows={2}
                  value={discountReason}
                  onChange={e => setDiscountReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  Grant Concession
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VOID PAYMENT RECEIPT */}
      {voidPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo title="Void Receipt" description="Reverse payment receipt and restore invoice balance" />
              <button onClick={() => setVoidPaymentModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 space-y-1">
              <p className="font-semibold">Confirm Receipt Reversal:</p>
              <p>Receipt: <span className="font-mono font-bold">{voidPaymentModal.receipt_number}</span></p>
              <p>Student: <span className="font-semibold">{voidPaymentModal.student_name}</span> ({voidPaymentModal.roll_number})</p>
              <p>Amount: <span className="font-mono font-bold">PKR {voidPaymentModal.amount.toLocaleString()}</span> ({voidPaymentModal.payment_method.toUpperCase()})</p>
              <p className="text-[11px] text-rose-600 mt-1">This will restore the invoice balance and automatically post a reversing cashbook expense voucher.</p>
            </div>

            <form onSubmit={handleVoidPayment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Void Reason / Remarks <span className="text-rose-500 font-mono">*</span>
                </label>
                <textarea
                  value={voidReasonText}
                  onChange={e => setVoidReasonText(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                  rows={3}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVoidPaymentModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidSubmitting || !voidReasonText.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {voidSubmitting ? 'Voiding Receipt...' : 'Confirm Void & Reverse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: 3-PER-PAGE PRINTABLE FEE CHALLAN */}
      {showPrintModal && activeInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">3-Part Fee Challan (A4 Sheet Preview)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const academy = await academyLetterheadFromAuth(tenant);
                    const bytes = await buildSimpleStatementPdf({
                      title: 'Fee Challan',
                      academy,
                      identity: [
                        { label: 'Invoice', value: activeInvoice.invoice_number },
                        { label: 'Student', value: activeInvoice.student_name || '—' },
                        { label: 'Month', value: activeInvoice.billing_month },
                        { label: 'Due date', value: activeInvoice.due_date },
                        { label: 'Net payable', value: `PKR ${(activeInvoice.net_amount || activeInvoice.net_total || 0).toLocaleString()}` },
                        { label: 'Balance', value: `PKR ${(activeInvoice.balance_due ?? activeInvoice.balance_amount ?? 0).toLocaleString()}` },
                      ],
                      columns: [
                        { key: 'head', label: 'Fee head', width: 220 },
                        { key: 'original', label: 'Original', width: 90, align: 'right' },
                        { key: 'net', label: 'Net', width: 90, align: 'right' },
                        { key: 'balance', label: 'Balance', width: 90, align: 'right' },
                      ],
                      rows: (activeInvoice.items || []).map((it: any) => ({
                        head: it.head_name,
                        original: String(it.original_amount ?? 0),
                        net: String(it.net_amount ?? 0),
                        balance: String(it.balance_due ?? 0),
                      })),
                      footerNote: 'Bank copy · Academy copy · Student copy — present this challan at the fee counter or bank.',
                    });
                    await downloadPdfBytes(bytes, `challan-${activeInvoice.invoice_number}.pdf`);
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download official challan
                </button>
                <button id="close-print-modal-btn" onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Container: 3 Columns side-by-side (Bank Copy, Academy Copy, Student Copy) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border border-slate-300 p-4 rounded-xl bg-slate-50 print:bg-white print:border-none print:p-0">
              {['BANK COPY', 'ACADEMY COPY', 'STUDENT COPY'].map((copyTitle, idx) => (
                <div key={idx} className="bg-white border border-slate-300 p-3 rounded-lg flex flex-col justify-between text-[11px] space-y-2 shadow-2xs print:shadow-none">
                  <div className="space-y-1.5 border-b border-slate-200 pb-2 text-center">
                    <h4 className="font-black text-slate-900 tracking-tight text-xs uppercase">{tenant?.name || 'ACADEMY PORTAL'}</h4>
                    <p className="text-[9px] text-slate-500 font-mono">{tenant?.campus_name || 'Main Campus'} • Official Fee Challan</p>
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[9px] font-bold tracking-wider">
                      {copyTitle}
                    </span>
                  </div>

                  <div className="space-y-1 text-[10px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Challan #:</span>
                      <span className="font-bold text-slate-900">{activeInvoice.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Month:</span>
                      <span className="font-bold text-slate-900">{activeInvoice.billing_month}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Due Date:</span>
                      <span className="font-bold text-rose-600">{activeInvoice.due_date}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1">
                      <span className="text-slate-500">Student:</span>
                      <span className="font-bold text-slate-900 truncate">{activeInvoice.student_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Roll No:</span>
                      <span className="font-bold text-slate-900">{activeInvoice.roll_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Batch:</span>
                      <span className="font-semibold text-slate-700 truncate">{activeInvoice.batch_name}</span>
                    </div>
                  </div>

                  <table className="w-full text-left text-[10px] border border-slate-200 mt-1">
                    <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[9px]">
                      <tr>
                        <th className="py-1 px-1.5">Head</th>
                        <th className="py-1 px-1.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {activeInvoice.items.map(it => (
                        <tr key={it.id}>
                          <td className="py-0.5 px-1.5 text-slate-700 truncate">{it.head_name}</td>
                          <td className="py-0.5 px-1.5 text-right">{it.net_amount.toLocaleString()}</td>
                        </tr>
                      ))}
                      {activeInvoice.discount_amount > 0 && (
                        <tr className="text-rose-600">
                          <td className="py-0.5 px-1.5">Concession / Waiver</td>
                          <td className="py-0.5 px-1.5 text-right">-{activeInvoice.discount_amount.toLocaleString()}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold font-mono text-[10px] border-t border-slate-200">
                      <tr>
                        <td className="py-1 px-1.5">Net Payable:</td>
                        <td className="py-1 px-1.5 text-right text-indigo-900">{activeInvoice.net_amount.toLocaleString()} PKR</td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="pt-4 border-t border-dashed border-slate-200 text-[9px] text-slate-400 space-y-4">
                    <div className="flex justify-between">
                      <span className="border-t border-slate-400 pt-0.5 px-2">Bank Officer Stamp</span>
                      <span className="border-t border-slate-400 pt-0.5 px-2">Depositor Signature</span>
                    </div>
                    <p className="text-center text-[8px] text-slate-400">Zero Late Fines Applied • Official Fee Voucher</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CREATE / EDIT FEE HEAD */}
      {showHeadModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo
                title={editingHead ? "Edit Fee Head" : "New Fee Head"}
                description="Configure billing head and admission desk visibility"
              />
              <button
                type="button"
                onClick={() => setShowHeadModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFeeHead} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Head Title / Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={headForm.name}
                  onChange={e => setHeadForm({ ...headForm, name: e.target.value })}
                  placeholder="e.g. Tuition Fee, Admission Fee, Lab Charges"
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    System Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={headForm.code}
                    onChange={e => setHeadForm({ ...headForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    placeholder="e.g. TUITION"
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg uppercase font-mono focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Default Amount (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={headForm.default_amount}
                    onChange={e => setHeadForm({ ...headForm, default_amount: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Allocation Priority Order
                </label>
                <input
                  type="number"
                  min="1"
                  value={headForm.priority_order}
                  onChange={e => setHeadForm({ ...headForm, priority_order: Number(e.target.value) || 1 })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-indigo-600"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Lower number = settled first when partial fee is received (e.g. 1 for Tuition, 2 for Exam).
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={headForm.show_at_admission}
                    onChange={e => setHeadForm({ ...headForm, show_at_admission: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Show in New Admission Form</span>
                    <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                      When active, this fee head appears as a selectable fee item on the student admission desk.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowHeadModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHead}
                  className="px-4 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {isSavingHead ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : editingHead ? (
                    'Update Head'
                  ) : (
                    'Create Fee Head'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
