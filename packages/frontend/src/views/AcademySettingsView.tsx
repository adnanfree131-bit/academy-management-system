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
  Globe
} from 'lucide-react';
import { TenantSettings } from '@apex/shared-types';

export const AcademySettingsView: React.FC = () => {
  const { token, tenant, refreshSession } = useAuth();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [academyName, setAcademyName] = useState<string>('');
  const [campusName, setCampusName] = useState<string>('');
  const [city, setCity] = useState<string>('Lahore');
  const [subdomain, setSubdomain] = useState<string>('apex');
  const [domain, setDomain] = useState<string>('apex.kampus.pk');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [academicSession, setAcademicSession] = useState<string>('2026-2027');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [affiliationNo, setAffiliationNo] = useState<string>('');

  // Bank Details for Challan
  const [bankName, setBankName] = useState<string>('Meezan Bank Limited');
  const [accountTitle, setAccountTitle] = useState<string>('Academy Collection Account');
  const [accountNumber, setAccountNumber] = useState<string>('0102-0104882910');
  const [iban, setIban] = useState<string>('PK36MEZN0001020104882910');
  const [branchCode, setBranchCode] = useState<string>('Main Branch (0101)');

  // Policies & Payment Allocation
  const [dueDay, setDueDay] = useState<number>(10);
  const [graceDays, setGraceDays] = useState<number>(5);
  const [lateFeePerDay, setLateFeePerDay] = useState<number>(50);
  const [liquidationPriority, setLiquidationPriority] = useState<string[]>([
    'admission_fee',
    'exam_fee',
    'lab_fee',
    'tuition_fee',
    'fine'
  ]);

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
        setAcademyName(t.name || 'Apex Academy');
        setCampusName(s.campus_name || tenant?.campus_name || 'Main Campus');
        setAcademicSession(s.academic_session || tenant?.academic_session || '2026-2027');
        setPhone(s.phone || '+92 300 1234567');
        setEmail(s.email || 'info@kampus.pk');
        setAddress(s.address || 'Campus Avenue, Main Boulevard, Lahore');
        setAffiliationNo(s.affiliation_number || 'BISE/LHR-2026/9941');

        if (s.logo_url) setLogoUrl(s.logo_url);
        if (s.city) setCity(s.city);
        if (s.subdomain || t.slug) setSubdomain(s.subdomain || t.slug);
        if (s.domain || t.domain) setDomain(s.domain || t.domain);

        if (s.bank_name) setBankName(s.bank_name);
        if (s.account_title) setAccountTitle(s.account_title);
        if (s.account_number) setAccountNumber(s.account_number);
        if (s.iban) setIban(s.iban);
        if (s.branch_code) setBranchCode(s.branch_code);

        if (s.liquidation_rules) {
          if (s.liquidation_rules.due_day) setDueDay(s.liquidation_rules.due_day);
          if (s.liquidation_rules.grace_days) setGraceDays(s.liquidation_rules.grace_days);
          if (s.liquidation_rules.late_fee_per_day) setLateFeePerDay(s.liquidation_rules.late_fee_per_day);
          if (s.liquidation_rules.priority_order) setLiquidationPriority(s.liquidation_rules.priority_order);
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
    } catch (err) {
      console.error('Failed to load academy settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(reader.result as string);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
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
        late_fee_per_day: lateFeePerDay,
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
            <Building2 className="w-5 h-5 text-indigo-400" />
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
        <form onSubmit={handleSave} className="space-y-6">
          {/* SECTION 1: INSTITUTION PROFILE */}
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
                    https://{subdomain}.toolnestr.com
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

          {/* SECTION 2: BANK DETAILS FOR 3-PART CHALLAN */}
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
                  placeholder="e.g. Meezan Bank Limited / HBL / MCB"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Title</label>
                <input
                  type="text"
                  value={accountTitle}
                  onChange={e => setAccountTitle(e.target.value)}
                  placeholder="e.g. Apex Academy Collection Account"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="0102-0104882910"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">IBAN (24 Characters)</label>
                <input
                  type="text"
                  value={iban}
                  onChange={e => setIban(e.target.value)}
                  placeholder="PK36MEZN0001020104882910"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800 font-bold"
                  required
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

          {/* SECTION 3: FEE INVOICING & PAYMENT ALLOCATION */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Fee Invoicing & Payment Allocation</h2>
                <p className="text-[11px] text-slate-500">
                  Configure default due dates, late fees, and payment allocation order for partial payments.
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

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Late Surcharge Per Day</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={lateFeePerDay}
                    onChange={e => setLateFeePerDay(parseInt(e.target.value) || 0)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 font-bold"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">PKR / day</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl">
              <span className="text-xs font-bold text-slate-800 block mb-1">
                Payment Allocation Order:
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {liquidationPriority.map((item, idx) => (
                  <span
                    key={item}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-mono text-[11px] font-bold shadow-2xs"
                  >
                    <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="capitalize">{item.replace('_', ' ')}</span>
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                When a student pays partially, funds are applied strictly according to this priority order.
              </p>
            </div>
          </div>

          {/* SECTION 4: CAMPUS SHIFTS */}
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

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Saving Configuration...' : 'Save Academy Settings'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
