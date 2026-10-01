import React from 'react';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

interface NoMembershipsAdvisoryProps {
  email?: string;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
  onCreateAcademy?: () => void;
}

export const NoMembershipsAdvisory: React.FC<NoMembershipsAdvisoryProps> = ({
  email,
  onRefresh,
  onLogout,
  onCreateAcademy,
}) => {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center space-y-5 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-100">No Academy Memberships Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">
            Your authentication account is active, but is not currently associated with any school or academy workspace.
          </p>
        </div>

        {email && (
          <div className="p-3 bg-slate-900/60 rounded-xl text-left border border-slate-700/60 text-xs">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Signed In As</div>
            <div className="text-slate-300 font-mono mt-0.5 truncate">{email}</div>
          </div>
        )}

        <div className="text-[11px] text-slate-400 text-left bg-slate-900/30 p-3.5 rounded-xl border border-slate-700/40 space-y-1.5">
          <p className="font-semibold text-slate-300">How to proceed:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>If you received an invitation email, click the link in your email to accept your membership.</li>
            <li>If you are a student or teacher, contact your academy administrator to add your profile.</li>
            <li>If you want to set up an academy, click below to complete registration.</li>
            <li>If you just accepted an invitation, click check again below.</li>
          </ul>
        </div>

        {onCreateAcademy && (
          <div>
            <button
              type="button"
              onClick={onCreateAcademy}
              className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Set Up New Academy
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Checking...' : 'Check Again'}</span>
          </button>

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
