import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginModal } from './components/LoginModal';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './views/DashboardView';
import { AcademicStructureView } from './views/AcademicStructureView';
import { EnrollmentView } from './views/EnrollmentView';
import { TimetableDesk } from './views/TimetableDesk';
import { AttendanceDeskView } from './views/AttendanceDeskView';
import { StaffClockInView } from './views/StaffClockInView';
import { HomeworkDesk } from './views/HomeworkDesk';
import { ComplaintsDeskView } from './views/ComplaintsDeskView';
import { FeeDeskView } from './views/FeeDeskView';
import { PayrollDeskView } from './views/PayrollDeskView';
import { ExamDeskView } from './views/ExamDeskView';
import { AbsenteeRetentionDeskView } from './views/AbsenteeRetentionDeskView';
import { GenericModuleView } from './views/GenericModuleView';
import { TeacherPortalView } from './views/TeacherPortalView';
import { StudentParentPortalView } from './views/StudentParentPortalView';
import { SuperAdminControlPlaneView } from './views/SuperAdminControlPlaneView';
import { IncomeExpenseDeskView } from './views/IncomeExpenseDeskView';
import { AcademySettingsView } from './views/AcademySettingsView';
import { TrialExpiredLockoutModal } from './components/TrialExpiredLockoutModal';
import { AnnouncementPopupModal } from './components/AnnouncementPopupModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ShieldAlert } from 'lucide-react';

const getTitle = (screen: string, role?: string): string => {
  if (role === 'teacher') {
    switch (screen) {
      case 'teacher': return 'Faculty Overview';
      case 'timetable': return 'Class Schedule';
      case 'attendance': return 'Take Attendance';
      case 'homework': return 'Homework & Notebooks';
      case 'exams': return 'Grade Examinations';
      case 'geofence': return 'Campus Check-In';
      case 'complaints': return 'Faculty Feedback';
      default: return 'Faculty Portal';
    }
  }

  if (role === 'student') {
    switch (screen) {
      case 'student_portal': return 'Student Overview';
      case 'timetable': return 'Class Timetable';
      case 'voucher': return 'Fee Invoices & Payments';
      case 'homework': return 'Homework Diary';
      case 'exams': return 'Report Cards';
      case 'complaints': return 'Complaints & Requests';
      default: return 'Student Portal';
    }
  }

  if (role === 'super_admin') {
    switch (screen) {
      case 'superadmin': return 'Platform Administration';
      case 'dashboard': return 'Campus Overview';
      default: return 'System Administration';
    }
  }

  // Tenant Admin (Principal / Director)
  switch (screen) {
    case 'dashboard': return 'Dashboard';
    case 'classes': return 'Classes & Batches';
    case 'id_cards': return 'Student ID Card Studio';
    case 'enrollment': return 'Student Admissions & Directory';
    case 'timetable': return 'Timetable & Scheduling';
    case 'attendance': return 'Student Attendance';
    case 'absentee': return 'Absence Follow-Up';
    case 'homework': return 'Homework & Notebooks';
    case 'exams': return 'Exams & Results';
    case 'voucher': return 'Fee Invoices & Vouchers';
    case 'expenses': return 'Income & Expense Management';
    case 'payroll': return 'Staff Payroll';
    case 'geofence': return 'Staff Attendance';
    case 'complaints': return 'Complaints & Feedback';
    case 'settings': return 'Academy Settings';
    case 'mobile': return 'Mobile App';
    default: return 'Academy Portal';
  }
};

const MainLayout: React.FC = () => {
  const { user, tenant, isLoading, refreshSession, logout } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Set initial screen based on user role when logging in
  useEffect(() => {
    if (user) {
      if (user.role === 'teacher') {
        setCurrentScreen('teacher');
      } else if (user.role === 'student') {
        setCurrentScreen('student_portal');
      } else if (user.role === 'super_admin') {
        setCurrentScreen('superadmin');
      } else {
        setCurrentScreen('dashboard');
      }
    }
  }, [user?.role, user?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-mono text-slate-400">Loading Academy Session...</p>
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

      <Sidebar
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header
          currentScreenTitle={getTitle(currentScreen, user.role)}
          onOpenSidebar={() => setSidebarOpen(true)}
          onNewAdmission={() => setCurrentScreen('enrollment')}
          onSwitchScreen={setCurrentScreen}
        />

        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6 w-full space-y-5 overflow-y-auto">
          {/* ROLE: STUDENT / PARENT VIEW ROUTING */}
          {user.role === 'student' ? (
            currentScreen === 'complaints' ? (
              <ComplaintsDeskView />
            ) : (
              <StudentParentPortalView
                forcedTab={
                  currentScreen === 'voucher' ? 'fees' :
                  currentScreen === 'homework' ? 'homework' :
                  currentScreen === 'exams' ? 'reports' :
                  'schedule'
                }
                onNavigate={setCurrentScreen}
              />
            )
          ) : /* ROLE: FACULTY TEACHER VIEW ROUTING */
          user.role === 'teacher' ? (
            currentScreen === 'teacher' ? (
              <TeacherPortalView onNavigate={setCurrentScreen} />
            ) : currentScreen === 'timetable' ? (
              <TimetableDesk />
            ) : currentScreen === 'attendance' ? (
              <AttendanceDeskView />
            ) : currentScreen === 'homework' ? (
              <HomeworkDesk />
            ) : currentScreen === 'exams' ? (
              <ExamDeskView />
            ) : currentScreen === 'geofence' ? (
              <StaffClockInView />
            ) : currentScreen === 'complaints' ? (
              <ComplaintsDeskView />
            ) : (
              <TeacherPortalView onNavigate={setCurrentScreen} />
            )
          ) : /* ROLE: SUPER ADMIN VIEW ROUTING */
          user.role === 'super_admin' ? (
            currentScreen === 'superadmin' ? (
              <SuperAdminControlPlaneView />
            ) : currentScreen === 'dashboard' ? (
              <DashboardView onNavigate={setCurrentScreen} />
            ) : (
              <SuperAdminControlPlaneView />
            )
          ) : /* ROLE: TENANT ADMIN (Principal / Director) */
          (
            currentScreen === 'dashboard' ? (
              <DashboardView onNavigate={setCurrentScreen} />
            ) : currentScreen === 'classes' ? (
              <AcademicStructureView />
            ) : currentScreen === 'id_cards' ? (
              <EnrollmentView defaultTab="id_cards" />
            ) : currentScreen === 'enrollment' ? (
              <EnrollmentView />
            ) : currentScreen === 'timetable' ? (
              <TimetableDesk />
            ) : currentScreen === 'attendance' ? (
              <AttendanceDeskView />
            ) : currentScreen === 'absentee' ? (
              <AbsenteeRetentionDeskView />
            ) : currentScreen === 'homework' ? (
              <HomeworkDesk />
            ) : currentScreen === 'exams' ? (
              <ExamDeskView />
            ) : currentScreen === 'voucher' ? (
              <FeeDeskView />
            ) : currentScreen === 'expenses' ? (
              <IncomeExpenseDeskView />
            ) : currentScreen === 'payroll' ? (
              <PayrollDeskView />
            ) : currentScreen === 'geofence' ? (
              <StaffClockInView />
            ) : currentScreen === 'complaints' ? (
              <ComplaintsDeskView />
            ) : currentScreen === 'settings' ? (
              <AcademySettingsView />
            ) : (
              <GenericModuleView moduleId={currentScreen} />
            )
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (< 768px touch screen devices) */}
        <MobileBottomNav
          currentScreen={currentScreen}
          onSelectScreen={setCurrentScreen}
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
