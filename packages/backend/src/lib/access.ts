import { User, UserAccessMap } from '@apex/shared-types';
export type { UserAccessMap };

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

export type AccessLevel = 'view' | 'edit';

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

export const ROLE_DEFAULT_TEMPLATES: Record<string, Partial<Record<FeatureId, AccessLevel>>> = {
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
  },
};

/**
 * Resolves live access map for a user.
 * - Missing key = no access.
 * - edit includes view.
 * - tenant_admin / super_admin: full implicit access.
 * - Legacy: permissions: string[] converted to { [id]: 'edit' }.
 * - Fail closed: if staff user has neither access nor permissions, apply role default template.
 */
export function resolveUserAccess(user: User | null | undefined): UserAccessMap {
  if (!user) return {};

  if (user.role === 'tenant_admin' || user.role === 'super_admin') {
    const fullAccess: UserAccessMap = {};
    for (const f of ALL_FEATURE_IDS) {
      fullAccess[f] = 'edit';
    }
    return fullAccess;
  }

  if (user.role === 'student' || user.role === 'parent') {
    return {};
  }

  const meta = (user.metadata || {}) as any;

  // 1. New metadata.access map
  if (meta.access && typeof meta.access === 'object' && !Array.isArray(meta.access)) {
    const result: UserAccessMap = {};
    for (const [k, v] of Object.entries(meta.access)) {
      if (k === 'staff' || k === 'settings') continue; // Never grant staff or settings through grid
      if (ALL_FEATURE_IDS.includes(k as FeatureId) && (v === 'view' || v === 'edit')) {
        result[k as FeatureId] = v as AccessLevel;
      }
    }
    return result;
  }

  // 2. Legacy metadata.permissions array
  if (Array.isArray(meta.permissions)) {
    const result: UserAccessMap = {};
    for (const p of meta.permissions) {
      if (p === 'staff' || p === 'settings') continue;
      if (p === 'exams') {
        result['exams_bank'] = 'edit';
        result['exams_marks'] = 'edit';
        result['exams_reports'] = 'edit';
      } else if (ALL_FEATURE_IDS.includes(p as FeatureId)) {
        result[p as FeatureId] = 'edit';
      }
    }
    return result;
  }

  // 3. Fail closed: Neither access nor permissions exists -> apply role default template
  const defaultTemplate = ROLE_DEFAULT_TEMPLATES[user.role];
  if (defaultTemplate) {
    return { ...defaultTemplate };
  }

  return {};
}

/**
 * Derives legacy permissions: string[] from an access map.
 */
export function derivePermissions(access: Record<string, AccessLevel>): string[] {
  const perms = Object.entries(access)
    .filter(([_, level]) => level === 'view' || level === 'edit')
    .map(([id]) => id)
    .filter(id => id !== 'staff' && id !== 'settings');

  if (access['exams_bank'] || access['exams_marks'] || access['exams_reports']) {
    if (!perms.includes('exams')) {
      perms.push('exams');
    }
  }
  return perms;
}

/**
 * Core permission check helper:
 * can(user, featureId, 'view' | 'edit')
 * - tenant_admin and super_admin: always true for academy features
 * - student and parent: false
 * - edit includes view
 */
export function can(
  user: any,
  featureId: FeatureId,
  requiredLevel: AccessLevel = 'view'
): boolean {
  if (!user) return false;
  if (user.role === 'tenant_admin' || user.role === 'super_admin') return true;
  if (user.role === 'student' || user.role === 'parent') return false;

  const access = user.access || resolveUserAccess(user);
  if (!access) return false;

  const currentLevel = access[featureId];
  if (!currentLevel) return false;

  if (requiredLevel === 'view') {
    return currentLevel === 'view' || currentLevel === 'edit';
  }
  if (requiredLevel === 'edit') {
    return currentLevel === 'edit';
  }
  return false;
}

/**
 * PreHandler factory for Fastify routes requiring a feature.
 */
export function requireFeature(featureId: FeatureId, requiredLevel: AccessLevel = 'view') {
  return async (request: any, reply: any) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
    }

    if (!can(user, featureId, requiredLevel)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN_ROLE',
          message: `Access denied. Requires '${featureId}' (${requiredLevel}) permission.`,
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Class scope helper:
 * batchScope(user) -> string[] | 'all'
 * - If user has all_classes permission -> 'all'
 * - If teaching_assignments is empty -> 'all'
 * - If teaching_assignments has rows -> return array of assigned batch_ids
 */
export function batchScope(user: any): string[] | 'all' {
  if (!user) return [];
  if (user.role === 'tenant_admin' || user.role === 'super_admin') return 'all';
  if (can(user, 'all_classes', 'view')) return 'all';

  const assignments = (user.teaching_assignments || []) as Array<{ batch_id: string }>;
  if (!assignments || assignments.length === 0) {
    return 'all';
  }

  const batchIds = Array.from(new Set(assignments.map(a => a.batch_id).filter(Boolean)));
  return batchIds;
}
