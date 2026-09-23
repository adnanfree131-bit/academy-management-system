import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Scale,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Printer,
  Trash2,
  X,
  RefreshCw,
  PieChart,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { AccountHead, FinancialTransaction } from '@apex/shared-types';
import { academyLetterheadFromAuth, buildSimpleStatementPdf, downloadPdfBytes } from '../lib/officialDocumentPdf';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';
import { useMobileOverlay } from '../lib/mobileOverlay';

export const IncomeExpenseDeskView: React.FC = () => {
  const { token, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'cashbook' | 'heads' | 'pl_report'>('cashbook');

  // Data State
  const [accountHeads, setAccountHeads] = useState<AccountHead[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [plReport, setPlReport] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedHeadFilter, setSelectedHeadFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showCashbookFilters, setShowCashbookFilters] = useState<boolean>(false);

  // Modals
  const [showVoucherModal, setShowVoucherModal] = useState<boolean>(false);
  const [showHeadModal, setShowHeadModal] = useState<boolean>(false);

  useMobileOverlay('sheet', Boolean(showVoucherModal || showHeadModal), () => {
    setShowVoucherModal(false);
    setShowHeadModal(false);
  });

  // Voucher Form State
  const [voucherType, setVoucherType] = useState<'income' | 'expense'>('expense');
  const [voucherHeadId, setVoucherHeadId] = useState<string>('');
  const [voucherAmount, setVoucherAmount] = useState<number | ''>('');
  const [voucherMethod, setVoucherMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'online'>('cash');
  const [voucherPayee, setVoucherPayee] = useState<string>('');
  const [voucherRef, setVoucherRef] = useState<string>('');
  const [voucherDescription, setVoucherDescription] = useState<string>('');
  const [voucherDate, setVoucherDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [isSubmittingVoucher, setIsSubmittingVoucher] = useState<boolean>(false);

  // Head Form State
  const [newHeadName, setNewHeadName] = useState<string>('');
  const [newHeadType, setNewHeadType] = useState<'income' | 'expense'>('expense');
  const [newHeadDesc, setNewHeadDesc] = useState<string>('');
  const [isSubmittingHead, setIsSubmittingHead] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const printCashbookPdf = async () => {
    setIsPrinting(true);
    try {
      const academy = await academyLetterheadFromAuth(tenant);
      const bytes = await buildSimpleStatementPdf({
        title: 'Daily Cashbook Ledger',
        academy,
        identity: [
          { label: 'Academy', value: tenant?.name || 'Academy' },
          { label: 'Month', value: selectedMonth },
          { label: 'Entries', value: String(filteredTransactions.length) },
        ],
        columns: [
          { key: 'date', label: 'Date', width: 70 },
          { key: 'voucher', label: 'Voucher', width: 90 },
          { key: 'head', label: 'Head', width: 120 },
          { key: 'type', label: 'Type', width: 70 },
          { key: 'amount', label: 'Amount', width: 80, align: 'right' },
        ],
        rows: filteredTransactions.map(t => ({
          date: t.transaction_date,
          voucher: t.voucher_number,
          head: t.head_name,
          type: t.type,
          amount: `PKR ${Number(t.amount).toLocaleString()}`,
        })),
      });
      await downloadPdfBytes(bytes, `cashbook-${selectedMonth}.pdf`);
    } finally {
      setIsPrinting(false);
    }
  };

  const printPlPdf = async () => {
    setIsPrinting(true);
    try {
      const academy = await academyLetterheadFromAuth(tenant);
      const incomeMap = (plReport?.income_breakdown || plReport?.incomeByHead || {}) as Record<string, number>;
      const expenseMap = (plReport?.expense_breakdown || plReport?.expenseByHead || {}) as Record<string, number>;
      const incomeRows = Object.entries(incomeMap).map(([head, amount]) => ({
        head,
        amount: `PKR ${Number(amount || 0).toLocaleString()}`,
      }));
      const expenseRows = Object.entries(expenseMap).map(([head, amount]) => ({
        head,
        amount: `PKR ${Number(amount || 0).toLocaleString()}`,
      }));
      const bytes = await buildSimpleStatementPdf({
        title: 'Profit & Loss Statement',
        academy,
        identity: [
          { label: 'Academy', value: tenant?.name || 'Academy' },
          { label: 'Month', value: selectedMonth },
          { label: 'Net', value: `PKR ${Number(plReport?.net_profit || plReport?.net || 0).toLocaleString()}` },
        ],
        columns: [
          { key: 'head', label: 'Head', width: 280 },
          { key: 'amount', label: 'Amount', width: 150, align: 'right' },
        ],
        rows: [...incomeRows, ...expenseRows],
      });
      await downloadPdfBytes(bytes, `profit-loss-${selectedMonth}.pdf`);
    } finally {
      setIsPrinting(false);
    }
  };

  // Fetch Data
  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [headsRes, txRes, plRes] = await Promise.all([
        fetch('/api/v1/finance/account-heads', { headers }),
        fetch('/api/v1/finance/transactions', { headers }),
        fetch(`/api/v1/finance/reports/profit-loss?month=${selectedMonth}`, { headers }),
      ]);

      const [headsData, txData, plData] = await Promise.all([
        headsRes.json(),
        txRes.json(),
        plRes.json(),
      ]);

      if (headsData.success) {
        setAccountHeads(headsData.data || []);
      }
      if (txData.success) {
        setTransactions(txData.data || []);
      }
      if (plData.success) {
        setPlReport(plData.data || null);
      }
    } catch (err) {
      console.error('Failed to load income/expense data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, selectedMonth]);

  // Create Voucher
  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !voucherHeadId || !voucherAmount || Number(voucherAmount) <= 0) {
      alert('Please select an account head and enter a valid amount.');
      return;
    }

    setIsSubmittingVoucher(true);
    try {
      const res = await fetch('/api/v1/finance/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          account_head_id: voucherHeadId,
          type: voucherType,
          amount: Number(voucherAmount),
          payment_method: voucherMethod,
          payee_payer: voucherPayee || undefined,
          reference_number: voucherRef || undefined,
          description: voucherDescription || undefined,
          date: voucherDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to record voucher');

      setShowVoucherModal(false);
      // Reset form
      setVoucherAmount('');
      setVoucherPayee('');
      setVoucherRef('');
      setVoucherDescription('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingVoucher(false);
    }
  };

  // Create Head
  const handleCreateHead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newHeadName.trim()) {
      alert('Head name is required');
      return;
    }

    setIsSubmittingHead(true);
    try {
      const res = await fetch('/api/v1/finance/account-heads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newHeadName.trim(),
          type: newHeadType,
          description: newHeadDesc.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to create account head');

      setShowHeadModal(false);
      setNewHeadName('');
      setNewHeadDesc('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingHead(false);
    }
  };

  // Delete Head
  const handleDeleteHead = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete Account Head "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/finance/account-heads/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to delete head');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    const payee = (t.payee_payer || t.paid_to_or_received_from || '').toLowerCase();
    const matchesSearch =
      payee.includes(searchQuery.toLowerCase()) ||
      (t.reference_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (t.head_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesHead = selectedHeadFilter === 'all' || t.account_head_id === selectedHeadFilter;
    const txDate = t.transaction_date || t.date || '';
    const matchesMonth = !selectedMonth || txDate.startsWith(selectedMonth);
    const isLive = Number(t.amount) > 0 && !(t.description || '').startsWith('[VOIDED]');

    return matchesSearch && matchesType && matchesHead && matchesMonth && isLive;
  });

  // Calculate Running Ledger Totals
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);

  const netBalance = totalIncome - totalExpense;

  // Filter heads for voucher dropdown based on voucherType
  const relevantHeadsForVoucher = accountHeads.filter(h => h.type === voucherType);

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* Header Banner */}
      <PageHeading
        title="Income & Expenses"
        description="Record income and expense. View cashbook and this month's P&L."
        icon={<Wallet className="w-4 h-4 text-slate-700" />}
      >
        <button
          onClick={() => setShowHeadModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
        >
          <Tag className="w-3.5 h-3.5 text-slate-500" />
          <span>Add Head</span>
        </button>

        <button
          onClick={() => {
            setVoucherType('expense');
            setShowVoucherModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium shadow-sm transition-colors"
        >
          <ArrowDownRight className="w-3.5 h-3.5" />
          <span>Record Expense</span>
        </button>

        <button
          onClick={() => {
            setVoucherType('income');
            setShowVoucherModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Record Income</span>
        </button>
      </PageHeading>

      {/* High-Density Compact Financial KPI Strip (Finalized Enterprise Design) */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
        {/* Card 1: Total Income */}
        <div className="bg-white border border-slate-200/85 border-l-[3px] sm:border-l-[3.5px] border-l-emerald-600 rounded-xl px-2 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between shadow-[0_4px_14px_rgba(15,23,42,0.07)] hover:shadow-[0_6px_18px_rgba(15,23,42,0.10)] transition-all">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
              Income
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono font-bold text-emerald-700 text-xs sm:text-sm leading-none truncate">
                PKR {totalIncome.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 leading-none hidden sm:inline">Inflow</span>
          </div>
          <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/70 shrink-0 shadow-2xs hidden xs:flex">
            <TrendingUp className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-emerald-700" />
          </span>
        </div>

        {/* Card 2: Total Expenses */}
        <div className="bg-white border border-slate-200/85 border-l-[3px] sm:border-l-[3.5px] border-l-rose-600 rounded-xl px-2 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between shadow-[0_4px_14px_rgba(15,23,42,0.07)] hover:shadow-[0_6px_18px_rgba(15,23,42,0.10)] transition-all">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
              Expenses
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono font-bold text-rose-700 text-xs sm:text-sm leading-none truncate">
                PKR {totalExpense.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 leading-none hidden sm:inline">Outflow</span>
          </div>
          <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200/70 shrink-0 shadow-2xs hidden xs:flex">
            <TrendingDown className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-rose-700" />
          </span>
        </div>

        {/* Card 3: Net Balance */}
        <div className={`bg-white border border-slate-200/85 ${
          netBalance >= 0 ? 'border-l-emerald-600' : 'border-l-rose-600'
        } border-l-[3px] sm:border-l-[3.5px] rounded-xl px-2 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between shadow-[0_4px_14px_rgba(15,23,42,0.07)] hover:shadow-[0_6px_18px_rgba(15,23,42,0.10)] transition-all`}>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
              Net Balance
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`font-mono font-bold text-xs sm:text-sm leading-none truncate ${netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                PKR {netBalance.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 leading-none hidden sm:inline">{netBalance >= 0 ? 'Surplus' : 'Deficit'}</span>
          </div>
          <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border shrink-0 shadow-2xs hidden xs:flex ${
            netBalance >= 0 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70' 
              : 'bg-rose-50 text-rose-700 border-rose-200/70'
          }`}>
            <Scale className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
          </span>
        </div>
      </div>

      {/* Tabs Navigation - Segmented Control (Image 1 Style) */}
      <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('cashbook')}
          className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 touch-press text-center truncate ${
            activeTab === 'cashbook'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Cashbook</span>
        </button>

        <button
          onClick={() => setActiveTab('heads')}
          className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 touch-press text-center truncate ${
            activeTab === 'heads'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Tag className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Heads</span>
        </button>

        <button
          onClick={() => setActiveTab('pl_report')}
          className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 touch-press text-center truncate ${
            activeTab === 'pl_report'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <PieChart className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">P&L</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY CASHBOOK LEDGER */}
      {/* ========================================================================= */}
      {activeTab === 'cashbook' && (
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden space-y-2.5 p-3 sm:p-3.5">
          {/* Standalone Search Bar & Desktop Filters / Mobile Toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search transactions by payee, voucher, description..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs font-normal"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowCashbookFilters(!showCashbookFilters)}
              className="md:hidden flex items-center justify-between px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Filters & Month</span>
                {(typeFilter !== 'all' || selectedHeadFilter !== 'all') && (
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                )}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showCashbookFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Desktop Filters Row */}
            <div className="hidden md:flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-medium"
              >
                <option value="all">All Types</option>
                <option value="income">Income (+)</option>
                <option value="expense">Expense (-)</option>
              </select>

              <select
                value={selectedHeadFilter}
                onChange={e => setSelectedHeadFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-medium max-w-[160px] truncate"
              >
                <option value="all">All heads</option>
                {accountHeads.map(h => (
                  <option key={h.id} value={h.id}>
                    [{h.type.toUpperCase()}] {h.name}
                  </option>
                ))}
              </select>

              <button
                onClick={printCashbookPdf}
                disabled={isPrinting}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold shrink-0 cursor-pointer"
                title="Download cashbook PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isPrinting ? 'Preparing…' : 'PDF'}</span>
              </button>
            </div>
          </div>

          {/* Mobile Collapsible Filters Panel */}
          <div className={`${showCashbookFilters ? 'grid' : 'hidden'} md:hidden grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs`}>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 font-medium"
            >
              <option value="all">All Types</option>
              <option value="income">Income (+)</option>
              <option value="expense">Expense (-)</option>
            </select>

            <select
              value={selectedHeadFilter}
              onChange={e => setSelectedHeadFilter(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 font-medium truncate"
            >
              <option value="all">All heads</option>
              {accountHeads.map(h => (
                <option key={h.id} value={h.id}>
                  [{h.type.toUpperCase()}] {h.name}
                </option>
              ))}
            </select>

            <button
              onClick={printCashbookPdf}
              disabled={isPrinting}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isPrinting ? 'Preparing…' : 'Download Cashbook PDF'}</span>
            </button>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
              <p className="text-xs font-mono">Loading transaction ledger...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Wallet className="w-7 h-7 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No transactions this month</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Use Record Expense or Record Income.
              </p>
            </div>
          ) : (
            <>
            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Account Head</th>
                    <th className="py-2 px-3">Payee / Payer</th>
                    <th className="py-2 px-3">Payment Method</th>
                    <th className="py-2 px-3">Reference #</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Debit (Expense)</th>
                    <th className="py-2 px-3 text-right">Credit (Income)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {t.transaction_date || t.date}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          t.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          <Tag className="w-2.5 h-2.5" />
                          {t.head_name || 'General'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-800">
                        {t.payee_payer || t.paid_to_or_received_from || '—'}
                      </td>
                      <td className="py-2 px-3 capitalize font-mono text-[11px] text-slate-600">
                        {t.payment_method.replace('_', ' ')}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                        {t.reference_number || '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-600 max-w-xs truncate">
                        {t.description || '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                        {t.type === 'expense' ? `PKR ${Number(t.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                        {t.type === 'income' ? `PKR ${Number(t.amount).toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Native Transaction Feed (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100 bg-white rounded-xl border border-slate-100 overflow-hidden">
              {filteredTransactions.map(t => {
                const isIncome = t.type === 'income';
                return (
                  <div key={t.id} className="p-3.5 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors">
                    {/* Left: Icon + Head Name + Payee + Date */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                      }`}>
                        {isIncome ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">
                          {t.head_name || (isIncome ? 'Income Voucher' : 'Operational Expense')}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {t.payee_payer || t.paid_to_or_received_from || t.description || 'Entry'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                          <span>{t.transaction_date || t.date}</span>
                          <span>•</span>
                          <span className="capitalize">{t.payment_method.replace('_', ' ')}</span>
                          {t.reference_number && (
                            <>
                              <span>•</span>
                              <span>Ref: {t.reference_number}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount */}
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold font-mono ${
                        isIncome ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isIncome ? '+' : '-'}PKR {Number(t.amount).toLocaleString()}
                      </p>
                      <span className={`inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-bold rounded uppercase ${
                        isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {t.type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Floating Action Button (FAB) for Voucher */}
            <button
              type="button"
              onClick={() => {
                setVoucherType('expense');
                setShowVoucherModal(true);
              }}
              className="sm:hidden fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 w-14 h-14 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              title="Add Voucher"
            >
              <Plus className="w-6 h-6" />
            </button>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DYNAMIC ACCOUNT HEADS */}
      {/* ========================================================================= */}
      {activeTab === 'heads' && (
        <div className="bg-white border border-slate-200/90 rounded-lg shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <SectionInfo
              title="Account Heads"
              description="Categories for operational income and expense. Student fee heads are separate."
            />
            <button
              onClick={() => setShowHeadModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Head</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {accountHeads.map(head => {
              const headTx = transactions.filter(t => t.account_head_id === head.id);
              const totalAmount = headTx.reduce((s, t) => s + Number(t.amount), 0);

              return (
                <div
                  key={head.id}
                  className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        head.type === 'income'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {head.type}
                      </span>
                      <button
                        onClick={() => handleDeleteHead(head.id, head.name)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                        title="Delete Head"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 mt-2">{head.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 min-h-[32px]">
                      {head.description || '—'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-400">{headTx.length} Vouchers</span>
                    <span className={`font-bold ${head.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      PKR {totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PROFIT & LOSS STATEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'pl_report' && (
        <div className="bg-white border border-slate-200/90 rounded-lg shadow-xs p-5 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <SectionInfo
              title="Income and expense"
              description="This month's fee collections plus other income, minus expenses."
            />
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-slate-800 font-bold"
              />
              <button
                onClick={printPlPdf}
                disabled={isPrinting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isPrinting ? 'Preparing…' : 'PDF'}</span>
              </button>
            </div>
          </div>

          {plReport ? (
            <div className="space-y-6">
              {/* Summary Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-mono uppercase font-bold text-emerald-800">Month Income</span>
                  <span className="text-xl font-bold text-emerald-900 tabular-nums block mt-1">
                    PKR {Number(plReport.total_income || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-[10px] font-mono uppercase font-bold text-rose-800">Month Expenses</span>
                  <span className="text-xl font-bold text-rose-900 tabular-nums block mt-1">
                    PKR {Number(plReport.total_expense || 0).toLocaleString()}
                  </span>
                </div>
                <div className={`p-4 rounded-xl border ${
                  Number(plReport.net_profit || 0) >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-amber-50 border-amber-200'
                }`}>
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-600">Net Profit</span>
                  <span className={`text-xl font-bold tabular-nums block mt-1 ${
                    Number(plReport.net_profit || 0) >= 0 ? 'text-indigo-900' : 'text-amber-900'
                  }`}>
                    PKR {Number(plReport.net_profit || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Heads Breakdown Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Income Heads */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-emerald-50 border-b border-emerald-200 font-bold text-emerald-900 text-xs flex justify-between">
                    <span>Income Sources</span>
                    <span>Total PKR</span>
                  </div>
                  <div className="divide-y divide-slate-100 p-2 text-xs">
                    {plReport.income_breakdown && Object.keys(plReport.income_breakdown).length > 0 ? (
                      Object.entries(plReport.income_breakdown).map(([name, val]: [string, any]) => (
                        <div key={name} className="py-2 px-2 flex justify-between">
                          <span className="text-slate-700 font-semibold">{name}</span>
                          <span className="font-mono font-bold text-emerald-700">PKR {Number(val).toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 p-3 text-center">No income recorded for this month</p>
                    )}
                  </div>
                </div>

                {/* Expense Heads */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-rose-50 border-b border-rose-200 font-bold text-rose-900 text-xs flex justify-between">
                    <span>Operating Expense Categories</span>
                    <span>Total PKR</span>
                  </div>
                  <div className="divide-y divide-slate-100 p-2 text-xs">
                    {plReport.expense_breakdown && Object.keys(plReport.expense_breakdown).length > 0 ? (
                      Object.entries(plReport.expense_breakdown).map(([name, val]: [string, any]) => (
                        <div key={name} className="py-2 px-2 flex justify-between">
                          <span className="text-slate-700 font-semibold">{name}</span>
                          <span className="font-mono font-bold text-rose-700">PKR {Number(val).toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 p-3 text-center">No expenses recorded for this month</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">Select a month to compute P&L</p>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD TRANSACTION VOUCHER */}
      {/* ========================================================================= */}
      {showVoucherModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[92dvh] flex flex-col mobile-sheet-card">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <SectionInfo
                title={`Record ${voucherType === 'income' ? 'Income' : 'Expense'}`}
                description={`Create a new ${voucherType} voucher in the cashbook`}
              />
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Voucher Type</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setVoucherType('expense');
                        setVoucherHeadId('');
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                        voucherType === 'expense' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Expense (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVoucherType('income');
                        setVoucherHeadId('');
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                        voucherType === 'income' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Income (+)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Transaction Date</label>
                  <input
                    type="date"
                    value={voucherDate}
                    onChange={e => setVoucherDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Category ({voucherType})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowVoucherModal(false);
                      setNewHeadType(voucherType);
                      setShowHeadModal(true);
                    }}
                    className="text-[10px] text-indigo-600 font-bold hover:underline"
                  >
                    + Add New Head
                  </button>
                </div>
                <select
                  value={voucherHeadId}
                  onChange={e => setVoucherHeadId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-medium"
                  required
                >
                  <option value="">Select Account Head...</option>
                  {relevantHeadsForVoucher.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.description ? `(${h.description})` : ''}
                    </option>
                  ))}
                </select>
                {relevantHeadsForVoucher.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No {voucherType} heads created yet. Click "+ Add New Head" above to create one.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount (PKR)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={voucherAmount}
                    onChange={e => setVoucherAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono font-bold text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={voucherMethod}
                    onChange={e => setVoucherMethod(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 capitalize"
                  >
                    <option value="cash">Cash in Hand</option>
                    <option value="bank_transfer">Bank Transfer / IBFT</option>
                    <option value="cheque">Cheque</option>
                    <option value="online">Online / Card</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {voucherType === 'income' ? 'Payer Name / Source' : 'Payee / Vendor Name'}
                  </label>
                  <input
                    type="text"
                    value={voucherPayee}
                    onChange={e => setVoucherPayee(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Reference / Slip #</label>
                  <input
                    type="text"
                    value={voucherRef}
                    onChange={e => setVoucherRef(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Remarks / Audit Justification</label>
                <textarea
                  value={voucherDescription}
                  onChange={e => setVoucherDescription(e.target.value)}
                  rows={2}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  className="h-8.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVoucher}
                  className={`h-8.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs transition-colors cursor-pointer ${
                    voucherType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmittingVoucher ? 'Recording...' : `Save ${voucherType === 'income' ? 'Income' : 'Expense'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DYNAMIC ACCOUNT HEAD CREATOR */}
      {/* ========================================================================= */}
      {showHeadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl overflow-hidden mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <SectionInfo
                title="Create Account Head"
                description="Define a new category for income or expense transactions"
              />
              <button
                type="button"
                onClick={() => setShowHeadModal(false)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateHead} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Head Classification</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewHeadType('expense')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      newHeadType === 'expense'
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Expense Category (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewHeadType('income')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      newHeadType === 'income'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Income Category (+)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Head Name</label>
                <input
                  type="text"
                  value={newHeadName}
                  onChange={e => setNewHeadName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  value={newHeadDesc}
                  onChange={e => setNewHeadDesc(e.target.value)}
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowHeadModal(false)}
                  className="h-8.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHead}
                  className="h-8.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingHead ? 'Saving...' : 'Save Account Head'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
