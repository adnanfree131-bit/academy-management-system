import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Clock, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  UserCheck, 
  X, 
  RefreshCw,
  Building2,
  BookOpen
} from 'lucide-react';
import { 
  Batch, 
  Subject, 
  Room, 
  TimetableSlot, 
  DayOfWeek, 
  User, 
  TimetableCollisionResult 
} from '@apex/shared-types';

const DAYS: { id: DayOfWeek; label: string }[] = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
  { id: 'saturday', label: 'Saturday' },
];

export const TimetableDesk: React.FC = () => {
  const { token } = useAuth();

  // State
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('monday');

  // Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    batch_id: '',
    subject_id: '',
    teacher_id: '',
    room_id: '',
    day_of_week: 'monday' as DayOfWeek,
    start_time: '08:30',
    end_time: '09:45',
  });
  const [multiRoomEnabled, setMultiRoomEnabled] = useState(false);
  const [collisionState, setCollisionState] = useState<TimetableCollisionResult | null>(null);
  const [isCheckingCollision, setIsCheckingCollision] = useState(false);
  const [isSubmittingSlot, setIsSubmittingSlot] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState<User[]>([]);

  // Substitute Modal
  const [substituteSlot, setSubstituteSlot] = useState<TimetableSlot | null>(null);
  const [substituteTeacherId, setSubstituteTeacherId] = useState('');
  const [substituteCandidates, setSubstituteCandidates] = useState<User[]>([]);
  const [isAssigningSub, setIsAssigningSub] = useState(false);

  const fetchBaseData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [batchRes, subRes, roomRes, slotsRes, geoRes] = await Promise.all([
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/academic/subjects', { headers }),
        fetch('/api/v1/timetable/rooms', { headers }),
        fetch('/api/v1/timetable/timetable', { headers }),
        fetch('/api/v1/geofence/config', { headers }),
      ]);

      const [batchData, subData, roomData, slotsData, geoData] = await Promise.all([
        batchRes.json(),
        subRes.json(),
        roomRes.json(),
        slotsRes.json(),
        geoRes.json(),
      ]);

      if (batchData.success) setBatches(batchData.data || []);
      if (subData.success) setSubjects(subData.data || []);
      if (roomData.success) setRooms(roomData.data || []);
      if (slotsData.success) setSlots(slotsData.data || []);
      if (geoData.success) setMultiRoomEnabled(!!geoData.data?.multi_room_enabled);

      if (batchData.data?.length > 0 && selectedBatchId === 'all') {
        setScheduleForm(prev => ({ ...prev, batch_id: batchData.data[0].id }));
      }
      if (subData.data?.length > 0) {
        setScheduleForm(prev => ({ ...prev, subject_id: subData.data[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load timetable metadata');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, [token]);

  // Pre-flight collision checker when modal form fields change
  useEffect(() => {
    if (!showScheduleModal || !scheduleForm.batch_id || !scheduleForm.teacher_id) {
      setCollisionState(null);
      return;
    }

    const checkCollision = async () => {
      setIsCheckingCollision(true);
      try {
        const res = await fetch('/api/v1/timetable/check-collision', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            batchId: scheduleForm.batch_id,
            teacherId: scheduleForm.teacher_id,
            roomId: scheduleForm.room_id || null,
            dayOfWeek: scheduleForm.day_of_week,
            startTime: scheduleForm.start_time,
            endTime: scheduleForm.end_time,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setCollisionState(data.data);
        }
      } catch (err) {
        console.error('Collision check error:', err);
      } finally {
        setIsCheckingCollision(false);
      }
    };

    const timer = setTimeout(checkCollision, 300);
    return () => clearTimeout(timer);
  }, [
    showScheduleModal,
    scheduleForm.batch_id,
    scheduleForm.teacher_id,
    scheduleForm.room_id,
    scheduleForm.day_of_week,
    scheduleForm.start_time,
    scheduleForm.end_time,
    token,
  ]);

  // Query free teachers for current schedule time window
  useEffect(() => {
    if (!showScheduleModal) return;

    const fetchTeachers = async () => {
      try {
        const res = await fetch(
          `/api/v1/timetable/available-teachers?day=${scheduleForm.day_of_week}&start_time=${scheduleForm.start_time}&end_time=${scheduleForm.end_time}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success) {
          setAvailableTeachers(data.data || []);
          if (data.data?.length > 0 && !scheduleForm.teacher_id) {
            setScheduleForm(prev => ({ ...prev, teacher_id: data.data[0].id }));
          }
        }
      } catch (err) {
        console.error('Failed to query available teachers:', err);
      }
    };

    fetchTeachers();
  }, [showScheduleModal, scheduleForm.day_of_week, scheduleForm.start_time, scheduleForm.end_time, token]);

  // Handle schedule creation
  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (collisionState?.has_conflict) {
      alert(`Cannot schedule: ${collisionState.message}`);
      return;
    }

    setIsSubmittingSlot(true);
    try {
      const res = await fetch('/api/v1/timetable/timetable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          batch_id: scheduleForm.batch_id,
          subject_id: scheduleForm.subject_id,
          teacher_id: scheduleForm.teacher_id,
          room_id: scheduleForm.room_id || null,
          day_of_week: scheduleForm.day_of_week,
          start_time: scheduleForm.start_time,
          end_time: scheduleForm.end_time,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to schedule class');

      setShowScheduleModal(false);
      fetchBaseData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingSlot(false);
    }
  };

  // Open substitute modal & load free teachers for slot
  const openSubstituteModal = async (slot: TimetableSlot) => {
    setSubstituteSlot(slot);
    setSubstituteTeacherId('');
    try {
      const res = await fetch(
        `/api/v1/timetable/available-teachers?day=${slot.day_of_week}&start_time=${slot.start_time}&end_time=${slot.end_time}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        // Exclude current teacher from candidates
        const candidates = (data.data || []).filter((u: User) => u.id !== slot.teacher_id);
        setSubstituteCandidates(candidates);
        if (candidates.length > 0) setSubstituteTeacherId(candidates[0].id);
      }
    } catch (err) {
      console.error('Failed to load substitute candidates:', err);
    }
  };

  const handleAssignSubstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!substituteSlot || !substituteTeacherId) return;

    setIsAssigningSub(true);
    try {
      const res = await fetch(`/api/v1/timetable/timetable/${substituteSlot.id}/substitute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ substitute_teacher_id: substituteTeacherId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to assign substitute');

      setSubstituteSlot(null);
      fetchBaseData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAssigningSub(false);
    }
  };

  // Filter slots for active display
  const filteredSlots = slots.filter(s => {
    const matchBatch = selectedBatchId === 'all' || s.batch_id === selectedBatchId;
    const matchDay = selectedDay === 'all' || s.day_of_week === selectedDay;
    return matchBatch && matchDay;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Class Timetables & Schedules</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage class schedules, classroom allocations, conflict detection, and substitute faculty assignments.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => fetchBaseData()}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            title="Refresh Timetable"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Class</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
          {error}
        </div>
      )}

      {/* Control Bar: Filters & Multi-Room Status */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Batch Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Batch:</span>
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.shift.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Day Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedDay('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedDay === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Days
            </button>
            {DAYS.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDay(d.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedDay === d.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d.label.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Single-Room vs Multi-Room Indicator */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Room Allocation:</span>
          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
            multiRoomEnabled 
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {multiRoomEnabled ? 'Multi-Room Campus' : 'Single-Room Facility'}
          </span>
        </div>
      </div>

      {/* Slots Display Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs font-mono">Loading class schedule...</p>
        </div>
      ) : filteredSlots.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No classes scheduled for the selected criteria</p>
          <p className="text-xs text-slate-400 mt-1">Click "Schedule Class" above to add periods to the weekly master roster.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSlots.map(slot => (
            <div
              key={slot.id}
              className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 ${
                slot.substitute_teacher_id
                  ? 'border-amber-200 bg-gradient-to-br from-white to-amber-50/20'
                  : 'border-slate-200/90'
              }`}
            >
              <div>
                {/* Header: Day & Time */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    {slot.day_of_week}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-900">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{slot.start_time} - {slot.end_time}</span>
                  </div>
                </div>

                {/* Subject & Batch */}
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>{slot.subject_name || 'Class Period'}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Batch: <span className="text-slate-800 font-semibold">{slot.batch_name || slot.batch_id}</span>
                </p>

                {/* Teacher & Substitute Status */}
                <div className="mt-3 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Assigned Teacher:</span>
                    <span className={`font-bold ${slot.substitute_teacher_id ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {slot.teacher_name || 'Faculty Member'}
                    </span>
                  </div>

                  {slot.substitute_teacher_id && (
                    <div className="flex items-center justify-between text-amber-700 pt-1 border-t border-amber-100 font-medium">
                      <span className="flex items-center gap-1 text-[11px] font-bold">
                        <UserCheck className="w-3.5 h-3.5" /> Substitute:
                      </span>
                      <span className="font-bold text-xs">{slot.substitute_teacher_name || 'Substitute'}</span>
                    </div>
                  )}

                  {slot.room_name && (
                    <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-100 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" /> Physical Venue:
                      </span>
                      <span className="font-semibold text-slate-700">{slot.room_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => openSubstituteModal(slot)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{slot.substitute_teacher_id ? 'Change Substitute' : 'Assign Substitute'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Class Modal with Live Collision Prevention */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-slate-900 text-white rounded-lg">
                  <Calendar className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-extrabold text-slate-900">Schedule Academic Period</h2>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSlot} className="p-5 space-y-4">
              {/* Batch & Day Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Batch</label>
                  <select
                    value={scheduleForm.batch_id}
                    onChange={e => setScheduleForm(prev => ({ ...prev, batch_id: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                    required
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Day of Week</label>
                  <select
                    value={scheduleForm.day_of_week}
                    onChange={e => setScheduleForm(prev => ({ ...prev, day_of_week: e.target.value as DayOfWeek }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800 capitalize"
                    required
                  >
                    {DAYS.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time Interval */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Period Start Time</label>
                  <input
                    type="time"
                    value={scheduleForm.start_time}
                    onChange={e => setScheduleForm(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Period End Time</label>
                  <input
                    type="time"
                    value={scheduleForm.end_time}
                    onChange={e => setScheduleForm(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Subject Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Subject</label>
                <select
                  value={scheduleForm.subject_id}
                  onChange={e => setScheduleForm(prev => ({ ...prev, subject_id: e.target.value }))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                  required
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              {/* Teacher Selection (Filtered to Free Teachers) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Assign Faculty Member
                </label>
                <select
                  value={scheduleForm.teacher_id}
                  onChange={e => setScheduleForm(prev => ({ ...prev, teacher_id: e.target.value }))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                  required
                >
                  {availableTeachers.length === 0 ? (
                    <option value="">No free teachers found for this timeslot</option>
                  ) : (
                    availableTeachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.email})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Physical Room Selection (Hidden if Single-Room default setup) */}
              {multiRoomEnabled ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Physical Classroom</label>
                  <select
                    value={scheduleForm.room_id}
                    onChange={e => setScheduleForm(prev => ({ ...prev, room_id: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                  >
                    <option value="">Standard Batch Classroom</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name} (Cap: {r.capacity})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-mono">Single-Room Default Active:</span>
                  <span className="text-emerald-700 font-bold">Room auto-assigned to batch hall</span>
                </div>
              )}

              {/* Pre-Flight Collision Alert Banner */}
              {isCheckingCollision ? (
                <div className="p-3 rounded-xl bg-slate-50 text-slate-500 text-xs flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span>Checking for schedule conflicts...</span>
                </div>
              ) : collisionState?.has_conflict ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Schedule Conflict Detected:</span>
                    <span className="text-[11px] text-rose-700">{collisionState.message}</span>
                  </div>
                </div>
              ) : collisionState && !collisionState.has_conflict ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold">Slot Verified: No batch or teacher conflicts</span>
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSlot || collisionState?.has_conflict}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all ${
                    collisionState?.has_conflict
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-xs'
                  }`}
                >
                  {isSubmittingSlot ? 'Saving Period...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Substitute Modal */}
      {substituteSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/40">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-600 text-white rounded-lg">
                  <UserCheck className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Assign Substitute Faculty</h2>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {substituteSlot.subject_name} • {substituteSlot.start_time}-{substituteSlot.end_time}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSubstituteSlot(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignSubstitute} className="p-5 space-y-4">
              <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <p className="text-slate-500">Regular Faculty:</p>
                <p className="font-bold text-slate-900 mt-0.5">{substituteSlot.teacher_name || 'Assigned Teacher'}</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Select Available Substitute
                </label>
                {substituteCandidates.length === 0 ? (
                  <p className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                    No other faculty members are free during this timeslot.
                  </p>
                ) : (
                  <select
                    value={substituteTeacherId}
                    onChange={e => setSubstituteTeacherId(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                    required
                  >
                    {substituteCandidates.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.role})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSubstituteSlot(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigningSub || substituteCandidates.length === 0}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                >
                  {isAssigningSub ? 'Routing...' : 'Assign Substitute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
