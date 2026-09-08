import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, Search, Bell, Plus, Users, ChevronDown, Check } from 'lucide-react';

interface HeaderProps {
  currentScreenTitle: string;
  onOpenSidebar: () => void;
  onNewAdmission: () => void;
  onSwitchScreen?: (screen: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreenTitle,
  onOpenSidebar,
  onNewAdmission,
  onSwitchScreen,
}) => {
  const { user, tenant, switchDemoAccount } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const demoAccounts = [
    {
      label: 'Director Adnan (Admin)',
      email: 'adnan@apexacademy.edu.pk',
      slug: 'apex',
      badge: 'Admin',
      screen: 'dashboard',
      color: 'text-indigo-600',
    },
    {
      label: 'Sir Tariq Physics (Faculty)',
      email: 'tariq@apexacademy.edu.pk',
      slug: 'apex',
      badge: 'Teacher',
      screen: 'teacher',
      color: 'text-emerald-600',
    },
    {
      label: 'Muhammad Ali (Student & Parent)',
      email: 'student@apexacademy.edu.pk',
      slug: 'apex',
      badge: 'Student',
      screen: 'student_portal',
      color: 'text-sky-600',
    },
    {
      label: 'Super Admin Control Plane',
      email: 'superadmin@apexacademyerp.com',
      slug: 'apex',
      badge: 'Super Admin',
      screen: 'superadmin',
      color: 'text-purple-600',
    },
    {
      label: 'Crescent College (Locked Trial)',
      email: 'admin@crescentcollege.edu.pk',
      slug: 'crescent',
      badge: 'Locked Demo',
      screen: 'dashboard',
      color: 'text-rose-600',
    },
  ];

  const handleSelectRole = async (acc: typeof demoAccounts[0]) => {
    setSwitching(true);
    setRoleMenuOpen(false);
    try {
      await switchDemoAccount(acc.email, acc.slug);
      if (onSwitchScreen) {
        onSwitchScreen(acc.screen);
      }
    } catch (err) {
      console.error('Role switch failed:', err);
    } finally {
      setSwitching(false);
    }
  };

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

      <div className="flex items-center gap-2.5">
        {/* Quick Role Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setRoleMenuOpen(!roleMenuOpen)}
            disabled={switching}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 transition-colors"
            title="Switch Demo Role"
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline font-mono text-[11px]">
              {switching ? 'Switching...' : (user?.full_name?.split(' ')[0] || 'Role Switcher')}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 font-mono">
              {user?.role?.replace('_', ' ') || 'Admin'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {roleMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3 py-1 border-b border-slate-100">
                <p className="text-[10px] font-mono uppercase font-bold text-slate-400">1-Click Role Switcher</p>
                <p className="text-[11px] text-slate-600">Simulate any persona in real-time</p>
              </div>
              <div className="py-1">
                {demoAccounts.map((acc) => {
                  const isActive = user?.email.toLowerCase() === acc.email.toLowerCase();
                  return (
                    <button
                      key={acc.email}
                      onClick={() => handleSelectRole(acc)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        isActive ? 'bg-indigo-50/60 font-semibold' : ''
                      }`}
                    >
                      <div>
                        <p className="text-xs text-slate-800 font-medium leading-tight">{acc.label}</p>
                        <p className="text-[10px] font-mono text-slate-400">{acc.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border text-slate-700 bg-slate-50`}>
                          {acc.badge}
                        </span>
                        {isActive && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative hidden lg:block w-52 xl:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input 
            type="text" 
            placeholder="Search student, fee voucher... (⌘K)" 
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
