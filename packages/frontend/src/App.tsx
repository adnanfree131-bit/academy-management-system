import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginModal } from './components/LoginModal';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './views/DashboardView';
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
import { TrialExpiredLockoutModal } from './components/TrialExpiredLockoutModal';
import { MobileBottomNav } from './components/MobileBottomNav';

const getTitle = (screen: string, role?: string): string => {
  if (role === 'teacher') {
    switch (screen) {
      case 'teacher': return 'Faculty Academic Desk';
      case 'timetable': return 'My Teaching Schedule & Rooms';
      case 'attendance': return 'Batch Student Attendance Roll Call';
      case 'homework': return 'Homework Diary & Notebook Inspection';
      case 'exams': return 'Exam Evaluation & Grading Desk';
      case 'geofence': return 'Staff GPS Geofence Clock-In';
      case 'complaints': return 'Academic Feedback & Inquiries';
      default: return 'Faculty Desk';
    }
  }

  if (role === 'student') {
    switch (screen) {
      case 'student_portal': return 'Student & Parent 360 Desk';
      case 'timetable': return 'My Weekly Class Timetable';
      case 'voucher': return 'Fee Invoices & Online Payments';
      case 'homework': return 'Homework Diary & Assignments';
      case 'exams': return 'Official Examination Report Cards';
      case 'complaints': return 'Submit Support Request / Concern';
      default: return 'Student Portal';
    }
  }

  if (role === 'super_admin') {
    switch (screen) {
      case 'superadmin': return 'Global SaaS Multi-Academy Control Plane';
      case 'dashboard': return 'Tenant Operational Overview';
      default: return 'Super-Admin Console';
    }
  }

  // Tenant Admin (Principal / Director)
  switch (screen) {
    case 'dashboard': return 'Executive Academy Overview';
    case 'enrollment': return 'Student Admissions & SIS Registry';
    case 'timetable': return 'Academic Timetable & 4-Way Collision Engine';
    case 'attendance': return 'Student Attendance & Leave Desk';
    case 'absentee': return 'Morning Absentee Follow-Up & WhatsApp Desk';
    case 'homework': return 'Homework Diary & Physical Notebook Checks';
    case 'exams': return 'Examination Bank & Evaluation Desk';
    case 'voucher': return 'Fee Invoices & 3-Slip Paper-Saver Vouchers';
    case 'payroll': return 'Staff Attendance-Linked Payroll Desk';
    case 'geofence': return 'Campus GPS Geofencing Attendance';
    case 'complaints': return 'Institutional Complaints & Feedback';
    case 'mobile': return 'Native Mobile Touch Experience (Capacitor / PWA)';
    default: return 'Academy ERP';
  }
};

const MainLayout: React.FC = () => {
  const { user, tenant, isLoading, refreshSession } = useAuth();
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
          <p className="text-xs font-mono text-slate-400">Loading Apex ERP Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  const isTenantLocked = tenant?.status === 'locked';

  return (
    <div className="min-h-screen flex bg-slate-50 relative">
      {/* 30-Day Trial Expired Lockout Modal */}
      {isTenantLocked && (
        <TrialExpiredLockoutModal onUnlocked={refreshSession} />
      )}

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
            ) : currentScreen === 'payroll' ? (
              <PayrollDeskView />
            ) : currentScreen === 'geofence' ? (
              <StaffClockInView />
            ) : currentScreen === 'complaints' ? (
              <ComplaintsDeskView />
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
