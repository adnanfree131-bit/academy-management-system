import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Layers, 
  BookOpen, 
  Users, 
  Plus, 
  Search, 
  Trash2, 
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
  DollarSign,
  Pencil,
  UserCheck,
  ArrowRightLeft
} from 'lucide-react';
import { AcademicProgram, Batch, Subject, SubjectGroup, Student } from '@apex/shared-types';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';

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
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selected Program for Drill-Down Hierarchy
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [searchClassQuery, setSearchClassQuery] = useState('');
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');

  // Modals
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showEditProgramModal, setShowEditProgramModal] = useState(false);
  const [showCompulsoryModal, setShowCompulsoryModal] = useState(false);
  const [showElectiveTrackModal, setShowElectiveTrackModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

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
  const [promoteTargetProgramId, setPromoteTargetProgramId] = useState('');
  const [promoteTargetBatchId, setPromoteTargetBatchId] = useState('');
  const [promoteTargetSession, setPromoteTargetSession] = useState('');
  const [promoteSelectedStudentIds, setPromoteSelectedStudentIds] = useState<string[]>([]);
  const [promoteFeePolicy, setPromoteFeePolicy] = useState<'keep' | 'target_baseline' | 'percentage' | 'fixed'>('keep');
  const [promoteFeeValue, setPromoteFeeValue] = useState<number>(10);
  const [isPromoting, setIsPromoting] = useState(false);

  // Forms: Program (Class)
  const [programForm, setProgramForm] = useState({
    name: '',
    code: '',
    description: '',
    sort_order: 1,
  });

  const [programFeeSchedule, setProgramFeeSchedule] = useState<{
    tuition: number | '';
    admission: number | '';
    exam_lab: number | '';
  }>({
    tuition: '',
    admission: '',
    exam_lab: ''
  });

  const [compulsorySelectedSubjectIds, setCompulsorySelectedSubjectIds] = useState<string[]>([]);

  const [electiveTrackForm, setElectiveTrackForm] = useState({
    name: '',
    subject_ids: [] as string[],
  });

  // Forms: Batch (Section)
  const [batchForm, setBatchForm] = useState({
    program_id: '',
    name: '',
    shift: 'morning' as 'morning' | 'evening',
    academic_session: tenant?.academic_session || '2026-2027',
    max_capacity: 40 as number | '',
    room_number: '',
    class_teacher_id: '',
  });

  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [editBatchForm, setEditBatchForm] = useState({
    name: '',
    shift: 'morning' as 'morning' | 'evening',
    academic_session: tenant?.academic_session || '2026-2027',
    max_capacity: 40 as number | '',
    room_number: '',
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
      const [progRes, batchRes, subRes, groupRes, studRes, staffRes] = await Promise.all([
        fetch('/api/v1/academic/programs', { headers }),
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/academic/subjects', { headers }),
        fetch('/api/v1/academic/groups', { headers }),
        fetch('/api/v1/sis/students', { headers }),
        fetch('/api/v1/academic/staff', { headers }).catch(() => null),
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
      (s.code || '').toLowerCase().includes(searchCatalogQuery.toLowerCase())
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
        name: programForm.name.trim(),
        code: programForm.code.trim() ? programForm.code.trim().toUpperCase() : undefined,
        description: programForm.description.trim() || undefined,
        sort_order: Number(programForm.sort_order) || 1,
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
      setProgramFeeSchedule({ tuition: '', admission: '', exam_lab: '' });
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
      code: p.code || '',
      description: p.description || '',
      sort_order: p.sort_order || 1,
    });
    setProgramFeeSchedule({
      tuition: p.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount ?? '',
      admission: p.fee_schedule?.find(f => f.fee_type === 'admission')?.amount ?? '',
      exam_lab: p.fee_schedule?.find(f => f.fee_type === 'exam_lab')?.amount ?? '',
    });
    setShowEditProgramModal(true);
  };

  const handleUpdateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeProgram || !programForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const fee_schedule = [
        { fee_head_id: 'tuition', head_name: 'Monthly Tuition Fee', fee_type: 'tuition', name: 'Monthly Tuition Fee', amount: Number(programFeeSchedule.tuition) || 0, is_monthly: true, is_recurring: true },
        { fee_head_id: 'admission', head_name: 'Admission Fee', fee_type: 'admission', name: 'One-time Admission Fee', amount: Number(programFeeSchedule.admission) || 0, is_monthly: false, is_recurring: false },
        { fee_head_id: 'exam_lab', head_name: 'Exam & Lab Charges', fee_type: 'exam_lab', name: 'Exam & Lab Charges', amount: Number(programFeeSchedule.exam_lab) || 0, is_monthly: false, is_recurring: false },
      ];

      const payload = {
        name: programForm.name.trim(),
        code: programForm.code.trim() ? programForm.code.trim().toUpperCase() : undefined,
        description: programForm.description.trim() || undefined,
        sort_order: Number(programForm.sort_order) || 1,
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
      if (confirm(`Are you sure you want to delete class "${p.name}"? This will also remove associated streams and section links.`)) {
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

  // Handlers: Batches (Sections)
  const openAddBatchModal = () => {
    if (!activeProgram) return;
    setBatchForm({
      program_id: activeProgram.id,
      name: '',
      shift: 'morning',
      academic_session: tenant?.academic_session || '2026-2027',
      max_capacity: 40,
      room_number: '',
      class_teacher_id: '',
    });
    setShowBatchModal(true);
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !batchForm.program_id || !batchForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      const teacher = teachers.find(t => t.id === batchForm.class_teacher_id);
      const res = await fetch('/api/v1/academic/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...batchForm,
          max_capacity: Number(batchForm.max_capacity) || 40,
          class_teacher_id: batchForm.class_teacher_id || undefined,
          class_teacher_name: teacher ? teacher.full_name : undefined,
          fee_schedule: activeProgram?.fee_schedule || [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to create section');

      setShowBatchModal(false);
      triggerSuccess(`Section "${data.data.name}" created successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating section');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditBatchModal = (b: Batch) => {
    setEditingBatch(b);
    setEditBatchForm({
      name: b.name,
      shift: b.shift,
      academic_session: b.academic_session || tenant?.academic_session || '2026-2027',
      max_capacity: b.max_capacity || 40,
      room_number: b.room_number || '',
      class_teacher_id: b.class_teacher_id || '',
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
          name: editBatchForm.name.trim(),
          shift: editBatchForm.shift,
          academic_session: editBatchForm.academic_session,
          max_capacity: Number(editBatchForm.max_capacity) || 40,
          room_number: editBatchForm.room_number.trim() || null,
          class_teacher_id: editBatchForm.class_teacher_id || null,
          class_teacher_name: teacher ? teacher.full_name : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to update section');

      setShowEditBatchModal(false);
      setEditingBatch(null);
      triggerSuccess(`Section "${data.data.name}" updated successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error updating section');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initiateDeleteBatch = (b: Batch) => {
    const enrolledStudents = students.filter(s => s.batch_id === b.id);
    if (enrolledStudents.length === 0) {
      if (confirm(`Are you sure you want to delete section "${b.name}"?`)) {
        executeDeleteBatch(b.id, b.name);
      }
      return;
    }

    // Has students: open smart transfer modal
    setBatchToDelete(b);
    const siblings = batches.filter(x => x.program_id === b.program_id && x.id !== b.id);
    setTransferTargetBatchId(siblings[0]?.id || '');
    setShowDeleteBatchModal(true);
  };

  const executeDeleteBatch = async (batchId: string, batchName: string, transferBatchId?: string) => {
    setIsSubmitting(true);
    try {
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
        triggerSuccess(`Section "${batchName}" deleted${transferBatchId ? ' and students transferred' : ''}.`);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to delete section');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error deleting section');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers: Student Promotion & Batch Transfer
  const openPromoteModal = (sourceBatchId?: string) => {
    const defaultSourceId = sourceBatchId || activeBatches[0]?.id || batches[0]?.id || '';
    setPromoteSourceBatchId(defaultSourceId);

    const batchStudents = students.filter(s => s.batch_id === defaultSourceId && s.status === 'active');
    setPromoteSelectedStudentIds(batchStudents.map(s => s.id));

    const currentBatch = batches.find(b => b.id === defaultSourceId);
    const currentProgId = currentBatch?.program_id || activeProgram?.id || programs[0]?.id || '';
    const otherProgs = programs.filter(p => p.id !== currentProgId);
    const defaultTargetProg = otherProgs[0]?.id || currentProgId;
    setPromoteTargetProgramId(defaultTargetProg);

    const targetBatches = batches.filter(b => b.program_id === defaultTargetProg && b.id !== defaultSourceId);
    setPromoteTargetBatchId(targetBatches[0]?.id || '');

    setPromoteTargetSession(tenant?.academic_session || '2026-2027');
    setPromoteFeePolicy('keep');
    setPromoteFeeValue(10);
    setShowPromoteModal(true);
  };

  const handleSourceBatchChange = (sourceId: string) => {
    setPromoteSourceBatchId(sourceId);
    const batchStudents = students.filter(s => s.batch_id === sourceId && s.status === 'active');
    setPromoteSelectedStudentIds(batchStudents.map(s => s.id));
  };

  const handleTargetProgramChange = (progId: string) => {
    setPromoteTargetProgramId(progId);
    const targetBatches = batches.filter(b => b.program_id === progId && b.id !== promoteSourceBatchId);
    setPromoteTargetBatchId(targetBatches[0]?.id || '');
  };

  const handleExecutePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || promoteSelectedStudentIds.length === 0 || !promoteTargetProgramId || !promoteTargetBatchId) return;

    setIsPromoting(true);
    try {
      const res = await fetch('/api/v1/academic/students/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_ids: promoteSelectedStudentIds,
          target_program_id: promoteTargetProgramId,
          target_batch_id: promoteTargetBatchId,
          target_session: promoteTargetSession,
          fee_adjustment_type: promoteFeePolicy,
          fee_adjustment_value: promoteFeeValue,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to promote students');

      setShowPromoteModal(false);
      triggerSuccess(`Successfully promoted ${data.data?.count || promoteSelectedStudentIds.length} students to new class/section.`);
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

  return (
    <div className="space-y-5">
      
      {/* Top Header Card */}
      <PageHeading
        title="Academic Structure"
        description="Manage classes, compulsory subjects, elective streams, and section batches."
        icon={<Layers className="w-4 h-4 text-slate-700" />}
        badge={`Session ${tenant?.academic_session || '2026-2027'}`}
      >
        <button 
          onClick={fetchData} 
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* Mode Switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar whitespace-nowrap">
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
      </PageHeading>

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
            <span className="text-xs font-semibold">Elective Streams</span>
            <Split className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            {subjectGroups.filter(g => g.type === 'elective_track').length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Pre-Med, Pre-Eng, ICS streams</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Class Sections</span>
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
                value={searchClassQuery}
                onChange={e => setSearchClassQuery(e.target.value)}
                placeholder="Search classes..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                      <span>{classTracks.length} Streams</span>
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
                      onClick={() => openEditProgramModal(activeProgram)}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                      title="Edit Class Name, Code & Fee Baseline"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                      <span>Edit Class</span>
                    </button>
                    <button
                      onClick={openAddBatchModal}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      <span>Add Section</span>
                    </button>
                    <button
                      onClick={() => initiateDeleteProgram(activeProgram)}
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
                          Compulsory Subjects
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Core subjects automatically assigned to all students admitted to {activeProgram.name}.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={openManageCompulsoryModal}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all"
                    >
                      {activeCompulsoryGroup ? 'Configure Subjects' : '+ Add Compulsory Subjects'}
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
                      No compulsory subjects attached to this class. Click "Configure Subjects" above to select courses from the catalog.
                    </div>
                  )}
                </div>

                {/* SECTION 2: Elective Groups */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                        <Split className="w-4 h-4 text-purple-600" />
                      </span>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Elective Subject Groups ({activeElectiveTracks.length})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Elective groups (e.g. Pre-Medical, Pre-Engineering, Computer Science). Students choose one group during admission.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={openAddElectiveTrackModal}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Elective Group</span>
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
                                title="Delete Group"
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
                        No elective groups configured for this class. (If this class has no electives, students will only be enrolled in Compulsory subjects).
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 3: Sections & Batches with Elective Breakdown */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        <FolderTree className="w-4 h-4 text-blue-600" />
                      </span>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Class Sections & Batches ({activeBatches.length})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Section allocations, shift schedules, and elective breakdown.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openPromoteModal()}
                        className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                        title="Promote or Transfer Students across classes or sections"
                      >
                        <Split className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Promote / Transfer</span>
                      </button>

                      <button
                        onClick={openAddBatchModal}
                        className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all"
                      >
                        + Create Section
                      </button>
                    </div>
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
                              <div className="flex items-center gap-2 flex-wrap">
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
                                {b.class_teacher_name ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                    <UserCheck className="w-3 h-3 text-indigo-600" />
                                    <span>Incharge: {b.class_teacher_name}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-slate-400 italic">
                                    No Incharge
                                  </span>
                                )}
                                {activeProgram.fee_schedule && activeProgram.fee_schedule.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <DollarSign className="w-3 h-3 text-emerald-600" />
                                    PKR {activeProgram.fee_schedule.find(f => f.fee_type === 'tuition')?.amount?.toLocaleString() || '0'}/mo
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-right mr-2">
                                <div className="text-[11px] font-mono">
                                  <strong>{enrolledCount}</strong> / {maxCap} seats ({percent}%)
                                </div>
                                <div className="w-28 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                  <div 
                                    className={`h-1.5 rounded-full ${
                                      percent >= 100 ? 'bg-rose-600' : percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${percent}%` }}
                                  ></div>
                                </div>
                              </div>

                              <button
                                onClick={() => openPromoteModal(b.id)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                title="Promote or Transfer Students from this Section"
                              >
                                <Split className="w-3 h-3 text-indigo-600" />
                                <span>Promote</span>
                              </button>

                              <button
                                onClick={() => openEditBatchModal(b)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit Section"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => initiateDeleteBatch(b)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Section"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Elective Population in this section */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="text-slate-400 font-medium">Elective Breakdown:</span>
                            {activeElectiveTracks.map(t => {
                              const inTrackCount = batchStudents.filter(s => s.elective_group_id === t.id).length;
                              return (
                                <span key={t.id} className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-slate-700 font-medium">
                                  {t.name}: <strong className="text-slate-900 font-mono">{inTrackCount}</strong>
                                </span>
                              );
                            })}
                            {activeElectiveTracks.length === 0 && (
                              <span className="text-slate-500 italic">All students taking compulsory curriculum</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {activeBatches.length === 0 && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        No sections allocated for this class yet. Click "+ Create Section" to schedule morning or evening sections.
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
                  value={searchCatalogQuery}
                  onChange={e => setSearchCatalogQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                        {s.code && (
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                            {s.code}
                          </span>
                        )}
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
                  <SectionInfo title="Add Class" description="Configure a grade level or preparatory class" />
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
                  placeholder="e.g. Class 10, F.Sc Pre-Medical"
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
                    placeholder="e.g. C10, MED"
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
                  placeholder="Optional brief notes or syllabus details"
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

      {/* MODAL 1B: EDIT EXISTING CLASS */}
      {showEditProgramModal && activeProgram && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-600 text-white">
                  <Pencil className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Class - {activeProgram.name}</h3>
                  <p className="text-[11px] text-slate-500">Update naming, display order, or fee baseline</p>
                </div>
              </div>
              <button onClick={() => setShowEditProgramModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProgram} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class / Grade Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={programForm.name}
                  onChange={e => setProgramForm({ ...programForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">Class Code</label>
                  </div>
                  <input
                    type="text"
                    value={programForm.code}
                    onChange={e => setProgramForm({ ...programForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
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
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Description / Curriculum Scope</label>
                <textarea
                  rows={2}
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
                  onClick={() => setShowEditProgramModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
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

      {/* MODAL 3: CREATE ELECTIVE STREAM */}
      {showElectiveTrackModal && activeProgram && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-purple-600 text-white">
                  <Split className="w-4 h-4 text-white" />
                </span>
                <div>
                  <SectionInfo title={`Elective Group: ${activeProgram.name}`} description="Group elective subjects into a subject group (Pre-Medical, Pre-Engineering, Computer Science)." />
                </div>
              </div>
              <button onClick={() => setShowElectiveTrackModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateElectiveTrack} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Elective Group Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pre-Medical, Pre-Engineering, Computer Science"
                  value={electiveTrackForm.name}
                  onChange={e => setElectiveTrackForm({ ...electiveTrackForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Select Subjects in this Elective Group <span className="text-rose-500">*</span>
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
                        {s.code && (
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {s.code}
                          </span>
                        )}
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
                  {isSubmitting ? 'Saving...' : 'Create Elective Group'}
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
                  <SectionInfo title={`Allocate Section: ${activeProgram.name}`} description="Define shift, capacity, session, and section incharge" />
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
                  placeholder="e.g. Section A, Morning Med-1"
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

              <div>
                <label className="block text-slate-700 font-bold mb-1">Academic Session</label>
                <input
                  type="text"
                  value={batchForm.academic_session}
                  onChange={e => setBatchForm({ ...batchForm, academic_session: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Class Teacher / Incharge */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class Teacher / Section Incharge <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={batchForm.class_teacher_id}
                  onChange={e => setBatchForm({ ...batchForm, class_teacher_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Unassigned (Select Staff) --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.designation ? `(${t.designation})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fee Notice: Inherits class fees without redundant form inputs */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">Class Baseline Fee Applied</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Inherits Monthly Tuition (PKR {activeProgram.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount?.toLocaleString() || '0'}/mo) from {activeProgram.name}.
                  </p>
                </div>
                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs shrink-0">
                  PKR {activeProgram.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount?.toLocaleString() || '0'}/mo
                </span>
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
                  {isSubmitting ? 'Saving...' : 'Create Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4B: EDIT EXISTING SECTION */}
      {showEditBatchModal && editingBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-600 text-white">
                  <Pencil className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Section: {editingBatch.name}</h3>
                  <p className="text-[11px] text-slate-500">Update capacity, shift, session, or assigned incharge</p>
                </div>
              </div>
              <button onClick={() => setShowEditBatchModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateBatch} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Section / Batch Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editBatchForm.name}
                  onChange={e => setEditBatchForm({ ...editBatchForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Shift <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editBatchForm.shift}
                    onChange={e => setEditBatchForm({ ...editBatchForm, shift: e.target.value as 'morning' | 'evening' })}
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
                    value={editBatchForm.max_capacity}
                    onChange={e => setEditBatchForm({ ...editBatchForm, max_capacity: parseInt(e.target.value) || 40 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Academic Session</label>
                <input
                  type="text"
                  value={editBatchForm.academic_session}
                  onChange={e => setEditBatchForm({ ...editBatchForm, academic_session: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Class Teacher / Incharge */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Class Teacher / Section Incharge <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={editBatchForm.class_teacher_id}
                  onChange={e => setEditBatchForm({ ...editBatchForm, class_teacher_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  onClick={() => setShowEditBatchModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4C: SMART DELETE SECTION WITH BULK TRANSFER */}
      {showDeleteBatchModal && batchToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Transfer Students & Delete Section</h3>
                  <p className="text-[11px] text-slate-500">Section: {batchToDelete.name}</p>
                </div>
              </div>
              <button onClick={() => setShowDeleteBatchModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
                <strong>{students.filter(s => s.batch_id === batchToDelete.id).length} active students</strong> are currently enrolled in <strong>{batchToDelete.name}</strong>.
                To prevent broken fee ledgers or orphaned student profiles, select a destination section to transfer them to.
              </div>

              {batches.filter(x => x.program_id === batchToDelete.program_id && x.id !== batchToDelete.id).length > 0 ? (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Select Destination Section <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={transferTargetBatchId}
                    onChange={e => setTransferTargetBatchId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {batches
                      .filter(x => x.program_id === batchToDelete.program_id && x.id !== batchToDelete.id)
                      .map(b => {
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
                  There are no other sections in this class. Please create another section first or reassign the students before deleting this section.
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteBatchModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                {batches.filter(x => x.program_id === batchToDelete.program_id && x.id !== batchToDelete.id).length > 0 && (
                  <button
                    type="button"
                    disabled={isSubmitting || !transferTargetBatchId}
                    onClick={() => executeDeleteBatch(batchToDelete.id, batchToDelete.name, transferTargetBatchId)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Transferring...' : `Transfer ${students.filter(s => s.batch_id === batchToDelete.id).length} Students & Delete`}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4E: STUDENT CLASS PROMOTION & SECTION TRANSFER */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Split className="w-4 h-4 text-indigo-600" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Promote / Transfer Students</h3>
                    <p className="text-[11px] text-slate-500">
                      End-of-session class promotion or cohort transfer with tuition fee adjustment
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowPromoteModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleExecutePromotion} id="promoteForm" className="space-y-4 mt-4 overflow-y-auto max-h-[62vh] pr-1">
                {/* 1. Source & Target Batch Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Source Section <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={promoteSourceBatchId}
                      onChange={e => handleSourceBatchChange(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                      required
                    >
                      <option value="" disabled>Select Source Section</option>
                      {batches.map(b => {
                        const prog = programs.find(p => p.id === b.program_id);
                        const count = students.filter(s => s.batch_id === b.id && s.status === 'active').length;
                        return (
                          <option key={b.id} value={b.id}>
                            {prog?.name || 'Class'} — {b.name} ({count} students)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Target Academic Class <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={promoteTargetProgramId}
                      onChange={e => handleTargetProgramChange(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                      required
                    >
                      <option value="" disabled>Select Target Class</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Target Section / Batch <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={promoteTargetBatchId}
                      onChange={e => setPromoteTargetBatchId(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                      required
                    >
                      <option value="" disabled>Select Target Section</option>
                      {batches
                        .filter(b => b.program_id === promoteTargetProgramId && b.id !== promoteSourceBatchId)
                        .map(b => {
                          const count = students.filter(s => s.batch_id === b.id && s.status === 'active').length;
                          return (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.shift}) • {count}/{b.max_capacity} seats
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Target Academic Session
                    </label>
                    <input
                      type="text"
                      value={promoteTargetSession}
                      onChange={e => setPromoteTargetSession(e.target.value)}
                      placeholder="e.g. 2026-2027"
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
                    />
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
                      className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold"
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
                                    setPromoteSelectedStudentIds(prev => [...prev, s.id]);
                                  } else {
                                    setPromoteSelectedStudentIds(prev => prev.filter(id => id !== s.id));
                                  }
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="font-mono text-slate-500 text-[11px]">{s.roll_number || '—'}</span>
                              <span className="font-medium text-slate-800">{s.full_name}</span>
                            </div>
                            <span className="font-mono text-slate-500 text-[11px]">
                              PKR {Number(fee).toLocaleString()}/mo
                            </span>
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
                        <span className="font-bold block">Target Class Baseline</span>
                        <span className="text-[11px] text-slate-500">Adopt target class standard tuition fee.</span>
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
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="promoteForm"
                disabled={isPromoting || promoteSelectedStudentIds.length === 0 || !promoteTargetBatchId}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                <Split className="w-3.5 h-3.5" />
                <span>
                  {isPromoting ? 'Promoting Cohort...' : `Promote & Transfer (${promoteSelectedStudentIds.length} Students)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4D: SMART DELETE CLASS WITH BULK TRANSFER */}
      {showDeleteProgramModal && programToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
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
              <button onClick={() => setShowDeleteProgramModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
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
                          {p.name} ({p.code || 'CLS'}) • {students.filter(s => s.program_id === p.id).length} Students
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
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                {programs.filter(x => x.id !== programToDelete.id).length > 0 && (
                  <button
                    type="button"
                    disabled={isSubmitting || !transferTargetProgramId}
                    onClick={() => executeDeleteProgram(programToDelete.id, programToDelete.name, transferTargetProgramId)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-slate-900 text-white">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                </span>
                <div>
                  <SectionInfo title="Add Subject" description="Define course code and title in master repository" />
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
