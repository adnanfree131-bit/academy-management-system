import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Landmark,
  Clock,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  GraduationCap,
  UploadCloud,
  X,
  Globe,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { TenantSettings } from '@apex/shared-types';
import { compressImageFile } from '../components/LoginModal';

export const AcademySettingsView: React.FC = () => {
  const { token, tenant, user, applySession, refreshSession } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<'profile' | 'challan' | 'shifts' | 'security'>('profile');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Director Password Change State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState<boolean>(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  // Form State
  const [academyName, setAcademyName] = useState<string>('');
  const [campusName, setCampusName] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [subdomain, setSubdomain] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [academicSession, setAcademicSession] = useState<string>('2026-2027');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [affiliationNo, setAffiliationNo] = useState<string>('');

  // Bank Details for Challan
  const [bankName, setBankName] = useState<string>('');
  const [accountTitle, setAccountTitle] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [iban, setIban] = useState<string>('');
  const [branchCode, setBranchCode] = useState<string>('');

  const [dueDay, setDueDay] = useState<number>(10);
  const [graceDays, setGraceDays] = useState<number>(5);
  const [liquidationPriority, setLiquidationPriority] = useState<string[]>([]);
  const [feeHeads, setFeeHeads] = useState<{ id: string; name: string; code: string; is_system_default?: boolean }[]>([]);
  const [newHeadName, setNewHeadName] = useState('');
  const [editingHeadId, setEditingHeadId] = useState<string | null>(null);
  const [editingHeadName, setEditingHeadName] = useState('');
  const [otpModal, setOtpModal] = useState<'change' | 'reset' | null>(null);


  // Shifts
  const [morningStart, setMorningStart] = useState<string>('08:00');
  const [morningEnd, setMorningEnd] = useState<string>('13:30');
  const [eveningStart, setEveningStart] = useState<string>('15:00');
  const [eveningEnd, setEveningEnd] = useState<string>('19:30');

  // Load Settings
  const fetchSettings = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/academic/academy-settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        const t = data.data;
        const s = t.settings || {};
        setAcademyName(t.name || tenant?.name || '');
        setCampusName(s.campus_name || tenant?.campus_name || '');
        setAcademicSession(s.academic_session || tenant?.academic_session || '');
        const dummyEmail = !s.email || s.email === 'info@kampus.pk';
        const dummyAff = !s.affiliation_number || String(s.affiliation_number).includes('BISE/LHR-2026');
        const dummyAddr = !s.address || String(s.address).includes('Campus Avenue');
        const dummyPhone = !s.phone || s.phone.includes('300 1234567');
        setPhone(dummyPhone ? '' : s.phone);
        setEmail(dummyEmail ? '' : s.email);
        setAddress(dummyAddr ? '' : s.address);
        setAffiliationNo(dummyAff ? '' : s.affiliation_number);

        if (s.logo_url) setLogoUrl(s.logo_url);
        if (s.city) setCity(s.city);
        if (s.subdomain || t.slug) setSubdomain(s.subdomain || t.slug);
        if (s.domain || t.domain) setDomain(s.domain || t.domain);

        const dummyBank = !s.bank_name || s.bank_name === 'Meezan Bank Limited';
        setBankName(dummyBank ? '' : s.bank_name);
        setAccountTitle(!s.account_title || s.account_title === 'Academy Collection Account' ? '' : s.account_title);
        setAccountNumber(!s.account_number || s.account_number === '0102-0104882910' ? '' : s.account_number);
        setIban(!s.iban || s.iban === 'PK36MEZN0001020104882910' ? '' : s.iban);
        setBranchCode(!s.branch_code || s.branch_code.includes('Main Branch (0101)') ? '' : s.branch_code);

        if (s.liquidation_rules) {
          if (s.liquidation_rules.due_day) setDueDay(s.liquidation_rules.due_day);
          if (s.liquidation_rules.grace_days) setGraceDays(s.liquidation_rules.grace_days);
        }

        if (s.shifts) {
          if (s.shifts.morning) {
            setMorningStart(s.shifts.morning.start || '08:00');
            setMorningEnd(s.shifts.morning.end || '13:30');
          }
          if (s.shifts.evening) {
            setEveningStart(s.shifts.evening.start || '15:00');
            setEveningEnd(s.shifts.evening.end || '19:30');
          }
        }
      }

      const headsRes = await fetch('/api/v1/finance/heads', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const headsBody = await headsRes.json().catch(() => ({}));
      const heads = (headsBody.data || []).map((h: any) => ({
        id: String(h.id || ''),
        name: String(h.name || ''),
        code: String(h.code || ''),
        is_system_default: Boolean(h.is_system_default || h.code === 'TUITION'),
      }));
      setFeeHeads(heads);
      const savedOrder: string[] = data?.data?.settings?.liquidation_rules?.priority_order || [];
      const dummyKeys = ['admission_fee', 'exam_fee', 'lab_fee', 'tuition_fee', 'fine'];
      const looksDummy = savedOrder.length === 0 || savedOrder.every((k: string) => dummyKeys.includes(k));
      if (looksDummy) {
        setLiquidationPriority(heads.map((h: { name: string }) => h.name));
      } else {
        const known = savedOrder.filter((name: string) => heads.some((h: { name: string; id: string }) => h.name === name || h.id === name));
        const missing = heads.map((h: { name: string }) => h.name).filter((n: string) => !known.includes(n));
        setLiquidationPriority([...known, ...missing]);
      }
    } catch (err) {
      console.error('Failed to load academy settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);



  // 60-second cooldown timer effect (starts ONLY on 200 OK from server)
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSecurityError(null);
    setSecuritySuccess(null);

    if (!currentPassword) {
      setSecurityError('Current password is required.');
      return;
    }
    if (newPassword.length < 6) {
      setSecurityError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setSecurityError('New password cannot be the same as your current password.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/v1/auth/change-password-otp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message || 'Failed to send verification code.');
      }
      setCooldown(body.data?.cooldown_seconds || 60);
      setOtpCode('');
      setOtpModal('change');
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to send verification code.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (!token || otpCode.trim().length !== 6) {
      setSecurityError('Enter the 6-digit code from your email.');
      return;
    }
    setIsChangingPassword(true);
    setSecurityError(null);
    try {
      if (otpModal === 'reset') {
        const res = await fetch('/api/v1/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user?.email,
            otp: otpCode.trim(),
            new_password: newPassword,
            tenant_slug: tenant?.slug,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error?.message || 'Failed to reset password.');
      } else {
        const res = await fetch('/api/v1/auth/change-password', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
            otp: otpCode.trim(),
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error?.message || 'Failed to update password.');
        if (applySession && body.data) applySession(body.data);
      }
      setSecuritySuccess('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpCode('');
      setOtpModal(null);
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleForgotOldPassword = async () => {
    if (!user?.email) return;
    setSecurityError(null);
    setIsRequestingOtp(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, tenant_slug: tenant?.slug }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || 'Failed to send code.');
      setOtpCode('');
      setOtpModal('reset');
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to send code.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const headLocked = (h: { code: string; name: string; is_system_default?: boolean }) =>
    h.code === 'TUITION' || h.name.toLowerCase().includes('monthly tuition');

  const refreshFeeHeads = async () => {
    if (!token) return;
    const headsRes = await fetch('/api/v1/finance/heads', { headers: { Authorization: `Bearer ${token}` } });
    const headsBody = await headsRes.json().catch(() => ({}));
    const heads = (headsBody.data || []).map((h: any) => ({
      id: String(h.id || ''),
      name: String(h.name || ''),
      code: String(h.code || ''),
      is_system_default: Boolean(h.is_system_default || h.code === 'TUITION'),
    }));
    setFeeHeads(heads);
    setLiquidationPriority(prev => {
      const names = heads.map((h: { name: string }) => h.name);
      const kept = prev.filter(n => names.includes(n));
      const missing = names.filter((n: string) => !kept.includes(n));
      return [...kept, ...missing];
    });
  };

  const handleAddFeeHead = async () => {
    if (!token || !newHeadName.trim()) return;
    const code = newHeadName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 16);
    const res = await fetch('/api/v1/finance/heads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newHeadName.trim(), code, default_amount: 0, priority_order: feeHeads.length + 1 }),
    });
    if (res.ok) {
      setNewHeadName('');
      await refreshFeeHeads();
    }
  };

  const handleSaveHeadName = async (id: string) => {
    if (!token || !editingHeadName.trim()) return;
    await fetch(`/api/v1/finance/heads/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingHeadName.trim() }),
    });
    setEditingHeadId(null);
    await refreshFeeHeads();
  };

  const handleDeleteFeeHead = async (id: string) => {
    if (!token) return;
    await fetch(`/api/v1/finance/heads/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await refreshFeeHeads();
  };



  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file (PNG, JPG, SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Logo file size must be less than 2MB.');
      return;
    }
    try {
      const compressed = await compressImageFile(file, 400, 400, 0.85);
      setLogoUrl(compressed);
      setErrorMsg(null);
    } catch {
      setErrorMsg('Failed to process uploaded logo image.');
    }
  };

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const updatedSettings: Partial<TenantSettings> = {
      campus_name: campusName,
      academic_session: academicSession,
      phone,
      email,
      address,
      city,
      logo_url: logoUrl,
      subdomain,
      domain,
      domain_verified: true,
      affiliation_number: affiliationNo,
      bank_name: bankName,
      account_title: accountTitle,
      account_number: accountNumber,
      iban,
      branch_code: branchCode,
      liquidation_rules: {
        due_day: dueDay,
        grace_days: graceDays,
        late_fee_per_day: 0,
        priority_order: liquidationPriority,
      },
      shifts: {
        morning: { start: morningStart, end: morningEnd },
        evening: { start: eveningStart, end: eveningEnd },
      },
    };

    try {
      const res = await fetch('/api/v1/academic/academy-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: academyName,
          settings: updatedSettings,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to save settings');

      setSuccessMsg('Institutional academy settings updated successfully. Challans and badges updated.');
      if (refreshSession) refreshSession();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Academy Settings</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage campus profile, bank accounts for fee challans, shift timings, and fee payment rules.
            </p>
          </div>
        </div>

        <button
          onClick={fetchSettings}
          className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          title="Reload Settings"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs font-mono">Loading academy settings...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Institutional Unnumbered Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-white rounded-2xl px-3 pt-2 gap-1 overflow-x-auto shadow-xs">
            <button
              type="button"
              onClick={() => { setActiveTab('profile'); setSuccessMsg(null); setErrorMsg(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all cursor-pointer border-b-2 ${
                activeTab === 'profile'
                  ? 'border-indigo-600 text-slate-900 bg-slate-50 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Campus Profile</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('challan'); setSuccessMsg(null); setErrorMsg(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all cursor-pointer border-b-2 ${
                activeTab === 'challan'
                  ? 'border-indigo-600 text-slate-900 bg-slate-50 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <Landmark className="w-4 h-4 text-emerald-600" />
              <span>Challan & Bank Accounts</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('shifts'); setSuccessMsg(null); setErrorMsg(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all cursor-pointer border-b-2 ${
                activeTab === 'shifts'
                  ? 'border-indigo-600 text-slate-900 bg-slate-50 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <Clock className="w-4 h-4 text-purple-600" />
              <span>Shift Timings</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('security'); setSecurityError(null); setSecuritySuccess(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all cursor-pointer border-b-2 ${
                activeTab === 'security'
                  ? 'border-indigo-600 text-slate-900 bg-slate-50 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Account Security</span>
            </button>

          </div>

          {activeTab !== 'security' ? (
            <form onSubmit={handleSave} className="space-y-6">
              {/* SECTION 1: INSTITUTION PROFILE */}
              {activeTab === 'profile' && (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-extrabold text-slate-900">Institution Identity & Profile</h2>
                  </div>

                  {/* Academy Logo Card */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="w-16 h-16 rounded-xl border border-slate-300 bg-white p-1 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Academy Logo" className="w-full h-full object-contain" />
                      ) : (
                        <GraduationCap className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="block text-xs font-bold text-slate-800">Academy Brand Logo</span>
                      <span className="block text-[11px] text-slate-500">
                        Reflected on your white-labeled login screen, student profiles, and official fee challans.
                      </span>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>{logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                        </button>
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl(null)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Remove Logo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dedicated Portal Domain Card (Verified & Active) */}
                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-slate-700" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-800">Dedicated Portal Domain</span>
                        <span className="block text-[11px] font-mono text-slate-600 mt-0.5">
                          https://{subdomain}.kampus.pk
                        </span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100/80 border border-emerald-300 text-emerald-800 rounded-full text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Domain Verified & Active</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Institution Name</label>
                      <input
                        type="text"
                        value={academyName}
                        onChange={e => setAcademyName(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Campus Title</label>
                      <input
                        type="text"
                        value={campusName}
                        onChange={e => setCampusName(e.target.value)}
                        placeholder="e.g. Gulberg III Campus"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="e.g. Lahore"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Active Academic Session</label>
                      <input
                        type="text"
                        value={academicSession}
                        onChange={e => setAcademicSession(e.target.value)}
                        placeholder="e.g. 2026-2027"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Affiliation / Registration #</label>
                      <input
                        type="text"
                        value={affiliationNo}
                        onChange={e => setAffiliationNo(e.target.value)}
                        placeholder="e.g. BISE/LHR-2026/9941"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Contact Phone</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+92 300 1234567"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Contact Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Campus Physical Address</label>
                      <input
                        type="text"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        placeholder="e.g. 42-B, Main Boulevard, Gulberg III, Lahore, Punjab, Pakistan"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2 & 3: BANK DETAILS & PAYMENT ALLOCATION */}
              {activeTab === 'challan' && (
                <>
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-emerald-600" />
                        <div>
                          <h2 className="text-sm font-extrabold text-slate-900">Fee Challan Bank Accounts</h2>
                          <p className="text-[11px] text-slate-500">
                            These banking details are automatically rendered on all 3-Part Fee Challans (Bank, Academy, Student copies).
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        Printed on Challans
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Designated Bank Name</label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={e => setBankName(e.target.value)}
                          placeholder="Bank name"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Title</label>
                        <input
                          type="text"
                          value={accountTitle}
                          onChange={e => setAccountTitle(e.target.value)}
                          placeholder="Account title as printed on the challan"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Number</label>
                        <input
                          type="text"
                          value={accountNumber}
                          onChange={e => setAccountNumber(e.target.value)}
                          placeholder="Bank account number"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">IBAN (24 Characters)</label>
                        <input
                          type="text"
                          value={iban}
                          onChange={e => setIban(e.target.value)}
                          placeholder="PK followed by 22 characters"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800 font-bold"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Branch Name & Code</label>
                        <input
                          type="text"
                          value={branchCode}
                          onChange={e => setBranchCode(e.target.value)}
                          placeholder="e.g. Main Boulevard Branch (Code: 0102)"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <DollarSign className="w-4 h-4 text-amber-500" />
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Fee Invoicing & Payment Allocation</h2>
                        <p className="text-[11px] text-slate-500">
                          Set the due day and the order used when a parent pays part of a bill.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Default Due Day of Month</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            max="28"
                            value={dueDay}
                            onChange={e => setDueDay(parseInt(e.target.value) || 10)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 font-bold"
                            required
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">th of month</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Grace Period Days</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="15"
                            value={graceDays}
                            onChange={e => setGraceDays(parseInt(e.target.value) || 0)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 font-bold"
                            required
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">days</span>
                        </div>
                      </div>

                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-3">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block mb-1">Fee heads</span>
                        <p className="text-[11px] text-slate-500 mb-2">
                          Monthly tuition stays. Add, rename, or remove every other head. Partial payments follow the order below.
                        </p>
                        <div className="flex gap-2 mb-2">
                          <input
                            value={newHeadName}
                            onChange={e => setNewHeadName(e.target.value)}
                            placeholder="e.g. Annual charges"
                            className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                          />
                          <button type="button" onClick={handleAddFeeHead} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white">
                            Add head
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {feeHeads.map(head => (
                            <div key={head.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200">
                              {editingHeadId === head.id ? (
                                <input
                                  value={editingHeadName}
                                  onChange={e => setEditingHeadName(e.target.value)}
                                  className="flex-1 text-xs border border-slate-200 rounded px-2 py-1"
                                />
                              ) : (
                                <span className="flex-1 text-xs font-semibold text-slate-800">
                                  {head.name}
                                  {headLocked(head) ? <span className="ml-2 text-[10px] text-slate-400 font-medium">kept</span> : null}
                                </span>
                              )}
                              {headLocked(head) ? null : editingHeadId === head.id ? (
                                <button type="button" onClick={() => handleSaveHeadName(head.id)} className="text-[10px] px-2 py-0.5 border rounded">Save</button>
                              ) : (
                                <>
                                  <button type="button" onClick={() => { setEditingHeadId(head.id); setEditingHeadName(head.name); }} className="text-[10px] px-2 py-0.5 border rounded">Edit</button>
                                  <button type="button" onClick={() => handleDeleteFeeHead(head.id)} className="text-[10px] px-2 py-0.5 border rounded text-rose-600">Delete</button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block mb-1">Payment order for partial fees</span>
                        <p className="text-[11px] text-slate-500 mb-2">
                          If a parent pays less than the full bill, money is applied in this order.
                        </p>
                        {liquidationPriority.length === 0 ? (
                          <p className="text-xs text-slate-500">Add a fee head first.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {liquidationPriority.map((item, idx) => (
                              <div key={item} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200">
                                <span className="text-xs font-semibold text-slate-800">
                                  {idx + 1}. {item}
                                </span>
                                <span className="flex gap-1">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => {
                                      const next = [...liquidationPriority];
                                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                      setLiquidationPriority(next);
                                    }}
                                    className="px-2 py-0.5 text-[10px] border border-slate-200 rounded disabled:opacity-30"
                                  >
                                    Up
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === liquidationPriority.length - 1}
                                    onClick={() => {
                                      const next = [...liquidationPriority];
                                      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                      setLiquidationPriority(next);
                                    }}
                                    className="px-2 py-0.5 text-[10px] border border-slate-200 rounded disabled:opacity-30"
                                  >
                                    Down
                                  </button>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* SECTION 4: CAMPUS SHIFTS */}
              {activeTab === 'shifts' && (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <h2 className="text-sm font-extrabold text-slate-900">Campus Shift Operating Hours</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                      <span className="text-xs font-bold text-slate-800 block">Morning Shift Timings</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Start Time</label>
                          <input
                            type="time"
                            value={morningStart}
                            onChange={e => setMorningStart(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">End Time</label>
                          <input
                            type="time"
                            value={morningEnd}
                            onChange={e => setMorningEnd(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                      <span className="text-xs font-bold text-slate-800 block">Evening Shift Timings</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Start Time</label>
                          <input
                            type="time"
                            value={eveningStart}
                            onChange={e => setEveningStart(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">End Time</label>
                          <input
                            type="time"
                            value={eveningEnd}
                            onChange={e => setEveningEnd(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Action */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isSaving ? 'Saving Configuration...' : 'Save Academy Settings'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* ISOLATED FORM FOR ACCOUNT SECURITY: NO NESTED FORMS */
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900">Change your password</h2>
                      <p className="text-[11px] text-slate-500">
                        Enter the current password and a new one. A code will be emailed to confirm.
                      </p>
                    </div>
                  </div>
                </div>

                {securitySuccess && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold">{securitySuccess}</span>
                  </div>
                )}

                {securityError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-bold">{securityError}</span>
                  </div>
                )}

                {/* Password Change Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Current Password */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Current Administrative Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-slate-900"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      New Password (min. 6 characters)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Enter new strong password"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-slate-900"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-900"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleForgotOldPassword}
                    disabled={isRequestingOtp}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {isRequestingOtp ? 'Sending code…' : 'Forgot old password?'}
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword || !currentPassword || !newPassword}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isChangingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>{isChangingPassword ? 'Sending code…' : 'Update password'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {otpModal && (
        <div className="fixed inset-0 z-[90] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Enter email code</h3>
            <p className="text-xs text-slate-500 mt-1">
              A 6-digit code was sent to your email. It expires in 10 minutes.
            </p>
            {otpModal === 'reset' && (
              <div className="mt-3 space-y-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
            )}
            <input
              autoFocus
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="••••••"
              className="mt-4 w-full text-center text-lg font-mono tracking-[0.4em] border border-slate-200 rounded-xl py-2.5"
            />
            {securityError && <p className="text-xs text-rose-600 mt-2">{securityError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOtpModal(null)} className="px-3 py-2 text-xs rounded-lg border border-slate-200">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOtp}
                disabled={isChangingPassword || otpCode.length !== 6}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white disabled:opacity-50"
              >
                {isChangingPassword ? 'Checking…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
