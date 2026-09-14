import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Download,
  Search,
  Sliders,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Users,
  X,
  LogIn,
  LogOut,
  Edit3,
  Plus,
  Trash2,
  Check,
  ArrowUp,
  ArrowDown,
  Info,
  Printer,
  Building2,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react';
import { PageHeading } from '../components/PageHeading';
import {
  CampusGeofenceConfig,
  AttendanceHead,
  AttendanceHeadCategory,
  StaffAttendanceRecord,
  StaffAttendanceStatus,
  DailyStaffRosterEntry,
  StaffMonthlyAttendanceSummary,
  StaffAttendanceAuditLog,
  StaffRegularizationRequest,
  StaffAttendanceSession,
} from '@apex/shared-types';
import {
  generateDailyMusterRollPdf,
  generateMonthlyRegisterPdf,
  generateDepartmentAttendanceSummaryPdf,
  generateDefaultersReportPdf,
  generateIndividualStaffCardPdf,
  generateAttendanceAuditLogPdf,
  previewPdfBytes,
  downloadPdfBytes,
  downloadCsv,
} from '../lib/staffAttendancePdf';
import { academyLetterheadFromAuth } from '../lib/officialDocumentPdf';

function computeHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function formatMinutesToHours(minutes?: number | null): string {
  if (minutes === undefined || minutes === null || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
}

function formatIsoToTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function isoToInputTime(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '';
  }
}

function localTimeToIso(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) return '';
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day, h || 0, m || 0, 0);
    return isNaN(localDate.getTime()) ? '' : localDate.toISOString();
  } catch {
    return '';
  }
}

function addMinutesToTime(timeStr?: string, minutes: number = 0): string {
  if (!timeStr || !timeStr.includes(':')) return '08:15';
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const total = (h || 0) * 60 + (m || 0) + minutes;
    const newH = Math.floor(((total % (24 * 60)) + (24 * 60)) % (24 * 60) / 60);
    const newM = ((total % 60) + 60) % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  } catch {
    return '08:15';
  }
}

function formatTriggerDescription(head: AttendanceHead): string {
  if (head.kind === 'leave') {
    return head.paid !== false ? 'Approved Paid Leave (Full Duty)' : 'Approved Unpaid Leave';
  }
  const t = head.trigger;
  if (!t || t.type === 'manual_only') {
    if (head.id === 'head-p' || head.name.toLowerCase().includes('present')) {
      return 'Standard on-time morning arrival';
    }
    return 'Manual administrative entry';
  }
  switch (t.type) {
    case 'check_in_before':
      return `Arrival at or before ${t.time || '—'}`;
    case 'check_in_after':
      return `Arrival after ${t.time || '—'} (Late)`;
    case 'check_in_between':
      return `Arrival between ${t.time || '—'} and ${t.time_end || '—'}`;
    case 'check_out_before':
      return `Early departure before ${t.time || '—'}`;
    case 'check_out_after':
      return `Departure on or after ${t.time || '—'}`;
    case 'check_out_between':
      return `Departure between ${t.time || '—'} and ${t.time_end || '—'}`;
    case 'hours_below':
      return `Duty duration < ${t.hours ?? '—'} hours`;
    case 'hours_at_least':
      return `Duty duration ≥ ${t.hours ?? '—'} hours`;
    case 'hours_between':
      return `Duty duration ${t.hours ?? '—'} to ${t.hours_end ?? '—'} hours`;
    case 'no_check_in':
      return t.time ? `No arrival punch by ${t.time}` : 'No arrival punch';
    default:
      return 'Manual administrative entry';
  }
}

export type RuleScenario =
  | 'early_exit'
  | 'hours_below'
  | 'late_arrival'
  | 'on_time'
  | 'no_check_in'
  | 'leave'
  | 'manual_special';

export function getLiveRuleSummary(
  scenario: RuleScenario,
  form: { name: string; code: string; category: AttendanceHeadCategory; paid: boolean; triggerTime: string; triggerHours: number }
): string {
  switch (scenario) {
    case 'early_exit':
      return `Staff who arrive on time but clock out before ${form.triggerTime || '01:00 PM'} will automatically be recorded as ${form.category === 'half_day' ? 'Half Day (HD)' : (form.name || 'Early Departure')}.${form.paid ? ' Counted as paid duty hours in payroll.' : ' Unpaid duration subject to wage deduction.'}`;
    case 'hours_below':
      return `Staff whose total duty between arrival and departure is under ${form.triggerHours || 4} hours will automatically be recorded as ${form.category === 'half_day' ? 'Half Day (HD)' : (form.name || 'Short Shift')}.${form.paid ? ' Counted as paid duty hours in payroll.' : ' Unpaid duration subject to wage deduction.'}`;
    case 'late_arrival':
      return `Staff who clock in after ${form.triggerTime || '08:15 AM'} will automatically be recorded as ${form.category === 'late' ? 'Late Arrival (L)' : (form.name || 'Late Arrival')}.`;
    case 'on_time':
      return `Staff who clock in on or before ${form.triggerTime || '08:15 AM'} will automatically be recorded as Present (P).`;
    case 'no_check_in':
      return `Staff with no arrival punch recorded by ${form.triggerTime || '10:00 AM'} will automatically be marked as Unexcused Absent (A).`;
    case 'leave':
      return `Administrators can select "${form.name || 'Leave'}" during manual marking or approved staff leave requests.${form.paid ? ' Full salary credit (no wage deduction).' : ' Unpaid leave (deducts 1 day wage in payroll).'}`;
    case 'manual_special':
      return `Special duty status assigned manually by administration (e.g. Official Duty, Exam Duty). Counted as ${form.paid ? 'paid' : 'unpaid'} duty hours.`;
    default:
      return '';
  }
}

function calculateAttendancePct(r: {
  attendance_percentage?: number;
  present_days: number;
  late_days: number;
  half_days: number;
  leave_days?: number;
  total_working_days: number;
}): number {
  if (typeof r.attendance_percentage === 'number') {
    return r.attendance_percentage;
  }
  const netRequired = Math.max(1, r.total_working_days - (r.leave_days || 0));
  const presentEq = r.present_days + r.late_days + r.half_days * 0.5;
  return Math.min(100, Math.round((presentEq / netRequired) * 100));
}


