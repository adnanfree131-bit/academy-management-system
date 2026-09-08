import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  X, 
  Phone, 
  ShieldCheck, 
  UserCheck,
  RefreshCw,
  Plus,
  DollarSign,
  BookOpen,
  CreditCard,
  CheckSquare,
  Square
} from 'lucide-react';
import { 
  AcademicProgram, 
  Batch, 
  Subject, 
  SubjectGroup, 
  CustomFieldDefinition, 
  Student, 
  StudentInquiry, 
  InquiryStage 
} from '@apex/shared-types';
import { Student360Modal } from '../components/Student360Modal';
import { StudentIDCardDesk } from './StudentIDCardDesk';

export interface EnrollmentViewProps {
  defaultTab?: 'directory' | 'id_cards' | 'inquiries' | 'new_admission';
}

export const EnrollmentView: React.FC<EnrollmentViewProps> = ({ defaultTab = 'directory' }) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'directory' | 'id_cards' | 'inquiries' | 'new_admission'>(defaultTab);
  const [selectedDirectoryStudentIds, setSelectedDirectoryStudentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Hierarchy and metadata state
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);

  // SIS Records
  const [students, setStudents] = useState<Student[]>([]);
  const [inquiries, setInquiries] = useState<StudentInquiry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [inquiryStageFilter, setInquiryStageFilter] = useState<string>('all');

  // Drawer / Modals
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [admitInquiryModal, setAdmitInquiryModal] = useState<StudentInquiry | null>(null);
  const [admitBatchId, setAdmitBatchId] = useState<string>('');
  const [admitElectiveGroupId, setAdmitElectiveGroupId] = useState<string>('');
  const [isAdmitting, setIsAdmitting] = useState<boolean>(false);

  // New Inquiry Modal
  const [showNewInquiryModal, setShowNewInquiryModal] = useState(false);
  const [newInquiryForm, setNewInquiryForm] = useState({
    student_name: '',
    phone: '',
    email: '',
    guardian_name: '',
    guardian_phone: '',
    program_id: '',
    notes: '',
  });

  // Direct Admission Form State
  const [enrollForm, setEnrollForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    guardian_name: '',
    guardian_phone: '',
    program_id: '',
    batch_id: '',
    elective_group_id: '',
    custom_field_values: {} as Record<string, any>,
  });
  const [selectedEnrollSubjectIds, setSelectedEnrollSubjectIds] = useState<string[]>([]);
  const [admitCustomSubjectIds, setAdmitCustomSubjectIds] = useState<string[]>([]);
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [admissionTuition, setAdmissionTuition] = useState<number>(8000);
  const [admissionFeeCharge, setAdmissionFeeCharge] = useState<number>(5000);
  const [admissionExamCharge, setAdmissionExamCharge] = useState<number>(1500);
  const [concessionType, setConcessionType] = useState<'none' | 'kinship' | 'merit' | 'hardship' | 'staff' | 'custom'>('none');
  const [concessionMode, setConcessionMode] = useState<'percentage' | 'flat'>('percentage');
  const [concessionVal, setConcessionVal] = useState<number>(0);
  const [concessionReason, setConcessionReason] = useState<string>('');
  const [generateFirstChallan, setGenerateFirstChallan] = useState(true);

  const [createdStudentResult, setCreatedStudentResult] = useState<Student | null>(null);
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);
  const [enrollSuccessMessage, setEnrollSuccessMessage] = useState<string | null>(null);

  // Load all initial academic and SIS data
  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [progRes, batchRes, subRes, groupRes, fieldRes, studRes, inqRes] = await Promise.all([
        fetch('/api/v1/academic/programs', { headers }),
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/academic/subjects', { headers }),
        fetch('/api/v1/academic/groups', { headers }),
        fetch('/api/v1/academic/custom-fields?entity_type=student', { headers }),
        fetch('/api/v1/sis/students', { headers }),
        fetch('/api/v1/sis/inquiries', { headers }),
      ]);

      const [progs, bts, subs, grps, fields, studs, inqs] = await Promise.all([
        progRes.json(),
        batchRes.json(),
        subRes.json(),
        groupRes.json(),
        fieldRes.json(),
        studRes.json(),
        inqRes.json(),
      ]);

      if (progs.success) setPrograms(progs.data);
      if (bts.success) setBatches(bts.data);
      if (subs.success) setSubjects(subs.data);
      if (grps.success) setSubjectGroups(grps.data);
      if (fields.success) setCustomFields(fields.data);
      if (studs.success) setStudents(studs.data);
      if (inqs.success) setInquiries(inqs.data);
    } catch (err: any) {
      console.error('Error fetching academic data:', err);
      setError('Failed to synchronize academic hierarchy from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        s.full_name.toLowerCase().includes(q) ||
        s.admission_number.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(searchQuery));
      
      const matchesBatch = selectedBatchFilter === 'all' || s.batch_id === selectedBatchFilter;

      return matchesSearch && matchesBatch;
    });
  }, [students, searchQuery, selectedBatchFilter]);

  const toggleDirectoryStudent = (id: string) => {
    const next = new Set(selectedDirectoryStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDirectoryStudentIds(next);
  };

  const toggleSelectAllFiltered = () => {
    if (filteredStudents.length > 0 && filteredStudents.every(s => selectedDirectoryStudentIds.has(s.id))) {
      const next = new Set(selectedDirectoryStudentIds);
      filteredStudents.forEach(s => next.delete(s.id));
      setSelectedDirectoryStudentIds(next);
    } else {
      const next = new Set(selectedDirectoryStudentIds);
      filteredStudents.forEach(s => next.add(s.id));
      setSelectedDirectoryStudentIds(next);
    }
  };

  // Filtered Inquiries
  const filteredInquiries = useMemo(() => {
    return inquiries.filter(i => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        i.student_name.toLowerCase().includes(q) ||
        i.inquiry_number.toLowerCase().includes(q) ||
        i.phone.includes(searchQuery);
      const matchesStage = inquiryStageFilter === 'all' || i.stage === inquiryStageFilter;
      return matchesSearch && matchesStage;
    });
  }, [inquiries, searchQuery, inquiryStageFilter]);

  // Handle Inquiry Stage Update
  const handleUpdateStage = async (inquiryId: string, newStage: InquiryStage) => {
    try {
      const res = await fetch(`/api/v1/sis/inquiries/${inquiryId}/stage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage: newStage }),
      });
      const data = await res.json();
      if (data.success) {
        setInquiries(prev => prev.map(item => item.id === inquiryId ? data.data : item));
      }
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  };

  // Handle 1-Click Admit from Inquiry
  const handleExecuteAdmit = async () => {
    if (!admitInquiryModal || !admitBatchId) return;
    setIsAdmitting(true);

    try {
      const res = await fetch(`/api/v1/sis/inquiries/${admitInquiryModal.id}/admit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          batch_id: admitBatchId,
          elective_group_id: admitElectiveGroupId || undefined,
          subjects: admitCustomSubjectIds.length > 0 ? admitCustomSubjectIds : undefined,
        }),
      });

      const result = await res.json();
      if (result.success) {
        // Refresh inquiries and students
        await fetchData();
        setAdmitInquiryModal(null);
        setAdmitBatchId('');
        setAdmitElectiveGroupId('');
        setAdmitCustomSubjectIds([]);
        setActiveTab('directory');
      } else {
        alert(result.error?.message || 'Admission failed');
      }
    } catch (err) {
      console.error('Admission failed:', err);
      alert('Failed to execute 1-click admission.');
    } finally {
      setIsAdmitting(false);
    }
  };

  // Create New Inquiry
  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/sis/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newInquiryForm,
          source: 'Walk-in',
          stage: 'new',
        }),
      });

      const result = await res.json();
      if (result.success) {
        setInquiries(prev => [result.data, ...prev]);
        setShowNewInquiryModal(false);
        setNewInquiryForm({
          student_name: '',
          phone: '',
          email: '',
          guardian_name: '',
          guardian_phone: '',
          program_id: '',
          notes: '',
        });
      }
    } catch (err) {
      console.error('Failed to create inquiry:', err);
    }
  };

  // Sync batch fee schedule when batch is selected
  useEffect(() => {
    if (enrollForm.batch_id) {
      const b = batches.find(x => x.id === enrollForm.batch_id);
      const p = programs.find(x => x.id === enrollForm.program_id);
      const tuition = b?.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount 
        ?? p?.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount 
        ?? 8000;
      const admission = b?.fee_schedule?.find(f => f.fee_type === 'admission')?.amount 
        ?? p?.fee_schedule?.find(f => f.fee_type === 'admission')?.amount 
        ?? 5000;
      const exam = b?.fee_schedule?.find(f => f.fee_type === 'exam_lab')?.amount 
        ?? p?.fee_schedule?.find(f => f.fee_type === 'exam_lab')?.amount 
        ?? 1500;
      setAdmissionTuition(tuition);
      setAdmissionFeeCharge(admission);
      setAdmissionExamCharge(exam);
    }
  }, [enrollForm.batch_id, enrollForm.program_id, batches, programs]);

  const discountAmount = useMemo(() => {
    if (concessionType === 'none' || concessionVal <= 0) return 0;
    if (concessionMode === 'percentage') {
      return Math.round((admissionTuition * Math.min(100, concessionVal)) / 100);
    }
    return Math.min(admissionTuition, concessionVal);
  }, [concessionType, concessionMode, concessionVal, admissionTuition]);

  const netMonthlyTuition = Math.max(0, admissionTuition - discountAmount);
  const firstMonthTotal = netMonthlyTuition + admissionFeeCharge + admissionExamCharge;

  // Direct Admission Submit
  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollForm.program_id || !enrollForm.batch_id || !enrollForm.full_name) {
      alert('Please fill all required institutional fields.');
      return;
    }

    if (discountAmount > 0 && !concessionReason.trim()) {
      alert('A justification reason is mandatory when applying a student fee concession.');
      return;
    }

    setIsSubmittingEnrollment(true);
    setEnrollSuccessMessage(null);
    setCreatedStudentResult(null);

    // Collect subjects: use granular selection if provided, else default to compulsory + elective group
    const compGroup = subjectGroups.find(g => g.program_id === enrollForm.program_id && g.type === 'compulsory');
    let defaultIds = compGroup ? [...compGroup.subject_ids] : [];
    if (enrollForm.elective_group_id) {
      const elecGroup = subjectGroups.find(g => g.id === enrollForm.elective_group_id);
      if (elecGroup) {
        defaultIds = [...defaultIds, ...elecGroup.subject_ids];
      }
    }
    const subjectIds = selectedEnrollSubjectIds.length > 0 ? selectedEnrollSubjectIds : defaultIds;

    try {
      const res = await fetch('/api/v1/sis/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: enrollForm.full_name,
          phone: enrollForm.phone,
          email: enrollForm.email || undefined,
          guardian_name: enrollForm.guardian_name,
          guardian_phone: enrollForm.guardian_phone,
          program_id: enrollForm.program_id,
          batch_id: enrollForm.batch_id,
          elective_group_id: enrollForm.elective_group_id || undefined,
          blood_group: bloodGroup,
          fee_structure: {
            base_tuition: admissionTuition,
            admission_fee: admissionFeeCharge,
            exam_fee: admissionExamCharge,
            concession_type: concessionMode,
            concession_val: discountAmount > 0 ? concessionVal : 0,
            concession_reason: discountAmount > 0 ? concessionReason : undefined,
            net_tuition: netMonthlyTuition,
            first_month_total: firstMonthTotal,
          },
          generate_first_month_invoice: generateFirstChallan,
          subjects: subjectIds,
          custom_field_values: enrollForm.custom_field_values,
          status: 'active',
        }),
      });

      let result: any;
      try {
        result = await res.json();
      } catch {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      if (res.ok && result.success) {
        setCreatedStudentResult(result.data);
        setEnrollSuccessMessage(`Enrollment confirmed! Admission: ${result.data.admission_number} | Roll: ${result.data.roll_number}`);
        setEnrollForm({
          full_name: '',
          phone: '',
          email: '',
          guardian_name: '',
          guardian_phone: '',
          program_id: '',
          batch_id: '',
          elective_group_id: '',
          custom_field_values: {},
        });
        setConcessionType('none');
        setConcessionVal(0);
        setConcessionReason('');
        await fetchData();
      } else {
        alert(result?.error?.message || `Enrollment failed with status ${res.status}`);
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      alert('Failed to register student record.');
    } finally {
      setIsSubmittingEnrollment(false);
    }
  };

  // Helper resolvers
  const getProgramName = (progId: string) => programs.find(p => p.id === progId)?.name || 'General Academic';
  const getBatchName = (batchId: string) => batches.find(b => b.id === batchId)?.name || 'Unassigned Batch';
  const getSubjectNames = (subIds: string[]) => {
    return subIds.map(id => subjects.find(s => s.id === id)?.name || id).filter(Boolean);
  };

  // Dynamic filter for batches and elective groups based on chosen program in enrollment form
  const availableBatchesForEnroll = useMemo(() => {
    if (!enrollForm.program_id) return [];
    return batches.filter(b => b.program_id === enrollForm.program_id);
  }, [batches, enrollForm.program_id]);

  const compulsoryGroupForEnroll = useMemo(() => {
    if (!enrollForm.program_id) return null;
    return subjectGroups.find(g => g.program_id === enrollForm.program_id && g.type === 'compulsory');
  }, [subjectGroups, enrollForm.program_id]);

  const electiveGroupsForEnroll = useMemo(() => {
    if (!enrollForm.program_id) return [];
    return subjectGroups.filter(g => g.program_id === enrollForm.program_id && g.type === 'elective_track');
  }, [subjectGroups, enrollForm.program_id]);

  // Auto-sync selected subjects when program or elective track changes
  useEffect(() => {
    if (!enrollForm.program_id) {
      setSelectedEnrollSubjectIds([]);
      return;
    }
    const compGroup = subjectGroups.find(g => g.program_id === enrollForm.program_id && g.type === 'compulsory');
    const compIds = compGroup ? compGroup.subject_ids : [];
    let elecIds: string[] = [];
    if (enrollForm.elective_group_id) {
      const elecGroup = subjectGroups.find(g => g.id === enrollForm.elective_group_id);
      if (elecGroup) elecIds = elecGroup.subject_ids;
    }
    setSelectedEnrollSubjectIds([...new Set([...compIds, ...elecIds])]);
  }, [enrollForm.program_id, enrollForm.elective_group_id, subjectGroups]);

  // Auto-sync inquiry admission subjects when target batch or elective changes
  useEffect(() => {
    if (admitInquiryModal && admitBatchId) {
      const batch = batches.find(b => b.id === admitBatchId);
      if (batch) {
        const compGroup = subjectGroups.find(g => g.program_id === batch.program_id && g.type === 'compulsory');
        const compIds = compGroup ? compGroup.subject_ids : [];
        let elecIds: string[] = [];
        if (admitElectiveGroupId) {
          const elecGroup = subjectGroups.find(g => g.id === admitElectiveGroupId);
          if (elecGroup) elecIds = elecGroup.subject_ids;
        }
        setAdmitCustomSubjectIds([...new Set([...compIds, ...elecIds])]);
      }
    }
  }, [admitInquiryModal, admitBatchId, admitElectiveGroupId, batches, subjectGroups]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
            <UserPlus className="w-5 h-5 text-indigo-400" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900">Student Admissions & Directory</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <ShieldCheck className="w-3 h-3 text-indigo-600" />
                Student Records
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage student admissions, review inquiries, and maintain student records.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'directory' 
                ? 'bg-white text-slate-900 shadow-xs font-bold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Student Directory ({students.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('id_cards')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'id_cards' 
                ? 'bg-white text-slate-900 shadow-xs font-bold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-slate-700" />
            <span>Student ID Cards</span>
            {selectedDirectoryStudentIds.size > 0 && (
              <span className="px-1.5 py-0.2 bg-slate-900 text-white rounded-full text-[10px] font-mono font-bold">
                {selectedDirectoryStudentIds.size}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'inquiries' 
                ? 'bg-white text-slate-900 shadow-xs font-bold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Inquiries Desk ({inquiries.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('new_admission')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'new_admission' 
                ? 'bg-white text-slate-900 shadow-xs font-bold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
            <span>New Admission Form</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button 
            onClick={fetchData} 
            className="px-2.5 py-1 bg-rose-600 text-white rounded font-medium hover:bg-rose-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Retry Sync
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: STUDENT DIRECTORY & 360 PROFILE                                   */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by student name, roll #, admission #..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-sans"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" />
                <span className="font-semibold">Batch:</span>
              </div>
              <select
                value={selectedBatchFilter}
                onChange={e => setSelectedBatchFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Academic Batches ({batches.length})</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.shift.toUpperCase()} • {b.current_enrollment}/{b.max_capacity})
                  </option>
                ))}
              </select>

              <button 
                onClick={() => setActiveTab('new_admission')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors ml-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Admit Student</span>
              </button>
            </div>
          </div>

          {/* Selected Action Bar */}
          {selectedDirectoryStudentIds.size > 0 && (
            <div className="bg-slate-900 text-white rounded-xl p-3 px-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <span>{selectedDirectoryStudentIds.size} student{selectedDirectoryStudentIds.size > 1 ? 's' : ''} selected</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('id_cards')}
                  className="px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Generate & Print ID Cards ({selectedDirectoryStudentIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDirectoryStudentIds(new Set())}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAllFiltered}
                        className="text-slate-500 hover:text-slate-800"
                        title="Select/Deselect All Filtered"
                      >
                        {filteredStudents.length > 0 && filteredStudents.every(s => selectedDirectoryStudentIds.has(s.id)) ? (
                          <CheckSquare className="w-4 h-4 text-slate-900" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Student Details</th>
                    <th className="py-3 px-4">Admission #</th>
                    <th className="py-3 px-4">Roll #</th>
                    <th className="py-3 px-4">Program & Batch</th>
                    <th className="py-3 px-4">Guardian Contact</th>
                    <th className="py-3 px-4">Subjects</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-mono">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Loading student records...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No students found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => (
                      <tr key={student.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              toggleDirectoryStudent(student.id);
                            }}
                            className="text-slate-900"
                          >
                            {selectedDirectoryStudentIds.has(student.id) ? (
                              <CheckSquare className="w-4 h-4 text-slate-900" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {student.full_name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{student.phone || 'No phone'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {student.admission_number}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono font-bold text-[11px] border border-slate-200">
                            {student.roll_number}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{getProgramName(student.program_id)}</div>
                          <div className="text-[11px] text-indigo-600 font-medium">{getBatchName(student.batch_id)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">{student.guardian_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{student.guardian_phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {getSubjectNames(student.subjects).map((subName, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-semibold rounded border border-indigo-100">
                                {subName}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedStudent(student)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg text-xs font-bold transition-all border border-slate-200 hover:border-indigo-200 inline-flex items-center gap-1"
                          >
                            <span>Profile</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
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

      {/* ========================================================================= */}
      {/* TAB: STUDENT ID CARDS GENERATOR & PRINTING STUDIO                         */}
      {/* ========================================================================= */}
      {activeTab === 'id_cards' && (
        <StudentIDCardDesk
          students={students}
          batches={batches}
          programs={programs}
          initialSelectedIds={Array.from(selectedDirectoryStudentIds)}
          onBackToDirectory={() => setActiveTab('directory')}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INQUIRIES DESK & 1-CLICK ADMIT                                     */}
      {/* ========================================================================= */}
      {activeTab === 'inquiries' && (
        <div className="space-y-4">
          {/* Inquiries Header Controls */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Inquiries' },
                { id: 'new', label: 'New Inquiries' },
                { id: 'follow_up', label: 'Follow Up' },
                { id: 'fee_discussion', label: 'Fee Discussion' },
                { id: 'admitted', label: 'Admitted' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setInquiryStageFilter(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    inquiryStageFilter === st.id
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowNewInquiryModal(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap ml-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log New Inquiry</span>
            </button>
          </div>

          {/* Inquiries Table */}
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Inquiry #</th>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4">Phone Contact</th>
                    <th className="py-3 px-4">Guardian Particulars</th>
                    <th className="py-3 px-4">Program Interest</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {filteredInquiries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No inquiries in this pipeline stage.
                      </td>
                    </tr>
                  ) : (
                    filteredInquiries.map(inq => (
                      <tr key={inq.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {inq.inquiry_number}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {inq.student_name}
                          {inq.notes && (
                            <p className="text-[10px] text-slate-500 font-normal mt-0.5 line-clamp-1 italic">
                              "{inq.notes}"
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {inq.phone}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">{inq.guardian_name || 'N/A'}</div>
                          {inq.guardian_phone && (
                            <div className="text-[10px] text-slate-500 font-mono">{inq.guardian_phone}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {inq.program_id ? getProgramName(inq.program_id) : 'General Inquirer'}
                        </td>
                        <td className="py-3 px-4">
                          {inq.stage === 'admitted' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Admitted
                            </span>
                          ) : (
                            <select
                              value={inq.stage}
                              onChange={e => handleUpdateStage(inq.id, e.target.value as InquiryStage)}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="new">New Inquiry</option>
                              <option value="follow_up">Follow Up</option>
                              <option value="trial_scheduled">Trial Scheduled</option>
                              <option value="fee_discussion">Fee Discussion</option>
                              <option value="closed">Closed / Dropped</option>
                            </select>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {inq.stage !== 'admitted' ? (
                            <button
                              onClick={() => {
                                setAdmitInquiryModal(inq);
                                if (batches.length > 0) setAdmitBatchId(batches[0].id);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Admit Student</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-semibold italic">
                              Enrolled
                            </span>
                          )}
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

      {/* ========================================================================= */}
      {/* TAB 3: DYNAMIC ADMISSION FORM                                            */}
      {/* ========================================================================= */}
      {activeTab === 'new_admission' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs max-w-4xl mx-auto space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Institutional Student Admission Form</h2>
            <p className="text-xs text-slate-500 mt-1">
              Zero hardcoded curriculums. Program tracks, batch capacity limits, and custom fields adapt dynamically to institutional database rules.
            </p>
          </div>

          {enrollSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-xs text-emerald-800 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-bold text-sm">{enrollSuccessMessage}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200/60">
                {createdStudentResult && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(createdStudentResult)}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-indigo-300" />
                      <span>View Student Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (createdStudentResult) {
                          setSelectedDirectoryStudentIds(new Set([createdStudentResult.id]));
                        }
                        setActiveTab('id_cards');
                      }}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-slate-300" />
                      <span>Print ID Card</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('directory')}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                  View in Directory
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleEnrollStudent} className="space-y-6">
            {/* Step 1: Academic Program & Batch Selection */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Academic Hierarchy Selection</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Program / Discipline <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={enrollForm.program_id}
                    onChange={e => {
                      const progId = e.target.value;
                      setEnrollForm(prev => ({
                        ...prev,
                        program_id: progId,
                        batch_id: '',
                        elective_group_id: '',
                      }));
                    }}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Academic Program --</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Allocated Batch & Shift <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={enrollForm.batch_id}
                    onChange={e => setEnrollForm(prev => ({ ...prev, batch_id: e.target.value }))}
                    required
                    disabled={!enrollForm.program_id}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    <option value="">-- Select Shift & Batch --</option>
                    {availableBatchesForEnroll.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.shift.toUpperCase()} • Enrolled: {b.current_enrollment}/{b.max_capacity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Elective Track Dropdown if available */}
                {electiveGroupsForEnroll.length > 0 && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Elective Track / Subject Major Group
                    </label>
                    <select
                      value={enrollForm.elective_group_id}
                      onChange={e => setEnrollForm(prev => ({ ...prev, elective_group_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Select Elective Track (Optional) --</option>
                      {electiveGroupsForEnroll.map(eg => (
                        <option key={eg.id} value={eg.id}>
                          {eg.name} ({getSubjectNames(eg.subject_ids).join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Granular Subject Selection Register */}
                {enrollForm.program_id && (
                  <div className="sm:col-span-2 bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-slate-800" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Enrolled Course Subjects ({selectedEnrollSubjectIds.length} Selected)
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Check all subjects this student is attending. Uncheck if the student is admitted for partial subjects only.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const compIds = compulsoryGroupForEnroll?.subject_ids || [];
                            const elecGroup = subjectGroups.find(g => g.id === enrollForm.elective_group_id);
                            const elecIds = elecGroup?.subject_ids || [];
                            setSelectedEnrollSubjectIds([...new Set([...compIds, ...elecIds])]);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors shadow-2xs"
                        >
                          Select Recommended
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const elecGroup = subjectGroups.find(g => g.id === enrollForm.elective_group_id);
                            setSelectedEnrollSubjectIds(elecGroup?.subject_ids || []);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors shadow-2xs"
                        >
                          Electives Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedEnrollSubjectIds([])}
                          className="px-2.5 py-1 text-slate-500 hover:text-slate-800 rounded-lg text-[11px] transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Compulsory Core Subjects */}
                      {compulsoryGroupForEnroll && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Compulsory Subjects</span>
                          </div>
                          <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            {compulsoryGroupForEnroll.subject_ids.map(subId => {
                              const sub = subjects.find(s => s.id === subId);
                              const isChecked = selectedEnrollSubjectIds.includes(subId);
                              return (
                                <label
                                  key={subId}
                                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                                    isChecked ? 'bg-white shadow-2xs border border-emerald-200' : 'hover:bg-slate-100/70 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedEnrollSubjectIds(prev =>
                                          prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
                                        );
                                      }}
                                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                    />
                                    <div>
                                      <span className="font-semibold text-slate-900">{sub?.name || subId}</span>
                                      <span className="text-[10px] font-mono text-slate-500 ml-2">({sub?.code || 'CORE'})</span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Core
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Elective Track Subjects */}
                      {electiveGroupsForEnroll.map(eg => (
                        <div key={eg.id} className="space-y-1.5">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            <span>{eg.name}</span>
                          </div>
                          <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            {eg.subject_ids.map(subId => {
                              const sub = subjects.find(s => s.id === subId);
                              const isChecked = selectedEnrollSubjectIds.includes(subId);
                              return (
                                <label
                                  key={subId}
                                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                                    isChecked ? 'bg-white shadow-2xs border border-indigo-200' : 'hover:bg-slate-100/70 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedEnrollSubjectIds(prev =>
                                          prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
                                        );
                                      }}
                                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                    />
                                    <div>
                                      <span className="font-semibold text-slate-900">{sub?.name || subId}</span>
                                      <span className="text-[10px] font-mono text-slate-500 ml-2">({sub?.code || 'ELEC'})</span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                    Elective
                                  </span>
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
            </div>

            {/* Step 2: Student Identity & Contact Particulars */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Student & Guardian Identity</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Student Full Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={enrollForm.full_name}
                    onChange={e => setEnrollForm(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="e.g. Muhammad Bilal"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Student Mobile / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={enrollForm.phone}
                    onChange={e => setEnrollForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0300-1234567"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Student Email Address
                  </label>
                  <input
                    type="email"
                    value={enrollForm.email}
                    onChange={e => setEnrollForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="student@example.com"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Blood Group (For Student ID Pass)
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={e => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guardian / Father's Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={enrollForm.guardian_name}
                    onChange={e => setEnrollForm(prev => ({ ...prev, guardian_name: e.target.value }))}
                    placeholder="e.g. Muhammad Aslam"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guardian Emergency Mobile <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={enrollForm.guardian_phone}
                    onChange={e => setEnrollForm(prev => ({ ...prev, guardian_phone: e.target.value }))}
                    placeholder="0321-9876543"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Financial Schedule & Concession Plan */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Financial Schedule & Fee Concessions</h3>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                {/* Baseline Inherited from Batch */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-[11px]">Monthly Tuition (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      value={admissionTuition}
                      onChange={e => setAdmissionTuition(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-[11px]">Admission Fee (One-Time)</label>
                    <input
                      type="number"
                      min={0}
                      value={admissionFeeCharge}
                      onChange={e => setAdmissionFeeCharge(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-[11px]">Exam / Lab Charges</label>
                    <input
                      type="number"
                      min={0}
                      value={admissionExamCharge}
                      onChange={e => setAdmissionExamCharge(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Concession / Discount Selector */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      Scholarship / Concession Category
                    </span>
                    {discountAmount > 0 && (
                      <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Saving: PKR {discountAmount.toLocaleString()}/month
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1 text-[10px]">Concession Type</label>
                      <select
                        value={concessionType}
                        onChange={e => {
                          const type = e.target.value as any;
                          setConcessionType(type);
                          if (type === 'kinship') {
                            setConcessionMode('percentage');
                            setConcessionVal(20);
                            setConcessionReason('Kinship / Sibling concession policy');
                          } else if (type === 'merit') {
                            setConcessionMode('percentage');
                            setConcessionVal(25);
                            setConcessionReason('Academic merit scholarship');
                          } else if (type === 'hardship') {
                            setConcessionMode('percentage');
                            setConcessionVal(30);
                            setConcessionReason('Financial hardship / Need-based assistance');
                          } else if (type === 'staff') {
                            setConcessionMode('percentage');
                            setConcessionVal(50);
                            setConcessionReason('Staff child benefit');
                          } else if (type === 'none') {
                            setConcessionVal(0);
                            setConcessionReason('');
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                      >
                        <option value="none">Standard Full Fee (No Concession)</option>
                        <option value="kinship">Kinship / Sibling (20%)</option>
                        <option value="merit">Academic Merit (25%)</option>
                        <option value="hardship">Financial Hardship (30%)</option>
                        <option value="staff">Staff Child (50%)</option>
                        <option value="custom">Custom Concession</option>
                      </select>
                    </div>

                    {concessionType !== 'none' && (
                      <>
                        <div>
                          <label className="block text-slate-600 font-medium mb-1 text-[10px]">Discount Mode & Value</label>
                          <div className="flex gap-1.5">
                            <select
                              value={concessionMode}
                              onChange={e => setConcessionMode(e.target.value as any)}
                              className="w-20 px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                            >
                              <option value="percentage">%</option>
                              <option value="flat">PKR</option>
                            </select>
                            <input
                              type="number"
                              min={0}
                              value={concessionVal}
                              onChange={e => setConcessionVal(Number(e.target.value) || 0)}
                              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-600 font-medium mb-1 text-[10px]">
                            Justification / Approval Reason <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Sibling Roll #104 in Class 10"
                            value={concessionReason}
                            onChange={e => setConcessionReason(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Real-Time Net Admission Calculation Card */}
                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800 block">First Month Admission Total Due:</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Net Tuition: PKR {netMonthlyTuition.toLocaleString()} + Adm: PKR {admissionFeeCharge.toLocaleString()} + Exam: PKR {admissionExamCharge.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-indigo-950 font-mono">
                        PKR {firstMonthTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={generateFirstChallan}
                      onChange={e => setGenerateFirstChallan(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <span className="text-slate-700 text-xs font-semibold">
                      Auto-generate first month admission invoice & 3-part bank challan immediately
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Step 3: Dynamic Form Builder Custom Fields */}
            {customFields.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Tenant-Configured Form Fields
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {customFields.map(field => (
                    <div key={field.id} className={field.field_type === 'select' ? '' : 'sm:col-span-2'}>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {field.label} {field.is_required && <span className="text-rose-500">*</span>}
                      </label>

                      {field.field_type === 'select' ? (
                        <select
                          required={field.is_required}
                          value={enrollForm.custom_field_values[field.field_key] || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setEnrollForm(prev => ({
                              ...prev,
                              custom_field_values: {
                                ...prev.custom_field_values,
                                [field.field_key]: val,
                              },
                            }));
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        >
                          <option value="">-- Select {field.label} --</option>
                          {(field.options || []).map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                          required={field.is_required}
                          value={enrollForm.custom_field_values[field.field_key] || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setEnrollForm(prev => ({
                              ...prev,
                              custom_field_values: {
                                ...prev.custom_field_values,
                                [field.field_key]: val,
                              },
                            }));
                          }}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submission */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('directory')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEnrollment}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmittingEnrollment ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Registering Record...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Admission</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 360° SIS STUDENT PROFILE COMMAND CENTER & ID CARD MODAL                   */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <Student360Modal
          student={selectedStudent}
          programs={programs}
          batches={batches}
          subjects={subjects}
          subjectGroups={subjectGroups}
          onClose={() => setSelectedStudent(null)}
          onStudentUpdated={fetchData}
        />
      )}

      {/* ========================================================================= */}
      {/* 1-CLICK ADMISSION MODAL                                                  */}
      {/* ========================================================================= */}
      {admitInquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Admit Inquiring Student</span>
              </div>
              <button
                onClick={() => setAdmitInquiryModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Immediately enroll candidate <strong className="text-slate-900">{admitInquiryModal.student_name}</strong> into an active academic batch with automatic roll number assignment.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Batch</label>
                <select
                  value={admitBatchId}
                  onChange={e => setAdmitBatchId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.shift.toUpperCase()} • {b.current_enrollment}/{b.max_capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Elective Track (Optional)</label>
                <select
                  value={admitElectiveGroupId}
                  onChange={e => setAdmitElectiveGroupId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Compulsory Core Only --</option>
                  {subjectGroups.filter(g => g.type === 'elective_track').map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {admitBatchId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Enrolled Subjects ({admitCustomSubjectIds.length} Selected)
                  </label>
                  <div className="max-h-36 overflow-y-auto bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1">
                    {(() => {
                      const batch = batches.find(b => b.id === admitBatchId);
                      const pId = batch?.program_id;
                      const cGroup = subjectGroups.find(g => g.program_id === pId && g.type === 'compulsory');
                      const eGroup = admitElectiveGroupId ? subjectGroups.find(g => g.id === admitElectiveGroupId) : null;
                      const availableIds = [...(cGroup ? cGroup.subject_ids : []), ...(eGroup ? eGroup.subject_ids : [])];
                      if (availableIds.length === 0) return <span className="text-[11px] text-slate-400">No subjects assigned to this batch</span>;

                      return availableIds.map(subId => {
                        const sub = subjects.find(s => s.id === subId);
                        const isChecked = admitCustomSubjectIds.includes(subId);
                        return (
                          <label key={subId} className="flex items-center justify-between text-xs cursor-pointer p-1.5 rounded hover:bg-slate-100/80 transition-colors">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setAdmitCustomSubjectIds(prev => 
                                    prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
                                  );
                                }}
                                className="rounded text-indigo-600 w-3.5 h-3.5"
                              />
                              <span className="font-semibold text-slate-800">{sub?.name || subId}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">({sub?.code || 'SUB'})</span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setAdmitInquiryModal(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAdmit}
                disabled={isAdmitting}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isAdmitting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Enrolling...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Enroll</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NEW INQUIRY MODAL                                                        */}
      {/* ========================================================================= */}
      {showNewInquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Log Prospective Candidate Inquiry</span>
              </div>
              <button
                onClick={() => setShowNewInquiryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInquiry} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Student Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newInquiryForm.student_name}
                  onChange={e => setNewInquiryForm(prev => ({ ...prev, student_name: e.target.value }))}
                  placeholder="e.g. Harris Khan"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newInquiryForm.phone}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0300-0000000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newInquiryForm.email}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="candidate@mail.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Guardian Name</label>
                  <input
                    type="text"
                    value={newInquiryForm.guardian_name}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, guardian_name: e.target.value }))}
                    placeholder="Father/Mother"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Guardian Phone</label>
                  <input
                    type="text"
                    value={newInquiryForm.guardian_phone}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, guardian_phone: e.target.value }))}
                    placeholder="0321-0000000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Program of Interest</label>
                <select
                  value={newInquiryForm.program_id}
                  onChange={e => setNewInquiryForm(prev => ({ ...prev, program_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select Program --</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Inquiry Requirements</label>
                <textarea
                  value={newInquiryForm.notes}
                  onChange={e => setNewInquiryForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Wants evening shift, inquiring about fee discounts..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewInquiryModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  Save Inquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
