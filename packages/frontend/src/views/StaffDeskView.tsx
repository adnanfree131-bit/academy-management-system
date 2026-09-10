import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ALL_PORTAL_DESKS, PORTAL_GROUPS, deskCount } from '../lib/portalAccess';
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
  ShieldOff,
  RefreshCw,
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
} from 'lucide-react';

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

export const StaffDeskView: React.FC = () => {
  const { token, tenant } = useAuth();

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
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

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
    experience_years: 0,
    base_salary: 50000,
    bank_name: '',
    bank_account_title: '',
    bank_account_number: '',
    bank_iban: '',
    permissions: ['attendance', 'homework', 'exams'] as string[],
    status: 'active' as StaffStatus,
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
          ['Science', 'Mathematics', 'Humanities', 'Languages', 'Commerce'].includes(r.department) ||
          (r.teaching_assignments && r.teaching_assignments.length > 0))
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
            ['Science', 'Mathematics', 'Humanities', 'Languages', 'Commerce', 'General'].includes(
              row.department
            ) ||
            row.role === 'teacher' ||
            (row.teaching_assignments && row.teaching_assignments.length > 0);
          if (!isFaculty) return false;
        } else if (selectedFilterTab === 'admin_accounts') {
          const isAdminAcc =
            ['Administration', 'Accounts'].includes(row.department) ||
            row.role === 'finance_manager' ||
            row.role === 'academic_head';
          if (!isAdminAcc) return false;
        } else if (selectedFilterTab === 'support') {
          const isSupport = ![
            'Science',
            'Mathematics',
            'Humanities',
            'Languages',
            'Commerce',
            'Administration',
            'Accounts',
          ].includes(row.department);
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
    setForm(initialFormState);
    setDossierTab('personal');
    setError(null);
    setDossierModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (staff: StaffMemberRecord) => {
    setEditingStaff(staff);
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
      experience_years: staff.experience_years || 0,
      base_salary: staff.base_salary || 0,
      bank_name: staff.bank_name || '',
      bank_account_title: staff.bank_account_title || '',
      bank_account_number: staff.bank_account_number || '',
      bank_iban: staff.bank_iban || '',
      permissions: staff.permissions || [],
      status: staff.status || 'active',
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
  const applyPreset = (preset: 'teacher' | 'accountant' | 'coordinator' | 'all' | 'clear') => {
    let perms: string[] = [];
    if (preset === 'teacher') {
      perms = ['attendance', 'homework', 'exams', 'timetable'];
    } else if (preset === 'accountant') {
      perms = ['voucher', 'expenses', 'payroll'];
    } else if (preset === 'coordinator') {
      perms = [
        'enrollment',
        'id_cards',
        'classes',
        'timetable',
        'attendance',
        'absentee',
        'complaints',
      ];
    } else if (preset === 'all') {
      perms = ALL_PORTAL_DESKS.map(d => d.id);
    }
    setForm(prev => ({ ...prev, permissions: perms }));
  };

  // Quick Access Toggle in Drawer
  const saveDrawerAccess = async (staff: StaffMemberRecord, newPermissions: string[]) => {
    if (!token) return;
    setSavingAccessId(staff.id);
    try {
      const res = await fetch(`/api/v1/academic/staff/${staff.id}/access`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: newPermissions }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || 'Could not update access.');
      setRows(prev => prev.map(r => (r.id === staff.id ? { ...r, permissions: newPermissions } : r)));
      setAccessDrawerStaff(prev => (prev ? { ...prev, permissions: newPermissions } : null));
      notifySuccess(`Access permissions for ${staff.full_name} updated.`);
    } catch (err: any) {
      setError(err.message || 'Error saving access.');
    } finally {
      setSavingAccessId(null);
    }
  };

  const toggleDrawerDesk = (deskId: string) => {
    if (!accessDrawerStaff) return;
    const exists = accessDrawerStaff.permissions.includes(deskId);
    const next = exists
      ? accessDrawerStaff.permissions.filter(p => p !== deskId)
      : [...accessDrawerStaff.permissions, deskId];
    saveDrawerAccess(accessDrawerStaff, next);
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
    <div className="space-y-4">
      {/* Top Header Strip */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs shrink-0">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Staff & Faculty Register</h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                {totalStaffCount} Personnel
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Employee dossiers, academic teaching workload, payroll allocations, and portal credentials.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadData}
            title="Refresh directory"
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Staff Member
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center justify-between gap-2">
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
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* High-Density Summary Ribbon */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 divide-x divide-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Total Staff:</span>
            <span className="font-mono font-bold text-slate-900">{totalStaffCount}</span>
            <span className="text-slate-400 text-[11px]">({activeStaffCount} active)</span>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <span className="text-slate-500 font-medium">Teaching Faculty:</span>
            <span className="font-mono font-bold text-indigo-700">{activeFacultyCount}</span>
            <span className="text-slate-400 text-[11px]">Subject Teachers</span>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <span className="text-slate-500 font-medium">Clocked-In Today:</span>
            <span className="font-mono font-bold text-emerald-700">{presentTodayCount}</span>
            <span className="text-slate-400 text-[11px]">/ {activeStaffCount} present</span>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <span className="text-slate-500 font-medium">Monthly Payroll:</span>
            <span className="font-mono font-bold text-slate-900">
              PKR {monthlyPayrollTotal.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400 font-mono hidden lg:block">
          Academic Session: {tenant?.academic_session || '2026-2027'}
        </div>
      </div>

      {/* High-Density Filtering Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        {/* Unnumbered Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setSelectedFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedFilterTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            All Staff
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilterTab('faculty')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedFilterTab === 'faculty'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            Teaching Faculty
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilterTab('admin_accounts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedFilterTab === 'admin_accounts'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            Administration & Accounts
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilterTab('support')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedFilterTab === 'support'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            Support Staff
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilterTab('archived')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedFilterTab === 'archived'
                ? 'bg-rose-900 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            Archived Staff
          </button>
        </div>

        {/* Search Field */}
        <div className="relative min-w-[240px] md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search code, name, CNIC, phone…"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* High-Density Tabular Register */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-xs min-h-[380px] pb-16">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
            Loading staff directory…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No staff records match your criteria.</p>
            <p className="text-xs text-slate-400 mt-1">
              Add a new staff member or change your filter selection.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="px-3.5 py-2.5">Employee</th>
                <th className="px-3.5 py-2.5">Department & Role</th>
                <th className="px-3.5 py-2.5">Contact</th>
                <th className="px-3.5 py-2.5">Teaching</th>
                <th className="px-3.5 py-2.5">Salary & Bank</th>
                <th className="px-3.5 py-2.5">Portal Desks</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(row => {
                const assignedCount = row.teaching_assignments?.length || 0;
                const grantedCount = row.permissions?.length || 0;

                return (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* 1. Employee Info & 3:4 Frame */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-3">
                        {/* 3:4 Passport portrait ratio frame */}
                        <div className="w-8 h-10 rounded bg-slate-100 border border-slate-300 overflow-hidden flex items-center justify-center shrink-0 text-slate-600 font-bold text-xs uppercase">
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
                            <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {row.employee_code}
                            </span>
                            <p className="font-bold text-slate-900 tracking-tight">{row.full_name}</p>
                          </div>
                          {row.father_or_spouse_name && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
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
                    <td className="px-3.5 py-2.5">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
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
                    <td className="px-3.5 py-2.5">
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
                    <td className="px-3.5 py-2.5">
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
                    <td className="px-3.5 py-2.5">
                      <p className="font-mono font-bold text-slate-900 text-xs">
                        PKR {row.base_salary ? row.base_salary.toLocaleString() : '0'}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[130px]">
                        {row.bank_name || 'Bank Not Configured'}
                      </p>
                    </td>

                    {/* 6. Portal Access */}
                    <td className="px-3.5 py-2.5">
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
                    <td className="px-3.5 py-2.5">
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
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
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
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
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

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    setAccessDrawerStaff(row);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors font-medium"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Portal Permissions</span>
                                </button>

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
                              </div>

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
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT STAFF DOSSIER                                         */}
      {/* ========================================================================= */}
      {dossierModalOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={saveDossier}
            className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingStaff ? `Edit Staff Dossier: ${editingStaff.full_name}` : 'Add Staff Member'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Institutional personnel registry and payroll configuration.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDossierModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Unnumbered Navigation Tabs */}
            <div className="px-6 border-b border-slate-200 flex gap-2 overflow-x-auto bg-white">
              <button
                type="button"
                onClick={() => setDossierTab('personal')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                  dossierTab === 'personal'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Personal & Contact
              </button>
              <button
                type="button"
                onClick={() => setDossierTab('employment')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                  dossierTab === 'employment'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Employment & Role
              </button>
              <button
                type="button"
                onClick={() => setDossierTab('compensation')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                  dossierTab === 'compensation'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Compensation & Banking
              </button>
              <button
                type="button"
                onClick={() => setDossierTab('access')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                  dossierTab === 'access'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Portal Access & Presets
              </button>
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
                        placeholder="e.g. Professor Rashid Minhas"
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
                        placeholder="Father or spouse name"
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
                        placeholder="37405-XXXXXXX-X"
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
                        placeholder="staff@academy.edu.pk"
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
                        placeholder={editingStaff ? '••••••••' : 'Min 6 characters'}
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
                        placeholder="03001234567"
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
                        placeholder="03001234567"
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
                        placeholder="03219876543"
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
                        placeholder="e.g. Brother, Spouse, Parent"
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
                      placeholder="Current residential address"
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
                        placeholder="Auto-generated (e.g. EMP-0001)"
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
                      <select
                        value={form.department}
                        onChange={e => setForm({ ...form, department: e.target.value as StaffDepartment })}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white"
                      >
                        {DEPARTMENTS.map(d => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
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
                        placeholder="e.g. Senior Physics Lecturer"
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
                        placeholder="e.g. M.Phil Physics, M.Com, MCS"
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
                        value={form.experience_years}
                        onChange={e =>
                          setForm({ ...form, experience_years: parseInt(e.target.value, 10) || 0 })
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
                </div>
              )}

              {/* Tab 3: Compensation & Banking */}
              {dossierTab === 'compensation' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Monthly Base Salary (PKR) *
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
                        value={form.base_salary}
                        onChange={e =>
                          setForm({ ...form, base_salary: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="75000"
                        className="w-full text-sm font-bold font-mono pl-12 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Directly links to Staff Payroll desk for automated payslip generation.
                    </p>
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
                        placeholder="e.g. Meezan Bank Ltd, HBL"
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
                        placeholder="e.g. Rashid Minhas"
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
                        placeholder="01020304050607"
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
                        placeholder="PK36MEZN0001020304050607"
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Access Presets */}
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
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800"
                      >
                        Teacher Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('accountant')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800"
                      >
                        Accountant Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('coordinator')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800"
                      >
                        Coordinator Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('all')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white"
                      >
                        Full Administrator Access
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('clear')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Desk Checkboxes */}
                  <div className="space-y-4 pt-2">
                    {PORTAL_GROUPS.map(group => (
                      <div key={group.group} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                          {group.group}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.desks.map(desk => {
                            const isChecked = form.permissions.includes(desk.id);
                            return (
                              <label
                                key={desk.id}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-emerald-50/70 border-emerald-300'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    const next = e.target.checked
                                      ? [...form.permissions, desk.id]
                                      : form.permissions.filter(p => p !== desk.id);
                                    setForm({ ...form, permissions: next });
                                  }}
                                  className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-900">{desk.label}</p>
                                  <p className="text-[10px] text-slate-500 leading-tight">{desk.hint}</p>
                                </div>
                              </label>
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
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="text-[11px] text-slate-500 font-medium">
                {form.permissions.length} of {totalDesks} portal desks granted
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDossierModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
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
        <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md h-full bg-white border-l border-slate-200 flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between bg-slate-50">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Portal Access Desks</h2>
                <p className="text-xs text-slate-700 font-medium mt-0.5">
                  {accessDrawerStaff.full_name} ({accessDrawerStaff.employee_code})
                </p>
                <p className="text-[11px] text-slate-500">
                  {accessDrawerStaff.permissions.length} of {totalDesks} desks open
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAccessDrawerStaff(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-2.5 border-b border-slate-200 bg-white flex gap-2">
              <button
                type="button"
                onClick={() => saveDrawerAccess(accessDrawerStaff, ALL_PORTAL_DESKS.map(d => d.id))}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white"
              >
                Grant All
              </button>
              <button
                type="button"
                onClick={() => saveDrawerAccess(accessDrawerStaff, [])}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Revoke All
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {PORTAL_GROUPS.map(group => (
                <div key={group.group}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    {group.group}
                  </p>
                  <div className="space-y-1.5">
                    {group.desks.map(desk => {
                      const on = accessDrawerStaff.permissions.includes(desk.id);
                      return (
                        <div
                          key={desk.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900">{desk.label}</p>
                            <p className="text-[10px] text-slate-500 leading-tight">{desk.hint}</p>
                          </div>
                          <button
                            type="button"
                            disabled={savingAccessId === accessDrawerStaff.id}
                            onClick={() => toggleDrawerDesk(desk.id)}
                            className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              on
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {on ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                            {on ? 'Open' : 'Off'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Permissions apply immediately on the next navigation request.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ASSIGN CLASSES & SUBJECTS                                        */}
      {/* ========================================================================= */}
      {teachingModalStaff && (
        <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Assign Teaching Classes & Subjects
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  {teachingModalStaff.full_name} ({teachingModalStaff.employee_code}) ·{' '}
                  {teachingModalStaff.department}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTeachingModalStaff(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
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
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
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

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setTeachingModalStaff(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTeachingAssignments}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
              >
                Save Teaching Allocations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RESET PASSWORD                                                   */}
      {/* ========================================================================= */}
      {resetPwdStaff && (
        <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Administrative Password Reset</h3>
              </div>
              <button
                type="button"
                onClick={() => setResetPwdStaff(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Reset sign-in credentials for{' '}
              <strong className="text-slate-900">{resetPwdStaff.full_name}</strong> (
              {resetPwdStaff.email}).
            </p>

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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                >
                  <Copy className="w-3.5 h-3.5" />
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
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  Generate Secure Temporary Password
                </button>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetPwdStaff(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700"
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
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
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
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-6 print:border-none print:shadow-none print:p-0">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Institutional Staff ID Card (CR-80 Duplex)
                </h3>
                <p className="text-xs text-slate-500">
                  Standard ISO/IEC 7810 ID-1 PVC dimensions (85.6mm × 53.98mm)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print ID Card
                </button>
                <button
                  type="button"
                  onClick={() => setIdCardStaff(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Side-by-side or Stacked Preview */}
            <div id="printable-staff-id-card-area" className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4 bg-slate-100/70 p-6 rounded-2xl border border-slate-200 print:bg-white print:border-none print:p-0">
              {/* FRONT OF CARD */}
              <div className="w-[320px] h-[202px] bg-white rounded-xl border border-slate-300 shadow-md flex flex-col justify-between overflow-hidden select-none relative">
                {/* Official Institutional Header */}
                <div className="bg-[#0f172a] text-white px-3 py-2 flex items-center gap-2 border-b border-amber-500 shrink-0">
                  <div className="w-6 h-6 rounded bg-white flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-slate-800" />
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <h4 className="font-extrabold text-[10px] uppercase tracking-tight text-white truncate">
                      {tenant?.name || 'Apex Academy'}
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
                    <h5 className="font-extrabold text-slate-900 text-[12px] truncate uppercase tracking-tight">
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
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
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
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto print:border-none print:shadow-none print:p-0 print:max-h-none print:overflow-visible">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Institutional Appointment Letter
                </h3>
                <p className="text-xs text-slate-500">
                  Official contract document ready for A4 printing on letterhead.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Letter (A4)
                </button>
                <button
                  type="button"
                  onClick={() => setAppointmentStaff(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* A4 Letter Sheet Preview */}
            <div id="printable-staff-letter-area" className="bg-white border border-slate-300 p-8 rounded-xl space-y-6 text-slate-900 font-sans shadow-sm print:border-none print:shadow-none print:p-0">
              {/* Header Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
                    {tenant?.name || 'Apex Academy'}
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
                <p className="font-extrabold text-sm">{appointmentStaff.full_name}</p>
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
                  On behalf of the Board of Directors and Academic Governance Council of{' '}
                  <strong>{tenant?.name || 'Apex Academy'}</strong>, we are pleased to offer you the
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border border-slate-200 bg-white rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                          <th className="px-2.5 py-1 text-left">Compensation Component</th>
                          <th className="px-2.5 py-1 text-right">Allocation</th>
                          <th className="px-2.5 py-1 text-right">Monthly Amount (PKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        <tr>
                          <td className="px-2.5 py-1 font-sans text-slate-800">Basic Pay</td>
                          <td className="px-2.5 py-1 text-right text-slate-600">70%</td>
                          <td className="px-2.5 py-1 text-right">{Math.round((appointmentStaff.base_salary || 0) * 0.7).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1 font-sans text-slate-800">Academic & Conveyance Allowance</td>
                          <td className="px-2.5 py-1 text-right text-slate-600">20%</td>
                          <td className="px-2.5 py-1 text-right">{Math.round((appointmentStaff.base_salary || 0) * 0.2).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1 font-sans text-slate-800">Medical & Utility Allowance</td>
                          <td className="px-2.5 py-1 text-right text-slate-600">10%</td>
                          <td className="px-2.5 py-1 text-right">{Math.round((appointmentStaff.base_salary || 0) * 0.1).toLocaleString()}</td>
                        </tr>
                        <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                          <td className="px-2.5 py-1 font-sans">Total Monthly Remuneration</td>
                          <td className="px-2.5 py-1 text-right">100%</td>
                          <td className="px-2.5 py-1 text-right">PKR {(appointmentStaff.base_salary || 0).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Remuneration shall be disbursed via automated bank transfer to your designated bank account (
                    {appointmentStaff.bank_name || 'Designated Bank Account'}
                    {appointmentStaff.bank_account_number ? ` · Acc #${appointmentStaff.bank_account_number}` : ''}).
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px]">
                    2. Terms of Service & Responsibilities
                  </h4>
                  <p>
                    You will conduct assigned lectures, evaluate student examination papers,
                    maintain regular notebook checking compliance, and adhere strictly to the
                    institutional code of conduct and attendance regulations.
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
                      : ' of three (3) months'}
                    , during which your academic pedagogy and institutional adherence will be evaluated.
                  </p>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-12 grid grid-cols-2 gap-8 text-xs border-t border-slate-200">
                <div>
                  <div className="w-36 border-b border-slate-900 mb-1" />
                  <p className="font-bold text-slate-900">Campus Director / Principal</p>
                  <p className="text-[11px] text-slate-500">{tenant?.name || 'Apex Academy'}</p>
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
        <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600">
              <Archive className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Archive Staff Member</h3>
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
                placeholder="e.g. Relieved on personal request, Contract completed"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeArchive}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: HARD DELETE CONFIRMATION                                         */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">Delete Staff Member</h3>
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

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-700 hover:bg-rose-800 text-white"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
