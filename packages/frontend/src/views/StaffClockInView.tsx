import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Sliders, 
  Compass, 
  UserCheck, 
  Building2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  FileText, 
  Fingerprint, 
  LogIn, 
  LogOut 
} from 'lucide-react';
import { 
  CampusGeofenceConfig, 
  StaffAttendanceRecord, 
  StaffAttendanceStatus,
  DailyStaffRosterEntry
} from '@apex/shared-types';

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

export const StaffClockInView: React.FC = () => {
  const { token, user } = useAuth();

  // Date Navigation State
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  // Config & Data State
  const [config, setConfig] = useState<CampusGeofenceConfig | null>(null);
  const [roster, setRoster] = useState<DailyStaffRosterEntry[]>([]);
  const [rawRecords, setRawRecords] = useState<StaffAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // GPS Hardware State for User
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Quick Punch Action State
  const [isPunching, setIsPunching] = useState(false);
  const [punchFeedback, setPunchFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Admin Config Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    campus_name: '',
    latitude: 31.5204,
    longitude: 74.3587,
    radius_meters: 150,
    shift_start_time: '08:00:00',
    shift_end_time: '14:00:00',
    grace_period_minutes: 15,
    half_day_hours: 4,
    enforcement_mode: 'strict' as 'strict' | 'flagged',
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isAutoDetectingGps, setIsAutoDetectingGps] = useState(false);
  const [autoDetectMsg, setAutoDetectMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Regularization Modal State
  const [showRegularizeModal, setShowRegularizeModal] = useState(false);
  const [regularizeForm, setRegularizeForm] = useState({
    staff_id: '',
    staff_name: '',
    date: selectedDate,
    status: 'on_time' as StaffAttendanceStatus,
    clock_in_time: '08:00',
    clock_out_time: '14:00',
    verification_mode: 'manual_regularization' as 'manual_regularization' | 'biometric_sync',
    reason: 'Forgot Smartphone / Device Battery Depleted',
    custom_notes: '',
  });
  const [isSavingRegularization, setIsSavingRegularization] = useState(false);

  // Fetch Data for Selected Date
  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [cfgRes, rosterRes, recRes] = await Promise.all([
        fetch('/api/v1/geofence/geofence/config', { headers }),
        fetch(`/api/v1/geofence/attendance/roster?date=${selectedDate}`, { headers }),
        fetch(`/api/v1/geofence/attendance/staff?date=${selectedDate}`, { headers }),
      ]);

      const [cfgData, rosterData, recData] = await Promise.all([
        cfgRes.json(),
        rosterRes.json(),
        recRes.json(),
      ]);

      if (cfgData.success && cfgData.data) {
        setConfig(cfgData.data);
        setConfigForm({
          campus_name: cfgData.data.campus_name || 'Main Campus',
          latitude: cfgData.data.latitude || 31.5204,
          longitude: cfgData.data.longitude || 74.3587,
          radius_meters: cfgData.data.radius_meters || 150,
          shift_start_time: cfgData.data.shift_start_time || '08:00:00',
          shift_end_time: cfgData.data.shift_end_time || '14:00:00',
          grace_period_minutes: cfgData.data.grace_period_minutes ?? 15,
          half_day_hours: cfgData.data.half_day_hours ?? 4,
          enforcement_mode: cfgData.data.enforcement_mode || 'strict',
        });

        // Initialize GPS coordinates default to campus center if not acquired yet
        if (currentLat === null) {
          setCurrentLat(cfgData.data.latitude);
          setCurrentLng(cfgData.data.longitude);
        }
      }

      if (rosterData.success) {
        setRoster(rosterData.data || []);
      }

      if (recData.success) {
        setRawRecords(recData.data || []);
      }
    } catch (err) {
      console.error('Failed to load geofence staff data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, selectedDate]);

  // Acquire Hardware GPS Coordinates
  const acquireHardwareGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Hardware geolocation is not supported on this browser.');
      return;
    }

    setIsAcquiringGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setCurrentLat(lat);
        setCurrentLng(lng);
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setIsAcquiringGps(false);
      },
      err => {
        setIsAcquiringGps(false);
        setGpsError(`Hardware GPS query failed: ${err.message}. Using campus coordinates.`);
        if (config && currentLat === null) {
          setCurrentLat(config.latitude);
          setCurrentLng(config.longitude);
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Compute live distance
  const currentDistanceMeters = useMemo(() => {
    if (currentLat !== null && currentLng !== null && config) {
      return computeHaversineDistanceMeters(currentLat, currentLng, config.latitude, config.longitude);
    }
    return null;
  }, [currentLat, currentLng, config]);

  const isWithinGeofence = useMemo(() => {
    if (currentDistanceMeters === null || !config) return false;
    return currentDistanceMeters <= config.radius_meters;
  }, [currentDistanceMeters, config]);

  // Determine current user's personal punch status
  const myRawRecord = useMemo(() => {
    if (!user) return null;
    return rawRecords.find(r => r.staff_id === user.id || r.staff_name === user.full_name);
  }, [rawRecords, user]);

  // Clock In Action
  const handleClockIn = async () => {
    if (!token) return;
    if (currentLat === null || currentLng === null) {
      acquireHardwareGps();
      return;
    }

    setIsPunching(true);
    setPunchFeedback(null);

    try {
      const res = await fetch('/api/v1/geofence/attendance/staff/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: currentLat,
          longitude: currentLng,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Clock-in rejected.');
      }

      setPunchFeedback({
        type: 'success',
        message: `Clocked in successfully at ${formatIsoToTime(data.data.clock_in_time)} (${data.data.status === 'on_time' ? 'On Time' : 'Late'}).`,
      });
      fetchData();
    } catch (err: any) {
      setPunchFeedback({
        type: 'error',
        message: err.message,
      });
    } finally {
      setIsPunching(false);
    }
  };

  // Clock Out Action
  const handleClockOut = async () => {
    if (!token) return;
    if (currentLat === null || currentLng === null) {
      acquireHardwareGps();
      return;
    }

    setIsPunching(true);
    setPunchFeedback(null);

    try {
      const res = await fetch('/api/v1/geofence/attendance/staff/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: currentLat,
          longitude: currentLng,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Clock-out rejected.');
      }

      setPunchFeedback({
        type: 'success',
        message: `Clocked out successfully at ${formatIsoToTime(data.data.clock_out_time)}. Duration: ${formatMinutesToHours(data.data.work_duration_minutes)}.`,
      });
      fetchData();
    } catch (err: any) {
      setPunchFeedback({
        type: 'error',
        message: err.message,
      });
    } finally {
      setIsPunching(false);
    }
  };

  // Save Geofence & Shift Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/v1/geofence/geofence/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(configForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to update campus geofence configuration');

      setShowConfigModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Auto-Detect Perimeter Center GPS in Settings Modal
  const handleAutoDetectPerimeterGps = () => {
    if (!navigator.geolocation) {
      setAutoDetectMsg({ type: 'error', text: 'Geolocation is not supported by this browser.' });
      return;
    }
    setIsAutoDetectingGps(true);
    setAutoDetectMsg(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setConfigForm(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));
        setIsAutoDetectingGps(false);
        setAutoDetectMsg({
          type: 'success',
          text: `Auto-detected GPS coordinates: ${lat}, ${lng} (±${Math.round(pos.coords.accuracy)}m accuracy)`,
        });
      },
      err => {
        setIsAutoDetectingGps(false);
        setAutoDetectMsg({
          type: 'error',
          text: `GPS acquisition failed: ${err.message}. Enter coordinates manually.`,
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Open Regularization Modal for a Specific Staff Member
  const openRegularizeForStaff = (entry: DailyStaffRosterEntry) => {
    setRegularizeForm({
      staff_id: entry.staff_id,
      staff_name: entry.staff_name,
      date: selectedDate,
      status: entry.status === 'not_marked' ? 'on_time' : entry.status,
      clock_in_time: entry.clock_in_time ? formatIsoToTime(entry.clock_in_time) : '08:00',
      clock_out_time: entry.clock_out_time ? formatIsoToTime(entry.clock_out_time) : '14:00',
      verification_mode: entry.verification_mode === 'biometric_sync' ? 'biometric_sync' : 'manual_regularization',
      reason: 'Forgot Smartphone / Device Battery Depleted',
      custom_notes: entry.admin_adjustment_notes || '',
    });
    setShowRegularizeModal(true);
  };

  // Submit Regularization
  const handleSaveRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSavingRegularization(true);
    try {
      const inIso = regularizeForm.clock_in_time
        ? `${regularizeForm.date}T${regularizeForm.clock_in_time.length === 5 ? regularizeForm.clock_in_time + ':00' : regularizeForm.clock_in_time}.000Z`
        : undefined;
      const outIso = regularizeForm.clock_out_time
        ? `${regularizeForm.date}T${regularizeForm.clock_out_time.length === 5 ? regularizeForm.clock_out_time + ':00' : regularizeForm.clock_out_time}.000Z`
        : undefined;

      const fullReason = `${regularizeForm.reason}${regularizeForm.custom_notes ? ` - ${regularizeForm.custom_notes}` : ''}`;

      const res = await fetch('/api/v1/geofence/attendance/staff/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          staff_id: regularizeForm.staff_id,
          staff_name: regularizeForm.staff_name,
          date: regularizeForm.date,
          status: regularizeForm.status,
          clock_in_time: inIso,
          clock_out_time: outIso,
          reason: fullReason,
          verification_mode: regularizeForm.verification_mode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to regularize attendance');

      setShowRegularizeModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingRegularization(false);
    }
  };

  // Date step helper
  const stepDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    return roster.filter(item => {
      const matchesSearch = 
        searchQuery === '' ||
        item.staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.employee_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.department.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept = 
        selectedDepartment === 'all' || 
        item.department.toLowerCase() === selectedDepartment.toLowerCase();

      const matchesStatus = 
        selectedStatusFilter === 'all' || 
        (selectedStatusFilter === 'present' && ['on_time', 'late', 'half_day'].includes(item.status)) ||
        item.status === selectedStatusFilter;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [roster, searchQuery, selectedDepartment, selectedStatusFilter]);

  // Aggregate Statistics
  const stats = useMemo(() => {
    const total = roster.length;
    const onTime = roster.filter(r => r.status === 'on_time').length;
    const late = roster.filter(r => r.status === 'late').length;
    const halfDay = roster.filter(r => r.status === 'half_day').length;
    const onLeave = roster.filter(r => r.status === 'on_leave').length;
    const absent = roster.filter(r => r.status === 'absent' || r.status === 'not_marked').length;
    const presentTotal = onTime + late + halfDay;

    return { total, onTime, late, halfDay, onLeave, absent, presentTotal };
  }, [roster]);

  return (
    <div className="space-y-5">
      {/* 1. Institutional Header & Context Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-lg bg-slate-900 text-white shadow-xs">
            <Building2 className="w-5 h-5 text-white" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Staff Attendance & Campus Geofence Register</h1>
              {config && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                  {config.campus_name} • {config.radius_meters}m Perimeter
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily muster roll, GPS & biometric verification, shift duration tracking, and attendance regularization.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {user?.role === 'tenant_admin' && (
            <>
              <button
                onClick={() => {
                  setRegularizeForm({
                    staff_id: roster[0]?.staff_id || '',
                    staff_name: roster[0]?.staff_name || '',
                    date: selectedDate,
                    status: 'on_time',
                    clock_in_time: '08:00',
                    clock_out_time: '14:00',
                    verification_mode: 'manual_regularization',
                    reason: 'Forgot Smartphone / Device Battery Depleted',
                    custom_notes: '',
                  });
                  setShowRegularizeModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-all"
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Regularize Attendance</span>
              </button>

              <button
                onClick={() => setShowConfigModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Geofence & Shift Settings</span>
              </button>
            </>
          )}

          <button
            onClick={fetchData}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
            title="Refresh Muster Roll"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Institutional Summary Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wide block">Total Faculty / Staff</span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">{stats.total}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Active on roster</span>
        </div>

        <div className="bg-white border border-emerald-200 bg-emerald-50/20 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-mono text-emerald-800 uppercase tracking-wide block">Present / On Time</span>
          <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">{stats.onTime}</span>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">Arrived within grace</span>
        </div>

        <div className="bg-white border border-amber-200 bg-amber-50/20 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-mono text-amber-800 uppercase tracking-wide block">Late Arrivals</span>
          <span className="text-xl font-bold font-mono text-amber-700 mt-1 block">{stats.late}</span>
          <span className="text-[10px] text-amber-600 mt-0.5 block">Past shift grace</span>
        </div>

        <div className="bg-white border border-orange-200 bg-orange-50/20 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-mono text-orange-800 uppercase tracking-wide block">Half-Day</span>
          <span className="text-xl font-bold font-mono text-orange-700 mt-1 block">{stats.halfDay}</span>
          <span className="text-[10px] text-orange-600 mt-0.5 block">&lt; {config?.half_day_hours || 4}h shift duration</span>
        </div>

        <div className="bg-white border border-blue-200 bg-blue-50/20 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-mono text-blue-800 uppercase tracking-wide block">Approved Leave</span>
          <span className="text-xl font-bold font-mono text-blue-700 mt-1 block">{stats.onLeave}</span>
          <span className="text-[10px] text-blue-600 mt-0.5 block">Sanctioned absence</span>
        </div>

        <div className="bg-white border border-rose-200 bg-rose-50/20 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-mono text-rose-800 uppercase tracking-wide block">Absent / Unmarked</span>
          <span className="text-xl font-bold font-mono text-rose-700 mt-1 block">{stats.absent}</span>
          <span className="text-[10px] text-rose-600 mt-0.5 block">No punch recorded</span>
        </div>
      </div>

      {/* 3. Personal Quick Punch Card & Shift Status */}
      {isToday && user && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                <Fingerprint className="w-4 h-4 text-slate-700" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{user.full_name || user.email}</span>
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {user.role === 'tenant_admin' ? 'Academy Director' : user.role === 'teacher' ? 'Faculty' : 'Staff'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  Shift: {config?.shift_start_time || '08:00:00'} – {config?.shift_end_time || '14:00:00'} (Grace: {config?.grace_period_minutes || 15}m)
                </p>
              </div>
            </div>

            {/* Campus Proximity Status Badge */}
            <div className="flex items-center gap-2">
              <div className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 ${
                isWithinGeofence 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {isWithinGeofence ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Inside Campus ({currentDistanceMeters ?? 0}m{gpsAccuracy ? ` • ±${gpsAccuracy}m` : ''})</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      {currentDistanceMeters !== null 
                        ? `Outside Campus (${currentDistanceMeters}m away, radius: ${config?.radius_meters}m${gpsAccuracy ? ` • ±${gpsAccuracy}m` : ''})` 
                        : 'GPS Location Pending'}
                    </span>
                  </>
                )}
              </div>

              <button
                onClick={acquireHardwareGps}
                disabled={isAcquiringGps}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg flex items-center gap-1 transition-all"
                title="Refresh live GPS position"
              >
                <Compass className={`w-3.5 h-3.5 text-slate-600 ${isAcquiringGps ? 'animate-spin' : ''}`} />
                <span>{isAcquiringGps ? 'Locating...' : 'Refresh GPS'}</span>
              </button>
            </div>
          </div>

          {gpsError && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{gpsError}</span>
            </div>
          )}

          {punchFeedback && (
            <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
              punchFeedback.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {punchFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span>{punchFeedback.message}</span>
            </div>
          )}

          {/* Quick Punch Action Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="text-xs space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Today's Punch Status:</span>
                {myRawRecord?.clock_in_time ? (
                  <span className="font-bold text-slate-800 font-mono">
                    Clocked In at {formatIsoToTime(myRawRecord.clock_in_time)}
                    {myRawRecord.clock_out_time ? ` → Out at ${formatIsoToTime(myRawRecord.clock_out_time)}` : ' (Shift in progress)'}
                  </span>
                ) : (
                  <span className="text-slate-500 font-mono italic">Not clocked in today</span>
                )}
              </div>
              {myRawRecord?.work_duration_minutes ? (
                <p className="text-[11px] text-slate-500 font-mono">
                  Recorded Shift Duration: <span className="font-bold text-slate-800">{formatMinutesToHours(myRawRecord.work_duration_minutes)}</span>
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {/* If not clocked in: show Clock In */}
              {!myRawRecord?.clock_in_time && (
                <button
                  onClick={handleClockIn}
                  disabled={isPunching || (!isWithinGeofence && config?.enforcement_mode === 'strict')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    isWithinGeofence || config?.enforcement_mode === 'flagged'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  }`}
                >
                  {isPunching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  <span>{isPunching ? 'Verifying GPS...' : 'Clock In Now'}</span>
                </button>
              )}

              {/* If clocked in and not clocked out: show Clock Out */}
              {myRawRecord?.clock_in_time && !myRawRecord?.clock_out_time && (
                <button
                  onClick={handleClockOut}
                  disabled={isPunching || (!isWithinGeofence && config?.enforcement_mode === 'strict')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    isWithinGeofence || config?.enforcement_mode === 'flagged'
                      ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-xs'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  }`}
                >
                  {isPunching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  <span>{isPunching ? 'Recording Departure...' : 'Clock Out (End Shift)'}</span>
                </button>
              )}

              {/* If clocked out: show Shift Complete */}
              {myRawRecord?.clock_out_time && (
                <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Shift Completed ({formatMinutesToHours(myRawRecord.work_duration_minutes)})</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Date Navigation & Filter Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => stepDate(-1)}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <button
              onClick={() => stepDate(1)}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isToday && (
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                Today
              </button>
            )}

            <span className="text-xs font-mono text-slate-500 pl-1 hidden sm:inline">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          {/* Search & Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search staff name or code..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400"
              />
            </div>

            <select
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
            >
              <option value="all">All Departments</option>
              <option value="science">Science</option>
              <option value="mathematics">Mathematics</option>
              <option value="humanities">Humanities</option>
              <option value="languages">Languages</option>
              <option value="commerce">Commerce</option>
              <option value="administration">Administration</option>
              <option value="accounts">Accounts</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2.5 overflow-x-auto text-xs">
          {[
            { id: 'all', label: `All Staff (${stats.total})` },
            { id: 'present', label: `Present (${stats.presentTotal})` },
            { id: 'on_time', label: `On Time (${stats.onTime})` },
            { id: 'late', label: `Late (${stats.late})` },
            { id: 'half_day', label: `Half Day (${stats.halfDay})` },
            { id: 'on_leave', label: `On Leave (${stats.onLeave})` },
            { id: 'absent', label: `Absent (${stats.absent})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition-colors ${
                selectedStatusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Daily Staff Attendance Register Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-700" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Daily Muster Roll — {selectedDate}
            </h2>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            Showing {filteredRoster.length} of {roster.length} staff members
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
            <p className="text-xs font-mono">Loading staff attendance register...</p>
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No staff matching current filter</p>
            <p className="text-xs text-slate-400 mt-1">Adjust search parameters or select a different status category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-4 font-bold">Code</th>
                  <th className="py-2.5 px-4 font-bold">Faculty / Staff Member</th>
                  <th className="py-2.5 px-4 font-bold">Department</th>
                  <th className="py-2.5 px-3 font-bold">In Time</th>
                  <th className="py-2.5 px-3 font-bold">Out Time</th>
                  <th className="py-2.5 px-3 font-bold">Duration</th>
                  <th className="py-2.5 px-3 font-bold">Verification Mode</th>
                  <th className="py-2.5 px-3 font-bold text-center">Status</th>
                  {user?.role === 'tenant_admin' && <th className="py-2.5 px-4 font-bold text-right">Audit Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoster.map(item => (
                  <tr key={item.staff_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700 text-[11px]">
                      {item.employee_code}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{item.staff_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono block">{item.designation}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                        {item.department}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-800">
                      {formatIsoToTime(item.clock_in_time)}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-800">
                      {formatIsoToTime(item.clock_out_time)}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-700">
                      {formatMinutesToHours(item.work_duration_minutes)}
                    </td>

                    <td className="py-3 px-3">
                      {item.verification_mode === 'geofence' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>GPS ({item.distance_meters ?? 0}m)</span>
                        </span>
                      ) : item.verification_mode === 'biometric_sync' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-700">
                          <Fingerprint className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Biometric</span>
                        </span>
                      ) : item.verification_mode === 'manual_regularization' || item.admin_adjusted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600" title={item.admin_adjustment_notes || 'Regularized'}>
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          <span>Regularized</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        item.status === 'on_time'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.status === 'late'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : item.status === 'half_day'
                          ? 'bg-orange-50 text-orange-700 border border-orange-200'
                          : item.status === 'on_leave'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>

                    {user?.role === 'tenant_admin' && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openRegularizeForStaff(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                        >
                          Regularize
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Attendance Regularization & Manual Entry Modal */}
      {showRegularizeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">Attendance Regularization & Manual Entry</h2>
              </div>
              <button onClick={() => setShowRegularizeModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRegularization} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Staff Member</label>
                  <select
                    value={regularizeForm.staff_id}
                    onChange={e => {
                      const sel = roster.find(r => r.staff_id === e.target.value);
                      setRegularizeForm(prev => ({
                        ...prev,
                        staff_id: e.target.value,
                        staff_name: sel?.staff_name || '',
                      }));
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800"
                    required
                  >
                    <option value="" disabled>Select Staff Member</option>
                    {roster.map(r => (
                      <option key={r.staff_id} value={r.staff_id}>
                        {r.staff_name} ({r.employee_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Attendance Date</label>
                  <input
                    type="date"
                    value={regularizeForm.date}
                    onChange={e => setRegularizeForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Status Classification</label>
                  <select
                    value={regularizeForm.status}
                    onChange={e => setRegularizeForm(prev => ({ ...prev, status: e.target.value as StaffAttendanceStatus }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 capitalize"
                  >
                    <option value="on_time">On Time</option>
                    <option value="late">Late Arrival</option>
                    <option value="half_day">Half Day</option>
                    <option value="on_leave">On Leave</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Verification Source</label>
                  <select
                    value={regularizeForm.verification_mode}
                    onChange={e => setRegularizeForm(prev => ({ ...prev, verification_mode: e.target.value as any }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800"
                  >
                    <option value="manual_regularization">Manual Administrative Override</option>
                    <option value="biometric_sync">Biometric Machine Synchronization</option>
                  </select>
                </div>
              </div>

              {regularizeForm.status !== 'absent' && regularizeForm.status !== 'on_leave' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">Clock In Time</label>
                    <input
                      type="time"
                      value={regularizeForm.clock_in_time}
                      onChange={e => setRegularizeForm(prev => ({ ...prev, clock_in_time: e.target.value }))}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">Clock Out Time</label>
                    <input
                      type="time"
                      value={regularizeForm.clock_out_time}
                      onChange={e => setRegularizeForm(prev => ({ ...prev, clock_out_time: e.target.value }))}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Legitimate Regularization Reason</label>
                <select
                  value={regularizeForm.reason}
                  onChange={e => setRegularizeForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                >
                  <option value="Forgot Smartphone / Device Battery Depleted">Forgot Smartphone / Device Battery Depleted</option>
                  <option value="Biometric Thumb Scanner / Device Sync Failure">Biometric Device / Scanner Sync Failure</option>
                  <option value="Official Academy Field Duty / Exam Duty">Official Academy Field Duty / Exam Duty</option>
                  <option value="Principal / Director Excused">Principal / Director Excused</option>
                  <option value="Medical Emergency / Compassionate Leave">Medical Emergency / Compassionate Leave</option>
                  <option value="Other Legitimate Administrative Reason">Other Legitimate Administrative Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Administrative Audit Justification</label>
                <textarea
                  value={regularizeForm.custom_notes}
                  onChange={e => setRegularizeForm(prev => ({ ...prev, custom_notes: e.target.value }))}
                  placeholder="Additional context or notes for permanent audit records..."
                  rows={2}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegularizeModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRegularization}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                >
                  {isSavingRegularization ? 'Saving Regularization...' : 'Save & Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Campus Geofence & Shift Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">Campus Geofence & Shift Configuration</h2>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Campus Venue Name</label>
                <input
                  type="text"
                  value={configForm.campus_name}
                  onChange={e => setConfigForm(prev => ({ ...prev, campus_name: e.target.value }))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                  required
                />
              </div>

              {/* Dual-Mode Hardware GPS Auto-Fetch vs Manual Input */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">Campus Center Coordinates</span>
                  <button
                    type="button"
                    onClick={handleAutoDetectPerimeterGps}
                    disabled={isAutoDetectingGps}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    <Compass className={`w-3.5 h-3.5 ${isAutoDetectingGps ? 'animate-spin' : ''}`} />
                    <span>{isAutoDetectingGps ? 'Detecting...' : 'Auto-Detect Current GPS'}</span>
                  </button>
                </div>

                {autoDetectMsg && (
                  <p className={`text-[11px] p-2 rounded-lg ${
                    autoDetectMsg.type === 'success' 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {autoDetectMsg.text}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={configForm.latitude}
                      onChange={e => setConfigForm(prev => ({ ...prev, latitude: parseFloat(e.target.value) }))}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={configForm.longitude}
                      onChange={e => setConfigForm(prev => ({ ...prev, longitude: parseFloat(e.target.value) }))}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Radius & Enforcement Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Geofence Radius ({configForm.radius_meters}m)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={1000}
                    step={10}
                    value={configForm.radius_meters}
                    onChange={e => setConfigForm(prev => ({ ...prev, radius_meters: parseInt(e.target.value) || 150 }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Perimeter Enforcement</label>
                  <select
                    value={configForm.enforcement_mode}
                    onChange={e => setConfigForm(prev => ({ ...prev, enforcement_mode: e.target.value as any }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800"
                  >
                    <option value="strict">Strict (Reject punch outside radius)</option>
                    <option value="flagged">Flagged (Allow punch, flag violation)</option>
                  </select>
                </div>
              </div>

              {/* Shift Hours & Thresholds */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">Shift Start</label>
                  <input
                    type="text"
                    value={configForm.shift_start_time}
                    onChange={e => setConfigForm(prev => ({ ...prev, shift_start_time: e.target.value }))}
                    placeholder="08:00:00"
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">Shift End</label>
                  <input
                    type="text"
                    value={configForm.shift_end_time}
                    onChange={e => setConfigForm(prev => ({ ...prev, shift_end_time: e.target.value }))}
                    placeholder="14:00:00"
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">Grace (Mins)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={configForm.grace_period_minutes}
                    onChange={e => setConfigForm(prev => ({ ...prev, grace_period_minutes: parseInt(e.target.value) || 0 }))}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase font-mono mb-1">Half-Day (Hrs)</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={configForm.half_day_hours}
                    onChange={e => setConfigForm(prev => ({ ...prev, half_day_hours: parseFloat(e.target.value) || 4 }))}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                >
                  {isSavingConfig ? 'Saving Settings...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
