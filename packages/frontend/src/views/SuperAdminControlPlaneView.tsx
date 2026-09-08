import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  SuperAdminOverview, 
  SuperAdminTenantSummary, 
  SubscriptionPaymentReceipt, 
  PlatformBankingConfig 
} from '@apex/shared-types';
import { 
  ShieldAlert, 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  Save, 
  Check, 
  X
} from 'lucide-react';

export const SuperAdminControlPlaneView: React.FC = () => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<SuperAdminOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'academies' | 'receipts' | 'banking'>('academies');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');
  const [actionErrorMsg, setActionErrorMsg] = useState<string>('');

  // Banking config edit form
  const [bankName, setBankName] = useState<string>('');
  const [accountTitle, setAccountTitle] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [iban, setIban] = useState<string>('');
  const [branchCode, setBranchCode] = useState<string>('');
  const [whatsappSupport, setWhatsappSupport] = useState<string>('');
  const [supportEmail, setSupportEmail] = useState<string>('');
  const [monthlyFee, setMonthlyFee] = useState<number>(15000);
  const [instructions, setInstructions] = useState<string>('');

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/v1/saas/superadmin/overview', {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const body = await res.json();
        setOverview(body.data);
        if (body.data.banking_config) {
          const b: PlatformBankingConfig = body.data.banking_config;
          setBankName(b.bank_name);
          setAccountTitle(b.account_title);
          setAccountNumber(b.account_number);
          setIban(b.iban || '');
          setBranchCode(b.branch_code || '');
          setWhatsappSupport(b.whatsapp_support || '');
          setSupportEmail(b.support_email || '');
          setMonthlyFee(b.monthly_subscription_fee);
          setInstructions(b.instructions || '');
        }
      }
    } catch (err) {
      console.error('Failed fetching superadmin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  // Activate Academy
  const handleActivateAcademy = async (tenantId: string, durationMonths: number) => {
    try {
      const res = await fetch(`/api/v1/saas/tenants/${tenantId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ duration_months: durationMonths })
      });

      if (res.ok) {
        setActionSuccessMsg(`Academy activated for ${durationMonths} month(s). Dashboard unlocked!`);
        fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Activation failed');
    }
  };

  // Review Receipt
  const handleReviewReceipt = async (receiptId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/v1/saas/receipts/${receiptId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        setActionSuccessMsg(`Receipt ${status === 'APPROVED' ? 'approved & academy unlocked' : 'rejected'}.`);
        fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Review failed');
    }
  };

  // Save Banking Config
  const handleSaveBankingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/saas/banking-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          bank_name: bankName,
          account_title: accountTitle,
          account_number: accountNumber,
          iban,
          branch_code: branchCode,
          whatsapp_support: whatsappSupport,
          support_email: supportEmail,
          monthly_subscription_fee: Number(monthlyFee),
          instructions
        })
      });

      if (res.ok) {
        setActionSuccessMsg('Platform banking configuration saved successfully. Reflected on all locked screens.');
        fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Save failed');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs">Loading SaaS Global Control Plane...</p>
      </div>
    );
  }

  const tenants: SuperAdminTenantSummary[] = overview?.tenants || [];
  const receipts: SubscriptionPaymentReceipt[] = overview?.recent_receipts || [];

  return (
    <div className="space-y-6">
      
      {/* SaaS Control Plane Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight">Platform Administration & Multi-Tenant Management</h1>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase rounded-md">
                  Super Administrator
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage registered academies, license renewals, trial access, and platform settings.
              </p>
            </div>
          </div>

          <button
            onClick={fetchOverview}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all self-start md:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Metrics
          </button>
        </div>

        {/* 6 Key SaaS Metrics */}
        <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Academies</span>
            <span className="text-2xl font-black text-white mt-1 block font-mono">{overview?.total_tenants || 0}</span>
          </div>

          <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-800/60">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Active Accounts</span>
            <span className="text-2xl font-black text-emerald-300 mt-1 block font-mono">{overview?.active_tenants || 0}</span>
          </div>

          <div className="p-3 bg-blue-950/40 rounded-xl border border-blue-800/60">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Free Trials</span>
            <span className="text-2xl font-black text-blue-300 mt-1 block font-mono">{overview?.trial_tenants || 0}</span>
          </div>

          <div className="p-3 bg-rose-950/40 rounded-xl border border-rose-800/60">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Locked / Expired</span>
            <span className="text-2xl font-black text-rose-300 mt-1 block font-mono">{overview?.locked_tenants || 0}</span>
          </div>

          <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-800/60">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Platform MRR</span>
            <span className="text-xl font-black text-indigo-200 mt-1 block font-mono">PKR {(overview?.platform_mrr || 0).toLocaleString()}</span>
          </div>

          <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-800/60">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Annual ARR</span>
            <span className="text-xl font-black text-purple-200 mt-1 block font-mono">PKR {(overview?.platform_arr || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {actionSuccessMsg}
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-bold">
          {actionErrorMsg}
        </div>
      )}

      {/* Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('academies')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
            activeTab === 'academies'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Academy Activation Directory ({tenants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
            activeTab === 'receipts'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Subscription Receipts Queue ({receipts.filter(r => r.status === 'PENDING').length} Pending)</span>
        </button>

        <button
          onClick={() => setActiveTab('banking')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
            activeTab === 'banking'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Platform Banking Configuration</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: ACADEMY DIRECTORY & ACTIVATION QUEUE
          ===================================================================== */}
      {activeTab === 'academies' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Institutional Academy Tenants & Subscription Status
            </h3>
            <span className="text-xs text-slate-500 font-mono">Instant Renewal</span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="p-3.5">Academy Name</th>
                <th className="p-3.5">Slug</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Capacity</th>
                <th className="p-3.5">Trial / Renewal Expiry</th>
                <th className="p-3.5 text-right">Super-Admin Activation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {tenants.map(t => {
                const isLocked = t.status === 'locked' || new Date(t.trial_ends_at).getTime() < Date.now();
                return (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{t.tier.toUpperCase()} TIER</span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600 font-bold">
                      {t.slug}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isLocked
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                          : t.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                      }`}>
                        {isLocked ? 'LOCKED (EXPIRED)' : t.status}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="text-slate-800 font-semibold">{t.student_count} Students</div>
                      <div className="text-[10px] text-slate-400">{t.teacher_count} Faculty Staff</div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      <div>{new Date(t.trial_ends_at).toLocaleDateString()}</div>
                      <span className="text-[10px] text-slate-400">
                        {isLocked ? 'Expired' : 'Valid'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleActivateAcademy(t.id, 1)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all"
                          title="Activate Academy for 1 Month"
                        >
                          +1 Month
                        </button>
                        <button
                          onClick={() => handleActivateAcademy(t.id, 6)}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all"
                          title="Activate Academy for 6 Months"
                        >
                          +6 Months
                        </button>
                        <button
                          onClick={() => handleActivateAcademy(t.id, 12)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-xs transition-all"
                          title="Activate Academy for 1 Year"
                        >
                          +1 Year
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

      {/* =====================================================================
          TAB 2: SUBSCRIPTION RECEIPTS QUEUE
          ===================================================================== */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Submitted Bank Transfer Receipts Queue
            </h3>
            <span className="text-xs text-slate-500">Approve to automatically extend validity and unlock dashboard</span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="p-3.5">Submission Date</th>
                <th className="p-3.5">Academy</th>
                <th className="p-3.5">Amount & Duration</th>
                <th className="p-3.5">Payment Method / TRX</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Verification Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">No payment receipts in queue.</td>
                </tr>
              ) : (
                receipts.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50/70">
                    <td className="p-3.5 font-mono text-slate-500">
                      {new Date(rec.created_at).toLocaleString()}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{rec.tenant_name}</div>
                      <div className="text-[10px] text-slate-400">{rec.uploaded_by_email}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono font-bold text-slate-900 text-sm">PKR {rec.amount.toLocaleString()}</div>
                      <span className="text-[10px] text-indigo-600 font-bold">{rec.plan_duration_months} Month(s)</span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] font-bold rounded">
                        {rec.payment_method}
                      </span>
                      <div className="font-mono text-[11px] text-slate-600 mt-0.5">TRX: {rec.reference_number || 'N/A'}</div>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        rec.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rec.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {rec.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleReviewReceipt(rec.id, 'APPROVED')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve & Unlock
                          </button>
                          <button
                            onClick={() => handleReviewReceipt(rec.id, 'REJECTED')}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Verified by Super-Admin</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          TAB 3: PLATFORM BANKING CONFIGURATION FORM
          ===================================================================== */}
      {activeTab === 'banking' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs max-w-3xl space-y-5">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Super-Admin Official Banking & Contact Configuration</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Updates made here are immediately rendered in real-time across all expired academies' trial lockout screens.
            </p>
          </div>

          <form onSubmit={handleSaveBankingConfig} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Title *</label>
                <input
                  type="text"
                  required
                  value={accountTitle}
                  onChange={e => setAccountTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Number *</label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">IBAN Number (24 Digits)</label>
                <input
                  type="text"
                  value={iban}
                  onChange={e => setIban(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-indigo-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Branch Code & Address</label>
                <input
                  type="text"
                  value={branchCode}
                  onChange={e => setBranchCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">WhatsApp Support Hotline</label>
                <input
                  type="text"
                  value={whatsappSupport}
                  onChange={e => setWhatsappSupport(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Monthly Subscription Fee (PKR)</label>
                <input
                  type="number"
                  required
                  value={monthlyFee}
                  onChange={e => setMonthlyFee(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-emerald-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Billing Support Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={e => setSupportEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Special Payment Instructions</label>
              <textarea
                rows={3}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              Save Banking Configuration
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
