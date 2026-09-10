import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  SuperAdminOverview, 
  SuperAdminTenantSummary, 
  SubscriptionPaymentReceipt, 
  PlatformAnnouncement,
  UpdateTenantBillingRequest,
  RenewTenantSubscriptionRequest
} from '@apex/shared-types';
import { 
  Building2, 
  CreditCard, 
  Settings2, 
  Bell,
  HardDrive, 
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
  Shield,
  Trash2,
  Archive,
  Calendar,
  FileText
} from 'lucide-react';

export const SuperAdminControlPlaneView: React.FC = () => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<SuperAdminOverview | null>(null);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'academies' | 'receipts' | 'config' | 'announcements' | 'backups'>('academies');
  const [backups, setBackups] = useState<{ id: number; kind: string; academy_count: number; created_at: string }[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);

  // Action status messages
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');
  const [actionErrorMsg, setActionErrorMsg] = useState<string>('');

  // 1. Academy Dossier Modal State
  const [dossierModalOpen, setDossierModalOpen] = useState<boolean>(false);
  const [selectedTenantForDossier, setSelectedTenantForDossier] = useState<SuperAdminTenantSummary | null>(null);
  const [dossierMonthlyFee, setDossierMonthlyFee] = useState<number>(15000);
  const [dossierAnchorDay, setDossierAnchorDay] = useState<number>(1);
  const [dossierGracePeriod, setDossierGracePeriod] = useState<number>(5);
  const [savingBillingParams, setSavingBillingParams] = useState<boolean>(false);

  // 2. Advance / Custom Payment Modal State
  const [advanceModalOpen, setAdvanceModalOpen] = useState<boolean>(false);
  const [selectedTenantForAdvance, setSelectedTenantForAdvance] = useState<SuperAdminTenantSummary | null>(null);
  const [advanceDurationMonths, setAdvanceDurationMonths] = useState<number>(1);
  const [advanceCustomAmount, setAdvanceCustomAmount] = useState<number>(15000);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<string>('MEEZAN_IBFT');
  const [advanceReferenceNumber, setAdvanceReferenceNumber] = useState<string>('');
  const [advanceNotes, setAdvanceNotes] = useState<string>('');
  const [processingAdvance, setProcessingAdvance] = useState<boolean>(false);

  // 3. Subdomain Rename Modal State
  const [selectedTenantForRename, setSelectedTenantForRename] = useState<SuperAdminTenantSummary | null>(null);
  const [newSubdomainSlug, setNewSubdomainSlug] = useState<string>('');
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [renameLoading, setRenameLoading] = useState<boolean>(false);

  // 4. Suspension Modal State
  const [selectedTenantForSuspend, setSelectedTenantForSuspend] = useState<SuperAdminTenantSummary | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('Unpaid Subscription Invoice');
  const [suspendModalOpen, setSuspendModalOpen] = useState<boolean>(false);
  const [suspendLoading, setSuspendLoading] = useState<boolean>(false);

  // 5. Hard Delete & Purge Confirmation Modal State
  const [hardDeleteModalOpen, setHardDeleteModalOpen] = useState<boolean>(false);
  const [selectedTenantForHardDelete, setSelectedTenantForHardDelete] = useState<SuperAdminTenantSummary | null>(null);
  const [hardDeleteConfirmSlug, setHardDeleteConfirmSlug] = useState<string>('');
  const [purgingTenant, setPurgingTenant] = useState<boolean>(false);

  // 6. Broadcast Announcement Edit Modal State
  const [editNoticeModalOpen, setEditNoticeModalOpen] = useState<boolean>(false);
  const [selectedNoticeForEdit, setSelectedNoticeForEdit] = useState<PlatformAnnouncement | null>(null);
  const [editNoticeTitle, setEditNoticeTitle] = useState<string>('');
  const [editNoticeMessage, setEditNoticeMessage] = useState<string>('');
  const [editNoticeType, setEditNoticeType] = useState<PlatformAnnouncement['type']>('system');
  const [editNoticeFrequency, setEditNoticeFrequency] = useState<PlatformAnnouncement['frequency']>('once_dismissible');
  const [editNoticeAudience, setEditNoticeAudience] = useState<PlatformAnnouncement['target_audience']>('all');
  const [editNoticeActionLabel, setEditNoticeActionLabel] = useState<string>('');
  const [editNoticeActionUrl, setEditNoticeActionUrl] = useState<string>('');
  const [savingNoticeEdit, setSavingNoticeEdit] = useState<boolean>(false);

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

        // If dossier modal is open, refresh selected tenant data
        if (selectedTenantForDossier) {
          const fresh = data.tenants.find(t => t.id === selectedTenantForDossier.id);
          if (fresh) setSelectedTenantForDossier(fresh);
        }

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

  const fetchBackups = async () => {
    setBackupsLoading(true);
    try {
      const res = await fetch('/api/v1/saas/backups', {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const body = await res.json();
        setBackups(body.data || []);
      }
    } catch (err) {
      console.error('Failed fetching backups:', err);
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/v1/saas/backups/export', {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Download failed');
      const file = await res.json();
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kampus-backup-${(file.exported_at || new Date().toISOString()).slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActionSuccessMsg('Backup downloaded. Keep this file before you start development.');
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Download failed');
    }
  };

  const handleUploadBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const typed = window.prompt('This replaces live academy data from the uploaded file.\nType RESTORE to continue.');
    if (typed !== 'RESTORE') return;
    try {
      const parsed = JSON.parse(await file.text());
      const res = await fetch('/api/v1/saas/backups/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(parsed),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error?.message || 'Import failed');
      setActionSuccessMsg(body.message || 'Backup imported.');
      await fetchOverview();
      await fetchBackups();
      setTimeout(() => setActionSuccessMsg(''), 5000);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Import failed');
    }
  };

  const handleCreateBackup = async () => {
    try {
      const res = await fetch('/api/v1/saas/backups', {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Backup failed');
      }
      setActionSuccessMsg('Manual backup saved.');
      await fetchBackups();
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Backup failed');
    }
  };

  const handleRestoreBackup = async (id: number, academyCount: number) => {
    const typed = window.prompt(
      `This replaces live academy data with backup #${id} (${academyCount} academies).\nType RESTORE to continue.`
    );
    if (typed !== 'RESTORE') return;
    try {
      const res = await fetch(`/api/v1/saas/backups/${id}/restore`, {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error?.message || 'Restore failed');
      setActionSuccessMsg(body.message || 'Backup restored.');
      await fetchOverview();
      await fetchBackups();
      setTimeout(() => setActionSuccessMsg(''), 5000);
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Restore failed');
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  // Open Dossier Modal
  const openDossierModal = (tenant: SuperAdminTenantSummary) => {
    setSelectedTenantForDossier(tenant);
    setDossierMonthlyFee(tenant.custom_monthly_fee ?? (overview?.banking_config?.monthly_subscription_fee || 15000));
    setDossierAnchorDay(tenant.billing_cycle_anchor_day ?? new Date(tenant.trial_ends_at || Date.now()).getDate());
    setDossierGracePeriod(tenant.individual_grace_period_days ?? (overview?.platform_config?.grace_period_days || 5));
    setDossierModalOpen(true);
  };

  // Save Per-Academy Billing Parameters
  const handleSaveBillingParams = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForDossier) return;

    setSavingBillingParams(true);
    setActionErrorMsg('');
    try {
      const payload: UpdateTenantBillingRequest = {
        custom_monthly_fee: Number(dossierMonthlyFee),
        billing_cycle_anchor_day: Number(dossierAnchorDay),
        individual_grace_period_days: Number(dossierGracePeriod)
      };

      const res = await fetch(`/api/v1/saas/tenants/${selectedTenantForDossier.id}/billing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const body = await res.json();
      if (res.ok) {
        setActionSuccessMsg(`Billing parameters updated for '${selectedTenantForDossier.name}'.`);
        await fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        throw new Error(body.error?.message || 'Failed saving billing settings');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed saving billing parameters');
    } finally {
      setSavingBillingParams(false);
    }
  };

  // One-Click Payment Received (+1 Month Auto-Extend Anchored)
  const handleOneClickExtendOneMonth = async (tenant: SuperAdminTenantSummary) => {
    try {
      const rate = tenant.custom_monthly_fee ?? (overview?.banking_config?.monthly_subscription_fee || 15000);
      const res = await fetch(`/api/v1/saas/tenants/${tenant.id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          duration_months: 1,
          custom_amount: rate,
          payment_method: 'CASH',
          notes: 'One-click monthly payment collected via administrative control plane'
        })
      });

      const body = await res.json();
      if (res.ok) {
        setActionSuccessMsg(body.message || `Payment recorded. Subscription for '${tenant.name}' extended by 1 month.`);
        await fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 5000);
      } else {
        throw new Error(body.error?.message || 'Payment renewal failed');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Payment renewal failed');
    }
  };

  // Open Advance Payment Modal
  const openAdvanceModal = (tenant: SuperAdminTenantSummary) => {
    setSelectedTenantForAdvance(tenant);
    setAdvanceDurationMonths(1);
    const rate = tenant.custom_monthly_fee ?? (overview?.banking_config?.monthly_subscription_fee || 15000);
    setAdvanceCustomAmount(rate);
    setAdvancePaymentMethod('MEEZAN_IBFT');
    setAdvanceReferenceNumber('');
    setAdvanceNotes('');
    setAdvanceModalOpen(true);
  };

  // Duration changed in Advance Modal -> auto-update amount (rate * months)
  const handleAdvanceDurationChange = (months: number) => {
    setAdvanceDurationMonths(months);
    if (selectedTenantForAdvance) {
      const rate = selectedTenantForAdvance.custom_monthly_fee ?? (overview?.banking_config?.monthly_subscription_fee || 15000);
      setAdvanceCustomAmount(rate * months);
    }
  };

  // Submit Advance Payment
  const handleSubmitAdvancePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForAdvance) return;

    setProcessingAdvance(true);
    setActionErrorMsg('');
    try {
      const payload: RenewTenantSubscriptionRequest = {
        duration_months: Number(advanceDurationMonths),
        custom_amount: Number(advanceCustomAmount),
        payment_method: advancePaymentMethod,
        reference_number: advanceReferenceNumber.trim() || undefined,
        notes: advanceNotes.trim() || undefined
      };

      const res = await fetch(`/api/v1/saas/tenants/${selectedTenantForAdvance.id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const body = await res.json();
      if (res.ok) {
        setActionSuccessMsg(body.message || `Advance payment recorded. Subscription extended by ${advanceDurationMonths} month(s).`);
        setAdvanceModalOpen(false);
        await fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 5000);
      } else {
        throw new Error(body.error?.message || 'Failed recording advance payment');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed recording advance payment');
    } finally {
      setProcessingAdvance(false);
    }
  };

  // Soft Archive / Unarchive Academy
  const handleToggleArchive = async (tenant: SuperAdminTenantSummary) => {
    const isArchiving = tenant.status !== 'archived';
    const confirmPrompt = isArchiving 
      ? `Are you sure you want to soft-archive '${tenant.name}'? Academy access will be paused but historical records remain intact.`
      : `Reinstate archived academy '${tenant.name}' back to active status?`;

    if (!window.confirm(confirmPrompt)) return;

    try {
      const res = await fetch(`/api/v1/saas/tenants/${tenant.id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ reason: isArchiving ? 'Archived by SuperAdmin' : undefined })
      });

      const body = await res.json();
      if (res.ok) {
        setActionSuccessMsg(body.message || `Academy status updated.`);
        await fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        throw new Error(body.error?.message || 'Archive operation failed');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Archive operation failed');
    }
  };

  // Open Hard Delete Confirmation Modal
  const openHardDeleteModal = (tenant: SuperAdminTenantSummary) => {
    setSelectedTenantForHardDelete(tenant);
    setHardDeleteConfirmSlug('');
    setHardDeleteModalOpen(true);
  };

  // Submit Hard Delete & Purge
  const handleConfirmHardDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForHardDelete) return;
    if (hardDeleteConfirmSlug.trim() !== selectedTenantForHardDelete.slug) {
      setActionErrorMsg('The entered subdomain slug does not match.');
      return;
    }

    setPurgingTenant(true);
    setActionErrorMsg('');
    try {
      const res = await fetch(`/api/v1/saas/tenants/${selectedTenantForHardDelete.id}/purge`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      });

      const body = await res.json();
      if (res.ok) {
        setActionSuccessMsg(body.message || `Academy purged completely. Subdomain '${selectedTenantForHardDelete.slug}' has been released.`);
        setHardDeleteModalOpen(false);
        if (dossierModalOpen && selectedTenantForDossier?.id === selectedTenantForHardDelete.id) {
          setDossierModalOpen(false);
        }
        await fetchOverview();
        setTimeout(() => setActionSuccessMsg(''), 6000);
      } else {
        throw new Error(body.error?.message || 'Hard delete operation failed');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Hard delete operation failed');
    } finally {
      setPurgingTenant(false);
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
        setActionSuccessMsg(`Subdomain updated from ${body.data.previous_slug} to ${body.data.tenant.slug}. Permanent alias created.`);
        setRenameModalOpen(false);
        await fetchOverview();
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
        setActionSuccessMsg(`Academy '${selectedTenantForSuspend.name}' suspended. Portal access restricted to billing desk.`);
        setSuspendModalOpen(false);
        await fetchOverview();
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
        setActionSuccessMsg(`Academy '${tenant.name}' reinstated to active status.`);
        await fetchOverview();
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
        await fetchOverview();
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
        await fetchOverview();
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
        await fetchAnnouncements();
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

  // Open Edit Notice Modal
  const openEditNoticeModal = (notice: PlatformAnnouncement) => {
    setSelectedNoticeForEdit(notice);
    setEditNoticeTitle(notice.title);
    setEditNoticeMessage(notice.message);
    setEditNoticeType(notice.type);
    setEditNoticeFrequency(notice.frequency);
    setEditNoticeAudience(notice.target_audience);
    setEditNoticeActionLabel(notice.action_label || '');
    setEditNoticeActionUrl(notice.action_url || '');
    setEditNoticeModalOpen(true);
  };

  // Submit Notice Edit
  const handleSaveNoticeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNoticeForEdit) return;

    setSavingNoticeEdit(true);
    setActionErrorMsg('');
    try {
      const res = await fetch(`/api/v1/saas/announcements/${selectedNoticeForEdit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: editNoticeTitle.trim(),
          message: editNoticeMessage.trim(),
          type: editNoticeType,
          frequency: editNoticeFrequency,
          target_audience: editNoticeAudience,
          action_label: editNoticeActionLabel.trim() || null,
          action_url: editNoticeActionUrl.trim() || null
        })
      });

      const body = await res.json();
      if (res.ok) {
        setActionSuccessMsg('Broadcast notice updated.');
        setEditNoticeModalOpen(false);
        await fetchAnnouncements();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        throw new Error(body.error?.message || 'Failed updating announcement');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Notice update failed');
    } finally {
      setSavingNoticeEdit(false);
    }
  };

  // Delete Announcement
  const handleDeleteAnnouncement = async (noticeId: string, title: string) => {
    if (!window.confirm(`Permanently delete broadcast notice '${title}'?`)) return;

    try {
      const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
      let res = await fetch(`/api/v1/saas/announcements/${noticeId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        res = await fetch(`/api/v1/saas/announcements/${noticeId}/delete`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: '{}',
        });
      }

      if (res.ok) {
        setAnnouncements(prev => prev.filter(a => a.id !== noticeId));
        setActionSuccessMsg('Notice permanently deleted.');
        await fetchAnnouncements();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Failed deleting notice');
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Notice deletion failed');
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
        await fetchAnnouncements();
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
              Academy directory, individualized billing parameters, subscription ledgers, and broadcast notices.
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
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Archived</span>
            <span className="text-xl font-bold text-slate-600 font-mono mt-0.5 block">
              {overview?.archived_tenants || 0}
            </span>
          </div>

          <div className="p-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Monthly MRR</span>
            <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">PKR {(overview?.platform_mrr || 0).toLocaleString()}</span>
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
          <span>Global Settings</span>
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

        <button
          onClick={() => { setActiveTab('backups'); fetchBackups(); }}
          className={`px-3.5 py-2 rounded-t-lg border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'backups'
              ? 'border-indigo-600 text-indigo-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>Backups</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: ACADEMY DIRECTORY
          ===================================================================== */}
      {activeTab === 'academies' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Academy Directory & Subscription Register
              </h2>
              <p className="text-[11px] text-slate-500">
                Individual billing rates, anchored due dates, financial balance, and management actions.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">Total: {tenants.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="p-3">Academy & Tier</th>
                  <th className="p-3">Subdomain & Routing</th>
                  <th className="p-3">Account Status</th>
                  <th className="p-3">Monthly Rate</th>
                  <th className="p-3">Next Due Date</th>
                  <th className="p-3">Financial Position</th>
                  <th className="p-3 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tenants.map(t => {
                  const isArchived = t.status === 'archived';
                  const isSuspended = t.status === 'suspended';
                  const isLocked = !isArchived && !isSuspended && (t.status === 'locked' || new Date(t.trial_ends_at).getTime() < Date.now());
                  const monthlyRate = t.custom_monthly_fee ?? (overview?.banking_config?.monthly_subscription_fee || 15000);
                  const anchorDay = t.billing_cycle_anchor_day || new Date(t.trial_ends_at || Date.now()).getDate();
                  const paidTotal = t.total_paid_amount || 0;
                  const pendingTotal = t.pending_dues_amount || 0;

                  return (
                    <tr key={t.id} className={`hover:bg-slate-50/75 transition-colors ${isArchived ? 'opacity-70 bg-slate-50/40' : ''}`}>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{t.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-500 font-mono uppercase">{t.tier} Tier</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] text-slate-500 font-medium">{t.student_count} Students</span>
                        </div>
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
                          isArchived
                            ? 'bg-slate-100 text-slate-600 border-slate-300'
                            : isSuspended
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : isLocked
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : t.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {isArchived ? 'Archived' : isSuspended ? 'Suspended' : isLocked ? 'Locked (Expired)' : t.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        <div className="font-semibold text-slate-900">PKR {monthlyRate.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500">Anchor: {anchorDay}th of month</div>
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        <div className="font-semibold text-slate-900">{new Date(t.trial_ends_at).toLocaleDateString()}</div>
                        <span className="text-[10px] text-slate-500">
                          Grace: {t.individual_grace_period_days ?? (overview?.platform_config?.grace_period_days || 5)}d
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        <div className="text-emerald-700 font-semibold text-[11px]">Paid: PKR {paidTotal.toLocaleString()}</div>
                        {pendingTotal > 0 ? (
                          <div className="text-rose-600 font-semibold text-[11px]">Pending: PKR {pendingTotal.toLocaleString()}</div>
                        ) : (
                          <div className="text-slate-400 text-[10px]">No pending dues</div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Dossier (Account Management) Button */}
                          <button
                            onClick={() => openDossierModal(t)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-700 font-semibold text-xs rounded border border-indigo-200 shadow-xs transition-colors flex items-center gap-1"
                            title="View & Edit Academy Dossier"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Dossier</span>
                          </button>

                          {/* Quick 1-Click Payment Extension (+1 Mo Anchored) */}
                          <button
                            onClick={() => handleOneClickExtendOneMonth(t)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-semibold text-xs rounded shadow-xs transition-colors"
                            title="Record Payment & Auto-Extend +1 Month"
                          >
                            +1 Mo
                          </button>

                          {/* Advance Payment Button */}
                          <button
                            onClick={() => openAdvanceModal(t)}
                            className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs rounded shadow-xs transition-colors"
                            title="Record Advance Multi-Month Payment"
                          >
                            Advance
                          </button>

                          {/* Soft Archive / Unarchive */}
                          <button
                            onClick={() => handleToggleArchive(t)}
                            className={`p-1 rounded border shadow-xs transition-colors ${
                              isArchived 
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300' 
                                : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-300'
                            }`}
                            title={isArchived ? 'Unarchive Academy' : 'Soft Archive Academy'}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>

                          {/* Suspend / Reinstate */}
                          {isSuspended ? (
                            <button
                              onClick={() => handleReinstate(t)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded shadow-xs flex items-center gap-0.5 transition-colors"
                              title="Reinstate Academy"
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              onClick={() => openSuspendModal(t)}
                              className="p-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded shadow-xs transition-colors"
                              title="Suspend Academy"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Hard Delete & Wipe */}
                          <button
                            onClick={() => openHardDeleteModal(t)}
                            className="p-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded shadow-xs transition-colors"
                            title="Hard Delete & Purge All Data (Releases Subdomain)"
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
          TAB 3: PLATFORM GLOBAL PARAMETERS
          ===================================================================== */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs max-w-3xl space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
              Platform Configuration & Policy Parameters
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Default baseline trial terms and settlement bank details for unregistered/new academies.
            </p>
          </div>

          <form onSubmit={handleSavePlatformConfig} className="space-y-5 text-xs">
            
            {/* Free Trial & Grace Period Terms */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block">
                Free Trial & Grace Period Baseline Policy
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
                    Applies to newly registered academies.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Default Grace Period (Days) *</label>
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
                    Days after expiry before portal lock is enforced if individual setting is not overridden.
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
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Baseline Monthly Fee (PKR)</label>
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
              <span>{savingConfig ? 'Saving...' : 'Save Global Configuration'}</span>
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
                Publish Broadcast Notice
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
                  placeholder="e.g. Scheduled Maintenance Advisory"
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
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Notice Button */}
                            <button
                              onClick={() => openEditNoticeModal(a)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs rounded shadow-xs flex items-center gap-1 transition-colors"
                              title="Edit Broadcast Notice"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>

                            {/* Toggle Active / Inactive Button */}
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

                            {/* Delete Notice Button */}
                            <button
                              onClick={() => handleDeleteAnnouncement(a.id, a.title)}
                              className="p-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded shadow-xs transition-colors"
                              title="Delete Broadcast Notice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {activeTab === 'backups' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Academy data backups</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Daily copies in the database (14 days), plus a file on your computer and a nightly GitHub backup.
                Download a file before you start development. Restore from a file or from the list (type RESTORE).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg"
              >
                Download backup
              </button>
              <label className="px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg cursor-pointer">
                Upload & restore
                <input type="file" accept="application/json,.json" className="hidden" onChange={handleUploadBackup} />
              </label>
              <button
                type="button"
                onClick={handleCreateBackup}
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg"
              >
                Save backup now
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="p-3">When</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Academies</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backupsLoading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">Loading backups…</td></tr>
                ) : backups.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">No backups yet. Click Save backup now after academies exist.</td></tr>
                ) : backups.map(b => (
                  <tr key={b.id}>
                    <td className="p-3 font-mono text-slate-700">{new Date(b.created_at).toLocaleString()}</td>
                    <td className="p-3 uppercase font-semibold text-slate-800">{b.kind}</td>
                    <td className="p-3 font-mono">{b.academy_count}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRestoreBackup(b.id, b.academy_count)}
                        className="px-2.5 py-1 border border-slate-300 rounded text-xs font-semibold hover:bg-slate-50"
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: ACADEMY DOSSIER & INDIVIDUAL BILLING CONTROLS
          ===================================================================== */}
      {dossierModalOpen && selectedTenantForDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden my-8">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-700" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Academy Dossier — {selectedTenantForDossier.name}</h3>
                  <span className="text-[11px] font-mono text-slate-500">{selectedTenantForDossier.slug}.kampus.pk</span>
                </div>
              </div>
              <button
                onClick={() => setDossierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-6 text-xs max-h-[80vh] overflow-y-auto">
              
              {/* Financial Summary Cards Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Monthly Rate</span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    PKR {(selectedTenantForDossier.custom_monthly_fee ?? 15000).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">Anchor: {selectedTenantForDossier.billing_cycle_anchor_day || 1}th / mo</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Total Paid to Date</span>
                  <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">
                    PKR {(selectedTenantForDossier.total_paid_amount || 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">{selectedTenantForDossier.payment_history?.length || 0} Transactions</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Pending Dues</span>
                  <span className={`text-base font-bold font-mono mt-0.5 block ${
                    (selectedTenantForDossier.pending_dues_amount || 0) > 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}>
                    PKR {(selectedTenantForDossier.pending_dues_amount || 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">Current settlement status</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Subscription Renewal</span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    {new Date(selectedTenantForDossier.trial_ends_at).toLocaleDateString()}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Grace: {selectedTenantForDossier.individual_grace_period_days ?? 5} days
                  </span>
                </div>
              </div>

              {/* Quick Operational Actions Strip */}
              <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">Operational Actions:</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleOneClickExtendOneMonth(selectedTenantForDossier)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Receive Payment & Extend +1 Mo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setDossierModalOpen(false); openAdvanceModal(selectedTenantForDossier); }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Record Advance Payment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleArchive(selectedTenantForDossier)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs rounded shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5 text-slate-500" />
                    <span>{selectedTenantForDossier.status === 'archived' ? 'Unarchive' : 'Soft Archive'}</span>
                  </button>
                </div>
              </div>

              {/* Editable Individual Billing Parameters Form */}
              <form onSubmit={handleSaveBillingParams} className="p-4 border border-slate-200 rounded-lg space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Individual Academy Billing Parameters
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Overrides platform global settings for this specific academy.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={savingBillingParams}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs rounded shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingBillingParams ? 'Saving...' : 'Save Parameters'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Agreed Monthly Fee (PKR) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      required
                      value={dossierMonthlyFee}
                      onChange={e => setDossierMonthlyFee(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono font-semibold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Custom recurring fee.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Billing Anchor Day (1-31) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      required
                      value={dossierAnchorDay}
                      onChange={e => setDossierAnchorDay(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono font-semibold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Due date day each month (e.g. 15th).
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Individual Grace Period (Days) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      required
                      value={dossierGracePeriod}
                      onChange={e => setDossierGracePeriod(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono font-semibold text-slate-900"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Individual lock grace extension.
                    </span>
                  </div>
                </div>
              </form>

              {/* Payment History Ledger Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Subscription Payment Ledger
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">
                    {selectedTenantForDossier.payment_history?.length || 0} Records
                  </span>
                </div>

                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Amount</th>
                        <th className="p-2.5">Duration</th>
                        <th className="p-2.5">Method & Reference</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(!selectedTenantForDossier.payment_history || selectedTenantForDossier.payment_history.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
                            No subscription payment receipts on record for this academy.
                          </td>
                        </tr>
                      ) : (
                        selectedTenantForDossier.payment_history.map(receipt => (
                          <tr key={receipt.id} className="hover:bg-slate-50/75">
                            <td className="p-2.5 font-mono text-slate-500">
                              {new Date(receipt.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-slate-900">
                              PKR {receipt.amount.toLocaleString()}
                            </td>
                            <td className="p-2.5 font-medium text-slate-600">
                              {receipt.plan_duration_months} Month(s)
                            </td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] rounded border border-slate-200">
                                {receipt.payment_method}
                              </span>
                              {receipt.reference_number && (
                                <span className="font-mono text-[10px] text-slate-500 ml-1.5">
                                  Ref: {receipt.reference_number}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                                receipt.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : receipt.status === 'REJECTED'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                {receipt.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Danger Zone: Hard Delete */}
              <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-lg flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-rose-950 text-xs">Permanent Academy Purge</h5>
                  <p className="text-[10px] text-rose-700">
                    Wipes all student records, transactions, vouchers and frees the subdomain slug for reuse.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openHardDeleteModal(selectedTenantForDossier)}
                  className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs rounded shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hard Delete</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: ADVANCE / CUSTOM MULTI-MONTH PAYMENT MODAL
          ===================================================================== */}
      {advanceModalOpen && selectedTenantForAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-slate-900 text-sm">Record Advance Payment</h3>
              </div>
              <button
                onClick={() => setAdvanceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdvancePayment} className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-slate-500 text-[11px]">Target Academy:</span>
                <div className="font-bold text-slate-900 text-sm">{selectedTenantForAdvance.name}</div>
                <div className="text-slate-500 font-mono text-[11px]">
                  Monthly Rate: PKR {(selectedTenantForAdvance.custom_monthly_fee ?? 15000).toLocaleString()} • Anchor: {selectedTenantForAdvance.billing_cycle_anchor_day || 1}th
                </div>
              </div>

              {/* Duration Quick Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">Advance Billing Duration</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 6].map(m => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => handleAdvanceDurationChange(m)}
                      className={`py-1.5 px-2 rounded border font-semibold text-xs transition-colors ${
                        advanceDurationMonths === m
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                      }`}
                    >
                      {m} Month{m > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Or Custom Months:</span>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={advanceDurationMonths}
                    onChange={e => handleAdvanceDurationChange(Math.max(1, Number(e.target.value)))}
                    className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-semibold text-xs"
                  />
                </div>
              </div>

              {/* Custom Payment Amount (auto-calculated but editable) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Received Payment Amount (PKR) *</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={advanceCustomAmount}
                  onChange={e => setAdvanceCustomAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 text-sm"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Auto-calculated at monthly rate × {advanceDurationMonths} mo. Customizable for negotiated discounts.
                </span>
              </div>

              {/* Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Payment Method *</label>
                  <select
                    value={advancePaymentMethod}
                    onChange={e => setAdvancePaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="MEEZAN_IBFT">Meezan Bank IBFT</option>
                    <option value="CASH">Cash Deposit</option>
                    <option value="EASYPAISA">EasyPaisa</option>
                    <option value="JAZZCASH">JazzCash</option>
                    <option value="CHEQUE">Bank Cheque</option>
                    <option value="BANK_TRANSFER">Direct Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Reference / TRX #</label>
                  <input
                    type="text"
                    placeholder="e.g. MZ-84920482"
                    value={advanceReferenceNumber}
                    onChange={e => setAdvanceReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Internal Billing Note</label>
                <input
                  type="text"
                  placeholder="e.g. 3-month advance settlement received via IBFT"
                  value={advanceNotes}
                  onChange={e => setAdvanceNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-600 text-[11px] leading-relaxed">
                Will auto-extend subscription renewal date by <strong className="text-slate-800">{advanceDurationMonths} month(s)</strong> preserving anchor day <strong className="text-slate-800">{selectedTenantForAdvance.billing_cycle_anchor_day || 1}th</strong>, and log an approved receipt.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdvanceModalOpen(false)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingAdvance}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs rounded shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{processingAdvance ? 'Recording...' : 'Record Payment & Extend'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: HARD DELETE & DATA WIPE CONFIRMATION MODAL
          ===================================================================== */}
      {hardDeleteModalOpen && selectedTenantForHardDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-lg shadow-2xl border border-rose-300 overflow-hidden">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700" />
                <h3 className="font-bold text-rose-950 text-sm">Hard Delete & Wipe Academy Data</h3>
              </div>
              <button
                onClick={() => setHardDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmHardDelete} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-900 text-[11px] leading-relaxed">
                <strong className="font-bold block mb-1">CRITICAL PERMANENT ACTION:</strong>
                This will purge all records associated with <strong className="font-bold">{selectedTenantForHardDelete.name}</strong>, including students, faculty, batches, fee invoices, examination marksheets, and financial transactions.
                The subdomain <span className="font-mono font-bold">{selectedTenantForHardDelete.slug}</span> will be immediately released for registration.
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Type <span className="font-mono font-bold text-rose-700 select-all">{selectedTenantForHardDelete.slug}</span> to confirm purge:
                </label>
                <input
                  type="text"
                  required
                  placeholder={selectedTenantForHardDelete.slug}
                  value={hardDeleteConfirmSlug}
                  onChange={e => setHardDeleteConfirmSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-rose-300 rounded font-mono font-semibold text-xs text-rose-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHardDeleteModalOpen(false)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={purgingTenant || hardDeleteConfirmSlug.trim() !== selectedTenantForHardDelete.slug}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 disabled:bg-rose-300 text-white font-semibold text-xs rounded shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{purgingTenant ? 'Purging Academy...' : 'Permanently Wipe & Release Domain'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: EDIT BROADCAST NOTICE MODAL
          ===================================================================== */}
      {editNoticeModalOpen && selectedNoticeForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-slate-900 text-sm">Edit Broadcast Notice</h3>
              </div>
              <button
                onClick={() => setEditNoticeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNoticeEdit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Notice Subject *</label>
                <input
                  type="text"
                  required
                  value={editNoticeTitle}
                  onChange={e => setEditNoticeTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Notice Message Body *</label>
                <textarea
                  rows={3}
                  required
                  value={editNoticeMessage}
                  onChange={e => setEditNoticeMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Classification</label>
                  <select
                    value={editNoticeType}
                    onChange={e => setEditNoticeType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="system">System Notice</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="warning">Important Alert</option>
                    <option value="urgent">Urgent Notice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Display Rule</label>
                  <select
                    value={editNoticeFrequency}
                    onChange={e => setEditNoticeFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="once_dismissible">Once (Dismissible)</option>
                    <option value="every_login">Every Login (Mandatory)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Scope</label>
                  <select
                    value={editNoticeAudience}
                    onChange={e => setEditNoticeAudience(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="all">All Academies</option>
                    <option value="admin_only">Admins Only</option>
                    <option value="trial_expiring">Trial Expiring</option>
                    <option value="grace_period">Grace Period</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Action Button Text</label>
                  <input
                    type="text"
                    value={editNoticeActionLabel}
                    onChange={e => setEditNoticeActionLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Action URL</label>
                  <input
                    type="url"
                    value={editNoticeActionUrl}
                    onChange={e => setEditNoticeActionUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditNoticeModalOpen(false)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNoticeEdit}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs rounded shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingNoticeEdit ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: SUBDOMAIN RENAME MODAL
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
          MODAL 6: ACADEMY SUSPENSION MODAL
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
