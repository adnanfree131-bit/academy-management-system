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
  Filter,
  X,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { AcademicProgram, Batch, Subject, SubjectGroup, Student } from '@apex/shared-types';

export const AcademicStructureView: React.FC = () => {
  const { token, tenant } = useAuth();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'classes' | 'batches' | 'subjects'>('classes');

  // Core Data State
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [batchProgramFilter, setBatchProgramFilter] = useState<string>('all');
  const [batchShiftFilter, setBatchShiftFilter] = useState<string>('all');

  // Modal States
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  // Program Form
  const [programForm, setProgramForm] = useState({
    name: '',
    code: '',
    description: '',
    sort_order: 1,
  });

  // Batch Form
  const [batchForm, setBatchForm] = useState({
    program_id: '',
    name: '',
    shift: 'morning' as 'morning' | 'evening',
    academic_session: tenant?.academic_session || '2026-2027',
    max_capacity: 40,
    room_number: '',
  });

  // Subject Form
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

      if (progs.success) setPrograms(progs.data);
      if (bts.success) setBatches(bts.data);
      if (subs.success) setSubjects(subs.data);
      if (grps.success) setSubjectGroups(grps.data);
      if (studs.success) setStudents(studs.data);
    } catch (err: any) {
      console.error('Error fetching academic data:', err);
      setError('Failed to fetch academic configuration from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Flash success helper
  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Create Program Handler
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !programForm.name || !programForm.code) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/academic/programs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(programForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create class');
      }

      setShowProgramModal(false);
      setProgramForm({ name: '', code: '', description: '', sort_order: programs.length + 1 });
      triggerSuccess(`Class "${data.data.name}" created successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error saving class');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Batch Handler
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !batchForm.program_id || !batchForm.name) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/academic/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(batchForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create section/batch');
      }

      setShowBatchModal(false);
      setBatchForm({
        program_id: '',
        name: '',
        shift: 'morning',
        academic_session: tenant?.academic_session || '2026-2027',
        max_capacity: 40,
        room_number: '',
      });
      triggerSuccess(`Section/Batch "${data.data.name}" created successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating section');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Subject Handler
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !subjectForm.name || !subjectForm.code) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/academic/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(subjectForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create subject');
      }

      setShowSubjectModal(false);
      setSubjectForm({ name: '', code: '', is_core: true });
      triggerSuccess(`Subject "${data.data.name}" added to curriculum.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating subject');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Handlers
  const handleDeleteProgram = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete class "${name}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/v1/academic/programs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerSuccess(`Class "${name}" removed.`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBatch = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete batch/section "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/academic/batches/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerSuccess(`Batch "${name}" removed.`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete subject "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/academic/subjects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerSuccess(`Subject "${name}" removed.`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quick Open Batch Modal with Program selected
  const handleOpenBatchForProgram = (programId: string) => {
    setBatchForm(prev => ({ ...prev, program_id: programId }));
    setShowBatchModal(true);
  };

  // Aggregated Stats
  const totalCapacity = useMemo(() => batches.reduce((acc, b) => acc + (b.max_capacity || 0), 0), [batches]);
  const totalEnrolled = useMemo(() => students.length, [students]);
  const capacityPercent = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  // Filtered Programs
  const filteredPrograms = useMemo(() => {
    return programs.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [programs, searchQuery]);

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.room_number && b.room_number.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesProg = batchProgramFilter === 'all' || b.program_id === batchProgramFilter;
      const matchesShift = batchShiftFilter === 'all' || b.shift === batchShiftFilter;
      return matchesSearch && matchesProg && matchesShift;
    });
  }, [batches, searchQuery, batchProgramFilter, batchShiftFilter]);

  // Filtered Subjects
  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [subjects, searchQuery]);

  return (
    <div className="space-y-5">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
            <Layers className="w-5 h-5 text-indigo-400" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900">Classes & Batches</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Session {tenant?.academic_session || '2026-2027'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Organize classes, grade levels, sections, shifts, and curriculum subjects
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
          
          {activeTab === 'classes' && (
            <button
              onClick={() => setShowProgramModal(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>New Class / Grade</span>
            </button>
          )}

          {activeTab === 'batches' && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Create Batch / Section</span>
            </button>
          )}

          {activeTab === 'subjects' && (
            <button
              onClick={() => setShowSubjectModal(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Add Subject</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Classes / Grades */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Classes / Grades</span>
            <GraduationCap className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">{programs.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">Configured academic programs</p>
        </div>

        {/* Batches / Sections */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Batches & Sections</span>
            <FolderTree className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">{batches.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">Active morning & evening sections</p>
        </div>

        {/* Total Seat Capacity */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Seat Occupancy</span>
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

        {/* Subjects & Groups */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Curriculum Subjects</span>
            <BookOpen className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">{subjects.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">{subjectGroups.length} elective / track groups</p>
        </div>

      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('classes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'classes'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Classes & Grades</span>
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full font-semibold text-slate-600">
                {programs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('batches')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'batches'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Batches & Sections</span>
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full font-semibold text-slate-600">
                {batches.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('subjects')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'subjects'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Subjects & Tracks</span>
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full font-semibold text-slate-600">
                {subjects.length}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* ===================================================================
            TAB 1: CLASSES & GRADES (PROGRAMS)
            =================================================================== */}
        {activeTab === 'classes' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPrograms.map((prog) => {
                const assignedBatches = batches.filter(b => b.program_id === prog.id);
                const progStudents = students.filter(s => s.program_id === prog.id);
                const progCapacity = assignedBatches.reduce((acc, b) => acc + (b.max_capacity || 0), 0);

                return (
                  <div 
                    key={prog.id} 
                    className="border border-slate-200/90 rounded-xl p-4 bg-white hover:border-indigo-200 hover:shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-1.5 py-0.5 rounded">
                              {prog.code}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Order #{prog.sort_order}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 mt-1">{prog.name}</h3>
                        </div>

                        <button 
                          onClick={() => handleDeleteProgram(prog.id, prog.name)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors"
                          title="Delete class"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {prog.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                          {prog.description}
                        </p>
                      )}

                      {/* Class Stats */}
                      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-500 block font-medium">Sections / Batches</span>
                          <span className="font-bold text-slate-800 font-mono text-sm">
                            {assignedBatches.length}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-500 block font-medium">Students Enrolled</span>
                          <span className="font-bold text-slate-800 font-mono text-sm">
                            {progStudents.length}
                            {progCapacity > 0 && (
                              <span className="text-[10px] text-slate-400 font-normal"> / {progCapacity}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-2 flex items-center justify-between">
                      <button
                        onClick={() => handleOpenBatchForProgram(prog.id)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Section</span>
                      </button>

                      <button
                        onClick={() => {
                          setBatchProgramFilter(prog.id);
                          setActiveTab('batches');
                        }}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                      >
                        <span>View Batches</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredPrograms.length === 0 && (
                <div className="col-span-full text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No classes found</p>
                  <p className="text-xs text-slate-400 mt-0.5">Click "+ New Class / Grade" above to add your first academic level.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: BATCHES & SECTIONS
            =================================================================== */}
        {activeTab === 'batches' && (
          <div className="space-y-4">
            
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mr-1">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter:</span>
              </div>

              {/* Program Filter */}
              <select
                value={batchProgramFilter}
                onChange={(e) => setBatchProgramFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="all">All Classes & Programs</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>

              {/* Shift Filter */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setBatchShiftFilter('all')}
                  className={`px-2 py-1 rounded-md font-medium transition-all ${
                    batchShiftFilter === 'all' ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All Shifts
                </button>
                <button
                  onClick={() => setBatchShiftFilter('morning')}
                  className={`px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                    batchShiftFilter === 'morning' ? 'bg-white text-amber-700 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sun className="w-3 h-3 text-amber-500" />
                  <span>Morning</span>
                </button>
                <button
                  onClick={() => setBatchShiftFilter('evening')}
                  className={`px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                    batchShiftFilter === 'evening' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Moon className="w-3 h-3 text-indigo-500" />
                  <span>Evening</span>
                </button>
              </div>
            </div>

            {/* Batches Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Section / Batch Name</th>
                    <th className="px-4 py-3">Class / Program</th>
                    <th className="px-4 py-3">Shift</th>
                    <th className="px-4 py-3">Room / Hall</th>
                    <th className="px-4 py-3">Capacity & Occupancy</th>
                    <th className="px-4 py-3">Academic Session</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBatches.map((b) => {
                    const prog = programs.find(p => p.id === b.program_id);
                    const batchStudents = students.filter(s => s.batch_id === b.id);
                    const enrolledCount = batchStudents.length || b.current_enrollment || 0;
                    const maxCap = b.max_capacity || 40;
                    const percent = Math.min(100, Math.round((enrolledCount / maxCap) * 100));

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{b.name}</div>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {b.id.substring(0, 8)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-700">
                            {prog?.name || 'Assigned Class'}
                          </span>
                          {prog && (
                            <span className="ml-1.5 font-mono text-[10px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded">
                              {prog.code}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
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
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {b.room_number ? (
                            <span className="flex items-center gap-1 text-slate-800">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {b.room_number}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not assigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                            <span className="font-bold text-slate-800">{enrolledCount} enrolled</span>
                            <span className="text-slate-400">/ {maxCap} seats</span>
                          </div>
                          <div className="w-32 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full ${
                                percent > 90 ? 'bg-rose-500' : percent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                          {b.academic_session || tenant?.academic_session || '2026-2027'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteBatch(b.id, b.name)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors"
                            title="Delete Batch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredBatches.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        <FolderTree className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">No batches or sections found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Click "+ Create Batch / Section" to add a new class section.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: SUBJECTS & CURRICULUM TRACKS
            =================================================================== */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            
            {/* Subjects Grid */}
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Curriculum Subjects ({filteredSubjects.length})
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredSubjects.map((s) => (
                  <div 
                    key={s.id}
                    className="border border-slate-200/90 rounded-xl p-3 bg-white hover:border-indigo-200 hover:shadow-xs transition-all flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                          {s.code}
                        </span>
                        {s.is_core ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                            Core
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">
                            Elective
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-900 mt-1">{s.name}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteSubject(s.id, s.name)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors"
                      title="Delete Subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {filteredSubjects.length === 0 && (
                  <div className="col-span-full text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <BookOpen className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-700">No subjects found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Subject Groups / Curriculum Tracks */}
            {subjectGroups.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Subject Tracks & Combinations ({subjectGroups.length})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {subjectGroups.map((grp) => {
                    const prog = programs.find(p => p.id === grp.program_id);
                    const groupSubjectNames = grp.subject_ids
                      .map(id => subjects.find(s => s.id === id)?.name)
                      .filter(Boolean);

                    return (
                      <div key={grp.id} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                              {prog?.name || 'Academic Program'}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900">{grp.name}</h4>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {grp.type === 'compulsory' ? 'Compulsory' : 'Elective Track'}
                          </span>
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {groupSubjectNames.map((name, idx) => (
                            <span 
                              key={idx}
                              className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-lg font-medium shadow-xs"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* ===================================================================
          MODAL 1: NEW PROGRAM / CLASS
          =================================================================== */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white">
                  <GraduationCap className="w-4 h-4 text-indigo-400" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Add New Class / Grade</h2>
                  <p className="text-[11px] text-slate-500">Configure a grade level or preparatory class</p>
                </div>
              </div>
              <button 
                onClick={() => setShowProgramModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
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
                  placeholder="e.g. Class 10 - Matric, FSc Pre-Medical"
                  value={programForm.name}
                  onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Class Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CLS-10, FSC-MED"
                    value={programForm.code}
                    onChange={(e) => setProgramForm({ ...programForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={programForm.sort_order}
                    onChange={(e) => setProgramForm({ ...programForm, sort_order: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Description / Curriculum Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief overview of curriculum or syllabus scope..."
                  value={programForm.description}
                  onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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

      {/* ===================================================================
          MODAL 2: NEW BATCH / SECTION
          =================================================================== */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-600 text-white">
                  <FolderTree className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Create Section / Batch</h2>
                  <p className="text-[11px] text-slate-500">Allocate students to a class shift and room</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class / Program <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={batchForm.program_id}
                  onChange={(e) => setBatchForm({ ...batchForm, program_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Class...</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Section / Batch Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Section A - Morning, Batch Alpha"
                  value={batchForm.name}
                  onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Shift <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={batchForm.shift}
                    onChange={(e) => setBatchForm({ ...batchForm, shift: e.target.value as 'morning' | 'evening' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    onChange={(e) => setBatchForm({ ...batchForm, max_capacity: parseInt(e.target.value) || 40 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Room / Hall Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Room 204, Lab 1"
                    value={batchForm.room_number}
                    onChange={(e) => setBatchForm({ ...batchForm, room_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Academic Session
                  </label>
                  <input
                    type="text"
                    value={batchForm.academic_session}
                    onChange={(e) => setBatchForm({ ...batchForm, academic_session: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 3: NEW SUBJECT
          =================================================================== */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Add Subject to Curriculum</h2>
                  <p className="text-[11px] text-slate-500">Define course subject and core/elective status</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSubjectModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
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
                  placeholder="e.g. Mathematics, Organic Chemistry, English"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
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
                  placeholder="e.g. MATH-101, CHEM-201"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_core_checkbox"
                  checked={subjectForm.is_core}
                  onChange={(e) => setSubjectForm({ ...subjectForm, is_core: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="is_core_checkbox" className="text-slate-700 font-medium cursor-pointer">
                  Standard Core Subject (Compulsory for all enrolled students in track)
                </label>
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
                  {isSubmitting ? 'Saving...' : 'Add Subject'}
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
