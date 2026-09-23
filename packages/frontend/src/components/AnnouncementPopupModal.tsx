import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PlatformAnnouncement } from '@apex/shared-types';
import { Bell, AlertTriangle, Info, ShieldAlert, Check, ExternalLink, X } from 'lucide-react';
import { useMobileOverlay } from '../lib/mobileOverlay';

export const AnnouncementPopupModal: React.FC = () => {
  const { user, token } = useAuth();
  const [announcement, setAnnouncement] = useState<PlatformAnnouncement | null>(null);
  const [dismissing, setDismissing] = useState<boolean>(false);
  useMobileOverlay('sheet', Boolean(announcement), () => setAnnouncement(null));

  useEffect(() => {
    if (!token || !user?.tenant_id || user.role === 'super_admin') return;

    let isMounted = true;
    const checkActivePopup = async () => {
      try {
        const res = await fetch(`/api/v1/saas/tenant/active-popup?tenant_id=${encodeURIComponent(user.tenant_id)}&user_id=${encodeURIComponent(user.id)}`, {
          headers: {
            authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const body = await res.json();
          if (isMounted && body.data) {
            setAnnouncement(body.data);
          }
        }
      } catch (err) {
        console.error('Failed fetching active platform announcement:', err);
      }
    };

    checkActivePopup();

    return () => {
      isMounted = false;
    };
  }, [token, user?.tenant_id, user?.id]);

  const handleDismiss = async () => {
    if (!announcement || !user?.tenant_id) return;
    setDismissing(true);
    try {
      const res = await fetch(`/api/v1/saas/tenant/announcements/${announcement.id}/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: user.tenant_id,
          user_id: user.id
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Could not save dismissal');
      }
      setAnnouncement(null);
    } catch (err) {
      console.error('Failed dismissing platform announcement:', err);
      setAnnouncement(null);
    } finally {
      setDismissing(false);
    }
  };

  if (user?.role === 'super_admin' || !announcement) return null;

  const getTypeStyle = (type: PlatformAnnouncement['type']) => {
    switch (type) {
      case 'urgent':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />,
          badge: 'bg-rose-100 text-rose-900 border-rose-200',
          border: 'border-rose-300',
          headerBg: 'bg-rose-50/80',
          label: 'Priority Action Required'
        };
      case 'warning':
        return {
          icon: <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />,
          badge: 'bg-amber-100 text-amber-900 border-amber-200',
          border: 'border-amber-300',
          headerBg: 'bg-amber-50/80',
          label: 'System Advisory'
        };
      case 'maintenance':
        return {
          icon: <Info className="w-5 h-5 text-blue-700 shrink-0" />,
          badge: 'bg-blue-100 text-blue-900 border-blue-200',
          border: 'border-blue-300',
          headerBg: 'bg-blue-50/80',
          label: 'Scheduled Maintenance'
        };
      default:
        return {
          icon: <Bell className="w-5 h-5 text-slate-700 shrink-0" />,
          badge: 'bg-slate-100 text-slate-900 border-slate-200',
          border: 'border-slate-300',
          headerBg: 'bg-slate-50/80',
          label: 'Platform Notice'
        };
    }
  };

  const style = getTypeStyle(announcement.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs mobile-sheet">
      <div 
        role="dialog" 
        aria-modal="true" 
        className={`w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border ${style.border} overflow-hidden animate-in fade-in zoom-in-95 duration-150 mobile-sheet-card`}
      >
        {/* Modal Header */}
        <div className={`px-4 sm:px-6 py-3 sm:py-4 ${style.headerBg} border-b border-slate-200 flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            {style.icon}
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${style.badge}`}>
                {style.label}
              </span>
              <h2 className="text-sm font-bold text-slate-900 mt-1">{announcement.title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
              {new Date(announcement.created_at).toLocaleDateString()}
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Close announcement"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-[60vh]">
          {announcement.message}
        </div>

        {/* Action Button if specified */}
        {announcement.action_url && announcement.action_label && (
          <div className="px-4 sm:px-5 pb-2">
            <a
              href={announcement.action_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg border border-indigo-200 transition-colors h-8"
            >
              <span>{announcement.action_label}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 font-medium text-center sm:text-left">
            {announcement.frequency === 'every_login' 
              ? 'Institutional broadcast alert' 
              : 'Will not display again once dismissed'}
          </span>
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="w-full sm:w-auto h-8.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:bg-slate-400 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{dismissing ? 'Acknowledging...' : 'Acknowledge & Close'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
