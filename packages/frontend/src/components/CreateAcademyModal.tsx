import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft,
  UserCheck
} from 'lucide-react';
import { apiFetch } from '../lib/api-client';

interface CreateAcademyModalProps {
  onCancel: () => void;
  onSuccess: (tenant: any) => Promise<void> | void;
}

export const CreateAcademyModal: React.FC<CreateAcademyModalProps> = ({ onCancel, onSuccess }) => {
  const { authenticatedIdentity, user, onboardAcademy } = useAuth();

  const activeEmail = authenticatedIdentity?.email || user?.email || '';

  // Form Fields
  const [name, setName] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [campusName, setCampusName] = useState<string>('Main Campus');
  const [city, setCity] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  // Slug Availability
  const [slugAvailability, setSlugAvailability] = useState<{
    status: 'idle' | 'checking' | 'available' | 'unavailable' | 'too_short' | 'error';
    domain?: string;
    message?: string;
    isReserved?: boolean;
  }>({ status: 'idle' });

  // State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-generate slug from academy name if not manually modified
  const [isSlugManual, setIsSlugManual] = useState<boolean>(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isSlugManual) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      setSlug(generated);
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManual(true);
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const checkDomainAvailability = useCallback(async (slugToCheck: string) => {
    const clean = slugToCheck.trim().toLowerCase();
    if (!clean) {
      setSlugAvailability({ status: 'idle' });
      return;
    }
    if (clean.length < 3) {
      setSlugAvailability({
        status: 'too_short',
        message: 'Web address must be at least 3 characters.',
      });
      return;
    }

    setSlugAvailability({
      status: 'checking',
      message: 'Checking availability...',
    });

    try {
      const res = await apiFetch(`/api/v1/auth/check-domain?slug=${encodeURIComponent(clean)}`);
      const body = await res.json().catch(() => null);

      if (res.ok && body && body.success && body.data) {
        const isAvail = Boolean(body.data.available);
        const msg = body.data.message || (isAvail ? 'Address is available' : 'This address is unavailable.');
        const isReserved = Boolean(msg.toLowerCase().includes('reserved'));
        setSlugAvailability({
          status: isAvail ? 'available' : 'unavailable',
          domain: body.data.domain,
          message: msg,
          isReserved,
        });
      } else {
        const errMsg = body?.data?.message || body?.error?.message;
        const isReserved = Boolean(errMsg?.toLowerCase().includes('reserved'));
        if (body?.data?.available === false) {
          setSlugAvailability({
            status: 'unavailable',
            message: errMsg || 'This address is already registered.',
            isReserved,
          });
        } else if (res.status >= 500 || res.status === 404 || !body) {
          setSlugAvailability({
            status: 'error',
            message: 'Unable to verify address availability. Please retry.',
          });
        } else {
          setSlugAvailability({
            status: 'unavailable',
            message: errMsg || 'This address is unavailable.',
            isReserved,
          });
        }
      }
    } catch {
      setSlugAvailability({
        status: 'error',
        message: 'Unable to connect to verification service. Please retry.',
      });
    }
  }, []);

  // Debounced domain availability check
  useEffect(() => {
    const timer = setTimeout(() => {
      checkDomainAvailability(slug);
    }, 300);

    return () => clearTimeout(timer);
  }, [slug, checkDomainAvailability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanSlug = slug.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage('Please enter an institution name.');
      return;
    }

    if (!cleanSlug || cleanSlug.length < 3) {
      setErrorMessage('Web address must be at least 3 characters long.');
      return;
    }

    if (slugAvailability.status === 'unavailable') {
      setErrorMessage(slugAvailability.message || 'Please choose an available web address.');
      return;
    }

    if (slugAvailability.status === 'error') {
      setErrorMessage('Please verify your web address availability before continuing.');
      return;
    }

    if (slugAvailability.status === 'checking') {
      setErrorMessage('Please wait while web address availability is being checked.');
      return;
    }

    if (slugAvailability.status === 'too_short') {
      setErrorMessage('Web address must be at least 3 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await onboardAcademy({
        name: cleanName,
        slug: cleanSlug,
        campus_name: campusName.trim() || undefined,
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      if (res.success) {
        await onSuccess(res.tenant);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to set up academy. Please check details and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg p-6 sm:p-8 my-8 transition-all">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Building2 className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Set Up New Academy</h2>
            </div>
            <p className="text-xs text-slate-500">
              Establish a new institutional workspace under your verified administrator account.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            title="Cancel"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Identity Context Banner */}
        <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="block text-[11px] font-semibold text-slate-700">Authenticated Account</span>
              <span className="block text-xs font-mono text-slate-900 font-bold">{activeEmail}</span>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100/70 border border-emerald-300 text-emerald-800 rounded-md">
            Director
          </span>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Institution Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Oxford Grammar School"
              disabled={isLoading}
              className="w-full text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-slate-900 font-semibold outline-hidden transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Web Address (Subdomain) <span className="text-rose-500">*</span>
              </label>
              {slugAvailability.status === 'checking' && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                </span>
              )}
              {slugAvailability.status === 'available' && (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Available
                </span>
              )}
              {slugAvailability.status === 'unavailable' && (
                <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {slugAvailability.isReserved ? 'Reserved' : 'Taken'}
                </span>
              )}
              {slugAvailability.status === 'error' && (
                <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600" /> Check failed
                  <button
                    type="button"
                    onClick={() => checkDomainAvailability(slug)}
                    className="underline hover:text-amber-900 ml-1 cursor-pointer font-bold"
                  >
                    Retry
                  </button>
                </span>
              )}
            </div>
            <div className="flex rounded-xl shadow-2xs border border-slate-200 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 overflow-hidden bg-slate-50 focus-within:bg-white transition-all">
              <input
                type="text"
                required
                value={slug}
                onChange={handleSlugChange}
                placeholder="oxford"
                disabled={isLoading}
                className="w-full text-xs bg-transparent px-3.5 py-2.5 text-slate-900 font-mono font-bold outline-hidden"
              />
              <span className="bg-slate-100 border-l border-slate-200 px-3 py-2.5 text-xs font-mono text-slate-500 flex items-center shrink-0">
                .kampus.pk
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Your staff and students will access the portal at https://{slug || 'your-academy'}.kampus.pk
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Campus Title
              </label>
              <input
                type="text"
                value={campusName}
                onChange={(e) => setCampusName(e.target.value)}
                placeholder="Main Campus"
                disabled={isLoading}
                className="w-full text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-slate-900 outline-hidden transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Lahore"
                disabled={isLoading}
                className="w-full text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-slate-900 outline-hidden transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Contact Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0300-1234567"
              disabled={isLoading}
              className="w-full text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-slate-900 outline-hidden transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isLoading ||
                slugAvailability.status === 'unavailable' ||
                slugAvailability.status === 'checking' ||
                slugAvailability.status === 'too_short' ||
                slugAvailability.status === 'error'
              }
              className="px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Academy...</span>
                </>
              ) : (
                <>
                  <span>Create Academy</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
