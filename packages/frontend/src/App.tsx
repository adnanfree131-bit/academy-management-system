import React, { useState } from 'react';
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
import { GenericModuleView } from './views/GenericModuleView';

const titleMap: Record<string, string> = {
  dashboard: 'Executive Dashboard',
  timetable: 'Academic Timetable & Schedule Engine',
  attendance: 'Student Attendance & Leave Desk',
  geofence: 'Staff Attendance & GPS Geofencing',
  homework: 'Homework Diary & Notebook Inspection',
  absentee: 'Absence Follow-Up & Retention Desk',
  enrollment: 'Student Admissions & SIS',
  complaints: 'Complaints & Feedback Portal',
  voucher: 'Fee Invoices & Vouchers',
  payroll: 'Staff Payroll & Salaries',
  mobile: 'Native Mobile Experience (PWA Parity)',
};

const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

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

  return (
    <div className="min-h-screen flex bg-slate-50">
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
        />

        <main className="flex-1 p-4 sm:p-6 w-full space-y-5 overflow-y-auto">
          {currentScreen === 'dashboard' ? (
            <DashboardView onNavigate={setCurrentScreen} />
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
          ) : (
            <GenericModuleView moduleId={currentScreen} />
          )}
        </main>
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
