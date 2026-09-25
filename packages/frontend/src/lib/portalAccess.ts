export type AccessLevel = 'view' | 'edit';

export type FeatureId =
  | 'enrollment'
  | 'id_cards'
  | 'classes'
  | 'timetable'
  | 'attendance'
  | 'absentee'
  | 'homework'
  | 'geofence'
  | 'staff_attendance'
  | 'complaints'
  | 'exams_bank'
  | 'exams_marks'
  | 'exams_reports'
  | 'voucher'
  | 'challans'
  | 'fee_reversals'
  | 'expenses'
  | 'payroll'
  | 'all_classes';

export type UserAccessMap = Partial<Record<FeatureId, AccessLevel>>;

export const ALL_FEATURE_IDS: FeatureId[] = [
  'enrollment',
  'id_cards',
  'classes',
  'timetable',
  'attendance',
  'absentee',
  'homework',
  'geofence',
  'staff_attendance',
  'complaints',
  'exams_bank',
  'exams_marks',
  'exams_reports',
  'voucher',
  'challans',
  'fee_reversals',
  'expenses',
  'payroll',
  'all_classes',
];

export interface PortalFeature {
  id: FeatureId;
  label: string;
  hint: string;
}

export interface PortalGroup {
  group: string;
  features: PortalFeature[];
  desks: PortalFeature[];
}

export const PORTAL_GROUPS: PortalGroup[] = [
  {
    group: 'Academic',
    features: [
      { id: 'enrollment', label: 'Student Admissions & Directory', hint: 'Directory, inquiries, new admission' },
      { id: 'id_cards', label: 'Student ID Cards', hint: 'Print and issue student ID cards' },
      { id: 'classes', label: 'Classes & Batches', hint: 'Programs, batches, subjects' },
      { id: 'timetable', label: 'Timetable', hint: 'Periods, rooms, schedule' },
    ],
    get desks() { return this.features; }
  },
  {
    group: 'Daily Operations',
    features: [
      { id: 'attendance', label: 'Student Attendance Register', hint: 'Mark daily attendance' },
      { id: 'absentee', label: 'Absence Follow-Up & WhatsApp', hint: 'Follow-up and WhatsApp notices' },
      { id: 'homework', label: 'Homework & Notebooks', hint: 'Daily diary and notebook checks' },
      { id: 'geofence', label: 'Staff Clock-In (Self)', hint: 'Own clock-in / clock-out & campus geofence' },
      { id: 'staff_attendance', label: 'Staff Attendance (Roster & Adjust)', hint: "Other people's roster, monthly summary, audit & adjust" },
      { id: 'complaints', label: 'Complaints & Feedback', hint: 'Parent and student tickets' },
    ],
    get desks() { return this.features; }
  },
  {
    group: 'Exams & Grading',
    features: [
      { id: 'exams_bank', label: 'Question Bank & Papers', hint: 'Question bank, chapters, papers with answers' },
      { id: 'exams_marks', label: 'Enter & Edit Marks', hint: 'Subject-wise marks entry and grading' },
      { id: 'exams_reports', label: 'Report Cards & Evaluations', hint: 'Report cards, evaluations, and progress cards' },
    ],
    get desks() { return this.features; }
  },
  {
    group: 'Finance',
    features: [
      { id: 'voucher', label: 'Fee Collection (Vouchers)', hint: 'Receive payments, cashier drawer, defaulters' },
      { id: 'challans', label: 'Fee Challans', hint: 'Generate and print monthly challans' },
      { id: 'fee_reversals', label: 'Fee Reversals & Voids', hint: 'Reverse receipts, cancel or delete challans' },
      { id: 'expenses', label: 'Income & Expenses', hint: 'Dynamic account heads, cashbook, P&L' },
      { id: 'payroll', label: 'Staff Payroll', hint: 'Staff salaries, deductions, and payslips' },
    ],
    get desks() { return this.features; }
  },
];

export const ALL_PORTAL_DESKS = PORTAL_GROUPS.flatMap(g => g.features);

export const ADMIN_ONLY_SCREENS = ['settings', 'staff'];

export function deskCount() {
  return ALL_PORTAL_DESKS.length;
}

export const ROLE_DEFAULT_TEMPLATES: Record<string, UserAccessMap> = {
  teacher: {
    classes: 'view',
    attendance: 'edit',
    homework: 'edit',
    exams_marks: 'edit',
    geofence: 'edit',
    timetable: 'view',
    exams_reports: 'view',
    complaints: 'view',
    enrollment: 'view',
  },
  finance_manager: {
    voucher: 'edit',
    challans: 'edit',
    fee_reversals: 'edit',
    expenses: 'edit',
    payroll: 'edit',
    enrollment: 'view',
    staff_attendance: 'view',
  },
  academic_head: {
    enrollment: 'edit',
    id_cards: 'edit',
    classes: 'edit',
    timetable: 'edit',
    attendance: 'edit',
    absentee: 'edit',
    homework: 'edit',
    exams_bank: 'edit',
    exams_marks: 'edit',
    exams_reports: 'edit',
    complaints: 'edit',
    geofence: 'edit',
    all_classes: 'edit',
    voucher: 'view',
    staff_attendance: 'view',
  },
};

export function derivePermissions(access: UserAccessMap): string[] {
  const result: string[] = [];
  for (const [key, level] of Object.entries(access)) {
    if (level === 'view' || level === 'edit') {
      result.push(key);
    }
  }
  if (access.exams_bank || access.exams_marks || access.exams_reports) {
    if (!result.includes('exams')) result.push('exams');
  }
  return result;
}

