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
  ShieldAlert
} from 'lucide-react';

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
  if (userRole === 'teacher') {
    return (
      <nav 
        data-testid="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around md:hidden shadow-lg"
      >
        <button
          onClick={() => onSelectScreen('teacher')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
            currentScreen === 'teacher' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-5 h-5" />
          <span className="text-[10px]">Faculty</span>
        </button>

        <button
          onClick={() => onSelectScreen('timetable')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
            currentScreen === 'timetable' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px]">Schedule</span>
        </button>

        <button
          onClick={() => onSelectScreen('attendance')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
            currentScreen === 'attendance' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span className="text-[10px]">Attendance</span>
        </button>

        <button
          onClick={() => onSelectScreen('geofence')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
            currentScreen === 'geofence' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px]">Geofence</span>
        </button>

        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center gap-0.5 py-1 px-2 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px]">Menu</span>
        </button>
      </nav>
    );
  }

  if (userRole === 'student') {
    return (
      <nav 
        data-testid="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around md:hidden shadow-lg"
      >
        <button
          onClick={() => onSelectScreen('student_portal')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
            currentScreen === 'student_portal' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-5 h-5" />
          <span className="text-[10px]">Portal</span>
        </button>

        <button
          onClick={() => onSelectScreen('timetable')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
            currentScreen === 'timetable' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px]">Classes</span>
        </button>

        <button
          onClick={() => onSelectScreen('voucher')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
            currentScreen === 'voucher' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px]">Fees</span>
        </button>

        <button
          onClick={() => onSelectScreen('homework')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
            currentScreen === 'homework' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px]">Diary</span>
        </button>

        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center gap-0.5 py-1 px-2 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px]">Menu</span>
        </button>
      </nav>
    );
  }

  // Super Admin Role
  if (userRole === 'super_admin') {
    return (
      <nav 
        data-testid="mobile-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around md:hidden shadow-xl"
      >
        <button
          onClick={() => onSelectScreen('superadmin')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
            currentScreen === 'superadmin' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-5 h-5" />
          <span className="text-[10px]">Control Plane</span>
        </button>

        <button
          onClick={() => onSelectScreen('dashboard')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
            currentScreen === 'dashboard' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">Dashboard</span>
        </button>

        <button
          onClick={() => onSelectScreen('voucher')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
            currentScreen === 'voucher' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px]">Receipts</span>
        </button>

        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center gap-0.5 py-1 px-2 text-slate-400 hover:text-white rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px]">Menu</span>
        </button>
      </nav>
    );
  }

  // Default: Tenant Admin
  return (
    <nav 
      data-testid="mobile-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around md:hidden shadow-lg"
    >
      <button
        onClick={() => onSelectScreen('dashboard')}
        className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
          currentScreen === 'dashboard' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px]">Dashboard</span>
      </button>

      <button
        onClick={() => onSelectScreen('attendance')}
        className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
          currentScreen === 'attendance' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <CheckSquare className="w-5 h-5" />
        <span className="text-[10px]">Attendance</span>
      </button>

      <button
        onClick={() => onSelectScreen('timetable')}
        className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
          currentScreen === 'timetable' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Calendar className="w-5 h-5" />
        <span className="text-[10px]">Timetable</span>
      </button>

      <button
        onClick={() => onSelectScreen('voucher')}
        className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
          currentScreen === 'voucher' ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <CreditCard className="w-5 h-5" />
        <span className="text-[10px]">Fees</span>
      </button>

      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center gap-0.5 py-1 px-2 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px]">Menu</span>
      </button>
    </nav>
  );
};
