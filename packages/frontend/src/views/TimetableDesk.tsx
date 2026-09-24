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
  BookOpen,
  Edit2,
  Trash2
} from 'lucide-react';
import { 
  AcademicProgram,
  Batch, 
  Subject, 
  Room, 
  TimetableSlot, 
  DayOfWeek, 
  User, 
  TimetableCollisionResult 
} from '@apex/shared-types';
import { PageHeading } from '../components/PageHeading';
import { useMobileOverlay } from '../lib/mobileOverlay';
import { campusToday, campusDayOfWeek } from '../lib/campusDate';

const DAYS: { id: DayOfWeek; label: string }[] = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
  { id: 'saturday', label: 'Saturday' },
  { id: 'sunday', label: 'Sunday' },
];

export const TimetableDesk: React.FC = () => {
  const { token } = useAuth();

  // State
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>(() => {
    const dow = campusDayOfWeek(campusToday());
    return dow === 'sunday' ? 'all' : dow;
  });

  // Schedule / Edit Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotToDelete, setSlotToDelete] = useState<TimetableSlot | null>(null);
  const [isDeletingSlot, setIsDeletingSlot] = useState(false);

  // Inline Quick Room Creator
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState('40');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

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
  const [substituteDate, setSubstituteDate] = useState<string>(() => campusToday());
  const [substituteReason, setSubstituteReason] = useState<string>('');

  useMobileOverlay('sheet', Boolean(showScheduleModal || substituteSlot || slotToDelete), () => {
    setShowScheduleModal(false);
    setSubstituteSlot(null);
    setSlotToDelete(null);
  });
  const [substituteTeacherId, setSubstituteTeacherId] = useState('');
  const [substituteCandidates, setSubstituteCandidates] = useState<User[]>([]);
  const [isAssigningSub, setIsAssigningSub] = useState(false);

  const fetchBaseData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [progRes, batchRes, subRes, roomRes, slotsRes, geoRes] = await Promise.all([
        fetch('/api/v1/academic/programs', { headers }),
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/academic/subjects', { headers }),
        fetch('/api/v1/timetable/rooms', { headers }),
        fetch('/api/v1/timetable/timetable', { headers }),
        fetch('/api/v1/geofence/config', { headers }),
      ]);

      const [progData, batchData, subData, roomData, slotsData, geoData] = await Promise.all([
        progRes.json(),
        batchRes.json(),
        subRes.json(),
        roomRes.json(),
        slotsRes.json(),
        geoRes.json(),
      ]);

      if (progData.success) setPrograms(progData.data || []);
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
            excludeSlotId: editingSlotId || undefined,
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
    editingSlotId,
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

  const openCreateModal = () => {
    setEditingSlotId(null);
    setCollisionState(null);
    const dow = campusDayOfWeek(campusToday());
    setScheduleForm({
      batch_id: selectedBatchId !== 'all' ? selectedBatchId : (batches[0]?.id || ''),
      subject_id: subjects[0]?.id || '',
      teacher_id: '',
      room_id: '',
      day_of_week: selectedDay !== 'all' ? selectedDay : (dow === 'sunday' ? 'monday' : dow),
      start_time: '08:30',
      end_time: '09:45',
    });
    setShowScheduleModal(true);
  };

  const openEditModal = (slot: TimetableSlot) => {
    setEditingSlotId(slot.id);
    setCollisionState(null);
    setScheduleForm({
      batch_id: slot.batch_id,
      subject_id: slot.subject_id,
      teacher_id: slot.teacher_id,
      room_id: slot.room_id || '',
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
    });
    setShowScheduleModal(true);
  };

  // Handle schedule creation or update
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (collisionState?.has_conflict) {
      alert(`Cannot schedule: ${collisionState.message}`);
      return;
    }

    setIsSubmittingSlot(true);
    try {
      const url = editingSlotId 
        ? `/api/v1/timetable/timetable/${editingSlotId}`
        : '/api/v1/timetable/timetable';
      const method = editingSlotId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
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
      if (!res.ok) throw new Error(data.error?.message || 'Failed to save class period');

      setShowScheduleModal(false);
      setEditingSlotId(null);
      fetchBaseData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingSlot(false);
    }
  };

  // Quick Room Creation
  const handleQuickAddRoom = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setIsCreatingRoom(true);
    try {
      const res = await fetch('/api/v1/timetable/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newRoomName.trim(),
          capacity: parseInt(newRoomCapacity, 10) || 40,
          is_active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to create room');
      if (data.data) {
        setRooms(prev => [...prev, data.data]);
        setScheduleForm(prev => ({ ...prev, room_id: data.data.id }));
        setNewRoomName('');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Delete Timetable Slot
  const handleDeleteSlot = async () => {
    if (!slotToDelete) return;
    setIsDeletingSlot(true);
    try {
      const res = await fetch(`/api/v1/timetable/timetable/${slotToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to remove period');

      setSlotToDelete(null);
      fetchBaseData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeletingSlot(false);
    }
  };

  // Open substitute modal & load free teachers for slot
  const openSubstituteModal = async (slot: TimetableSlot) => {
    setSubstituteSlot(slot);
    setSubstituteTeacherId('');
    setSubstituteDate(campusToday());
    setSubstituteReason('');
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
        body: JSON.stringify({ 
          substitute_teacher_id: substituteTeacherId,
          date: substituteDate,
          reason: substituteReason.trim() || undefined,
        }),
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
      {/* Header */}
      <PageHeading
        title="Timetable"
        description="Weekly class times, rooms, and substitute teachers."
        icon={<Calendar className="w-4 h-4 text-slate-700" />}
      >
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs shadow-[0_1px_2px_rgba(217,119,6,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-[0.98] transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Schedule Class</span>
        </button>
      </PageHeading>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
          {error}
        </div>
      )}

      {/* Control Bar: Filters & Multi-Room Status */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto min-w-0">
          {/* Batch Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <span className="text-xs font-semibold text-slate-600 shrink-0">Batch:</span>
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              className="w-full sm:w-auto max-w-full truncate text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Batches</option>
              {batches.map(b => {
                const progName = programs.find(p => p.id === b.program_id)?.name;
                return (
                  <option key={b.id} value={b.id}>
                    {progName ? `${progName} • ` : ''}{b.name} ({b.shift.toUpperCase()})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Mobile Day Selector (Eliminates horizontal scrolling hurdle) */}
          <div className="sm:hidden flex items-center gap-2 w-full min-w-0">
            <span className="text-xs font-semibold text-slate-600 shrink-0">Day:</span>
            <select
              value={selectedDay}
              onChange={e => setSelectedDay(e.target.value as DayOfWeek | 'all')}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Days</option>
              {DAYS.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Desktop/Tablet Day Tabs */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full no-scrollbar">
            <button
              onClick={() => setSelectedDay('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
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
            {multiRoomEnabled ? 'Several rooms' : 'One room'}
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
          <p className="text-sm font-bold text-slate-700">No classes on this day. Use Schedule Class.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSlots.map(slot => (
            <div
              key={slot.id}
              className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 ${
                slot.substitute_teacher_id
                  ? 'border-amber-200 bg-amber-50/40'
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
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>{slot.subject_name || 'Class Period'}</span>
                </h3>
                {(() => {
                  const bObj = batches.find(b => b.id === slot.batch_id);
                  const pName = programs.find(p => p.id === bObj?.program_id)?.name;
                  return (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Class & Section: <span className="text-slate-800 font-semibold">{pName ? `${pName} • ` : ''}{slot.batch_name || slot.batch_id}</span>
                    </p>
                  );
                })()}

                {/* Teacher & Substitute Status - Flat divider, no card-in-card */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Assigned Teacher:</span>
                    <span className={`font-semibold ${slot.substitute_teacher_id ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {slot.teacher_name || 'Faculty Member'}
                    </span>
                  </div>

                  {slot.substitute_teacher_id && (
                    <div className="flex items-center justify-between text-amber-700 pt-1 border-t border-amber-100/70 font-medium">
                      <span className="flex items-center gap-1 text-[11px] font-semibold">
                        <UserCheck className="w-3.5 h-3.5" /> Substitute:
                      </span>
                      <span className="font-semibold text-xs">{slot.substitute_teacher_name || 'Substitute'}</span>
                    </div>
                  )}

                  {slot.room_name && (
                    <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-100 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" /> Physical Venue:
                      </span>
                      <span className="font-medium text-slate-700">{slot.room_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => openSubstituteModal(slot)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{slot.substitute_teacher_id ? 'Change Substitute' : 'Assign Substitute'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(slot)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
                  title="Edit Period"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSlotToDelete(slot)}
                  className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-all cursor-pointer"
                  title="Remove Period"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mobile Floating Action Button (FAB) for Scheduling */}
      <button
        type="button"
        onClick={openCreateModal}
        className="sm:hidden fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 w-14 h-14 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all cursor-pointer"
        title="Schedule Class"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Schedule / Edit Class Modal with Live Collision Prevention */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92dvh] flex flex-col mobile-sheet-card">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-slate-900 text-white rounded-lg">
                  <Calendar className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-bold text-slate-900">
                  {editingSlotId ? 'Edit class' : 'Schedule class'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Batch & Day Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Batch</label>
                  <select
                    value={scheduleForm.batch_id}
                    onChange={e => setScheduleForm(prev => ({ ...prev, batch_id: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                    required
                  >
                    {batches.map(b => {
                      const progName = programs.find(p => p.id === b.program_id)?.name;
                      return (
                        <option key={b.id} value={b.id}>
                          {progName ? `${progName} • ` : ''}{b.name} ({b.shift.toUpperCase()})
                        </option>
                      );
                    })}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              {/* Physical Room Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Physical Classroom</label>
                <select
                  value={scheduleForm.room_id}
                  onChange={e => setScheduleForm(prev => ({ ...prev, room_id: e.target.value }))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                >
                  <option value="">Batch room</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name} (Cap: {r.capacity})</option>
                  ))}
                </select>

                {/* Inline quick room creator */}
                <div className="mt-2 p-2 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Room name"
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800"
                  />
                  <input
                    type="number"
                    placeholder="Cap"
                    value={newRoomCapacity}
                    onChange={e => setNewRoomCapacity(e.target.value)}
                    className="w-16 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-mono"
                    min={1}
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddRoom}
                    disabled={isCreatingRoom || !newRoomName.trim()}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    {isCreatingRoom ? 'Adding...' : 'Add room'}
                  </button>
                </div>
              </div>

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
                  className="h-8.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSlot || collisionState?.has_conflict}
                  className={`h-8.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all ${
                    collisionState?.has_conflict
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 shadow-xs cursor-pointer'
                  }`}
                >
                  {isSubmittingSlot ? 'Saving Period...' : (editingSlotId ? 'Save Changes' : 'Confirm Schedule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Substitute Modal */}
      {substituteSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl overflow-hidden mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/40">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-600 text-white rounded-lg">
                  <UserCheck className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Assign substitute</h2>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {substituteSlot.subject_name} • {substituteSlot.start_time}-{substituteSlot.end_time}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubstituteSlot(null)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignSubstitute} className="p-5 space-y-4">
              <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <p className="text-slate-500">Usual teacher:</p>
                <p className="font-bold text-slate-900 mt-0.5">{substituteSlot.teacher_name || 'Assigned Teacher'}</p>
              </div>

              {/* Date & Reason Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={substituteDate}
                    onChange={e => setSubstituteDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Reason (Optional)</label>
                  <input
                    type="text"
                    value={substituteReason}
                    onChange={e => setSubstituteReason(e.target.value)}
                    placeholder="e.g. Leave cover, duty"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  />
                </div>
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
                  className="h-8.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigningSub || substituteCandidates.length === 0}
                  className="h-8.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isAssigningSub ? 'Routing...' : 'Assign Substitute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Confirmation Sheet */}
      {slotToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-xl p-5 mobile-sheet-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Remove this period?</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {slotToDelete.subject_name} • {slotToDelete.start_time}-{slotToDelete.end_time}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              This will permanently remove the scheduled period for {slotToDelete.batch_name || 'this batch'} on {slotToDelete.day_of_week}.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSlotToDelete(null)}
                className="h-8.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSlot}
                disabled={isDeletingSlot}
                className="h-8.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeletingSlot ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
