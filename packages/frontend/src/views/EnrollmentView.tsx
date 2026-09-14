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
  UserCheck,
  RefreshCw,
  Plus,
  DollarSign,
  BookOpen,
  CreditCard,
  CheckSquare,
  Square,
  MessageSquare,
  Printer,
  Check,
  Copy,
  Camera, 
  Upload, 
  FileSpreadsheet,
  Eye
} from 'lucide-react';
import { 
  AcademicProgram, 
  Batch, 
  Subject, 
  SubjectGroup, 
  CustomFieldDefinition, 
  Student, 
  StudentInquiry, 
  InquiryStage, 
  InquiryPriority,
  FeeHead,
  PaymentMethod
} from '@apex/shared-types';
import { Student360Modal } from '../components/Student360Modal';
import { StudentIDCardDesk } from './StudentIDCardDesk';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';

export interface EnrollmentViewProps {
  defaultTab?: 'directory' | 'inquiries' | 'new_admission' | 'id_cards';
  onNavigate?: (screen: string) => void;
}

export const EnrollmentView: React.FC<EnrollmentViewProps> = ({ defaultTab = 'directory', onNavigate }) => {
  const { token, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'directory' | 'inquiries' | 'new_admission' | 'id_cards'>(defaultTab);
  const [selectedDirectoryStudentIds, setSelectedDirectoryStudentIds] = useState<Set<string>>(new Set());
  const [showBulkIdCardsModal, setShowBulkIdCardsModal] = useState(false);

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
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);

  // SIS Records
  const [students, setStudents] = useState<Student[]>([]);
  const [inquiries, setInquiries] = useState<StudentInquiry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inquiryStageFilter, setInquiryStageFilter] = useState<string>('all');

  // Drawer / Modals
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [contactStudentModal, setContactStudentModal] = useState<Student | null>(null);
  const [admitInquiryModal, setAdmitInquiryModal] = useState<StudentInquiry | null>(null);
  const [admitBatchId, setAdmitBatchId] = useState<string>('');
  const [admitElectiveGroupId, setAdmitElectiveGroupId] = useState<string>('');
  const [admitTuitionFee, setAdmitTuitionFee] = useState<number | ''>('');
  const [admitAdmissionFee, setAdmitAdmissionFee] = useState<number | ''>('');
  const [admitConcessionAmount, setAdmitConcessionAmount] = useState<number | ''>('');
  const [admitConcessionReason, setAdmitConcessionReason] = useState<string>('');
  const [admitGuardianCnic, setAdmitGuardianCnic] = useState<string>('');
  const [isAdmitting, setIsAdmitting] = useState<boolean>(false);

  // Bulk CSV Import Modal State
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportBatchId, setBulkImportBatchId] = useState<string>('');
  const [bulkImportCsvText, setBulkImportCsvText] = useState<string>('');
  const [isBulkImporting, setIsBulkImporting] = useState<boolean>(false);
  const [bulkImportResult, setBulkImportResult] = useState<{ imported_count: number; failed_count: number; errors: any[] } | null>(null);

  // New Inquiry Modal
  const [showNewInquiryModal, setShowNewInquiryModal] = useState(false);
  const [newInquiryForm, setNewInquiryForm] = useState({
    student_name: '',
    phone: '',
    email: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_id_card: '',
    program_id: '',
    source: 'Walk-in',
    priority: 'medium' as InquiryPriority,
    next_follow_up_date: '',
    previous_school: '',
    previous_marks: '',
    notes: '',
  });

  // Direct Admission Form State
  const [enrollForm, setEnrollForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_id_card: '',
    program_id: '',
    batch_id: '',
    elective_group_id: '',
    custom_field_values: {} as Record<string, any>,
  });
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [guardianRelation, setGuardianRelation] = useState<string>('Father');
  const [guardianWhatsapp, setGuardianWhatsapp] = useState<string>('');
  const [whatsappSameAsCalling, setWhatsappSameAsCalling] = useState<boolean>(true);

  const handleAdmissionPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('Photo must be less than 3MB in size');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const [selectedEnrollSubjectIds, setSelectedEnrollSubjectIds] = useState<string[]>([]);
  const [admitCustomSubjectIds, setAdmitCustomSubjectIds] = useState<string[]>([]);
  const [bloodGroup, setBloodGroup] = useState('');
  const [admissionTuition, setAdmissionTuition] = useState<number | ''>('');
  const [admissionFeeCharge, setAdmissionFeeCharge] = useState<number | ''>('');
  const [admissionExamCharge, setAdmissionExamCharge] = useState<number | ''>('');
  const [admissionHeadOverrides, setAdmissionHeadOverrides] = useState<Record<string, number | ''>>({});

  const [concessionType, setConcessionType] = useState<'none' | 'kinship' | 'merit' | 'hardship' | 'staff' | 'custom'>('none');
  const [concessionMode, setConcessionMode] = useState<'percentage' | 'flat'>('percentage');
  const [concessionVal, setConcessionVal] = useState<number | ''>('');
  const [concessionReason, setConcessionReason] = useState<string>('');
  const [generateFirstChallan, setGenerateFirstChallan] = useState(true);

  // Direct First Payment Collection at Admission
  const [collectInitialPayment, setCollectInitialPayment] = useState(false);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<number | ''>('');
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<PaymentMethod>('cash');
  const [initialPaymentReference, setInitialPaymentReference] = useState('');

  // Branded WhatsApp Receipt Modal State
  const [receiptModalData, setReceiptModalData] = useState<{
    student: Student;
    payment?: any;
    invoice?: any;
    amountPaid: number;
    totalDue: number;
    billingMonth: string;
    items: { name: string; amount: number }[];
  } | null>(null);
  const [receiptWhatsappNumber, setReceiptWhatsappNumber] = useState('');
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const [createdStudentResult, setCreatedStudentResult] = useState<Student | null>(null);
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);
  const [enrollSuccessMessage, setEnrollSuccessMessage] = useState<string | null>(null);

  const cleanPhoneForWhatsApp = (p?: string | null) => {
    if (!p) return '';
    let cleaned = p.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('03')) {
      cleaned = '92' + cleaned.slice(1);
    }
    return cleaned;
  };

  // Load all initial academic and SIS data
  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [progRes, batchRes, subRes, groupRes, fieldRes, studRes, inqRes, headsRes] = await Promise.all([
        fetch('/api/v1/academic/programs', { headers }),
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/academic/subjects', { headers }),
        fetch('/api/v1/academic/groups', { headers }),
        fetch('/api/v1/academic/custom-fields?entity_type=student', { headers }),
        fetch('/api/v1/sis/students', { headers }),
        fetch('/api/v1/sis/inquiries', { headers }),
        fetch('/api/v1/finance/heads', { headers }).catch(() => null),
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
      if (headsRes && headsRes.ok) {
        const headsData = await headsRes.json();
        if (headsData.success) setFeeHeads(headsData.data || []);
      }
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
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;

      return matchesSearch && matchesBatch && matchesStatus;
    });
  }, [students, searchQuery, selectedBatchFilter, statusFilter]);

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
      const tuition = typeof admitTuitionFee === 'number' ? admitTuitionFee : 0;
      const admissionFee = typeof admitAdmissionFee === 'number' ? admitAdmissionFee : 0;
      const concession = typeof admitConcessionAmount === 'number' ? admitConcessionAmount : 0;
      const netTuition = Math.max(0, tuition - concession);
      const firstMonthTotal = netTuition + admissionFee;

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
          guardian_id_card: admitGuardianCnic.trim() || undefined,
          fee_structure: {
            base_tuition: tuition,
            tuition_fee: tuition,
            admission_fee: admissionFee,
            concession_type: concession > 0 ? 'fixed' : 'none',
            concession_val: concession,
            concession_reason: concession > 0 ? (admitConcessionReason || 'Admissions Concession') : undefined,
            net_tuition: netTuition,
            first_month_total: firstMonthTotal,
          },
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
        setAdmitTuitionFee('');
        setAdmitAdmissionFee('');
        setAdmitConcessionAmount('');
        setAdmitConcessionReason('');
        setAdmitGuardianCnic('');
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

  // Bulk CSV Import Handler
  const handleExecuteBulkImport = async () => {
    if (!token || !bulkImportCsvText.trim()) return;
    setIsBulkImporting(true);
    setBulkImportResult(null);
    try {
      const lines = bulkImportCsvText.trim().split(/\r?\n/);
      if (lines.length <= 1) {
        alert('CSV must contain a header row and at least one student data row');
        setIsBulkImporting(false);
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        rows.push({
          full_name: rowObj.full_name || rowObj.name || rowObj['student name'] || '',
          roll_number: rowObj.roll_number || rowObj.roll_no || rowObj.roll || undefined,
          phone: rowObj.phone || rowObj.mobile || undefined,
          email: rowObj.email || undefined,
          guardian_name: rowObj.guardian_name || rowObj.father_name || rowObj['guardian name'] || 'Guardian',
          guardian_phone: rowObj.guardian_phone || rowObj.guardian_mobile || rowObj.phone || '0300-0000000',
          guardian_id_card: rowObj.guardian_id_card || rowObj.guardian_cnic || rowObj.cnic || undefined,
          guardian_relation: rowObj.guardian_relation || rowObj.relation || 'Father',
          batch_id: rowObj.batch_id || bulkImportBatchId || (batches[0]?.id || ''),
          gender: rowObj.gender || undefined,
          blood_group: rowObj.blood_group || undefined,
        });
      }

      const res = await fetch('/api/v1/sis/students/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ students: rows })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBulkImportResult(data.data);
        await fetchData();
      } else {
        alert(data.error?.message || 'Bulk import failed');
      }
    } catch (err) {
      console.error('Bulk import error:', err);
      alert('Failed to execute bulk import');
    } finally {
      setIsBulkImporting(false);
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
          student_name: newInquiryForm.student_name,
          phone: newInquiryForm.phone,
          email: newInquiryForm.email || undefined,
          guardian_name: newInquiryForm.guardian_name || undefined,
          guardian_phone: newInquiryForm.guardian_phone || undefined,
          guardian_id_card: (newInquiryForm as any).guardian_id_card || undefined,
          program_id: newInquiryForm.program_id || undefined,
          source: newInquiryForm.source || 'Walk-in',
          stage: 'new',
          priority: newInquiryForm.priority || 'medium',
          next_follow_up_date: newInquiryForm.next_follow_up_date || undefined,
          notes: newInquiryForm.notes || undefined,
          custom_field_values: {
            ...(newInquiryForm.previous_school ? { previous_school: newInquiryForm.previous_school } : {}),
            ...(newInquiryForm.previous_marks ? { previous_marks: newInquiryForm.previous_marks } : {}),
          },
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
          guardian_id_card: '',
          program_id: '',
          source: 'Walk-in',
          priority: 'medium',
          next_follow_up_date: '',
          previous_school: '',
          previous_marks: '',
          notes: '',
        });
      }
    } catch (err) {
      console.error('Failed to create inquiry:', err);
    }
  };

  // Transfer Inquiry data directly into Admission Form
  const handleTransferInquiryToAdmission = (inq: StudentInquiry) => {
    setEnrollForm(prev => ({
      ...prev,
      full_name: inq.student_name,
      phone: inq.phone,
      email: inq.email || '',
      guardian_name: inq.guardian_name || '',
      guardian_phone: inq.guardian_phone || '',
      guardian_id_card: (inq as any).guardian_id_card || '',
      program_id: inq.program_id || '',
      batch_id: '',
      elective_group_id: '',
      custom_field_values: (inq as any).custom_field_values || {},
    }));
    setActiveTab('new_admission');
  };

  // Sync batch fee schedule dynamically when batch is selected (no hardcoded fee fallbacks)
  useEffect(() => {
    if (enrollForm.batch_id) {
      const b = batches.find(x => x.id === enrollForm.batch_id);
      const p = programs.find(x => x.id === enrollForm.program_id);
      const tuition = b?.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount 
        ?? p?.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount;
      const admission = b?.fee_schedule?.find(f => f.fee_type === 'admission')?.amount 
        ?? p?.fee_schedule?.find(f => f.fee_type === 'admission')?.amount;
      const exam = b?.fee_schedule?.find(f => f.fee_type === 'exam_lab')?.amount 
        ?? p?.fee_schedule?.find(f => f.fee_type === 'exam_lab')?.amount;
      
      if (tuition !== undefined) setAdmissionTuition(tuition);
      if (admission !== undefined) setAdmissionFeeCharge(admission);
      if (exam !== undefined) setAdmissionExamCharge(exam);
    }
  }, [enrollForm.batch_id, enrollForm.program_id, batches, programs]);

  const tuitionNum = typeof admissionTuition === 'number' ? admissionTuition : 0;
  const admissionFeeNum = typeof admissionFeeCharge === 'number' ? admissionFeeCharge : 0;
  const examFeeNum = typeof admissionExamCharge === 'number' ? admissionExamCharge : 0;
  const concessionValNum = typeof concessionVal === 'number' ? concessionVal : 0;

  const discountAmount = useMemo(() => {
    if (concessionType === 'none' || concessionValNum <= 0) return 0;
    if (concessionMode === 'percentage') {
      return Math.round((tuitionNum * Math.min(100, concessionValNum)) / 100);
    }
    return Math.min(tuitionNum, concessionValNum);
  }, [concessionType, concessionMode, concessionValNum, tuitionNum]);

  const netMonthlyTuition = Math.max(0, tuitionNum - discountAmount);

  // Active Fee Heads configured for Admission
  const admissionActiveHeads = useMemo(() => {
    return feeHeads.filter(h => h.show_at_admission !== false);
  }, [feeHeads]);

  const otherAdmissionHeads = useMemo(() => {
    return admissionActiveHeads.filter(h => h.code !== 'TUITION' && h.code !== 'ADMISSION' && h.code !== 'EXAM');
  }, [admissionActiveHeads]);

  const otherHeadsTotal = useMemo(() => {
    return otherAdmissionHeads.reduce((sum, h) => {
      const val = admissionHeadOverrides[h.id] !== undefined ? admissionHeadOverrides[h.id] : h.default_amount;
      return sum + (typeof val === 'number' ? val : 0);
    }, 0);
  }, [otherAdmissionHeads, admissionHeadOverrides]);

  const firstMonthTotal = netMonthlyTuition + admissionFeeNum + examFeeNum + otherHeadsTotal;

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
          photo_url: photoUrl || undefined,
          guardian_name: enrollForm.guardian_name,
          guardian_relation: guardianRelation,
          guardian_phone: enrollForm.guardian_phone,
          guardian_email: enrollForm.guardian_email || undefined,
          guardian_id_card: (enrollForm as any).guardian_id_card || undefined,
          guardian_whatsapp: (guardianWhatsapp || enrollForm.guardian_phone).trim(),
          program_id: enrollForm.program_id,
          batch_id: enrollForm.batch_id,
          elective_group_id: enrollForm.elective_group_id || undefined,
          blood_group: bloodGroup || undefined,
          fee_structure: {
            base_tuition: tuitionNum,
            admission_fee: admissionFeeNum,
            exam_fee: examFeeNum,
            concession_type: concessionMode,
            concession_val: discountAmount > 0 ? concessionValNum : 0,
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

        let recordedPayment: any = null;
        const payAmt = typeof initialPaymentAmount === 'number' && initialPaymentAmount > 0 ? initialPaymentAmount : firstMonthTotal;

        // Collect initial payment if requested and invoice exists
        if (collectInitialPayment && result.data.first_invoice_id) {
          try {
            const payRes = await fetch('/api/v1/finance/payments', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                invoice_id: result.data.first_invoice_id,
                amount_paid: payAmt,
                payment_method: initialPaymentMethod,
                reference_number: initialPaymentReference || undefined,
              }),
            });
            const payJson = await payRes.json();
            if (payJson.success) {
              recordedPayment = payJson.data?.payment;
            }
          } catch (payErr) {
            console.error('Failed to post admission payment:', payErr);
          }
        }

        // Prepare receipt items
        const receiptItems = [
          { name: 'Monthly Tuition (Net)', amount: netMonthlyTuition },
          ...(admissionFeeNum > 0 ? [{ name: 'Admission Fee', amount: admissionFeeNum }] : []),
          ...(examFeeNum > 0 ? [{ name: 'Exam & Lab Charges', amount: examFeeNum }] : []),
          ...otherAdmissionHeads.map(h => {
            const val = admissionHeadOverrides[h.id] !== undefined ? admissionHeadOverrides[h.id] : h.default_amount;
            return { name: h.name, amount: typeof val === 'number' ? val : 0 };
          }).filter(it => it.amount > 0)
        ];

        // Trigger Branded WhatsApp Receipt Modal
        setReceiptModalData({
          student: result.data,
          payment: recordedPayment,
          amountPaid: collectInitialPayment ? payAmt : 0,
          totalDue: firstMonthTotal,
          billingMonth: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          items: receiptItems,
        });
        setReceiptWhatsappNumber(guardianWhatsapp || enrollForm.guardian_phone);

        setEnrollForm({
          full_name: '',
          phone: '',
          email: '',
          guardian_name: '',
          guardian_phone: '',
          guardian_email: '',
          guardian_id_card: '',
          program_id: '',
          batch_id: '',
          elective_group_id: '',
          custom_field_values: {},
        });
        setPhotoUrl('');
        setGuardianRelation('Father');
        setGuardianWhatsapp('');
        setWhatsappSameAsCalling(true);
        setBloodGroup('');
        setAdmissionTuition('');
        setAdmissionFeeCharge('');
        setAdmissionExamCharge('');
        setAdmissionHeadOverrides({});
        setConcessionType('none');
        setConcessionVal('');
        setConcessionReason('');
        setCollectInitialPayment(false);
        setInitialPaymentAmount('');
        setInitialPaymentReference('');
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
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header & Navigation */}
      <PageHeading 
        title="Students" 
        description="Student directory records, inquiry pipeline, and admissions." 
        icon={<Users className="w-4 h-4 text-slate-700" />}
      />

      {/* Tab Switcher - Native Segmented Control */}
      <div className="flex items-center overflow-x-auto no-scrollbar max-w-full whitespace-nowrap bg-slate-100/90 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex-1 min-w-[90px] py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all touch-press ${
            activeTab === 'directory' 
              ? 'bg-white text-slate-900 shadow-xs font-bold' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span>Directory ({students.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('inquiries')}
          className={`flex-1 min-w-[90px] py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all touch-press ${
            activeTab === 'inquiries' 
              ? 'bg-white text-slate-900 shadow-xs font-bold' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
          <span>Inquiries ({inquiries.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('new_admission')}
          className={`flex-1 min-w-[110px] py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all touch-press ${
            activeTab === 'new_admission' 
              ? 'bg-white text-slate-900 shadow-xs font-bold' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5 text-slate-500" />
          <span>Admission Form</span>
        </button>
        <button
          onClick={() => setActiveTab('id_cards')}
          className={`flex-1 min-w-[80px] py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all touch-press ${
            activeTab === 'id_cards' 
              ? 'bg-white text-slate-900 shadow-xs font-bold' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-slate-500" />
          <span>ID Cards</span>
        </button>
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
      {/* TAB 1: STUDENT DIRECTORY & STUDENT PROFILE                                 */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <>
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Controls Toolbar */}
          <div className="p-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors font-sans text-slate-900"
              />
            </div>

            {/* Mobile Filter Chips Row */}
            <div className="flex sm:hidden items-center gap-2 w-full overflow-x-auto no-scrollbar py-0.5">
              <select
                value={selectedBatchFilter}
                onChange={e => setSelectedBatchFilter(e.target.value)}
                className="flex-1 min-w-[130px] px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Batches ({batches.length})</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="flex-1 min-w-[110px] px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="suspended">Suspended</option>
                <option value="on_leave">On Leave</option>
                <option value="alumni">Alumni</option>
              </select>
            </div>

            {/* Desktop Filters & Actions */}
            <div className="hidden sm:flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-medium text-slate-500">Batch:</span>
                <select
                  value={selectedBatchFilter}
                  onChange={e => setSelectedBatchFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                >
                  <option value="all">All Batches ({batches.length})</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.shift.toUpperCase()} • {b.current_enrollment}/{b.max_capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="text-[11px] font-medium text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                >
                  <option value="all">All Statuses ({students.length})</option>
                  <option value="active">Active ({students.filter(s => s.status === 'active').length})</option>
                  <option value="withdrawn">Withdrawn ({students.filter(s => s.status === 'withdrawn').length})</option>
                  <option value="suspended">Suspended ({students.filter(s => s.status === 'suspended').length})</option>
                  <option value="on_leave">On Leave ({students.filter(s => s.status === 'on_leave').length})</option>
                  <option value="alumni">Alumni ({students.filter(s => s.status === 'alumni').length})</option>
                  <option value="waitlisted">Waitlisted ({students.filter(s => s.status === 'waitlisted').length})</option>
                </select>
              </div>

              <button 
                type="button"
                onClick={() => {
                  setShowBulkImportModal(true);
                  setBulkImportResult(null);
                  setBulkImportCsvText('');
                  if (batches.length > 0 && !bulkImportBatchId) setBulkImportBatchId(batches[0].id);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                title="Bulk Import Students via CSV"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>Bulk CSV Import</span>
              </button>

              <button 
                onClick={() => setActiveTab('new_admission')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors ml-auto sm:ml-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Admission</span>
              </button>
            </div>
          </div>

          {/* Selected Action Bar */}
          {selectedDirectoryStudentIds.size > 0 && (
            <div className="bg-slate-900 text-white p-2.5 px-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <span>{selectedDirectoryStudentIds.size} student{selectedDirectoryStudentIds.size > 1 ? 's' : ''} selected</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkIdCardsModal(true)}
                  className="px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Print ID Cards ({selectedDirectoryStudentIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDirectoryStudentIds(new Set())}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-semibold transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          {/* Desktop Directory Table (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
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
                          <div className="text-slate-800 font-medium flex items-center gap-1">
                            <span>{student.guardian_name}</span>
                            {student.guardian_relation && (
                              <span className="text-[10.5px] text-slate-500 font-normal">({student.guardian_relation})</span>
                            )}
                          </div>
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
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                            student.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : student.status === 'withdrawn'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : student.status === 'suspended'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : student.status === 'on_leave'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              student.status === 'active'
                                ? 'bg-emerald-500'
                                : student.status === 'withdrawn'
                                ? 'bg-rose-500'
                                : student.status === 'suspended'
                                ? 'bg-amber-500'
                                : student.status === 'on_leave'
                                ? 'bg-blue-500'
                                : 'bg-slate-400'
                            }`}></span>
                            {student.status ? student.status.replace('_', ' ') : 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setContactStudentModal(student)}
                              className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-lg transition-colors border border-slate-200 hover:border-emerald-200"
                              title="Call or WhatsApp contact options"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => onNavigate(`student_portal?student_id=${encodeURIComponent(student.id)}`)}
                                className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-lg transition-colors border border-slate-200 hover:border-indigo-200"
                                title="Preview Student Portal"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedStudent(student)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg text-xs font-bold transition-all border border-slate-200 hover:border-indigo-200 inline-flex items-center gap-1"
                            >
                              <span>Profile</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          {/* Mobile Native Cards List (< 768px) */}
          <div className="md:hidden divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <div className="py-12 text-center text-slate-400">
                <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <span className="text-xs font-mono">Loading student records...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No students found matching current filters.</p>
              </div>
            ) : (
              filteredStudents.map(student => (
                <div
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className="p-3.5 active:bg-slate-50 transition-colors flex flex-col gap-2.5 cursor-pointer touch-press"
                >
                  {/* Top Row: Selection + Avatar + Name + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          toggleDirectoryStudent(student.id);
                        }}
                        className="p-1 text-slate-400 active:text-slate-900 shrink-0"
                      >
                        {selectedDirectoryStudentIds.has(student.id) ? (
                          <CheckSquare className="w-4 h-4 text-slate-900" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 overflow-hidden">
                        {student.photo_url ? (
                          <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          student.full_name.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">
                          {student.full_name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-700">Roll {student.roll_number}</span>
                          <span>•</span>
                          <span className="text-slate-400">{student.admission_number}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize shrink-0 ${
                      student.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : student.status === 'withdrawn'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : student.status === 'suspended'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : student.status === 'on_leave'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        student.status === 'active' ? 'bg-emerald-500' :
                        student.status === 'withdrawn' ? 'bg-rose-500' :
                        student.status === 'suspended' ? 'bg-amber-500' :
                        student.status === 'on_leave' ? 'bg-blue-500' : 'bg-slate-400'
                      }`}></span>
                      {student.status ? student.status.replace('_', ' ') : 'Active'}
                    </span>
                  </div>

                  {/* Middle Row: Batch & Guardian Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Class & Batch</span>
                      <span className="font-medium text-slate-800 truncate block text-[11px]">
                        {getProgramName(student.program_id)} • {getBatchName(student.batch_id)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Guardian</span>
                      <span className="font-medium text-slate-800 truncate block text-[11px]">
                        {student.guardian_name || '—'} {student.guardian_relation ? `(${student.guardian_relation})` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Actions Bar */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100/70 text-xs">
                    <div className="flex items-center gap-1">
                      {student.guardian_phone && (
                        <a
                          href={`tel:${student.guardian_phone}`}
                          onClick={e => e.stopPropagation()}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>Call</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setContactStudentModal(student);
                        }}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-[11px] font-semibold flex items-center gap-1 border border-emerald-200/50"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className="px-2.5 py-1 bg-slate-900 text-white hover:bg-slate-800 rounded-md text-[11px] font-bold flex items-center gap-1"
                      >
                        <span>Profile 360</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mobile Floating Action Button (FAB) for New Admission */}
        <button
          type="button"
          onClick={() => setActiveTab('new_admission')}
          className="sm:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-800 active:scale-95 transition-transform"
          title="New Student Admission"
        >
          <Plus className="w-6 h-6" />
        </button>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB: STUDENT ID CARDS GENERATOR & PRINTING STUDIO                         */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* TAB 2: INQUIRIES DESK & 1-CLICK ADMIT                                     */}
      {/* ========================================================================= */}
      {activeTab === 'inquiries' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Inquiries Header Toolbar */}
          <div className="p-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Inquiries' },
                { id: 'new', label: 'New' },
                { id: 'follow_up', label: 'Follow Up' },
                { id: 'fee_discussion', label: 'Fee Discussion' },
                { id: 'admitted', label: 'Admitted' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setInquiryStageFilter(st.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
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
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap ml-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Inquiry</span>
            </button>
          </div>

          {/* Inquiries Table */}
          <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Inquiry #</th>
                    <th className="py-3 px-4">Candidate Particulars</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Target Program</th>
                    <th className="py-3 px-4">Source & Priority</th>
                    <th className="py-3 px-4">Follow-Up</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {filteredInquiries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No inquiries found.
                      </td>
                    </tr>
                  ) : (
                    filteredInquiries.map(inq => {
                      const prevSchool = inq.custom_field_values?.previous_school;
                      const prevMarks = inq.custom_field_values?.previous_marks;

                      return (
                        <tr key={inq.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            {inq.inquiry_number}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{inq.student_name}</div>
                            {(prevSchool || prevMarks) && (
                              <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                                {prevSchool ? `Prev: ${prevSchool}` : ''} {prevMarks ? `(${prevMarks})` : ''}
                              </div>
                            )}
                            {inq.notes && (
                              <p className="text-[10px] text-slate-500 font-normal mt-0.5 line-clamp-1 italic">
                                "{inq.notes}"
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-slate-700 font-semibold">{inq.phone}</div>
                            {inq.guardian_name && (
                              <div className="text-[10.5px] text-slate-500">{inq.guardian_name} {inq.guardian_phone ? `(${inq.guardian_phone})` : ''}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {inq.program_id ? getProgramName(inq.program_id) : 'General'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {inq.source || 'Walk-in'}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                                inq.priority === 'high' 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                  : inq.priority === 'medium'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {inq.priority || 'medium'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {inq.next_follow_up_date || '—'}
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
                                <option value="new">New</option>
                                <option value="follow_up">Follow Up</option>
                                <option value="trial_scheduled">Trial Scheduled</option>
                                <option value="fee_discussion">Fee Discussion</option>
                                <option value="closed">Closed</option>
                              </select>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {inq.stage !== 'admitted' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleTransferInquiryToAdmission(inq)}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1"
                                  title="Open candidate in Admission Form"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>Admit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdmitInquiryModal(inq);
                                    if (batches.length > 0) setAdmitBatchId(batches[0].id);
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all border border-slate-200 inline-flex items-center"
                                  title="Quick direct batch assignment"
                                >
                                  <span>Batch</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-semibold italic">
                                Enrolled
                              </span>
                            )}
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

      {/* ========================================================================= */}
      {/* TAB 3: DYNAMIC ADMISSION FORM                                            */}
      {/* ========================================================================= */}
      {activeTab === 'new_admission' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs max-w-4xl mx-auto space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <SectionInfo 
              title="New Student Registration" 
              description="Student registration with dynamic academic programs, batch capacity limits, and custom institutional fields."
              titleClassName="text-base font-bold text-slate-900"
            />
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
                          setShowBulkIdCardsModal(true);
                        }
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Academic Placement</h3>
                <SectionInfo description="Select the academic program, allocated shift, and batch." />
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
                    <option value="">Select Academic Program</option>
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
                    <option value="">Select Shift & Batch</option>
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
                      <option value="">Select Elective Track (Optional)</option>
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Student Particulars</h3>
                <SectionInfo description="Legal name, mobile number, optional email, blood group, and guardian contact." />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Photo Upload Box */}
                <div className="sm:col-span-2 flex items-center gap-4 p-3 bg-white rounded-lg border border-slate-200">
                  <div className="w-14 h-18 rounded border border-slate-300 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <Camera className="w-5 h-5 mb-0.5" />
                        <span className="text-[8px] uppercase font-sans">Photo</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold border border-slate-300 transition-colors">
                      <Camera className="w-3.5 h-3.5 text-slate-600" />
                      <span>{photoUrl ? 'Change Photo' : 'Upload Student Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAdmissionPhotoUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-500">Official passport portrait for student ID card & profile registry (Max 3MB).</p>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        className="text-[10px] text-rose-600 hover:underline block"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Student Full Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={enrollForm.full_name}
                    onChange={e => setEnrollForm(prev => ({ ...prev, full_name: e.target.value }))}
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
                    placeholder="0300 1234567"
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
                    Blood Group
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={e => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  >
                    <option value="">Select Blood Group</option>
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
                    Guardian Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={enrollForm.guardian_name}
                    onChange={e => setEnrollForm(prev => ({ ...prev, guardian_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guardian Relationship <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={guardianRelation}
                    onChange={e => setGuardianRelation(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Brother">Brother</option>
                    <option value="Uncle">Uncle</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guardian Calling Mobile <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={enrollForm.guardian_phone}
                    onChange={e => {
                      const val = e.target.value;
                      setEnrollForm(prev => ({ ...prev, guardian_phone: val }));
                      if (whatsappSameAsCalling) {
                        setGuardianWhatsapp(val);
                      }
                    }}
                    placeholder="0300 1234567"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Guardian WhatsApp Number
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={whatsappSameAsCalling}
                        onChange={e => {
                          const checked = e.target.checked;
                          setWhatsappSameAsCalling(checked);
                          if (checked) {
                            setGuardianWhatsapp(enrollForm.guardian_phone);
                          }
                        }}
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Same as Calling</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={guardianWhatsapp}
                    onChange={e => {
                      setGuardianWhatsapp(e.target.value);
                      setWhatsappSameAsCalling(false);
                    }}
                    placeholder="0300 1234567"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guardian Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={enrollForm.guardian_email}
                    onChange={e => setEnrollForm(prev => ({ ...prev, guardian_email: e.target.value }))}
                    placeholder="guardian@example.com"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    For fee receipts & email notifications.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Guardian CNIC / National ID Card
                  </label>
                  <input
                    type="text"
                    value={enrollForm.guardian_id_card || ''}
                    onChange={e => setEnrollForm(prev => ({ ...prev, guardian_id_card: e.target.value }))}
                    placeholder="35201-1234567-1"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Primary login identifier for Parent Portal. Auto-provisions parent account.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Financial Schedule & Concession Plan */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Fee Schedule & Concessions</h3>
                <SectionInfo description="Monthly tuition, admission fee, exam fee, and approved scholarship/concession rate." />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                {/* Dynamic Fee Heads Registered for Admission */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-[11px]">Monthly Tuition (PKR)</label>
                    <input
                      type="number"
                      min={0}
                      value={admissionTuition === '' ? '' : admissionTuition}
                      onChange={e => setAdmissionTuition(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-[11px]">Admission Fee (One-Time)</label>
                    <input
                      type="number"
                      min={0}
                      value={admissionFeeCharge === '' ? '' : admissionFeeCharge}
                      onChange={e => setAdmissionFeeCharge(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-[11px]">Exam / Lab Charges</label>
                    <input
                      type="number"
                      min={0}
                      value={admissionExamCharge === '' ? '' : admissionExamCharge}
                      onChange={e => setAdmissionExamCharge(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>

                  {/* Additional Dynamic Fee Heads */}
                  {otherAdmissionHeads.map(head => (
                    <div key={head.id}>
                      <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                        {head.name} ({head.code})
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={admissionHeadOverrides[head.id] !== undefined ? admissionHeadOverrides[head.id] : head.default_amount}
                        onChange={e => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          setAdmissionHeadOverrides(prev => ({ ...prev, [head.id]: val }));
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                  ))}
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
                            setConcessionVal('');
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
                              value={concessionVal === '' ? '' : concessionVal}
                              onChange={e => setConcessionVal(e.target.value === '' ? '' : Number(e.target.value))}
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
                        Net Tuition: PKR {netMonthlyTuition.toLocaleString()} + Adm: PKR {admissionFeeNum.toLocaleString()} + Exam: PKR {examFeeNum.toLocaleString()}
                        {otherHeadsTotal > 0 && ` + Other Heads: PKR ${otherHeadsTotal.toLocaleString()}`}
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
                      Generate first month admission invoice and fee challan immediately
                    </span>
                  </label>

                  {/* Direct Payment Collection Option */}
                  <div className="pt-3 border-t border-slate-200/80 space-y-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={collectInitialPayment}
                        onChange={e => {
                          const checked = e.target.checked;
                          setCollectInitialPayment(checked);
                          if (checked && (initialPaymentAmount === '' || initialPaymentAmount === 0)) {
                            setInitialPaymentAmount(firstMonthTotal);
                          }
                        }}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <span className="text-slate-800 text-xs font-bold flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                        Collect Initial Payment at Admission Desk
                      </span>
                    </label>

                    {collectInitialPayment && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Amount Collected (PKR) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={firstMonthTotal || undefined}
                            required={collectInitialPayment}
                            value={initialPaymentAmount === '' ? '' : initialPaymentAmount}
                            onChange={e => setInitialPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Payment Method <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={initialPaymentMethod}
                            onChange={e => setInitialPaymentMethod(e.target.value as any)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                          >
                            <option value="cash">Cash Counter</option>
                            <option value="meezan_bank">Bank Transfer / Meezan IBFT</option>
                            <option value="easypaisa">EasyPaisa</option>
                            <option value="jazzcash">JazzCash</option>
                            <option value="cheque">Bank Cheque</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Receipt / Reference Note
                          </label>
                          <input
                            type="text"
                            value={initialPaymentReference}
                            onChange={e => setInitialPaymentReference(e.target.value)}
                            placeholder="e.g. Trx # / Cheque #"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Dynamic Form Builder Custom Fields */}
            {customFields.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Additional Fields
                  </h3>
                  <SectionInfo description="Institution-specific custom registration fields." />
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
      {/* TAB 4: STUDENT ID CARDS & PRINT REGISTER                                   */}
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
      {/* STUDENT PROFILE & ID CARD MODAL                                           */}
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
          onPreviewPortal={onNavigate ? (studentId) => onNavigate(`student_portal?student_id=${encodeURIComponent(studentId)}`) : undefined}
        />
      )}

      {/* ========================================================================= */}
      {/* 1-CLICK ADMISSION MODAL                                                  */}
      {/* ========================================================================= */}
      {admitInquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
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

              {/* Guardian CNIC / ID Card */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Guardian CNIC / ID Card (Parent Portal Login)
                </label>
                <input
                  type="text"
                  value={admitGuardianCnic}
                  onChange={e => setAdmitGuardianCnic(e.target.value)}
                  placeholder="35201-1234567-1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Used as the login username for the Guardian Portal.
                </p>
              </div>

              {/* Fee Breakdown Schedule */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Fee Schedule & First Challan</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold font-mono">
                    Auto-Issues 3-Part Challan
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Monthly Tuition (PKR)</label>
                    <input
                      type="number"
                      min="0"
                      value={admitTuitionFee}
                      onChange={e => setAdmitTuitionFee(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Admission Fee (PKR)</label>
                    <input
                      type="number"
                      min="0"
                      value={admitAdmissionFee}
                      onChange={e => setAdmitAdmissionFee(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Concession / Discount (PKR)</label>
                    <input
                      type="number"
                      min="0"
                      value={admitConcessionAmount}
                      onChange={e => setAdmitConcessionAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Concession Category</label>
                    <input
                      type="text"
                      value={admitConcessionReason}
                      onChange={e => setAdmitConcessionReason(e.target.value)}
                      placeholder="e.g. Merit / Kinship"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
                    />
                  </div>
                </div>
                <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">First Month Payable:</span>
                  <span className="font-mono font-bold text-slate-900">
                    PKR {(Math.max(0, (Number(admitTuitionFee) || 0) - (Number(admitConcessionAmount) || 0)) + (Number(admitAdmissionFee) || 0)).toLocaleString()}
                  </span>
                </div>
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
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
                  Candidate Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newInquiryForm.student_name}
                  onChange={e => setNewInquiryForm(prev => ({ ...prev, student_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newInquiryForm.phone}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newInquiryForm.email}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Guardian Name</label>
                  <input
                    type="text"
                    value={newInquiryForm.guardian_name}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, guardian_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Guardian Phone</label>
                  <input
                    type="text"
                    value={newInquiryForm.guardian_phone}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, guardian_phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Guardian CNIC / ID Card</label>
                <input
                  type="text"
                  value={newInquiryForm.guardian_id_card}
                  onChange={e => setNewInquiryForm(prev => ({ ...prev, guardian_id_card: e.target.value }))}
                  placeholder="35201-1234567-1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lead Source</label>
                  <select
                    value={newInquiryForm.source}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, source: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Walk-in">Walk-in Desk</option>
                    <option value="Phone Call">Phone Call</option>
                    <option value="Referral">Student Referral</option>
                    <option value="Social Media">Social Media / Website</option>
                    <option value="Banner">Banner / Pamphlet</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newInquiryForm.priority}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Next Follow-Up Date</label>
                  <input
                    type="date"
                    value={newInquiryForm.next_follow_up_date}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, next_follow_up_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Previous Institution</label>
                  <input
                    type="text"
                    value={newInquiryForm.previous_school}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, previous_school: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Previous Marks / %</label>
                  <input
                    type="text"
                    value={newInquiryForm.previous_marks}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, previous_marks: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Discussion Notes</label>
                <textarea
                  value={newInquiryForm.notes}
                  onChange={e => setNewInquiryForm(prev => ({ ...prev, notes: e.target.value }))}
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

      {/* Bulk ID Card Printing Modal */}
      {showBulkIdCardsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-5xl p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <CreditCard className="w-4 h-4 text-slate-700" />
                <span>Student ID Cards</span>
              </div>
              <button
                onClick={() => setShowBulkIdCardsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <StudentIDCardDesk
              students={students}
              batches={batches}
              programs={programs}
              initialSelectedIds={Array.from(selectedDirectoryStudentIds)}
              onBackToDirectory={() => setShowBulkIdCardsModal(false)}
            />
          </div>
        </div>
      )}
      {/* Contact Options Modal for Student & Guardian */}
      {contactStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Contact Options</h3>
                <p className="text-[11px] text-slate-500 font-medium">{contactStudentModal.full_name} • Roll: {contactStudentModal.roll_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setContactStudentModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Guardian Contact */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    {contactStudentModal.guardian_name}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {contactStudentModal.guardian_relation || 'Guardian'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-mono">
                  {contactStudentModal.guardian_phone}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={`tel:${contactStudentModal.guardian_phone.replace(/\s+/g, '')}`}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-600" />
                    <span>Call</span>
                  </a>
                  <a
                    href={`https://wa.me/${cleanPhoneForWhatsApp(contactStudentModal.guardian_whatsapp || contactStudentModal.guardian_phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Student Direct Contact */}
              {contactStudentModal.phone && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      {contactStudentModal.full_name}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      Student
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 font-mono">
                    {contactStudentModal.phone}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href={`tel:${contactStudentModal.phone.replace(/\s+/g, '')}`}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-600" />
                      <span>Call</span>
                    </a>
                    <a
                      href={`https://wa.me/${cleanPhoneForWhatsApp(contactStudentModal.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setContactStudentModal(null)}
              className="w-full py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Branded WhatsApp Fee Receipt & Admission Slip Modal */}
      {receiptModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Admission Confirmed & Fee Receipt</span>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalData(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Official Institutional Receipt Card */}
            <div id="admission-receipt-slip" className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 font-sans text-xs">
              <div className="text-center pb-3 border-b border-slate-200">
                <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wide">
                  {tenant?.name || 'Apex Academy'}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">OFFICIAL ADMISSION & FEE RECEIPT</p>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                  {receiptModalData.payment ? `Receipt #: ${receiptModalData.payment.receipt_number}` : `Invoice Month: ${receiptModalData.billingMonth}`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Student Name:</span>
                  <span className="font-bold text-slate-900">{receiptModalData.student.full_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Roll / Admission #:</span>
                  <span className="font-mono font-bold text-slate-900">{receiptModalData.student.roll_number} ({receiptModalData.student.admission_number})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Guardian:</span>
                  <span className="text-slate-800 font-medium">
                    {receiptModalData.student.guardian_name} {receiptModalData.student.guardian_relation ? `(${receiptModalData.student.guardian_relation})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Date & Session:</span>
                  <span className="font-mono text-slate-800">{receiptModalData.student.admission_date}</span>
                </div>
              </div>

              {/* Itemized Particulars */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-3">Fee Particular</th>
                      <th className="py-1.5 px-3 text-right">Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {receiptModalData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-3 text-slate-700 font-sans">{item.name}</td>
                        <td className="py-1.5 px-3 text-right text-slate-900 font-semibold">{item.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <td className="py-2 px-3 text-slate-900 font-sans">Total Due</td>
                      <td className="py-2 px-3 text-right text-slate-900">PKR {receiptModalData.totalDue.toLocaleString()}</td>
                    </tr>
                    {receiptModalData.amountPaid > 0 && (
                      <>
                        <tr className="bg-emerald-50 text-emerald-800 font-bold">
                          <td className="py-1.5 px-3 font-sans">Amount Paid ({receiptModalData.payment?.payment_method?.toUpperCase() || 'PAID'})</td>
                          <td className="py-1.5 px-3 text-right">PKR {receiptModalData.amountPaid.toLocaleString()}</td>
                        </tr>
                        <tr className="font-bold">
                          <td className="py-1.5 px-3 text-slate-600 font-sans">Balance Remaining</td>
                          <td className="py-1.5 px-3 text-right text-amber-700">
                            PKR {Math.max(0, receiptModalData.totalDue - receiptModalData.amountPaid).toLocaleString()}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* WhatsApp Messaging Control */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
              <label className="block text-[11px] font-bold text-emerald-900">
                Send Fee Slip via WhatsApp:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={receiptWhatsappNumber}
                  onChange={e => setReceiptWhatsappNumber(e.target.value)}
                  placeholder="Guardian WhatsApp (e.g. 0300 1234567)"
                  className="flex-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-semibold"
                />
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = cleanPhoneForWhatsApp(receiptWhatsappNumber);
                    const academyTitle = tenant?.name || 'Apex Academy';
                    const lines = [
                      `*${academyTitle.toUpperCase()}*`,
                      `*OFFICIAL ADMISSION & FEE RECEIPT*`,
                      ``,
                      `Student: *${receiptModalData.student.full_name}*`,
                      `Roll No: *${receiptModalData.student.roll_number}* | Admission No: *${receiptModalData.student.admission_number}*`,
                      `Guardian: ${receiptModalData.student.guardian_name}`,
                      `Date: ${receiptModalData.student.admission_date}`,
                      ``,
                      `*Fee Breakdown:*`,
                      ...receiptModalData.items.map(i => `• ${i.name}: PKR ${i.amount.toLocaleString()}`),
                      `---------------------------`,
                      `Total Billed: PKR ${receiptModalData.totalDue.toLocaleString()}`,
                      receiptModalData.amountPaid > 0 ? `Amount Received: PKR ${receiptModalData.amountPaid.toLocaleString()}` : `Payment Status: Due`,
                      receiptModalData.amountPaid > 0 ? `Balance Due: PKR ${Math.max(0, receiptModalData.totalDue - receiptModalData.amountPaid).toLocaleString()}` : ``,
                      receiptModalData.payment?.receipt_number ? `Receipt No: ${receiptModalData.payment.receipt_number}` : ``,
                      ``,
                      `Thank you. For any inquiries, please contact the academy administration.`
                    ].filter(Boolean).join('\n');

                    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`;
                    window.open(url, '_blank');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const academyTitle = tenant?.name || 'Apex Academy';
                    const lines = [
                      `*${academyTitle.toUpperCase()}*`,
                      `*OFFICIAL ADMISSION & FEE RECEIPT*`,
                      ``,
                      `Student: *${receiptModalData.student.full_name}*`,
                      `Roll No: *${receiptModalData.student.roll_number}* | Admission No: *${receiptModalData.student.admission_number}*`,
                      `Guardian: ${receiptModalData.student.guardian_name}`,
                      `Date: ${receiptModalData.student.admission_date}`,
                      ``,
                      `*Fee Breakdown:*`,
                      ...receiptModalData.items.map(i => `• ${i.name}: PKR ${i.amount.toLocaleString()}`),
                      `---------------------------`,
                      `Total Billed: PKR ${receiptModalData.totalDue.toLocaleString()}`,
                      receiptModalData.amountPaid > 0 ? `Amount Received: PKR ${receiptModalData.amountPaid.toLocaleString()}` : `Payment Status: Due`,
                      receiptModalData.amountPaid > 0 ? `Balance Due: PKR ${Math.max(0, receiptModalData.totalDue - receiptModalData.amountPaid).toLocaleString()}` : ``,
                      receiptModalData.payment?.receipt_number ? `Receipt No: ${receiptModalData.payment.receipt_number}` : ``,
                      ``,
                      `Thank you. For any inquiries, please contact the academy administration.`
                    ].filter(Boolean).join('\n');
                    navigator.clipboard.writeText(lines);
                    setCopiedReceipt(true);
                    setTimeout(() => setCopiedReceipt(false), 2000);
                  }}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReceipt ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptModalData(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* BULK CSV IMPORT MODAL                                                     */}
      {/* ========================================================================= */}
      {showBulkImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span>Bulk Student CSV Import</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Import multiple student records in bulk. Guardians will be automatically provisioned with accounts using their CNIC numbers (default password: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">Parent@123</code>).
            </p>

            {/* Target Batch Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Default Target Batch (for records without specific batch)
              </label>
              <select
                value={bulkImportBatchId}
                onChange={e => setBulkImportBatchId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.shift.toUpperCase()} • {b.current_enrollment}/{b.max_capacity})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Actions / Template */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-600">CSV Data Format</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sample = [
                      'full_name,phone,guardian_name,guardian_phone,guardian_id_card,roll_number',
                      'Muhammad Ali,0300-1112223,Tariq Mahmood,0300-4445556,35201-1234567-1,101',
                      'Fatima Zahra,0321-7778889,Zahra Ahmed,0321-9990001,35202-7654321-2,102'
                    ].join('\n');
                    setBulkImportCsvText(sample);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition-colors"
                >
                  Load Sample Template
                </button>
                <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors">
                  <span>Upload .CSV File</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = evt => {
                        const content = evt.target?.result as string;
                        if (content) setBulkImportCsvText(content);
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>
            </div>

            {/* CSV Text Input Area */}
            <div>
              <textarea
                rows={7}
                value={bulkImportCsvText}
                onChange={e => setBulkImportCsvText(e.target.value)}
                placeholder="Paste CSV rows here with headers (e.g. full_name, phone, guardian_name, guardian_phone, guardian_id_card, roll_number)..."
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Required: full_name, guardian_name, guardian_phone, guardian_id_card</span>
                <span>{bulkImportCsvText.trim() ? `${bulkImportCsvText.trim().split(/\r?\n/).length - 1} rows detected` : '0 rows'}</span>
              </div>
            </div>

            {/* Import Results Banner */}
            {bulkImportResult && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold">
                  {bulkImportResult.imported_count > 0 ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Successfully imported {bulkImportResult.imported_count} student(s).
                    </span>
                  ) : null}
                  {bulkImportResult.failed_count > 0 ? (
                    <span className="text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {bulkImportResult.failed_count} row(s) failed validation.
                    </span>
                  ) : null}
                </div>
                {bulkImportResult.errors && bulkImportResult.errors.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] text-rose-700 font-mono bg-rose-50 p-2 rounded border border-rose-200">
                    {bulkImportResult.errors.map((err, idx) => (
                      <div key={idx}>Row {err.row}: {err.error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkImport}
                disabled={isBulkImporting || !bulkImportCsvText.trim()}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isBulkImporting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Execute Import</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
