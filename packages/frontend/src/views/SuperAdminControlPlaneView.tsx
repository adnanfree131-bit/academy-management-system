import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  SuperAdminOverview, 
  SuperAdminTenantSummary, 
  SubscriptionPaymentReceipt, 
  PlatformAnnouncement
} from '@apex/shared-types';
import { 
  Building2, 
  CreditCard, 
  Settings2, 
  Bell, 
  Check, 
  X, 
  RefreshCw, 
  Globe, 
  Ban, 
  Play, 
  Edit3, 
  Save, 
  CheckCircle2, 
  AlertTriangle,
  ExternalLink,
  Shield
} from 'lucide-react';

export const SuperAdminControlPlaneView: React.FC = () => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<SuperAdminOverview | null>(null);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'academies' | 'receipts' | 'config' | 'announcements'>('academies');

  // Action status messages
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');
  const [actionErrorMsg, setActionErrorMsg] = useState<string>('');

  // Subdomain Rename Modal State
  const [selectedTenantForRename, setSelectedTenantForRename] = useState<SuperAdminTenantSummary | null>(null);
  const [newSubdomainSlug, setNewSubdomainSlug] = useState<string>('');
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [renameLoading, setRenameLoading] = useState<boolean>(false);

  // Suspension Modal State
  const [selectedTenantForSuspend, setSelectedTenantForSuspend] = useState<SuperAdminTenantSummary | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('Unpaid Subscription Invoice');
  const [suspendModalOpen, setSuspendModalOpen] = useState<boolean>(false);
  const [suspendLoading, setSuspendLoading] = useState<boolean>(false);

  // Platform Config Edit State
  const [defaultTrialDays, setDefaultTrialDays] = useState<number>(30);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(5);
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

  // Create Broadcast Announcement State
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
      setLoading(true);
      const res = await fetch('/api/v1/saas/superadmin/overview', {
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      });
      const body = await res.json();
      if (res.ok && body.data) {
        const data: SuperAdminOverview = body.data;
        setOverview(data);

        // Prepopulate config form
        if (data.platform_config) {
          setDefaultTrialDays(data.platform_config.default_trial_days || 30);
          setGracePeriodDays(data.platform_config.grace_period_days || 5);
        }
        if (data.banking_config) {
          setBankName(data.banking_config.bank_name || '');
          setAccountTitle(data.banking_config.account_title || '');
          setAccountNumber(data.banking_config.account_number || '');
          setIban(data.banking_config.iban || '');
          setBranchCode(data.banking_config.branch_code || '');
          setWhatsappSupport(data.banking_config.whatsapp_support || '');
          setSupportEmail(data.banking_config.support_email || 'kampuserp@gmail.com');
          setMonthlyFee(data.banking_config.monthly_subscription_fee || 15000);
          setInstructions(data.banking_config.instructions || '');
        }
        if (data.announcements) {
          setAnnouncements(data.announcements);
        }
      } else {
        throw new Error(body.error?.message || 'Failed to load platform data');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Error connecting to platform API');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/v1/saas/announcements?include_inactive=true', {
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
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

  // Activate / Extend Academy Subscription
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
        setActionSuccessMsg(`Subscription extended by ${durationMonths} month(s).`);
        fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        const body = await res.json();
        throw new Error(body.error?.message || 'Activation failed');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Activation failed');
    }
  };

  // Open Subdomain Rename Modal
  const openRenameModal = (tenant: SuperAdminTenantSummary) => {
    setSelectedTenantForRename(tenant);
    setNewSubdomainSlug(tenant.slug);
    setRenameModalOpen(true);
  };

  // Submit Subdomain Rename
  const handleSubdomainRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForRename) return;

    setRenameLoading(true);
    setActionErrorMsg('');
    try {
      const res = await fetch(`/api/v1/saas/tenants/${selectedTenantForRename.id}/subdomain`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ new_slug: newSubdomainSlug })
      });

      const body = await res.json();
      if (res.ok) {
        setActionSuccessMsg(`Subdomain updated from ${body.data.previous_slug} to ${body.data.tenant.slug}. Permanent 301 alias created.`);
        setRenameModalOpen(false);
        fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 5000);
      } else {
        throw new Error(body.error?.message || 'Subdomain update failed');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed updating subdomain');
    } finally {
      setRenameLoading(false);
    }
  };

  // Open Suspend Modal
  const openSuspendModal = (tenant: SuperAdminTenantSummary) => {
    setSelectedTenantForSuspend(tenant);
    setSuspendReason('Unpaid Subscription Invoice');
    setSuspendModalOpen(true);
  };

  // Confirm Suspend
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
        body: JSON.stringify({ reason: suspendReason })
      });

      if (res.ok) {
        setActionSuccessMsg(`Academy ${selectedTenantForSuspend.name} suspended. Portal access restricted to billing desk.`);
        setSuspendModalOpen(false);
        fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 5000);
      } else {
        const body = await res.json();
        throw new Error(body.error?.message || 'Suspension failed');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed suspending academy');
    } finally {
      setSuspendLoading(false);
    }
  };

  // Reinstate Academy
  const handleReinstate = async (tenant: SuperAdminTenantSummary) => {
    try {
      const res = await fetch(`/api/v1/saas/tenants/${tenant.id}/reinstate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      });

      if (res.ok) {
        setActionSuccessMsg(`Academy ${tenant.name} reinstated to active status.`);
        fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        const body = await res.json();
        throw new Error(body.error?.message || 'Reinstatement failed');
      }
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
        setActionSuccessMsg(`Receipt ${status === 'APPROVED' ? 'approved & subscription activated' : 'rejected'}.`);
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
        setActionSuccessMsg('Platform configuration saved successfully.');
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
        setActionSuccessMsg('Broadcast notice published.');
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
        setActionSuccessMsg(`Notice ${!currentActive ? 'activated' : 'deactivated'}.`);
        fetchAnnouncements();
        setTimeout(() => setActionSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Toggle failed');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs font-medium">Loading platform records...</p>
      </div>
    );
  }

  const tenants: SuperAdminTenantSummary[] = overview?.tenants || [];
  const receipts: SubscriptionPaymentReceipt[] = overview?.recent_receipts || [];

  return (
    <div className="space-y-5">
      
      {/* Institutional Document-Grade Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-700" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Platform Administration</h1>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-mono uppercase font-semibold rounded">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Registered academy accounts, subscription ledgers, trial terms, and broadcast notices.
            </p>
          </div>

          <button
            onClick={() => { fetchOverview(); fetchAnnouncements(); }}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded border border-slate-300 flex items-center gap-1.5 transition-colors self-start sm:self-auto shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh Data</span>
          </button>
        </div>

        {/* High-Density Tabular Metrics Strip */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-slate-200 rounded bg-slate-50/50 divide-x divide-y lg:divide-y-0 divide-slate-200 text-xs">
          <div className="p-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Total Academies</span>
            <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">{overview?.total_tenants || 0}</span>
          </div>

          <div className="p-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Active Accounts</span>
            <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">{overview?.active_tenants || 0}</span>
          </div>

          <div className="p-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Trial Accounts</span>
            <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">{overview?.trial_tenants || 0}</span>
          </div>

          <div className="p-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Suspended / Locked</span>
            <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">
              {(overview?.locked_tenants || 0) + (overview?.suspended_tenants || 0)}
            </span>
          </div>

          <div className="p-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Monthly MRR</span>
            <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">PKR {(overview?.platform_mrr || 0).toLocaleString()}</span>
          </div>

          <div className="p-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Annual ARR</span>
            <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">PKR {(overview?.platform_arr || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionErrorMsg}</span>
        </div>
      )}

      {/* Standard Institutional Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('academies')}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'academies'
              ? 'border-indigo-600 text-indigo-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Academy Directory ({tenants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'receipts'
              ? 'border-indigo-600 text-indigo-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Subscription Receipts ({receipts.filter(r => r.status === 'PENDING').length} Pending)</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'config'
              ? 'border-indigo-600 text-indigo-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Platform Settings</span>
        </button>

        <button
          onClick={() => { setActiveTab('announcements'); fetchAnnouncements(); }}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'announcements'
              ? 'border-indigo-600 text-indigo-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Broadcast Notices ({announcements.filter(a => a.is_active).length} Active)</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: ACADEMY DIRECTORY
          ===================================================================== */}
      {activeTab === 'academies' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Registered Academies Register
            </h2>
            <span className="text-xs text-slate-500 font-mono">Total Records: {tenants.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="p-3">Academy Name</th>
                  <th className="p-3">Subdomain & Routing</th>
                  <th className="p-3">Account Status</th>
                  <th className="p-3">Enrollment</th>
                  <th className="p-3">Valid Until</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tenants.map(t => {
                  const isSuspended = t.status === 'suspended';
                  const isLocked = !isSuspended && (t.status === 'locked' || new Date(t.trial_ends_at).getTime() < Date.now());
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{t.name}</div>
                        <span className="text-[10px] text-slate-500 font-mono uppercase">{t.tier} Tier</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 font-mono text-slate-700">
                          <span className="font-semibold">{t.slug}</span>
                          <button
                            onClick={() => openRenameModal(t)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                            title="Edit Subdomain"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{t.slug}.kampus.pk</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                          isSuspended
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : isLocked
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : t.status === 'active'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {isSuspended ? 'Suspended' : isLocked ? 'Locked (Expired)' : t.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-800 font-medium">{t.student_count} Students</div>
                        <div className="text-[10px] text-slate-400">{t.teacher_count} Faculty</div>
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        <div>{new Date(t.trial_ends_at).toLocaleDateString()}</div>
                        <span className="text-[10px] text-slate-400">
                          {isSuspended ? 'Suspended' : isLocked ? 'Expired' : 'Active'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleActivateAcademy(t.id, 1)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded border border-slate-300 shadow-xs transition-colors"
                            title="Extend validity by 1 Month"
                          >
                            +30 Days
                          </button>
                          <button
                            onClick={() => handleActivateAcademy(t.id, 6)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded border border-slate-300 shadow-xs transition-colors"
                            title="Extend validity by 6 Months"
                          >
                            +180 Days
                          </button>
                          
                          {isSuspended ? (
                            <button
                              onClick={() => handleReinstate(t)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded shadow-xs flex items-center gap-1 transition-colors"
                              title="Reinstate Academy"
                            >
                              <Play className="w-3 h-3" />
                              <span>Reinstate</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => openSuspendModal(t)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs rounded shadow-xs flex items-center gap-1 transition-colors"
                              title="Suspend Academy"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Suspend</span>
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
        </div>
      )}

      {/* =====================================================================
          TAB 2: SUBSCRIPTION RECEIPTS QUEUE
          ===================================================================== */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Subscription Payment Receipts Register
            </h2>
            <span className="text-xs text-slate-500">Offline Bank Transfer Receipts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="p-3">Submission Date</th>
                  <th className="p-3">Academy</th>
                  <th className="p-3">Amount & Duration</th>
                  <th className="p-3">Method & TRX</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">No payment receipts currently submitted.</td>
                  </tr>
                ) : (
                  receipts.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="p-3 font-mono text-slate-500">
                        {new Date(rec.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{rec.tenant_name}</div>
                        <div className="text-[10px] text-slate-400">{rec.uploaded_by_email}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-900">PKR {rec.amount.toLocaleString()}</div>
                        <span className="text-[10px] text-slate-500 font-medium">{rec.plan_duration_months} Month(s)</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] rounded border border-slate-200">
                          {rec.payment_method}
                        </span>
                        <div className="font-mono text-[11px] text-slate-600 mt-0.5">TRX: {rec.reference_number || 'N/A'}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                          rec.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : rec.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {rec.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleReviewReceipt(rec.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded shadow-xs flex items-center gap-1 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleReviewReceipt(rec.id, 'REJECTED')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs rounded shadow-xs flex items-center gap-1 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Processed</span>
                        )}
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
          TAB 3: PLATFORM PARAMETERS & SETTINGS
          ===================================================================== */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs max-w-3xl space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
              Platform Configuration & Policy Parameters
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Default free trial duration, grace period, and settlement bank details for offline subscriptions.
            </p>
          </div>

          <form onSubmit={handleSavePlatformConfig} className="space-y-5 text-xs">
            
            {/* Free Trial & Grace Period Terms */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block">
                Free Trial & Grace Period Policy
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Default Free Trial (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={defaultTrialDays}
                    onChange={e => setDefaultTrialDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono font-semibold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Applies to all newly registered academies.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Grace Period (Days) *</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    required
                    value={gracePeriodDays}
                    onChange={e => setGracePeriodDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono font-semibold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Days after subscription expiry before portal lock is enforced.
                  </span>
                </div>
              </div>
            </div>

            {/* Platform Receiving Bank Account */}
            <div className="space-y-4 pt-1">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200 pb-2 block">
                Platform Receiving Bank Account
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bank Name *</label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Account Title *</label>
                  <input
                    type="text"
                    required
                    value={accountTitle}
                    onChange={e => setAccountTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Account Number *</label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">IBAN (24 Digits)</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={e => setIban(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Branch Code & City</label>
                  <input
                    type="text"
                    value={branchCode}
                    onChange={e => setBranchCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">WhatsApp Support Contact</label>
                  <input
                    type="text"
                    value={whatsappSupport}
                    onChange={e => setWhatsappSupport(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Monthly Subscription Fee (PKR)</label>
                  <input
                    type="number"
                    required
                    value={monthlyFee}
                    onChange={e => setMonthlyFee(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Platform Support Email</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={e => setSupportEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Payment Instructions</label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs leading-relaxed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs rounded shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{savingConfig ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          TAB 4: BROADCAST NOTICES
          ===================================================================== */}
      {activeTab === 'announcements' && (
        <div className="space-y-5">
          
          {/* Create Broadcast Notice Form */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs max-w-3xl space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                Create Broadcast Notice
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Issue operational advisories or billing reminders to academy directors upon login.
              </p>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Notice Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scheduled Infrastructure Maintenance Notice"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Notice Message Body *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide precise institutional details or instructions..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Notice Classification</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="system">System Notice</option>
                    <option value="maintenance">Maintenance Advisory</option>
                    <option value="warning">Important Alert</option>
                    <option value="urgent">Urgent Notice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Display Rule</label>
                  <select
                    value={newFrequency}
                    onChange={e => setNewFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="once_dismissible">Once (Dismissible)</option>
                    <option value="every_login">Every Login (Mandatory)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Audience Scope</label>
                  <select
                    value={newAudience}
                    onChange={e => setNewAudience(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="all">All Academies</option>
                    <option value="admin_only">Directors & Admins Only</option>
                    <option value="trial_expiring">Trial Expiring (&lt; 5 Days)</option>
                    <option value="grace_period">Grace Period Accounts</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Action Button Text (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. View Billing Ledger"
                    value={newActionLabel}
                    onChange={e => setNewActionLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Action URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://app.kampus.pk/billing"
                    value={newActionUrl}
                    onChange={e => setNewActionUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creatingAnnouncement}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs rounded shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{creatingAnnouncement ? 'Publishing...' : 'Publish Broadcast Notice'}</span>
              </button>
            </form>
          </div>

          {/* Broadcast Notices Register */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Broadcast Notices Register
              </h2>
              <span className="text-xs text-slate-500 font-mono">Total: {announcements.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="p-3">Notice Subject & Content</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Display Rule</th>
                    <th className="p-3">Scope</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {announcements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">No broadcast notices published yet.</td>
                    </tr>
                  ) : (
                    announcements.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="p-3 max-w-sm">
                          <div className="font-bold text-slate-900">{a.title}</div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{a.message}</p>
                          {a.action_url && (
                            <div className="text-[10px] text-indigo-600 font-mono mt-1 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" />
                              <span>{a.action_label || a.action_url}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                            {a.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          {a.frequency === 'every_login' ? 'Every Login' : 'Once (Dismissible)'}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          {a.target_audience}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                            a.is_active ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {a.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleToggleAnnouncement(a.id, a.is_active)}
                            className={`px-2.5 py-1 font-semibold text-xs rounded transition-colors border ${
                              a.is_active
                                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                : 'bg-white hover:bg-slate-50 text-emerald-700 border-emerald-300'
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
        </div>
      )}

      {/* =====================================================================
          SUBDOMAIN RENAME MODAL
          ===================================================================== */}
      {renameModalOpen && selectedTenantForRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-slate-900 text-sm">Update Academy Subdomain</h3>
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
                <span className="text-slate-500 text-[11px]">Academy:</span>
                <div className="font-bold text-slate-900 text-sm">{selectedTenantForRename.name}</div>
                <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                  Current: <strong className="text-slate-800">{selectedTenantForRename.slug}.kampus.pk</strong>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Subdomain Identifier *</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    value={newSubdomainSlug}
                    onChange={e => setNewSubdomainSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-l font-mono text-xs font-semibold"
                    placeholder="new-subdomain"
                  />
                  <span className="px-3 py-2 bg-slate-100 border border-l-0 border-slate-300 rounded-r font-mono text-xs text-slate-500">
                    .kampus.pk
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[11px] leading-relaxed">
                The previous subdomain (<span className="font-mono font-semibold">{selectedTenantForRename.slug}</span>) is retained as a permanent alias. Existing bookmarks, printed challans, and links will continue to route seamlessly.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameLoading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs rounded shadow-xs transition-colors"
                >
                  {renameLoading ? 'Updating Subdomain...' : 'Save Subdomain'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-rose-300 overflow-hidden">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700" />
                <h3 className="font-bold text-rose-950 text-sm">Suspend Academy Account</h3>
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
                <span className="text-slate-500 text-[11px]">Target Academy:</span>
                <div className="font-bold text-slate-900 text-sm">{selectedTenantForSuspend.name}</div>
                <span className="text-slate-400 font-mono text-[11px]">{selectedTenantForSuspend.slug}.kampus.pk</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Administrative Suspension Reason *</label>
                <select
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs mb-2"
                >
                  <option value="Unpaid Subscription Invoice">Unpaid Subscription Invoice</option>
                  <option value="Administrative Review">Administrative Review</option>
                  <option value="Terms of Service Violation">Terms of Service Violation</option>
                  <option value="Account Restructuring">Account Restructuring</option>
                </select>
                <textarea
                  rows={2}
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs leading-relaxed"
                  placeholder="Additional notes for suspension record..."
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[11px] leading-relaxed">
                Faculty and student access will be blocked immediately (403 ACADEMY_SUSPENDED). The Academy Director retains restricted access to the billing desk to upload payment proof.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSuspendModalOpen(false)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSuspend}
                  disabled={suspendLoading}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 disabled:bg-rose-400 text-white font-semibold text-xs rounded shadow-xs transition-colors"
                >
                  {suspendLoading ? 'Suspending...' : 'Confirm Suspension'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