export const StaffClockInView: React.FC = () => {
  const { token, user, tenant } = useAuth();
  const isAdmin = user?.role === 'tenant_admin' || user?.role === 'super_admin';

  // Navigation Dates
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const isSelectedDateToday = selectedDate === todayStr;

  // Active Tab for Admin Desk - always defaults to 'daily' on every navigation
  type AdminTab = 'daily' | 'monthly' | 'reports' | 'ledger' | 'exceptions' | 'audit_logs' | 'settings';
  const [activeTab, setActiveTab] = useState<AdminTab>('daily');

  // Purge any stale legacy tab persisted in localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('apex_staff_attendance_tab');
    } catch (_) {}
  }, []);

  // Dynamic Departments from Academy Settings
  const departmentOptions = useMemo(() => {
    const configured = tenant?.settings?.departments;
    if (configured && configured.length > 0) {
      return [
        { id: 'all', label: 'All Departments' },
        ...configured.map(d => ({ id: d.toLowerCase(), label: d }))
      ];
    }
    return [
      { id: 'all', label: 'All Departments' },
      { id: 'science', label: 'Science' },
      { id: 'mathematics', label: 'Mathematics' },
      { id: 'humanities', label: 'Humanities' },
      { id: 'languages', label: 'Languages' },
      { id: 'commerce', label: 'Commerce' },
      { id: 'administration', label: 'Administration' },
      { id: 'accounts', label: 'Accounts' },
      { id: 'general', label: 'General' }
    ];
  }, [tenant?.settings?.departments]);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedDailyHead, setSelectedDailyHead] = useState('all');
  const [monthlyAttendanceFilter, setMonthlyAttendanceFilter] = useState<'all' | 'below_75' | '75_90' | 'above_90'>('all');
  const [monthlyIrregularityFilter, setMonthlyIrregularityFilter] = useState<'all' | 'has_lates' | 'has_absents'>('all');
  const [ledgerStartDate, setLedgerStartDate] = useState<string>(() => `${new Date().toISOString().slice(0, 7)}-01`);
  const [ledgerEndDate, setLedgerEndDate] = useState<string>(todayStr);
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<string>('all');
  const [exceptionTypeFilter, setExceptionTypeFilter] = useState<string>('all');

  // Reports Hub Parameters State
  const [reportDailyDate, setReportDailyDate] = useState<string>(todayStr);
  const [reportDailyDept, setReportDailyDept] = useState<string>('all');
  const [reportMonthlyMonth, setReportMonthlyMonth] = useState<string>(currentMonthStr);
  const [reportMonthlyDept, setReportMonthlyDept] = useState<string>('all');
  const [reportDeptMonth, setReportDeptMonth] = useState<string>(currentMonthStr);
  const [reportDefaultersThreshold, setReportDefaultersThreshold] = useState<number>(75);
  const [reportStaffMemberId, setReportStaffMemberId] = useState<string>('');
  const [reportStaffMonth, setReportStaffMonth] = useState<string>(currentMonthStr);
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);

  // Core Data States
  const [geofenceConfig, setGeofenceConfig] = useState<CampusGeofenceConfig | null>(null);
  const [dailyRoster, setDailyRoster] = useState<DailyStaffRosterEntry[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<StaffMonthlyAttendanceSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<StaffAttendanceAuditLog[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState<string>('');
  const [auditStaffFilter, setAuditStaffFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Individual Ledger State
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [staffPersonalRecords, setStaffPersonalRecords] = useState<StaffAttendanceRecord[]>([]);
  const [loadingPersonalHistory, setLoadingPersonalHistory] = useState<boolean>(false);

  // Regularization / Edit Attendance Modal
  const [editingEntry, setEditingEntry] = useState<DailyStaffRosterEntry | null>(null);
  const [editHeadId, setEditHeadId] = useState<string>('');
  const [editStatus, setEditStatus] = useState<StaffAttendanceStatus>('on_time');
  const [editClockIn, setEditClockIn] = useState<string>('');
  const [editClockOut, setEditClockOut] = useState<string>('');
  const [editReasonHead, setEditReasonHead] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);
  const [editFeedback, setEditFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Settings & Policy State
  const [settingsForm, setSettingsForm] = useState<{
    latitude: number;
    longitude: number;
    radius_meters: number;
    enforcement_mode: 'strict' | 'flagged';
    shift_start_time: string;
    shift_end_time: string;
    grace_period_minutes: number;
    half_day_hours: number;
    absent_cutoff_time: string;
    heads: AttendanceHead[];
  }>({
    latitude: 31.5204,
    longitude: 74.3587,
    radius_meters: 150,
    enforcement_mode: 'strict',
    shift_start_time: '08:00',
    shift_end_time: '14:00',
    grace_period_minutes: 15,
    half_day_hours: 4.0,
    absent_cutoff_time: '10:30',
    heads: []
  });
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isCalibratingLocation, setIsCalibratingLocation] = useState<boolean>(false);

  // Add / Edit Head Modal
  const [isHeadModalOpen, setIsHeadModalOpen] = useState<boolean>(false);
  const [editingHeadIndex, setEditingHeadIndex] = useState<number | null>(null);
  const [headModalForm, setHeadModalForm] = useState<{
    id: string;
    name: string;
    code: string;
    scenario: RuleScenario;
    category: AttendanceHeadCategory;
    paid: boolean;
    triggerTime: string;
    triggerHours: number;
  }>({
    id: '',
    name: '',
    code: '',
    scenario: 'early_exit',
    category: 'half_day',
    paid: true,
    triggerTime: '13:00',
    triggerHours: 4.0,
  });

  // Non-Admin Personal Desk State
  const [personalClockInRecord, setPersonalClockInRecord] = useState<StaffAttendanceRecord | null>(null);
  const [personalDistanceMeters, setPersonalDistanceMeters] = useState<number | null>(null);
  const [isLocatingSelf, setIsLocatingSelf] = useState<boolean>(false);
  const [isPersonalClocking, setIsPersonalClocking] = useState<boolean>(false);
  const [personalFeedback, setPersonalFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Staff Regularization Requests
  const [regularizationRequests, setRegularizationRequests] = useState<StaffRegularizationRequest[]>([]);
  const [isRegModalOpen, setIsRegModalOpen] = useState<boolean>(false);
  const [regDate, setRegDate] = useState<string>(todayStr);
  const [regClockIn, setRegClockIn] = useState<string>('');
  const [regClockOut, setRegClockOut] = useState<string>('');
  const [regReasonType, setRegReasonType] = useState<string>('Official Academy Duty');
  const [regNotes, setRegNotes] = useState<string>('');
  const [isSubmittingReg, setIsSubmittingReg] = useState<boolean>(false);
  const [regFeedback, setRegFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isReviewingRegId, setIsReviewingRegId] = useState<string | null>(null);

  // Faculty Personal Monthly Attendance Record Desk
  const [facultySelectedMonth, setFacultySelectedMonth] = useState<string>(todayStr.slice(0, 7));
  const [facultyMonthlyRecords, setFacultyMonthlyRecords] = useState<StaffAttendanceRecord[]>([]);
  const [loadingFacultyRecords, setLoadingFacultyRecords] = useState<boolean>(false);

  // Active user-defined heads list: operational views use persisted config; fallback to form state if not saved yet
  const activeHeads = useMemo(() => {
    const persisted = (geofenceConfig?.heads && geofenceConfig.heads.length > 0)
      ? geofenceConfig.heads
      : settingsForm.heads;
    return (persisted || []).filter(h => h.is_active !== false);
  }, [geofenceConfig?.heads, settingsForm.heads]);

  const graceCutoffTime = useMemo(() => {
    return addMinutesToTime(settingsForm.shift_start_time, settingsForm.grace_period_minutes);
  }, [settingsForm.shift_start_time, settingsForm.grace_period_minutes]);

  // Track unsaved changes in Settings tab
  const isSettingsDirty = useMemo(() => {
    if (!geofenceConfig) return false;
    const configHeads = geofenceConfig.heads || (geofenceConfig as any).attendance_heads || [];
    if (settingsForm.latitude !== geofenceConfig.latitude) return true;
    if (settingsForm.longitude !== geofenceConfig.longitude) return true;
    if (settingsForm.radius_meters !== geofenceConfig.radius_meters) return true;
    if (settingsForm.enforcement_mode !== (geofenceConfig.enforcement_mode || 'strict')) return true;
    if (settingsForm.shift_start_time !== (geofenceConfig.shift_start_time || '08:00')) return true;
    if (settingsForm.shift_end_time !== (geofenceConfig.shift_end_time || '14:00')) return true;
    if (settingsForm.grace_period_minutes !== (geofenceConfig.grace_period_minutes ?? 15)) return true;
    if (settingsForm.half_day_hours !== (geofenceConfig.half_day_hours ?? 4.0)) return true;
    if (JSON.stringify(settingsForm.heads) !== JSON.stringify(configHeads)) return true;
    return false;
  }, [settingsForm, geofenceConfig]);

  // =========================================================================
  // API Calls
  // =========================================================================

  const fetchGeofenceConfig = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/geofence/config', {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        const conf: CampusGeofenceConfig = body.data;
        setGeofenceConfig(conf);
        const resolvedHeads: AttendanceHead[] = conf.heads || (conf as any).attendance_heads || [];
        const absentHead = resolvedHeads.find(h => h.trigger?.type === 'no_check_in');
        const inferredAbsentCutoff = absentHead?.trigger?.time || '10:30';

        setSettingsForm({
          latitude: conf.latitude ?? 31.5204,
          longitude: conf.longitude ?? 74.3587,
          radius_meters: conf.radius_meters ?? 150,
          enforcement_mode: conf.enforcement_mode || 'strict',
          shift_start_time: conf.shift_start_time || '08:00',
          shift_end_time: conf.shift_end_time || '14:00',
          grace_period_minutes: conf.grace_period_minutes ?? 15,
          half_day_hours: conf.half_day_hours ?? 4.0,
          absent_cutoff_time: inferredAbsentCutoff,
          heads: resolvedHeads
        });
      }
    } catch (err) {
      console.error('Failed fetching geofence config:', err);
    }
  }, [token]);

  const fetchDailyRoster = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/geofence/attendance/roster?date=${selectedDate}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        setDailyRoster(body.data || []);
      }
    } catch (err) {
      console.error('Failed fetching daily roster:', err);
    }
  }, [token, selectedDate]);

  const fetchMonthlySummary = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/geofence/attendance/monthly-summary?month=${selectedMonth}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        setMonthlySummary(body.data || []);
      }
    } catch (err) {
      console.error('Failed fetching monthly summary:', err);
    }
  }, [token, selectedMonth]);

  const fetchAuditLogs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/geofence/attendance/audit-logs', {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        setAuditLogs(body.data || []);
      }
    } catch (err) {
      console.error('Failed fetching audit logs:', err);
    }
  }, [token]);

  const fetchStaffPersonalRecords = useCallback(async (staffId: string) => {
    if (!token || !staffId) return;
    setLoadingPersonalHistory(true);
    try {
      const res = await fetch(`/api/v1/geofence/attendance/staff`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        const rawRecords: any[] = body.data || [];
        const records: StaffAttendanceRecord[] = rawRecords.map(r => {
          let status = r.status;
          if (!status) {
            if (r.head_code === 'P' || r.head_name?.toLowerCase().includes('present')) status = 'on_time';
            else if (r.head_code === 'L' || r.head_name?.toLowerCase().includes('late')) status = 'late';
            else if (r.head_code === 'HD' || r.head_name?.toLowerCase().includes('half')) status = 'half_day';
            else if (r.head_code === 'A' || r.head_name?.toLowerCase().includes('absent')) status = 'absent';
            else status = 'on_time';
          }
          return { ...r, status };
        });
        const filtered = records.filter(r => r.staff_id === staffId);
        setStaffPersonalRecords(filtered);
      }
    } catch (err) {
      console.error('Failed fetching staff personal records:', err);
    } finally {
      setLoadingPersonalHistory(false);
    }
  }, [token]);

  const fetchSelfTodayAttendance = useCallback(async () => {
    if (!token || isAdmin) return;
    try {
      const res = await fetch(`/api/v1/geofence/attendance/staff?date=${todayStr}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        const records: StaffAttendanceRecord[] = body.data || [];
        const myRecord = records.find(r =>
          r.staff_id === user?.id ||
          r.staff_id === (user as any)?.sub ||
          r.staff_name === user?.full_name
        );
        setPersonalClockInRecord(myRecord || null);
      }
    } catch (err) {
      console.error('Failed fetching self attendance:', err);
    }
  }, [token, isAdmin, todayStr, user]);

  const fetchRegularizationRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/geofence/attendance/regularization-requests', {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        setRegularizationRequests(body.data || []);
      }
    } catch (err) {
      console.error('Failed fetching regularization requests:', err);
    }
  }, [token]);

  const fetchFacultyMonthlyRecords = useCallback(async (month: string) => {
    if (!token) return;
    setLoadingFacultyRecords(true);
    try {
      const res = await fetch('/api/v1/geofence/attendance/staff', {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        const allRecs: StaffAttendanceRecord[] = body.data || [];
        const myRecs = allRecs.filter(r =>
          (r.staff_id === user?.id || r.staff_name === user?.full_name) &&
          r.date.startsWith(month)
        );
        setFacultyMonthlyRecords(myRecs);
      }
    } catch (err) {
      console.error('Failed fetching faculty monthly records:', err);
    } finally {
      setLoadingFacultyRecords(false);
    }
  }, [token, user]);

  const facultyMonthlyStats = useMemo(() => {
    const present = facultyMonthlyRecords.filter(r => r.status === 'on_time').length;
    const late = facultyMonthlyRecords.filter(r => r.status === 'late').length;
    const halfDay = facultyMonthlyRecords.filter(r => r.status === 'half_day').length;
    const leave = facultyMonthlyRecords.filter(r => r.status === 'on_leave').length;
    const absent = facultyMonthlyRecords.filter(r => r.status === 'absent').length;
    const totalWorking = Math.max(1, present + late + halfDay + absent);
    const pct = Math.min(100, Math.round(((present + late + halfDay * 0.5) / totalWorking) * 100));
    return { present, late, halfDay, leave, absent, totalWorking, pct };
  }, [facultyMonthlyRecords]);

  // Initial Load
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchGeofenceConfig(),
      fetchDailyRoster(),
      fetchMonthlySummary(),
      fetchAuditLogs(),
      fetchSelfTodayAttendance(),
      fetchRegularizationRequests(),
      fetchFacultyMonthlyRecords(facultySelectedMonth)
    ]).finally(() => setLoading(false));
  }, [
    fetchGeofenceConfig,
    fetchDailyRoster,
    fetchMonthlySummary,
    fetchAuditLogs,
    fetchSelfTodayAttendance,
    fetchRegularizationRequests,
    fetchFacultyMonthlyRecords,
    facultySelectedMonth
  ]);

  // Roster refresh on date change
  useEffect(() => {
    fetchDailyRoster();
  }, [selectedDate, fetchDailyRoster]);

  // Monthly summary refresh on month change
  useEffect(() => {
    fetchMonthlySummary();
  }, [selectedMonth, fetchMonthlySummary]);

  // Faculty month change
  useEffect(() => {
    if (!isAdmin) {
      fetchFacultyMonthlyRecords(facultySelectedMonth);
    }
  }, [facultySelectedMonth, isAdmin, fetchFacultyMonthlyRecords]);

  // Individual staff change
  useEffect(() => {
    if (selectedStaffId) {
      fetchStaffPersonalRecords(selectedStaffId);
    } else if (dailyRoster.length > 0 && !selectedStaffId) {
      setSelectedStaffId(dailyRoster[0].staff_id);
      fetchStaffPersonalRecords(dailyRoster[0].staff_id);
    }
  }, [selectedStaffId, dailyRoster, fetchStaffPersonalRecords]);

  // Locate Self (for faculty personal desk)
  const locateSelf = useCallback(() => {
    if (!navigator.geolocation || !geofenceConfig) return;
    setIsLocatingSelf(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const dist = computeHaversineDistanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          geofenceConfig.latitude,
          geofenceConfig.longitude
        );
        setPersonalDistanceMeters(dist);
        setIsLocatingSelf(false);
      },
      () => {
        setIsLocatingSelf(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, [geofenceConfig]);

  useEffect(() => {
    if (!isAdmin && geofenceConfig) {
      locateSelf();
    }
  }, [isAdmin, geofenceConfig, locateSelf]);

  // =========================================================================
  // Handlers
  // =========================================================================

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchGeofenceConfig(),
      fetchDailyRoster(),
      fetchMonthlySummary(),
      fetchAuditLogs()
    ]);
    setRefreshing(false);
  };

  const handleDateStep = (deltaDays: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + deltaDays);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // Open Edit / Regularize Modal
  const openEditModal = (entry: DailyStaffRosterEntry) => {
    setEditingEntry(entry);
    const initialStatus = entry.status === 'not_marked' ? 'on_time' : (entry.status as StaffAttendanceStatus);
    setEditStatus(initialStatus);
    setEditClockIn(isoToInputTime(entry.clock_in_time));
    setEditClockOut(isoToInputTime(entry.clock_out_time));

    // Find existing head or matching head
    const existingHead = activeHeads.find(h => h.id === entry.head_id) || activeHeads[0];
    if (existingHead) {
      setEditHeadId(existingHead.id);
      setEditReasonHead(existingHead.name);
    } else {
      setEditHeadId(activeHeads[0]?.id || '');
      setEditReasonHead(entry.head_name || activeHeads[0]?.name || 'Attendance Adjustment');
    }

    setEditNotes(entry.admin_adjustment_notes || '');
    setEditFeedback(null);
  };

  const closeEditModal = () => {
    setEditingEntry(null);
    setEditFeedback(null);
  };

  const handleSaveRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !token) return;

    setIsSubmittingEdit(true);
    setEditFeedback(null);

    try {
      const clockInIso = localTimeToIso(selectedDate, editClockIn);
      const clockOutIso = localTimeToIso(selectedDate, editClockOut);

      const res = await fetch('/api/v1/geofence/attendance/staff/manual', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          staff_id: editingEntry.staff_id,
          staff_name: editingEntry.staff_name,
          date: selectedDate,
          status: editStatus,
          head_id: editHeadId || undefined,
          clock_in_time: clockInIso,
          clock_out_time: clockOutIso,
          reason: `${editReasonHead}: ${editNotes.trim() || 'Administrative adjustment'}`
        })
      });

      const body = await res.json();
      if (res.ok && body.success) {
        setEditFeedback({ type: 'success', message: 'Attendance updated and logged successfully.' });
        await fetchDailyRoster();
        await fetchAuditLogs();
        setTimeout(() => closeEditModal(), 1000);
      } else {
        setEditFeedback({
          type: 'error',
          message: body.error?.message || 'Failed to save attendance modification.'
        });
      }
    } catch {
      setEditFeedback({ type: 'error', message: 'Network error saving attendance modification.' });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Save Settings & Attendance Heads
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSavingSettings(true);
    setSettingsFeedback(null);

    try {
      const res = await fetch('/api/v1/geofence/config', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          latitude: settingsForm.latitude,
          longitude: settingsForm.longitude,
          radius_meters: settingsForm.radius_meters,
          enforcement_mode: settingsForm.enforcement_mode,
          shift_start_time: settingsForm.shift_start_time,
          shift_end_time: settingsForm.shift_end_time,
          grace_period_minutes: settingsForm.grace_period_minutes,
          half_day_hours: settingsForm.half_day_hours,
          heads: settingsForm.heads
        })
      });

      const body = await res.json();
      if (res.ok && body.success) {
        setGeofenceConfig(body.data);
        setSettingsFeedback({ type: 'success', message: 'Attendance policy, shift rules, and campus geofence saved successfully.' });
      } else {
        setSettingsFeedback({
          type: 'error',
          message: body.error?.message || 'Failed to update attendance settings.'
        });
      }
    } catch {
      setSettingsFeedback({ type: 'error', message: 'Network error updating attendance settings.' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Calibrate Campus GPS via HTML5
  const handleCalibrateLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsCalibratingLocation(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setSettingsForm(prev => ({
          ...prev,
          latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          longitude: parseFloat(pos.coords.longitude.toFixed(6))
        }));
        setIsCalibratingLocation(false);
      },
      err => {
        setIsCalibratingLocation(false);
        alert(`Location acquisition failed: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Apply Shift Schedule to Heads
  const handleApplyShiftPreset = () => {
    const graceCutoff = addMinutesToTime(settingsForm.shift_start_time, settingsForm.grace_period_minutes);
    const standardIds = new Set(['head-p', 'head-l', 'head-hd', 'head-a']);
    const customHeads = settingsForm.heads.filter(h => !standardIds.has(h.id));

    const standardHeads: AttendanceHead[] = [
      {
        id: 'head-p',
        name: 'Present',
        code: 'P',
        category: 'present',
        kind: 'punch',
        paid: true,
        priority: 1,
        trigger: { type: 'check_in_before', time: graceCutoff }
      },
      {
        id: 'head-l',
        name: 'Late Arrival',
        code: 'L',
        category: 'late',
        kind: 'punch',
        paid: true,
        priority: 2,
        trigger: { type: 'check_in_after', time: graceCutoff }
      },
      {
        id: 'head-hd',
        name: 'Early Departure / Half Day',
        code: 'HD',
        category: 'half_day',
        kind: 'punch',
        paid: true,
        priority: 3,
        trigger: { type: 'hours_below', hours: settingsForm.half_day_hours }
      },
      {
        id: 'head-a',
        name: 'Unexcused Absent',
        code: 'A',
        category: 'absent',
        kind: 'punch',
        paid: false,
        priority: 4 + customHeads.length,
        trigger: { type: 'no_check_in', time: settingsForm.absent_cutoff_time }
      }
    ];

    const combined = [
      standardHeads[0],
      standardHeads[1],
      standardHeads[2],
      ...customHeads,
      standardHeads[3]
    ].map((h, i) => ({ ...h, priority: i + 1 }));

    setSettingsForm(prev => ({ ...prev, heads: combined }));
    setSettingsFeedback({
      type: 'success',
      message: `Standard shift rules applied: Present ≤ ${graceCutoff}, Late > ${graceCutoff}, Half Day < ${settingsForm.half_day_hours}h, Absent after ${settingsForm.absent_cutoff_time}. Click "Save Changes" to apply.`
    });
  };

  // Attendance Head Management
  const handleMoveHead = (index: number, direction: 'up' | 'down') => {
    const heads = [...settingsForm.heads];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= heads.length) return;

    const temp = heads[index];
    heads[index] = heads[targetIndex];
    heads[targetIndex] = temp;

    // Recalculate priority
    const reordered = heads.map((h, i) => ({ ...h, priority: i + 1 }));
    setSettingsForm(prev => ({ ...prev, heads: reordered }));
  };

  const handleDeleteHead = (id: string) => {
    if (!confirm('Are you sure you want to remove this attendance head?')) return;
    const remaining = settingsForm.heads
      .filter(h => h.id !== id)
      .map((h, i) => ({ ...h, priority: i + 1 }));
    setSettingsForm(prev => ({ ...prev, heads: remaining }));
  };

  const detectScenarioFromHead = useCallback((head: AttendanceHead): RuleScenario => {
    if (head.kind === 'leave' || head.category === 'leave') return 'leave';
    const t = head.trigger;
    if (!t || t.type === 'manual_only') {
      if (head.id === 'head-p' || head.name.toLowerCase().includes('present')) return 'on_time';
      return 'manual_special';
    }
    if (t.type === 'check_out_before' || t.type === 'check_out_between' || t.type === 'check_out_after') {
      return 'early_exit';
    }
    if (t.type === 'hours_below' || t.type === 'hours_between' || t.type === 'hours_at_least') {
      return 'hours_below';
    }
    if (t.type === 'check_in_after') return 'late_arrival';
    if (t.type === 'check_in_before' || t.type === 'check_in_between') return 'on_time';
    if (t.type === 'no_check_in') return 'no_check_in';
    return 'manual_special';
  }, []);

  const handleOpenAddHeadModal = () => {
    setEditingHeadIndex(null);
    const defaultEarlyTime = addMinutesToTime(settingsForm.shift_end_time || '14:00', -60);
    setHeadModalForm({
      id: `head-${Date.now()}`,
      name: 'Early Departure',
      code: 'ED',
      scenario: 'early_exit',
      category: 'half_day',
      paid: true,
      triggerTime: defaultEarlyTime,
      triggerHours: settingsForm.half_day_hours || 4.0,
    });
    setIsHeadModalOpen(true);
  };

  const handleOpenEditHeadModal = (index: number) => {
    const head = settingsForm.heads[index];
    setEditingHeadIndex(index);
    const scenario = detectScenarioFromHead(head);

    const defaultEarlyTime = addMinutesToTime(settingsForm.shift_end_time || '14:00', -60);
    const defaultGraceTime = addMinutesToTime(settingsForm.shift_start_time || '08:00', settingsForm.grace_period_minutes || 15);

    setHeadModalForm({
      id: head.id,
      name: head.name,
      code: head.code || '',
      scenario,
      category: head.category || (head.kind === 'leave' ? 'leave' : 'present'),
      paid: head.paid !== false,
      triggerTime: head.trigger?.time || (
        scenario === 'early_exit' ? defaultEarlyTime :
        scenario === 'late_arrival' || scenario === 'on_time' ? defaultGraceTime :
        scenario === 'no_check_in' ? settingsForm.absent_cutoff_time || '10:00' :
        '08:30'
      ),
      triggerHours: head.trigger?.hours ?? (settingsForm.half_day_hours || 4.0),
    });
    setIsHeadModalOpen(true);
  };

  const handleScenarioChange = (newScenario: RuleScenario) => {
    const defaultGraceTime = addMinutesToTime(settingsForm.shift_start_time || '08:00', settingsForm.grace_period_minutes || 15);
    const defaultEarlyTime = addMinutesToTime(settingsForm.shift_end_time || '14:00', -60);

    setHeadModalForm(prev => {
      let defaultName = prev.name;
      let defaultCode = prev.code;
      let defaultCategory: AttendanceHeadCategory = prev.category;
      let defaultPaid = prev.paid;
      let defaultTime = prev.triggerTime;
      let defaultHours = prev.triggerHours;

      const isDefaultText = !editingHeadIndex || [
        'Early Departure', 'Short Shift', 'Late Arrival', 'Present (On-Time)', 'Unexcused Absent', 'Casual Leave', 'Official Academy Duty',
        'Present', 'Absent'
      ].includes(prev.name.trim());

      switch (newScenario) {
        case 'early_exit':
          if (isDefaultText) {
            defaultName = 'Early Departure';
            defaultCode = 'ED';
          }
          defaultCategory = 'half_day';
          defaultPaid = true;
          defaultTime = defaultEarlyTime;
          break;
        case 'hours_below':
          if (isDefaultText) {
            defaultName = 'Short Shift';
            defaultCode = 'HD';
          }
          defaultCategory = 'half_day';
          defaultPaid = true;
          defaultHours = settingsForm.half_day_hours || 4.0;
          break;
        case 'late_arrival':
          if (isDefaultText) {
            defaultName = 'Late Arrival';
            defaultCode = 'L';
          }
          defaultCategory = 'late';
          defaultPaid = true;
          defaultTime = defaultGraceTime;
          break;
        case 'on_time':
          if (isDefaultText) {
            defaultName = 'Present (On-Time)';
            defaultCode = 'P';
          }
          defaultCategory = 'present';
          defaultPaid = true;
          defaultTime = defaultGraceTime;
          break;
        case 'no_check_in':
          if (isDefaultText) {
            defaultName = 'Unexcused Absent';
            defaultCode = 'A';
          }
          defaultCategory = 'absent';
          defaultPaid = false;
          defaultTime = settingsForm.absent_cutoff_time || '10:00';
          break;
        case 'leave':
          if (isDefaultText) {
            defaultName = 'Casual Leave';
            defaultCode = 'CL';
          }
          defaultCategory = 'leave';
          defaultPaid = true;
          break;
        case 'manual_special':
          if (isDefaultText) {
            defaultName = 'Official Academy Duty';
            defaultCode = 'OD';
          }
          defaultCategory = 'present';
          defaultPaid = true;
          break;
      }

      return {
        ...prev,
        scenario: newScenario,
        name: defaultName,
        code: defaultCode,
        category: defaultCategory,
        paid: defaultPaid,
        triggerTime: defaultTime,
        triggerHours: defaultHours,
      };
    });
  };

  const handleSaveHeadModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headModalForm.name.trim()) return;

    const isLeave = headModalForm.scenario === 'leave';
    const chosenCategory: AttendanceHeadCategory = isLeave ? 'leave' : headModalForm.category;

    const cleanCode = headModalForm.code.trim().toUpperCase() ||
      headModalForm.name.trim().split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'HD';

    let triggerConfig: any = { type: 'manual_only' };
    switch (headModalForm.scenario) {
      case 'early_exit':
        triggerConfig = { type: 'check_out_before', time: headModalForm.triggerTime };
        break;
      case 'hours_below':
        triggerConfig = { type: 'hours_below', hours: headModalForm.triggerHours };
        break;
      case 'late_arrival':
        triggerConfig = { type: 'check_in_after', time: headModalForm.triggerTime };
        break;
      case 'on_time':
        triggerConfig = { type: 'check_in_before', time: headModalForm.triggerTime };
        break;
      case 'no_check_in':
        triggerConfig = { type: 'no_check_in', time: headModalForm.triggerTime };
        break;
      case 'leave':
      case 'manual_special':
        triggerConfig = { type: 'manual_only' };
        break;
    }

    const newHead: AttendanceHead = {
      id: headModalForm.id || `head-${Date.now()}`,
      name: headModalForm.name.trim(),
      code: cleanCode,
      category: chosenCategory,
      kind: isLeave ? 'leave' : 'punch',
      paid: headModalForm.paid,
      priority: editingHeadIndex !== null ? editingHeadIndex + 1 : settingsForm.heads.length + 1,
      trigger: triggerConfig,
    };

    const updatedHeads = [...settingsForm.heads];
    if (editingHeadIndex !== null) {
      updatedHeads[editingHeadIndex] = newHead;
    } else {
      updatedHeads.push(newHead);
    }

    const reordered = updatedHeads.map((h, i) => ({ ...h, priority: i + 1 }));
    setSettingsForm(prev => ({ ...prev, heads: reordered }));
    setIsHeadModalOpen(false);
  };

  const handleResetToBasicHeads = () => {
    if (confirm('Reset attendance heads to match standard daily shift schedule (Present, Late Arrival, Early Departure, Absent)?')) {
      handleApplyShiftPreset();
    }
  };

  const handleClearAllHeads = () => {
    if (confirm('Are you sure you want to clear all configured heads?')) {
      setSettingsForm(prev => ({ ...prev, heads: [] }));
    }
  };

  // Faculty Personal Clock In/Out (Non-Admin)
  const handlePersonalAction = async (action: 'in' | 'out') => {
    if (!token) return;
    if (!navigator.geolocation) {
      setPersonalFeedback({ type: 'error', message: 'Geolocation not supported by browser.' });
      return;
    }
    setIsPersonalClocking(true);
    setPersonalFeedback(null);

    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const endpoint = action === 'in'
            ? '/api/v1/geofence/attendance/staff/clock-in'
            : '/api/v1/geofence/attendance/staff/clock-out';

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            })
          });

          const body = await res.json();
          if (res.ok && body.success) {
            setPersonalClockInRecord(body.data);
            setPersonalFeedback({
              type: 'success',
              message: action === 'in'
                ? `Clocked in successfully (${body.data.distance_meters}m from campus center)`
                : `Clocked out successfully.`
            });
            fetchSelfTodayAttendance();
          } else {
            setPersonalFeedback({
              type: 'error',
              message: body.error?.message || `Clock-${action} failed.`
            });
          }
        } catch {
          setPersonalFeedback({ type: 'error', message: `Network error processing clock-${action}.` });
        } finally {
          setIsPersonalClocking(false);
        }
      },
      err => {
        setIsPersonalClocking(false);
        setPersonalFeedback({ type: 'error', message: `GPS error: ${err.message}` });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Staff Regularization Request Handlers
  const handleSubmitRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmittingReg(true);
    setRegFeedback(null);
    try {
      const clockInIso = regClockIn ? localTimeToIso(regDate, regClockIn) : undefined;
      const clockOutIso = regClockOut ? localTimeToIso(regDate, regClockOut) : undefined;

      const res = await fetch('/api/v1/geofence/attendance/regularization-requests', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          date: regDate,
          clock_in_time: clockInIso,
          clock_out_time: clockOutIso,
          reason_type: regReasonType,
          notes: regNotes.trim() || undefined
        })
      });

      const body = await res.json();
      if (res.ok && body.success) {
        setRegFeedback({ type: 'success', message: 'Regularization request submitted for administrative approval.' });
        await fetchRegularizationRequests();
        setTimeout(() => {
          setIsRegModalOpen(false);
          setRegFeedback(null);
          setRegNotes('');
          setRegClockIn('');
          setRegClockOut('');
        }, 1200);
      } else {
        setRegFeedback({ type: 'error', message: body.error?.message || 'Failed to submit regularization request.' });
      }
    } catch {
      setRegFeedback({ type: 'error', message: 'Network error submitting regularization request.' });
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleReviewRegularization = async (requestId: string, action: 'approved' | 'rejected') => {
    if (!token) return;
    setIsReviewingRegId(requestId);
    try {
      const res = await fetch(`/api/v1/geofence/attendance/regularization-requests/${requestId}/review`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      const body = await res.json();
      if (res.ok && body.success) {
        await fetchRegularizationRequests();
        await fetchDailyRoster();
        await fetchAuditLogs();
      } else {
        alert(body.error?.message || `Failed to ${action} regularization request.`);
      }
    } catch {
      alert('Network error reviewing regularization request.');
    } finally {
      setIsReviewingRegId(null);
    }
  };

  // =========================================================================
  // Native PDF & CSV Export Handlers (Preview in New Tab via previewPdfBytes)
  // =========================================================================

  // Report 1: Daily Staff Attendance Register (Muster Roll)
  const handlePreviewDailyPdf = async (customDate?: string, customDept?: string) => {
    const targetDate = customDate || selectedDate;
    const targetDept = customDept || selectedDept;
    setIsExportingPdf(true);
    setGeneratingReportId('daily_muster_roll');
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const targetRoster = dailyRoster.filter(r => {
        return targetDept === 'all' || r.department.toLowerCase() === targetDept.toLowerCase();
      });
      const stats = {
        total: targetRoster.length,
        present: targetRoster.filter(r => r.status === 'on_time').length,
        late: targetRoster.filter(r => r.status === 'late').length,
        half_day: targetRoster.filter(r => r.status === 'half_day').length,
        leave: targetRoster.filter(r => r.status === 'on_leave').length,
        absent: targetRoster.filter(r => r.status === 'absent').length,
      };
      const pdfBytes = await generateDailyMusterRollPdf(letterhead, targetDate, targetRoster, stats);
      previewPdfBytes(pdfBytes, `Daily_Staff_Muster_Roll_${targetDate}.pdf`);
    } catch (err) {
      console.error('Daily PDF preview failed:', err);
      alert('Failed to generate daily attendance PDF document.');
    } finally {
      setIsExportingPdf(false);
      setGeneratingReportId(null);
    }
  };

  const handleDownloadDailyPdf = async (customDate?: string, customDept?: string) => {
    const targetDate = customDate || selectedDate;
    const targetDept = customDept || selectedDept;
    setIsExportingPdf(true);
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const targetRoster = dailyRoster.filter(r => targetDept === 'all' || r.department.toLowerCase() === targetDept.toLowerCase());
      const stats = {
        total: targetRoster.length,
        present: targetRoster.filter(r => r.status === 'on_time').length,
        late: targetRoster.filter(r => r.status === 'late').length,
        half_day: targetRoster.filter(r => r.status === 'half_day').length,
        leave: targetRoster.filter(r => r.status === 'on_leave').length,
        absent: targetRoster.filter(r => r.status === 'absent').length,
      };
      const pdfBytes = await generateDailyMusterRollPdf(letterhead, targetDate, targetRoster, stats);
      downloadPdfBytes(pdfBytes, `Daily_Staff_Muster_Roll_${targetDate}.pdf`);
    } catch (err) {
      console.error('Daily PDF download failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportDailyCsv = () => {
    const headers = ['#', 'Employee Code', 'Staff Name', 'Department', 'Designation', 'Arrival Time', 'Departure Time', 'Duty Duration (Mins)', 'Status', 'Attendance Head'];
    const rows = filteredDailyRoster.map((r, i) => [
      i + 1,
      r.employee_code,
      r.staff_name,
      r.department,
      r.designation,
      formatIsoToTime(r.clock_in_time),
      formatIsoToTime(r.clock_out_time),
      r.work_duration_minutes ?? '',
      (r.status || 'not_marked').toUpperCase(),
      r.head_name ? `${r.head_name} (${r.head_code})` : ''
    ]);
    downloadCsv(`Daily_Staff_Attendance_${selectedDate}`, headers, rows);
  };

  // Report 2: Monthly Attendance Summary (Payroll Register)
  const handlePreviewMonthlyPdf = async (customMonth?: string, customDept?: string) => {
    const targetMonth = customMonth || selectedMonth;
    const targetDept = customDept || selectedDept;
    setIsExportingPdf(true);
    setGeneratingReportId('monthly_register');
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const targetSummary = monthlySummary.filter(r => targetDept === 'all' || r.department.toLowerCase() === targetDept.toLowerCase());
      const pdfBytes = await generateMonthlyRegisterPdf(letterhead, targetMonth, targetSummary);
      previewPdfBytes(pdfBytes, `Monthly_Attendance_Register_${targetMonth}.pdf`);
    } catch (err) {
      console.error('Monthly PDF preview failed:', err);
      alert('Failed to generate monthly summary PDF document.');
    } finally {
      setIsExportingPdf(false);
      setGeneratingReportId(null);
    }
  };

  const handleDownloadMonthlyPdf = async (customMonth?: string, customDept?: string) => {
    const targetMonth = customMonth || selectedMonth;
    const targetDept = customDept || selectedDept;
    setIsExportingPdf(true);
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const targetSummary = monthlySummary.filter(r => targetDept === 'all' || r.department.toLowerCase() === targetDept.toLowerCase());
      const pdfBytes = await generateMonthlyRegisterPdf(letterhead, targetMonth, targetSummary);
      downloadPdfBytes(pdfBytes, `Monthly_Attendance_Register_${targetMonth}.pdf`);
    } catch (err) {
      console.error('Monthly PDF download failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportMonthlyCsv = () => {
    const headers = ['#', 'Employee Code', 'Staff Name', 'Department', 'Working Days', 'Present Days', 'Late Days', 'Half Days', 'Leave Days', 'Absent Days', 'Duty Minutes', 'Attendance %'];
    const rows = filteredMonthlySummary.map((r, i) => [
      i + 1,
      r.employee_code,
      r.staff_name,
      r.department,
      r.total_working_days,
      r.present_days,
      r.late_days,
      r.half_days,
      r.leave_days,
      r.absent_days,
      r.total_work_minutes,
      calculateAttendancePct(r)
    ]);
    downloadCsv(`Staff_Monthly_Summary_${selectedMonth}`, headers, rows);
  };

  // Helper to aggregate individual staff summaries into department metrics
  const buildDepartmentSummaries = (sourceList: StaffMonthlyAttendanceSummary[]) => {
    const deptMap = new Map<string, {
      department: string;
      staff_count: number;
      total_working_days: number;
      present_days: number;
      late_days: number;
      half_days: number;
      leave_days: number;
      absent_days: number;
      sum_pct: number;
    }>();

    for (const r of sourceList) {
      const dept = r.department || 'General';
      const pct = calculateAttendancePct(r);
      const existing = deptMap.get(dept);
      if (existing) {
        existing.staff_count += 1;
        existing.total_working_days = Math.max(existing.total_working_days, r.total_working_days);
        existing.present_days += r.present_days;
        existing.late_days += r.late_days;
        existing.half_days += r.half_days;
        existing.leave_days += r.leave_days;
        existing.absent_days += r.absent_days;
        existing.sum_pct += pct;
      } else {
        deptMap.set(dept, {
          department: dept,
          staff_count: 1,
          total_working_days: r.total_working_days,
          present_days: r.present_days,
          late_days: r.late_days,
          half_days: r.half_days,
          leave_days: r.leave_days,
          absent_days: r.absent_days,
          sum_pct: pct,
        });
      }
    }

    return Array.from(deptMap.values()).map(d => ({
      department: d.department,
      staff_count: d.staff_count,
      total_working_days: d.total_working_days,
      present_days: d.present_days,
      late_days: d.late_days,
      half_days: d.half_days,
      leave_days: d.leave_days,
      absent_days: d.absent_days,
      avg_attendance_pct: Math.round(d.sum_pct / Math.max(1, d.staff_count)),
    }));
  };

  // Helper to build typed defaulters list
  const buildDefaultersList = (summaryList: StaffMonthlyAttendanceSummary[], threshold: number) => {
    return summaryList
      .map(r => {
        const pct = calculateAttendancePct(r);
        const isBelow = pct < threshold;
        const isChronic = r.late_days >= 3;
        if (!isBelow && !isChronic) return null;
        return {
          employee_code: r.employee_code,
          staff_name: r.staff_name,
          department: r.department,
          designation: r.designation,
          total_working_days: r.total_working_days,
          present_days: r.present_days,
          late_days: r.late_days,
          absent_days: r.absent_days,
          attendance_pct: pct,
          reason_flag: isBelow && isChronic ? `Below ${threshold}% & Chronic Lates` : isBelow ? `Below ${threshold}%` : 'Chronic Lates',
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  };

  // Report 3: Department Attendance Summary
  const handlePreviewDeptSummaryPdf = async (customMonth?: string, customDept?: string) => {
    const targetMonth = customMonth || selectedMonth;
    const targetDept = customDept || 'all';
    setIsExportingPdf(true);
    setGeneratingReportId('dept_summary');
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const targetSummary = monthlySummary.filter(r => targetDept === 'all' || r.department.toLowerCase() === targetDept.toLowerCase());
      const deptSummaries = buildDepartmentSummaries(targetSummary);
      const pdfBytes = await generateDepartmentAttendanceSummaryPdf(letterhead, targetMonth, deptSummaries);
      previewPdfBytes(pdfBytes, `Department_Attendance_Summary_${targetMonth}.pdf`);
    } catch (err) {
      console.error('Dept summary PDF preview failed:', err);
      alert('Failed to generate department summary PDF.');
    } finally {
      setIsExportingPdf(false);
      setGeneratingReportId(null);
    }
  };

  const handleDownloadDeptSummaryPdf = async (customMonth?: string, customDept?: string) => {
    const targetMonth = customMonth || selectedMonth;
    const targetDept = customDept || 'all';
    setIsExportingPdf(true);
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const targetSummary = monthlySummary.filter(r => targetDept === 'all' || r.department.toLowerCase() === targetDept.toLowerCase());
      const deptSummaries = buildDepartmentSummaries(targetSummary);
      const pdfBytes = await generateDepartmentAttendanceSummaryPdf(letterhead, targetMonth, deptSummaries);
      downloadPdfBytes(pdfBytes, `Department_Attendance_Summary_${targetMonth}.pdf`);
    } catch (err) {
      console.error('Dept summary download failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportDeptSummaryCsv = (customDept?: string) => {
    const targetDept = customDept || 'all';
    const targetSummary = monthlySummary.filter(r => targetDept === 'all' || r.department.toLowerCase() === targetDept.toLowerCase());
    
    const depts: Record<string, { totalStaff: number; present: number; late: number; halfDay: number; leaves: number; absent: number; totalMinutes: number; totalWorkingDays: number }> = {};
    for (const row of targetSummary) {
      const d = row.department || 'General';
      if (!depts[d]) {
        depts[d] = { totalStaff: 0, present: 0, late: 0, halfDay: 0, leaves: 0, absent: 0, totalMinutes: 0, totalWorkingDays: 0 };
      }
      depts[d].totalStaff += 1;
      depts[d].present += row.present_days;
      depts[d].late += row.late_days;
      depts[d].halfDay += row.half_days;
      depts[d].leaves += row.leave_days;
      depts[d].absent += row.absent_days;
      depts[d].totalMinutes += row.total_work_minutes;
      depts[d].totalWorkingDays += row.total_working_days;
    }

    const headers = ['#', 'Department', 'Total Faculty/Staff', 'Total Present Days', 'Total Late Days', 'Total Half Days', 'Total Approved Leaves', 'Total Unexcused Absents', 'Total Duty Hours', 'Average Attendance %'];
    const rows = Object.entries(depts).map(([deptName, d], i) => {
      const avgP = d.totalWorkingDays > 0 ? Math.round(((d.present + d.late + d.halfDay * 0.5) / d.totalWorkingDays) * 100) : 0;
      return [
        i + 1,
        deptName,
        d.totalStaff,
        d.present,
        d.late,
        d.halfDay,
        d.leaves,
        d.absent,
        Math.round(d.totalMinutes / 60),
        `${avgP}%`
      ];
    });
    downloadCsv(`Department_Attendance_Summary_${selectedMonth}`, headers, rows);
  };

  // Report 4: Defaulters & Chronic Lates Disciplinary Report
  const handlePreviewDefaultersPdf = async (customMonth?: string, threshold?: number) => {
    const targetMonth = customMonth || selectedMonth;
    const targetThreshold = threshold ?? 75;
    setIsExportingPdf(true);
    setGeneratingReportId('defaulters');
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const defaultersList = buildDefaultersList(monthlySummary, targetThreshold);
      const pdfBytes = await generateDefaultersReportPdf(letterhead, targetMonth, defaultersList);
      previewPdfBytes(pdfBytes, `Attendance_Defaulters_${targetMonth}.pdf`);
    } catch (err) {
      console.error('Defaulters PDF preview failed:', err);
      alert('Failed to generate defaulters report PDF.');
    } finally {
      setIsExportingPdf(false);
      setGeneratingReportId(null);
    }
  };

  const handleDownloadDefaultersPdf = async (customMonth?: string, threshold?: number) => {
    const targetMonth = customMonth || selectedMonth;
    const targetThreshold = threshold ?? 75;
    setIsExportingPdf(true);
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const defaultersList = buildDefaultersList(monthlySummary, targetThreshold);
      const pdfBytes = await generateDefaultersReportPdf(letterhead, targetMonth, defaultersList);
      downloadPdfBytes(pdfBytes, `Attendance_Defaulters_${targetMonth}.pdf`);
    } catch (err) {
      console.error('Defaulters download failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportDefaultersCsv = (threshold?: number) => {
    const t = threshold ?? 75;
    const defaulters = monthlySummary.filter(r => {
      const pct = calculateAttendancePct(r);
      return pct < t || r.late_days >= 3;
    });
    const headers = ['#', 'Code', 'Staff Member', 'Department', 'Working Days', 'Present', 'Late', 'Half Day', 'Leaves', 'Absent', 'Total Hours', 'Attendance %', 'Flagged Status'];
    const rows = defaulters.map((r, i) => {
      const pct = calculateAttendancePct(r);
      return [
        i + 1,
        r.employee_code,
        r.staff_name,
        r.department,
        r.total_working_days,
        r.present_days,
        r.late_days,
        r.half_days,
        r.leave_days,
        r.absent_days,
        Math.round(r.total_work_minutes / 60),
        `${pct}%`,
        pct < t ? `Below ${t}%` : 'Chronic Lates'
      ];
    });
    downloadCsv(`Attendance_Defaulters_${selectedMonth}`, headers, rows);
  };

  // Tab 5: Exceptions Desk Export Handlers
  const handlePreviewExceptionsPdf = async () => {
    setIsExportingPdf(true);
    setGeneratingReportId('exceptions_pdf');
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const stats = {
        total: exceptionRecords.length,
        present: 0,
        late: exceptionRecords.filter(r => r.status === 'late').length,
        half_day: exceptionRecords.filter(r => r.status === 'half_day').length,
        leave: exceptionRecords.filter(r => r.status === 'on_leave').length,
        absent: exceptionRecords.filter(r => r.status === 'absent').length,
      };
      const pdfBytes = await generateDailyMusterRollPdf(letterhead, selectedDate, exceptionRecords, stats);
      previewPdfBytes(pdfBytes, `Staff_Attendance_Exceptions_${selectedDate}.pdf`);
    } catch (err) {
      console.error('Exceptions PDF preview failed:', err);
      alert('Failed to generate exceptions PDF.');
    } finally {
      setIsExportingPdf(false);
      setGeneratingReportId(null);
    }
  };

  const handleExportExceptionsCsv = () => {
    const headers = ['#', 'Employee Code', 'Staff Name', 'Department', 'Designation', 'Status', 'Arrival Time', 'Departure Time', 'Duty Duration (Mins)', 'Notes'];
    const rows = exceptionRecords.map((r, i) => [
      i + 1,
      r.employee_code,
      r.staff_name,
      r.department,
      r.designation,
      (r.status || 'not_marked').toUpperCase(),
      formatIsoToTime(r.clock_in_time),
      formatIsoToTime(r.clock_out_time),
      r.work_duration_minutes ?? '',
      r.admin_adjustment_notes || ''
    ]);
    downloadCsv(`Attendance_Exceptions_${selectedDate}`, headers, rows);
  };

  // Report 5: Individual Staff Member Transcript Card
  const handlePreviewStaffCardPdf = async (
    staffId?: string,
    customMonth?: string,
    customRecords?: StaffAttendanceRecord[],
    customPeriodLabel?: string
  ) => {
    const targetStaffId = staffId || selectedStaffId;
    const targetStaff = dailyRoster.find(r => r.staff_id === targetStaffId) || dailyRoster[0];
    if (!targetStaff) {
      alert('Please select a staff member to generate their transcript card.');
      return;
    }
    const targetMonth = customMonth || selectedMonth;
    const periodLabel = customPeriodLabel || targetMonth;
    setIsExportingPdf(true);
    setGeneratingReportId('staff_card');
    try {
      let targetRecords = customRecords;
      if (!targetRecords) {
        targetRecords = staffPersonalRecords;
        if (token) {
          try {
            const res = await fetch('/api/v1/geofence/attendance/staff', {
              headers: { authorization: `Bearer ${token}` }
            });
            const body = await res.json();
            if (res.ok && body.success && Array.isArray(body.data)) {
              targetRecords = body.data.filter((r: StaffAttendanceRecord) =>
                (r.staff_id === targetStaff.staff_id || r.staff_id === targetStaff.employee_code) &&
                r.date.startsWith(targetMonth)
              );
            }
          } catch (err) {
            console.warn('Could not fetch custom staff records:', err);
          }
        }
      }

      const letterhead = await academyLetterheadFromAuth(tenant);
      const staffInfo = {
        full_name: targetStaff.staff_name,
        employee_code: targetStaff.employee_code,
        department: targetStaff.department,
        designation: targetStaff.designation
      };
      const pdfBytes = await generateIndividualStaffCardPdf(letterhead, staffInfo, periodLabel, targetRecords || []);
      previewPdfBytes(pdfBytes, `Staff_Card_${targetStaff.employee_code}_${targetMonth}.pdf`);
    } catch (err) {
      console.error('Staff card preview failed:', err);
      alert('Failed to generate staff card PDF.');
    } finally {
      setIsExportingPdf(false);
      setGeneratingReportId(null);
    }
  };

  const handleDownloadStaffCardPdf = async (
    staffId?: string,
    customMonth?: string,
    customRecords?: StaffAttendanceRecord[],
    customPeriodLabel?: string
  ) => {
    const targetStaffId = staffId || selectedStaffId;
    const targetStaff = dailyRoster.find(r => r.staff_id === targetStaffId) || dailyRoster[0];
    if (!targetStaff) return;
    const targetMonth = customMonth || selectedMonth;
    const periodLabel = customPeriodLabel || targetMonth;
    setIsExportingPdf(true);
    try {
      let targetRecords = customRecords;
      if (!targetRecords) {
        targetRecords = staffPersonalRecords;
        if (token) {
          try {
            const res = await fetch('/api/v1/geofence/attendance/staff', {
              headers: { authorization: `Bearer ${token}` }
            });
            const body = await res.json();
            if (res.ok && body.success && Array.isArray(body.data)) {
              targetRecords = body.data.filter((r: StaffAttendanceRecord) =>
                (r.staff_id === targetStaff.staff_id || r.staff_id === targetStaff.employee_code) &&
                r.date.startsWith(targetMonth)
              );
            }
          } catch (err) {
            console.warn('Could not fetch custom staff records:', err);
          }
        }
      }

      const letterhead = await academyLetterheadFromAuth(tenant);
      const staffInfo = {
        full_name: targetStaff.staff_name,
        employee_code: targetStaff.employee_code,
        department: targetStaff.department,
        designation: targetStaff.designation
      };
      const pdfBytes = await generateIndividualStaffCardPdf(letterhead, staffInfo, periodLabel, targetRecords || []);
      downloadPdfBytes(pdfBytes, `Staff_Card_${targetStaff.employee_code}_${targetMonth}.pdf`);
    } catch (err) {
      console.error('Staff card download failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Tab 4: Ledger CSV Export
  const handleExportLedgerCsv = () => {
    const headers = ['#', 'Date', 'Day', 'Status', 'Attendance Head', 'Arrival Time', 'Departure Time', 'Duration (Mins)', 'Adjusted By', 'Notes'];
    const rows = filteredStaffPersonalRecords.map((r, i) => [
      i + 1,
      r.date,
      new Date(r.date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short' }),
      (r.status || 'not_marked').toUpperCase(),
      r.head_name || '',
      formatIsoToTime(r.clock_in_time),
      formatIsoToTime(r.clock_out_time),
      r.work_duration_minutes ?? '',
      r.adjusted_by || '',
      r.admin_adjustment_notes || ''
    ]);
    downloadCsv(`Staff_Ledger_${selectedStaffMember?.employee_code || 'Staff'}_${selectedMonth}`, headers, rows);
  };

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (auditStaffFilter !== 'all' && log.staff_id !== auditStaffFilter) return false;
      if (auditSearchTerm.trim()) {
        const q = auditSearchTerm.toLowerCase();
        const matchesStaff = (log.staff_name || '').toLowerCase().includes(q);
        const matchesAdjuster = (log.adjusted_by || '').toLowerCase().includes(q);
        const matchesReason = (log.reason_head || '').toLowerCase().includes(q);
        const matchesDate = (log.date || '').includes(q);
        if (!matchesStaff && !matchesAdjuster && !matchesReason && !matchesDate) return false;
      }
      return true;
    });
  }, [auditLogs, auditStaffFilter, auditSearchTerm]);

  // Report 6: Attendance Regularization & Audit Log
  const handlePreviewAuditPdf = async (customMonth?: string) => {
    const targetMonth = customMonth || selectedMonth;
    setIsExportingPdf(true);
    setGeneratingReportId('audit_logs');
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const pdfBytes = await generateAttendanceAuditLogPdf(letterhead, targetMonth, filteredAuditLogs);
      previewPdfBytes(pdfBytes, `Staff_Attendance_Audit_Log_${targetMonth}.pdf`);
    } catch (err) {
      console.error('Audit log PDF preview failed:', err);
      alert('Failed to generate audit log PDF document.');
    } finally {
      setIsExportingPdf(false);
      setGeneratingReportId(null);
    }
  };

  const handleDownloadAuditPdf = async (customMonth?: string) => {
    const targetMonth = customMonth || selectedMonth;
    setIsExportingPdf(true);
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const pdfBytes = await generateAttendanceAuditLogPdf(letterhead, targetMonth, filteredAuditLogs);
      downloadPdfBytes(pdfBytes, `Staff_Attendance_Audit_Log_${targetMonth}.pdf`);
    } catch (err) {
      console.error('Audit log PDF download failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportAuditCsv = () => {
    const headers = ['#', 'Timestamp', 'Staff Name', 'Attendance Date', 'Action', 'Previous Status', 'New Status', 'Reason Head', 'Adjusted By'];
    const rows = filteredAuditLogs.map((log, i) => [
      i + 1,
      log.created_at,
      log.staff_name,
      log.date,
      log.action,
      log.previous_status || '—',
      log.new_status,
      log.reason_head,
      log.adjusted_by
    ]);
    downloadCsv(`Staff_Attendance_Audit_Log_${selectedMonth}`, headers, rows);
  };

  // =========================================================================
  // Multi-Criteria Filtered Roster & Summaries
  // =========================================================================

  const filteredDailyRoster = useMemo(() => {
    return dailyRoster.filter(r => {
      const matchesSearch =
        !searchTerm ||
        r.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employee_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = selectedDept === 'all' || r.department.toLowerCase() === selectedDept.toLowerCase();
      const matchesHead =
        selectedDailyHead === 'all' ||
        r.head_id === selectedDailyHead ||
        r.head_code === selectedDailyHead ||
        r.status === selectedDailyHead;
      return matchesSearch && matchesDept && matchesHead;
    });
  }, [dailyRoster, searchTerm, selectedDept, selectedDailyHead]);

  const filteredMonthlySummary = useMemo(() => {
    return monthlySummary.filter(r => {
      const matchesSearch =
        !searchTerm ||
        r.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employee_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = selectedDept === 'all' || r.department.toLowerCase() === selectedDept.toLowerCase();

      const pct = calculateAttendancePct(r);
      let matchesAttendanceRate = true;
      if (monthlyAttendanceFilter === 'below_75') {
        matchesAttendanceRate = pct < 75;
      } else if (monthlyAttendanceFilter === '75_90') {
        matchesAttendanceRate = pct >= 75 && pct <= 90;
      } else if (monthlyAttendanceFilter === 'above_90') {
        matchesAttendanceRate = pct > 90;
      }

      let matchesIrregularity = true;
      if (monthlyIrregularityFilter === 'has_lates') {
        matchesIrregularity = r.late_days > 0;
      } else if (monthlyIrregularityFilter === 'has_absents') {
        matchesIrregularity = r.absent_days > 0;
      }

      return matchesSearch && matchesDept && matchesAttendanceRate && matchesIrregularity;
    });
  }, [monthlySummary, searchTerm, selectedDept, monthlyAttendanceFilter, monthlyIrregularityFilter]);

  const filteredStaffPersonalRecords = useMemo(() => {
    return staffPersonalRecords.filter(rec => {
      if (ledgerStartDate && rec.date < ledgerStartDate) return false;
      if (ledgerEndDate && rec.date > ledgerEndDate) return false;
      if (ledgerStatusFilter !== 'all' && (rec.status || 'on_time') !== ledgerStatusFilter) return false;
      return true;
    });
  }, [staffPersonalRecords, ledgerStartDate, ledgerEndDate, ledgerStatusFilter]);

  // Daily Statistics Summary
  const rosterStats = useMemo(() => {
    const total = dailyRoster.length;
    const present = dailyRoster.filter(r => r.status === 'on_time').length;
    const late = dailyRoster.filter(r => r.status === 'late').length;
    const half_day = dailyRoster.filter(r => r.status === 'half_day').length;
    const leave = dailyRoster.filter(r => r.status === 'on_leave').length;
    const absent = dailyRoster.filter(r => r.status === 'absent').length;
    const not_marked = dailyRoster.filter(r => r.status === 'not_marked').length;
    return { total, present, late, half_day, leave, absent, not_marked };
  }, [dailyRoster]);

  // Exceptions List
  const exceptionRecords = useMemo(() => {
    return dailyRoster.filter(r => {
      const isException = ['late', 'half_day', 'absent', 'on_leave'].includes(r.status);
      if (!isException) return false;
      const matchesSearch =
        !searchTerm ||
        r.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employee_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = selectedDept === 'all' || r.department.toLowerCase() === selectedDept.toLowerCase();
      const matchesType = exceptionTypeFilter === 'all' || r.status === exceptionTypeFilter;
      return matchesSearch && matchesDept && matchesType;
    });
  }, [dailyRoster, searchTerm, selectedDept, exceptionTypeFilter]);

  // Selected Staff Member Object
  const selectedStaffMember = useMemo(() => {
    return dailyRoster.find(r => r.staff_id === selectedStaffId) || null;
  }, [dailyRoster, selectedStaffId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-slate-700" />
        <span className="text-sm font-medium">Loading staff attendance...</span>
      </div>
    );
  }

  // =========================================================================
  // VIEW: FACULTY / TEACHER PERSONAL DESK (Non-Admin View)
  // =========================================================================
  if (!isAdmin) {
    const isWithinPerimeter =
      personalDistanceMeters !== null &&
      geofenceConfig &&
      personalDistanceMeters <= geofenceConfig.radius_meters;

    return (
      <div className="space-y-6">
        <PageHeading
          title="Staff Attendance"
          description="GPS geofence check-in and personal attendance history."
        />

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Campus Geofence</span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                Campus Location Verification
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Allowed Radius: {geofenceConfig?.radius_meters || 150}m
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                isWithinPerimeter
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                <ShieldCheck className="w-4 h-4" />
                {isWithinPerimeter ? 'Within Campus Perimeter' : 'Outside Campus Perimeter'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Distance to Campus</span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                {personalDistanceMeters !== null ? `${personalDistanceMeters}m` : '—'}
              </span>
              <span className="text-[11px] text-slate-500">
                Center Radius: {geofenceConfig?.radius_meters || 150}m
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Arrival Status</span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                {formatIsoToTime(personalClockInRecord?.clock_in_time)}
              </span>
              <span className="text-[11px] text-slate-500">
                {personalClockInRecord?.head_name
                  ? `${personalClockInRecord.head_name} (${personalClockInRecord.head_code})`
                  : personalClockInRecord?.status === 'late'
                  ? 'Late Arrival'
                  : personalClockInRecord?.status === 'on_time'
                  ? 'Present'
                  : 'Not Clocked In'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Duty Duration</span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                {formatMinutesToHours(personalClockInRecord?.work_duration_minutes)}
              </span>
              <span className="text-[11px] text-slate-500">
                Departure: {formatIsoToTime(personalClockInRecord?.clock_out_time)}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {!personalClockInRecord?.clock_in_time ? (
              <button
                type="button"
                onClick={() => handlePersonalAction('in')}
                disabled={isPersonalClocking || isLocatingSelf}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                {isPersonalClocking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Clock In
              </button>
            ) : !personalClockInRecord?.clock_out_time ? (
              <button
                type="button"
                onClick={() => handlePersonalAction('out')}
                disabled={isPersonalClocking || isLocatingSelf}
                className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                {isPersonalClocking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Clock Out {personalClockInRecord.sessions && personalClockInRecord.sessions.length > 1 ? `(Session ${personalClockInRecord.sessions.length})` : ''}
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Shift recorded for today ({todayStr})
                </div>
                <button
                  type="button"
                  onClick={() => handlePersonalAction('in')}
                  disabled={isPersonalClocking || isLocatingSelf}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Clock in for evening batch or additional session"
                >
                  {isPersonalClocking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                  Clock In Next Session
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={locateSelf}
              disabled={isLocatingSelf}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLocatingSelf ? 'animate-spin' : ''}`} />
              Recalibrate GPS
            </button>

            <button
              type="button"
              onClick={() => {
                setRegDate(todayStr);
                setRegClockIn(personalClockInRecord?.clock_in_time ? isoToInputTime(personalClockInRecord.clock_in_time) : '');
                setRegClockOut(personalClockInRecord?.clock_out_time ? isoToInputTime(personalClockInRecord.clock_out_time) : '');
                setRegFeedback(null);
                setIsRegModalOpen(true);
              }}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Request Regularization
            </button>
          </div>

          {/* Sessions Chip Strip */}
          {personalClockInRecord?.sessions && personalClockInRecord.sessions.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Shift Sessions</span>
              <div className="flex flex-wrap gap-2">
                {(personalClockInRecord.sessions || []).map((sess: StaffAttendanceSession, idx: number) => (
                  <div key={idx} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono">
                    <strong className="text-slate-900 mr-1.5">Session {idx + 1}:</strong>
                    <span>{formatIsoToTime(sess.in)} → {sess.out ? formatIsoToTime(sess.out) : 'In Progress'}</span>
                    {sess.duration_minutes ? <span className="text-slate-500 ml-1.5">({Math.floor(sess.duration_minutes / 60)}h {sess.duration_minutes % 60}m)</span> : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {personalFeedback && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              personalFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {personalFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{personalFeedback.message}</span>
            </div>
          )}
        </div>

        {/* Regularization Requests Submitted by Faculty Member */}
        {regularizationRequests.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                My Regularization Requests
              </h3>
              <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
                {regularizationRequests.length} Requests
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Reason Type</th>
                    <th className="py-2.5 px-3">Requested Timings</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {regularizationRequests.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{req.date}</td>
                      <td className="py-2.5 px-3">{req.reason_type}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {req.clock_in_time ? formatIsoToTime(req.clock_in_time) : '—'} → {req.clock_out_time ? formatIsoToTime(req.clock_out_time) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">{req.notes || '—'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : req.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {req.status === 'pending' ? 'PENDING APPROVAL' : req.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Faculty Personal Monthly Attendance Register & Transcript */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Official Attendance Record</span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                My Attendance Statement & Monthly Transcript
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="month"
                value={facultySelectedMonth}
                onChange={e => setFacultySelectedMonth(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none cursor-pointer"
              />
              <button
                type="button"
                disabled={isExportingPdf}
                onClick={() => handlePreviewStaffCardPdf(user?.id, facultySelectedMonth, facultyMonthlyRecords, facultySelectedMonth)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Download Transcript Card (PDF)
              </button>
            </div>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Working Days</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{facultyMonthlyStats.totalWorking}</span>
              <span className="text-[10px] text-slate-500">Period: {facultySelectedMonth}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Present Equivalent</span>
              <span className="text-xl font-bold font-mono text-emerald-700 mt-0.5 block">
                {facultyMonthlyStats.present + facultyMonthlyStats.late + facultyMonthlyStats.halfDay * 0.5}
              </span>
              <span className="text-[10px] text-slate-500">{facultyMonthlyStats.present} On-time · {facultyMonthlyStats.late} Late</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Sanctioned Leaves</span>
              <span className="text-xl font-bold font-mono text-slate-700 mt-0.5 block">{facultyMonthlyStats.leave}</span>
              <span className="text-[10px] text-slate-500">Approved Off-Campus</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Attendance Rate</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{facultyMonthlyStats.pct}%</span>
              <span className="text-[10px] text-slate-500">Punctuality Score</span>
            </div>
          </div>

          {/* High-density Monthly Punch Register */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Day</th>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3">Arrival</th>
                  <th className="py-2.5 px-3">Departure</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {loadingFacultyRecords ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-mono">
                      Loading monthly attendance register...
                    </td>
                  </tr>
                ) : facultyMonthlyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-mono">
                      No attendance records found for {facultySelectedMonth}.
                    </td>
                  </tr>
                ) : (
                  facultyMonthlyRecords.map((rec, i) => (
                    <tr key={rec.id || i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{i + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{rec.date}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-medium">
                        {new Date(rec.date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short' })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rec.status === 'on_time'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : rec.status === 'late' || rec.status === 'half_day'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {rec.head_name || (rec.status || 'PRESENT').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {formatIsoToTime(rec.clock_in_time)}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {formatIsoToTime(rec.clock_out_time)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {formatMinutesToHours(rec.work_duration_minutes)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {rec.admin_adjustment_notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regularization Request Modal */}
        {isRegModalOpen && createPortal(
          <div className="fixed inset-0 w-screen h-screen z-[9999] bg-slate-900/60 backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 m-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Administrative Request</span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    Request Attendance Regularization
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRegModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitRegularization} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Date</label>
                  <input
                    type="date"
                    value={regDate}
                    onChange={e => setRegDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Reason Category</label>
                  <select
                    value={regReasonType}
                    onChange={e => setRegReasonType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none cursor-pointer"
                  >
                    <option value="Official Academy Duty">Official Academy Duty (Off-Campus Assignment)</option>
                    <option value="Field Assignment / External Lecture">Field Assignment / External Lecture</option>
                    <option value="Hardware / GPS Failure">Hardware / GPS Failure</option>
                    <option value="Missed Punch">Missed Punch (Forgot to Clock In / Out)</option>
                    <option value="Medical / Personal Emergency">Medical / Personal Emergency</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Arrival Time</label>
                      {regClockIn && (
                        <button
                          type="button"
                          onClick={() => setRegClockIn('')}
                          className="text-[10px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="time"
                      value={regClockIn}
                      onChange={e => setRegClockIn(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Departure Time</label>
                      {regClockOut && (
                        <button
                          type="button"
                          onClick={() => setRegClockOut('')}
                          className="text-[10px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="time"
                      value={regClockOut}
                      onChange={e => setRegClockOut(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Justification / Explanation</label>
                  <textarea
                    rows={2}
                    value={regNotes}
                    onChange={e => setRegNotes(e.target.value)}
                    placeholder="Provide details regarding the reason for regularization..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none"
                    required
                  />
                </div>

                {regFeedback && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    regFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {regFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    )}
                    <span>{regFeedback.message}</span>
                  </div>
                )}

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRegModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReg}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    {isSubmittingReg ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: ACADEMY ADMINISTRATOR DESK
  // =========================================================================

  return (
    <div className="space-y-6">
      <PageHeading
        title="Staff Attendance"
        description="Daily attendance tracking, monthly summary reports, exceptions, audit logs, and attendance head rules."
      />

      {/* Tab Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'daily'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Daily Attendance
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('monthly')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'monthly'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Monthly Summary
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'reports'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            Reports Catalog
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ledger'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Staff Ledger
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exceptions')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'exceptions'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Exceptions ({exceptionRecords.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit_logs')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audit_logs'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Audit Log ({auditLogs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Attendance Heads & Settings
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            title="Refresh Attendance Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: DAILY ATTENDANCE                                             */}
      {/* =================================================================== */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDateStep(-1)}
                className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <CalendarDays className="w-4 h-4 text-slate-700" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => handleDateStep(1)}
                className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {!isSelectedDateToday && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Today
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff or code..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none w-44"
                />
              </div>

              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                {departmentOptions.map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>

              <select
                value={selectedDailyHead}
                onChange={e => setSelectedDailyHead(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Heads</option>
                {activeHeads.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handlePreviewDailyPdf()}
                disabled={isExportingPdf}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Preview Official PDF Document in New Tab"
              >
                {isExportingPdf && generatingReportId === 'daily_muster_roll' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                Official PDF
              </button>

              <button
                type="button"
                onClick={handleExportDailyCsv}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Export CSV"
              >
                <FileText className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
          </div>

          {/* Statistics Strip with interactive quick filter toggles */}
          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5">
            <button
              type="button"
              onClick={() => setSelectedDailyHead('all')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedDailyHead === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${selectedDailyHead === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>Total Staff</span>
              <span className="text-lg font-bold font-mono mt-0.5 block">{rosterStats.total}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDailyHead('on_time')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedDailyHead === 'on_time'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-emerald-200 text-slate-900'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${selectedDailyHead === 'on_time' ? 'text-emerald-100' : 'text-emerald-600'}`}>Present</span>
              <span className={`text-lg font-bold font-mono mt-0.5 block ${selectedDailyHead === 'on_time' ? 'text-white' : 'text-emerald-700'}`}>{rosterStats.present}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDailyHead('late')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedDailyHead === 'late'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-amber-200 text-slate-900'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${selectedDailyHead === 'late' ? 'text-amber-100' : 'text-amber-600'}`}>Late</span>
              <span className={`text-lg font-bold font-mono mt-0.5 block ${selectedDailyHead === 'late' ? 'text-white' : 'text-amber-700'}`}>{rosterStats.late}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDailyHead('half_day')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedDailyHead === 'half_day'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-amber-200 text-slate-900'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${selectedDailyHead === 'half_day' ? 'text-amber-100' : 'text-amber-600'}`}>Half Day</span>
              <span className={`text-lg font-bold font-mono mt-0.5 block ${selectedDailyHead === 'half_day' ? 'text-white' : 'text-amber-700'}`}>{rosterStats.half_day}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDailyHead('on_leave')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedDailyHead === 'on_leave'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${selectedDailyHead === 'on_leave' ? 'text-slate-300' : 'text-slate-500'}`}>Leave</span>
              <span className={`text-lg font-bold font-mono mt-0.5 block ${selectedDailyHead === 'on_leave' ? 'text-white' : 'text-slate-700'}`}>{rosterStats.leave}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDailyHead('absent')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedDailyHead === 'absent'
                  ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-rose-200 text-slate-900'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${selectedDailyHead === 'absent' ? 'text-rose-100' : 'text-rose-600'}`}>Absent</span>
              <span className={`text-lg font-bold font-mono mt-0.5 block ${selectedDailyHead === 'absent' ? 'text-white' : 'text-rose-700'}`}>{rosterStats.absent}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDailyHead('not_marked')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedDailyHead === 'not_marked'
                  ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${selectedDailyHead === 'not_marked' ? 'text-slate-300' : 'text-slate-400'}`}>Unmarked</span>
              <span className={`text-lg font-bold font-mono mt-0.5 block ${selectedDailyHead === 'not_marked' ? 'text-white' : 'text-slate-500'}`}>{rosterStats.not_marked}</span>
            </button>
          </div>

          {/* Daily Roster Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Code</th>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Arrival</th>
                    <th className="py-3 px-3">Departure</th>
                    <th className="py-3 px-3">Duty Hours</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {filteredDailyRoster.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-mono">
                        No staff attendance records found for {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    filteredDailyRoster.map((entry, idx) => (
                      <tr key={entry.staff_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 text-[11px]">
                          {entry.employee_code}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{entry.staff_name}</span>
                          <span className="text-[10px] text-slate-400 block">{entry.designation}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                            {entry.department}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {formatIsoToTime(entry.clock_in_time)}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {formatIsoToTime(entry.clock_out_time)}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {formatMinutesToHours(entry.work_duration_minutes)}
                        </td>
                        <td className="py-3 px-3">
                          {entry.status === 'on_time' ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                              {entry.head_code ? `PRESENT (${entry.head_code})` : 'PRESENT'}
                            </span>
                          ) : entry.status === 'late' ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                              {entry.head_code ? `LATE (${entry.head_code})` : 'LATE'}
                            </span>
                          ) : entry.status === 'half_day' ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                              {entry.head_code ? `HALF DAY (${entry.head_code})` : 'HALF DAY'}
                            </span>
                          ) : entry.status === 'on_leave' ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                              {entry.head_code ? `LEAVE (${entry.head_code})` : 'ON LEAVE'}
                            </span>
                          ) : entry.status === 'absent' ? (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                              {entry.head_code ? `ABSENT (${entry.head_code})` : 'ABSENT'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-200 rounded-md font-bold text-[10px]">
                              NOT MARKED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEditModal(entry)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 border border-slate-200 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Native Staff Daily Cards (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredDailyRoster.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-mono text-xs">
                  No staff attendance records found for {selectedDate}.
                </div>
              ) : (
                filteredDailyRoster.map(entry => (
                  <div key={entry.staff_id} className="p-3.5 space-y-2.5 active:bg-slate-50 transition-colors">
                    {/* Top: Code + Name + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {entry.employee_code}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm">{entry.staff_name}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {entry.designation} • <span className="font-semibold text-slate-700">{entry.department}</span>
                        </p>
                      </div>

                      <div>
                        {entry.status === 'on_time' ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                            {entry.head_code ? `PRESENT (${entry.head_code})` : 'PRESENT'}
                          </span>
                        ) : entry.status === 'late' ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                            {entry.head_code ? `LATE (${entry.head_code})` : 'LATE'}
                          </span>
                        ) : entry.status === 'half_day' ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                            {entry.head_code ? `HALF DAY (${entry.head_code})` : 'HALF DAY'}
                          </span>
                        ) : entry.status === 'on_leave' ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                            {entry.head_code ? `LEAVE (${entry.head_code})` : 'ON LEAVE'}
                          </span>
                        ) : entry.status === 'absent' ? (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                            {entry.head_code ? `ABSENT (${entry.head_code})` : 'ABSENT'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-200 rounded-md font-bold text-[10px]">
                            NOT MARKED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Duty Timings Strip */}
                    <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100 text-center font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Arrival</span>
                        <span className="text-xs font-bold text-slate-800">{formatIsoToTime(entry.clock_in_time)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Departure</span>
                        <span className="text-xs font-bold text-slate-800">{formatIsoToTime(entry.clock_out_time)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Duration</span>
                        <span className="text-xs font-bold text-slate-800">{formatMinutesToHours(entry.work_duration_minutes)}</span>
                      </div>
                    </div>

                    {/* Regularize / Edit Action */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(entry)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                        <span>Regularize / Edit</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: MONTHLY SUMMARY                                              */}
      {/* =================================================================== */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">Month:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer"
                />
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff or code..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none w-44"
                />
              </div>

              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                {departmentOptions.map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>

              <select
                value={monthlyAttendanceFilter}
                onChange={e => setMonthlyAttendanceFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Attendance Rates</option>
                <option value="below_75">Defaulters (&lt; 75%)</option>
                <option value="75_90">Satisfactory (75% - 90%)</option>
                <option value="above_90">Exemplary (&gt; 90%)</option>
              </select>

              <select
                value={monthlyIrregularityFilter}
                onChange={e => setMonthlyIrregularityFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Irregularity Flags</option>
                <option value="has_lates">Has Late Arrivals</option>
                <option value="has_absents">Has Unexcused Absences</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePreviewMonthlyPdf()}
                disabled={isExportingPdf}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Preview Official PDF Document in New Tab"
              >
                {isExportingPdf && generatingReportId === 'monthly_register' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                Official Monthly PDF
              </button>

              <button
                type="button"
                onClick={handleExportMonthlyCsv}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Code</th>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3 text-center">Working Days</th>
                    <th className="py-3 px-3 text-center">Present</th>
                    <th className="py-3 px-3 text-center">Late</th>
                    <th className="py-3 px-3 text-center">Half Day</th>
                    <th className="py-3 px-3 text-center">Leaves</th>
                    <th className="py-3 px-3 text-center">Absent</th>
                    <th className="py-3 px-3 text-right">Total Hours</th>
                    <th className="py-3 px-4 text-right">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {filteredMonthlySummary.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-400 font-mono">
                        No monthly records found for {selectedMonth}.
                      </td>
                    </tr>
                  ) : (
                    filteredMonthlySummary.map((r, idx) => {
                      const totalHours = Math.round((r.total_work_minutes || 0) / 60);
                      const pct = calculateAttendancePct(r);
                      return (
                        <tr key={r.staff_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 text-[11px]">
                            {r.employee_code}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {r.staff_name}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                              {r.department}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                            {r.total_working_days}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                            {r.present_days}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-amber-700">
                            {r.late_days}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-amber-700">
                            {r.half_days}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                            {r.leave_days}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-rose-700">
                            {r.absent_days}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            {totalHours}h
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            <span className={`px-2 py-0.5 rounded ${
                              pct >= 90 ? 'bg-emerald-50 text-emerald-700' : pct >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB: REPORTS CATALOG HUB                                            */}
      {/* =================================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reports</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Staff Attendance Reports
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download or preview official PDF documents and export CSV records for school records and payroll.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700">
                  6 Formats Available
                </span>
              </div>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5">
              {/* Report 1: Daily Muster Roll */}
              <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl">
                      <CalendarDays className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded">
                      Daily Register
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Daily Staff Attendance Register (Muster Roll)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Official day-by-day institutional register capturing punch-in/out timestamps, attendance heads, and signature sections.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-200/80">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
                      <input
                        type="date"
                        value={reportDailyDate}
                        onChange={e => setReportDailyDate(e.target.value)}
                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-slate-800 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Department</label>
                      <select
                        value={reportDailyDept}
                        onChange={e => setReportDailyDept(e.target.value)}
                        className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-slate-800 cursor-pointer"
                      >
                        {departmentOptions.map(d => (
                          <option key={d.id} value={d.id}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handlePreviewDailyPdf(reportDailyDate, reportDailyDept)}
                      className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isExportingPdf && generatingReportId === 'daily_muster_roll' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      Preview PDF
                    </button>
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handleDownloadDailyPdf(reportDailyDate, reportDailyDept)}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Download PDF File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleExportDailyCsv}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Export CSV Data"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Report 2: Monthly Attendance Summary */}
              <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl">
                      <FileSpreadsheet className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded">
                      Monthly Register
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Monthly Attendance & Payroll Register
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Month-end roll with working days, on-time arrivals, lates, half-days, approved leaves, unexcused absents, total duty hours, and percentage.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-200/80">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Month</label>
                      <input
                        type="month"
                        value={reportMonthlyMonth}
                        onChange={e => setReportMonthlyMonth(e.target.value)}
                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-slate-800 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Department</label>
                      <select
                        value={reportMonthlyDept}
                        onChange={e => setReportMonthlyDept(e.target.value)}
                        className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-slate-800 cursor-pointer"
                      >
                        {departmentOptions.map(d => (
                          <option key={d.id} value={d.id}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handlePreviewMonthlyPdf(reportMonthlyMonth, reportMonthlyDept)}
                      className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isExportingPdf && generatingReportId === 'monthly_register' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      Preview PDF
                    </button>
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handleDownloadMonthlyPdf(reportMonthlyMonth, reportMonthlyDept)}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Download PDF File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleExportMonthlyCsv}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Export CSV Data"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Report 3: Department Attendance Summary */}
              <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl">
                      <Building2 className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded">
                      Department Summary
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Department Attendance & Punctuality Summary
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Aggregated staff metrics grouped by academic and administrative departments with average punctuality and duty hours.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-200/80">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Month</label>
                      <input
                        type="month"
                        value={reportDeptMonth}
                        onChange={e => setReportDeptMonth(e.target.value)}
                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-slate-800 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Scope</label>
                      <div className="text-xs font-semibold py-1.5 px-2.5 bg-white border border-slate-200 rounded-xl text-slate-700">
                        All Configured Departments
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handlePreviewDeptSummaryPdf(reportDeptMonth)}
                      className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isExportingPdf && generatingReportId === 'dept_summary' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      Preview PDF
                    </button>
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handleDownloadDeptSummaryPdf(reportDeptMonth)}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Download PDF File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportDeptSummaryCsv()}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Export CSV Data"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Report 4: Defaulters & Chronic Lates */}
              <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded">
                      Defaulters & Lates
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Defaulters & Chronic Lates Disciplinary Report
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Identifies staff below institutional threshold (&lt; 75%) or exhibiting repeated late arrivals for administrative notices.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-200/80">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Month</label>
                      <input
                        type="month"
                        value={reportMonthlyMonth}
                        onChange={e => setReportMonthlyMonth(e.target.value)}
                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-slate-800 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Threshold (%)</label>
                      <input
                        type="number"
                        min={50}
                        max={95}
                        value={reportDefaultersThreshold}
                        onChange={e => setReportDefaultersThreshold(parseInt(e.target.value, 10) || 75)}
                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-slate-800 cursor-pointer font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handlePreviewDefaultersPdf(reportMonthlyMonth, reportDefaultersThreshold)}
                      className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isExportingPdf && generatingReportId === 'defaulters' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      Preview PDF
                    </button>
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handleDownloadDefaultersPdf(reportMonthlyMonth, reportDefaultersThreshold)}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Download PDF File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportDefaultersCsv(reportDefaultersThreshold)}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Export CSV Data"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Report 5: Individual Staff Member Transcript Card */}
              <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded">
                      Staff Card
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Individual Staff Attendance Transcript Card
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Personal monthly attendance transcript with day-by-day logs and official signature lines for Employee, HOD, and Principal.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-200/80">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Staff Member</label>
                      <select
                        value={reportStaffMemberId || selectedStaffId}
                        onChange={e => setReportStaffMemberId(e.target.value)}
                        className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-slate-800 cursor-pointer"
                      >
                        {dailyRoster.map(r => (
                          <option key={r.staff_id} value={r.staff_id}>
                            {r.staff_name} ({r.employee_code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Month</label>
                      <input
                        type="month"
                        value={reportStaffMonth}
                        onChange={e => setReportStaffMonth(e.target.value)}
                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-slate-800 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handlePreviewStaffCardPdf(reportStaffMemberId || selectedStaffId, reportStaffMonth)}
                      className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isExportingPdf && generatingReportId === 'staff_card' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      Preview Card PDF
                    </button>
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handleDownloadStaffCardPdf(reportStaffMemberId || selectedStaffId, reportStaffMonth)}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Download PDF File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Report 6: Attendance Audit Log */}
              <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded">
                      Audit Trail
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Attendance Regularization & Audit Trail
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Audit report tracking all administrative status overrides, previous vs new statuses, reason heads, and operator timestamps.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-200/80">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Month</label>
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-slate-800 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Log Count</label>
                      <div className="text-xs font-mono font-bold py-1.5 px-2.5 bg-white border border-slate-200 rounded-xl text-slate-700">
                        {auditLogs.length} Events
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handlePreviewAuditPdf(selectedMonth)}
                      className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isExportingPdf && generatingReportId === 'audit_logs' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      Preview PDF
                    </button>
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handleDownloadAuditPdf(selectedMonth)}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Download PDF File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleExportAuditCsv}
                      className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                      title="Export CSV Data"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: STAFF LEDGER                                                 */}
      {/* =================================================================== */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Multi-Criteria Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700">Staff Member:</label>
                  <select
                    value={selectedStaffId}
                    onChange={e => setSelectedStaffId(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer min-w-[220px]"
                  >
                    {dailyRoster.map(r => (
                      <option key={r.staff_id} value={r.staff_id}>
                        {r.staff_name} ({r.employee_code} · {r.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500">From:</span>
                  <input
                    type="date"
                    value={ledgerStartDate}
                    onChange={e => setLedgerStartDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-900 outline-none cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-500">To:</span>
                  <input
                    type="date"
                    value={ledgerEndDate}
                    onChange={e => setLedgerEndDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-900 outline-none cursor-pointer"
                  />
                  {(ledgerStartDate || ledgerEndDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerStartDate('');
                        setLedgerEndDate('');
                      }}
                      className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700">Status:</label>
                  <select
                    value={ledgerStatusFilter}
                    onChange={e => setLedgerStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none cursor-pointer"
                  >
                    <option value="all">All Classifications</option>
                    <option value="on_time">Present (On-Time)</option>
                    <option value="late">Late Arrival</option>
                    <option value="half_day">Half Day</option>
                    <option value="on_leave">Sanctioned Leave</option>
                    <option value="absent">Unexcused Absent</option>
                  </select>
                </div>
              </div>

              {/* Action / PDF Export */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isExportingPdf || !selectedStaffId}
                  onClick={() => {
                    const customLabel = ledgerStartDate && ledgerEndDate
                      ? `${ledgerStartDate} to ${ledgerEndDate}`
                      : (ledgerStartDate || ledgerEndDate || selectedMonth);
                    handlePreviewStaffCardPdf(selectedStaffId, selectedMonth, filteredStaffPersonalRecords, customLabel);
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Staff Attendance Card (PDF)
                </button>
                <button
                  type="button"
                  disabled={isExportingPdf || !selectedStaffId}
                  onClick={() => {
                    const customLabel = ledgerStartDate && ledgerEndDate
                      ? `${ledgerStartDate} to ${ledgerEndDate}`
                      : (ledgerStartDate || ledgerEndDate || selectedMonth);
                    handleDownloadStaffCardPdf(selectedStaffId, selectedMonth, filteredStaffPersonalRecords, customLabel);
                  }}
                  className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                  title="Download PDF File"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleExportLedgerCsv}
                  className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                  title="Export Ledger CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {selectedStaffMember && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-mono">
                <div>
                  Employee Code: <strong className="text-slate-900">{selectedStaffMember.employee_code}</strong> | Designation: <strong className="text-slate-900">{selectedStaffMember.designation}</strong> | Department: <strong className="text-slate-900">{selectedStaffMember.department}</strong>
                </div>
                <div>
                  Showing <strong className="text-slate-900">{filteredStaffPersonalRecords.length}</strong> of {staffPersonalRecords.length} records
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Attendance Statement for {selectedStaffMember?.staff_name || 'Staff Member'}
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {filteredStaffPersonalRecords.length} Records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Arrival</th>
                    <th className="py-3 px-3">Departure</th>
                    <th className="py-3 px-3">Hours Worked</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4">Administrative Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {loadingPersonalHistory ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                        Loading personal history...
                      </td>
                    </tr>
                  ) : filteredStaffPersonalRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-mono">
                        No recorded attendance logs match current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStaffPersonalRecords.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{r.date}</td>
                        <td className="py-3 px-3 font-mono">{formatIsoToTime(r.clock_in_time)}</td>
                        <td className="py-3 px-3 font-mono">{formatIsoToTime(r.clock_out_time)}</td>
                        <td className="py-3 px-3 font-mono">{formatMinutesToHours(r.work_duration_minutes)}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'on_time'
                              ? 'bg-emerald-50 text-emerald-700'
                              : r.status === 'late' || r.status === 'half_day'
                              ? 'bg-amber-50 text-amber-700'
                              : r.status === 'on_leave'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {(r.head_name || r.status || 'PRESENT').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {r.admin_adjustment_notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: EXCEPTIONS                                                   */}
      {/* =================================================================== */}
      {activeTab === 'exceptions' && (
        <div className="space-y-4">
          {/* Pending Regularization Requests Queue */}
          {regularizationRequests.filter(r => r.status === 'pending').length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                      Pending Regularization Requests ({regularizationRequests.filter(r => r.status === 'pending').length})
                    </h4>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Faculty members requesting administrative attendance override for off-campus duty or exceptions.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-amber-200/80 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-amber-50/50 border-b border-amber-200/60 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3">Reason Type</th>
                      <th className="py-2.5 px-3">Requested Timings</th>
                      <th className="py-2.5 px-3">Justification Notes</th>
                      <th className="py-2.5 px-3 text-right">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                    {regularizationRequests
                      .filter(r => r.status === 'pending')
                      .map(req => (
                        <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{req.date}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block">{req.staff_name}</span>
                            <span className="text-[10px] text-slate-500">{req.employee_code || ''} · {req.department || ''}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 rounded font-semibold text-[11px]">
                              {req.reason_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {req.clock_in_time ? formatIsoToTime(req.clock_in_time) : '—'} → {req.clock_out_time ? formatIsoToTime(req.clock_out_time) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600">
                            {req.notes || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1.5">
                            <button
                              type="button"
                              disabled={isReviewingRegId === req.id}
                              onClick={() => handleReviewRegularization(req.id, 'approved')}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={isReviewingRegId === req.id}
                              onClick={() => handleReviewRegularization(req.id, 'rejected')}
                              className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Exceptions Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Date Stepper */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => handleDateStep(-1)}
                    className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-600 transition-colors cursor-pointer"
                    title="Previous Day"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs font-mono font-bold text-slate-900 px-1 py-0.5 outline-none cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => handleDateStep(1)}
                    className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-600 transition-colors cursor-pointer"
                    title="Next Day"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Today
                </button>

                {/* Department Filter */}
                <select
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none cursor-pointer"
                >
                  {departmentOptions.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.label}</option>
                  ))}
                </select>

                {/* Exception Type Filter */}
                <select
                  value={exceptionTypeFilter}
                  onChange={e => setExceptionTypeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none cursor-pointer"
                >
                  <option value="all">All Exception Types</option>
                  <option value="late">Late Arrival</option>
                  <option value="half_day">Half Day</option>
                  <option value="on_leave">Sanctioned Leave</option>
                  <option value="absent">Unexcused Absent</option>
                </select>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search exceptions..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none w-48"
                  />
                </div>
              </div>

              {/* PDF & Download Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={handlePreviewExceptionsPdf}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Exceptions Roster (PDF)
                </button>
                <button
                  type="button"
                  onClick={handleExportExceptionsCsv}
                  className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                  title="Export Exceptions CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Staff members requiring administrative review: late arrivals, half days, absences, and leaves.</span>
              <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 border border-amber-200 rounded-lg">
                {exceptionRecords.length} Exceptions Found
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Arrival Time</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {exceptionRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-mono">
                      No attendance exceptions found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  exceptionRecords.map((r, i) => (
                    <tr key={r.staff_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{i + 1}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 text-[11px]">{r.employee_code}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{r.staff_name}</td>
                      <td className="py-3 px-3 text-slate-500">{r.department}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.status === 'late' || r.status === 'half_day' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {(r.status || 'not_marked').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {formatIsoToTime(r.clock_in_time)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {r.admin_adjustment_notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(r)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 border border-slate-200 rounded-lg transition-all cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: AUDIT LOG                                                    */}
      {/* =================================================================== */}
      {activeTab === 'audit_logs' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Attendance Audit Log
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chronological record of all administrative attendance updates and manual edits.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePreviewAuditPdf(selectedMonth)}
                disabled={isExportingPdf}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isExportingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Audit PDF
              </button>

              <button
                type="button"
                onClick={handleExportAuditCsv}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Audit CSV
              </button>
            </div>

            {/* Filter Bar */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs w-full">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search staff, operator, reason..."
                    value={auditSearchTerm}
                    onChange={e => setAuditSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none w-56"
                  />
                </div>

                {/* Staff Member Filter */}
                <select
                  value={auditStaffFilter}
                  onChange={e => setAuditStaffFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none cursor-pointer"
                >
                  <option value="all">All Staff Members</option>
                  {dailyRoster.map(s => (
                    <option key={s.staff_id} value={s.staff_id}>
                      {s.staff_name} ({s.employee_code})
                    </option>
                  ))}
                </select>

                {(auditSearchTerm || auditStaffFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuditSearchTerm('');
                      setAuditStaffFilter('all');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer px-2"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="text-xs font-mono text-slate-500">
                Showing <span className="font-bold text-slate-900">{filteredAuditLogs.length}</span> of {auditLogs.length} Events
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-3">Target Date</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Transition</th>
                  <th className="py-3 px-4">Reason Head & Note</th>
                  <th className="py-3 px-3">Adjusted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-mono">
                      No administrative modifications recorded matching current filter.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log, i) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{i + 1}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{log.staff_name}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{log.date}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono uppercase font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <span className="text-slate-400">{log.previous_status || 'NONE'}</span>
                        <span className="mx-1 text-slate-300">→</span>
                        <span className="font-bold text-slate-900">{log.new_status}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {log.reason_head}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        {log.adjusted_by}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: ATTENDANCE HEADS & SETTINGS                                  */}
      {/* =================================================================== */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Action Header Strip */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Attendance Policy & Shift Configuration
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure standard academy shift schedule, arrival grace buffer, status heads, and campus GPS perimeter.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer shrink-0"
              >
                {isSavingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            </div>

            {settingsFeedback && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                settingsFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {settingsFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{settingsFeedback.message}</span>
              </div>
            )}

            {isSettingsDirty && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold">
                    Unsaved Policy Changes: You have modified shift parameters, heads, or geofence coordinates. Click "Save Changes" to apply this policy to the live muster roll.
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-3.5 py-1.5 bg-amber-900 hover:bg-amber-800 text-white font-bold text-xs rounded-lg shadow-xs shrink-0 transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>

          {/* CARD 1: Standard Daily Shift & Grace Policy */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Standard Institutional Policy</span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                  Daily Shift Schedule & Grace Tolerances
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Standard operating hours, arrival grace buffer, minimum duty thresholds, and absentee cutoff.
                </p>
              </div>

              <button
                type="button"
                onClick={handleApplyShiftPreset}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                title="Automatically update standard attendance heads based on these shift timings"
              >
                <Check className="w-3.5 h-3.5" />
                Apply Shift Schedule to Rules
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Shift Start Time</label>
                <input
                  type="time"
                  value={settingsForm.shift_start_time}
                  onChange={e => setSettingsForm(prev => ({ ...prev, shift_start_time: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                  required
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Academy morning opening</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Shift End Time</label>
                <input
                  type="time"
                  value={settingsForm.shift_end_time}
                  onChange={e => setSettingsForm(prev => ({ ...prev, shift_end_time: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                  required
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Daily shift dismissal</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">On-Time Grace Buffer</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={settingsForm.grace_period_minutes}
                    onChange={e => setSettingsForm(prev => ({ ...prev, grace_period_minutes: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none pr-12"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-slate-400 font-bold">mins</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">Grace window past start</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Half-Day Threshold</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min={1}
                    max={12}
                    value={settingsForm.half_day_hours}
                    onChange={e => setSettingsForm(prev => ({ ...prev, half_day_hours: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none pr-12"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-slate-400 font-bold">hrs</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">Duty under this = Half Day</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Absentee Cutoff Time</label>
                <input
                  type="time"
                  value={settingsForm.absent_cutoff_time}
                  onChange={e => setSettingsForm(prev => ({ ...prev, absent_cutoff_time: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                  required
                />
                <span className="text-[11px] text-slate-500 mt-1 block">No punch by this = Absent</span>
              </div>
            </div>

            {/* Live Policy Summary Strip */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">On-Time (Present)</span>
                  <span className="font-mono font-bold text-slate-900">Arrival ≤ {graceCutoffTime}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Late Arrival</span>
                  <span className="font-mono font-bold text-slate-900">{graceCutoffTime} – {settingsForm.absent_cutoff_time}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Half Day</span>
                  <span className="font-mono font-bold text-slate-900">Duty &lt; {settingsForm.half_day_hours} hours</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Unexcused Absent</span>
                  <span className="font-mono font-bold text-slate-900">No punch by {settingsForm.absent_cutoff_time}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: Configured Attendance Heads & Status Rules */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Configured Attendance Heads & Status Rules</h4>
                <p className="text-xs text-slate-500">
                  Official status categories, payroll treatment, and automated punch conditions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToBasicHeads}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  title="Reset attendance heads to match the 4 standard shift rules"
                >
                  Reset to 4 Standard Rules
                </button>

                {settingsForm.heads.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllHeads}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    title="Clear all configured heads"
                  >
                    Clear All
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleOpenAddHeadModal}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Custom Head
                </button>
              </div>
            </div>

            {/* Evaluation Precedence Notice */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center gap-2 text-slate-600">
              <Info className="w-4 h-4 text-slate-500 shrink-0" />
              <span>
                Rules evaluate from top to bottom (#1, #2, #3...). Duration deficits (e.g. leaving after 30 mins) take priority upon clock-out. Manual administrative regularizations and approved leaves always override automated scoring.
              </span>
            </div>

            {/* Heads Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                    <th className="py-2.5 px-3">Head Name & Code</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-4">Evaluation Condition</th>
                    <th className="py-2.5 px-3">Status Category</th>
                    <th className="py-2.5 px-3">Payroll Treatment</th>
                    <th className="py-2.5 px-2 text-center">Priority</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {settingsForm.heads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-mono">
                        No attendance heads configured yet. Click "Apply Shift Schedule to Rules" or "Add Custom Head" to begin.
                      </td>
                    </tr>
                  ) : (
                    settingsForm.heads.map((head, idx) => {
                      const category = head.category || (head.kind === 'leave' ? 'leave' : 'present');
                      return (
                        <tr key={head.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                            #{idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{head.name}</span>
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-mono font-bold">
                                {head.code || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              head.kind === 'leave'
                                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}>
                              {head.kind === 'leave' ? 'Leave Type' : 'Punch Rule'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700">
                            {formatTriggerDescription(head)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              category === 'present'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : category === 'late'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : category === 'half_day'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : category === 'leave'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              head.paid !== false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {head.paid !== false ? 'Paid Duty' : 'Unpaid'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveHead(idx, 'up')}
                                className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 transition-colors cursor-pointer"
                                title="Increase Priority"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === settingsForm.heads.length - 1}
                                onClick={() => handleMoveHead(idx, 'down')}
                                className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 transition-colors cursor-pointer"
                                title="Decrease Priority"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditHeadModal(idx)}
                                className="p-1 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                                title="Edit Head"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteHead(head.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Remove Head"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* CARD 3: Campus Geofence Perimeter */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hardware & Mobile Boundary</span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">Campus Geofence Perimeter & GPS Coordinates</h4>
                <p className="text-xs text-slate-500">
                  Center coordinates and radius threshold for mobile GPS clock-in proximity verification.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCalibrateLocation}
                disabled={isCalibratingLocation}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCalibratingLocation ? 'animate-spin' : ''}`} />
                Auto-Detect Device GPS
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Center Latitude (Decimal)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={settingsForm.latitude}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setSettingsForm(prev => ({ ...prev, latitude: isNaN(val) ? 0 : val }));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Center Longitude (Decimal)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={settingsForm.longitude}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setSettingsForm(prev => ({ ...prev, longitude: isNaN(val) ? 0 : val }));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Allowed Radius (Meters)</label>
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={settingsForm.radius_meters}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    setSettingsForm(prev => ({ ...prev, radius_meters: isNaN(val) ? 150 : val }));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Enforcement Mode</label>
                <select
                  value={settingsForm.enforcement_mode}
                  onChange={e => setSettingsForm(prev => ({ ...prev, enforcement_mode: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none cursor-pointer"
                >
                  <option value="strict">Strict Mode (Block clock-in when employee is outside campus radius)</option>
                  <option value="flagged">Audit Mode (Allow clock-in, but flag out-of-perimeter in red on muster roll)</option>
                </select>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* =================================================================== */}
      {/* ADD / EDIT ATTENDANCE HEAD MODAL (SENTENCE-STYLE BUILDER)           */}
      {/* =================================================================== */}
      {isHeadModalOpen && createPortal(
        <div className="fixed inset-0 w-screen h-screen z-[9999] bg-slate-900/60 backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 m-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  Attendance Policy Rule
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {editingHeadIndex !== null ? 'Edit Attendance Rule & Head' : 'Add Attendance Rule or Leave Head'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure early departure, late arrival, minimum duty hours, or approved leave heads.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHeadModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHeadModal} className="space-y-4">
              {/* 1. ACADEMY SCENARIO SELECTOR */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Academy Operational Situation
                </label>
                <select
                  value={headModalForm.scenario}
                  onChange={e => handleScenarioChange(e.target.value as RuleScenario)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer"
                >
                  <optgroup label="Departure & Shift Completion Rules">
                    <option value="early_exit">Early Departure (Staff came on time, but left before shift ended)</option>
                    <option value="hours_below">Short Shift / Minimum Hours (Total working duty under X hours)</option>
                  </optgroup>
                  <optgroup label="Morning Arrival Rules">
                    <option value="late_arrival">Late Arrival (Staff arrived past morning grace period)</option>
                    <option value="on_time">On-Time Arrival (Staff arrived by morning grace cutoff)</option>
                    <option value="no_check_in">Absentee Cutoff (No check-in punch recorded by cutoff time)</option>
                  </optgroup>
                  <optgroup label="Staff Leaves & Administrative Duty">
                    <option value="leave">Approved Staff Leave (Casual, Sick, Annual, Maternity)</option>
                    <option value="manual_special">Official Academy Duty / Special Manual Assignment</option>
                  </optgroup>
                </select>
              </div>

              {/* 2. HEAD NAME & SHORT CODE */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {headModalForm.scenario === 'leave' ? 'Leave Head Name' : 'Rule / Status Name'}
                  </label>
                  <input
                    type="text"
                    value={headModalForm.name}
                    onChange={e => setHeadModalForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={
                      headModalForm.scenario === 'leave' ? 'e.g. Casual Leave, Medical Leave' :
                      headModalForm.scenario === 'early_exit' ? 'e.g. Early Departure, Short Leave' :
                      headModalForm.scenario === 'hours_below' ? 'e.g. Short Shift, Half Day' :
                      'e.g. Late Arrival, Official Duty'
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Short Code</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={headModalForm.code}
                    onChange={e => setHeadModalForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. ED, CL"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none uppercase"
                  />
                </div>
              </div>

              {/* 3. DYNAMIC SCENARIO PARAMETERS */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                {/* A: EARLY DEPARTURE */}
                {headModalForm.scenario === 'early_exit' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Staff clocks out earlier than:
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={headModalForm.triggerTime}
                        onChange={e => setHeadModalForm(prev => ({ ...prev, triggerTime: e.target.value }))}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                        required
                      />
                      <span className="text-[11px] text-slate-500">
                        (Standard academy shift dismissal is at <strong className="text-slate-700 font-mono">{settingsForm.shift_end_time || '14:00'}</strong>)
                      </span>
                    </div>
                  </div>
                )}

                {/* B: MINIMUM DUTY HOURS */}
                {headModalForm.scenario === 'hours_below' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Minimum working hours required for a full day:
                    </label>
                    <div className="flex items-center gap-2 max-w-xs">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          step="0.5"
                          min={0.5}
                          max={24}
                          value={headModalForm.triggerHours}
                          onChange={e => setHeadModalForm(prev => ({ ...prev, triggerHours: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none pr-10"
                          required
                        />
                        <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-bold">hrs</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Total working time between arrival and departure less than this duration triggers this status.
                    </span>
                  </div>
                )}

                {/* C: LATE ARRIVAL */}
                {headModalForm.scenario === 'late_arrival' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Staff clocks in after:
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={headModalForm.triggerTime}
                        onChange={e => setHeadModalForm(prev => ({ ...prev, triggerTime: e.target.value }))}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                        required
                      />
                      <span className="text-[11px] text-slate-500">
                        (Shift starts at <strong className="text-slate-700 font-mono">{settingsForm.shift_start_time || '08:00'}</strong> + {settingsForm.grace_period_minutes || 15}m grace)
                      </span>
                    </div>
                  </div>
                )}

                {/* D: ON-TIME ARRIVAL */}
                {headModalForm.scenario === 'on_time' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Staff clocks in on or before:
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={headModalForm.triggerTime}
                        onChange={e => setHeadModalForm(prev => ({ ...prev, triggerTime: e.target.value }))}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                        required
                      />
                      <span className="text-[11px] text-slate-500">
                        (Morning shift start time + grace period)
                      </span>
                    </div>
                  </div>
                )}

                {/* E: ABSENTEE CUTOFF */}
                {headModalForm.scenario === 'no_check_in' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      No clock-in punch recorded by:
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={headModalForm.triggerTime}
                        onChange={e => setHeadModalForm(prev => ({ ...prev, triggerTime: e.target.value }))}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                        required
                      />
                      <span className="text-[11px] text-slate-500">
                        (Staff without check-in by this time are flagged for absence follow-up)
                      </span>
                    </div>
                  </div>
                )}

                {/* F: APPROVED LEAVE SALARY POLICY */}
                {headModalForm.scenario === 'leave' ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block mb-1">Salary Deduction Policy</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="leave_paid_policy"
                          checked={headModalForm.paid}
                          onChange={() => setHeadModalForm(prev => ({ ...prev, paid: true }))}
                          className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-slate-800">
                          Paid Leave (Full duty credit — no salary deduction)
                        </span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="leave_paid_policy"
                          checked={!headModalForm.paid}
                          onChange={() => setHeadModalForm(prev => ({ ...prev, paid: false }))}
                          className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-slate-800">
                          Unpaid Leave / LWP (Deducts daily wage in monthly salary calculation)
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  /* STATUS ASSIGNMENT & PAYROLL CREDIT FOR PUNCH RULES */
                  <div className="space-y-3 pt-2 border-t border-slate-200/80">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        Attendance Status to Assign
                      </label>
                      <select
                        value={headModalForm.category}
                        onChange={e => setHeadModalForm(prev => ({ ...prev, category: e.target.value as AttendanceHeadCategory }))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer"
                      >
                        {headModalForm.scenario === 'early_exit' && (
                          <>
                            <option value="half_day">Half Day (HD)</option>
                            <option value="present">Present with Early Exit Flag (P)</option>
                            <option value="absent">Unexcused Absent (A)</option>
                          </>
                        )}
                        {headModalForm.scenario === 'hours_below' && (
                          <>
                            <option value="half_day">Half Day (HD)</option>
                            <option value="absent">Unexcused Absent (A)</option>
                          </>
                        )}
                        {headModalForm.scenario === 'late_arrival' && (
                          <>
                            <option value="late">Late Arrival (L)</option>
                            <option value="half_day">Half Day (HD)</option>
                          </>
                        )}
                        {headModalForm.scenario === 'on_time' && (
                          <option value="present">Present (P)</option>
                        )}
                        {headModalForm.scenario === 'no_check_in' && (
                          <option value="absent">Unexcused Absent (A)</option>
                        )}
                        {headModalForm.scenario === 'manual_special' && (
                          <>
                            <option value="present">Present (P)</option>
                            <option value="half_day">Half Day (HD)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={headModalForm.paid}
                          onChange={e => setHeadModalForm(prev => ({ ...prev, paid: e.target.checked }))}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-700">Count as Paid Duty Hours in Payroll</span>
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5 ml-6">
                        Credited as payable hours in monthly salary calculation without wage deduction.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. LIVE RULE SUMMARY (PLAIN ENGLISH) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-700">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                    Rule Behavior & Live Summary
                  </span>
                  <p className="text-xs text-slate-800 font-medium mt-0.5 leading-relaxed">
                    {getLiveRuleSummary(headModalForm.scenario, headModalForm)}
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsHeadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editingHeadIndex !== null ? 'Save Changes' : 'Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* =================================================================== */}
      {/* EDIT ATTENDANCE MODAL (PORTAL WITH DEEP BLUR)                       */}
      {/* =================================================================== */}
      {editingEntry && createPortal(
        <div className="fixed inset-0 w-screen h-screen z-[9999] bg-slate-900/60 backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 m-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Daily Attendance</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Edit Attendance Record
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Staff Particulars */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{editingEntry.staff_name}</span>
                <span className="font-mono text-slate-500 font-bold">{editingEntry.employee_code}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>Dept: {editingEntry.department} · {editingEntry.designation}</span>
                <span className="font-mono font-bold text-slate-700">Date: {selectedDate}</span>
              </div>
            </div>

            <form onSubmit={handleSaveRegularization} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Attendance Head</label>
                <select
                  value={editHeadId}
                  onChange={e => {
                    const selectedId = e.target.value;
                    setEditHeadId(selectedId);
                    const head = activeHeads.find(h => h.id === selectedId);
                    if (head) {
                      setEditReasonHead(head.name);
                      const mappedStatus: StaffAttendanceStatus =
                        head.kind === 'leave' || head.category === 'leave'
                          ? 'on_leave'
                          : head.category === 'present'
                          ? 'on_time'
                          : (head.category as StaffAttendanceStatus);
                      setEditStatus(mappedStatus);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none cursor-pointer"
                >
                  {activeHeads.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Arrival Time</label>
                    {editClockIn && (
                      <button
                        type="button"
                        onClick={() => setEditClockIn('')}
                        className="text-[10px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="time"
                    value={editClockIn}
                    onChange={e => setEditClockIn(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Departure Time</label>
                    {editClockOut && (
                      <button
                        type="button"
                        onClick={() => setEditClockOut('')}
                        className="text-[10px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="time"
                    value={editClockOut}
                    onChange={e => setEditClockOut(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="State reason or administrative remarks..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none resize-none"
                  required
                />
              </div>

              {editFeedback && (
                <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                  editFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {editFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{editFeedback.message}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
