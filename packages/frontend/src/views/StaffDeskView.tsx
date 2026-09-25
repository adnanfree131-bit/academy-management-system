import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  PORTAL_GROUPS,
  ALL_FEATURE_IDS,
  deskCount,
  UserAccessMap,
  ROLE_DEFAULT_TEMPLATES,
  derivePermissions,
  resolveUserAccessMap,
} from '../lib/portalAccess';
import { QRCodeSVG } from '../lib/qrCode';
import {
  StaffMemberRecord,
  StaffTeachingAssignment,
  StaffDepartment,
  EmploymentType,
  StaffStatus,
  AcademicProgram,
  Batch,
  Subject,
} from '@apex/shared-types';
import {
  Users,
  Plus,
  Search,
  X,
  ShieldCheck,
  Check,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  Key,
  BookOpen,
  CreditCard,
  Printer,
  Building2,
  Copy,
  FileText,
  AlertTriangle,
  MoreVertical,
  Phone,
  MessageSquare,
  SlidersHorizontal,
} from 'lucide-react';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';
import { useMobileOverlay } from '../lib/mobileOverlay';
import { InstitutionalLoader } from '../components/InstitutionalLoader';

const DEPARTMENTS: StaffDepartment[] = [
  'Science',
  'Mathematics',
  'Humanities',
  'Languages',
  'Commerce',
  'Administration',
  'Accounts',
  'General',
];

const EMPLOYMENT_TYPES: { id: EmploymentType; label: string }[] = [
  { id: 'permanent', label: 'Permanent' },
  { id: 'probationary', label: 'Probationary' },
  { id: 'contractual', label: 'Contractual' },
  { id: 'visiting', label: 'Visiting Faculty' },
];

interface StaffDeskViewProps {
  onNavigate?: (screen: string) => void;
}

