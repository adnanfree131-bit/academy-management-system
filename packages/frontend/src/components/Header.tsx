import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, Search, ChevronDown, LogOut, Shield, Settings, Users, Bell, UserPlus } from 'lucide-react';
import { hapticLight } from '../lib/haptics';
import { canOpenScreen } from '../lib/portalAccess';

interface HeaderProps {
  section?: string;
  currentScreenTitle?: string;
  onOpenSidebar: () => void;
  onNewAdmission?: () => void;
  onSwitchScreen?: (screen: string) => void;
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreenTitle,
  onOpenSidebar,
  onOpenSearch,
  onNewAdmission,
  onSwitchScreen,
}) => {
  const { user, tenant, token, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [absenteePending, setAbsenteePending] = useState(0);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Fetch pending absentee count for notification bell dot
  useEffect(() => {
    if (!token || user?.role === 'super_admin') return;
    fetch('/api/v1/absentee/kpi', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(body => {
        const kpi = body.data || {};
        setAbsenteePending(Number(kpi.pending_count || kpi.pending || 0));
      })
      .catch(() => setAbsenteePending(0));
  }, [token, user?.role]);

  // Outside click dismiss for profile dropdown
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [profileMenuOpen]);

  const handleOpenNav = () => {
    hapticLight();
    onOpenSidebar();
  };

  const handleOpenSearchModal = () => {
    hapticLight();
    onOpenSearch?.();
  };

  return (
    <header className="bg-white border-b border-[#E6ECF2] min-h-[3.5rem] sticky top-0 z-30 pt-[env(safe-area-inset-top)] select-none shrink-0">
      <div className="h-14 min-h-[3.5rem] flex items-center justify-between px-3 sm:px-6 lg:px-7 shrink-0">
        {/* Left: Mobile Navigation Toggle & Title / Search */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button 
            onClick={handleOpenNav}
            className="md:hidden text-slate-700 hover:text-slate-950 w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-[#E6ECF2] hover:bg-slate-100 touch-press transition-colors shrink-0"
            aria-label="Open Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile Screen Title Header with Academy Branding */}
          <div className="md:hidden min-w-0 flex-1 flex flex-col justify-center px-1">
            <span className="text-xs font-bold text-slate-900 truncate leading-snug">
              {tenant?.name || 'The Smart Academy'}
            </span>
            <span className="text-[10px] text-slate-500 font-medium truncate leading-normal">
              {currentScreenTitle || 'Portal'}
            </span>
          </div>

          {/* Desktop Search Input Bar */}
          <button
            type="button"
            onClick={handleOpenSearchModal}
            className="hidden md:flex items-center gap-2.5 w-64 sm:w-80 lg:w-96 px-3.5 py-2 h-9 bg-slate-50 hover:bg-slate-100/70 border border-[#E6ECF2] rounded-xl text-slate-500 text-xs text-left transition-colors group cursor-pointer"
          >
            <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0 transition-colors" />
            <span className="truncate">Search records...</span>
          </button>
        </div>

      {/* Right: Search (Mobile Icon), Notification Bell, Session Badge & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Mobile Search Icon Button */}
        <button
          type="button"
          onClick={handleOpenSearchModal}
          className="md:hidden w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl border border-[#E6ECF2] text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          title="Search"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notification Bell (Behance Slide 11) */}
        <button
          type="button"
          onClick={() => {
            if (user?.role === 'student' || user?.role === 'parent') {
              onSwitchScreen?.('student_portal');
            } else if (canOpenScreen(user?.role, user?.permissions, 'absentee', user?.access)) {
              onSwitchScreen?.('absentee');
            }
          }}
          className="relative w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl border border-[#E6ECF2] text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {absenteePending > 0 && (
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
          )}
        </button>

        {/* Desktop New Admission Button */}
        {canOpenScreen(user?.role, user?.permissions, 'new_admission', user?.access) && (
          <button
            type="button"
            onClick={() => {
              if (onNewAdmission) {
                onNewAdmission();
              } else if (onSwitchScreen) {
                onSwitchScreen('new_admission');
              }
            }}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 h-9 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Register New Student Admission"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Admission</span>
          </button>
        )}

        {/* Academic Session Pill */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 h-9 rounded-xl text-[11px] font-medium text-slate-600 bg-slate-50 border border-[#E6ECF2]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Session {tenant?.academic_session || '2026–2027'}</span>
        </div>

        {/* User Profile & Sign Out Menu (Behance Slide 11) */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center gap-2.5 px-2 py-1 h-9 rounded-xl text-xs font-medium hover:bg-slate-50 text-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="font-semibold text-slate-800 leading-tight text-xs truncate max-w-[120px]">{user?.full_name || 'Administrator'}</p>
              <p className="text-[10px] text-slate-400 leading-tight mt-0.5 capitalize">{user?.role === 'tenant_admin' ? 'Administrator' : user?.role || 'Staff'}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {profileMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-60 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 leading-tight">{user?.full_name || 'Administrator'}</p>
                <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">{user?.email}</p>
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700 font-mono uppercase border border-slate-200">
                  <Shield className="w-3 h-3 text-slate-600" />
                  <span>{user?.role === 'tenant_admin' ? 'Tenant Administrator' : user?.role?.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="py-1">
                {user?.role === 'tenant_admin' && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setProfileMenuOpen(false); onSwitchScreen?.('staff'); }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Staff
                    </button>
                    <button
                      type="button"
                      onClick={() => { setProfileMenuOpen(false); onSwitchScreen?.('settings'); }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Settings
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-3.5 py-2 flex items-center gap-2 text-xs text-rose-600 hover:bg-rose-50 font-semibold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
};
