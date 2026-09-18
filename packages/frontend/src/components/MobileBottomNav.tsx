import React from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  CheckSquare, 
  MapPin, 
  BookOpen, 
  CreditCard, 
  GraduationCap, 
  UserCheck, 
  Menu,
  ShieldAlert,
  Users
} from 'lucide-react';
import { hapticLight, hapticSelection } from '../lib/haptics';

interface MobileBottomNavProps {
  currentScreen: string;
  onSelectScreen: (screen: string) => void;
  onOpenMenu: () => void;
  userRole?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentScreen,
  onSelectScreen,
  onOpenMenu,
  userRole = 'tenant_admin'
}) => {
  const handleNav = (screen: string) => {
    hapticSelection();
    onSelectScreen(screen);
  };

  const handleMenu = () => {
    hapticLight();
    onOpenMenu();
  };

  if (userRole === 'teacher') {
    return (
      <nav 
        data-testid="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 py-1 flex items-center justify-around md:hidden shadow-lg pb-[max(0.6rem,env(safe-area-inset-bottom))] select-none"
      >
        <button
          onClick={() => handleNav('teacher')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
            currentScreen === 'teacher' ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Faculty</span>
        </button>

        <button
          onClick={() => handleNav('timetable')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
            currentScreen === 'timetable' ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Schedule</span>
        </button>

        <button
          onClick={() => handleNav('attendance')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
            currentScreen === 'attendance' ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Attendance</span>
        </button>

        <button
          onClick={() => handleNav('geofence')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
            currentScreen === 'geofence' ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Geofence</span>
        </button>

        <button
          onClick={handleMenu}
          className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 text-slate-500 hover:text-slate-800 rounded-xl transition-all touch-press"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
        </button>
      </nav>
    );
  }

  if (userRole === 'student' || userRole === 'parent') {
    return (
      <nav 
        data-testid="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 py-1 flex items-center justify-around md:hidden shadow-lg pb-[max(0.6rem,env(safe-area-inset-bottom))] select-none"
      >
        <button
          onClick={() => handleNav('student_portal')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
            currentScreen === 'student_portal' ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Overview</span>
        </button>

        <button
          onClick={() => handleNav('timetable')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
            currentScreen === 'timetable' ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Timetable</span>
        </button>

        <button
          onClick={() => handleNav('voucher')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
            currentScreen === 'voucher' ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Challans</span>
        </button>

        <button
          onClick={() => handleNav('homework')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
            currentScreen === 'homework' ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Homework</span>
        </button>

        <button
          onClick={handleMenu}
          className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 text-slate-500 hover:text-slate-800 rounded-xl transition-all touch-press"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
        </button>
      </nav>
    );
  }

  // Super Admin Role
  if (userRole === 'super_admin') {
    return (
      <nav 
        data-testid="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1 flex items-center justify-around md:hidden shadow-xl pb-[max(0.6rem,env(safe-area-inset-bottom))] select-none"
      >
        <button
          onClick={() => handleNav('superadmin')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
            currentScreen === 'superadmin' ? 'text-amber-400 bg-slate-800 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Platform</span>
        </button>

        <button
          onClick={() => handleNav('dashboard')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
            currentScreen === 'dashboard' ? 'text-amber-400 bg-slate-800 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Campuses</span>
        </button>

        <button
          onClick={() => handleNav('voucher')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
            currentScreen === 'voucher' ? 'text-amber-400 bg-slate-800 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Receipts</span>
        </button>

        <button
          onClick={handleMenu}
          className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 text-slate-400 hover:text-white rounded-xl transition-all touch-press"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
        </button>
      </nav>
    );
  }

  // Default: Tenant Admin (Director / Principal)
  return (
    <nav 
      data-testid="mobile-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 py-1 flex items-center justify-around md:hidden shadow-lg pb-[max(0.6rem,env(safe-area-inset-bottom))] select-none"
    >
      <button
        onClick={() => handleNav('dashboard')}
        className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
          currentScreen === 'dashboard' ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 tracking-tight">Dashboard</span>
      </button>

      <button
        onClick={() => handleNav('attendance')}
        className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
          currentScreen === 'attendance' ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <CheckSquare className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 tracking-tight">Attendance</span>
      </button>

      <button
        onClick={() => handleNav('enrollment')}
        className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
          currentScreen === 'enrollment' || currentScreen === 'new_admission' || currentScreen === 'id_cards'
            ? 'text-amber-800 bg-amber-50 font-bold' 
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Users className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 tracking-tight">Students</span>
      </button>

      <button
        onClick={() => handleNav('voucher')}
        className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${
          currentScreen === 'voucher' ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <CreditCard className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 tracking-tight">Fees</span>
      </button>

      <button
        onClick={handleMenu}
        className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 text-slate-500 hover:text-slate-800 rounded-xl transition-all touch-press"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
      </button>
    </nav>
  );
};
