import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, Search, ChevronRight, ChevronDown, LogOut, Shield, Settings, Users } from 'lucide-react';
import { hapticLight } from '../lib/haptics';

interface HeaderProps {
  section?: string;
  currentScreenTitle?: string;
  onOpenSidebar: () => void;
  onNewAdmission?: () => void;
  onSwitchScreen?: (screen: string) => void;
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  section,
  currentScreenTitle,
  onOpenSidebar,
  onOpenSearch,
  onSwitchScreen,
}) => {
  const { user, tenant, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleOpenNav = () => {
    hapticLight();
    onOpenSidebar();
  };

  const handleOpenSearchModal = () => {
    hapticLight();
    onOpenSearch?.();
  };

  return (
    <header className="bg-white border-b border-slate-200/90 min-h-[3.5rem] flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30 pt-[env(safe-area-inset-top)] select-none">
      <div className="flex items-center gap-2 min-w-0">
        <button 
          onClick={handleOpenNav}
          className="md:hidden text-slate-700 hover:text-slate-950 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 touch-press transition-colors"
          aria-label="Open Navigation"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          {section && (
            <>
              <span className="text-slate-400 font-medium hidden sm:inline truncate">
                {section}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline shrink-0" />
            </>
          )}
          <span className="font-semibold text-slate-800 truncate text-xs sm:text-sm">
            {currentScreenTitle || 'Dashboard'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={handleOpenSearchModal}
          className="hidden lg:flex items-center gap-2.5 w-52 xl:w-64 px-3 py-1.5 h-8.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-slate-400 text-xs text-left transition-colors group cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 transition-colors" />
          <span className="truncate">Search records...</span>
        </button>

        <button 
          type="button"
          onClick={handleOpenSearchModal}
          className="relative p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors lg:hidden border border-slate-200 touch-press" 
          title="Search"
          aria-label="Search records"
        >
          <Search className="w-4 h-4" />
        </button>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          <span>Session {tenant?.academic_session || '2026–2027'}</span>
        </div>

        {/* User Profile & Sign Out Menu */}
        <div className="relative">
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium hover:bg-slate-50 text-slate-800 border border-slate-200 transition-colors"
          >
            <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-[11px]">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="font-semibold text-slate-800 leading-none text-xs truncate max-w-[110px]">{user?.full_name || 'Administrator'}</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5 capitalize">{user?.role === 'tenant_admin' ? 'Admin' : user?.role || 'Staff'}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
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
    </header>
  );
};
