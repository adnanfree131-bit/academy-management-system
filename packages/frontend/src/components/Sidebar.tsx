import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AcademyLogo } from './AcademyLogo';
import { canOpenScreen, isManagedStaff } from '../lib/portalAccess';
import { 
  LayoutDashboard, 
  CheckSquare, 
  PhoneForwarded, 
  UserPlus,
  Users, 
  CreditCard,
  Receipt,
  Wallet, 
  LogOut, 
  Calendar, 
  BookOpen, 
  MapPin, 
  MessageSquare, 
  GraduationCap, 
  UserCheck, 
  Award,
  ShieldAlert,
  Layers,
  TrendingUp,
  Settings,
  FileText,
  RotateCcw,
  X 
} from 'lucide-react';
import { hapticSelection } from '../lib/haptics';

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
  const { user, tenant, token, logout } = useAuth();
  const role = user?.role || 'tenant_admin';
  const managedStaff = isManagedStaff(role, user?.permissions);
  const allow = (screen: string) => canOpenScreen(role, user?.permissions, screen, user?.access);
  const [absenteePending, setAbsenteePending] = useState(0);

  useEffect(() => {
    if (!token || role === 'super_admin') return;
    fetch('/api/v1/absentee/kpi', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(body => {
        const kpi = body.data || {};
        setAbsenteePending(Number(kpi.pending_count || kpi.pending || 0));
      })
      .catch(() => setAbsenteePending(0));
  }, [token, currentScreen, role]);

  const handleNavClick = (screenId: string) => {
    hapticSelection();
    onSelectScreen(screenId);
    if (window.innerWidth < 768) {
      onClose();
    }
  };


  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 md:hidden no-sheet-overlay animate-in fade-in duration-200"
        />
      )}

      {/* Desktop Full-Height Sticky Sidebar & Mobile Drawer */}
      <div 
        className={`fixed md:sticky top-0 left-0 h-[100dvh] md:h-screen flex flex-col justify-start z-50 md:z-40 transition-transform duration-[220ms] ease-out shrink-0 md:[background:linear-gradient(to_bottom,#ffffff_56px,#F4F8FC_56px)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <aside className="w-[78vw] max-w-[260px] md:w-[232px] bg-[#081A2F] rounded-tr-2xl rounded-br-2xl border border-[#152F4F]/70 border-l-0 flex flex-col justify-between h-[100dvh] md:h-screen text-slate-300 p-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[4px_0_20px_rgba(8,26,47,0.12)] overflow-hidden">
          
          {/* Institutional Brand Header (Pinned Static Top) */}
          <div className="border-b border-[#152F4F]/60 pb-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              {role === 'super_admin' ? (
                <img src="/kampus-logo.png?v=official2" alt="Kampus" className="h-8 w-auto max-w-[150px] object-contain object-left" />
              ) : (
                <div className="min-w-0 flex-1 flex items-center gap-2.5">
                  <AcademyLogo 
                    src={tenant?.logo_url || tenant?.settings?.logo_url || (tenant?.slug === 'tsa' ? '/tsa-logo.png' : undefined)} 
                    name={tenant?.name || 'Apex Academy'} 
                    size={34} 
                    className="!rounded-xl shrink-0 shadow-xs" 
                  />
                  <div className="min-w-0">
                    <p className="font-sans font-bold text-xs text-white tracking-tight truncate leading-snug">
                      {tenant?.name || 'Apex Academy'}
                    </p>
                    <p className="text-[9.5px] text-slate-400 tracking-wider uppercase font-semibold truncate">
                      ERP System
                    </p>
                  </div>
                </div>
              )}
              <button 
                onClick={onClose} 
                className="md:hidden text-slate-400 hover:text-slate-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Navigation Body (Scrollbar hidden via no-scrollbar) */}
          <div className="flex-1 min-h-0 py-3 space-y-4 overflow-y-auto no-scrollbar scrollbar-none">

            {/* Real-World Role Scoped Navigation Hierarchy */}
            <nav className="space-y-4 text-xs">
              
              {/* ============================================================
                  ROLE: FACULTY TEACHER
                  ============================================================ */}
              {role === 'teacher' && (
                <>
                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Teacher Portal
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('teacher')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'teacher'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <LayoutDashboard className={`w-4 h-4 ${currentScreen === 'teacher' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Faculty Overview</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('timetable')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'timetable'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <Calendar className={`w-4 h-4 ${currentScreen === 'timetable' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Class Schedule</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('attendance')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'attendance'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <CheckSquare className={`w-4 h-4 ${currentScreen === 'attendance' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Take Attendance</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('homework')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'homework'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <BookOpen className={`w-4 h-4 ${currentScreen === 'homework' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Homework & Notebooks</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('exams')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'exams'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <Award className={`w-4 h-4 ${currentScreen === 'exams' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Grade Examinations</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('geofence')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'geofence'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <MapPin className={`w-4 h-4 ${currentScreen === 'geofence' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Staff Attendance</span>
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
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'complaints'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <MessageSquare className={`w-4 h-4 ${currentScreen === 'complaints' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Faculty Feedback</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ============================================================
                  ROLE: STUDENT / PARENT
                  ============================================================ */}
              {(role === 'student' || role === 'parent') && (
                <>
                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" />
                      {role === 'parent' ? 'Parent Portal' : 'Student Portal'}
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('student_portal')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'student_portal'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <UserCheck className={`w-4 h-4 ${currentScreen === 'student_portal' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>{role === 'parent' ? 'Child Overview' : 'Overview'}</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('timetable')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'timetable'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <Calendar className={`w-4 h-4 ${currentScreen === 'timetable' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Class Timetable</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('attendance')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'attendance'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <CheckSquare className={`w-4 h-4 ${currentScreen === 'attendance' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Attendance & Leaves</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('voucher')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'voucher'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <Receipt className={`w-4 h-4 ${currentScreen === 'voucher' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Fees & Payments</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('homework')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'homework'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <BookOpen className={`w-4 h-4 ${currentScreen === 'homework' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Homework Diary</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('exams')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'exams'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <Award className={`w-4 h-4 ${currentScreen === 'exams' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Exams & Results</span>
                      </button>

                      <button 
                        onClick={() => handleNavClick('complaints')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'complaints'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <MessageSquare className={`w-4 h-4 ${currentScreen === 'complaints' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Help & Messages</span>
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
                  <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Platform Administration
                  </p>
                  <div className="space-y-1">
                    <button 
                      onClick={() => handleNavClick('superadmin')}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                        currentScreen === 'superadmin'
                          ? 'bg-[#152F4F] text-white font-semibold shadow-xs'
                          : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                      }`}
                    >
                      <ShieldAlert className={`w-4 h-4 ${currentScreen === 'superadmin' ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span>Academy Directory</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  ROLE: TENANT ADMIN (Principal / Director - Academy Administration)
                  ============================================================ */}
              {(role === 'tenant_admin' || managedStaff || (!['teacher', 'student', 'parent', 'super_admin'].includes(role))) && (
                <>
                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Overview
                    </p>
                    <div className="space-y-1">
                      <button 
                        onClick={() => handleNavClick('dashboard')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'dashboard'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <LayoutDashboard className={`w-4 h-4 ${currentScreen === 'dashboard' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Dashboard</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Academic Management
                    </p>
                    <div className="space-y-1">
                      {allow('enrollment') && <button 
                        onClick={() => handleNavClick('enrollment')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'enrollment'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <UserPlus className={`w-4 h-4 ${currentScreen === 'enrollment' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Students</span>
                      </button>}

                      {(allow('id_cards') || allow('enrollment')) && <button 
                        onClick={() => handleNavClick('id_cards')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'id_cards'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <CreditCard className={`w-4 h-4 ${currentScreen === 'id_cards' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Student ID Cards</span>
                      </button>}

                      {allow('classes') && <button 
                        onClick={() => handleNavClick('classes')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'classes'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <Layers className={`w-4 h-4 ${currentScreen === 'classes' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Classes & Batches</span>
                      </button>}

                      {allow('timetable') && <button 
                        onClick={() => handleNavClick('timetable')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'timetable'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <Calendar className={`w-4 h-4 ${currentScreen === 'timetable' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Timetables</span>
                      </button>}
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Daily Operations
                    </p>
                    <div className="space-y-1">
                      {allow('attendance') && <button 
                        onClick={() => handleNavClick('attendance')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'attendance'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <CheckSquare className={`w-4 h-4 ${currentScreen === 'attendance' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Attendance</span>
                      </button>}

                      {allow('absentee') && <button 
                        onClick={() => handleNavClick('absentee')}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'absentee'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <PhoneForwarded className={`w-4 h-4 ${currentScreen === 'absentee' ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span>Absence Follow-Up</span>
                        </div>
                        {absenteePending > 0 && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            currentScreen === 'absentee' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 border border-rose-200'
                          }`}>
                            {absenteePending}
                          </span>
                        )}
                      </button>}

                      {allow('homework') && <button 
                        onClick={() => handleNavClick('homework')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'homework'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <BookOpen className={`w-4 h-4 ${currentScreen === 'homework' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Homework & Notebooks</span>
                      </button>}

                      {allow('geofence') && <button 
                        onClick={() => handleNavClick('geofence')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'geofence'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <MapPin className={`w-4 h-4 ${currentScreen === 'geofence' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Staff Attendance</span>
                      </button>}

                      {allow('complaints') && <button 
                        onClick={() => handleNavClick('complaints')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'complaints'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <MessageSquare className={`w-4 h-4 ${currentScreen === 'complaints' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Feedback</span>
                      </button>}
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Examinations
                    </p>
                    <div className="space-y-1">
                      {allow('exams') && <button 
                        onClick={() => handleNavClick('exams')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'exams'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <GraduationCap className={`w-4 h-4 ${currentScreen === 'exams' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Examinations</span>
                      </button>}
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Finance
                    </p>
                    <div className="space-y-1">
                      {allow('voucher') && <button 
                        onClick={() => handleNavClick('voucher')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'voucher'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <Receipt className={`w-4 h-4 ${currentScreen === 'voucher' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Fees Receiving</span>
                      </button>}

                      {allow('challans') && <button 
                        onClick={() => handleNavClick('challans')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'challans'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <FileText className={`w-4 h-4 ${currentScreen === 'challans' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Fee Challans</span>
                      </button>}

                      {allow('fee_reversals') && <button 
                        onClick={() => handleNavClick('fee_reversals')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'fee_reversals'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <RotateCcw className={`w-4 h-4 ${currentScreen === 'fee_reversals' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Fee Reversals</span>
                      </button>}

                      {allow('expenses') && <button 
                        onClick={() => handleNavClick('expenses')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'expenses'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <TrendingUp className={`w-4 h-4 ${currentScreen === 'expenses' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Income & Expenses</span>
                      </button>}

                      {allow('payroll') && <button 
                        onClick={() => handleNavClick('payroll')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'payroll'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <Wallet className={`w-4 h-4 ${currentScreen === 'payroll' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Payroll</span>
                      </button>}
                    </div>
                  </div>

                  <div>
                    <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Administration
                    </p>
                    <div className="space-y-1">
                      {role === 'tenant_admin' && (
                      <button 
                        onClick={() => handleNavClick('staff')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'staff'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <Users className={`w-4 h-4 ${currentScreen === 'staff' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Staff</span>
                      </button>
                      )}
                      {allow('settings') && (
                      <button 
                        onClick={() => handleNavClick('settings')}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                          currentScreen === 'settings'
                            ? 'bg-[#122B4A] text-white font-semibold shadow-xs border-l-2 border-amber-500'
                            : 'text-slate-300 hover:bg-[#10243C] hover:text-white font-medium'
                        }`}
                      >
                        <Settings className={`w-4 h-4 ${currentScreen === 'settings' ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>Settings</span>
                      </button>
                      )}
                    </div>
                  </div>

                </>
              )}

            </nav>
          </div>

          {/* User Profile Card (Pinned Static Bottom) */}
          <div className="pt-2.5 border-t border-[#152F4F]/60 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`w-7 h-7 rounded-lg text-white font-mono text-xs font-bold flex items-center justify-center shadow-2xs shrink-0 ${
                role === 'teacher' ? 'bg-emerald-600' :
                role === 'student' ? 'bg-sky-600' :
                role === 'parent' ? 'bg-amber-600' :
                role === 'super_admin' ? 'bg-purple-600' :
                'bg-amber-600'
              }`}>
                {(user?.full_name?.includes('Physics') ? 'ST' : user?.full_name?.includes('Director') ? 'AR' : user?.full_name?.substring(0, 2).toUpperCase()) || 'AR'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white leading-tight truncate">
                  {user?.full_name || 'Administrator'}
                </p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1 capitalize truncate">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    role === 'teacher' ? 'bg-emerald-500' :
                    role === 'student' ? 'bg-sky-500' :
                    role === 'parent' ? 'bg-amber-500' :
                    role === 'super_admin' ? 'bg-purple-500' :
                    'bg-amber-500'
                  }`} />
                  <span className="truncate">
                    {role === 'tenant_admin' ? 'Campus Admin' :
                     role === 'teacher' ? 'Faculty Member' :
                     role === 'student' ? 'Student' :
                     role === 'parent' ? 'Guardian' :
                     'Platform Admin'}
                  </span>
                </p>
              </div>
            </div>
            <button 
              onClick={logout}
              title="Sign Out" 
              aria-label="Sign Out"
              className="text-rose-400 hover:text-rose-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>
    </>
  );
};
