import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, Search, Bell, Plus } from 'lucide-react';

interface HeaderProps {
  currentScreenTitle: string;
  onOpenSidebar: () => void;
  onNewAdmission: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreenTitle,
  onOpenSidebar,
  onNewAdmission,
}) => {
  const { tenant } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200/90 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        <button 
          onClick={onOpenSidebar}
          className="md:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-900">{tenant?.name || 'Apex Academy ERP'}</span>
            <span>/</span>
            <span className="font-medium text-slate-600">{currentScreenTitle}</span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Campus: {tenant?.campus_name || 'Gulberg III'} • Academic Session {tenant?.academic_session || '2026-27'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block w-64 lg:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input 
            type="text" 
            placeholder="Search student, fee voucher, batch... (⌘K)" 
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>

        <button 
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors" 
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        <button 
          onClick={onNewAdmission}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Admission</span>
        </button>
      </div>
    </header>
  );
};
