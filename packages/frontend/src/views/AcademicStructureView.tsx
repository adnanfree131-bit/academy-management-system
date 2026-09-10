import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Layers, 
  BookOpen, 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Building2, 
  Sun, 
  Moon, 
  CheckCircle2, 
  AlertCircle, 
  GraduationCap, 
  FolderTree, 
  X, 
  RefreshCw, 
  Split, 
  ChevronRight, 
  ShieldCheck, 
  Check,
  DollarSign 
} from 'lucide-react';
import { AcademicProgram, Batch, Subject, SubjectGroup, Student } from '@apex/shared-types';

export const AcademicStructureView: React.FC = () => {
  const { token, tenant } = useAuth();
  
  // View mode: 'hierarchy' (Class-Centric Drill-Down) or 'catalog' (Master Subject Catalog)
  const [viewMode, setViewMode] = useState<'hierarchy' | 'catalog'>('hierarchy');

  // Core Data State
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selected Program for Drill-Down Hierarchy
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [searchClassQuery, setSearchClassQuery] = useState('');
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');

  // Modals
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showCompulsoryModal, setShowCompulsoryModal] = useState(false);
  const [showElectiveTrackModal, setShowElectiveTrackModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  // Forms
  const [programForm, setProgramForm] = useState({
    name: '',
    code: '',
    description: '',
    sort_order: 1,
  });

  const [programFeeSchedule, setProgramFeeSchedule] = useState({
    tuition: 8000,
    admission: 5000,
    exam_lab: 1500
  });

  const [compulsorySelectedSubjectIds, setCompulsorySelectedSubjectIds] = useState<string[]>([]);

  const [electiveTrackForm, setElectiveTrackForm] = useState({
    name: '',
    subject_ids: [] as string[],
  });

  const [batchForm, setBatchForm] = useState({
    program_id: '',
    name: '',
    shift: 'morning' as 'morning' | 'evening',
    academic_session: tenant?.academic_session || '2026-2027',
    max_capacity: 40,
    room_number: '',
  });

  const [batchFeeSchedule, setBatchFeeSchedule] = useState({
    tuition: 8000,
    admission: 5000,
    exam_lab: 1500
  });

  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    is_core: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all academic data
  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [progRes, batchRes, subRes, groupRes, studRes] = await Promise.all([
        fetch('/api/v1/academic/programs', { headers }),
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/academic/subjects', { headers }),
        fetch('/api/v1/academic/groups', { headers }),
        fetch('/api/v1/sis/students', { headers }),
      ]);

      const [progs, bts, subs, grps, studs] = await Promise.all([
        progRes.json(),
        batchRes.json(),
        subRes.json(),
        groupRes.json(),
        studRes.json(),
      ]);

      if (progs.success) {
        setPrograms(progs.data);
        if (progs.data.length > 0 && !selectedProgramId) {
          setSelectedProgramId(progs.data[0].id);
        }
      }
      if (bts.success) setBatches(bts.data);
      if (subs.success) setSubjects(subs.data);
      if (grps.success) setSubjectGroups(grps.data);
      if (studs.success) setStudents(studs.data);
    } catch (err: any) {
      console.error('Error fetching academic data:', err);
      setError('Failed to fetch academic hierarchy from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Keep selected program valid
  useEffect(() => {
    if (programs.length > 0) {
      if (!selectedProgramId || !programs.some(p => p.id === selectedProgramId)) {
        setSelectedProgramId(programs[0].id);
      }
    }
  }, [programs, selectedProgramId]);

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Selected Program and its associated hierarchy objects
  const activeProgram = useMemo(() => {
    return programs.find(p => p.id === selectedProgramId) || programs[0] || null;
  }, [programs, selectedProgramId]);

  const activeCompulsoryGroup = useMemo(() => {
    if (!activeProgram) return null;
    return subjectGroups.find(g => g.program_id === activeProgram.id && g.type === 'compulsory') || null;
  }, [subjectGroups, activeProgram]);

  const activeElectiveTracks = useMemo(() => {
    if (!activeProgram) return [];
    return subjectGroups.filter(g => g.program_id === activeProgram.id && g.type === 'elective_track');
  }, [subjectGroups, activeProgram]);

  const activeBatches = useMemo(() => {
    if (!activeProgram) return [];
    return batches.filter(b => b.program_id === activeProgram.id);
  }, [batches, activeProgram]);

  const activeStudents = useMemo(() => {
    if (!activeProgram) return [];
    return students.filter(s => s.program_id === activeProgram.id);
  }, [students, activeProgram]);

  // Total capacity metrics
  const totalCapacity = useMemo(() => batches.reduce((acc, b) => acc + (b.max_capacity || 0), 0), [batches]);
  const totalEnrolled = useMemo(() => students.length, [students]);
  const capacityPercent = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  // Filtered program list for left sidebar
  const filteredPrograms = useMemo(() => {
    return programs.filter(p => 
      p.name.toLowerCase().includes(searchClassQuery.toLowerCase()) ||
      (p.code || '').toLowerCase().includes(searchClassQuery.toLowerCase())
    );
  }, [programs, searchClassQuery]);

  // Filtered subjects for catalog
  const filteredCatalogSubjects = useMemo(() => {
    return subjects.filter(s => 
      s.name.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchCatalogQuery.toLowerCase())
    );
  }, [subjects, searchCatalogQuery]);

  // Handlers: Program
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !programForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const fee_schedule = [
        { fee_head_id: 'tuition', head_name: 'Monthly Tuition Fee', fee_type: 'tuition', name: 'Monthly Tuition Fee', amount: Number(programFeeSchedule.tuition) || 0, is_monthly: true, is_recurring: true },
        { fee_head_id: 'admission', head_name: 'Admission Fee', fee_type: 'admission', name: 'One-time Admission Fee', amount: Number(programFeeSchedule.admission) || 0, is_monthly: false, is_recurring: false },
        { fee_head_id: 'exam_lab', head_name: 'Exam & Lab Charges', fee_type: 'exam_lab', name: 'Exam & Lab Charges', amount: Number(programFeeSchedule.exam_lab) || 0, is_monthly: false, is_recurring: false },
      ];

      const payload = {
        ...programForm,
        code: programForm.code.trim() ? programForm.code.trim() : undefined,
        fee_schedule,
      };

      const res = await fetch('/api/v1/academic/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to create class');
      
      setShowProgramModal(false);
      setProgramForm({ name: '', code: '', description: '', sort_order: programs.length + 1 });
      setProgramFeeSchedule({ tuition: 8000, admission: 5000, exam_lab: 1500 });
      setSelectedProgramId(data.data.id);
      triggerSuccess(`Class "${data.data.name}" created with default fee baseline.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating class');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProgram = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete class "${name}"? This will also remove associated tracks and batch links.`)) return;
    try {
      const res = await fetch(`/api/v1/academic/programs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerSuccess(`Class "${name}" deleted.`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers: Compulsory Subjects
  const openManageCompulsoryModal = () => {
    setCompulsorySelectedSubjectIds(activeCompulsoryGroup?.subject_ids || []);
    setShowCompulsoryModal(true);
  };

  const handleSaveCompulsoryGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeProgram) return;

    setIsSubmitting(true);
    try {
      // If an existing compulsory group exists, delete it first to replace with clean set
      if (activeCompulsoryGroup) {
        await fetch(`/api/v1/academic/groups/${activeCompulsoryGroup.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (compulsorySelectedSubjectIds.length > 0) {
        const res = await fetch('/api/v1/academic/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            program_id: activeProgram.id,
            name: `${activeProgram.name} - Compulsory Core`,
            type: 'compulsory',
            subject_ids: compulsorySelectedSubjectIds,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to save compulsory subjects');
      }

      setShowCompulsoryModal(false);
      triggerSuccess(`Compulsory subjects updated for ${activeProgram.name}.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error saving compulsory subjects');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers: Elective Tracks
  const openAddElectiveTrackModal = () => {
    setElectiveTrackForm({ name: '', subject_ids: [] });
    setShowElectiveTrackModal(true);
  };

  const handleCreateElectiveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeProgram || !electiveTrackForm.name || electiveTrackForm.subject_ids.length === 0) {
      alert('Please provide a track name and select at least one subject.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/academic/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          program_id: activeProgram.id,
          name: electiveTrackForm.name,
          type: 'elective_track',
          subject_ids: electiveTrackForm.subject_ids,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to create elective track');

      setShowElectiveTrackModal(false);
      setElectiveTrackForm({ name: '', subject_ids: [] });
      triggerSuccess(`Elective Track "${data.data.name}" added to ${activeProgram.name}.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating elective track');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubjectGroup = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove track "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/academic/groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerSuccess(`Track "${name}" deleted.`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers: Batches
  const openAddBatchModal = () => {
    if (!activeProgram) return;
    const defaultTuition = activeProgram.fee_schedule?.find((f: any) => f.fee_type === 'tuition')?.amount ?? 8000;
    const defaultAdmission = activeProgram.fee_schedule?.find((f: any) => f.fee_type === 'admission')?.amount ?? 5000;
    const defaultExam = activeProgram.fee_schedule?.find((f: any) => f.fee_type === 'exam_lab')?.amount ?? 1500;
    setBatchFeeSchedule({
      tuition: defaultTuition,
      admission: defaultAdmission,
      exam_lab: defaultExam,
    });
    setBatchForm({
      program_id: activeProgram.id,
      name: '',
      shift: 'morning',
      academic_session: tenant?.academic_session || '2026-2027',
      max_capacity: 40,
      room_number: '',
    });
    setShowBatchModal(true);
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !batchForm.program_id || !batchForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const fee_schedule = [
        { fee_head_id: 'tuition', head_name: 'Monthly Tuition Fee', fee_type: 'tuition', name: 'Monthly Tuition Fee', amount: Number(batchFeeSchedule.tuition) || 0, is_monthly: true, is_recurring: true },
        { fee_head_id: 'admission', head_name: 'Admission Fee', fee_type: 'admission', name: 'One-time Admission Fee', amount: Number(batchFeeSchedule.admission) || 0, is_monthly: false, is_recurring: false },
        { fee_head_id: 'exam_lab', head_name: 'Exam & Lab Charges', fee_type: 'exam_lab', name: 'Exam & Lab Charges', amount: Number(batchFeeSchedule.exam_lab) || 0, is_monthly: false, is_recurring: false },
      ];

      const res = await fetch('/api/v1/academic/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...batchForm,
          fee_schedule,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to create section/batch');

      setShowBatchModal(false);
      triggerSuccess(`Section/Batch "${data.data.name}" allocated with fee schedule.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating section');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBatch = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete section/batch "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/academic/batches/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerSuccess(`Section "${name}" deleted.`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers: Subject Catalog
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !subjectForm.name || !subjectForm.code) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/academic/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(subjectForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to create subject');

      setShowSubjectModal(false);
      setSubjectForm({ name: '', code: '', is_core: true });
      triggerSuccess(`Subject "${data.data.name}" added to catalog.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating subject');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete subject "${name}" from the catalog?`)) return;
    try {
      const res = await fetch(`/api/v1/academic/subjects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerSuccess(`Subject "${name}" deleted.`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
            <Layers className="w-5 h-5 text-white" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Academic Structure & Classes</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                Session {tenant?.academic_session || '2026-2027'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage classes, compulsory subjects, elective streams, and section batches.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={fetchData} 
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'hierarchy'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Split className="w-3.5 h-3.5 text-indigo-600" />
              <span>Class Hierarchy</span>
            </button>
            <button
              onClick={() => setViewMode('catalog')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'catalog'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>Subject Catalog</span>
              <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1 py-0.2 rounded-full">
                {subjects.length}
              </span>
            </button>
          </div>

          <button
            onClick={() => setShowProgramModal(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>New Class</span>
          </button>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Classes / Grades</span>
            <GraduationCap className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">{programs.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">Configured academic programs</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Elective Tracks</span>
            <Split className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            {subjectGroups.filter(g => g.type === 'elective_track').length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Pre-Med, Pre-Eng, ICS streams</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Batches / Sections</span>
            <FolderTree className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">{batches.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">Morning & evening shift sections</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Total Occupancy</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-slate-900 font-mono">{totalEnrolled}</p>
            <span className="text-xs font-mono text-slate-400">/ {totalCapacity} seats</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full ${
                capacityPercent > 90 ? 'bg-rose-500' : capacityPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, capacityPercent)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          VIEW MODE 1: CLASS-CENTRIC DRILL-DOWN HIERARCHY
          ===================================================================== */}
      {viewMode === 'hierarchy' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* LEFT 4 COLS: Class Selector Panel */}
          <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                Select Academic Class
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {filteredPrograms.length} Classes
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search class or code..."
                value={searchClassQuery}
                onChange={e => setSearchClassQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredPrograms.map(p => {
                const isSelected = p.id === activeProgram?.id;
                const classBatches = batches.filter(b => b.program_id === p.id);
                const classTracks = subjectGroups.filter(g => g.program_id === p.id && g.type === 'elective_track');
                const hasCompulsory = subjectGroups.some(g => g.program_id === p.id && g.type === 'compulsory');
                const classStudentCount = students.filter(s => s.program_id === p.id).length;

                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProgramId(p.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                        : 'bg-white border-slate-200/70 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {p.code}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {p.name}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-medium text-slate-500">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        {hasCompulsory ? 'Core Set' : 'No Core'}
                      </span>
                      <span>•</span>
                      <span>{classTracks.length} Tracks</span>
                      <span>•</span>
                      <span>{classBatches.length} Sections</span>
                      <span>•</span>
                      <span className="font-mono font-bold text-slate-700">{classStudentCount} Students</span>
                    </div>
                  </button>
                );
              })}

              {filteredPrograms.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No classes matching query.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 8 COLS: Deep Class Hierarchy Workspace */}
          <div className="lg:col-span-8 space-y-5">
            {activeProgram ? (
              <>
                {/* Active Class Header Card */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                        {activeProgram.code}
                      </span>
                      <h2 className="text-lg font-black text-slate-900">
                        {activeProgram.name}
                      </h2>
                    </div>
                    {activeProgram.description && (
                      <p className="text-xs text-slate-500 mt-1">
                        {activeProgram.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-600 font-medium">
                      <span>Enrolled Students: <strong className="font-mono text-slate-900">{activeStudents.length}</strong></span>
                      <span>•</span>
                      <span>Sections: <strong className="font-mono text-slate-900">{activeBatches.length}</strong></span>
                      <span>•</span>
                      <span>Display Order: <strong className="font-mono text-slate-900">#{activeProgram.sort_order}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={openAddBatchModal}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      <span>Add Section</span>
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(activeProgram.id, activeProgram.name)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Class"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* SECTION 1: Compulsory Subjects Bucket */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-4 h-4 text-emerald-600" />
                      </span>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Compulsory Subjects (Mandatory Core)
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Auto-enrolled for every student admitted to {activeProgram.name} with zero manual clicking.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={openManageCompulsoryModal}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all"
                    >
                      {activeCompulsoryGroup ? 'Configure Core Subjects' : '+ Add Core Subjects'}
                    </button>
                  </div>

                  {activeCompulsoryGroup && activeCompulsoryGroup.subject_ids.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {activeCompulsoryGroup.subject_ids.map(subId => {
                        const sub = subjects.find(s => s.id === subId);
                        return (
                          <span 
                            key={subId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold"
                          >
                            <span className="font-mono text-[10px] bg-emerald-200/80 px-1 py-0.2 rounded text-emerald-900">
                              {sub?.code || 'SUB'}
                            </span>
                            <span>{sub?.name || 'Subject'}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                      No compulsory subjects attached to this class. Click "Configure Core Subjects" above to select mandatory courses from the catalog.
                    </div>
                  )}
                </div>

                {/* SECTION 2: Elective Tracks & Streams */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                        <Split className="w-4 h-4 text-purple-600" />
                      </span>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Elective Tracks & Academic Streams ({activeElectiveTracks.length})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Academic majors (e.g. Pre-Med, Pre-Eng, ICS). Students choose one track during admission.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={openAddElectiveTrackModal}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Elective Track</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {activeElectiveTracks.map(track => {
                      const trackStudents = activeStudents.filter(s => s.elective_group_id === track.id);

                      return (
                        <div key={track.id} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 hover:bg-white hover:border-purple-300 transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-bold text-xs text-slate-900">{track.name}</span>
                                <div className="text-[10px] font-mono text-purple-700 font-semibold mt-0.5">
                                  {trackStudents.length} Students Enrolled
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteSubjectGroup(track.id, track.name)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                                title="Delete Track"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {track.subject_ids.map(subId => {
                                const sub = subjects.find(s => s.id === subId);
                                return (
                                  <span
                                    key={subId}
                                    className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium shadow-xs"
                                  >
                                    {sub?.name || 'Subject'}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {activeElectiveTracks.length === 0 && (
                      <div className="col-span-full p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        No elective tracks configured for this class. (If this class has no electives, students will only be enrolled in Compulsory subjects).
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 3: Sections & Batches with Track Roster Breakdown */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        <FolderTree className="w-4 h-4 text-blue-600" />
                      </span>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Class Sections & Cohorts ({activeBatches.length})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Physical batch rooms, shifts, and track population breakdown.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={openAddBatchModal}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all"
                    >
                      + Create Section
                    </button>
                  </div>

                  <div className="space-y-3 pt-1">
                    {activeBatches.map(b => {
                      const batchStudents = activeStudents.filter(s => s.batch_id === b.id);
                      const enrolledCount = batchStudents.length || b.current_enrollment || 0;
                      const maxCap = b.max_capacity || 40;
                      const percent = Math.min(100, Math.round((enrolledCount / maxCap) * 100));

                      return (
                        <div key={b.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:border-slate-300 transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900">{b.name}</span>
                                {b.shift === 'morning' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    <Sun className="w-3 h-3 text-amber-500" />
                                    Morning
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                    <Moon className="w-3 h-3 text-indigo-500" />
                                    Evening
                                  </span>
                                )}
                                {b.room_number && (
                                  <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                                    <Building2 className="w-3 h-3" />
                                    {b.room_number}
                                  </span>
                                )}
                                {b.fee_schedule && b.fee_schedule.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <DollarSign className="w-3 h-3 text-emerald-600" />
                                    PKR {b.fee_schedule.find(f => f.fee_type === 'tuition')?.amount?.toLocaleString() || '0'}/mo
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-[11px] font-mono">
                                  <strong>{enrolledCount}</strong> / {maxCap} seats ({percent}%)
                                </div>
                                <div className="w-28 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                  <div 
                                    className={`h-1.5 rounded-full ${
                                      percent > 90 ? 'bg-rose-500' : percent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${percent}%` }}
                                  ></div>
                                </div>
                              </div>

                              <button
                                onClick={() => handleDeleteBatch(b.id, b.name)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                                title="Delete Batch"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Track Population in this section */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="text-slate-400 font-medium">Track Breakdown:</span>
                            {activeElectiveTracks.map(t => {
                              const inTrackCount = batchStudents.filter(s => s.elective_group_id === t.id).length;
                              return (
                                <span key={t.id} className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-slate-700 font-medium">
                                  {t.name}: <strong className="text-slate-900 font-mono">{inTrackCount}</strong>
                                </span>
                              );
                            })}
                            {activeElectiveTracks.length === 0 && (
                              <span className="text-slate-500 italic">All students taking Core curriculum</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {activeBatches.length === 0 && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        No sections allocated for this class yet. Click "+ Create Section" to schedule morning or evening cohorts.
                      </div>
                    )}
                  </div>
                </div>

              </>
            ) : (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center text-slate-400">
                <GraduationCap className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <h3 className="text-sm font-bold text-slate-800">No Academic Class Selected</h3>
                <p className="text-xs text-slate-500 mt-1">Select a class from the left panel or click "+ New Class" to create one.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* =====================================================================
          VIEW MODE 2: MASTER SUBJECT CATALOG
          ===================================================================== */}
      {viewMode === 'catalog' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                Master Subject Catalog ({subjects.length})
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Centralized course catalog across your entire institution. Used to assemble core buckets and elective streams.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search subject or code..."
                  value={searchCatalogQuery}
                  onChange={e => setSearchCatalogQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={() => setShowSubjectModal(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add Subject</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredCatalogSubjects.map(s => {
              // Find which groups use this subject
              const usingGroups = subjectGroups.filter(g => g.subject_ids.includes(s.id));

              return (
                <div key={s.id} className="border border-slate-200 rounded-xl p-3.5 bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                          {s.code}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 mt-1">{s.name}</h4>
                      </div>
                      <button
                        onClick={() => handleDeleteSubject(s.id, s.name)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                        title="Delete Subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                      Used in <strong className="text-slate-800 font-mono">{usingGroups.length}</strong> academic tracks/groups
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredCatalogSubjects.length === 0 && (
              <div className="col-span-full py-10 text-center text-slate-400 text-xs">
                No subjects found. Click "+ Add Subject" to expand the catalog.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALS
          ===================================================================== */}

      {/* MODAL 1: CREATE NEW CLASS */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white">
                  <GraduationCap className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Add New Class / Grade</h2>
                  <p className="text-[11px] text-slate-500">Configure a grade level or preparatory class</p>
                </div>
              </div>
              <button onClick={() => setShowProgramModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProgram} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class / Grade Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FSc Pre-Medical, Class 10 - Matric"
                  value={programForm.name}
                  onChange={e => setProgramForm({ ...programForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">
                      Class Code <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Auto if blank (e.g. FSC-PM)"
                    value={programForm.code}
                    onChange={e => setProgramForm({ ...programForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Leave blank to auto-generate</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">Display Order</label>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={programForm.sort_order}
                    onChange={e => setProgramForm({ ...programForm, sort_order: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Menu sequence (1 = Top priority)</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Description / Curriculum Scope</label>
                <textarea
                  rows={2}
                  placeholder="Brief curriculum notes..."
                  value={programForm.description}
                  onChange={e => setProgramForm({ ...programForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Default Fee Schedule Baseline */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    Default Class Fee Baseline
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                    Est. First Month: PKR {(Number(programFeeSchedule.tuition) || 0) + (Number(programFeeSchedule.admission) || 0) + (Number(programFeeSchedule.exam_lab) || 0)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Batches in this class inherit these defaults automatically during enrollment & billing.
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Monthly Tuition (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      value={programFeeSchedule.tuition}
                      onChange={e => setProgramFeeSchedule({ ...programFeeSchedule, tuition: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Admission Fee (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      value={programFeeSchedule.admission}
                      onChange={e => setProgramFeeSchedule({ ...programFeeSchedule, admission: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Exam / Lab Fee (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      value={programFeeSchedule.exam_lab}
                      onChange={e => setProgramFeeSchedule({ ...programFeeSchedule, exam_lab: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProgramModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANAGE COMPULSORY SUBJECTS */}
      {showCompulsoryModal && activeProgram && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-600 text-white">
                  <Check className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Compulsory Subjects for {activeProgram.name}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Select the mandatory courses required for every student in this class.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCompulsoryModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCompulsoryGroup} className="space-y-4 mt-4 text-xs">
              <div className="max-h-72 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                {subjects.map(s => {
                  const isChecked = compulsorySelectedSubjectIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setCompulsorySelectedSubjectIds([...compulsorySelectedSubjectIds, s.id]);
                            } else {
                              setCompulsorySelectedSubjectIds(compulsorySelectedSubjectIds.filter(id => id !== s.id));
                            }
                          }}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <span>{s.name}</span>
                      </div>
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {s.code}
                      </span>
                    </label>
                  );
                })}

                {subjects.length === 0 && (
                  <div className="text-center py-6 text-slate-400">
                    No subjects in catalog. Add subjects in Subject Catalog first.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>{compulsorySelectedSubjectIds.length} subjects selected</span>
                <button
                  type="button"
                  onClick={() => setCompulsorySelectedSubjectIds([])}
                  className="text-rose-600 hover:underline"
                >
                  Clear all
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompulsoryModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Compulsory Core'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE ELECTIVE TRACK */}
      {showElectiveTrackModal && activeProgram && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-purple-600 text-white">
                  <Split className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Add Elective Track for {activeProgram.name}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Group elective subjects into an academic stream (e.g. Pre-Medical, Pre-Engineering, ICS).
                  </p>
                </div>
              </div>
              <button onClick={() => setShowElectiveTrackModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateElectiveTrack} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Track / Stream Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pre-Medical Track, Pre-Engineering Track"
                  value={electiveTrackForm.name}
                  onChange={e => setElectiveTrackForm({ ...electiveTrackForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Select Subjects in this Track <span className="text-rose-500">*</span>
                </label>
                <div className="max-h-64 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {subjects.map(s => {
                    const isChecked = electiveTrackForm.subject_ids.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-purple-50 border-purple-300 text-purple-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setElectiveTrackForm({
                                  ...electiveTrackForm,
                                  subject_ids: [...electiveTrackForm.subject_ids, s.id],
                                });
                              } else {
                                setElectiveTrackForm({
                                  ...electiveTrackForm,
                                  subject_ids: electiveTrackForm.subject_ids.filter(id => id !== s.id),
                                });
                              }
                            }}
                            className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                          />
                          <span>{s.name}</span>
                        </div>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {s.code}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowElectiveTrackModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Track'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE SECTION / BATCH */}
      {showBatchModal && activeProgram && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-600 text-white">
                  <FolderTree className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Allocate Section for {activeProgram.name}
                  </h2>
                  <p className="text-[11px] text-slate-500">Define shift and room capacity limits</p>
                </div>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Section / Batch Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Section Alpha - Morning"
                  value={batchForm.name}
                  onChange={e => setBatchForm({ ...batchForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Shift <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={batchForm.shift}
                    onChange={e => setBatchForm({ ...batchForm, shift: e.target.value as 'morning' | 'evening' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="morning">Morning Shift</option>
                    <option value="evening">Evening Shift</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Max Capacity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={batchForm.max_capacity}
                    onChange={e => setBatchForm({ ...batchForm, max_capacity: parseInt(e.target.value) || 40 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Room / Hall Number</label>
                  <input
                    type="text"
                    placeholder="e.g. Room 204"
                    value={batchForm.room_number}
                    onChange={e => setBatchForm({ ...batchForm, room_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Academic Session</label>
                  <input
                    type="text"
                    value={batchForm.academic_session}
                    onChange={e => setBatchForm({ ...batchForm, academic_session: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Batch Fee Schedule */}
              <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    Section Fee Schedule
                  </span>
                  <span className="text-[10px] font-mono text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full font-bold">
                    Monthly Tuition: PKR {batchFeeSchedule.tuition}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Inherited from class baseline. Can be customized for this specific section/cohort.
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Monthly Tuition (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      value={batchFeeSchedule.tuition}
                      onChange={e => setBatchFeeSchedule({ ...batchFeeSchedule, tuition: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Admission Fee (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      value={batchFeeSchedule.admission}
                      onChange={e => setBatchFeeSchedule({ ...batchFeeSchedule, admission: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Exam / Lab Fee (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      value={batchFeeSchedule.exam_lab}
                      onChange={e => setBatchFeeSchedule({ ...batchFeeSchedule, exam_lab: Number(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Allocating...' : 'Allocate Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD SUBJECT TO CATALOG */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Add Subject to Catalog</h2>
                  <p className="text-[11px] text-slate-500">Define course code and title in master repository</p>
                </div>
              </div>
              <button onClick={() => setShowSubjectModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Subject Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mathematics, Advanced Physics"
                  value={subjectForm.name}
                  onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Subject Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MATH-101, PHY-201"
                  value={subjectForm.code}
                  onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AcademicStructureView;
