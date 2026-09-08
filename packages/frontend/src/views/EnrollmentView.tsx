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
  Plus
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

export const EnrollmentView: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'directory' | 'inquiries' | 'new_admission'>('directory');

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
        }),
      });

      const result = await res.json();
      if (result.success) {
        // Refresh inquiries and students
        await fetchData();
        setAdmitInquiryModal(null);
        setAdmitBatchId('');
        setAdmitElectiveGroupId('');
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

  // Direct Admission Submit
  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollForm.program_id || !enrollForm.batch_id || !enrollForm.full_name) {
      alert('Please fill all required institutional fields.');
      return;
    }

    setIsSubmittingEnrollment(true);
    setEnrollSuccessMessage(null);

    // Collect subjects from compulsory group + elective group
    const compGroup = subjectGroups.find(g => g.program_id === enrollForm.program_id && g.type === 'compulsory');
    let subjectIds = compGroup ? [...compGroup.subject_ids] : [];
    if (enrollForm.elective_group_id) {
      const elecGroup = subjectGroups.find(g => g.id === enrollForm.elective_group_id);
      if (elecGroup) {
        subjectIds = [...subjectIds, ...elecGroup.subject_ids];
      }
    }

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
        setEnrollSuccessMessage(`Enrollment confirmed! Admission Number: ${result.data.admission_number} | Roll Number: ${result.data.roll_number}`);
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

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
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

          {/* Table */}
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
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
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-mono">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Loading student records...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No students found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => (
                      <tr key={student.id} className="hover:bg-slate-50/70 transition-colors group">
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
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="font-bold">{enrollSuccessMessage}</span>
              </div>
              <button
                onClick={() => setActiveTab('directory')}
                className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700"
              >
                View in Directory
              </button>
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

                {/* Compulsory subjects automatic preview */}
                {compulsoryGroupForEnroll && (
                  <div className="sm:col-span-2 bg-white p-3 rounded-lg border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700">Auto-Assigned Compulsory Subjects:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {getSubjectNames(compulsoryGroupForEnroll.subject_ids).map((name, i) => (
                        <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[11px] font-semibold border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {name}
                        </span>
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

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guardian Emergency Mobile / WhatsApp <span className="text-rose-500">*</span>
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
      {/* 360° SIS STUDENT PROFILE DRAWER                                          */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {selectedStudent.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-snug">{selectedStudent.full_name}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span>{selectedStudent.admission_number}</span>
                    <span>•</span>
                    <span className="text-indigo-600 font-bold">Roll {selectedStudent.roll_number}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-5 text-xs">
              {/* Academic Placement */}
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">Academic Placement</h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Program:</span>
                    <span className="font-bold text-slate-900">{getProgramName(selectedStudent.program_id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Allocated Batch:</span>
                    <span className="font-bold text-indigo-700">{getBatchName(selectedStudent.batch_id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Admission Date:</span>
                    <span className="font-mono text-slate-800">{selectedStudent.admission_date}</span>
                  </div>
                </div>
              </div>

              {/* Enrolled Subjects */}
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">Enrolled Subjects & Modules</h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {getSubjectNames(selectedStudent.subjects).map((subName, i) => (
                      <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-800 font-semibold shadow-2xs">
                        {subName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Guardian Particulars */}
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">Guardian & Emergency Contact</h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Guardian Name:</span>
                    <span className="font-bold text-slate-900">{selectedStudent.guardian_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Phone Number:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedStudent.guardian_phone}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex gap-2">
                    <a
                      href={`https://wa.me/${selectedStudent.guardian_phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-center font-bold transition-colors"
                    >
                      WhatsApp Dispatch
                    </a>
                    <a
                      href={`tel:${selectedStudent.guardian_phone}`}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-center font-bold transition-colors"
                    >
                      Dial Phone
                    </a>
                  </div>
                </div>
              </div>

              {/* Dynamic Custom Fields */}
              {selectedStudent.custom_field_values && Object.keys(selectedStudent.custom_field_values).length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">Institutional Custom Details</h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                    {Object.entries(selectedStudent.custom_field_values).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                        <span className="font-bold text-slate-900">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
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
