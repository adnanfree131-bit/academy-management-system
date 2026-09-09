import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  SuperAdminOverview, 
  SuperAdminTenantSummary, 
  SubscriptionPaymentReceipt, 
  PlatformAnnouncement
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
  X,
  Globe,
  Ban,
  Play,
  Bell,
  Edit3,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

export const SuperAdminControlPlaneView: React.FC = () => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<SuperAdminOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'academies' | 'receipts' | 'config' | 'announcements'>('academies');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');
  const [actionErrorMsg, setActionErrorMsg] = useState<string>('');

  // Subdomain rename modal
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [selectedTenantForRename, setSelectedTenantForRename] = useState<SuperAdminTenantSummary | null>(null);
  const [newSubdomainSlug, setNewSubdomainSlug] = useState<string>('');
  const [renameLoading, setRenameLoading] = useState<boolean>(false);

  // Suspension modal
  const [suspendModalOpen, setSuspendModalOpen] = useState<boolean>(false);
  const [selectedTenantForSuspend, setSelectedTenantForSuspend] = useState<SuperAdminTenantSummary | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('Terms of Service review pending annual license renewal.');
  const [suspendLoading, setSuspendLoading] = useState<boolean>(false);

  // Platform Global Config form
  const [defaultTrialDays, setDefaultTrialDays] = useState<number>(30);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(7);
  const [bankName, setBankName] = useState<string>('');
  const [accountTitle, setAccountTitle] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [iban, setIban] = useState<string>('');
  const [branchCode, setBranchCode] = useState<string>('');
  const [whatsappSupport, setWhatsappSupport] = useState<string>('');
  const [supportEmail, setSupportEmail] = useState<string>('');
  const [monthlyFee, setMonthlyFee] = useState<number>(15000);
  const [instructions, setInstructions] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Announcements form & list
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newMessage, setNewMessage] = useState<string>('');
  const [newType, setNewType] = useState<PlatformAnnouncement['type']>('system');
  const [newFrequency, setNewFrequency] = useState<PlatformAnnouncement['frequency']>('once_dismissible');
  const [newAudience, setNewAudience] = useState<PlatformAnnouncement['target_audience']>('all');
  const [newActionLabel, setNewActionLabel] = useState<string>('');
  const [newActionUrl, setNewActionUrl] = useState<string>('');
  const [creatingAnnouncement, setCreatingAnnouncement] = useState<boolean>(false);

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/v1/saas/superadmin/overview', {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const body = await res.json();
        const data: SuperAdminOverview = body.data;
        setOverview(data);

        // Populate platform config
        if (data.platform_config) {
          setDefaultTrialDays(data.platform_config.default_trial_days || 30);
          setGracePeriodDays(data.platform_config.grace_period_days || 7);
          setBankName(data.platform_config.bank_name || '');
          setAccountTitle(data.platform_config.account_title || '');
          setAccountNumber(data.platform_config.account_number || '');
          setIban(data.platform_config.iban || '');
          setBranchCode(data.platform_config.branch_code || '');
          setWhatsappSupport(data.platform_config.whatsapp_support || '');
          setSupportEmail(data.platform_config.support_email || '');
          setMonthlyFee(data.platform_config.monthly_subscription_fee || 15000);
          setInstructions(data.platform_config.instructions || '');
        } else if (data.banking_config) {
          setBankName(data.banking_config.bank_name);
          setAccountTitle(data.banking_config.account_title);
          setAccountNumber(data.banking_config.account_number);
          setIban(data.banking_config.iban || '');
          setBranchCode(data.banking_config.branch_code || '');
          setWhatsappSupport(data.banking_config.whatsapp_support || '');
          setSupportEmail(data.banking_config.support_email || '');
          setMonthlyFee(data.banking_config.monthly_subscription_fee);
          setInstructions(data.banking_config.instructions || '');
        }

        if (data.announcements) {
          setAnnouncements(data.announcements);
        }
      }
    } catch (err) {
      console.error('Failed fetching superadmin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/v1/saas/announcements', {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const body = await res.json();
        setAnnouncements(body.data || []);
      }
    } catch (err) {
      console.error('Failed fetching announcements:', err);
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

  // Subdomain Rename
  const openRenameModal = (tenant: SuperAdminTenantSummary) => {
    setSelectedTenantForRename(tenant);
    setNewSubdomainSlug(tenant.slug);
    setRenameModalOpen(true);
  };

  const handleSubdomainRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForRename || !newSubdomainSlug.trim()) return;

    setRenameLoading(true);
    setActionErrorMsg('');
    try {
      const res = await fetch(`/api/v1/saas/tenants/${selectedTenantForRename.id}/subdomain`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ new_slug: newSubdomainSlug.trim() })
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message || 'Failed updating subdomain');
      }

      setActionSuccessMsg(`Subdomain updated to '${body.data.tenant.slug}'. Previous slug preserved as 301 redirect.`);
      setRenameModalOpen(false);
      fetchOverview();
      setTimeout(() => setActionSuccessMsg(''), 5000);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Subdomain rename failed');
    } finally {
      setRenameLoading(false);
    }
  };

  // Suspension Actions
  const openSuspendModal = (tenant: SuperAdminTenantSummary) => {
    setSelectedTenantForSuspend(tenant);
    setSuspendReason('Terms of Service review pending annual license renewal.');
    setSuspendModalOpen(true);
  };

  const handleConfirmSuspend = async () => {
    if (!selectedTenantForSuspend) return;
    setSuspendLoading(true);
    setActionErrorMsg('');
    try {
      const res = await fetch(`/api/v1/saas/tenants/${selectedTenantForSuspend.id}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ reason: suspendReason.trim() })
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || 'Suspension failed');

      setActionSuccessMsg(`Academy '${selectedTenantForSuspend.name}' suspended. Staff and student access restricted.`);
      setSuspendModalOpen(false);
      fetchOverview();
      setTimeout(() => setActionSuccessMsg(''), 5000);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Suspension failed');
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleReinstate = async (tenant: SuperAdminTenantSummary) => {
    try {
      const res = await fetch(`/api/v1/saas/tenants/${tenant.id}/reinstate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({})
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || 'Reinstatement failed');

      setActionSuccessMsg(`Academy '${tenant.name}' reinstated. Full access restored.`);
      fetchOverview();
      setTimeout(() => setActionSuccessMsg(''), 5000);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Reinstatement failed');
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

  // Save Platform Global Config
  const handleSavePlatformConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setActionErrorMsg('');
    try {
      const res = await fetch('/api/v1/saas/platform-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          default_trial_days: Number(defaultTrialDays),
          grace_period_days: Number(gracePeriodDays),
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
        setActionSuccessMsg('Platform configuration updated. New trial policy & banking details are active.');
        fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        const body = await res.json();
        throw new Error(body.error?.message || 'Failed saving configuration');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Save failed');
    } finally {
      setSavingConfig(false);
    }
  };

  // Create Announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMessage.trim()) return;

    setCreatingAnnouncement(true);
    setActionErrorMsg('');
    try {
      const res = await fetch('/api/v1/saas/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          message: newMessage.trim(),
          type: newType,
          frequency: newFrequency,
          target_audience: newAudience,
          action_label: newActionLabel.trim() || null,
          action_url: newActionUrl.trim() || null
        })
      });

      if (res.ok) {
        setActionSuccessMsg('Platform announcement created and broadcast queue updated.');
        setNewTitle('');
        setNewMessage('');
        setNewActionLabel('');
        setNewActionUrl('');
        fetchAnnouncements();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        const body = await res.json();
        throw new Error(body.error?.message || 'Failed creating announcement');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Announcement creation failed');
    } finally {
      setCreatingAnnouncement(false);
    }
  };

  // Toggle Announcement
  const handleToggleAnnouncement = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/v1/saas/announcements/${id}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ is_active: !currentActive })
      });

      if (res.ok) {
        setActionSuccessMsg(`Announcement ${!currentActive ? 'activated' : 'deactivated'}.`);
        fetchAnnouncements();
        setTimeout(() => setActionSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Toggle failed');
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
                Manage registered academies, license renewals, trial policy, subdomains, and platform broadcasts.
              </p>
            </div>
          </div>

          <button
            onClick={() => { fetchOverview(); fetchAnnouncements(); }}
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
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Suspended / Locked</span>
            <span className="text-2xl font-black text-rose-300 mt-1 block font-mono">
              {(overview?.locked_tenants || 0) + (overview?.suspended_tenants || 0)}
            </span>
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold">
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
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
            activeTab === 'config'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Platform Global Config & Trial Policy</span>
        </button>

        <button
          onClick={() => { setActiveTab('announcements'); fetchAnnouncements(); }}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
            activeTab === 'announcements'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Director Broadcast Announcements ({announcements.filter(a => a.is_active).length} Active)</span>
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
            <span className="text-xs text-slate-500 font-mono">Instant Renewal & Control</span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="p-3.5">Academy Name</th>
                <th className="p-3.5">Subdomain</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Capacity</th>
                <th className="p-3.5">Trial / Renewal Expiry</th>
                <th className="p-3.5 text-right">Super-Admin Management Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {tenants.map(t => {
                const isSuspended = t.status === 'suspended';
                const isLocked = !isSuspended && (t.status === 'locked' || new Date(t.trial_ends_at).getTime() < Date.now());
                return (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{t.tier.toUpperCase()} TIER</span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 font-mono text-slate-600 font-bold">
                        <span>{t.slug}</span>
                        <button
                          onClick={() => openRenameModal(t)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                          title="Rename Subdomain Slug"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{t.slug}.kampus.pk</div>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isSuspended
                          ? 'bg-red-100 text-red-900 border border-red-300'
                          : isLocked
                            ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                            : t.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                      }`}>
                        {isSuspended ? 'SUSPENDED' : isLocked ? 'LOCKED (EXPIRED)' : t.status}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="text-slate-800 font-semibold">{t.student_count} Students</div>
                      <div className="text-[10px] text-slate-400">{t.teacher_count} Faculty Staff</div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      <div>{new Date(t.trial_ends_at).toLocaleDateString()}</div>
                      <span className="text-[10px] text-slate-400">
                        {isSuspended ? 'Suspended' : isLocked ? 'Expired' : 'Valid'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleActivateAcademy(t.id, 1)}
                          className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all"
                          title="Activate Academy for 1 Month"
                        >
                          +1M
                        </button>
                        <button
                          onClick={() => handleActivateAcademy(t.id, 6)}
                          className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all"
                          title="Activate Academy for 6 Months"
                        >
                          +6M
                        </button>
                        
                        {isSuspended ? (
                          <button
                            onClick={() => handleReinstate(t)}
                            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 transition-all"
                            title="Reinstate Academy"
                          >
                            <Play className="w-3 h-3" />
                            Reinstate
                          </button>
                        ) : (
                          <button
                            onClick={() => openSuspendModal(t)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-700 text-slate-300 hover:text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 transition-all"
                            title="Suspend Academy"
                          >
                            <Ban className="w-3 h-3" />
                            Suspend
                          </button>
                        )}
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
          TAB 3: PLATFORM GLOBAL CONFIGURATION & TRIAL POLICY
          ===================================================================== */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs max-w-3xl space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base">SuperAdmin Platform Global Configuration</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage universal trial durations, grace periods, and official settlement banking details.
            </p>
          </div>

          <form onSubmit={handleSavePlatformConfig} className="space-y-5 text-xs">
            
            {/* Trial & Grace Period Policies */}
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-700" />
                <span className="font-bold text-indigo-950 text-xs uppercase tracking-wider">
                  Universal Free Trial & Grace Period Policy
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Default Free Trial (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={defaultTrialDays}
                    onChange={e => setDefaultTrialDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Forward-looking: applies automatically to all new academy registrations.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Billing Grace Period (Days) *</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    required
                    value={gracePeriodDays}
                    onChange={e => setGracePeriodDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Days after expiration before full lockout banner is enforced.
                  </span>
                </div>
              </div>
            </div>

            {/* Official Platform Banking Credentials */}
            <div className="space-y-4 pt-2">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                Official Settlement Banking Credentials
              </h4>

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
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">IBAN (24 Digits)</label>
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
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Branch Code & City</label>
                  <input
                    type="text"
                    value={branchCode}
                    onChange={e => setBranchCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">WhatsApp Billing Hotline</label>
                  <input
                    type="text"
                    value={whatsappSupport}
                    onChange={e => setWhatsappSupport(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Standard Monthly Fee (PKR)</label>
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
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Instructions</label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{savingConfig ? 'Saving...' : 'Save Platform Global Configuration'}</span>
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          TAB 4: DIRECTOR BROADCAST ANNOUNCEMENTS DESK
          ===================================================================== */}
      {activeTab === 'announcements' && (
        <div className="space-y-6">
          
          {/* Create Announcement Box */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs max-w-3xl space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Broadcast Platform Announcement</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deliver high-priority advisory popups to academy directors upon login.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Announcement Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scheduled Core Infrastructure Upgrade on Sunday"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Message Content *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Write clear, professional instructions or advisories for academy leadership..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Notice Classification</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="system">System Notice</option>
                    <option value="maintenance">Scheduled Maintenance</option>
                    <option value="warning">Advisory / Warning</option>
                    <option value="urgent">Urgent Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Display Frequency</label>
                  <select
                    value={newFrequency}
                    onChange={e => setNewFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="once_dismissible">Once (Dismissible & Persisted)</option>
                    <option value="every_login">Every Login (Mandatory Alert)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Audience</label>
                  <select
                    value={newAudience}
                    onChange={e => setNewAudience(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="all">All Academies & Directors</option>
                    <option value="admin_only">Directors & Admins Only</option>
                    <option value="trial_expiring">Trial Expiring (&lt; 5 Days)</option>
                    <option value="grace_period">Grace Period Accounts</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Optional Action Button Label</label>
                  <input
                    type="text"
                    placeholder="e.g. View Maintenance Schedule"
                    value={newActionLabel}
                    onChange={e => setNewActionLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Action URL</label>
                  <input
                    type="url"
                    placeholder="https://status.kampus.pk"
                    value={newActionUrl}
                    onChange={e => setNewActionUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creatingAnnouncement}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{creatingAnnouncement ? 'Publishing...' : 'Publish Platform Announcement'}</span>
              </button>
            </form>
          </div>

          {/* Past Announcements Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Active & Archived Platform Announcements
              </h3>
              <span className="text-xs text-slate-500 font-mono">Real-Time Control</span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="p-3.5">Title & Message</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Frequency</th>
                  <th className="p-3.5">Audience</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {announcements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">No broadcast announcements created yet.</td>
                  </tr>
                ) : (
                  announcements.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/70">
                      <td className="p-3.5 max-w-sm">
                        <div className="font-bold text-slate-900">{a.title}</div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{a.message}</p>
                        {a.action_url && (
                          <div className="text-[10px] text-indigo-600 font-mono mt-1 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            <span>{a.action_label || a.action_url}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {a.type}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-600">
                        {a.frequency === 'every_login' ? 'Every Login' : 'Once (Dismissible)'}
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-600">
                        {a.target_audience}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          a.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {a.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleToggleAnnouncement(a.id, a.is_active)}
                          className={`px-3 py-1.5 font-bold text-xs rounded-lg transition-all ${
                            a.is_active
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {a.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBDOMAIN RENAME MODAL
          ===================================================================== */}
      {renameModalOpen && selectedTenantForRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Rename Academy Subdomain</h3>
              </div>
              <button
                onClick={() => setRenameModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubdomainRename} className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-slate-500">Academy:</span>
                <div className="font-bold text-slate-900 text-sm">{selectedTenantForRename.name}</div>
                <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                  Current: <strong className="text-slate-800">{selectedTenantForRename.slug}.kampus.pk</strong>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">New Subdomain Identifier *</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    value={newSubdomainSlug}
                    onChange={e => setNewSubdomainSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-l-xl font-mono text-xs font-bold"
                    placeholder="new-subdomain"
                  />
                  <span className="px-3 py-2 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl font-mono text-xs text-slate-500">
                    .kampus.pk
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                <strong>Zero Broken Links Guarantee:</strong> The previous slug (<span className="font-mono font-bold">{selectedTenantForRename.slug}</span>) will be stored in <span className="font-mono">tenant_slug_aliases</span> with automatic 301 redirection. Existing bookmarks, QR codes, and printed fee challans will continue resolving transparently.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  {renameLoading ? 'Updating Subdomain...' : 'Confirm Subdomain Rename'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          ACADEMY SUSPENSION MODAL
          ===================================================================== */}
      {suspendModalOpen && selectedTenantForSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-300 overflow-hidden">
            <div className="p-5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
                <h3 className="font-bold text-rose-950 text-sm">Suspend Academy Tenant</h3>
              </div>
              <button
                onClick={() => setSuspendModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-slate-500">Target Academy:</span>
                <div className="font-bold text-slate-900 text-sm">{selectedTenantForSuspend.name}</div>
                <span className="text-slate-400 font-mono text-[11px]">{selectedTenantForSuspend.slug}.kampus.pk</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Administrative Suspension Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px] leading-relaxed">
                <strong>Enforcement Policy:</strong> All teacher and student access will be blocked immediately (403 ACADEMY_SUSPENDED). The Campus Director will be isolated to the Billing Settlement Desk to review pending invoices and submit proof of payment.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSuspendModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSuspend}
                  disabled={suspendLoading}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 disabled:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  {suspendLoading ? 'Suspending Academy...' : 'Suspend Academy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