export function resolveUserAccessMap(
  role?: string,
  permissions?: string[] | null,
  access?: UserAccessMap | null
): UserAccessMap {
  if (!role) return {};
  if (role === 'tenant_admin' || role === 'super_admin') {
    const full: UserAccessMap = {};
    for (const f of ALL_FEATURE_IDS) full[f] = 'edit';
    return full;
  }

  if (access && typeof access === 'object' && Object.keys(access).length > 0) {
    return { ...access };
  }

  if (Array.isArray(permissions) && permissions.length > 0) {
    const mapped: UserAccessMap = {};
    for (const p of permissions) {
      if (p === 'exams') {
        mapped.exams_bank = 'edit';
        mapped.exams_marks = 'edit';
        mapped.exams_reports = 'edit';
      } else if (ALL_FEATURE_IDS.includes(p as FeatureId)) {
        mapped[p as FeatureId] = 'edit';
      }
    }
    return mapped;
  }

  // Fail closed: apply role default template
  if (ROLE_DEFAULT_TEMPLATES[role]) {
    return { ...ROLE_DEFAULT_TEMPLATES[role] };
  }

  return {};
}

export function isManagedStaff(role?: string, _permissions?: string[] | null, _access?: UserAccessMap | null) {
  if (!role || role === 'tenant_admin' || role === 'super_admin' || role === 'student' || role === 'parent') {
    return false;
  }
  return true;
}

export function canOpenScreen(
  role: string | undefined,
  permissions: string[] | null | undefined,
  screen: string,
  access?: UserAccessMap | null
): boolean {
  if (!role || !screen) return false;
  if (role === 'super_admin' || role === 'tenant_admin') return true;

  if (role === 'student' || role === 'parent') {
    return (
      screen === 'student_portal' ||
      screen === 'complaints' ||
      screen === 'timetable' ||
      screen === 'attendance' ||
      screen === 'voucher' ||
      screen === 'homework' ||
      screen === 'exams'
    );
  }

  if (ADMIN_ONLY_SCREENS.includes(screen)) return false;
  if (screen === 'dashboard') return true;

  const accessMap = resolveUserAccessMap(role, permissions, access);

  if (screen === 'new_admission') {
    return accessMap.enrollment === 'edit';
  }
  if (screen === 'enrollment' || screen === 'students') {
    return Boolean(accessMap.enrollment);
  }
  if (screen === 'id_cards') {
    return Boolean(accessMap.id_cards);
  }
  if (screen === 'classes') {
    return Boolean(accessMap.classes);
  }
  if (screen === 'timetable') {
    return Boolean(accessMap.timetable);
  }
  if (screen === 'attendance') {
    return Boolean(accessMap.attendance);
  }
  if (screen === 'absentee') {
    return Boolean(accessMap.absentee);
  }
  if (screen === 'homework') {
    return Boolean(accessMap.homework);
  }
  if (screen === 'geofence') {
    return Boolean(accessMap.geofence || accessMap.staff_attendance === 'edit');
  }
  if (screen === 'staff_attendance') {
    return Boolean(accessMap.staff_attendance);
  }
  if (screen === 'complaints') {
    return Boolean(accessMap.complaints);
  }
  if (screen === 'exams') {
    return Boolean(accessMap.exams_bank || accessMap.exams_marks || accessMap.exams_reports);
  }
  if (screen === 'exams_bank') return Boolean(accessMap.exams_bank);
  if (screen === 'exams_marks') return Boolean(accessMap.exams_marks);
  if (screen === 'exams_reports') return Boolean(accessMap.exams_reports);

  if (screen === 'voucher') return Boolean(accessMap.voucher);
  if (screen === 'challans') return Boolean(accessMap.challans || accessMap.voucher);
  if (screen === 'fee_reversals') return Boolean(accessMap.fee_reversals || accessMap.voucher);
  if (screen === 'expenses') return Boolean(accessMap.expenses);
  if (screen === 'payroll') return Boolean(accessMap.payroll);

  if (screen === 'teacher') {
    return role === 'teacher' || Boolean(accessMap.all_classes);
  }

  return Boolean(accessMap[screen as FeatureId]);
}

/**
 * Access check helper matching backend signature and frontend access maps:
 * can(user, 'complaints', 'edit') or can(accessMap, 'complaints', 'edit')
 */
export function can(
  targetOrFeature: any,
  featureOrLevel?: any,
  level: AccessLevel = 'view'
): boolean {
  if (!targetOrFeature) return false;

  // Case 1: can(user, 'complaints', 'edit')
  if (typeof targetOrFeature === 'object' && targetOrFeature.role) {
    const accessMap = resolveUserAccessMap(targetOrFeature.role, targetOrFeature.permissions, targetOrFeature.access);
    const feature = featureOrLevel as FeatureId;
    const reqLevel = level;
    const actual = accessMap[feature];
    if (!actual) return false;
    if (reqLevel === 'view') return actual === 'view' || actual === 'edit';
    return actual === 'edit';
  }

  // Case 2: can(accessMap, 'complaints', 'edit')
  if (typeof targetOrFeature === 'object') {
    const feature = featureOrLevel as FeatureId;
    const reqLevel = level;
    const actual = targetOrFeature[feature];
    if (!actual) return false;
    if (reqLevel === 'view') return actual === 'view' || actual === 'edit';
    return actual === 'edit';
  }

  return false;
}
