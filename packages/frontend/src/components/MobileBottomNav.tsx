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
import { canOpenScreen, UserAccessMap } from '../lib/portalAccess';

interface MobileBottomNavProps {
  currentScreen: string;
  onSelectScreen: (screen: string) => void;
  onOpenMenu: () => void;
  userRole?: string;
  permissions?: string[];
  userAccess?: UserAccessMap | null;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  isMenu?: boolean;
  isActive?: (current: string) => boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentScreen,
  onSelectScreen,
  onOpenMenu,
  userRole = 'tenant_admin',
  permissions,
  userAccess,
}) => {
  const isSuperAdmin = userRole === 'super_admin';

  const getNavItems = (): NavItem[] => {
    if (userRole === 'teacher') {
      return [
        { id: 'teacher', label: 'Faculty', icon: GraduationCap },
        { id: 'timetable', label: 'Schedule', icon: Calendar },
        { id: 'attendance', label: 'Attendance', icon: CheckSquare },
        { id: 'geofence', label: 'Geofence', icon: MapPin },
        { id: 'menu', label: 'Menu', icon: Menu, isMenu: true }
      ];
    }

    if (userRole === 'student' || userRole === 'parent') {
      return [
        { id: 'student_portal', label: 'Overview', icon: UserCheck },
        { id: 'timetable', label: 'Timetable', icon: Calendar },
        { id: 'voucher', label: 'Challans', icon: CreditCard },
        { id: 'homework', label: 'Homework', icon: BookOpen },
        { id: 'menu', label: 'Menu', icon: Menu, isMenu: true }
      ];
    }

    if (userRole === 'super_admin') {
      return [
        { id: 'superadmin', label: 'Platform', icon: ShieldAlert },
        { id: 'dashboard', label: 'Campuses', icon: LayoutDashboard },
        { id: 'menu', label: 'Menu', icon: Menu, isMenu: true }
      ];
    }

    // Default: Tenant admin / staff - filter items by granular permissions
    const defaultItems: NavItem[] = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'attendance', label: 'Attendance', icon: CheckSquare },
      { 
        id: 'enrollment', 
        label: 'Students', 
        icon: Users,
        isActive: (current) => current === 'enrollment' || current === 'new_admission' || current === 'id_cards'
      },
      { id: 'voucher', label: 'Fees', icon: CreditCard },
      { id: 'menu', label: 'Menu', icon: Menu, isMenu: true }
    ];

    return defaultItems.filter(item => {
      if (item.isMenu || item.id === 'dashboard') return true;
      return canOpenScreen(userRole, permissions, item.id, userAccess);
    });
  };

  const navItems = getNavItems();

  return (
    <nav 
      data-testid="mobile-bottom-nav"
      className={`fixed bottom-0 inset-x-0 z-40 md:hidden flex items-center justify-around shadow-lg pb-[max(0.6rem,env(safe-area-inset-bottom))] px-2 py-1 select-none ${
        isSuperAdmin 
          ? 'bg-slate-900/95 backdrop-blur-md border-t border-slate-800' 
          : 'bg-white/95 backdrop-blur-md border-t border-slate-200/90'
      }`}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.isMenu 
          ? false 
          : (item.isActive ? item.isActive(currentScreen) : currentScreen === item.id);

        const handleClick = () => {
          if (item.isMenu) {
            hapticLight();
            onOpenMenu();
          } else {
            hapticSelection();
            onSelectScreen(item.id);
          }
        };

        const activeClass = isSuperAdmin
          ? (active ? 'text-amber-400 bg-slate-800 font-bold' : 'text-slate-400 hover:text-white')
          : (active ? 'text-amber-800 bg-amber-50 font-bold' : 'text-slate-500 hover:text-slate-800');

        return (
          <button
            key={item.id}
            onClick={handleClick}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all touch-press ${activeClass}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
