import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, Search, Plus, ChevronDown, LogOut, Shield } from 'lucide-react';

interface HeaderProps {
  currentScreenTitle?: string;
  onOpenSidebar: () => void;
  onNewAdmission: () => void;
  onSwitchScreen?: (screen: string) => void;
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSidebar,
  onNewAdmission,
  onOpenSearch,
}) => {
  const { user, tenant, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200/90 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        <button 
          onClick={onOpenSidebar}
          className="md:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
          {tenant?.name || (user?.role === 'super_admin' ? 'Kampus Platform' : 'Academy')}
        </h1>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenSearch}
          className="relative hidden lg:flex items-center w-52 xl:w-64 text-left"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <span className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-400">
            Search students, fees, classes…
          </span>
        </button>

        <button 
          type="button"
          onClick={onOpenSearch}
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors lg:hidden" 
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {user?.role === 'tenant_admin' && (
          <button 
            onClick={onNewAdmission}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Admission</span>
          </button>
        )}

        {/* User Profile & Sign Out Menu */}
        <div className="relative">
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors"
          >
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-[11px]">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="font-semibold text-slate-900 leading-none text-xs">{user?.full_name || 'Administrator'}</p>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">{user?.role === 'tenant_admin' ? 'Administrator' : user?.role || 'Staff'}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 leading-tight">{user?.full_name || 'Administrator'}</p>
                <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">{user?.email}</p>
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-[10px] font-bold text-indigo-700 font-mono uppercase">
                  <Shield className="w-3 h-3" />
                  <span>{user?.role === 'tenant_admin' ? 'Tenant Administrator' : user?.role?.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="py-1">
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
