import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginModal } from './components/LoginModal';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { canOpenScreen, isManagedStaff } from './lib/portalAccess';
import { TrialExpiredLockoutModal } from './components/TrialExpiredLockoutModal';
import { AnnouncementPopupModal } from './components/AnnouncementPopupModal';
import { CommandPalette } from './components/CommandPalette';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShieldAlert } from 'lucide-react';

// Lazy-loaded Views for high-speed bundle performance and code-splitting
const DashboardView = lazy(() => import('./views/DashboardView').then(m => ({ default: m.DashboardView })));
const AcademicStructureView = lazy(() => import('./views/AcademicStructureView').then(m => ({ default: m.AcademicStructureView })));
const EnrollmentView = lazy(() => import('./views/EnrollmentView').then(m => ({ default: m.EnrollmentView })));
const TimetableDesk = lazy(() => import('./views/TimetableDesk').then(m => ({ default: m.TimetableDesk })));
const AttendanceDeskView = lazy(() => import('./views/AttendanceDeskView').then(m => ({ default: m.AttendanceDeskView })));
const StaffClockInView = lazy(() => import('./views/StaffClockInView').then(m => ({ default: m.StaffClockInView })));
const HomeworkDesk = lazy(() => import('./views/HomeworkDesk').then(m => ({ default: m.HomeworkDesk })));
const ComplaintsDeskView = lazy(() => import('./views/ComplaintsDeskView').then(m => ({ default: m.ComplaintsDeskView })));
const FeeDeskView = lazy(() => import('./views/FeeDeskView').then(m => ({ default: m.FeeDeskView })));
const FeeChallansView = lazy(() => import('./views/FeeChallansView').then(m => ({ default: m.FeeChallansView })));
const FeeReversalsView = lazy(() => import('./views/FeeReversalsView').then(m => ({ default: m.FeeReversalsView })));
const PayrollDeskView = lazy(() => import('./views/PayrollDeskView').then(m => ({ default: m.PayrollDeskView })));
const ExamDeskView = lazy(() => import('./views/ExamDeskView').then(m => ({ default: m.ExamDeskView })));
const AbsenteeRetentionDeskView = lazy(() => import('./views/AbsenteeRetentionDeskView').then(m => ({ default: m.AbsenteeRetentionDeskView })));
const GenericModuleView = lazy(() => import('./views/GenericModuleView').then(m => ({ default: m.GenericModuleView })));
const TeacherPortalView = lazy(() => import('./views/TeacherPortalView').then(m => ({ default: m.TeacherPortalView })));
const StudentParentPortalView = lazy(() => import('./views/StudentParentPortalView').then(m => ({ default: m.StudentParentPortalView })));
const SuperAdminControlPlaneView = lazy(() => import('./views/SuperAdminControlPlaneView').then(m => ({ default: m.SuperAdminControlPlaneView })));
const IncomeExpenseDeskView = lazy(() => import('./views/IncomeExpenseDeskView').then(m => ({ default: m.IncomeExpenseDeskView })));
const AcademySettingsView = lazy(() => import('./views/AcademySettingsView').then(m => ({ default: m.AcademySettingsView })));
const StaffDeskView = lazy(() => import('./views/StaffDeskView').then(m => ({ default: m.StaffDeskView })));

const ViewLoadingSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-14 bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between">
      <div className="h-4 w-40 bg-slate-200 rounded-lg"></div>
      <div className="h-7 w-28 bg-slate-100 rounded-lg"></div>
    </div>
    <div className="h-96 bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4">
      <div className="h-4 w-2/3 bg-slate-100 rounded"></div>
      <div className="h-4 w-1/3 bg-slate-100 rounded"></div>
      <div className="h-64 bg-slate-50 rounded-xl border border-slate-100"></div>
    </div>
  </div>
);

interface ScreenMeta {
  section: string;
  title: string;
}

