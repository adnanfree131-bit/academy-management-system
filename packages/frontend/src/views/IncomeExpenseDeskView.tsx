import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  DollarSign,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Printer,
  Trash2,
  X,
  RefreshCw,
  PieChart
} from 'lucide-react';
import { AccountHead, FinancialTransaction } from '@apex/shared-types';
import { academyLetterheadFromAuth, buildSimpleStatementPdf, downloadPdfBytes } from '../lib/officialDocumentPdf';

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
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  );

  // Modals
  const [showVoucherModal, setShowVoucherModal] = useState<boolean>(false);
  const [showHeadModal, setShowHeadModal] = useState<boolean>(false);

  // Voucher Form State
  const [voucherType, setVoucherType] = useState<'income' | 'expense'>('expense');
  const [voucherHeadId, setVoucherHeadId] = useState<string>('');
  const [voucherAmount, setVoucherAmount] = useState<number>(0);
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
      const incomeRows = (plReport?.income_heads || plReport?.income || []).map((r: any) => ({
        head: r.head_name || r.name || 'Income',
        amount: `PKR ${Number(r.amount || r.total || 0).toLocaleString()}`,
      }));
      const expenseRows = (plReport?.expense_heads || plReport?.expenses || []).map((r: any) => ({
        head: r.head_name || r.name || 'Expense',
        amount: `PKR ${Number(r.amount || r.total || 0).toLocaleString()}`,
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
    if (!token || !voucherHeadId || voucherAmount <= 0) {
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
      setVoucherAmount(0);
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
    const matchesSearch =
      (t.payee_payer?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (t.reference_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (t.head_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesHead = selectedHeadFilter === 'all' || t.account_head_id === selectedHeadFilter;

    return matchesSearch && matchesType && matchesHead;
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
            <Wallet className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Income & Expenses</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Record daily transactions, manage account heads, and view profit & loss summary.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHeadModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all"
          >
            <Tag className="w-4 h-4 text-indigo-600" />
            <span>+ Add Account Head</span>
          </button>

          <button
            onClick={() => {
              setVoucherType('expense');
              setShowVoucherModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-xs transition-all"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Record Expense</span>
          </button>

          <button
            onClick={() => {
              setVoucherType('income');
              setShowVoucherModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition-all"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Record Income</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Total Income</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">PKR {totalIncome.toLocaleString()}</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Cash and bank receipts</span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Total Expenses</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900">PKR {totalExpense.toLocaleString()}</span>
          </div>
          <span className="text-[11px] text-rose-600 font-semibold mt-1 block">Operational bills & payments</span>
        </div>

        <div className={`border rounded-2xl p-4 shadow-xs ${
          netBalance >= 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">Net Balance</span>
            <span className={`p-2 rounded-xl ${netBalance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-2xl font-black ${netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              PKR {netBalance.toLocaleString()}
            </span>
          </div>
          <span className="text-[11px] font-semibold opacity-80 mt-1 block">
            {netBalance >= 0 ? 'Surplus' : 'Deficit'}
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('cashbook')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'cashbook'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Daily Cashbook Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('heads')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'heads'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Account Heads ({accountHeads.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pl_report')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'pl_report'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>Profit & Loss Statement</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY CASHBOOK LEDGER */}
      {/* ========================================================================= */}
      {activeTab === 'cashbook' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search payee, ref, head, remarks..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold"
              >
                <option value="all">All Types (Income & Expense)</option>
                <option value="income">Income Only (+)</option>
                <option value="expense">Expense Only (-)</option>
              </select>

              <select
                value={selectedHeadFilter}
                onChange={e => setSelectedHeadFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold max-w-[180px]"
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold"
                title="Download cashbook PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isPrinting ? 'Preparing…' : 'PDF'}</span>
              </button>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              <p className="text-xs font-mono">Loading transaction ledger...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Wallet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No transactions recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "+ Record Expense" or "+ Record Income" to enter operational vouchers.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Account Head</th>
                    <th className="py-3 px-4">Payee / Payer</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Reference #</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Debit (Expense)</th>
                    <th className="py-3 px-4 text-right">Credit (Income)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          t.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          <Tag className="w-2.5 h-2.5" />
                          {t.head_name || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {t.payee_payer || '—'}
                      </td>
                      <td className="py-3 px-4 capitalize font-mono text-[11px] text-slate-600">
                        {t.payment_method.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {t.reference_number || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {t.description || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                        {t.type === 'expense' ? `PKR ${Number(t.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {t.type === 'income' ? `PKR ${Number(t.amount).toLocaleString()}` : '—'}
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
      {/* TAB 2: DYNAMIC ACCOUNT HEADS */}
      {/* ========================================================================= */}
      {activeTab === 'heads' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Account Heads</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Add income and expense heads for this academy. Fee heads you create in Settings also appear as income.
              </p>
            </div>
            <button
              onClick={() => setShowHeadModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Account Head</span>
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
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
                      {head.description || 'Custom institutional tag'}
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
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Institutional Income vs Expense Statement</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly reconciled profit & loss statement for campus administration.
              </p>
            </div>
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
                  <span className="text-[10px] font-mono uppercase font-bold text-emerald-800">Total Month Income</span>
                  <span className="text-xl font-black text-emerald-900 block mt-1">
                    PKR {Number(plReport.total_income || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-[10px] font-mono uppercase font-bold text-rose-800">Total Month Expenses</span>
                  <span className="text-xl font-black text-rose-900 block mt-1">
                    PKR {Number(plReport.total_expense || 0).toLocaleString()}
                  </span>
                </div>
                <div className={`p-4 rounded-xl border ${
                  Number(plReport.net_profit || 0) >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-amber-50 border-amber-200'
                }`}>
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-600">Net Operating Margin</span>
                  <span className={`text-xl font-black block mt-1 ${
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg text-white ${voucherType === 'income' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                  {voucherType === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </span>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Record {voucherType === 'income' ? 'Income Receipt' : 'Expense Voucher'}
                </h2>
              </div>
              <button onClick={() => setShowVoucherModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
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
                    Dynamic Account Head ({voucherType})
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
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount (PKR)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={voucherAmount || ''}
                    onChange={e => setVoucherAmount(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 15000"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {voucherType === 'income' ? 'Payer Name / Source' : 'Payee / Vendor Name'}
                  </label>
                  <input
                    type="text"
                    value={voucherPayee}
                    onChange={e => setVoucherPayee(e.target.value)}
                    placeholder={voucherType === 'income' ? 'e.g. Canteen Vendor' : 'e.g. LESCO Electricity'}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Reference / Slip #</label>
                  <input
                    type="text"
                    value={voucherRef}
                    onChange={e => setVoucherRef(e.target.value)}
                    placeholder="e.g. CHQ-9912 or INV-44"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Remarks / Audit Justification</label>
                <textarea
                  value={voucherDescription}
                  onChange={e => setVoucherDescription(e.target.value)}
                  placeholder="Additional context for auditor..."
                  rows={2}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVoucher}
                  className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white shadow-xs transition-all ${
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-extrabold text-slate-900">Create Dynamic Account Head</h2>
              </div>
              <button onClick={() => setShowHeadModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
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
                  placeholder={newHeadType === 'expense' ? 'e.g. Campus Electricity Bills, Chemistry Lab Consumables' : 'e.g. Uniform Sales, Prospectus Fees'}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  value={newHeadDesc}
                  onChange={e => setNewHeadDesc(e.target.value)}
                  placeholder="Optional explanatory note for accounting categorization..."
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowHeadModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHead}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all"
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