export const StaffDeskView: React.FC<StaffDeskViewProps> = ({ onNavigate }) => {
  const { token, tenant, user } = useAuth();
  const isAdmin = user?.role === 'tenant_admin' || user?.role === 'super_admin';

  // Dynamic Departments from Academy Settings
  const availableDepartments: string[] = useMemo(() => {
    if (tenant?.settings?.departments && tenant.settings.departments.length > 0) {
      return tenant.settings.departments;
    }
    return DEPARTMENTS;
  }, [tenant?.settings?.departments]);

  // Core Data
  const [rows, setRows] = useState<StaffMemberRecord[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [presentTodayCount, setPresentTodayCount] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilterTab, setSelectedFilterTab] = useState<
    'all' | 'faculty' | 'admin_accounts' | 'support' | 'archived'
  >('all');

  // Modals & Drawers
  const [dossierModalOpen, setDossierModalOpen] = useState<boolean>(false);
  const [editingStaff, setEditingStaff] = useState<StaffMemberRecord | null>(null);
  const [dossierTab, setDossierTab] = useState<
    'personal' | 'employment' | 'compensation' | 'access'
  >('personal');

  const [accessDrawerStaff, setAccessDrawerStaff] = useState<StaffMemberRecord | null>(null);
  const [drawerAccess, setDrawerAccess] = useState<UserAccessMap>({});
  const [savingAccessId, setSavingAccessId] = useState<string | null>(null);

  const [teachingModalStaff, setTeachingModalStaff] = useState<StaffMemberRecord | null>(null);
  const [teachingAssignments, setTeachingAssignments] = useState<StaffTeachingAssignment[]>([]);
  const [allocForm, setAllocForm] = useState<{
    program_id: string;
    batch_id: string;
    subject_id: string;
    weekly_periods: number;
  }>({
    program_id: '',
    batch_id: '',
    subject_id: '',
    weekly_periods: 6,
  });

  const [resetPwdStaff, setResetPwdStaff] = useState<StaffMemberRecord | null>(null);
  const [generatedTempPwd, setGeneratedTempPwd] = useState<string>('');
  const [copiedPwd, setCopiedPwd] = useState<boolean>(false);

  const [idCardStaff, setIdCardStaff] = useState<StaffMemberRecord | null>(null);
  const [appointmentStaff, setAppointmentStaff] = useState<StaffMemberRecord | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<StaffMemberRecord | null>(null);
  const [archiveReason, setArchiveReason] = useState<string>('Relieved on mutual agreement');

  const [deleteTarget, setDeleteTarget] = useState<StaffMemberRecord | null>(null);
  const [mobileMoreStaff, setMobileMoreStaff] = useState<StaffMemberRecord | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [showOverviewCards, setShowOverviewCards] = useState<boolean>(false);
  const [showStaffFilters, setShowStaffFilters] = useState<boolean>(false);
  const [showStaffModuleMenu, setShowStaffModuleMenu] = useState<boolean>(false);
  const staffModuleContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (staffModuleContainerRef.current && !staffModuleContainerRef.current.contains(e.target as Node)) {
        setShowStaffModuleMenu(false);
      }
    };
    if (showStaffModuleMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showStaffModuleMenu]);

  useMobileOverlay(
    'sheet',
    Boolean(
      dossierModalOpen ||
      accessDrawerStaff ||
      teachingModalStaff ||
      resetPwdStaff ||
      idCardStaff ||
      appointmentStaff ||
      archiveTarget ||
      deleteTarget ||
      mobileMoreStaff
    ),
    () => {
      setDossierModalOpen(false);
      setAccessDrawerStaff(null);
      setTeachingModalStaff(null);
      setResetPwdStaff(null);
      setIdCardStaff(null);
      setAppointmentStaff(null);
      setArchiveTarget(null);
      setDeleteTarget(null);
      setMobileMoreStaff(null);
    }
  );

  // Dossier Form State
  const initialFormState = {
    full_name: '',
    email: '',
    password: '',
    phone: '',
    employee_code: '',
    father_or_spouse_name: '',
    cnic: '',
    blood_group: '',
    gender: 'male' as 'male' | 'female' | 'other',
    dob: '',
    whatsapp: '',
    emergency_contact: '',
    emergency_relation: '',
    address: '',
    department: 'Science' as StaffDepartment,
    designation: '',
    employment_type: 'permanent' as EmploymentType,
    joining_date: new Date().toISOString().split('T')[0],
    probation_end_date: '',
    qualification: '',
    experience_years: '' as unknown as (number | ''),
    base_salary: '' as unknown as (number | ''),
    bank_name: '',
    bank_account_title: '',
    bank_account_number: '',
    bank_iban: '',
    access: { ...ROLE_DEFAULT_TEMPLATES.teacher } as UserAccessMap,
    permissions: derivePermissions(ROLE_DEFAULT_TEMPLATES.teacher),
    status: 'active' as StaffStatus,
    role: 'teacher' as string,
  };

  const [form, setForm] = useState(initialFormState);

  // Load staff and academic hierarchy
  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const todayStr = new Date().toISOString().split('T')[0];

      const [staffRes, progRes, batchRes, subjRes, attRes] = await Promise.all([
        fetch('/api/v1/academic/staff', { headers }),
        fetch('/api/v1/academic/programs', { headers }).catch(() => null),
        fetch('/api/v1/academic/batches', { headers }).catch(() => null),
        fetch('/api/v1/academic/subjects', { headers }).catch(() => null),
        fetch(`/api/v1/geofence/attendance/staff?date=${todayStr}`, { headers }).catch(() => null),
      ]);

      if (!staffRes.ok) {
        const body = await staffRes.json().catch(() => ({}));
        throw new Error(body.error?.message || 'Could not load staff directory.');
      }
      const staffBody = await staffRes.json();
      setRows(staffBody.data || []);

      if (progRes && progRes.ok) {
        const pBody = await progRes.json();
        setPrograms(pBody.data || []);
      }
      if (batchRes && batchRes.ok) {
        const bBody = await batchRes.json();
        setBatches(bBody.data || []);
      }
      if (subjRes && subjRes.ok) {
        const sBody = await subjRes.json();
        setSubjects(sBody.data || []);
      }
      if (attRes && attRes.ok) {
        const attBody = await attRes.json();
        const records = attBody.data || [];
        const presentUnique = new Set(
          records.filter((r: any) => r.clock_in_time).map((r: any) => r.staff_id)
        );
        setPresentTodayCount(presentUnique.size);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading staff records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeActionMenuId && !(e.target as Element)?.closest?.('.staff-action-menu-container')) {
        setActiveActionMenuId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeActionMenuId]);

  // Flash message helper
  const notifySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // KPIs
  const totalStaffCount = rows.length;
  const activeStaffCount = useMemo(() => rows.filter(r => r.status === 'active').length, [rows]);
  const activeFacultyCount = useMemo(() => {
    return rows.filter(
      r =>
        r.status === 'active' &&
        (r.role === 'teacher' ||
          r.role === 'academic_head' ||
          (Array.isArray(r.teaching_assignments) && r.teaching_assignments.length > 0))
    ).length;
  }, [rows]);

  const monthlyPayrollTotal = useMemo(() => {
    return rows
      .filter(r => r.status === 'active')
      .reduce((sum, r) => sum + (Number(r.base_salary) || 0), 0);
  }, [rows]);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      // Tab filter
      if (selectedFilterTab === 'archived') {
        if (row.status !== 'archived') return false;
      } else {
        if (row.status === 'archived') return false;
        if (selectedFilterTab === 'faculty') {
          const isFaculty =
            row.role === 'teacher' ||
            (Array.isArray(row.teaching_assignments) && row.teaching_assignments.length > 0);
          if (!isFaculty) return false;
        } else if (selectedFilterTab === 'admin_accounts') {
          const isFacultyOnly = row.role === 'teacher' && (!row.teaching_assignments || row.teaching_assignments.length === 0);
          const isAdminAcc = !isFacultyOnly && (
            Boolean(row.role && ['academic_head', 'tenant_admin', 'super_admin', 'finance_manager', 'receptionist', 'inventory_manager', 'hr_manager'].includes(row.role)) ||
            ['Administration', 'Accounts'].includes(row.department) ||
            /admin|account|manager|clerk|reception|accountant|cashier|bursar|director|principal|academic_head|head/i.test(row.designation || '')
          );
          if (!isAdminAcc) return false;
        } else if (selectedFilterTab === 'support') {
          const isSupport = row.role === 'support_staff' ||
            /support|peon|driver|guard|security|janitor|cleaner|attendant|helper|cook|gardener|maintenance/i.test(row.designation || '') ||
            /support/i.test(row.department || '') ||
            ((!row.role || !['teacher', 'academic_head', 'finance_manager', 'tenant_admin', 'super_admin'].includes(row.role)) &&
             !['Administration', 'Accounts'].includes(row.department) &&
             !(Array.isArray(row.teaching_assignments) && row.teaching_assignments.length > 0));
          if (!isSupport) return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          row.full_name.toLowerCase().includes(q) ||
          (row.employee_code && row.employee_code.toLowerCase().includes(q)) ||
          row.email.toLowerCase().includes(q) ||
          (row.phone && row.phone.includes(q)) ||
          (row.cnic && row.cnic.includes(q)) ||
          (row.designation && row.designation.toLowerCase().includes(q)) ||
          (row.department && row.department.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [rows, selectedFilterTab, searchQuery]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingStaff(null);
    const defaultAccess = { ...ROLE_DEFAULT_TEMPLATES.teacher };
    setForm({
      ...initialFormState,
      role: 'teacher',
      access: defaultAccess,
      permissions: derivePermissions(defaultAccess),
      department: (availableDepartments[0] || 'Science') as StaffDepartment,
    });
    setDossierTab('personal');
    setError(null);
    setDossierModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (staff: StaffMemberRecord) => {
    setEditingStaff(staff);
    const resolvedAccess = resolveUserAccessMap(staff.role, staff.permissions, staff.access);
    setForm({
      full_name: staff.full_name || '',
      email: staff.email || '',
      password: '',
      phone: staff.phone || '',
      employee_code: staff.employee_code || '',
      father_or_spouse_name: staff.father_or_spouse_name || '',
      cnic: staff.cnic || '',
      blood_group: staff.blood_group || '',
      gender: staff.gender || 'male',
      dob: staff.dob || '',
      whatsapp: staff.whatsapp || staff.phone || '',
      emergency_contact: staff.emergency_contact || '',
      emergency_relation: staff.emergency_relation || '',
      address: staff.address || '',
      department: staff.department || 'Science',
      designation: staff.designation || '',
      employment_type: staff.employment_type || 'permanent',
      joining_date: staff.joining_date || new Date().toISOString().split('T')[0],
      probation_end_date: staff.probation_end_date || '',
      qualification: staff.qualification || '',
      experience_years: staff.experience_years !== undefined && staff.experience_years !== null ? staff.experience_years : ('' as unknown as (number | '')),
      base_salary: staff.base_salary !== undefined && staff.base_salary !== null ? staff.base_salary : ('' as unknown as (number | '')),
      bank_name: staff.bank_name || '',
      bank_account_title: staff.bank_account_title || '',
      bank_account_number: staff.bank_account_number || '',
      bank_iban: staff.bank_iban || '',
      access: resolvedAccess,
      permissions: derivePermissions(resolvedAccess),
      status: staff.status || 'active',
      role: staff.role || 'teacher',
    });
    setDossierTab('personal');
    setError(null);
    setDossierModalOpen(true);
  };

  // Save Dossier (Create / Update)
  const saveDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);

    const isEdit = !!editingStaff;
    const url = isEdit
      ? `/api/v1/academic/staff/${editingStaff.id}`
      : '/api/v1/academic/staff';
    const method = isEdit ? 'PUT' : 'POST';

    const payload: any = {
      ...form,
      role: form.role || 'teacher',
      access: form.access,
      permissions: derivePermissions(form.access),
      experience_years: Number(form.experience_years) || 0,
      base_salary: Number(form.base_salary) || 0,
    };
    if (isEdit && !payload.password) {
      delete payload.password;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to save staff record.');
      }

      setDossierModalOpen(false);
      notifySuccess(
        isEdit
          ? `Staff profile for ${data.data.full_name} updated successfully.`
          : `Staff member ${data.data.full_name} (${data.data.employee_code}) created.`
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error saving staff dossier.');
    }
  };

  // Preset Applicator
  const applyPreset = (preset: 'teacher' | 'accountant' | 'academic_head' | 'clear') => {
    let nextAccess: UserAccessMap = {};
    let nextRole = form.role || 'teacher';
    if (preset === 'teacher') {
      nextAccess = { ...ROLE_DEFAULT_TEMPLATES.teacher };
      nextRole = 'teacher';
    } else if (preset === 'accountant') {
      nextAccess = { ...ROLE_DEFAULT_TEMPLATES.finance_manager };
      nextRole = 'finance_manager';
    } else if (preset === 'academic_head') {
      nextAccess = { ...ROLE_DEFAULT_TEMPLATES.academic_head };
      nextRole = 'academic_head';
    } else if (preset === 'clear') {
      nextAccess = {};
    }
    setForm(prev => ({
      ...prev,
      role: nextRole,
      access: nextAccess,
      permissions: derivePermissions(nextAccess),
    }));
  };

  // Quick Access Toggle in Drawer
  const openAccessDrawer = (staff: StaffMemberRecord) => {
    const resolved = resolveUserAccessMap(staff.role, staff.permissions, staff.access);
    setDrawerAccess(resolved);
    setAccessDrawerStaff(staff);
  };

  const saveDrawerAccess = async (staff: StaffMemberRecord, newAccess: UserAccessMap) => {
    if (!token) return;
    setSavingAccessId(staff.id);
    const newPermissions = derivePermissions(newAccess);
    try {
      const res = await fetch(`/api/v1/academic/staff/${staff.id}/access`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ access: newAccess, permissions: newPermissions }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || 'Could not update access.');
      setRows(prev => prev.map(r => (r.id === staff.id ? { ...r, access: newAccess, permissions: newPermissions } : r)));
      setAccessDrawerStaff(prev => (prev ? { ...prev, access: newAccess, permissions: newPermissions } : null));
      notifySuccess(`Access permissions for ${staff.full_name} updated.`);
    } catch (err: any) {
      setError(err.message || 'Error saving access.');
    } finally {
      setSavingAccessId(null);
    }
  };

  // Teaching Allocations
  const openTeachingModal = (staff: StaffMemberRecord) => {
    setTeachingModalStaff(staff);
    setTeachingAssignments(staff.teaching_assignments || []);
    setAllocForm({
      program_id: programs[0]?.id || '',
      batch_id: '',
      subject_id: '',
      weekly_periods: 6,
    });
    setError(null);
  };

  const addTeachingAllocation = () => {
    const prog = programs.find(p => p.id === allocForm.program_id);
    const batch = batches.find(b => b.id === allocForm.batch_id);
    const subj = subjects.find(s => s.id === allocForm.subject_id);

    if (!allocForm.program_id || !allocForm.batch_id || !allocForm.subject_id) {
      setError('Please select Class, Batch, and Subject.');
      return;
    }

    const duplicate = teachingAssignments.some(
      a => a.program_id === allocForm.program_id && a.batch_id === allocForm.batch_id && a.subject_id === allocForm.subject_id
    );
    if (duplicate) {
      setError(`This teacher is already assigned to ${subj?.name || 'Subject'} for ${batch?.name || 'Batch'}.`);
      return;
    }

    const newAlloc: StaffTeachingAssignment = {
      program_id: allocForm.program_id,
      program_name: prog?.name || 'Class',
      batch_id: allocForm.batch_id,
      batch_name: batch?.name || 'Batch',
      subject_id: allocForm.subject_id,
      subject_name: subj?.name || 'Subject',
      weekly_periods: Number(allocForm.weekly_periods) || 6,
    };

    setTeachingAssignments(prev => [...prev, newAlloc]);
    setError(null);
  };

  const removeTeachingAllocation = (idx: number) => {
    setTeachingAssignments(prev => prev.filter((_, i) => i !== idx));
  };

  const saveTeachingAssignments = async () => {
    if (!teachingModalStaff || !token) return;
    try {
      const res = await fetch(
        `/api/v1/academic/staff/${teachingModalStaff.id}/teaching-assignments`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: teachingAssignments }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Could not save allocations.');
      setRows(prev =>
        prev.map(r =>
          r.id === teachingModalStaff.id ? { ...r, teaching_assignments: teachingAssignments } : r
        )
      );
      setTeachingModalStaff(null);
      notifySuccess('Teaching workload updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Error updating teaching assignments.');
    }
  };

  // Reset Password Flow
  const openResetPasswordModal = (staff: StaffMemberRecord) => {
    setResetPwdStaff(staff);
    setGeneratedTempPwd('');
    setCopiedPwd(false);
  };

  const executePasswordReset = async () => {
    if (!resetPwdStaff || !token) return;
    try {
      const res = await fetch(`/api/v1/academic/staff/${resetPwdStaff.id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Could not reset password.');
      setGeneratedTempPwd(data.temporary_password);
      notifySuccess('Temporary password generated.');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    }
  };

  // Archive & Restore Flow
  const executeArchive = async () => {
    if (!archiveTarget || !token) return;
    try {
      const res = await fetch(`/api/v1/academic/staff/${archiveTarget.id}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: archiveReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Could not archive staff member.');
      setRows(prev => prev.map(r => (r.id === archiveTarget.id ? { ...r, status: 'archived' } : r)));
      setArchiveTarget(null);
      notifySuccess(`${archiveTarget.full_name} has been soft-archived. Login revoked.`);
    } catch (err: any) {
      setError(err.message || 'Archive failed.');
    }
  };

  const executeRestore = async (staff: StaffMemberRecord) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/academic/staff/${staff.id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Could not restore staff member.');
      setRows(prev => prev.map(r => (r.id === staff.id ? { ...r, status: 'active' } : r)));
      notifySuccess(`${staff.full_name} has been restored to active status.`);
    } catch (err: any) {
      setError(err.message || 'Restore failed.');
    }
  };

  // Hard Delete Flow
  const executeDelete = async () => {
    if (!deleteTarget || !token) return;
    try {
      const res = await fetch(`/api/v1/academic/staff/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Could not delete staff member.');
      setRows(prev => prev.filter(r => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      notifySuccess('Staff member permanently deleted.');
    } catch (err: any) {
      setError(err.message || 'Delete operation blocked.');
      setDeleteTarget(null);
    }
  };

  const totalDesks = deskCount();

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* Top Header */}
      <PageHeading
        title="Staff Directory"
        description="Staff, classes they teach, and login access."
        icon={<Users className="w-4 h-4 text-slate-700" />}
        badge={`${totalStaffCount} Personnel`}
      />

      {/* Notifications */}
      {error && (
        <div className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. CARDS ROW (Collapsible overview styled in sidebar dark navy) */}
      {showOverviewCards && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 animate-in fade-in duration-150">
          {/* Card 1: Total Staff */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Total Staff
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-white text-sm sm:text-base leading-none">
                  {totalStaffCount}
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  {activeStaffCount} Active
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 2: Teaching Faculty */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Teaching Faculty
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-white text-sm sm:text-base leading-none">
                  {activeFacultyCount}
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  Teachers
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <BookOpen className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 3: Clocked-In Today */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Clocked-In Today
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-white text-sm sm:text-base leading-none">
                  {presentTodayCount}
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  Attended
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 4: Monthly Payroll */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Monthly Payroll
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-white text-sm sm:text-base leading-none">
                  PKR {monthlyPayrollTotal.toLocaleString()}
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  Billed
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <CreditCard className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      )}

      {/* Controls Toolbar: Search + Filter + Parallel Options Button */}
      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search staff by name, code, designation, phone..."
              className="w-full pl-8 pr-7 py-2 sm:py-1.5 text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors font-sans text-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Button */}
          <button
            type="button"
            onClick={() => setShowStaffFilters(prev => !prev)}
            className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 relative ${
              showStaffFilters || selectedFilterTab !== 'all'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle Filters"
            aria-label="Toggle Filters"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
            {selectedFilterTab !== 'all' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                1
              </span>
            )}
          </button>

          {/* Simple Options Button Parallel to Filter */}
          <div ref={staffModuleContainerRef} className="relative">
            <button
              type="button"
              onClick={() => setShowStaffModuleMenu(prev => !prev)}
              className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 relative ${
                showStaffModuleMenu
                  ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Actions & Options"
              aria-label="Actions & Options"
            >
              <MoreVertical className="w-4 h-4 text-slate-600" />
            </button>

            {/* Dropdown Menu */}
            {showStaffModuleMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-40 divide-y divide-slate-100 text-left animate-in fade-in zoom-in-95 duration-100">
                {/* Primary Action */}
                {isAdmin && (
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowStaffModuleMenu(false);
                        openCreateModal();
                      }}
                      className="w-full px-3 py-2 text-xs text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg flex items-center gap-2 font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      <span>Add Staff</span>
                    </button>
                  </div>
                )}

                {/* Views Section */}
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Staff Categories
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffModuleMenu(false);
                      setSelectedFilterTab('all');
                    }}
                    className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedFilterTab === 'all' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>All Staff ({totalStaffCount})</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffModuleMenu(false);
                      setSelectedFilterTab('faculty');
                    }}
                    className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedFilterTab === 'faculty' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>Teaching Faculty</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffModuleMenu(false);
                      setSelectedFilterTab('admin_accounts');
                    }}
                    className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedFilterTab === 'admin_accounts' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Admin & Accounts</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffModuleMenu(false);
                      setSelectedFilterTab('support');
                    }}
                    className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedFilterTab === 'support' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                      <span>Support Personnel</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffModuleMenu(false);
                      setSelectedFilterTab('archived');
                    }}
                    className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedFilterTab === 'archived' ? 'text-rose-800 font-bold bg-rose-50/50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Archive className="w-3.5 h-3.5 text-slate-500" />
                      <span>Archived Staff</span>
                    </div>
                  </button>
                </div>

                {/* Display (Slider Item) */}
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Display
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOverviewCards(prev => !prev)}
                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                      <span>Overview Cards</span>
                    </div>
                    <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      showOverviewCards ? 'bg-amber-600' : 'bg-slate-300'
                    }`}>
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        showOverviewCards ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter Chips Row (Shown when Filter button is toggled) */}
        {showStaffFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 animate-in fade-in duration-150">
            {(['all', 'faculty', 'admin_accounts', 'support', 'archived'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedFilterTab(tab)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedFilterTab === tab
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {tab === 'all' ? 'All Staff' : tab === 'admin_accounts' ? 'Admin & Accounts' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* High-Density Tabular Register */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs min-h-[300px] pb-6">
        {loading ? (
          <InstitutionalLoader variant="card" label="Loading staff directory..." />
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            <Users className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No staff records match your criteria.</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Add a new staff member or change your filter selection.
            </p>
          </div>
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Department & Role</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Teaching</th>
                <th className="px-3 py-2">Salary & Bank</th>
                <th className="px-3 py-2">Portal Desks</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(row => {
                const assignedCount = row.teaching_assignments?.length || 0;
                const grantedCount = row.permissions?.length || 0;

                return (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* 1. Employee Info & 3:4 Frame */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {/* 3:4 Passport portrait ratio frame */}
                        <div className="w-7 h-9 rounded bg-slate-100 border border-slate-300 overflow-hidden flex items-center justify-center shrink-0 text-slate-600 font-bold text-xs uppercase">
                          {row.avatar_url ? (
                            <img
                              src={row.avatar_url}
                              alt={row.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            row.full_name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-semibold text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                              {row.employee_code}
                            </span>
                            <p className="font-bold text-slate-900 tracking-tight">{row.full_name}</p>
                          </div>
                          {row.father_or_spouse_name && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              S/O, D/O: {row.father_or_spouse_name}
                            </p>
                          )}
                          {row.cnic && !row.cnic.includes('@') && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              CNIC: {row.cnic}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 2. Department & Role */}
                    <td className="px-3 py-2">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {row.department}
                      </span>
                      <p className="text-slate-900 font-medium text-xs mt-0.5 truncate max-w-[140px]">
                        {row.designation}
                      </p>
                      <p className="text-slate-400 text-[10px] capitalize">
                        {row.employment_type} · Exp: {row.experience_years}y
                      </p>
                    </td>

                    {/* 3. Contact */}
                    <td className="px-3 py-2">
                      <div className="space-y-0.5">
                        <p className="text-slate-800 font-mono text-xs">{row.phone || '—'}</p>
                        <p className="text-slate-500 text-[11px] truncate max-w-[150px]">{row.email}</p>
                        {row.whatsapp && (
                          <span className="text-[10px] text-emerald-700 font-mono">
                            WA: {row.whatsapp}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. Workload / Teaching */}
                    <td className="px-3 py-2">
                      {assignedCount > 0 ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <BookOpen className="w-3 h-3 text-slate-600" />
                            {assignedCount} {assignedCount === 1 ? 'Subject' : 'Subjects'}
                          </span>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                            {Array.from(new Set(row.teaching_assignments?.map(t => t.subject_name) || [])).join(', ')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No classes</span>
                      )}
                    </td>

                    {/* 5. Salary & Bank */}
                    <td className="px-3 py-2">
                      <p className="font-mono font-bold text-slate-900 text-xs">
                        PKR {row.base_salary ? row.base_salary.toLocaleString() : '0'}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[130px]">
                        {row.bank_name || 'Bank Not Configured'}
                      </p>
                    </td>

                    {/* 6. Portal Access */}
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${
                          grantedCount > 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {grantedCount} / {totalDesks} Desks
                      </span>
                    </td>

                    {/* 7. Status */}
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          row.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : row.status === 'on_leave'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>

                    {/* 8. Actions Menu */}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          title="Edit Staff Dossier"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-colors"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          <span>Edit</span>
                        </button>

                        <div className="relative inline-block text-left staff-action-menu-container">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuId(activeActionMenuId === row.id ? null : row.id);
                            }}
                            title="More Options"
                            className={`p-1.5 rounded-lg border transition-colors ${
                              activeActionMenuId === row.id
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {activeActionMenuId === row.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-30 divide-y divide-slate-100 text-left"
                            >
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    openTeachingModal(row);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors font-medium"
                                >
                                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Teaching Workload</span>
                                </button>

                                 {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuId(null);
                                      openAccessDrawer(row);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors font-medium"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>What they can open</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    setIdCardStaff(row);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors font-medium"
                                >
                                  <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Print Staff ID Card</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    setAppointmentStaff(row);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors font-medium"
                                >
                                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Appointment Letter</span>
                                </button>

                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuId(null);
                                      openResetPasswordModal(row);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors font-medium"
                                  >
                                    <Key className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Reset Password</span>
                                  </button>
                                )}
                              </div>

                              {isAdmin && (
                                <div className="py-1">
                                  {row.status === 'archived' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveActionMenuId(null);
                                        executeRestore(row);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2.5 transition-colors font-medium"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Restore Active</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveActionMenuId(null);
                                        setArchiveTarget(row);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2.5 transition-colors font-medium"
                                    >
                                      <Archive className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Soft Archive</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuId(null);
                                      setDeleteTarget(row);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors font-medium"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Delete Staff</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Native Staff Cards (< 768px) */}
        {/* Mobile Native Staff Cards (< 768px) - Flat & Sleek Icons */}
        <div className="md:hidden divide-y divide-slate-100 bg-white">
          {filteredRows.map(row => (
            <div
              key={row.id}
              onClick={() => openEditModal(row)}
              className="p-3 active:bg-slate-50 transition-colors flex flex-col gap-2 cursor-pointer touch-press"
            >
              {/* Top: Photo + Code + Name + Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-11 rounded bg-slate-100 border border-slate-300 overflow-hidden flex items-center justify-center shrink-0 font-semibold text-slate-700 text-xs">
                    {row.avatar_url ? (
                      <img src={row.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      row.full_name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                        {row.employee_code}
                      </span>
                      <h4 className="font-semibold text-slate-900 text-sm truncate">{row.full_name}</h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate font-normal">
                      {row.designation} • <span className="text-indigo-600 font-medium">{row.department}</span>
                    </p>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize shrink-0 ${
                  row.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : row.status === 'on_leave'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {row.status}
                </span>
              </div>

              {/* Contact & Actions Row - 44px Touch Targets */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-1.5">
                  {row.phone && (
                    <a
                      href={`tel:${row.phone}`}
                      onClick={e => e.stopPropagation()}
                      className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors border border-slate-200"
                      title="Call staff"
                      aria-label="Call staff"
                    >
                      <Phone className="w-5 h-5 text-slate-700" />
                    </a>
                  )}
                  {row.whatsapp && (
                    <a
                      href={`https://wa.me/${row.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="w-11 h-11 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 border border-emerald-200 flex items-center justify-center transition-colors"
                      title="WhatsApp"
                      aria-label="WhatsApp"
                    >
                      <MessageSquare className="w-5 h-5 text-emerald-700" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMobileMoreStaff(row);
                    }}
                    className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                    title="More Options"
                    aria-label="More Options"
                  >
                    <MoreVertical className="w-5 h-5 text-slate-700" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile More Actions Sheet (< md) */}
        {mobileMoreStaff && (
          <div className="md:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet bg-slate-900/60">
            <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col mobile-sheet-card border border-slate-200 shadow-xl overflow-hidden">
              <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" />
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{mobileMoreStaff.full_name}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{mobileMoreStaff.employee_code} • {mobileMoreStaff.designation}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMoreStaff(null)}
                  className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-2 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    const s = mobileMoreStaff;
                    setMobileMoreStaff(null);
                    openTeachingModal(s);
                  }}
                  className="w-full min-h-11 px-3 text-xs text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Classes they teach</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const s = mobileMoreStaff;
                      setMobileMoreStaff(null);
                      openAccessDrawer(s);
                    }}
                    className="w-full min-h-11 px-3 text-xs text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>What they can open</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const s = mobileMoreStaff;
                    setMobileMoreStaff(null);
                    setIdCardStaff(s);
                  }}
                  className="w-full min-h-11 px-3 text-xs text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                >
                  <CreditCard className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>ID card</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const s = mobileMoreStaff;
                    setMobileMoreStaff(null);
                    setAppointmentStaff(s);
                  }}
                  className="w-full min-h-11 px-3 text-xs text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Appointment letter</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const s = mobileMoreStaff;
                      setMobileMoreStaff(null);
                      openResetPasswordModal(s);
                    }}
                    className="w-full min-h-11 px-3 text-xs text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                  >
                    <Key className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Reset password</span>
                  </button>
                )}

                {isAdmin && (
                  <>
                    {mobileMoreStaff.status === 'archived' ? (
                      <button
                        type="button"
                        onClick={() => {
                          const s = mobileMoreStaff;
                          setMobileMoreStaff(null);
                          executeRestore(s);
                        }}
                        className="w-full min-h-11 px-3 text-xs text-emerald-700 hover:bg-emerald-50 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Restore Active</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const s = mobileMoreStaff;
                          setMobileMoreStaff(null);
                          setArchiveTarget(s);
                        }}
                        className="w-full min-h-11 px-3 text-xs text-amber-700 hover:bg-amber-50 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                      >
                        <Archive className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Soft Archive</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const s = mobileMoreStaff;
                        setMobileMoreStaff(null);
                        setDeleteTarget(s);
                      }}
                      className="w-full min-h-11 px-3 text-xs text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Delete Staff</span>
                    </button>
                  </>
                )}
              </div>
              <div className="sticky bottom-0 bg-white border-t p-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMobileMoreStaff(null)}
                  className="flex-1 min-h-11 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT STAFF DOSSIER                                         */}
      {/* ========================================================================= */}
      {dossierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <form
            onSubmit={saveDossier}
            className="w-full max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-xl flex flex-col max-h-[92dvh] overflow-hidden mobile-sheet-card"
          >
            <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" />
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {editingStaff ? `Edit Staff: ${editingStaff.full_name}` : 'Add Staff'}
                </h2>
                <SectionInfo text="Staff record." />
              </div>
              <button
                type="button"
                onClick={() => setDossierModalOpen(false)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="px-4 sm:px-6 border-b border-slate-200 flex gap-2 overflow-x-auto min-w-0 whitespace-nowrap bg-white py-1">
              <button
                type="button"
                onClick={() => setDossierTab('personal')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                  dossierTab === 'personal'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Personal
              </button>
              <button
                type="button"
                onClick={() => setDossierTab('employment')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                  dossierTab === 'employment'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Employment
              </button>
              <button
                type="button"
                onClick={() => setDossierTab('compensation')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                  dossierTab === 'compensation'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Compensation
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setDossierTab('access')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                    dossierTab === 'access'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Portal Access
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Tab 1: Personal & Contact */}
              {dossierTab === 'personal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        required
                        type="text"
                        value={form.full_name}
                        onChange={e => setForm({ ...form, full_name: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Father / Spouse Name
                      </label>
                      <input
                        type="text"
                        value={form.father_or_spouse_name}
                        onChange={e => setForm({ ...form, father_or_spouse_name: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        CNIC / National ID
                      </label>
                      <input
                        type="text"
                        value={form.cnic}
                        onChange={e => setForm({ ...form, cnic: e.target.value })}
                        autoComplete="off"
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Gender
                      </label>
                      <select
                        value={form.gender}
                        onChange={e => setForm({ ...form, gender: e.target.value as any })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Blood Group
                      </label>
                      <select
                        value={form.blood_group}
                        onChange={e => setForm({ ...form, blood_group: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white"
                      >
                        <option value="">Not Specified</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={form.dob}
                        onChange={e => setForm({ ...form, dob: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Official Sign-In Email *
                      </label>
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Sign-In Password {editingStaff ? '(Leave blank to retain)' : '*'}
                      </label>
                      <input
                        required={!editingStaff}
                        type="password"
                        minLength={6}
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Primary Phone
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        WhatsApp Number
                      </label>
                      <input
                        type="tel"
                        value={form.whatsapp}
                        onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Emergency Contact Number
                      </label>
                      <input
                        type="tel"
                        value={form.emergency_contact}
                        onChange={e => setForm({ ...form, emergency_contact: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Emergency Contact Relation
                      </label>
                      <input
                        type="text"
                        value={form.emergency_relation}
                        onChange={e => setForm({ ...form, emergency_relation: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Residential Address
                    </label>
                    <textarea
                      rows={2}
                      value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Employment & Qualifications */}
              {dossierTab === 'employment' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Employee Code
                      </label>
                      <input
                        type="text"
                        value={form.employee_code}
                        onChange={e => setForm({ ...form, employee_code: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400">Leave blank to auto-generate per tenant.</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Employment Status
                      </label>
                      <select
                        value={form.status}
                        onChange={e => setForm({ ...form, status: e.target.value as StaffStatus })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white"
                      >
                        <option value="active">Active</option>
                        <option value="on_leave">On Leave</option>
                        <option value="inactive">Inactive</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Department
                      </label>
                      {availableDepartments.length === 0 ? (
                        <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200">
                          <span>No departments configured yet.</span>
                          {onNavigate && (
                            <button
                              type="button"
                              onClick={() => onNavigate('settings')}
                              className="font-bold underline hover:text-amber-900 cursor-pointer block mt-1"
                            >
                              Configure in Academy Settings →
                            </button>
                          )}
                        </div>
                      ) : (
                        <select
                          value={form.department}
                          onChange={e => setForm({ ...form, department: e.target.value as StaffDepartment })}
                          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white"
                        >
                          {availableDepartments.map(d => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Designation *
                      </label>
                      <input
                        required
                        type="text"
                        value={form.designation}
                        onChange={e => setForm({ ...form, designation: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Employment Type
                      </label>
                      <select
                        value={form.employment_type}
                        onChange={e =>
                          setForm({ ...form, employment_type: e.target.value as EmploymentType })
                        }
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white"
                      >
                        {EMPLOYMENT_TYPES.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Highest Qualification
                      </label>
                      <input
                        type="text"
                        value={form.qualification}
                        onChange={e => setForm({ ...form, qualification: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Prior Experience (Years)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={form.experience_years === '' ? '' : form.experience_years}
                        onChange={e =>
                          setForm({ ...form, experience_years: e.target.value === '' ? ('' as any) : parseInt(e.target.value, 10) })
                        }
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Joining Date
                      </label>
                      <input
                        type="date"
                        value={form.joining_date}
                        onChange={e => setForm({ ...form, joining_date: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Probation End Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={form.probation_end_date}
                        onChange={e => setForm({ ...form, probation_end_date: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {editingStaff && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Leave Entitlements & Utilization</span>
                        <span className="text-[11px] text-slate-500 font-mono">Used / Allowed</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[11px] text-slate-500 block">Casual</span>
                          <span className="font-bold font-mono text-slate-800">
                            {editingStaff.leave_balance?.casual_used ?? 0} / {editingStaff.leave_balance?.casual_allowed ?? 12}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[11px] text-slate-500 block">Sick</span>
                          <span className="font-bold font-mono text-slate-800">
                            {editingStaff.leave_balance?.sick_used ?? 0} / {editingStaff.leave_balance?.sick_allowed ?? 8}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[11px] text-slate-500 block">Annual</span>
                          <span className="font-bold font-mono text-slate-800">
                            {editingStaff.leave_balance?.annual_used ?? 0} / {editingStaff.leave_balance?.annual_allowed ?? 10}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Compensation & Banking */}
              {dossierTab === 'compensation' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1">
                      <span>Monthly Base Salary (PKR) *</span>
                      <SectionInfo text="Opens payroll for this person." />
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        PKR
                      </span>
                      <input
                        required
                        type="number"
                        min={0}
                        step={500}
                        value={form.base_salary === '' ? '' : form.base_salary}
                        onChange={e =>
                          setForm({ ...form, base_salary: e.target.value === '' ? ('' as any) : parseFloat(e.target.value) })
                        }
                        className="w-full text-sm font-bold font-mono pl-12 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={form.bank_name}
                        onChange={e => setForm({ ...form, bank_name: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Account Title
                      </label>
                      <input
                        type="text"
                        value={form.bank_account_title}
                        onChange={e => setForm({ ...form, bank_account_title: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={form.bank_account_number}
                        onChange={e => setForm({ ...form, bank_account_number: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        IBAN
                      </label>
                      <input
                        type="text"
                        value={form.bank_iban}
                        onChange={e => setForm({ ...form, bank_iban: e.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Access Presets & Permissions */}
              {dossierTab === 'access' && (
                <div className="space-y-4">
                  {/* Preset Buttons */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                      1-Click Role Presets
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyPreset('teacher')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer"
                      >
                        Teacher Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('accountant')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer"
                      >
                        Accountant Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('academic_head')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer"
                      >
                        Academic Head Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('clear')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* All Classes Scope Switch */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-amber-50/40">
                    <div>
                      <p className="text-xs font-bold text-slate-900">All Classes Scope</p>
                      <p className="text-[10px] text-slate-500">Apply student/attendance/homework/exam features to the whole academy</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(form.access?.all_classes)}
                        onChange={e => {
                          const next = { ...(form.access || {}) };
                          if (e.target.checked) next.all_classes = 'edit';
                          else delete next.all_classes;
                          setForm({ ...form, access: next, permissions: derivePermissions(next) });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {/* Feature Groups with View & Edit Checkboxes */}
                  <div className="space-y-4 pt-1">
                    {PORTAL_GROUPS.map(group => (
                      <div key={group.group} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                          {group.group}
                        </p>
                        <div className="space-y-1.5">
                          {group.features.map(feat => {
                            const level = form.access?.[feat.id];
                            const hasView = level === 'view' || level === 'edit';
                            const hasEdit = level === 'edit';
                            return (
                              <div
                                key={feat.id}
                                className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/80 transition-colors"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-slate-900">{feat.label}</p>
                                  <p className="text-[10px] text-slate-500 leading-tight">{feat.hint}</p>
                                </div>
                                <div className="flex items-center gap-4 shrink-0 text-xs">
                                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={hasView}
                                      onChange={e => {
                                        const next = { ...(form.access || {}) };
                                        if (!e.target.checked) {
                                          delete next[feat.id];
                                        } else {
                                          next[feat.id] = next[feat.id] === 'edit' ? 'edit' : 'view';
                                        }
                                        setForm({ ...form, access: next, permissions: derivePermissions(next) });
                                      }}
                                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className={`text-[11px] font-medium ${hasView ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>View</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={hasEdit}
                                      onChange={e => {
                                        const next = { ...(form.access || {}) };
                                        if (e.target.checked) {
                                          next[feat.id] = 'edit';
                                        } else {
                                          next[feat.id] = 'view';
                                        }
                                        setForm({ ...form, access: next, permissions: derivePermissions(next) });
                                      }}
                                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className={`text-[11px] font-medium ${hasEdit ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>Edit</span>
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t p-3 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                {Object.keys(form.access || {}).length} of {ALL_FEATURE_IDS.length} features granted
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setDossierModalOpen(false)}
                  className="flex-1 sm:flex-none min-h-11 sm:min-h-0 px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none min-h-11 sm:min-h-0 px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs cursor-pointer flex items-center justify-center"
                >
                  {editingStaff ? 'Update Staff Dossier' : 'Save Staff Member'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: QUICK PORTAL ACCESS TOGGLES                                       */}
      {/* ========================================================================= */}
      {accessDrawerStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-stretch sm:justify-end mobile-sheet">
          <div className="w-full max-w-lg max-h-[92dvh] sm:max-h-full h-full bg-white rounded-t-2xl sm:rounded-none sm:border-l border-slate-200 flex flex-col shadow-2xl mobile-sheet-card">
            <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" />
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between bg-slate-50">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Feature Access Control</h2>
                <p className="text-xs text-slate-700 font-medium mt-0.5">
                  {accessDrawerStaff.full_name} ({accessDrawerStaff.employee_code}) · {accessDrawerStaff.designation || accessDrawerStaff.role}
                </p>
                <p className="text-[11px] text-slate-500">
                  {Object.keys(drawerAccess || {}).length} of {ALL_FEATURE_IDS.length} features granted
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAccessDrawerStaff(null)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 touch-press -mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Role Presets */}
            <div className="px-5 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => setDrawerAccess({ ...ROLE_DEFAULT_TEMPLATES.teacher })}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"
              >
                Teacher
              </button>
              <button
                type="button"
                onClick={() => setDrawerAccess({ ...ROLE_DEFAULT_TEMPLATES.finance_manager })}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"
              >
                Accountant
              </button>
              <button
                type="button"
                onClick={() => setDrawerAccess({ ...ROLE_DEFAULT_TEMPLATES.academic_head })}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"
              >
                Academic Head
              </button>
              <button
                type="button"
                onClick={() => setDrawerAccess({})}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 ml-auto"
              >
                Clear
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* All Classes Scope Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-amber-50/40">
                <div>
                  <p className="text-xs font-bold text-slate-900">All Classes Scope</p>
                  <p className="text-[10px] text-slate-500">Apply student/attendance/homework/exam features to whole academy</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(drawerAccess?.all_classes)}
                    onChange={e => {
                      const next = { ...(drawerAccess || {}) };
                      if (e.target.checked) next.all_classes = 'edit';
                      else delete next.all_classes;
                      setDrawerAccess(next);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Feature Groups */}
              {PORTAL_GROUPS.map(group => (
                <div key={group.group} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                    {group.group}
                  </p>
                  <div className="space-y-1.5">
                    {group.features.map(feat => {
                      const level = drawerAccess?.[feat.id];
                      const hasView = level === 'view' || level === 'edit';
                      const hasEdit = level === 'edit';
                      return (
                        <div
                          key={feat.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/80 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900">{feat.label}</p>
                            <p className="text-[10px] text-slate-500 leading-tight">{feat.hint}</p>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 text-xs">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={hasView}
                                onChange={e => {
                                  const next = { ...(drawerAccess || {}) };
                                  if (!e.target.checked) {
                                    delete next[feat.id];
                                  } else {
                                    next[feat.id] = next[feat.id] === 'edit' ? 'edit' : 'view';
                                  }
                                  setDrawerAccess(next);
                                }}
                                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                              />
                              <span className={`text-[11px] font-medium ${hasView ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>View</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={hasEdit}
                                onChange={e => {
                                  const next = { ...(drawerAccess || {}) };
                                  if (e.target.checked) {
                                    next[feat.id] = 'edit';
                                  } else {
                                    next[feat.id] = 'view';
                                  }
                                  setDrawerAccess(next);
                                }}
                                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                              />
                              <span className={`text-[11px] font-medium ${hasEdit ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>Edit</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Drawer Footer */}
            <div className="sticky bottom-0 px-4 sm:px-5 py-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Takes effect on next request</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setAccessDrawerStaff(null)}
                  className="flex-1 sm:flex-none min-h-11 sm:min-h-0 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingAccessId === accessDrawerStaff.id}
                  onClick={() => saveDrawerAccess(accessDrawerStaff, drawerAccess)}
                  className="flex-1 sm:flex-none min-h-11 sm:min-h-0 px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center"
                >
                  {savingAccessId === accessDrawerStaff.id ? 'Saving...' : 'Save Access'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ASSIGN CLASSES & SUBJECTS                                        */}
      {/* ========================================================================= */}
      {teachingModalStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-xl flex flex-col max-h-[92dvh] overflow-hidden mobile-sheet-card">
            <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" />
            <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Teaching Workload
                </h2>
                <SectionInfo text={`Workload allocation for ${teachingModalStaff.full_name} (${teachingModalStaff.employee_code}) · ${teachingModalStaff.department}`} />
              </div>
              <button
                type="button"
                onClick={() => setTeachingModalStaff(null)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Allocation Adder */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Add New Class Allocation
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Academic Class
                    </label>
                    <select
                      value={allocForm.program_id}
                      onChange={e => setAllocForm({ ...allocForm, program_id: e.target.value, batch_id: '' })}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
                    >
                      <option value="">Select Class</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Batch / Section
                    </label>
                    <select
                      value={allocForm.batch_id}
                      onChange={e => setAllocForm({ ...allocForm, batch_id: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
                    >
                      <option value="">Select Batch</option>
                      {batches
                        .filter(b => !allocForm.program_id || b.program_id === allocForm.program_id)
                        .map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.shift})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Subject
                    </label>
                    <select
                      value={allocForm.subject_id}
                      onChange={e => setAllocForm({ ...allocForm, subject_id: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code || 'Sub'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-600">Weekly Periods:</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={allocForm.weekly_periods}
                      onChange={e =>
                        setAllocForm({ ...allocForm, weekly_periods: parseInt(e.target.value, 10) || 6 })
                      }
                      className="w-16 text-xs font-mono border border-slate-200 rounded-lg px-2 py-1 bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addTeachingAllocation}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Allocate Subject
                  </button>
                </div>
              </div>

              {/* Current Allocation Register */}
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                  Assigned Teaching Schedule ({teachingAssignments.length})
                </span>
                {teachingAssignments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                    No classes or subjects assigned yet.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                          <th className="px-3.5 py-2.5">Class / Program</th>
                          <th className="px-3.5 py-2.5">Batch / Section</th>
                          <th className="px-3.5 py-2.5">Subject</th>
                          <th className="px-3.5 py-2.5">Periods / Wk</th>
                          <th className="px-3.5 py-2.5 text-right">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {teachingAssignments.map((alloc, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3.5 py-2 font-medium text-slate-900">
                              {alloc.program_name}
                            </td>
                            <td className="px-3.5 py-2 text-slate-700">{alloc.batch_name}</td>
                            <td className="px-3.5 py-2 font-semibold text-indigo-700">
                              {alloc.subject_name}
                            </td>
                            <td className="px-3.5 py-2 font-mono text-slate-700">
                              {alloc.weekly_periods || 6}
                            </td>
                            <td className="px-3.5 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeTeachingAllocation(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t p-3 flex gap-2">
              <button
                type="button"
                onClick={() => setTeachingModalStaff(null)}
                className="flex-1 min-h-11 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTeachingAssignments}
                className="flex-1 min-h-11 px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs cursor-pointer flex items-center justify-center"
              >
                Save Allocations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RESET PASSWORD                                                   */}
      {/* ========================================================================= */}
      {resetPwdStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-xl p-4 sm:p-6 space-y-4 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="sm:hidden mx-auto -mt-1 mb-2 h-1 w-10 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Reset Password</h3>
                <SectionInfo text={`Reset portal sign-in credentials for ${resetPwdStaff.full_name} (${resetPwdStaff.email}).`} />
              </div>
              <button
                type="button"
                onClick={() => setResetPwdStaff(null)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {generatedTempPwd ? (
              <div className="space-y-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                  New Temporary Password
                </span>
                <p className="text-lg font-mono font-bold text-slate-900 select-all tracking-wider">
                  {generatedTempPwd}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedTempPwd);
                    setCopiedPwd(true);
                    setTimeout(() => setCopiedPwd(false), 2500);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 min-h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  {copiedPwd ? 'Copied to Clipboard!' : 'Copy Password'}
                </button>
                <p className="text-[10px] text-emerald-700">
                  Share this credential securely with the staff member.
                </p>
              </div>
            ) : (
              <div className="text-center py-2">
                <button
                  type="button"
                  onClick={executePasswordReset}
                  className="w-full min-h-11 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center"
                >
                  Generate Secure Temporary Password
                </button>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetPwdStaff(null)}
                className="w-full min-h-11 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PRINTABLE STAFF ID CARD (CR-80 DUPLEX)                           */}
      {/* ========================================================================= */}
      {idCardStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto mobile-sheet no-sheet-overlay">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-staff-id-card-area, #printable-staff-id-card-area * {
                visibility: visible !important;
              }
              #printable-staff-id-card-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 10mm !important;
                background: white !important;
              }
              .no-print {
                display: none !important;
              }
              @page {
                size: auto;
                margin: 5mm;
              }
            }
          `}</style>
          <div className="w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 print:border-none print:shadow-none print:p-0 mobile-sheet-card">
            <div className="sm:hidden mx-auto -mt-1 mb-2 h-1 w-10 rounded-full bg-slate-300 no-print" />
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Staff ID Card
                </h3>
                <SectionInfo text="ID card, front and back." />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold shadow-xs cursor-pointer h-8"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print ID Card
                </button>
                <button
                  type="button"
                  onClick={() => setIdCardStaff(null)}
                  className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Phone Summary & Print Action */}
            <div className="md:hidden space-y-3 no-print">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-1">
                <div className="w-14 h-14 rounded-full bg-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center mx-auto mb-2 overflow-hidden border border-slate-300">
                  {idCardStaff.avatar_url ? (
                    <img src={idCardStaff.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    idCardStaff.full_name.charAt(0)
                  )}
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{idCardStaff.full_name}</h4>
                <p className="text-xs font-semibold text-indigo-800">{idCardStaff.designation}</p>
                <p className="text-[11px] text-slate-500">{idCardStaff.department} · {idCardStaff.employee_code}</p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full min-h-11 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print ID Card
              </button>
              <button
                type="button"
                onClick={() => setIdCardStaff(null)}
                className="w-full min-h-11 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                Close
              </button>
            </div>

            {/* Side-by-side or Stacked Preview */}
            <div id="printable-staff-id-card-area" className="hidden md:flex print:flex flex-col sm:flex-row items-center justify-center gap-6 py-4 bg-slate-100/70 p-2 sm:p-6 rounded-2xl border border-slate-200 print:bg-white print:border-none print:p-0">
              {/* FRONT OF CARD */}
              <div className="w-[320px] h-[202px] bg-white rounded-xl border border-slate-300 shadow-md flex flex-col justify-between overflow-hidden select-none relative">
                {/* Official Institutional Header */}
                <div className="bg-[#0f172a] text-white px-3 py-2 flex items-center gap-2 border-b border-amber-500 shrink-0">
                  <div className="w-6 h-6 rounded bg-white flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-slate-800" />
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <h4 className="font-bold text-[10px] uppercase tracking-tight text-white truncate">
                      {tenant?.name || 'Academy'}
                    </h4>
                    <span className="text-[7.5px] font-semibold text-slate-300 tracking-wider uppercase block">
                      Faculty & Staff Identity Division
                    </span>
                  </div>
                </div>

                {/* Sub-bar */}
                <div className="bg-slate-100 border-b border-slate-200 px-3 py-0.5 flex justify-between text-[8px] font-bold text-slate-700 uppercase tracking-wider shrink-0">
                  <span>Faculty Identity Card</span>
                  <span className="font-mono">{idCardStaff.employee_code}</span>
                </div>

                {/* Body Details */}
                <div className="p-3 flex-1 flex items-center gap-3">
                  <div className="w-16 h-20 rounded bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0 uppercase">
                    {idCardStaff.avatar_url ? (
                      <img
                        src={idCardStaff.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      idCardStaff.full_name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5 leading-tight">
                    <h5 className="font-bold text-slate-900 text-[12px] truncate uppercase tracking-tight">
                      {idCardStaff.full_name}
                    </h5>
                    <p className="text-[10px] font-bold text-indigo-900 truncate">
                      {idCardStaff.designation}
                    </p>
                    <p className="text-[9px] text-slate-600 font-medium">
                      Dept: {idCardStaff.department}
                    </p>
                    <div className="pt-1 text-[8.5px] font-mono text-slate-600 space-y-0.5">
                      <p>Blood Group: <strong className="text-rose-700">{idCardStaff.blood_group || '—'}</strong></p>
                      <p>Valid Until: 30-JUN-{new Date().getFullYear() + 1}</p>
                    </div>
                  </div>
                </div>

                {/* Bottom Bar */}
                <div className="bg-[#0f172a] text-white px-3 py-1 text-[7.5px] font-medium tracking-wider flex justify-between">
                  <span>CAMPUS PERMIT # {idCardStaff.employee_code}</span>
                  <span>{tenant?.name || 'APEX-AMS'}</span>
                </div>
              </div>

              {/* BACK OF CARD */}
              <div className="w-[320px] h-[202px] bg-white rounded-xl border border-slate-300 shadow-md flex flex-col justify-between overflow-hidden select-none relative p-3">
                <div className="border-b border-slate-200 pb-1 flex justify-between items-center text-[8px] font-bold text-slate-700 uppercase">
                  <span>Official Declaration & Terms</span>
                  <span className="font-mono">CR-80</span>
                </div>

                <div className="flex items-center gap-3 py-1">
                  <div className="shrink-0 p-1 border border-slate-200 rounded bg-white">
                    <QRCodeSVG
                      value={JSON.stringify({
                        empid: idCardStaff.employee_code,
                        name: idCardStaff.full_name,
                        cnic: idCardStaff.cnic,
                        dept: idCardStaff.department,
                        blood: idCardStaff.blood_group || 'N/A',
                      })}
                      size={68}
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-[8.5px] space-y-1 text-slate-700 font-sans">
                    <p>
                      <strong className="text-slate-900">National ID:</strong>{' '}
                      <span className="font-mono">{idCardStaff.cnic || '37405-XXXXXXX-X'}</span>
                    </p>
                    <p>
                      <strong className="text-slate-900">Emergency Contact:</strong>{' '}
                      <span className="font-mono">
                        {idCardStaff.emergency_contact || idCardStaff.phone || '03001234567'}
                      </span>
                    </p>
                    <p>
                      <strong className="text-slate-900">Return Address:</strong>{' '}
                      <span className="truncate block">
                        {tenant?.campus_name ? `${tenant.campus_name}, ${tenant.city || ''}` : (idCardStaff.address || 'Campus Administration Office')}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="text-[7.5px] text-slate-500 leading-tight border-t border-slate-100 pt-1">
                  This card is the property of the institution. Unauthorized possession or forgery is a punishable violation. If found, please return to the Campus Administration Office.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: PRINTABLE APPOINTMENT LETTER                                     */}
      {/* ========================================================================= */}
      {appointmentStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto mobile-sheet no-sheet-overlay">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-staff-letter-area, #printable-staff-letter-area * {
                visibility: visible !important;
              }
              #printable-staff-letter-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 10mm !important;
                background: white !important;
              }
              .no-print {
                display: none !important;
              }
              @page {
                size: A4 portrait;
                margin: 10mm;
              }
            }
          `}</style>
          <div className="w-full max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[92dvh] overflow-y-auto print:border-none print:shadow-none print:p-0 print:max-h-none print:overflow-visible mobile-sheet-card">
            <div className="sm:hidden mx-auto -mt-1 mb-2 h-1 w-10 rounded-full bg-slate-300 no-print" />
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Appointment Letter
                </h3>
                <SectionInfo text="Appointment letter." />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold shadow-xs cursor-pointer h-8"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Letter
                </button>
                <button
                  type="button"
                  onClick={() => setAppointmentStaff(null)}
                  className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Phone Summary & Print Action */}
            <div className="md:hidden space-y-3 no-print">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-center">
                <FileText className="w-8 h-8 text-amber-600 mx-auto mb-1" />
                <h4 className="font-bold text-slate-900 text-sm">{appointmentStaff.full_name}</h4>
                <p className="text-xs font-semibold text-indigo-800">{appointmentStaff.designation}</p>
                <p className="text-[11px] text-slate-500">{appointmentStaff.department} · Joining: {appointmentStaff.joining_date || 'Today'}</p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full min-h-11 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Letter
              </button>
              <button
                type="button"
                onClick={() => setAppointmentStaff(null)}
                className="w-full min-h-11 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                Close
              </button>
            </div>

            {/* A4 Letter Sheet Preview */}
            <div id="printable-staff-letter-area" className="hidden md:block print:block bg-white border border-slate-300 p-4 sm:p-8 rounded-xl space-y-6 text-slate-900 font-sans shadow-sm print:border-none print:shadow-none print:p-0">
              {/* Header Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900">
                    {tenant?.name || 'Academy'}
                  </h2>
                  <p className="text-xs font-medium text-slate-600">
                    Affiliated Higher Secondary Education & Preparatory Institute
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Campus: {tenant?.campus_name || tenant?.city || 'Main Campus'} · Tel: {tenant?.phone || '051-1234567'} · contact@academy.edu.pk
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                  {tenant?.name?.charAt(0) || 'A'}
                </div>
              </div>

              {/* Reference & Date */}
              <div className="flex justify-between text-xs font-mono text-slate-600 border-b border-slate-100 pb-2">
                <span>Ref: AMS/HR/2026/{appointmentStaff.employee_code}</span>
                <span>Date: {appointmentStaff.joining_date || new Date().toISOString().split('T')[0]}</span>
              </div>

              {/* Recipient Details */}
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-900">To,</p>
                <p className="font-bold text-sm">{appointmentStaff.full_name}</p>
                {appointmentStaff.father_or_spouse_name && (
                  <p>S/O, D/O: {appointmentStaff.father_or_spouse_name}</p>
                )}
                <p className="font-mono">CNIC: {appointmentStaff.cnic || '37405-XXXXXXX-X'}</p>
                <p>Address: {appointmentStaff.address || 'Resident'}</p>
              </div>

              {/* Subject */}
              <div className="text-xs font-bold uppercase underline tracking-wide">
                Subject: Formal Offer of Appointment as {appointmentStaff.designation}
              </div>

              {/* Body */}
              <div className="text-xs text-slate-800 space-y-3 leading-relaxed">
                <p>
                  Dear <strong>{appointmentStaff.full_name}</strong>,
                </p>
                <p>
                  On behalf of {tenant?.name || 'the academy'} and the principal, we are pleased to offer you the
                  position of <strong>{appointmentStaff.designation}</strong> in the{' '}
                  <strong>{appointmentStaff.department} Department</strong> on{' '}
                  <strong>{appointmentStaff.employment_type}</strong> basis, effective from{' '}
                  <strong>
                    {appointmentStaff.joining_date || new Date().toISOString().split('T')[0]}
                  </strong>
                  .
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px]">
                    1. Compensation & Remuneration Structure
                  </h4>
                  <p className="text-xs font-semibold text-slate-900 font-mono">
                    Monthly Salary: PKR {(appointmentStaff.base_salary || 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Paid to: {appointmentStaff.bank_name || 'Bank account on file'}{appointmentStaff.bank_account_number ? ` · Acc #${appointmentStaff.bank_account_number}` : ''}.
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px]">
                    2. Terms of Service & Responsibilities
                  </h4>
                  <p>
                    You will take your assigned classes and follow the academy’s attendance rules.
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px]">
                    3. Probation Period
                  </h4>
                  <p>
                    Your employment will be subject to a probation period
                    {appointmentStaff.probation_end_date
                      ? ` through ${appointmentStaff.probation_end_date}`
                      : ' of three (3) months'}.
                  </p>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-12 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs border-t border-slate-200 print:grid-cols-2">
                <div>
                  <div className="w-36 border-b border-slate-900 mb-1" />
                  <p className="font-bold text-slate-900">Principal</p>
                  <p className="text-[11px] text-slate-500">{tenant?.name || 'Academy'}</p>
                </div>

                <div className="text-right">
                  <div className="w-36 border-b border-slate-900 ml-auto mb-1" />
                  <p className="font-bold text-slate-900">Candidate Acceptance</p>
                  <p className="text-[11px] text-slate-500">Signature & Date</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: SOFT ARCHIVE CONFIRMATION                                        */}
      {/* ========================================================================= */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-xl p-4 sm:p-6 space-y-4 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="sm:hidden mx-auto -mt-1 mb-2 h-1 w-10 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-600">
                <Archive className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-sm">Archive Staff</h3>
                <SectionInfo text="They cannot log in. Their old attendance and salary records stay." />
              </div>
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to archive{' '}
              <strong className="text-slate-900">{archiveTarget.full_name}</strong> (
              {archiveTarget.employee_code})?
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 leading-relaxed">
              <strong>Soft Archive Policy:</strong> Portal login will be immediately revoked. All
              historical student attendance records, exam evaluation marks, and payroll vouchers will
              remain completely preserved.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Relieving / Exit
              </label>
              <input
                type="text"
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-slate-900 min-h-11"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="flex-1 min-h-11 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeArchive}
                className="flex-1 min-h-11 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer flex items-center justify-center"
              >
                Archive Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: HARD DELETE CONFIRMATION                                         */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-xl p-4 sm:p-6 space-y-4 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="sm:hidden mx-auto -mt-1 mb-2 h-1 w-10 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-sm">Delete Staff</h3>
                <SectionInfo text="Delete is blocked while they have classes, homework, attendance, or a payslip." />
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900">{deleteTarget.full_name}</strong> (
              {deleteTarget.employee_code})?
            </p>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800 leading-relaxed">
              <strong>ERP Integrity Protection:</strong> Deletion is only permitted for newly added
              staff who have zero associated cashbook vouchers, payroll slips, or examination
              evaluations. For staff with historical records, use <em>Archive</em> instead.
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 min-h-11 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="flex-1 min-h-11 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-700 hover:bg-rose-800 text-white cursor-pointer flex items-center justify-center"
              >
                Delete Staff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
