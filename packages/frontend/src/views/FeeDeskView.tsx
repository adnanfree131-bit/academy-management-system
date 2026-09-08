import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Receipt,
  Plus,
  Search,
  Printer,
  CreditCard,
  Tag,
  CheckCircle2,
  FileText,
  DollarSign,
  Download,
  Building2,
  X,
  RefreshCw
} from 'lucide-react';
import {
  FeeHead,
  StudentInvoice,
  PaymentDistributionItem,
  FeeDiscount,
  DailyCashbookEntry,
  StudentLedgerEntry,
  PaymentMethod
} from '@apex/shared-types';

export const FeeDeskView: React.FC = () => {
  const { token, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'invoices' | 'cashier' | 'discounts' | 'reports'>('invoices');

  // Core Data
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [discounts, setDiscounts] = useState<FeeDiscount[]>([]);
  const [cashbook, setCashbook] = useState<DailyCashbookEntry[]>([]);
  const [headSummary, setHeadSummary] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
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
  const [activeInvoice, setActiveInvoice] = useState<StudentInvoice | null>(null);

  // Form States
  const [newInvStudentId, setNewInvStudentId] = useState<string>('');
  const [newInvMonth, setNewInvMonth] = useState<string>('October 2026');
  const [newInvDueDate, setNewInvDueDate] = useState<string>('2026-10-15');
  const [newInvNotes, setNewInvNotes] = useState<string>('');
  const [newInvCustomItems, setNewInvCustomItems] = useState<{ fee_head_id: string; amount: number }[]>([]);

  // Batch Invoicing Form
  const [batchInvBatchId, setBatchInvBatchId] = useState<string>('');
  const [batchInvMonth, setBatchInvMonth] = useState<string>('October 2026');
  const [batchInvDueDate, setBatchInvDueDate] = useState<string>('2026-10-15');

  // Collection & Cashier Review Override Form
  const [collectionAmount, setCollectionAmount] = useState<number>(0);
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
  const [discountValue, setDiscountValue] = useState<number>(1000);
  const [discountReason, setDiscountReason] = useState<string>('');

  // Ledger Search
  const [ledgerStudentId, setLedgerStudentId] = useState<string>('stud-1');
  const [studentLedger, setStudentLedger] = useState<StudentLedgerEntry[]>([]);

  // Fetch Core Data
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [invRes, headsRes, discRes, cashRes, sumRes, studRes, batchRes] = await Promise.all([
        fetch('/api/v1/finance/invoices', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/heads', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/discounts', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/reports/cashbook', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/reports/fee-head-summary', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/sis/students', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/batches', { headers: { authorization: `Bearer ${token}` } }),
      ]);

      if (invRes.ok) setInvoices((await invRes.json()).data || []);
      if (headsRes.ok) setFeeHeads((await headsRes.json()).data || []);
      if (discRes.ok) setDiscounts((await discRes.json()).data || []);
      if (cashRes.ok) setCashbook((await cashRes.json()).data || []);
      if (sumRes.ok) setHeadSummary((await sumRes.json()).data || []);
      if (studRes.ok) setStudents((await studRes.json()).data || []);
      if (batchRes.ok) setBatches((await batchRes.json()).data || []);
    } catch (err) {
      console.error('Failed to load fee data:', err);
    } finally {
      setLoading(false);
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
  const handleAmountChange = async (amt: number) => {
    setCollectionAmount(amt);
    if (!activeInvoice || !token) return;
    try {
      const res = await fetch('/api/v1/finance/distribute-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: activeInvoice.id, amount: amt })
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

    const totalAllocated = distributionItems.reduce((s, i) => s + Number(i.allocated_amount), 0);
    if (Math.abs(totalAllocated - collectionAmount) > 0.05) {
      alert(`Allocated sum (${totalAllocated} PKR) must match collected amount (${collectionAmount} PKR)`);
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
          amount_paid: collectionAmount,
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
      {/* Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-indigo-600" />
            Fees & Student Billing
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Issue monthly fee vouchers, record student payments, manage concessions, and print fee slips.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBatchInvoiceModal(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Building2 className="w-3.5 h-3.5" />
            Batch Invoicing
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Invoice
          </button>
        </div>
      </div>

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
      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'invoices' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Student Invoices & Challans
          {activeTab === 'invoices' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />}
        </button>
        <button
          onClick={() => setActiveTab('cashier')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'cashier' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Cashier Collection & Smart Distribution
          {activeTab === 'cashier' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />}
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'discounts' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Ad-Hoc Concessions & Audit Ledger
          {activeTab === 'discounts' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'reports' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Financial Reports & Ledgers
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
                placeholder="Search student, roll #, invoice #..."
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
                        onChange={e => handleAmountChange(Number(e.target.value))}
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
                        placeholder="e.g. HBL-992019"
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
                        placeholder="e.g. Parent requested specific allocation to Tuition ahead of Arrears"
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashbook.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400">No collections for today yet.</td>
                    </tr>
                  ) : (
                    cashbook.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-500">{c.date}</td>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-700">{c.receipt_number}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{c.student_name}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{c.roll_number}</td>
                        <td className="py-2 px-3 font-mono uppercase text-[10px] text-slate-600">{c.payment_method}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">{c.amount.toLocaleString()}</td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">{c.collected_by}</td>
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

              <select
                value={ledgerStudentId}
                onChange={e => setLedgerStudentId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.roll_number})</option>
                ))}
              </select>
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
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Generate Student Fee Voucher
              </h3>
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
                    placeholder="e.g. October 2026"
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
                                setNewInvCustomItems([...newInvCustomItems, { fee_head_id: head.id, amount: head.default_amount || 2000 }]);
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
                  placeholder="Optional billing remarks"
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
                  Generate Voucher
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
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Batch Monthly Invoicing
              </h3>
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

      {/* MODAL 3: APPLY CONCESSION */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                Apply Fee Concession
              </h3>
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
                    onChange={e => setDiscountValue(Number(e.target.value))}
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
                  placeholder="e.g. Approved by Director Adnan for sibling hardship relief"
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
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Print / Save PDF
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
                    <h4 className="font-black text-slate-900 tracking-tight text-xs uppercase">{tenant?.name || 'APEX ACADEMY LAHORE'}</h4>
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
    </div>
  );
};