const getScreenMeta = (screen: string, role?: string): ScreenMeta => {
  if (role === 'teacher') {
    switch (screen) {
      case 'teacher': return { section: 'Faculty', title: 'Teacher Portal' };
      case 'timetable': return { section: 'Academic', title: 'Class Schedule' };
      case 'attendance': return { section: 'Daily Operations', title: 'Attendance' };
      case 'homework': return { section: 'Daily Operations', title: 'Homework & Notebooks' };
      case 'exams': return { section: 'Examinations', title: 'Grade Examinations' };
      case 'geofence': return { section: 'Daily Operations', title: 'Check-In' };
      case 'complaints': return { section: 'Messages', title: 'Feedback' };
      default: return { section: 'Faculty', title: 'Teacher Portal' };
    }
  }

  if (role === 'student' || role === 'parent') {
    switch (screen) {
      case 'student_portal': return { section: 'Student Portal', title: 'Student & Parent Overview' };
      case 'timetable': return { section: 'Academic', title: 'Class Timetable' };
      case 'attendance': return { section: 'Daily Operations', title: 'Attendance & Leaves' };
      case 'voucher': return { section: 'Finance', title: 'Fee Invoices & Payments' };
      case 'homework': return { section: 'Academic', title: 'Homework Diary' };
      case 'exams': return { section: 'Examinations', title: 'Report Cards & Results' };
      case 'complaints': return { section: 'Support', title: 'Requests & Complaints' };
      default: return { section: 'Student Portal', title: 'Student & Parent Overview' };
    }
  }

  if (role === 'super_admin') {
    switch (screen) {
      case 'superadmin': return { section: 'Platform', title: 'Platform Administration' };
      case 'dashboard': return { section: 'Platform', title: 'Campus Overview' };
      default: return { section: 'Platform', title: 'Platform Administration' };
    }
  }

  // Tenant Admin (Principal / Director) & Staff
  switch (screen) {
    case 'dashboard': return { section: 'Overview', title: 'Dashboard' };
    case 'enrollment': return { section: 'Academic Management', title: 'Students' };
    case 'classes': return { section: 'Academic Management', title: 'Classes & Batches' };
    case 'timetable': return { section: 'Academic Management', title: 'Timetables' };
    case 'new_admission': return { section: 'Academic Management', title: 'Admission Form' };
    case 'attendance': return { section: 'Daily Operations', title: 'Attendance' };
    case 'absentee': return { section: 'Daily Operations', title: 'Absence Follow-Up' };
    case 'homework': return { section: 'Daily Operations', title: 'Homework & Notebooks' };
    case 'geofence': return { section: 'Daily Operations', title: 'Staff Attendance' };
    case 'complaints': return { section: 'Daily Operations', title: 'Feedback' };
    case 'exams': return { section: 'Examinations', title: 'Examinations' };
    case 'voucher': return { section: 'Finance', title: 'Fees Receiving' };
    case 'challans': return { section: 'Finance', title: 'Fee Challans' };
    case 'fee_reversals': return { section: 'Finance', title: 'Fee Reversals' };
    case 'expenses': return { section: 'Finance', title: 'Income & Expenses' };
    case 'payroll': return { section: 'Finance', title: 'Payroll' };
    case 'staff': return { section: 'Administration', title: 'Staff Directory' };
    case 'settings': return { section: 'Administration', title: 'Settings' };
    case 'mobile': return { section: 'Mobile', title: 'Mobile App' };
    default: return { section: 'Academy', title: 'Portal' };
  }
};

const parseScreenFromHash = (): { screen: string; studentId?: string } | null => {
  try {
    const raw = window.location.hash.replace(/^#\/?/, '').trim();
    if (!raw) return null;
    const [screenPart, queryPart] = raw.split('?');
    const screen = screenPart.split('/')[0].trim();
    if (!screen) return null;
    let studentId: string | undefined;
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      studentId = params.get('student_id') || undefined;
    }
    return { screen, studentId };
  } catch {
    return null;
  }
};

const getDefaultScreenForRole = (role?: string, permissions?: string[] | null): string => {
  if (role === 'teacher' && !isManagedStaff(role, permissions)) {
    return 'teacher';
  } else if (role === 'student' || role === 'parent') {
    return 'student_portal';
  } else if (role === 'super_admin') {
    return 'superadmin';
  }
  return 'dashboard';
};

