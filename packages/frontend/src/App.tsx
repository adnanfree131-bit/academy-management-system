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

const titleMap: Record<string, string> = {
  dashboard: 'Executive Dashboard',
  timetable: 'Academic Timetable & Schedule Engine',
  attendance: 'Student Attendance & Leave Desk',
  geofence: 'Staff Attendance & GPS Geofencing',
  homework: 'Homework Diary & Notebook Inspection',
  absentee: 'Absence Follow-Up & Retention Desk',
  enrollment: 'Student Admissions & SIS',
  complaints: 'Complaints & Feedback Portal',
  exams: 'Examination Bank & Evaluation Desk',
  voucher: 'Fee Invoices & Vouchers',
  payroll: 'Staff Payroll & Salaries',
  mobile: 'Native Mobile Experience (PWA Parity)',
  teacher: 'Faculty Academic Desk',
  student_portal: 'Student & Parent Academic Portal',
  superadmin: 'Super-Admin SaaS Control Plane',
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
          currentScreenTitle={titleMap[currentScreen] || 'Dashboard'}
          onOpenSidebar={() => setSidebarOpen(true)}
          onNewAdmission={() => setCurrentScreen('enrollment')}
          onSwitchScreen={setCurrentScreen}
        />

        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6 w-full space-y-5 overflow-y-auto">
          {currentScreen === 'dashboard' ? (
            <DashboardView onNavigate={setCurrentScreen} />
          ) : currentScreen === 'teacher' ? (
            <TeacherPortalView onNavigate={setCurrentScreen} />
          ) : currentScreen === 'student_portal' ? (
            <StudentParentPortalView onNavigate={setCurrentScreen} />
          ) : currentScreen === 'superadmin' ? (
            <SuperAdminControlPlaneView />
          ) : currentScreen === 'timetable' ? (
            <TimetableDesk />
          ) : currentScreen === 'attendance' ? (
            <AttendanceDeskView />
          ) : currentScreen === 'geofence' ? (
            <StaffClockInView />
          ) : currentScreen === 'homework' ? (
            <HomeworkDesk />
          ) : currentScreen === 'enrollment' ? (
            <EnrollmentView />
          ) : currentScreen === 'complaints' ? (
            <ComplaintsDeskView />
          ) : currentScreen === 'voucher' ? (
            <FeeDeskView />
          ) : currentScreen === 'payroll' ? (
            <PayrollDeskView />
          ) : currentScreen === 'exams' ? (
            <ExamDeskView />
          ) : currentScreen === 'absentee' ? (
            <AbsenteeRetentionDeskView />
          ) : (
            <GenericModuleView moduleId={currentScreen} />
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
