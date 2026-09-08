import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  CheckSquare, 
  PhoneForwarded, 
  UserPlus, 
  Printer, 
  Wallet, 
  Smartphone, 
  LogOut, 
  Building2, 
  Search,
  Calendar, 
  BookOpen, 
  MapPin, 
  MessageSquare, 
  GraduationCap, 
  UserCheck, 
  Award,
  CreditCard,
  ShieldAlert,
  X 
} from 'lucide-react';

interface SidebarProps {
  currentScreen: string;
  onSelectScreen: (screenId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onSelectScreen,
  isOpen,
  onClose,
}) => {
  const { user, tenant, logout } = useAuth();

  const handleNavClick = (screenId: string) => {
    onSelectScreen(screenId);
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  const role = user?.role || 'tenant_admin';

  // Role subtitle badge
  const roleSubtitle = 
    role === 'teacher' ? 'Faculty Teacher Desk' :
    role === 'student' ? 'Student & Parent Portal' :
    role === 'super_admin' ? 'Global SaaS Control' :
    'Enterprise Admin ERP';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      {/* Floating Inset Card Sidebar Container */}
      <div 
        className={`fixed md:sticky top-0 h-screen p-3 pr-0 flex flex-col justify-start z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <aside className="w-64 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between h-[calc(100vh-1.5rem)]">
          
          <div className="space-y-4 overflow-y-auto">
            {/* Institutional Brand Header */}
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl text-white font-bold font-mono flex items-center justify-center text-sm shadow-xs ${
                    role === 'teacher' ? 'bg-emerald-600' :
                    role === 'student' ? 'bg-sky-600' :
                    role === 'super_admin' ? 'bg-purple-600' :
                    'bg-indigo-600'
                  }`}>
                    {role === 'teacher' ? '👨‍🏫' : role === 'student' ? '🎓' : role === 'super_admin' ? '🛡️' : 'Æ'}
                  </div>
                  <div className="truncate">
                    <span className="font-extrabold text-sm text-slate-900 tracking-tight block leading-tight truncate">
                      {role === 'super_admin' ? 'Apex ERP Platform' : (tenant?.name || 'Apex Academy')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-semibold">{roleSubtitle}</span>
                  </div>
                </div>
                <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-700 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {role !== 'super_admin' && (
                <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 truncate max-w-[140px]">
                    <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{tenant?.campus_name || 'Main Campus'}</span>
                  </span>
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                    {tenant?.academic_session || '2026-27'}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Jump Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input 
                type="text" 
                placeholder="Jump to module... (⌘K)" 
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            {/* Real-World Role Scoped Navigation Hierarchy */}
            <nav className="space-y-4 text-xs">
              
              {/* ============================================================
                  ROLE: FACULTY TEACHER
                  ============================================================ */}
              {role === 'teacher' && (
                <>
                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-bold mb-1.5 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5" />
                      Faculty Desk
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('teacher')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'teacher'
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Faculty Desk</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('timetable')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'timetable'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        <span>My Teaching Schedule</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('attendance')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'attendance'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <CheckSquare className="w-4 h-4 text-teal-500" />
                        <span>Batch Attendance Roll Call</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('homework')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'homework'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <BookOpen className="w-4 h-4 text-amber-500" />
                        <span>Homework & Notebooks</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('exams')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'exams'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Award className="w-4 h-4 text-purple-500" />
                        <span>Exam Grading Desk</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('geofence')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'geofence'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <MapPin className="w-4 h-4 text-rose-500" />
                        <span>Campus GPS Clock-In</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Communication
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('complaints')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'complaints'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4 text-sky-500" />
                        <span>Academic Feedback</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ============================================================
                  ROLE: STUDENT / PARENT
                  ============================================================ */}
              {role === 'student' && (
                <>
                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-sky-700 font-bold mb-1.5 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" />
                      Student & Parent Desk
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('student_portal')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'student_portal'
                            ? 'bg-sky-600 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Academic 360 Desk</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('timetable')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'timetable'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        <span>Class Timetable</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('voucher')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'voucher'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-emerald-500" />
                        <span>Fee Invoices & Online Pay</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('homework')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'homework'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <BookOpen className="w-4 h-4 text-amber-500" />
                        <span>Homework Diary</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('exams')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'exams'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Award className="w-4 h-4 text-purple-500" />
                        <span>Official Report Cards</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Support Desk
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('complaints')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'complaints'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4 text-slate-500" />
                        <span>Submit Feedback / Concern</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ============================================================
                  ROLE: SUPER ADMIN (SaaS Operator)
                  ============================================================ */}
              {role === 'super_admin' && (
                <div>
                  <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-purple-700 font-bold mb-1.5 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Global SaaS Operations
                  </p>
                  <div className="space-y-1">
                    <button 
                      onClick={() => handleNavClick('superadmin')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                        currentScreen === 'superadmin'
                          ? 'bg-purple-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>SaaS Control Plane</span>
                    </button>

                    <button 
                      onClick={() => handleNavClick('dashboard')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                        currentScreen === 'dashboard'
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4 text-slate-500" />
                      <span>Tenant Operations View</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  ROLE: TENANT ADMIN (Principal / Director - Institutional ERP)
                  ============================================================ */}
              {(role === 'tenant_admin' || (!['teacher', 'student', 'super_admin'].includes(role))) && (
                <>
                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Executive Overview
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('dashboard')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'dashboard'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                        <span>Executive Dashboard</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Academic Administration
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('enrollment')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'enrollment'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <UserPlus className="w-4 h-4 text-blue-500" />
                        <span>Admissions & Student SIS</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('timetable')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'timetable'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Calendar className="w-4 h-4 text-emerald-500" />
                        <span>Timetable & Scheduling</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Daily Operations & Attendance
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('attendance')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'attendance'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <CheckSquare className="w-4 h-4 text-teal-500" />
                        <span>Student Attendance Desk</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('absentee')}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'absentee'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <PhoneForwarded className="w-4 h-4 text-rose-500" />
                          <span>Absence Follow-Up</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 font-mono">
                          28
                        </span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('homework')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'homework'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <BookOpen className="w-4 h-4 text-amber-500" />
                        <span>Homework & Notebooks</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('geofence')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'geofence'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <MapPin className="w-4 h-4 text-indigo-500" />
                        <span>Staff Geofence Clock-In</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('complaints')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'complaints'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4 text-slate-500" />
                        <span>Complaints & Feedback</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Examinations
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('exams')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'exams'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <GraduationCap className="w-4 h-4 text-purple-500" />
                        <span>Exam Bank & Evaluation</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Finance & Accounts
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('voucher')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'voucher'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Printer className="w-4 h-4 text-emerald-500" />
                        <span>Fee Invoices & Vouchers</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('payroll')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'payroll'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Wallet className="w-4 h-4 text-amber-500" />
                        <span>Staff Payroll & Salaries</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Mobile Web App (PWA) Badge */}
              <div>
                <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                  Mobile Access
                </p>
                <button 
                  onClick={() => handleNavClick('mobile')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                    currentScreen === 'mobile'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4" />
                    <span>Android / PWA View</span>
                  </div>
                  <span className="text-[9px] bg-emerald-700 text-white px-1.5 py-0.5 rounded-md font-mono font-bold">
                    APK
                  </span>
                </button>
              </div>

            </nav>
          </div>

          {/* Institutional Operator Card */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              <div className={`w-8 h-8 rounded-xl text-white font-mono text-xs font-bold flex items-center justify-center shadow-2xs flex-shrink-0 ${
                role === 'teacher' ? 'bg-emerald-600' :
                role === 'student' ? 'bg-sky-600' :
                role === 'super_admin' ? 'bg-purple-600' :
                'bg-slate-900'
              }`}>
                {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'AD'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-900 leading-tight truncate">
                  {user?.full_name || 'Director Adnan'}
                </p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1 capitalize">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    role === 'teacher' ? 'bg-emerald-500' :
                    role === 'student' ? 'bg-sky-500' :
                    role === 'super_admin' ? 'bg-purple-500' :
                    'bg-indigo-500'
                  }`} />
                  {role?.replace('_', ' ') || 'Admin'}
                </p>
              </div>
            </div>
            <button 
              onClick={logout}
              title="Sign Out" 
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </aside>
      </div>
    </>
  );
};