const MainLayout: React.FC = () => {
  const { user, tenant, isLoading, refreshSession, logout } = useAuth();
  
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(() => {
    const parsed = parseScreenFromHash();
    return parsed?.studentId || null;
  });

  // Initialize screen state with URL hash -> localStorage -> default
  const [currentScreen, setCurrentScreen] = useState<string>(() => {
    const fromHash = parseScreenFromHash();
    if (fromHash?.screen) return fromHash.screen;
    try {
      const stored = localStorage.getItem('apex_active_screen');
      if (stored) return stored;
    } catch {}
    return 'dashboard';
  });

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [screenNavKey, setScreenNavKey] = useState<number>(0);

  // Centralized screen switch handler that synchronizes state, URL hash, and persistent storage
  const handleSwitchScreen = useCallback((screenId: string, studentId?: string | null) => {
    let targetScreen = screenId;
    let targetStudentId: string | null = studentId ?? null;

    if (screenId.includes('?')) {
      const [s, q] = screenId.split('?');
      targetScreen = s;
      const params = new URLSearchParams(q);
      if (params.has('student_id')) {
        targetStudentId = params.get('student_id');
      }
    }

    if (targetStudentId !== null) {
      setPreviewStudentId(targetStudentId);
    } else if (targetScreen !== 'student_portal') {
      setPreviewStudentId(null);
    }

    if (user && !canOpenScreen(user.role, user.permissions, targetScreen)) {
      return;
    }
    setCurrentScreen(targetScreen);
    setScreenNavKey(k => k + 1);
    try {
      localStorage.setItem('apex_active_screen', targetScreen);
      const newHash = targetStudentId && targetScreen === 'student_portal'
        ? `#${targetScreen}?student_id=${encodeURIComponent(targetStudentId)}`
        : '#' + targetScreen;
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', newHash);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseScreenFromHash();
      if (parsed?.screen) {
        if (parsed.studentId !== undefined) {
          setPreviewStudentId(parsed.studentId || null);
        }
        if (parsed.screen !== currentScreen) {
          if (!user || canOpenScreen(user.role, user.permissions, parsed.screen)) {
            setCurrentScreen(parsed.screen);
            setScreenNavKey(k => k + 1);
            try {
              localStorage.setItem('apex_active_screen', parsed.screen);
            } catch {}
          }
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentScreen, user]);

  // Preserve user's restored screen upon refresh, or set default role screen if unauthorized
  useEffect(() => {
    if (!user) return;

    // If currentScreen is already valid and permitted for this user, keep it!
    if (currentScreen && canOpenScreen(user.role, user.permissions, currentScreen)) {
      try {
        localStorage.setItem('apex_active_screen', currentScreen);
        const parsed = parseScreenFromHash();
        if (parsed?.screen !== currentScreen) {
          const newHash = previewStudentId && currentScreen === 'student_portal'
            ? `#${currentScreen}?student_id=${encodeURIComponent(previewStudentId)}`
            : '#' + currentScreen;
          window.history.replaceState(null, '', newHash);
        }
      } catch {}
      return;
    }

    // Otherwise fall back to role default
    const defaultScreen = getDefaultScreenForRole(user.role, user.permissions);
    setCurrentScreen(defaultScreen);
    try {
      localStorage.setItem('apex_active_screen', defaultScreen);
      window.history.replaceState(null, '', '#' + defaultScreen);
    } catch {}
  }, [user?.id, user?.role]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-semibold text-slate-600 tracking-wide">Loading Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  const isTenantLocked = tenant?.status === 'locked';
  const isTenantSuspended = tenant?.status === 'suspended';

  // If academy is suspended and user is staff or student, show clean institutional advisory
  if (isTenantSuspended && user.role !== 'super_admin' && user.role !== 'tenant_admin') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold">Academy Access Suspended</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Access to this academy has been temporarily placed on administrative hold by the platform administration.
          </p>
          <div className="p-3 bg-slate-900/60 rounded-xl text-left border border-slate-700/60 text-xs">
            <div className="text-[10px] uppercase font-bold text-slate-500">Notice Details</div>
            <div className="text-slate-300 font-mono mt-0.5">{tenant?.suspended_reason || 'Administrative hold'}</div>
          </div>
          <p className="text-[11px] text-slate-500">
            Please contact your campus administration or director for assistance.
          </p>
          <button
            onClick={logout}
            className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 relative">
      {/* 30-Day Trial Expired Lockout & Billing Settlement Desk */}
      {(isTenantLocked || (isTenantSuspended && user.role === 'tenant_admin')) && (
        <TrialExpiredLockoutModal onUnlocked={refreshSession} />
      )}

      {/* Platform Broadcast Announcement Popup Modal */}
      <AnnouncementPopupModal />

      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleSwitchScreen}
      />

      <Sidebar
        currentScreen={currentScreen}
        onSelectScreen={handleSwitchScreen}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header
          section={getScreenMeta(currentScreen, user?.role).section}
          currentScreenTitle={getScreenMeta(currentScreen, user?.role).title}
          onOpenSidebar={() => setSidebarOpen(true)}
          onSwitchScreen={handleSwitchScreen}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <main className="flex-1 p-3 sm:p-6 pb-24 md:pb-6 w-full space-y-4 sm:space-y-5 overflow-y-auto min-w-0">
          <Suspense fallback={<ViewLoadingSkeleton />}>
            <ErrorBoundary key={`${currentScreen}-${screenNavKey}`} onReset={() => handleSwitchScreen('dashboard')}>
            {/* ROLE: STUDENT / PARENT VIEW ROUTING */}
            {user.role === 'student' || user.role === 'parent' ? (
              currentScreen === 'complaints' ? (
                <ComplaintsDeskView />
              ) : (
                <StudentParentPortalView
                  activeScreen={currentScreen}
                  onNavigate={handleSwitchScreen}
                />
              )
            ) : /* ROLE: FACULTY TEACHER VIEW ROUTING */
            user.role === 'teacher' && !isManagedStaff(user.role, user.permissions) ? (
              currentScreen === 'teacher' ? (
                <TeacherPortalView onNavigate={handleSwitchScreen} />
              ) : currentScreen === 'timetable' ? (
                <TimetableDesk />
              ) : currentScreen === 'attendance' ? (
                <AttendanceDeskView onNavigate={handleSwitchScreen} />
              ) : currentScreen === 'homework' ? (
                <HomeworkDesk />
              ) : currentScreen === 'exams' ? (
                <ExamDeskView />
              ) : currentScreen === 'geofence' ? (
                <StaffClockInView />
              ) : currentScreen === 'complaints' ? (
                <ComplaintsDeskView />
              ) : (
                <TeacherPortalView onNavigate={handleSwitchScreen} />
              )
            ) : /* ROLE: SUPER ADMIN VIEW ROUTING */
            user.role === 'super_admin' ? (
              currentScreen === 'superadmin' ? (
                <SuperAdminControlPlaneView />
              ) : currentScreen === 'dashboard' ? (
                <DashboardView onNavigate={handleSwitchScreen} />
              ) : currentScreen === 'student_portal' ? (
                <StudentParentPortalView 
                  studentId={previewStudentId}
                  isAdminPreview={Boolean(previewStudentId)}
                  activeScreen={currentScreen}
                  onNavigate={handleSwitchScreen} 
                />
              ) : (
                <SuperAdminControlPlaneView />
              )
            ) : /* ROLE: TENANT ADMIN (Principal / Director) */
            (
              currentScreen === 'dashboard' ? (
                <DashboardView onNavigate={handleSwitchScreen} />
              ) : currentScreen === 'classes' ? (
                <AcademicStructureView />
              ) : currentScreen === 'id_cards' ? (
                <EnrollmentView defaultTab="id_cards" onNavigate={handleSwitchScreen} />
              ) : currentScreen === 'enrollment' ? (
                <EnrollmentView defaultTab="directory" onNavigate={handleSwitchScreen} />
              ) : currentScreen === 'new_admission' ? (
                <EnrollmentView defaultTab="new_admission" onNavigate={handleSwitchScreen} />
              ) : currentScreen === 'timetable' ? (
                <TimetableDesk />
              ) : currentScreen === 'attendance' ? (
                <AttendanceDeskView onNavigate={handleSwitchScreen} />
              ) : currentScreen === 'absentee' ? (
                <AbsenteeRetentionDeskView />
              ) : currentScreen === 'homework' ? (
                <HomeworkDesk />
              ) : currentScreen === 'exams' ? (
                <ExamDeskView />
              ) : currentScreen === 'voucher' ? (
                <FeeDeskView />
              ) : currentScreen === 'challans' ? (
                <FeeChallansView />
              ) : currentScreen === 'fee_reversals' ? (
                <FeeReversalsView />
              ) : currentScreen === 'expenses' ? (
                <IncomeExpenseDeskView />
              ) : currentScreen === 'payroll' ? (
                <PayrollDeskView />
              ) : currentScreen === 'geofence' ? (
                <StaffClockInView />
              ) : currentScreen === 'complaints' ? (
                <ComplaintsDeskView />
              ) : currentScreen === 'staff' ? (
                <StaffDeskView onNavigate={handleSwitchScreen} />
              ) : currentScreen === 'settings' ? (
                <AcademySettingsView />
              ) : currentScreen === 'student_portal' ? (
                <StudentParentPortalView 
                  studentId={previewStudentId}
                  isAdminPreview={Boolean(previewStudentId)}
                  activeScreen={currentScreen}
                  onNavigate={handleSwitchScreen} 
                />
              ) : currentScreen === 'teacher' ? (
                <TeacherPortalView onNavigate={handleSwitchScreen} />
              ) : (
                <GenericModuleView moduleId={currentScreen} />
              )
            )}
            </ErrorBoundary>
          </Suspense>
        </main>

        {/* Mobile Bottom Navigation Bar (< 768px touch screen devices) */}
        <MobileBottomNav
          currentScreen={currentScreen}
          onSelectScreen={handleSwitchScreen}
          onOpenMenu={() => setSidebarOpen(true)}
          userRole={user.role}
        />
      </div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

export default App;
