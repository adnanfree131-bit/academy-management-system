import React from 'react';
import { ShieldAlert, LogOut, ExternalLink } from 'lucide-react';

interface BrandedHostRestrictedAdvisoryProps {
  email?: string;
  expectedSlug: string;
  onLogout: () => void;
  baseDomain?: string;
  isCustomDomain?: boolean;
  customDomain?: string;
}

export const BrandedHostRestrictedAdvisory: React.FC<BrandedHostRestrictedAdvisoryProps> = ({
  email,
  expectedSlug,
  onLogout,
  baseDomain = 'kampus.pk',
  isCustomDomain,
  customDomain,
}) => {
  const centralPlatformUrl = `https://app.${baseDomain}`;

  // Eliminate malformed concatenation on custom domains (Finding B07 & B09)
  const isCustom = isCustomDomain || expectedSlug.includes('.') || Boolean(customDomain);
  const displayDomain = isCustom
    ? (customDomain || expectedSlug)
    : `${expectedSlug}.${baseDomain}`;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center space-y-5 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-100">Campus Access Restricted</h2>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">
            Your account is signed in, but you do not have an active membership for this specific academy campus.
          </p>
        </div>

        <div className="p-3 bg-slate-900/60 rounded-xl text-left border border-slate-700/60 text-xs space-y-1.5">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Campus Domain</div>
            <div className="text-slate-300 font-mono mt-0.5">{displayDomain}</div>
          </div>
          {email && (
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Signed In User</div>
              <div className="text-slate-300 font-mono mt-0.5 truncate">{email}</div>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-400 text-left bg-slate-900/30 p-3.5 rounded-xl border border-slate-700/40">
          <p className="font-semibold text-slate-300 mb-1">To access your account:</p>
          <p>
            Please go to the central portal at <span className="font-mono text-slate-200">{centralPlatformUrl}</span>, or open your designated campus web address.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <a
            href={centralPlatformUrl}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-600"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Go to Central Portal</span>
          </a>

          <button
            type="button"
            onClick={onLogout}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
