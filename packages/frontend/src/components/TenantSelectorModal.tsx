import React from 'react';
import { Building2, Shield, ArrowRight, X } from 'lucide-react';
import { AcademyLogo } from './AcademyLogo';

export interface TenantMembershipSummary {
  membership_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: string;
  campus_name?: string | null;
  city?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  status: string;
}

interface TenantSelectorModalProps {
  isOpen: boolean;
  memberships: TenantMembershipSummary[];
  activeTenantId: string | null;
  onSelectTenant: (tenantId: string) => Promise<void>;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const TenantSelectorModal: React.FC<TenantSelectorModalProps> = ({
  isOpen,
  memberships,
  activeTenantId,
  onSelectTenant,
  onClose,
  canDismiss = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Select Academy Workspace</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Your account is associated with multiple campuses. Choose an academy to proceed.
              </p>
            </div>
          </div>
          {canDismiss && onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Memberships List */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 divide-y divide-slate-100/70">
          {memberships.map((m) => {
            const isSelected = m.tenant_id === activeTenantId;
            return (
              <div
                key={m.membership_id || m.tenant_id}
                className={`pt-3 first:pt-0 flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-slate-800 bg-slate-50/80 shadow-2xs'
                    : 'border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <AcademyLogo
                    src={m.logo_url || (m.tenant_slug === 'tsa' ? '/tsa-logo.png' : undefined)}
                    name={m.tenant_name || 'Academy'}
                    size={38}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {m.tenant_name}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-mono uppercase font-bold text-slate-700 bg-slate-200/80 px-1.5 py-0.5 rounded border border-slate-300">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {m.campus_name || 'Main Campus'} {m.city ? `• ${m.city}` : ''}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <Shield className="w-2.5 h-2.5 text-slate-500" />
                        <span className="capitalize">{m.role.replace('_', ' ')}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectTenant(m.tenant_id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{isSelected ? 'Continue' : 'Select'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>You can switch between your academies at any time from your profile menu.</span>
        </div>
      </div>
    </div>
  );
};
