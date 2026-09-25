import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Layers, 
  BookOpen, 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  GraduationCap, 
  FolderTree, 
  X, 
  Split, 
  ChevronRight, 
  Receipt,
  Pencil,
  ArrowRightLeft,
  GripVertical,
  DollarSign,
  SlidersHorizontal,
  MoreVertical,
  ArrowLeft,
} from 'lucide-react';
import { AcademicProgram, Batch, Subject, SubjectGroup, Student, FeeHead } from '@apex/shared-types';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';
import { InstitutionalLoader } from '../components/InstitutionalLoader';

export const AcademicStructureView: React.FC = () => {
  const { token, tenant } = useAuth();
  
  // View mode: 'classes' (Class Academic Structure), 'batches' (Dedicated Batch Directory), or 'catalog' (Master Subject Catalog)
  const [viewMode, setViewMode] = useState<'classes' | 'batches' | 'catalog'>('classes');

  // Core Data State
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected Program for Class View
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [classDetailTab, setClassDetailTab] = useState<'sections' | 'curriculum' | 'fees' | 'all'>('sections');
  const [searchClassQuery, setSearchClassQuery] = useState('');
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');

  // Batch Register Filters
  const [searchBatchQuery, setSearchBatchQuery] = useState('');
  const [filterBatchShift, setFilterBatchShift] = useState('all');
  const [filterBatchBillingMode, setFilterBatchBillingMode] = useState('all');
  const [filterBatchStatus, setFilterBatchStatus] = useState<'all' | 'active' | 'archived'>('all');
  const [showBatchFilters, setShowBatchFilters] = useState(false);
  const [showOverviewCards, setShowOverviewCards] = useState(false);
  const [showModuleMenu, setShowModuleMenu] = useState(false);
  const moduleContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moduleContainerRef.current && !moduleContainerRef.current.contains(e.target as Node)) {
        setShowModuleMenu(false);
      }
    };
    if (showModuleMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showModuleMenu]);

  // Modals
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showEditProgramModal, setShowEditProgramModal] = useState(false);
  const [showCompulsoryModal, setShowCompulsoryModal] = useState(false);
  const [showElectiveTrackModal, setShowElectiveTrackModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showEditSectionModal, setShowEditSectionModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showEditSubjectModal, setShowEditSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectForm, setEditSubjectForm] = useState({
    name: '',
    code: '',
    is_core: true,
  });

  // Smart Deletion with Bulk Student Transfer
  const [showDeleteBatchModal, setShowDeleteBatchModal] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);
  const [transferTargetBatchId, setTransferTargetBatchId] = useState<string>('');

  const [showDeleteProgramModal, setShowDeleteProgramModal] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<AcademicProgram | null>(null);
  const [transferTargetProgramId, setTransferTargetProgramId] = useState<string>('');

  // Dedicated Student Promotion / Section Transfer Modal
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteSourceBatchId, setPromoteSourceBatchId] = useState('');
  const [promoteTargetBatchId, setPromoteTargetBatchId] = useState('');
  const [promoteTargetSession, setPromoteTargetSession] = useState('');
  const [promoteSelectedStudentIds, setPromoteSelectedStudentIds] = useState<string[]>([]);
  const [promoteFeePolicy, setPromoteFeePolicy] = useState<'keep' | 'target_baseline' | 'percentage' | 'fixed'>('keep');
  const [promoteFeeValue, setPromoteFeeValue] = useState<number>(10);
  const [isPromoting, setIsPromoting] = useState(false);

  // Forms: Program (Class)
  const [programForm, setProgramForm] = useState({
    name: '',
    description: '',
    sort_order: 1,
  });

  const [programFeeSchedule, setProgramFeeSchedule] = useState<Record<string, number | ''>>({});
  const [draggedProgramId, setDraggedProgramId] = useState<string | null>(null);
  const [dragOverProgramId, setDragOverProgramId] = useState<string | null>(null);

  const [compulsorySelectedSubjectIds, setCompulsorySelectedSubjectIds] = useState<string[]>([]);

  const [electiveTrackForm, setElectiveTrackForm] = useState({
    name: '',
    subject_ids: [] as string[],
  });

  // Forms: Batch
  const [batchForm, setBatchForm] = useState({
    program_id: '',
    name: '',
    shift: 'morning' as 'morning' | 'afternoon' | 'evening' | 'weekend',
    start_time: '',
    end_time: '',
    start_date: '',
    end_date: '',
    billing_mode: 'monthly' as 'monthly' | 'one_time' | 'installment' | 'quarterly',
    fee_amount: '' as number | '',
    room_number: '',
    academic_session: tenant?.academic_session || '2026-2027',
    max_capacity: 40 as number | '',
    class_teacher_id: '',
    subject_ids: [] as string[],
  });

  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [editBatchForm, setEditBatchForm] = useState({
    program_id: '',
    name: '',
    shift: 'morning' as 'morning' | 'afternoon' | 'evening' | 'weekend',
    start_time: '',
    end_time: '',
    start_date: '',
    end_date: '',
    billing_mode: 'monthly' as 'monthly' | 'one_time' | 'installment' | 'quarterly',
    fee_amount: '' as number | '',
    room_number: '',
    academic_session: tenant?.academic_session || '2026-2027',
    max_capacity: 40 as number | '',
    class_teacher_id: '',
    subject_ids: [] as string[],
  });

  // Forms: Section (Embedded in Class Structure)
  const [sectionForm, setSectionForm] = useState({
    name: '',
    shift: 'morning' as 'morning' | 'afternoon' | 'evening',
    room_number: '',
    max_capacity: 40 as number | '',
    class_teacher_id: '',
  });

  const [editingSection, setEditingSection] = useState<Batch | null>(null);
  const [editSectionForm, setEditSectionForm] = useState({
    name: '',
    shift: 'morning' as 'morning' | 'afternoon' | 'evening',
    room_number: '',
    max_capacity: 40 as number | '',
    class_teacher_id: '',
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
      const [progRes, batchRes, subRes, groupRes, studRes, staffRes, headsRes] = await Promise.all([
        fetch('/api/v1/academic/programs', { headers }),
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/academic/subjects', { headers }),
        fetch('/api/v1/academic/groups', { headers }),
        fetch('/api/v1/sis/students', { headers }),
        fetch('/api/v1/academic/staff', { headers }).catch(() => null),
        fetch('/api/v1/finance/heads', { headers }).catch(() => null),
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
      if (staffRes && staffRes.ok) {
        const staffJson = await staffRes.json();
        if (staffJson.success) setStaffMembers(staffJson.data || []);
      }
      if (headsRes && headsRes.ok) {
        const headsJson = await headsRes.json();
        if (headsJson.success) setFeeHeads(headsJson.data || []);
      }
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

  // Active Teachers for Section Incharge assignment
  const teachers = useMemo(() => {
    return staffMembers.filter(s => s.status === 'active');
  }, [staffMembers]);

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

  const activeSections = useMemo(() => {
    if (!activeProgram) return [];
    return batches.filter(b => 
      b.program_id === activeProgram.id && 
      (b.cohort_type === 'section' || (!b.cohort_type && /section/i.test(b.name)))
    );
  }, [batches, activeProgram]);

  const actualBatchesCount = useMemo(() => {
    return batches.filter(b => (b.cohort_type || (/section/i.test(b.name) ? 'section' : 'batch')) === 'batch').length;
  }, [batches]);

  const actualSectionsCount = useMemo(() => {
    return batches.filter(b => (b.cohort_type || (/section/i.test(b.name) ? 'section' : 'batch')) === 'section').length;
  }, [batches]);

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

  const filteredCatalogSubjects = useMemo(() => {
    return subjects.filter(s => 
      s.name.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
      (s.code || '').toLowerCase().includes(searchCatalogQuery.toLowerCase())
    );
  }, [subjects, searchCatalogQuery]);

  // Filtered batches for Batch Directory & Register (Strictly batches only, excluding class sections)
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const resolvedType = b.cohort_type || (b.name && /section/i.test(b.name) ? 'section' : 'batch');
      if (resolvedType !== 'batch') return false;

      if (filterBatchShift !== 'all' && b.shift !== filterBatchShift) return false;
      if (filterBatchBillingMode !== 'all' && (b.billing_mode || 'monthly') !== filterBatchBillingMode) return false;
      if (filterBatchStatus === 'active' && b.status !== 'active') return false;
      if (filterBatchStatus === 'archived' && b.status !== 'archived') return false;
      if (searchBatchQuery.trim()) {
        const q = searchBatchQuery.toLowerCase();
        const incharge = staffMembers.find(s => s.id === b.class_teacher_id);
        const matchesName = b.name.toLowerCase().includes(q);
        const matchesRoom = (b.room_number || '').toLowerCase().includes(q);
        const matchesIncharge = incharge ? incharge.full_name.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesRoom && !matchesIncharge) return false;
      }
      return true;
    });
  }, [batches, filterBatchShift, filterBatchBillingMode, filterBatchStatus, searchBatchQuery, staffMembers]);


  // Handlers: Program Reorder (Pick & Drop)
  const handleProgramDragStart = (e: React.DragEvent, id: string) => {
    setDraggedProgramId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleProgramDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverProgramId !== id) {
      setDragOverProgramId(id);
    }
  };

  const handleProgramDragLeave = () => {
    setDragOverProgramId(null);
  };

  const handleProgramDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverProgramId(null);
    const sourceId = draggedProgramId || e.dataTransfer.getData('text/plain');
    setDraggedProgramId(null);
    if (!sourceId || sourceId === targetId) return;

    const currentPrograms = [...programs];
    const sourceIndex = currentPrograms.findIndex(p => p.id === sourceId);
    const targetIndex = currentPrograms.findIndex(p => p.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const [moved] = currentPrograms.splice(sourceIndex, 1);
    currentPrograms.splice(targetIndex, 0, moved);

    setPrograms(currentPrograms);

    try {
      const ordered_ids = currentPrograms.map(p => p.id);
      await fetch('/api/v1/academic/programs/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ordered_ids }),
      });
    } catch (err) {
      console.error('Failed to save program order:', err);
    }
  };

  // Handlers: Program
  const openCreateProgramModal = () => {
    setProgramForm({
      name: '',
      description: '',
      sort_order: programs.length + 1,
    });
    setProgramFeeSchedule({});
    setShowProgramModal(true);
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !programForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const fee_schedule = Object.entries(programFeeSchedule)
        .filter(([_, amt]) => amt !== '')
        .map(([headId, amt]) => {
          const head = feeHeads.find(h => h.id === headId);
          return {
            fee_head_id: headId,
            head_name: head?.name || '',
            fee_type: head?.code?.toLowerCase() || 'other',
            name: head?.name || '',
            amount: Number(amt) || 0,
            is_monthly: head?.code === 'TUITION',
            is_recurring: head?.code === 'TUITION',
          };
        });

      const payload = {
        name: programForm.name.trim(),
        sort_order: programs.length + 1,
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
      setProgramForm({ name: '', description: '', sort_order: programs.length + 1 });
      setProgramFeeSchedule({});
      setSelectedProgramId(data.data.id);
      triggerSuccess(`Class "${data.data.name}" created.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating class');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditProgramModal = (p: AcademicProgram) => {
    setProgramForm({
      name: p.name,
      description: '',
      sort_order: p.sort_order || 1,
    });
    const sched: Record<string, number | ''> = {};
    if (p.fee_schedule && p.fee_schedule.length > 0) {
      p.fee_schedule.forEach(f => {
        const matchingHead = feeHeads.find(h => 
          h.id === f.fee_head_id || 
          h.name?.toLowerCase() === f.head_name?.toLowerCase() ||
          h.name?.toLowerCase() === f.name?.toLowerCase() ||
          (h.code === 'TUITION' && f.fee_type === 'tuition') ||
          (h.code === 'ADMISSION' && f.fee_type === 'admission') ||
          (h.code === 'EXAM' && f.fee_type === 'exam_lab')
        );
        if (matchingHead) {
          sched[matchingHead.id] = f.amount ?? '';
        }
      });
    }
    setProgramFeeSchedule(sched);
    setShowEditProgramModal(true);
  };

  const handleUpdateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeProgram || !programForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const fee_schedule = Object.entries(programFeeSchedule)
        .filter(([_, amt]) => amt !== '')
        .map(([headId, amt]) => {
          const head = feeHeads.find(h => h.id === headId);
          return {
            fee_head_id: headId,
            head_name: head?.name || '',
            fee_type: head?.code?.toLowerCase() || 'other',
            name: head?.name || '',
            amount: Number(amt) || 0,
            is_monthly: head?.code === 'TUITION',
            is_recurring: head?.code === 'TUITION',
          };
        });

      const payload = {
        name: programForm.name.trim(),
        fee_schedule,
      };

      const res = await fetch(`/api/v1/academic/programs/${activeProgram.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to update class');

      setShowEditProgramModal(false);
      triggerSuccess(`Class "${data.data.name}" updated.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error updating class');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initiateDeleteProgram = (p: AcademicProgram) => {
    const enrolledStudents = students.filter(s => s.program_id === p.id);
    if (enrolledStudents.length === 0) {
      if (confirm(`Are you sure you want to delete class "${p.name}"? This will also remove associated sections and subjects.`)) {
        executeDeleteProgram(p.id, p.name);
      }
      return;
    }

    setProgramToDelete(p);
    const siblings = programs.filter(x => x.id !== p.id);
    setTransferTargetProgramId(siblings[0]?.id || '');
    setShowDeleteProgramModal(true);
  };

  const executeDeleteProgram = async (id: string, name: string, transferProgId?: string) => {
    setIsSubmitting(true);
    try {
      const url = transferProgId
        ? `/api/v1/academic/programs/${id}?transfer_to_program_id=${transferProgId}`
        : `/api/v1/academic/programs/${id}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setShowDeleteProgramModal(false);
        setProgramToDelete(null);
        triggerSuccess(`Class "${name}" deleted${transferProgId ? ' and students transferred' : ''}.`);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to delete class');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error deleting class');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers: Class Subjects
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
        const delRes = await fetch(`/api/v1/academic/groups/${activeCompulsoryGroup.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const delData = await delRes.json().catch(() => ({}));
        if (!delRes.ok || delData.success === false) {
          throw new Error(delData.error?.message || 'Failed to update existing compulsory group.');
        }
      }

      if (compulsorySelectedSubjectIds.length > 0) {
        const res = await fetch('/api/v1/academic/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            program_id: activeProgram.id,
            name: `${activeProgram.name} - Subjects`,
            type: 'compulsory',
            subject_ids: compulsorySelectedSubjectIds,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to save subjects');
      }

      setShowCompulsoryModal(false);
      triggerSuccess(`Subjects updated for ${activeProgram.name}.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error saving subjects');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers: Elective Groups
  const openAddElectiveTrackModal = () => {
    setElectiveTrackForm({ name: '', subject_ids: [] });
    setShowElectiveTrackModal(true);
  };

  const handleCreateElectiveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeProgram || !electiveTrackForm.name || electiveTrackForm.subject_ids.length === 0) {
      alert('Please provide a group name and select at least one subject.');
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
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to create elective group');

      setShowElectiveTrackModal(false);
      setElectiveTrackForm({ name: '', subject_ids: [] });
      triggerSuccess(`Elective Group "${data.data.name}" added to ${activeProgram.name}.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating elective group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubjectGroup = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove elective group "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/academic/groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerSuccess(`Elective group "${name}" deleted.`);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers: Sections (Embedded Class Sections)
  const openAddSectionModal = () => {
    setSectionForm({
      name: '',
      shift: 'morning',
      room_number: '',
      max_capacity: 40,
      class_teacher_id: '',
    });
    setShowSectionModal(true);
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeProgram || !sectionForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const teacher = teachers.find(t => t.id === sectionForm.class_teacher_id);
      const res = await fetch('/api/v1/academic/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          program_id: activeProgram.id,
          name: sectionForm.name.trim(),
          shift: sectionForm.shift,
          room_number: sectionForm.room_number.trim() || undefined,
          class_teacher_id: sectionForm.class_teacher_id || undefined,
          class_teacher_name: teacher ? teacher.full_name : undefined,
          max_capacity: Number(sectionForm.max_capacity) || 40,
          academic_session: tenant?.academic_session || '2026-2027',
          cohort_type: 'section',
          billing_mode: 'monthly',
          fee_schedule: activeProgram?.fee_schedule || [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to create section');

      setShowSectionModal(false);
      triggerSuccess(`Section "${data.data.name}" added successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating section');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditSectionModal = (sec: Batch) => {
    setEditingSection(sec);
    setEditSectionForm({
      name: sec.name,
      shift: (sec.shift as any) || 'morning',
      room_number: sec.room_number || '',
      max_capacity: sec.max_capacity || 40,
      class_teacher_id: sec.class_teacher_id || '',
    });
    setShowEditSectionModal(true);
  };

  const handleUpdateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingSection || !editSectionForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const teacher = teachers.find(t => t.id === editSectionForm.class_teacher_id);
      const res = await fetch(`/api/v1/academic/batches/${editingSection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editSectionForm.name.trim(),
          shift: editSectionForm.shift,
          room_number: editSectionForm.room_number.trim() || null,
          class_teacher_id: editSectionForm.class_teacher_id || null,
          class_teacher_name: teacher ? teacher.full_name : null,
          max_capacity: Number(editSectionForm.max_capacity) || 40,
          cohort_type: 'section',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to update section');

      setShowEditSectionModal(false);
      setEditingSection(null);
      triggerSuccess(`Section "${data.data.name}" updated successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error updating section');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers: Batches
  const openAddBatchModal = (programId?: string) => {
    const targetProgId = programId || '';
    const prog = targetProgId ? programs.find(p => p.id === targetProgId) : null;
    const tuitionAmount = prog?.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount || '';

    setBatchForm({
      program_id: targetProgId,
      name: '',
      shift: 'morning',
      start_time: '08:00 AM',
      end_time: '01:30 PM',
      start_date: '',
      end_date: '',
      billing_mode: 'monthly',
      fee_amount: tuitionAmount,
      room_number: '',
      academic_session: tenant?.academic_session || '2026-2027',
      max_capacity: 40,
      class_teacher_id: '',
      subject_ids: [],
    });
    setShowBatchModal(true);
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !batchForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const teacher = teachers.find(t => t.id === batchForm.class_teacher_id);
      const targetProg = batchForm.program_id ? programs.find(p => p.id === batchForm.program_id) : null;
      const res = await fetch('/api/v1/academic/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          program_id: batchForm.program_id || undefined,
          name: batchForm.name.trim(),
          cohort_type: 'batch',
          shift: batchForm.shift,
          start_time: batchForm.start_time.trim() || undefined,
          end_time: batchForm.end_time.trim() || undefined,
          start_date: batchForm.start_date.trim() || undefined,
          end_date: batchForm.end_date.trim() || undefined,
          billing_mode: batchForm.billing_mode,
          fee_amount: batchForm.fee_amount !== '' ? Number(batchForm.fee_amount) : undefined,
          room_number: batchForm.room_number.trim() || undefined,
          academic_session: batchForm.academic_session.trim() || tenant?.academic_session || '2026-2027',
          max_capacity: Number(batchForm.max_capacity) || 40,
          class_teacher_id: batchForm.class_teacher_id || undefined,
          class_teacher_name: teacher ? teacher.full_name : undefined,
          subject_ids: batchForm.subject_ids,
          fee_schedule: targetProg?.fee_schedule || [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to create batch');

      setShowBatchModal(false);
      triggerSuccess(`Batch "${data.data.name}" created successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditBatchModal = (b: Batch) => {
    setEditingBatch(b);
    setEditBatchForm({
      program_id: b.program_id || '',
      name: b.name,
      shift: (b.shift as any) || 'morning',
      start_time: b.start_time || '',
      end_time: b.end_time || '',
      start_date: b.start_date || '',
      end_date: b.end_date || '',
      billing_mode: b.billing_mode || 'monthly',
      fee_amount: b.fee_amount ?? '',
      room_number: b.room_number || '',
      academic_session: b.academic_session || tenant?.academic_session || '2026-2027',
      max_capacity: b.max_capacity || 40,
      class_teacher_id: b.class_teacher_id || '',
      subject_ids: b.subject_ids || [],
    });
    setShowEditBatchModal(true);
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingBatch || !editBatchForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const teacher = teachers.find(t => t.id === editBatchForm.class_teacher_id);
      const res = await fetch(`/api/v1/academic/batches/${editingBatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          program_id: editBatchForm.program_id || editingBatch.program_id || null,
          name: editBatchForm.name.trim(),
          cohort_type: 'batch',
          shift: editBatchForm.shift,
          start_time: editBatchForm.start_time.trim() || null,
          end_time: editBatchForm.end_time.trim() || null,
          start_date: editBatchForm.start_date.trim() || null,
          end_date: editBatchForm.end_date.trim() || null,
          billing_mode: editBatchForm.billing_mode,
          fee_amount: editBatchForm.fee_amount !== '' ? Number(editBatchForm.fee_amount) : null,
          room_number: editBatchForm.room_number.trim() || null,
          academic_session: editBatchForm.academic_session,
          max_capacity: Number(editBatchForm.max_capacity) || 40,
          class_teacher_id: editBatchForm.class_teacher_id || null,
          class_teacher_name: teacher ? teacher.full_name : null,
          subject_ids: editBatchForm.subject_ids,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to update batch');

      setShowEditBatchModal(false);
      setEditingBatch(null);
      triggerSuccess(`Batch "${data.data.name}" updated successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error updating batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initiateDeleteBatch = (b: Batch) => {
    const enrolledStudents = students.filter(s => s.batch_id === b.id);
    const isSection = (b.cohort_type || (/section/i.test(b.name) ? 'section' : 'batch')) === 'section';
    const label = isSection ? 'section' : 'batch';
    if (enrolledStudents.length === 0) {
      if (confirm(`Are you sure you want to delete ${label} "${b.name}"?`)) {
        executeDeleteBatch(b.id, b.name);
      }
      return;
    }

    // Has students: open smart transfer modal
    setBatchToDelete(b);
    const siblings = batches.filter(x => {
      if (x.program_id !== b.program_id || x.id !== b.id) return false;
      const sibType = x.cohort_type || (/section/i.test(x.name) ? 'section' : 'batch');
      return sibType === (isSection ? 'section' : 'batch');
    });
    setTransferTargetBatchId(siblings[0]?.id || '');
    setShowDeleteBatchModal(true);
  };

  const executeDeleteBatch = async (batchId: string, batchName: string, transferBatchId?: string) => {
    setIsSubmitting(true);
    try {
      const bObj = batches.find(x => x.id === batchId) || batchToDelete;
      const isSec = (bObj?.cohort_type || (/section/i.test(batchName) ? 'section' : 'batch')) === 'section';
      const typeLabel = isSec ? 'Section' : 'Batch';
      const url = transferBatchId 
        ? `/api/v1/academic/batches/${batchId}?transfer_to_batch_id=${transferBatchId}`
        : `/api/v1/academic/batches/${batchId}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setShowDeleteBatchModal(false);
        setBatchToDelete(null);
        triggerSuccess(`${typeLabel} "${batchName}" deleted${transferBatchId ? ' and students transferred' : ''}.`);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error?.message || `Failed to delete ${typeLabel.toLowerCase()}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error deleting');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers: Student Batch Transfer
  const openPromoteModal = (sourceBatchId?: string) => {
    const defaultSourceId = sourceBatchId || activeBatches[0]?.id || batches[0]?.id || '';
    setPromoteSourceBatchId(defaultSourceId);

    const batchStudents = students.filter(s => s.batch_id === defaultSourceId && s.status === 'active');
    setPromoteSelectedStudentIds(batchStudents.map(s => s.id));

    const destinationCandidates = batches.filter(b => b.id !== defaultSourceId);
    setPromoteTargetBatchId(destinationCandidates[0]?.id || '');

    setPromoteTargetSession(tenant?.academic_session || '2026-2027');
    setPromoteFeePolicy('keep');
    setPromoteFeeValue(10);
    setShowPromoteModal(true);
  };

  const handleSourceBatchChange = (sourceId: string) => {
    setPromoteSourceBatchId(sourceId);
    const batchStudents = students.filter(s => s.batch_id === sourceId && s.status === 'active');
    setPromoteSelectedStudentIds(batchStudents.map(s => s.id));
    const destinationCandidates = batches.filter(b => b.id !== sourceId);
    if (!destinationCandidates.some(b => b.id === promoteTargetBatchId)) {
      setPromoteTargetBatchId(destinationCandidates[0]?.id || '');
    }
  };

  const handleExecutePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || promoteSelectedStudentIds.length === 0 || !promoteTargetBatchId) return;

    setIsPromoting(true);
    try {
      const targetBatch = batches.find(b => b.id === promoteTargetBatchId);
      const res = await fetch('/api/v1/academic/students/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_ids: promoteSelectedStudentIds,
          target_program_id: targetBatch?.program_id || undefined,
          target_batch_id: promoteTargetBatchId,
          target_session: promoteTargetSession,
          fee_adjustment_type: promoteFeePolicy,
          fee_adjustment_value: promoteFeeValue,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to transfer students');

      setShowPromoteModal(false);
      triggerSuccess(`Successfully transferred ${data.data?.count || promoteSelectedStudentIds.length} students to destination batch.`);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPromoting(false);
    }
  };

  // Handlers: Subject Catalog
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !subjectForm.name) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/academic/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...subjectForm, code: subjectForm.code.trim() }),
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

  const openEditSubjectModal = (s: Subject) => {
    setEditingSubject(s);
    setEditSubjectForm({
      name: s.name,
      code: s.code || '',
      is_core: s.is_core ?? true,
    });
    setShowEditSubjectModal(true);
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingSubject || !editSubjectForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/academic/subjects/${editingSubject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editSubjectForm.name.trim(),
          code: editSubjectForm.code.trim(),
          is_core: editSubjectForm.is_core,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to update subject');

      setShowEditSubjectModal(false);
      setEditingSubject(null);
      triggerSuccess(`Subject "${data.data.name}" updated successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error updating subject');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-3">
      
      {/* Top Header Card */}
      <PageHeading
        title="Academic Structure"
        description="Manage academic classes, batch lifespans, and master course catalog."
        icon={<Layers className="w-4 h-4 text-slate-700" />}
        badge={`Session ${tenant?.academic_session || '2026-2027'}`}
      />

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. CARDS ROW (Collapsible overview styled in sidebar dark navy) */}
      {showOverviewCards && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 animate-in fade-in duration-150">
          {/* Card 1: Classes / Grades */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Classes / Grades
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-white text-sm sm:text-base leading-none">
                  {programs.length}
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  Registered
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/10 text-amber-400 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <GraduationCap className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 2: Class Sections */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Class Sections
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-white text-sm sm:text-base leading-none">
                  {actualSectionsCount}
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  Active
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/10 text-sky-400 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <FolderTree className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 3: Total Students */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Total Students
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-white text-sm sm:text-base leading-none">
                  {totalEnrolled}
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  Enrolled
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/10 text-emerald-400 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 4: Total Occupancy */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 truncate">
                  Total Occupancy
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-300 bg-white/10 px-1 py-0.5 rounded border border-white/10">
                  {Math.round(capacityPercent)}%
                </span>
              </div>
              <div className="font-mono text-xs mt-0.5 leading-none">
                <span className="font-bold text-white text-sm sm:text-base">{totalEnrolled}</span>
                <span className="font-normal text-slate-400 ml-1">/ {totalCapacity} Seats</span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/10 text-indigo-300 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      )}

      {/* Controls Toolbar: Search + Filter + Parallel Options Button */}
      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2">
          {/* Back button if in batches or catalog */}
          {viewMode !== 'classes' && (
            <button
              type="button"
              onClick={() => setViewMode('classes')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="Back to Classes"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Classes</span>
            </button>
          )}

          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                viewMode === 'classes'
                  ? 'Search classes and streams...'
                  : viewMode === 'batches'
                  ? 'Search batches by name, shift, room...'
                  : 'Search subjects in catalog...'
              }
              value={
                viewMode === 'classes'
                  ? searchClassQuery
                  : viewMode === 'batches'
                  ? searchBatchQuery
                  : searchCatalogQuery
              }
              onChange={e => {
                if (viewMode === 'classes') setSearchClassQuery(e.target.value);
                else if (viewMode === 'batches') setSearchBatchQuery(e.target.value);
                else setSearchCatalogQuery(e.target.value);
              }}
              className="w-full pl-8 pr-7 py-2 sm:py-1.5 text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors font-sans text-slate-900"
            />
            {((viewMode === 'classes' && searchClassQuery) ||
              (viewMode === 'batches' && searchBatchQuery) ||
              (viewMode === 'catalog' && searchCatalogQuery)) && (
              <button
                type="button"
                onClick={() => {
                  if (viewMode === 'classes') setSearchClassQuery('');
                  else if (viewMode === 'batches') setSearchBatchQuery('');
                  else setSearchCatalogQuery('');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Button */}
          <button
            type="button"
            onClick={() => setShowBatchFilters(prev => !prev)}
            className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 relative ${
              showBatchFilters || filterBatchShift !== 'all' || filterBatchBillingMode !== 'all' || filterBatchStatus !== 'all'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle Filters"
            aria-label="Toggle Filters"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
            {(filterBatchShift !== 'all' || filterBatchBillingMode !== 'all' || filterBatchStatus !== 'all') && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                !
              </span>
            )}
          </button>

          {/* Simple Button Parallel to Filter */}
          <div ref={moduleContainerRef} className="relative">
            <button
              type="button"
              onClick={() => setShowModuleMenu(prev => !prev)}
              className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 relative ${
                showModuleMenu
                  ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Actions & Options"
              aria-label="Actions & Options"
            >
              <MoreVertical className="w-4 h-4 text-slate-600" />
            </button>

            {/* Dropdown Menu */}
            {showModuleMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-40 divide-y divide-slate-100 text-left animate-in fade-in zoom-in-95 duration-100">
                {/* Primary Creation Actions */}
                <div className="p-1.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModuleMenu(false);
                      openCreateProgramModal();
                    }}
                    className="w-full px-3 py-2 text-xs text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg flex items-center gap-2 font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span>New Class</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowModuleMenu(false);
                      openAddBatchModal();
                    }}
                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                    <span>+ New Batch</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowModuleMenu(false);
                      setSubjectForm({ name: '', code: '', is_core: true });
                      setShowSubjectModal(true);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                    <span>+ New Subject</span>
                  </button>
                </div>

                {/* Sub-Views Navigation */}
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Views
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModuleMenu(false);
                      setViewMode('classes');
                    }}
                    className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      viewMode === 'classes' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                      <span>Classes ({programs.length})</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowModuleMenu(false);
                      setViewMode('batches');
                    }}
                    className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      viewMode === 'batches' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FolderTree className="w-3.5 h-3.5 text-slate-500" />
                      <span>Batches ({actualBatchesCount})</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowModuleMenu(false);
                      setViewMode('catalog');
                    }}
                    className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      viewMode === 'catalog' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>Subject Catalog ({subjects.length})</span>
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

                {/* Tools */}
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Tools
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModuleMenu(false);
                      openPromoteModal();
                    }}
                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Split className="w-3.5 h-3.5 text-slate-500" />
                    <span>Batch Student Transfer</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter Dropdown when toggled */}
        {showBatchFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 flex-1 min-w-[130px]">
              <span className="text-[11px] font-medium text-slate-500">Shift:</span>
              <select
                value={filterBatchShift}
                onChange={e => setFilterBatchShift(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
              >
                <option value="all">All Shifts</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="weekend">Weekend</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600 flex-1 min-w-[130px]">
              <span className="text-[11px] font-medium text-slate-500">Billing:</span>
              <select
                value={filterBatchBillingMode}
                onChange={e => setFilterBatchBillingMode(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
              >
                <option value="all">All Billing Modes</option>
                <option value="monthly">Monthly Tuition</option>
                <option value="one_time">Package / One-Time</option>
                <option value="installment">Installments</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600 flex-1 min-w-[130px]">
              <span className="text-[11px] font-medium text-slate-500">Status:</span>
              <select
                value={filterBatchStatus}
                onChange={e => setFilterBatchStatus(e.target.value as any)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="archived">Archived Only</option>
              </select>
            </div>

            {(filterBatchShift !== 'all' || filterBatchBillingMode !== 'all' || filterBatchStatus !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setFilterBatchShift('all');
                  setFilterBatchBillingMode('all');
                  setFilterBatchStatus('all');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          VIEW MODE 1: CLASS ACADEMIC STRUCTURE & CURRICULUM
          ===================================================================== */}
      {viewMode === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          
          {/* LEFT 3 COLS: Compact Class Selector Panel */}
          <div className="lg:col-span-3 bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-slate-700" />
                Classes
              </span>
              <span className="text-[11px] font-mono text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded-md">
                {filteredPrograms.length}
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchClassQuery}
                onChange={e => setSearchClassQuery(e.target.value)}
                placeholder="Search classes..."
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1 max-h-[640px] overflow-y-auto pr-0.5">
              {isLoading ? (
                <InstitutionalLoader variant="inline" label="Loading classes..." />
              ) : filteredPrograms.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No classes found.
                </div>
              ) : (
                filteredPrograms.map(p => {
                  const isSelected = p.id === activeProgram?.id;
                  const isDragged = draggedProgramId === p.id;
                  const isDragOver = dragOverProgramId === p.id;
                  const classSections = batches.filter(b => b.program_id === p.id && (b.cohort_type === 'section' || (!b.cohort_type && /section/i.test(b.name))));
                  const classStudentCount = students.filter(s => s.program_id === p.id).length;

                  return (
                    <div
                      key={p.id}
                      draggable={!searchClassQuery}
                      onDragStart={e => handleProgramDragStart(e, p.id)}
                      onDragOver={e => handleProgramDragOver(e, p.id)}
                      onDragLeave={handleProgramDragLeave}
                      onDrop={e => handleProgramDrop(e, p.id)}
                      onClick={() => setSelectedProgramId(p.id)}
                      className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all border cursor-pointer select-none text-xs ${
                        isDragged
                          ? 'opacity-40 border-dashed border-slate-400 bg-slate-50'
                          : isDragOver
                          ? 'border-amber-500 ring-2 ring-amber-200 bg-amber-50/50'
                          : isSelected
                          ? 'bg-amber-50/70 border-amber-400 text-amber-950 shadow-2xs'
                          : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {!searchClassQuery && (
                        <div
                          className="text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
                          title="Drag to reorder class"
                          onClick={e => e.stopPropagation()}
                        >
                          <GripVertical className="w-3 h-3" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`truncate text-xs ${isSelected ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                              {p.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                              isSelected ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-slate-100 text-slate-500 font-medium'
                            }`}>
                              {classStudentCount} std
                            </span>
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'text-amber-600 translate-x-0.5' : 'text-slate-300'}`} />
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-medium">
                          <span>{classSections.length} {classSections.length === 1 ? 'section' : 'sections'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT 9 COLS: Unified Class Workspace Console */}
          <div className="lg:col-span-9">
            {isLoading ? (
              <InstitutionalLoader variant="card" label="Loading class academic structure & curriculum..." />
            ) : activeProgram ? (
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col">
                {/* Top Class Banner & Quick Controls */}
                <div className="px-4 py-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-slate-900 leading-tight">
                        {activeProgram.name}
                      </h2>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                        Order #{activeProgram.sort_order}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 mt-1 text-xs text-slate-500">
                      <span>Enrolled: <strong className="font-mono text-slate-800 font-semibold">{activeStudents.length}</strong></span>
                      <span>•</span>
                      <span>Sections: <strong className="font-mono text-slate-800 font-semibold">{activeSections.length}</strong></span>
                      <span>•</span>
                      <span>Subjects: <strong className="font-mono text-slate-800 font-semibold">{activeCompulsoryGroup?.subject_ids?.length || 0}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openEditProgramModal(activeProgram)}
                      className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs touch-press"
                      title="Edit Class Details & Fees"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                      <span>Edit Class</span>
                    </button>
                    <button
                      onClick={() => openAddSectionModal()}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs touch-press"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      <span>Add Section</span>
                    </button>
                    <button
                      onClick={() => initiateDeleteProgram(activeProgram)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors touch-press"
                      title="Delete Class"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sub-Navigation Tabs Strip */}
                <div className="flex items-center gap-1 px-2 sm:px-4 bg-slate-50/70 border-b border-slate-200 text-xs font-semibold overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setClassDetailTab('sections')}
                    className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 touch-press shrink-0 ${
                      classDetailTab === 'sections'
                        ? 'border-amber-600 text-amber-700 font-bold bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Sections ({activeSections.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassDetailTab('curriculum')}
                    className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 touch-press shrink-0 ${
                      classDetailTab === 'curriculum'
                        ? 'border-amber-600 text-amber-700 font-bold bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Subjects ({activeCompulsoryGroup?.subject_ids?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassDetailTab('fees')}
                    className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 touch-press shrink-0 ${
                      classDetailTab === 'fees'
                        ? 'border-amber-600 text-amber-700 font-bold bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Fee Structure ({activeProgram.fee_schedule?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassDetailTab('all')}
                    className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 touch-press shrink-0 ${
                      classDetailTab === 'all'
                        ? 'border-amber-600 text-amber-700 font-bold bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Overview</span>
                  </button>
                </div>

                {/* Console Content Body */}
                <div className="p-4 space-y-4">
                  {/* SECTIONS TAB OR ALL VIEW */}
                  {(classDetailTab === 'sections' || classDetailTab === 'all') && (
                    <div className="space-y-3">
                      {classDetailTab === 'all' && (
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-700" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                              Class Sections ({activeSections.length})
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={openAddSectionModal}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Section</span>
                          </button>
                        </div>
                      )}

                      {activeSections.length > 0 ? (
                        <>
                          {/* Mobile Section Cards (Zero Sliders) */}
                          <div className="sm:hidden space-y-2.5">
                            {activeSections.map((sec) => {
                              const secStudents = activeStudents.filter(s => s.batch_id === sec.id);
                              const enrolledCount = secStudents.length || sec.current_enrollment || 0;
                              const maxCap = sec.max_capacity || 40;
                              const percent = Math.min(100, Math.round((enrolledCount / maxCap) * 100));
                              const inchargeTeacher = staffMembers.find(s => s.id === sec.class_teacher_id);
                              const inchargeName = sec.class_teacher_name || inchargeTeacher?.full_name || 'Unassigned';

                              return (
                                <div key={sec.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-semibold text-slate-900 text-xs">{sec.name}</p>
                                      <p className="text-[10px] text-slate-500 font-normal capitalize mt-0.5">
                                        {sec.shift} Shift • Room: {sec.room_number || 'Unassigned'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => openEditSectionModal(sec)}
                                        className="w-7 h-7 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                                        title="Edit Section"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => initiateDeleteBatch(sec)}
                                        className="w-7 h-7 rounded-lg text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 flex items-center justify-center transition-colors"
                                        title="Delete Section"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
                                    <span className="text-[11px] text-slate-600">Incharge: <span className="font-medium text-slate-800">{inchargeName}</span></span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-mono font-medium text-slate-800">{enrolledCount}/{maxCap}</span>
                                      <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className={`h-1.5 rounded-full ${percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Desktop Table (>= 640px) */}
                          <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 select-none">
                              <tr>
                                <th className="py-2 px-3 font-mono text-center w-10">#</th>
                                <th className="py-2 px-3">Section Name</th>
                                <th className="py-2 px-3">Room</th>
                                <th className="py-2 px-3">Shift</th>
                                <th className="py-2 px-3">Incharge Teacher</th>
                                <th className="py-2 px-3">Capacity & Occupancy</th>
                                <th className="py-2 px-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {activeSections.map((sec, idx) => {
                                const secStudents = activeStudents.filter(s => s.batch_id === sec.id);
                                const enrolledCount = secStudents.length || sec.current_enrollment || 0;
                                const maxCap = sec.max_capacity || 40;
                                const percent = Math.min(100, Math.round((enrolledCount / maxCap) * 100));
                                const inchargeTeacher = staffMembers.find(s => s.id === sec.class_teacher_id);
                                const inchargeName = sec.class_teacher_name || inchargeTeacher?.full_name || 'Unassigned';

                                return (
                                  <tr key={sec.id} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="py-2 px-3 font-mono text-center text-slate-400">{idx + 1}</td>
                                    <td className="py-2 px-3 font-bold text-slate-900">
                                      <div className="flex items-center gap-2">
                                        <span>{sec.name}</span>
                                        <span className="text-[10px] font-mono font-normal text-slate-400">
                                          ({sec.academic_session})
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 font-mono text-slate-700">
                                      {sec.room_number ? (
                                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                          {sec.room_number}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic font-sans text-[11px]">—</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className="capitalize font-semibold text-slate-700 text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 inline-block">
                                        {sec.shift} Shift
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-slate-700">
                                      {inchargeName !== 'Unassigned' ? (
                                        <span className="font-medium text-slate-800">{inchargeName}</span>
                                      ) : (
                                        <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3">
                                      <div className="space-y-1 max-w-[140px]">
                                        <div className="flex items-center justify-between text-[11px] font-mono">
                                          <span className="font-bold text-slate-900">{enrolledCount} Students</span>
                                          <span className="text-slate-400">/ {maxCap}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                          <div
                                            className={`h-1.5 rounded-full ${
                                              percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                            }`}
                                            style={{ width: `${percent}%` }}
                                          />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          type="button"
                                          onClick={() => openEditSectionModal(sec)}
                                          className="px-2 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors touch-press"
                                          title="Edit Section"
                                        >
                                          <Pencil className="w-3 h-3 text-slate-500" />
                                          <span>Edit</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => initiateDeleteBatch(sec)}
                                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs transition-colors touch-press"
                                          title="Delete Section"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        </>
                      ) : (
                        <div className="py-6 px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 text-center text-xs">
                          <FolderTree className="w-6 h-6 mx-auto text-slate-400 mb-1.5" />
                          <p className="font-semibold text-slate-700">No sections created for {activeProgram.name} yet</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Section" to configure classroom batches, room allocations, and capacity limits.</p>
                          <button
                            type="button"
                            onClick={openAddSectionModal}
                            className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs touch-press"
                          >
                            <Plus className="w-3.5 h-3.5 text-white" />
                            <span>Add Section</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CURRICULUM & ELECTIVES TAB OR ALL VIEW */}
                  {(classDetailTab === 'curriculum' || classDetailTab === 'all') && (
                    <div className="space-y-4 pt-1">
                      {classDetailTab === 'all' && <div className="border-t border-slate-200/80 my-2" />}

                      {/* Class Subjects */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-slate-700" />
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                Class Subjects
                              </h4>
                              <span className="text-[11px] text-slate-500">
                                Standard subjects taught to students in this class.
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={openManageCompulsoryModal}
                            className="px-2.5 py-1 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-all shadow-2xs"
                          >
                            {activeCompulsoryGroup && activeCompulsoryGroup.subject_ids.length > 0 ? 'Edit Subjects' : '+ Assign Subjects'}
                          </button>
                        </div>

                        {activeCompulsoryGroup && activeCompulsoryGroup.subject_ids.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {activeCompulsoryGroup.subject_ids.map(subId => {
                              const sub = subjects.find(s => s.id === subId);
                              return (
                                <span 
                                  key={subId}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-800 rounded-lg text-xs font-medium shadow-2xs"
                                >
                                  <span className="font-mono text-[9px] bg-slate-200 px-1 py-0.2 rounded text-slate-700 font-bold">
                                    {sub?.code || 'SUB'}
                                  </span>
                                  <span>{sub?.name || 'Subject'}</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-3 px-3.5 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                            No subjects assigned to this class yet.
                          </div>
                        )}
                      </div>

                      {/* Elective Groups */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-slate-700" />
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                Elective Groups (Optional)
                              </h4>
                              <span className="text-[11px] text-slate-500">
                                Optional subject groups for senior classes (e.g. Pre-Medical, Computer Science).
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={openAddElectiveTrackModal}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Elective Group</span>
                          </button>
                        </div>

                        {activeElectiveTracks.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-0.5">
                            {activeElectiveTracks.map(track => {
                              const trackStudents = activeStudents.filter(s => s.elective_group_id === track.id);
                              return (
                                <div key={track.id} className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <span className="font-bold text-xs text-slate-900">{track.name}</span>
                                      <div className="text-[10px] font-mono text-slate-500 font-medium mt-0.5">
                                        {trackStudents.length} Students Enrolled
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteSubjectGroup(track.id, track.name)}
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                                      title="Delete Group"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {track.subject_ids.map(subId => {
                                      const sub = subjects.find(s => s.id === subId);
                                      return (
                                        <span
                                          key={subId}
                                          className="text-[10px] bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium shadow-2xs"
                                        >
                                          {sub?.name || 'Subject'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-3 px-3.5 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                            No elective groups configured. All students in this class take standard class subjects.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* FEE STRUCTURE TAB OR ALL VIEW */}
                  {(classDetailTab === 'fees' || classDetailTab === 'all') && (
                    <div className="space-y-2 pt-1">
                      {classDetailTab === 'all' && <div className="border-t border-slate-200/80 my-2" />}

                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-3.5 h-3.5 text-slate-700" />
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                              Fee Structure ({activeProgram.fee_schedule?.length || 0})
                            </h4>
                            <span className="text-[11px] text-slate-500">
                              Default monthly tuition and admission fee amounts for this class.
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditProgramModal(activeProgram)}
                          className="px-2.5 py-1 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-all shadow-2xs"
                        >
                          Configure Fees
                        </button>
                      </div>

                      {activeProgram.fee_schedule && activeProgram.fee_schedule.length > 0 ? (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="py-2 px-3 text-left">Fee Head</th>
                                <th className="py-2 px-3 text-center">Billing Type</th>
                                <th className="py-2 px-3 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {activeProgram.fee_schedule.map((fs, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                                    {fs.name || fs.head_name || 'Tuition Fee'}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      fs.is_monthly || fs.is_recurring 
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}>
                                      {fs.is_monthly || fs.is_recurring ? 'Monthly Recurring' : 'One-Time / Admission'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold text-slate-900">
                                    PKR {Number(fs.amount || 0).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-3 px-3.5 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                          No fee structure configured for this class.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center text-slate-400">
                <GraduationCap className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <h3 className="text-sm font-bold text-slate-800">No Academic Class Selected</h3>
                <p className="text-xs text-slate-500 mt-1">Select a class from the left panel or click "+ New Class" to create one.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* =====================================================================
          VIEW MODE 2: DEDICATED BATCH DIRECTORY & REGISTER
          ===================================================================== */}
      {viewMode === 'batches' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          {/* Top Register Controls Strip */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-slate-700" />
                Batch Directory & Register ({filteredBatches.length})
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Manage batch lifespans, shift hours, classroom rooms, and billing modes across the academy.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => openPromoteModal()}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs touch-press"
              >
                <Split className="w-3.5 h-3.5 text-slate-600" />
                <span>Batch Transfer</span>
              </button>
              <button
                type="button"
                onClick={() => openAddBatchModal()}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs touch-press"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>Add Batch</span>
              </button>
            </div>
          </div>

          {/* Standalone Search Bar & Single Button Filter Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchBatchQuery}
                onChange={e => setSearchBatchQuery(e.target.value)}
                placeholder="Search batch, room, incharge..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs font-normal"
              />
              {searchBatchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchBatchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowBatchFilters(!showBatchFilters)}
              className={`sm:hidden w-9 h-9 flex items-center justify-center rounded-xl border transition-colors cursor-pointer shrink-0 relative ${
                showBatchFilters || filterBatchShift !== 'all' || filterBatchBillingMode !== 'all' || filterBatchStatus !== 'all'
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Toggle Filters"
              aria-label="Toggle Filters"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-600" />
              {(filterBatchShift !== 'all' || filterBatchBillingMode !== 'all' || filterBatchStatus !== 'all') && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-600" />
              )}
            </button>
          </div>

          {/* Secondary Filter Dropdowns (Collapsed on Mobile, 3 cols on Desktop) */}
          <div className={`${showBatchFilters ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs`}>
            {/* Shift Filter */}
            <select
              value={filterBatchShift}
              onChange={e => setFilterBatchShift(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="all">All Shifts</option>
              <option value="morning">Morning Shift</option>
              <option value="afternoon">Afternoon Shift</option>
              <option value="evening">Evening Shift</option>
              <option value="weekend">Weekend Shift</option>
            </select>

            {/* Billing Mode Filter */}
            <select
              value={filterBatchBillingMode}
              onChange={e => setFilterBatchBillingMode(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="all">All Billing Modes</option>
              <option value="monthly">Monthly Tuition</option>
              <option value="one_time">One-Time Package Fee</option>
              <option value="installment">Installment Plan</option>
              <option value="quarterly">Quarterly</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterBatchStatus}
              onChange={e => setFilterBatchStatus(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Batches</option>
              <option value="archived">Archived / Ended</option>
            </select>
          </div>

          {/* Mobile Native Batches Cards (< 640px) */}
          <div className="sm:hidden divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl overflow-hidden">
            {isLoading ? (
              <InstitutionalLoader variant="card" label="Loading batches directory..." />
            ) : filteredBatches.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No batches match your filters.
              </div>
            ) : (
              filteredBatches.map(b => {
                const batchStudents = students.filter(s => s.batch_id === b.id);
                const enrolledCount = batchStudents.length || b.current_enrollment || 0;
                const maxCap = b.max_capacity || 40;
                const percent = Math.min(100, Math.round((enrolledCount / maxCap) * 100));

                return (
                  <div key={b.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-slate-900 text-xs">{b.name}</h4>
                        <p className="text-[10px] text-slate-500 font-normal capitalize mt-0.5">
                          {b.shift} Shift • Room: {b.room_number || 'Unassigned'} • {b.academic_session}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        b.status === 'archived'
                          ? 'bg-slate-100 text-slate-600 border border-slate-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {b.status === 'archived' ? 'Archived' : 'Active'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="text-[11px]">Teacher: <span className="font-medium text-slate-800">{b.class_teacher_name || 'Unassigned'}</span></span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-medium text-slate-800">{enrolledCount}/{maxCap}</span>
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${percent >= 100 ? 'bg-rose-500' : percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => openPromoteModal(b.id)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                        title="Promote or Transfer Students"
                      >
                        <Split className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditBatchModal(b)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                        title="Edit Batch"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => initiateDeleteBatch(b)}
                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 flex items-center justify-center transition-colors"
                        title="Delete Batch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* High-Density Batches Register Table (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-2.5 px-3 font-mono text-center w-10">#</th>
                  <th className="py-2.5 px-3.5">Batch Name</th>
                  <th className="py-2.5 px-3.5">Shift & Hours</th>
                  <th className="py-2.5 px-3.5">Lifespan</th>
                  <th className="py-2.5 px-3.5">Billing Mode & Fee</th>
                  <th className="py-2.5 px-3.5">Room</th>
                  <th className="py-2.5 px-3.5">Enrollment / Capacity</th>
                  <th className="py-2.5 px-3.5">Incharge Teacher</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <InstitutionalLoader variant="table" colSpan={10} label="Loading batches directory..." />
                ) : filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <FolderTree className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700">No batches match the selected criteria</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your filters or create a new batch.</p>
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b, idx) => {
                    const batchStudents = students.filter(s => s.batch_id === b.id);
                    const enrolledCount = batchStudents.length || b.current_enrollment || 0;
                    const maxCap = b.max_capacity || 40;
                    const percent = Math.min(100, Math.round((enrolledCount / maxCap) * 100));

                    // Lifespan calculation
                    const today = new Date().toISOString().split('T')[0];
                    const isEnded = b.end_date && b.end_date < today;

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-center text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3.5 font-bold text-slate-900">
                          <span>{b.name}</span>
                          <span className="block text-[10px] font-mono text-slate-400 font-normal">
                            Session: {b.academic_session}
                          </span>
                          {b.subject_ids && b.subject_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {b.subject_ids.map((subId: string) => {
                                const sub = subjects.find(s => s.id === subId);
                                if (!sub) return null;
                                return (
                                  <span key={subId} className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[9px] font-medium text-indigo-700">
                                    {sub.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span className="capitalize font-semibold text-slate-800 block">
                            {b.shift} Shift
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {b.start_time && b.end_time ? `${b.start_time} – ${b.end_time}` : 'Standard Hours'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-[11px]">
                          {b.start_date && b.end_date ? (
                            <div>
                              <span className="text-slate-700 block">{b.start_date} → {b.end_date}</span>
                              {isEnded ? (
                                <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  Ended
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Active Course
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Continuous</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono">
                          {b.billing_mode === 'one_time' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              Package Fee
                            </span>
                          ) : b.billing_mode === 'installment' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Installments
                            </span>
                          ) : b.billing_mode === 'quarterly' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Quarterly
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Monthly Tuition
                            </span>
                          )}
                          <div className="text-[11px] font-bold text-slate-900 mt-0.5">
                            {b.fee_amount ? `PKR ${Number(b.fee_amount).toLocaleString()}` : '—'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-slate-700">
                          {b.room_number || '—'}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-bold text-slate-900">{enrolledCount}</span>
                            <span className="text-slate-400">/ {maxCap} ({percent}%)</span>
                          </div>
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                percent >= 100 ? 'bg-rose-600' : percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-700">
                          {b.class_teacher_name || <span className="text-slate-400 italic">Unassigned</span>}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            b.status === 'archived'
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {b.status === 'archived' ? 'Archived' : 'Active'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openPromoteModal(b.id)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-xs font-semibold transition-colors flex items-center gap-1"
                              title="Promote or Transfer Students"
                            >
                              <Split className="w-3 h-3 text-slate-600" />
                              <span>Transfer</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditBatchModal(b)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                              title="Edit Batch"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => initiateDeleteBatch(b)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-slate-200 transition-colors"
                              title="Delete Batch"
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
      )}

      {/* =====================================================================
          VIEW MODE 3: MASTER SUBJECT CATALOG
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
                Centralized subject catalog across your institution.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchCatalogQuery}
                  onChange={e => setSearchCatalogQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={() => setShowSubjectModal(true)}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Add Subject</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filteredCatalogSubjects.map(s => (
              <div key={s.id} className="border border-slate-200 rounded-lg p-2.5 bg-white hover:border-slate-300 hover:shadow-xs transition-all flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {s.code ? (
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded shrink-0">
                      {s.code}
                    </span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                  )}
                  <h4 className="text-xs font-semibold text-slate-900 truncate" title={s.name}>{s.name}</h4>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditSubjectModal(s)}
                    className="text-slate-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50 transition-colors"
                    title="Edit Subject"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSubject(s.id, s.name)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                    title="Delete Subject"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {isLoading ? (
              <div className="col-span-full">
                <InstitutionalLoader variant="card" label="Loading master course catalog..." />
              </div>
            ) : filteredCatalogSubjects.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-400 text-xs">
                No subjects found. Click "+ Add Subject" to expand the catalog.
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALS
          ===================================================================== */}

      {/* MODAL 1: CREATE NEW CLASS */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="mobile-sheet-card bg-white rounded-t-xl sm:rounded-xl max-w-md w-full p-3.5 sm:p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-slate-900 text-white">
                  <GraduationCap className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Class</h3>
                </div>
              </div>
              <button 
                onClick={() => setShowProgramModal(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProgram} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 10, F.Sc Pre-Medical"
                  value={programForm.name}
                  onChange={e => setProgramForm({ ...programForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Description / Stream Scope</label>
                <textarea
                  rows={2}
                  placeholder="Academic scope, target board (FBISE / BISE), or stream details..."
                  value={programForm.description}
                  onChange={e => setProgramForm({ ...programForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {/* Fee Schedule Definition */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                    Standard Fee Schedule
                  </span>
                  <span className="text-[10px] text-slate-500">Auto-applies to new admissions</span>
                </div>

                {feeHeads.length === 0 ? (
                  <p className="text-slate-500 italic text-[11px]">
                    No fee heads configured. Configure heads in Fee Desk first.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(programFeeSchedule).map(([headId, amount]) => {
                      const head = feeHeads.find(h => h.id === headId);
                      if (!head) return null;
                      return (
                        <div key={headId} className="flex items-center gap-2">
                          <span className="text-xs text-slate-700 font-medium flex-1 truncate">
                            {head.name}
                            <span className="text-[10px] text-slate-500 ml-1">({head.code})</span>
                          </span>
                          <div className="flex items-center gap-1 w-32">
                            <span className="text-[10px] text-slate-500 font-mono">PKR</span>
                            <input
                              type="number"
                              min="0"
                              step="50"
                              placeholder="0"
                              value={amount}
                              onChange={e => setProgramFeeSchedule(prev => ({
                                ...prev,
                                [headId]: e.target.value === '' ? '' : Number(e.target.value),
                              }))}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setProgramFeeSchedule(prev => {
                                const next = { ...prev };
                                delete next[headId];
                                return next;
                              });
                            }}
                            className="text-slate-400 hover:text-rose-500 p-1"
                            title="Remove Head"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}

                    {/* Add Fee Head Selector */}
                    <select
                      value=""
                      onChange={e => {
                        const headId = e.target.value;
                        if (!headId) return;
                        setProgramFeeSchedule(prev => ({
                          ...prev,
                          [headId]: '',
                        }));
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                    >
                      <option value="">+ Add Fee Head...</option>
                      {feeHeads
                        .filter(h => !(h.id in programFeeSchedule))
                        .map(head => (
                          <option key={head.id} value={head.id}>
                            {head.name} ({head.code})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProgramModal(false)}
                  className="w-full sm:w-auto h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-8.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 shadow-xs cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? 'Saving...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1B: EDIT EXISTING CLASS */}
      {showEditProgramModal && activeProgram && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="mobile-sheet-card bg-white rounded-t-xl sm:rounded-xl max-w-md w-full p-3.5 sm:p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-slate-900 text-white">
                  <Pencil className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Class</h3>
                  <p className="text-[10.5px] text-slate-500">{activeProgram.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEditProgramModal(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProgram} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={programForm.name}
                  onChange={e => setProgramForm({ ...programForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {/* Class Fees (Optional) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Receipt className="w-3.5 h-3.5 text-slate-700" />
                    Class Fees <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                </div>

                {Object.keys(programFeeSchedule).length > 0 && (
                  <div className="space-y-2">
                    {Object.entries(programFeeSchedule).map(([headId, amount]) => {
                      const head = feeHeads.find(h => h.id === headId);
                      if (!head) return null;
                      return (
                        <div key={headId} className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate" title={head.name}>
                              {head.name}
                            </span>
                            <span className="text-[9px] font-mono uppercase px-1 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                              {head.code === 'TUITION' ? 'Monthly' : 'One-Time'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="relative w-28">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">PKR</span>
                              <input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={amount}
                                onChange={e => setProgramFeeSchedule(prev => ({
                                  ...prev,
                                  [headId]: e.target.value === '' ? '' : Number(e.target.value)
                                }))}
                                className="w-full pl-9 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono text-xs font-bold text-right focus:bg-white focus:ring-1 focus:ring-slate-400 focus:outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setProgramFeeSchedule(prev => {
                                  const next = { ...prev };
                                  delete next[headId];
                                  return next;
                                });
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Remove fee head"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {feeHeads.filter(h => !(h.id in programFeeSchedule)).length > 0 && (
                  <div>
                    <select
                      value=""
                      onChange={e => {
                        const headId = e.target.value;
                        if (!headId) return;
                        setProgramFeeSchedule(prev => ({
                          ...prev,
                          [headId]: '',
                        }));
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                    >
                      <option value="">+ Add Fee Head...</option>
                      {feeHeads
                        .filter(h => !(h.id in programFeeSchedule))
                        .map(head => (
                          <option key={head.id} value={head.id}>
                            {head.name} ({head.code})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditProgramModal(false)}
                  className="w-full sm:w-auto h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-8.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 shadow-xs cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANAGE CLASS SUBJECTS */}
      {showCompulsoryModal && activeProgram && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white">
                  <BookOpen className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Class Subjects — {activeProgram.name}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Select standard subjects taught to all students in this class.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCompulsoryModal(false)} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2">
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
                          ? 'bg-amber-50/80 border-amber-400 text-amber-950 font-bold'
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
                          className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                        />
                        <span>{s.name}</span>
                      </div>
                      {s.code && (
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {s.code}
                        </span>
                      )}
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
                  className="text-rose-600 hover:underline min-h-[36px] flex items-center"
                >
                  Clear all
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompulsoryModal(false)}
                  className="h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Subjects'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE ELECTIVE GROUP */}
      {showElectiveTrackModal && activeProgram && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white">
                  <Layers className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Elective Group — {activeProgram.name}</h3>
                  <p className="text-[11px] text-slate-500">Create an elective group (e.g. Pre-Medical, Computer Science).</p>
                </div>
              </div>
              <button onClick={() => setShowElectiveTrackModal(false)} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateElectiveTrack} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Group Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pre-Medical, Computer Science"
                  value={electiveTrackForm.name}
                  onChange={e => setElectiveTrackForm({ ...electiveTrackForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-bold">
                    Select Elective Subjects <span className="text-rose-500">*</span>
                  </label>
                  {activeCompulsoryGroup && activeCompulsoryGroup.subject_ids.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      Mandatory class subjects excluded
                    </span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {subjects
                    .filter(s => !activeCompulsoryGroup?.subject_ids?.includes(s.id))
                    .map(s => {
                      const isChecked = electiveTrackForm.subject_ids.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-amber-50/80 border-amber-400 text-amber-950 font-bold'
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
                              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                            />
                            <span>{s.name}</span>
                          </div>
                          {s.code && (
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {s.code}
                            </span>
                          )}
                        </label>
                      );
                    })}

                  {subjects.filter(s => !activeCompulsoryGroup?.subject_ids?.includes(s.id)).length === 0 && (
                    <div className="text-center py-6 text-slate-400">
                      All available catalog subjects are already assigned as standard class subjects.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowElectiveTrackModal(false)}
                  className="h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Elective Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3B: ADD CLASS SECTION */}
      {showSectionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 max-h-[92dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white">
                  <Users className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Class Section</h3>
                  <p className="text-[11px] text-slate-500">
                    Add a classroom section to <span className="font-semibold text-slate-700">{activeProgram?.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSectionModal(false)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSection} className="space-y-4 mt-4 text-xs">
              {/* Section Name */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Section Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Section A, Boys Section"
                  value={sectionForm.name}
                  onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {/* Shift & Max Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Shift <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={sectionForm.shift}
                    onChange={e => setSectionForm({ ...sectionForm, shift: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="morning">Morning Shift</option>
                    <option value="afternoon">Afternoon Shift</option>
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
                    value={sectionForm.max_capacity}
                    onChange={e => setSectionForm({ ...sectionForm, max_capacity: parseInt(e.target.value) || 40 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Room Number */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Room Number <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Room 101, Lab 2"
                  value={sectionForm.room_number}
                  onChange={e => setSectionForm({ ...sectionForm, room_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {/* Class Teacher Incharge */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class Teacher Incharge <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </label>
                <select
                  value={sectionForm.class_teacher_id}
                  onChange={e => setSectionForm({ ...sectionForm, class_teacher_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">-- Unassigned (Select Staff) --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.designation ? `(${t.designation})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSectionModal(false)}
                  className="h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Add Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3C: EDIT CLASS SECTION */}
      {showEditSectionModal && editingSection && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 max-h-[92dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white">
                  <Pencil className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Section: {editingSection.name}</h3>
                  <p className="text-[11px] text-slate-500">Update section name, shift, room, class teacher, or max capacity.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditSectionModal(false)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSection} className="space-y-4 mt-4 text-xs">
              {/* Section Name */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Section Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Section A, Boys Section"
                  value={editSectionForm.name}
                  onChange={e => setEditSectionForm({ ...editSectionForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {/* Shift & Max Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Shift <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editSectionForm.shift}
                    onChange={e => setEditSectionForm({ ...editSectionForm, shift: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="morning">Morning Shift</option>
                    <option value="afternoon">Afternoon Shift</option>
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
                    value={editSectionForm.max_capacity}
                    onChange={e => setEditSectionForm({ ...editSectionForm, max_capacity: parseInt(e.target.value) || 40 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Room Number */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Room Number <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Room 101, Lab 2"
                  value={editSectionForm.room_number}
                  onChange={e => setEditSectionForm({ ...editSectionForm, room_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {/* Class Teacher Incharge */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class Teacher Incharge <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </label>
                <select
                  value={editSectionForm.class_teacher_id}
                  onChange={e => setEditSectionForm({ ...editSectionForm, class_teacher_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">-- Unassigned (Select Staff) --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.designation ? `(${t.designation})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditSectionModal(false)}
                  className="h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE BATCH */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="mobile-sheet-card bg-white rounded-t-xl sm:rounded-xl max-w-lg w-full p-3.5 sm:p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-slate-900 text-white">
                  <FolderTree className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create Academic Batch</h3>
                  <p className="text-[10.5px] text-slate-500">Define batch name, shift hours, calendar lifespan, and fee billing mode.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBatchModal(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4 mt-4 text-xs">
              {/* Batch Name */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Batch Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Batch 1, Evening Coaching 2026"
                  value={batchForm.name}
                  onChange={e => setBatchForm({ ...batchForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {/* Shift & Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Shift <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={batchForm.shift}
                    onChange={e => setBatchForm({ ...batchForm, shift: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="morning">Morning Shift</option>
                    <option value="afternoon">Afternoon Shift</option>
                    <option value="evening">Evening Shift</option>
                    <option value="weekend">Weekend Shift</option>
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Shift Timings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Start Time <span className="text-slate-400 font-normal text-[10px]">(e.g. 08:00 AM)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="08:00 AM"
                    value={batchForm.start_time}
                    onChange={e => setBatchForm({ ...batchForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    End Time <span className="text-slate-400 font-normal text-[10px]">(e.g. 01:30 PM)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="01:30 PM"
                    value={batchForm.end_time}
                    onChange={e => setBatchForm({ ...batchForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Batch Lifespan (Start Date to End Date) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Course Start Date <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={batchForm.start_date}
                    onChange={e => setBatchForm({ ...batchForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Course End Date <span className="text-slate-400 font-normal text-[10px]">(Batch Expiry)</span>
                  </label>
                  <input
                    type="date"
                    value={batchForm.end_date}
                    onChange={e => setBatchForm({ ...batchForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Billing Mode & Default Fee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Fee Billing Mode <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={batchForm.billing_mode}
                    onChange={e => setBatchForm({ ...batchForm, billing_mode: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="monthly">Monthly Tuition Cycle</option>
                    <option value="one_time">One-Time Package Fee</option>
                    <option value="installment">Installment Plan</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {batchForm.billing_mode === 'monthly' ? 'Monthly Tuition (PKR)' : 'Package / Total Fee (PKR)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g. 8000"
                    value={batchForm.fee_amount}
                    onChange={e => setBatchForm({ ...batchForm, fee_amount: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Classroom Room & Academic Session */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Classroom / Room # <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Room 102, Lab 1"
                    value={batchForm.room_number}
                    onChange={e => setBatchForm({ ...batchForm, room_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Academic Session</label>
                  <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-mono text-xs font-semibold flex items-center justify-between">
                    <span>{tenant?.academic_session || '2026-2027'}</span>
                    <span className="text-[10px] uppercase font-sans font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Global Default
                    </span>
                  </div>
                </div>
              </div>

              {/* Incharge Teacher */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class Teacher / Batch Incharge <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={batchForm.class_teacher_id}
                  onChange={e => setBatchForm({ ...batchForm, class_teacher_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">Unassigned (Select Staff)</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.designation ? `(${t.designation})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Subjects (Course Curriculum) */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Enrolled Subjects / Course Curriculum <span className="text-slate-400 font-normal text-[10px]">(Select subjects taught in this batch)</span>
                </label>
                <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 max-h-36 overflow-y-auto space-y-1.5">
                  {subjects.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No subjects in catalog. Add subjects in Master Subject Catalog first.</p>
                  ) : (
                    subjects.map(s => {
                      const isChecked = (batchForm.subject_ids || []).includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              const cur = batchForm.subject_ids || [];
                              if (e.target.checked) {
                                setBatchForm({ ...batchForm, subject_ids: [...cur, s.id] });
                              } else {
                                setBatchForm({ ...batchForm, subject_ids: cur.filter(id => id !== s.id) });
                              }
                            }}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="font-medium text-slate-800">{s.name}</span>
                          {s.code && <span className="text-[10px] text-slate-400 font-mono">({s.code})</span>}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="w-full sm:w-auto h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-8.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 shadow-xs cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? 'Saving...' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4B: EDIT EXISTING BATCH */}
      {showEditBatchModal && editingBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="mobile-sheet-card bg-white rounded-t-xl sm:rounded-xl max-w-lg w-full p-3.5 sm:p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-slate-900 text-white">
                  <Pencil className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Batch: {editingBatch.name}</h3>
                  <p className="text-[10.5px] text-slate-500">Update capacity, shift, timings, lifespan, room, or billing mode</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEditBatchModal(false)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateBatch} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Batch Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editBatchForm.name}
                  onChange={e => setEditBatchForm({ ...editBatchForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Shift <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editBatchForm.shift}
                    onChange={e => setEditBatchForm({ ...editBatchForm, shift: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="morning">Morning Shift</option>
                    <option value="afternoon">Afternoon Shift</option>
                    <option value="evening">Evening Shift</option>
                    <option value="weekend">Weekend Shift</option>
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
                    value={editBatchForm.max_capacity}
                    onChange={e => setEditBatchForm({ ...editBatchForm, max_capacity: parseInt(e.target.value) || 40 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Shift Timings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Start Time <span className="text-slate-400 font-normal text-[10px]">(e.g. 08:00 AM)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="08:00 AM"
                    value={editBatchForm.start_time}
                    onChange={e => setEditBatchForm({ ...editBatchForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    End Time <span className="text-slate-400 font-normal text-[10px]">(e.g. 01:30 PM)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="01:30 PM"
                    value={editBatchForm.end_time}
                    onChange={e => setEditBatchForm({ ...editBatchForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Batch Lifespan (Start Date to End Date) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Course Start Date <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={editBatchForm.start_date}
                    onChange={e => setEditBatchForm({ ...editBatchForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Course End Date <span className="text-slate-400 font-normal text-[10px]">(Batch Expiry)</span>
                  </label>
                  <input
                    type="date"
                    value={editBatchForm.end_date}
                    onChange={e => setEditBatchForm({ ...editBatchForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Billing Mode & Default Fee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Fee Billing Mode <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editBatchForm.billing_mode}
                    onChange={e => setEditBatchForm({ ...editBatchForm, billing_mode: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="monthly">Monthly Tuition Cycle</option>
                    <option value="one_time">One-Time Package Fee</option>
                    <option value="installment">Installment Plan</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {editBatchForm.billing_mode === 'monthly' ? 'Monthly Tuition (PKR)' : 'Package / Total Fee (PKR)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g. 8000"
                    value={editBatchForm.fee_amount}
                    onChange={e => setEditBatchForm({ ...editBatchForm, fee_amount: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              {/* Classroom Room & Academic Session */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Classroom / Room # <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Room 102, Lab 1"
                    value={editBatchForm.room_number}
                    onChange={e => setEditBatchForm({ ...editBatchForm, room_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Academic Session</label>
                  <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-mono text-xs font-semibold flex items-center justify-between">
                    <span>{editBatchForm.academic_session || tenant?.academic_session || '2026-2027'}</span>
                    <span className="text-[10px] uppercase font-sans font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Global Default
                    </span>
                  </div>
                </div>
              </div>

              {/* Class Teacher / Incharge */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class Teacher / Batch Incharge <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={editBatchForm.class_teacher_id}
                  onChange={e => setEditBatchForm({ ...editBatchForm, class_teacher_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">Unassigned (Select Staff)</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.designation ? `(${t.designation})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Subjects (Course Curriculum) */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Enrolled Subjects / Course Curriculum <span className="text-slate-400 font-normal text-[10px]">(Select subjects taught in this batch)</span>
                </label>
                <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 max-h-36 overflow-y-auto space-y-1.5">
                  {subjects.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No subjects in catalog. Add subjects in Master Subject Catalog first.</p>
                  ) : (
                    subjects.map(s => {
                      const isChecked = (editBatchForm.subject_ids || []).includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              const cur = editBatchForm.subject_ids || [];
                              if (e.target.checked) {
                                setEditBatchForm({ ...editBatchForm, subject_ids: [...cur, s.id] });
                              } else {
                                setEditBatchForm({ ...editBatchForm, subject_ids: cur.filter(id => id !== s.id) });
                              }
                            }}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="font-medium text-slate-800">{s.name}</span>
                          {s.code && <span className="text-[10px] text-slate-400 font-mono">({s.code})</span>}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditBatchModal(false)}
                  className="w-full sm:w-auto h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-8.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 shadow-xs cursor-pointer flex items-center justify-center"
                >
                  {isSubmitting ? 'Saving...' : 'Update Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4C: SMART DELETE SECTION / BATCH WITH BULK TRANSFER */}
      {showDeleteBatchModal && batchToDelete && (() => {
        const isDeleteTargetSection = (batchToDelete.cohort_type || (/section/i.test(batchToDelete.name) ? 'section' : 'batch')) === 'section';
        const deleteLabel = isDeleteTargetSection ? 'Section' : 'Batch';
        const deleteLabelLower = isDeleteTargetSection ? 'section' : 'batch';
        const parentScopeLabel = isDeleteTargetSection ? 'class' : 'program';
        const siblingDestinations = batches.filter(x => {
          if (x.program_id !== batchToDelete.program_id || x.id === batchToDelete.id) return false;
          const sibType = x.cohort_type || (/section/i.test(x.name) ? 'section' : 'batch');
          return sibType === (isDeleteTargetSection ? 'section' : 'batch');
        });
        const activeStudentCount = students.filter(s => s.batch_id === batchToDelete.id).length;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Transfer Students & Delete {deleteLabel}</h3>
                    <p className="text-[11px] text-slate-500">{deleteLabel}: {batchToDelete.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowDeleteBatchModal(false)} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 mt-4 text-xs">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
                  <strong>{activeStudentCount} active students</strong> are currently enrolled in <strong>{batchToDelete.name}</strong>.
                  To prevent broken fee ledgers or orphaned student profiles, select a destination {deleteLabelLower} to transfer them to.
                </div>

                {siblingDestinations.length > 0 ? (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Select Destination {deleteLabel} <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={transferTargetBatchId}
                      onChange={e => setTransferTargetBatchId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {siblingDestinations.map(b => {
                        const count = students.filter(s => s.batch_id === b.id).length;
                        return (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.shift}) • {count}/{b.max_capacity} seats
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600">
                    There are no other {deleteLabelLower}s in this {parentScopeLabel}. Please create another {deleteLabelLower} first or reassign the students before deleting this {deleteLabelLower}.
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteBatchModal(false)}
                    className="h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  {siblingDestinations.length > 0 && (
                    <button
                      type="button"
                      disabled={isSubmitting || !transferTargetBatchId}
                      onClick={() => executeDeleteBatch(batchToDelete.id, batchToDelete.name, transferTargetBatchId)}
                      className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'Transferring...' : `Transfer ${activeStudentCount} Students & Delete`}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 4E: STUDENT CLASS PROMOTION & SECTION TRANSFER */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 max-h-[92dvh] flex flex-col justify-between mobile-sheet-card overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Split className="w-4 h-4 text-indigo-600" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Batch Transfer</h3>
                    <p className="text-[11px] text-slate-500">
                      Transfer students between batches with tuition fee adjustment
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowPromoteModal(false)} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleExecutePromotion} id="promoteForm" className="space-y-4 mt-4 overflow-y-auto max-h-[62vh] pr-1">
                {/* 1. Source & Destination Batch Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Source Batch <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={promoteSourceBatchId}
                      onChange={e => handleSourceBatchChange(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                      required
                    >
                      <option value="" disabled>Select Source Batch</option>
                      {batches.map(b => {
                        const count = students.filter(s => s.batch_id === b.id && s.status === 'active').length;
                        return (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.shift} • {count} students)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Destination Batch <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={promoteTargetBatchId}
                      onChange={e => setPromoteTargetBatchId(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                      required
                    >
                      <option value="" disabled>Select Destination Batch</option>
                      {batches
                        .filter(b => b.id !== promoteSourceBatchId)
                        .map(b => {
                          const count = students.filter(s => s.batch_id === b.id && s.status === 'active').length;
                          return (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.shift}{b.fee_amount ? ` • PKR ${b.fee_amount.toLocaleString()}` : ''} • {count}/{b.max_capacity} seats)
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Target Academic Session
                  </label>
                  <div className="w-full text-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-mono font-semibold flex items-center justify-between">
                    <span>{promoteTargetSession || tenant?.academic_session || '2026-2027'}</span>
                    <span className="text-[10px] uppercase font-sans font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Global Default
                    </span>
                  </div>
                </div>

                {/* 2. Student Selection Checklist */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Select Students ({promoteSelectedStudentIds.length} of {students.filter(s => s.batch_id === promoteSourceBatchId && s.status === 'active').length} Selected)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const activeBatchStudents = students.filter(s => s.batch_id === promoteSourceBatchId && s.status === 'active');
                        if (promoteSelectedStudentIds.length === activeBatchStudents.length) {
                          setPromoteSelectedStudentIds([]);
                        } else {
                          setPromoteSelectedStudentIds(activeBatchStudents.map(s => s.id));
                        }
                      }}
                      className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold min-h-[36px] flex items-center"
                    >
                      {promoteSelectedStudentIds.length === students.filter(s => s.batch_id === promoteSourceBatchId && s.status === 'active').length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 p-1">
                    {students
                      .filter(s => s.batch_id === promoteSourceBatchId && s.status === 'active')
                      .map(s => {
                        const isChecked = promoteSelectedStudentIds.includes(s.id);
                        const fee = s.fee_structure?.net_tuition ?? s.fee_structure?.base_tuition ?? 0;
                        return (
                          <label key={s.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs rounded">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setPromoteSelectedStudentIds([...promoteSelectedStudentIds, s.id]);
                                  } else {
                                    setPromoteSelectedStudentIds(promoteSelectedStudentIds.filter(id => id !== s.id));
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                              />
                              <span className="font-medium text-slate-800">{s.full_name}</span>
                              <span className="font-mono text-[10px] text-slate-400">({s.roll_number || s.id.slice(0, 6)})</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">PKR {fee.toLocaleString()}</span>
                          </label>
                        );
                      })}
                    {students.filter(s => s.batch_id === promoteSourceBatchId && s.status === 'active').length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No active students in selected section.
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Fee Adjustment Policy */}
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-2.5">
                  <span className="text-xs font-bold text-slate-800 block">Tuition Fee Adjustment Policy</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className={`p-2.5 rounded-lg border flex items-start gap-2 cursor-pointer transition-colors ${
                      promoteFeePolicy === 'keep' ? 'bg-white border-indigo-600 text-slate-900 shadow-2xs' : 'border-slate-200 text-slate-700 bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="promoteFeePolicy"
                        value="keep"
                        checked={promoteFeePolicy === 'keep'}
                        onChange={() => setPromoteFeePolicy('keep')}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div>
                        <span className="font-bold block">Keep Current Fee</span>
                        <span className="text-[11px] text-slate-500">Student tuition fee remains unchanged.</span>
                      </div>
                    </label>

                    <label className={`p-2.5 rounded-lg border flex items-start gap-2 cursor-pointer transition-colors ${
                      promoteFeePolicy === 'target_baseline' ? 'bg-white border-indigo-600 text-slate-900 shadow-2xs' : 'border-slate-200 text-slate-700 bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="promoteFeePolicy"
                        value="target_baseline"
                        checked={promoteFeePolicy === 'target_baseline'}
                        onChange={() => setPromoteFeePolicy('target_baseline')}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div>
                        <span className="font-bold block">Adopt Destination Batch Fee</span>
                        <span className="text-[11px] text-slate-500">
                          {batches.find(b => b.id === promoteTargetBatchId)?.fee_amount != null
                            ? `Set fee to destination batch fee (PKR ${batches.find(b => b.id === promoteTargetBatchId)?.fee_amount?.toLocaleString()})`
                            : 'Set fee to destination batch standard fee schedule'}
                        </span>
                      </div>
                    </label>

                    <label className={`p-2.5 rounded-lg border flex items-start gap-2 cursor-pointer transition-colors ${
                      promoteFeePolicy === 'percentage' ? 'bg-white border-indigo-600 text-slate-900 shadow-2xs' : 'border-slate-200 text-slate-700 bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="promoteFeePolicy"
                        value="percentage"
                        checked={promoteFeePolicy === 'percentage'}
                        onChange={() => setPromoteFeePolicy('percentage')}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div className="flex-1">
                        <span className="font-bold block">Percentage Hike (+%)</span>
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={promoteFeeValue}
                            onChange={e => setPromoteFeeValue(parseFloat(e.target.value) || 0)}
                            className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono text-xs"
                            disabled={promoteFeePolicy !== 'percentage'}
                          />
                          <span className="text-slate-500 text-[11px]">% annual hike</span>
                        </div>
                      </div>
                    </label>

                    <label className={`p-2.5 rounded-lg border flex items-start gap-2 cursor-pointer transition-colors ${
                      promoteFeePolicy === 'fixed' ? 'bg-white border-indigo-600 text-slate-900 shadow-2xs' : 'border-slate-200 text-slate-700 bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="promoteFeePolicy"
                        value="fixed"
                        checked={promoteFeePolicy === 'fixed'}
                        onChange={() => setPromoteFeePolicy('fixed')}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div className="flex-1">
                        <span className="font-bold block">Fixed Amount (+PKR)</span>
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="number"
                            min={0}
                            step={50}
                            value={promoteFeeValue}
                            onChange={e => setPromoteFeeValue(parseFloat(e.target.value) || 0)}
                            className="w-20 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono text-xs"
                            disabled={promoteFeePolicy !== 'fixed'}
                          />
                          <span className="text-slate-500 text-[11px]">PKR increment</span>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </form>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowPromoteModal(false)}
                className="h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="promoteForm"
                disabled={isPromoting || promoteSelectedStudentIds.length === 0 || !promoteTargetBatchId}
                className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Split className="w-3.5 h-3.5" />
                <span>
                  {isPromoting ? 'Transferring Students...' : `Transfer (${promoteSelectedStudentIds.length} Students)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4D: SMART DELETE CLASS WITH BULK TRANSFER */}
      {showDeleteProgramModal && programToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                  <ArrowRightLeft className="w-4 h-4 text-rose-600" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Transfer Students & Delete Class</h3>
                  <p className="text-[11px] text-slate-500">Class: {programToDelete.name}</p>
                </div>
              </div>
              <button onClick={() => setShowDeleteProgramModal(false)} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 leading-relaxed">
                <strong>{students.filter(s => s.program_id === programToDelete.id).length} active students</strong> are currently enrolled in <strong>{programToDelete.name}</strong>.
                Select a destination class to transfer them to before deleting.
              </div>

              {programs.filter(x => x.id !== programToDelete.id).length > 0 ? (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Select Destination Class <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={transferTargetProgramId}
                    onChange={e => setTransferTargetProgramId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {programs
                      .filter(x => x.id !== programToDelete.id)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} • {students.filter(s => s.program_id === p.id).length} Students
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600">
                  There are no other classes in the institution. Reassign or graduate students before deleting this class.
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteProgramModal(false)}
                  className="h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                {programs.filter(x => x.id !== programToDelete.id).length > 0 && (
                  <button
                    type="button"
                    disabled={isSubmitting || !transferTargetProgramId}
                    onClick={() => executeDeleteProgram(programToDelete.id, programToDelete.name, transferTargetProgramId)}
                    className="h-8.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Transferring...' : `Transfer ${students.filter(s => s.program_id === programToDelete.id).length} Students & Delete`}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD SUBJECT TO CATALOG */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                </span>
                <div>
                  <SectionInfo title="Add Subject" description="Define course code and title in master repository" />
                </div>
              </div>
              <button onClick={() => setShowSubjectModal(false)} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2">
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
                  value={subjectForm.name}
                  onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Subject Code <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={subjectForm.code}
                  onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SUBJECT */}
      {showEditSubjectModal && editingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="mobile-sheet-card bg-white rounded-t-xl sm:rounded-xl max-w-sm w-full p-3.5 sm:p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white">
                  <Pencil className="w-4 h-4 text-amber-400" />
                </span>
                <div>
                  <SectionInfo title="Edit Subject" description="Update subject code and name in catalog" />
                </div>
              </div>
              <button onClick={() => setShowEditSubjectModal(false)} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg touch-press -mr-2">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubject} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Subject Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editSubjectForm.name}
                  onChange={e => setEditSubjectForm({ ...editSubjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Subject Code <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={editSubjectForm.code}
                  onChange={e => setEditSubjectForm({ ...editSubjectForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditSubjectModal(false)}
                  className="h-8.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Update Subject'}
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
