export interface PortalDesk {
  id: string;
  label: string;
  hint: string;
}

export interface PortalGroup {
  group: string;
  desks: PortalDesk[];
}

/** Whole academy portal a staff member can be given. Admin-only desks are not listed. */
export const PORTAL_GROUPS: PortalGroup[] = [
  {
    group: 'Academic',
    desks: [
      { id: 'enrollment', label: 'Student Admissions', hint: 'Directory, inquiries, new admission' },
      { id: 'id_cards', label: 'Student ID Cards', hint: 'Print and issue ID cards' },
      { id: 'classes', label: 'Classes & Batches', hint: 'Programmes, batches, subjects' },
      { id: 'timetable', label: 'Timetable', hint: 'Periods, rooms, substitutes' },
    ],
  },
  {
    group: 'Daily operations',
    desks: [
      { id: 'attendance', label: 'Student Attendance', hint: 'Mark the daily register' },
      { id: 'absentee', label: 'Absence Follow-Up', hint: 'Call and WhatsApp absentees' },
      { id: 'homework', label: 'Homework & Notebooks', hint: 'Diary and notebook checks' },
      { id: 'geofence', label: 'Staff Clock-In', hint: 'Campus attendance for staff' },
      { id: 'complaints', label: 'Complaints', hint: 'Parent and student tickets' },
    ],
  },
  {
    group: 'Exams',
    desks: [
      { id: 'exams', label: 'Exams & Results', hint: 'Papers, marks, report cards' },
    ],
  },
  {
    group: 'Finance',
    desks: [
      { id: 'voucher', label: 'Fee Invoices', hint: 'Challans, collection, receipts' },
      { id: 'expenses', label: 'Income & Expenses', hint: 'Cashbook and P&L' },
      { id: 'payroll', label: 'Staff Payroll', hint: 'Salaries and payslips' },
    ],
  },
];

export const ALL_PORTAL_DESKS = PORTAL_GROUPS.flatMap(g => g.desks);

export const ADMIN_ONLY_SCREENS = ['settings', 'staff', 'new_admission'];

export function deskCount() {
  return ALL_PORTAL_DESKS.length;
}

export function isManagedStaff(role?: string, permissions?: string[] | null) {
  if (!role || role === 'tenant_admin' || role === 'super_admin' || role === 'student' || role === 'parent') {
    return false;
  }
  return Array.isArray(permissions);
}

export function canOpenScreen(role: string | undefined, permissions: string[] | null | undefined, screen: string) {
  if (!role) return false;
  if (role === 'tenant_admin' || role === 'super_admin') return true;
  if (role === 'student' || role === 'parent') return true;
  if (!Array.isArray(permissions)) return true;
  if (screen === 'dashboard') return true;
  if (ADMIN_ONLY_SCREENS.includes(screen)) return false;
  if (screen === 'new_admission') return permissions.includes('enrollment');
  return permissions.includes(screen);
}
