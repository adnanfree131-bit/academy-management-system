import React from 'react';
import { Building2, ExternalLink, Globe } from 'lucide-react';

export interface UnavailableDomainAdvisoryProps {
  hostname?: string;
  baseDomain?: string;
  onRetry?: () => void;
}

export const UnavailableDomainAdvisory: React.FC<UnavailableDomainAdvisoryProps> = ({
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
  baseDomain = 'kampus.pk',
  onRetry,
}) => {
  const centralPlatformUrl = `https://app.${baseDomain}`;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center space-y-5 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-slate-700/60 text-slate-300 border border-slate-600/60 flex items-center justify-center mx-auto">
          <Building2 className="w-6 h-6 text-slate-300" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Academy Portal Not Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed mt-1.5">
            The requested web address is not configured for an active academy on this platform. The campus domain may have been moved, renamed, or retired.
          </p>
        </div>

        <div className="p-3.5 bg-slate-900/70 rounded-xl text-left border border-slate-700/70 text-xs space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Requested Host</div>
          <div className="text-slate-300 font-mono mt-0.5 break-all select-all flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{hostname || 'unknown'}</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 text-left bg-slate-900/40 p-3.5 rounded-xl border border-slate-700/50 leading-relaxed">
          <p className="font-semibold text-slate-300 mb-1">Administrative Guidance:</p>
          <p>
            If you are a student, teacher, or staff member, please contact your academy administration for the correct campus portal address or sign in through the central portal.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <a
            href={centralPlatformUrl}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-600"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Go to Central Portal ({`app.${baseDomain}`})</span>
          </a>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
