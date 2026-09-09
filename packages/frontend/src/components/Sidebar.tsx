import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  CheckSquare, 
  PhoneForwarded, 
  UserPlus, 
  Receipt,
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
  ShieldAlert,
  ShieldCheck,
  Layers,
  TrendingUp,
  Settings,
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
    role === 'teacher' ? 'Faculty Portal' :
    role === 'student' ? 'Student Portal' :
    role === 'super_admin' ? 'Platform Console' :
    'Campus Administration';

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
          
          {/* Institutional Brand Header (Pinned Static Top) */}
          <div className="border-b border-slate-100 pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl text-white font-bold flex items-center justify-center text-sm shadow-xs ${
                  role === 'teacher' ? 'bg-emerald-600' :
                  role === 'student' ? 'bg-sky-600' :
                  role === 'super_admin' ? 'bg-purple-600' :
                  'bg-indigo-600'
                }`}>
                  {role === 'teacher' ? <BookOpen className="w-4 h-4" /> :
                   role === 'student' ? <GraduationCap className="w-4 h-4" /> :
                   role === 'super_admin' ? <ShieldCheck className="w-4 h-4" /> :
                   <GraduationCap className="w-4 h-4" />}
                </div>
                <div className="truncate">
                  <span className="font-extrabold text-sm text-slate-900 tracking-tight block leading-tight truncate">
                    {role === 'super_admin' ? 'Apex Platform' : (tenant?.name || 'Apex Academy')}
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

          {/* Scrollable Navigation Body */}
          <div className="flex-1 min-h-0 py-3 space-y-4 overflow-y-auto pr-1 -mr-1">
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
                      Teaching Desk
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
                        <LayoutDashboard className={`w-4 h-4 ${currentScreen === 'teacher' ? 'text-white' : 'text-emerald-600'}`} />
                        <span>Faculty Overview</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('timetable')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'timetable'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Calendar className={`w-4 h-4 ${currentScreen === 'timetable' ? 'text-white' : 'text-indigo-500'}`} />
                        <span>Class Schedule</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('attendance')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'attendance'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <CheckSquare className={`w-4 h-4 ${currentScreen === 'attendance' ? 'text-white' : 'text-teal-500'}`} />
                        <span>Take Attendance</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('homework')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'homework'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <BookOpen className={`w-4 h-4 ${currentScreen === 'homework' ? 'text-white' : 'text-amber-500'}`} />
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
                        <Award className={`w-4 h-4 ${currentScreen === 'exams' ? 'text-white' : 'text-purple-500'}`} />
                        <span>Grade Examinations</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('geofence')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'geofence'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <MapPin className={`w-4 h-4 ${currentScreen === 'geofence' ? 'text-white' : 'text-rose-500'}`} />
                        <span>Campus Check-In</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Messages
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
                        <MessageSquare className={`w-4 h-4 ${currentScreen === 'complaints' ? 'text-white' : 'text-sky-500'}`} />
                        <span>Faculty Feedback</span>
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
                      Student Portal
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
                        <UserCheck className={`w-4 h-4 ${currentScreen === 'student_portal' ? 'text-white' : 'text-sky-600'}`} />
                        <span>Student Overview</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('timetable')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'timetable'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Calendar className={`w-4 h-4 ${currentScreen === 'timetable' ? 'text-white' : 'text-indigo-500'}`} />
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
                        <Receipt className={`w-4 h-4 ${currentScreen === 'voucher' ? 'text-white' : 'text-emerald-500'}`} />
                        <span>Fee Invoices & Payments</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('homework')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'homework'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <BookOpen className={`w-4 h-4 ${currentScreen === 'homework' ? 'text-white' : 'text-amber-500'}`} />
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
                        <Award className={`w-4 h-4 ${currentScreen === 'exams' ? 'text-white' : 'text-purple-500'}`} />
                        <span>Report Cards</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Support
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
                        <MessageSquare className={`w-4 h-4 ${currentScreen === 'complaints' ? 'text-white' : 'text-slate-500'}`} />
                        <span>Complaints & Requests</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ============================================================
                  ROLE: SUPER ADMIN (Platform Operator)
                  ============================================================ */}
              {role === 'super_admin' && (
                <div>
                  <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-purple-700 font-bold mb-1.5 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Platform Administration
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
                      <ShieldAlert className={`w-4 h-4 ${currentScreen === 'superadmin' ? 'text-white' : 'text-purple-600'}`} />
                      <span>Academy Directory</span>
                    </button>

                    <button 
                      onClick={() => handleNavClick('dashboard')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                        currentScreen === 'dashboard'
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <LayoutDashboard className={`w-4 h-4 ${currentScreen === 'dashboard' ? 'text-white' : 'text-slate-500'}`} />
                      <span>Campus Overview</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  ROLE: TENANT ADMIN (Principal / Director - Academy Administration)
                  ============================================================ */}
              {(role === 'tenant_admin' || (!['teacher', 'student', 'super_admin'].includes(role))) && (
                <>
                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Overview
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
                        <LayoutDashboard className={`w-4 h-4 ${currentScreen === 'dashboard' ? 'text-white' : 'text-indigo-600'}`} />
                        <span>Dashboard</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Academic Management
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
                        <UserPlus className={`w-4 h-4 ${currentScreen === 'enrollment' ? 'text-white' : 'text-blue-500'}`} />
                        <span>Student Admissions</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('classes')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'classes'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Layers className={`w-4 h-4 ${currentScreen === 'classes' ? 'text-white' : 'text-indigo-500'}`} />
                        <span>Classes & Batches</span>
                      </button>


                      <button 
                        onClick={() => handleNavClick('timetable')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'timetable'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Calendar className={`w-4 h-4 ${currentScreen === 'timetable' ? 'text-white' : 'text-emerald-500'}`} />
                        <span>Timetable & Scheduling</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Daily Operations
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
                        <CheckSquare className={`w-4 h-4 ${currentScreen === 'attendance' ? 'text-white' : 'text-teal-500'}`} />
                        <span>Student Attendance</span>
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
                          <PhoneForwarded className={`w-4 h-4 ${currentScreen === 'absentee' ? 'text-white' : 'text-rose-500'}`} />
                          <span>Absence Follow-Up</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition-colors ${
                          currentScreen === 'absentee'
                            ? 'bg-rose-500 text-white'
                            : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}>
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
                        <BookOpen className={`w-4 h-4 ${currentScreen === 'homework' ? 'text-white' : 'text-amber-500'}`} />
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
                        <MapPin className={`w-4 h-4 ${currentScreen === 'geofence' ? 'text-white' : 'text-indigo-500'}`} />
                        <span>Staff Attendance</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('complaints')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'complaints'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <MessageSquare className={`w-4 h-4 ${currentScreen === 'complaints' ? 'text-white' : 'text-slate-500'}`} />
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
                        <GraduationCap className={`w-4 h-4 ${currentScreen === 'exams' ? 'text-white' : 'text-purple-500'}`} />
                        <span>Exams & Results</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Finance
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
                        <Receipt className={`w-4 h-4 ${currentScreen === 'voucher' ? 'text-white' : 'text-emerald-500'}`} />
                        <span>Fee Invoices & Vouchers</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('expenses')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'expenses'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <TrendingUp className={`w-4 h-4 ${currentScreen === 'expenses' ? 'text-white' : 'text-amber-500'}`} />
                        <span>Income & Expenses</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('payroll')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'payroll'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Wallet className={`w-4 h-4 ${currentScreen === 'payroll' ? 'text-white' : 'text-amber-500'}`} />
                        <span>Staff Payroll</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Administration
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('settings')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                          currentScreen === 'settings'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Settings className={`w-4 h-4 ${currentScreen === 'settings' ? 'text-white' : 'text-slate-500'}`} />
                        <span>Academy Settings</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Mobile Access */}
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
                    <Smartphone className={`w-4 h-4 ${currentScreen === 'mobile' ? 'text-white' : 'text-emerald-600'}`} />
                    <span>Mobile App</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                    currentScreen === 'mobile' ? 'bg-white/20 text-white' : 'bg-emerald-700 text-white'
                  }`}>
                    PWA
                  </span>
                </button>
              </div>

            </nav>
          </div>

          {/* User Profile Card (Pinned Static Bottom) */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 truncate">
              <div className={`w-8 h-8 rounded-xl text-white font-mono text-xs font-bold flex items-center justify-center shadow-2xs flex-shrink-0 ${
                role === 'teacher' ? 'bg-emerald-600' :
                role === 'student' ? 'bg-sky-600' :
                role === 'super_admin' ? 'bg-purple-600' :
                'bg-slate-900'
              }`}>
                {(user?.full_name?.includes('Physics') ? 'ST' : user?.full_name?.includes('Director') ? 'AR' : user?.full_name?.substring(0, 2).toUpperCase()) || 'AR'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-900 leading-tight truncate">
                  {user?.full_name?.includes('Physics') ? 'Sir Tariq' : user?.full_name?.includes('Director') ? 'Adnan Rafiq' : (user?.full_name || 'Adnan Rafiq')}
                </p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1 capitalize">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    role === 'teacher' ? 'bg-emerald-500' :
                    role === 'student' ? 'bg-sky-500' :
                    role === 'super_admin' ? 'bg-purple-500' :
                    'bg-indigo-500'
                  }`} />
                  {role === 'tenant_admin' ? 'Campus Administrator' :
                   role === 'teacher' ? 'Faculty Member' :
                   role === 'student' ? 'Enrolled Student' :
                   'Platform Admin'}
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
