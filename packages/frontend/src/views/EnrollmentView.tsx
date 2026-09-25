import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  UserPlus, 
  Search, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  X, 
  Phone, 
  UserCheck,
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
  Archive,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  User,
  GraduationCap,
  MoreVertical,
  SlidersHorizontal,
  ArrowLeft
} from 'lucide-react';
import { useMobileOverlay } from '../lib/mobileOverlay';
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
  PaymentMethod,
  BatchBillingMode,
  DocumentChecklistHead
} from '@apex/shared-types';
import { StudentProfileModal } from '../components/StudentProfileModal';
import { InstitutionalLoader } from '../components/InstitutionalLoader';
import { StudentIDCardDesk } from './StudentIDCardDesk';
import { ModernSelect } from '../components/ModernSelect';
import { localISODate } from '../lib/localDate';
import { compressImageFile } from '../components/LoginModal';
import { InPortalPdfViewerModal } from '../components/InPortalPdfViewerModal';
import { buildBatchChallansPdfBytes, StudentChallanData, ChallanItem } from '../lib/feeReportsPdf';
import { academyLetterheadFromAuth } from '../lib/officialDocumentPdf';
import { normalizeBillingMonth } from './FeeChallansView';

export interface EnrollmentViewProps {
  defaultTab?: 'directory' | 'inquiries' | 'new_admission' | 'id_cards';
  initialStudentId?: string | null;
  onNavigate?: (screen: string) => void;
}

export const EnrollmentView: React.FC<EnrollmentViewProps> = ({ defaultTab = 'directory', initialStudentId, onNavigate }) => {
  const { token, tenant, user, refreshSession } = useAuth();
  const canDeleteStudents = user?.role === 'tenant_admin' || user?.role === 'super_admin';
  const canArchiveStudents = canDeleteStudents || user?.role === 'academic_head';
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
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inquiryStageFilter, setInquiryStageFilter] = useState<string>('all');
  const [directoryPage, setDirectoryPage] = useState(1);
  const DIRECTORY_PAGE_SIZE = 30;

  // Native Mobile Drawer / Sheet States
  const [showDirectoryFilters, setShowDirectoryFilters] = useState(false);
  const [showOverviewCards, setShowOverviewCards] = useState(false);
  const [mobileActionStudent, setMobileActionStudent] = useState<Student | null>(null);
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

  const activeDirectoryFilterCount = useMemo(() => {
    let count = 0;
    if (selectedProgramFilter !== 'all') count++;
    if (selectedBatchFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    return count;
  }, [selectedProgramFilter, selectedBatchFilter, statusFilter]);

  const availableDirectoryBatches = useMemo(() => {
    if (selectedProgramFilter === 'all') return batches;
    return batches.filter(b => b.program_id === selectedProgramFilter);
  }, [batches, selectedProgramFilter]);

  const directoryCohortType = useMemo<'section' | 'batch' | 'mixed'>(() => {
    if (selectedProgramFilter === 'all') {
      const hasSec = batches.some(b => (b.cohort_type || (/section/i.test(b.name) ? 'section' : 'batch')) === 'section');
      const hasBat = batches.some(b => (b.cohort_type || (/section/i.test(b.name) ? 'section' : 'batch')) === 'batch');
      if (hasSec && hasBat) return 'mixed';
      return hasBat ? 'batch' : 'section';
    }
    const progBatches = batches.filter(b => b.program_id === selectedProgramFilter);
    const hasSec = progBatches.some(b => (b.cohort_type || (/section/i.test(b.name) ? 'section' : 'batch')) === 'section');
    const hasBat = progBatches.some(b => (b.cohort_type || (/section/i.test(b.name) ? 'section' : 'batch')) === 'batch');
    if (hasSec && hasBat) return 'mixed';
    return hasBat ? 'batch' : 'section';
  }, [batches, selectedProgramFilter]);

  // Drawer / Modals
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (initialStudentId && students.length > 0) {
      const found = students.find(s => s.id === initialStudentId);
      if (found) {
        setSelectedStudent(found);
      }
    }
  }, [initialStudentId, students]);
  const [contactStudentModal, setContactStudentModal] = useState<Student | null>(null);
  const [admitInquiryModal, setAdmitInquiryModal] = useState<StudentInquiry | null>(null);
  const [transferInquiryId, setTransferInquiryId] = useState<string | null>(null);
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

  // Single Student Archive & Delete States
  const [studentToArchive, setStudentToArchive] = useState<Student | null>(null);
  const [archiveReason, setArchiveReason] = useState<string>('Administrative student archival');
  const [cancelUnpaidOnArchive, setCancelUnpaidOnArchive] = useState<boolean>(false);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('Administrative student deletion');
  const [deleteForce, setDeleteForce] = useState<boolean>(false);
  const [deleteRequiresForce, setDeleteRequiresForce] = useState<boolean>(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteMenuStudentId, setDeleteMenuStudentId] = useState<string | null>(null);

  // Bulk Archive & Delete States
  const [showBulkArchiveModal, setShowBulkArchiveModal] = useState<boolean>(false);
  const [bulkArchiveReason, setBulkArchiveReason] = useState<string>('Bulk administrative archival');
  const [bulkArchiveCancelUnpaid, setBulkArchiveCancelUnpaid] = useState<boolean>(false);

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [bulkDeleteReason, setBulkDeleteReason] = useState<string>('Bulk administrative deletion');
  const [bulkDeleteForce, setBulkDeleteForce] = useState<boolean>(false);
  const [isBulkOperating, setIsBulkOperating] = useState<boolean>(false);
  const [actionFeedbackMessage, setActionFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Register mobile back-button stack handlers
  useMobileOverlay('sheet', Boolean(mobileActionStudent), () => setMobileActionStudent(null));
  useMobileOverlay('sheet', Boolean(contactStudentModal), () => setContactStudentModal(null));
  useMobileOverlay('sheet', Boolean(admitInquiryModal), () => setAdmitInquiryModal(null));
  useMobileOverlay('sheet', Boolean(studentToArchive), () => setStudentToArchive(null));
  useMobileOverlay('sheet', Boolean(studentToDelete), () => setStudentToDelete(null));

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
  const [studentWhatsapp, setStudentWhatsapp] = useState<string>('');
  const [studentWhatsappSameAsPhone, setStudentWhatsappSameAsPhone] = useState<boolean>(true);
  const [guardianRelation, setGuardianRelation] = useState<string>('');
  const [guardianWhatsapp, setGuardianWhatsapp] = useState<string>('');
  const [whatsappSameAsCalling, setWhatsappSameAsCalling] = useState<boolean>(true);
  const [emergencyContactName, setEmergencyContactName] = useState<string>('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState<string>('');

  // Student Demographics
  const [dob, setDob] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [studentBForm, setStudentBForm] = useState<string>('');
  const [previousSchool, setPreviousSchool] = useState<string>('');
  const [religion, setReligion] = useState<string>('');
  const [residentialAddress, setResidentialAddress] = useState<string>('');
  const [city, setCity] = useState<string>('');

  // Dual Parent Particulars
  const [fatherName, setFatherName] = useState<string>('');
  const [fatherCnic, setFatherCnic] = useState<string>('');
  const [fatherPhone, setFatherPhone] = useState<string>('');
  const [fatherOccupation, setFatherOccupation] = useState<string>('');

  const [motherName, setMotherName] = useState<string>('');
  const [motherCnic, setMotherCnic] = useState<string>('');
  const [motherPhone, setMotherPhone] = useState<string>('');
  const [motherOccupation, setMotherOccupation] = useState<string>('');

  const [primaryContact, setPrimaryContact] = useState<'father' | 'mother' | 'guardian'>('father');

  // Kinship / Sibling Linkage (Point 4.4)
  const [siblingStudentId, setSiblingStudentId] = useState<string>('');
  const [siblingSearchQuery, setSiblingSearchQuery] = useState<string>('');

  const suggestedSiblings = useMemo(() => {
    const fCnic = fatherCnic.trim();
    const fPhone = fatherPhone.trim();
    const mCnic = motherCnic.trim();
    if (!fCnic && !fPhone && !mCnic) return [];
    return students.filter(s => {
      if (s.status === 'archived') return false;
      if (fCnic && (s.father_cnic === fCnic || s.guardian_id_card === fCnic)) return true;
      if (fPhone && (s.father_phone === fPhone || s.guardian_phone === fPhone)) return true;
      if (mCnic && s.mother_cnic === mCnic) return true;
      return false;
    });
  }, [students, fatherCnic, fatherPhone, motherCnic]);

  const filteredSiblingOptions = useMemo(() => {
    if (!siblingSearchQuery.trim()) return [];
    const q = siblingSearchQuery.toLowerCase().trim();
    return students
      .filter(s => s.status !== 'archived')
      .filter(s => {
        const name = String(s.full_name || '').toLowerCase();
        const adm = String(s.admission_number || '').toLowerCase();
        const phone = String(s.guardian_phone || '');
        const cnic = String(s.father_cnic || '');
        return name.includes(q) || adm.includes(q) || phone.includes(q) || cnic.includes(q);
      })
      .slice(0, 8);
  }, [students, siblingSearchQuery]);

  const selectedSibling = useMemo(() => {
    if (!siblingStudentId) return null;
    return students.find(s => s.id === siblingStudentId) || null;
  }, [students, siblingStudentId]);

  const handleAdmissionPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be less than 5MB in size');
      return;
    }
    try {
      const compressed = await compressImageFile(file, 400, 500, 0.82);
      setPhotoUrl(compressed);
    } catch (err) {
      console.error('Failed to compress image:', err);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [enrollmentType, setEnrollmentType] = useState<'class' | 'batch'>('class');
  const [selectedEnrollSubjectIds, setSelectedEnrollSubjectIds] = useState<string[]>([]);
  const [admitCustomSubjectIds, setAdmitCustomSubjectIds] = useState<string[]>([]);
  const [bloodGroup, setBloodGroup] = useState('');
  const [admissionDate, setAdmissionDate] = useState<string>('');
  const [admissionTuition, setAdmissionTuition] = useState<number | ''>('');
  const [billingMode, setBillingMode] = useState<BatchBillingMode>('monthly');
  const [installmentCount, setInstallmentCount] = useState<number>(3);
  const [installments, setInstallments] = useState<Array<{
    installment_number: number;
    due_date: string;
    amount: number;
    status: 'pending' | 'billed' | 'paid';
  }>>([]);
  const [selectedAdmissionHeads, setSelectedAdmissionHeads] = useState<Array<{ fee_head_id: string; amount: number | '' }>>([]);
  const [headToAdd, setHeadToAdd] = useState<string>('');

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
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const [createdStudentResult, setCreatedStudentResult] = useState<Student | null>(null);
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);
  const [enrollSuccessMessage, setEnrollSuccessMessage] = useState<string | null>(null);

  // Document Submission Checklist
  const [docHeads, setDocHeads] = useState<DocumentChecklistHead[]>(() => {
    return Array.isArray(tenant?.settings?.document_checklist_heads)
      ? (tenant.settings.document_checklist_heads as DocumentChecklistHead[])
      : [];
  });

  useEffect(() => {
    if (Array.isArray(tenant?.settings?.document_checklist_heads)) {
      setDocHeads(tenant.settings.document_checklist_heads as DocumentChecklistHead[]);
    }
  }, [tenant?.settings?.document_checklist_heads]);

  const configuredDocHeads = docHeads;

  const defaultChecklistState = useMemo(() => {
    const initial: Record<string, 'submitted' | 'pending' | 'exempted'> = {};
    configuredDocHeads.forEach((h: DocumentChecklistHead) => {
      initial[h.code] = 'pending';
    });
    return initial;
  }, [configuredDocHeads]);

  const [submittedDocuments, setSubmittedDocuments] = useState<Record<string, 'submitted' | 'pending' | 'exempted'>>(defaultChecklistState);

  // Quick Add Document Head State directly from Enrollment Desk
  const [isAddingDocHead, setIsAddingDocHead] = useState<boolean>(false);
  const [newDocHeadTitle, setNewDocHeadTitle] = useState<string>('');
  const [newDocHeadMandatory, setNewDocHeadMandatory] = useState<boolean>(false);
  const [isSavingDocHead, setIsSavingDocHead] = useState<boolean>(false);

  useEffect(() => {
    setSubmittedDocuments(prev => {
      const next = { ...prev };
      configuredDocHeads.forEach(h => {
        if (!next[h.code]) next[h.code] = 'pending';
      });
      return next;
    });
  }, [configuredDocHeads]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deleteMenuStudentId && !(e.target as Element)?.closest?.('.student-action-menu-container')) {
        setDeleteMenuStudentId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [deleteMenuStudentId]);

  const handleAddDocHeadFromEnrollment = async () => {
    if (!newDocHeadTitle.trim() || !token) return;
    setIsSavingDocHead(true);
    try {
      const code = newDocHeadTitle.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 24) || `DOC_${Date.now()}`;
      const uniqueCode = `${code}_${Math.floor(Math.random() * 1000)}`;
      const newHead: DocumentChecklistHead = {
        id: `doc-${Date.now()}`,
        code: uniqueCode,
        title: newDocHeadTitle.trim(),
        is_required: newDocHeadMandatory,
      };
      const existing = (tenant?.settings?.document_checklist_heads || docHeads || []) as DocumentChecklistHead[];
      const updatedHeads = [...existing, newHead];

      const res = await fetch('/api/v1/academic/academy-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_checklist_heads: updatedHeads,
        }),
      });

      if (res.ok) {
        if (tenant?.settings) {
          tenant.settings.document_checklist_heads = updatedHeads;
        }
        setDocHeads(updatedHeads);
        setSubmittedDocuments(prev => ({ ...prev, [uniqueCode]: 'pending' }));
        setNewDocHeadTitle('');
        setNewDocHeadMandatory(false);
        if (refreshSession) refreshSession();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error?.message || 'Failed to save document head');
      }
    } catch (err) {
      console.error('Error adding document head:', err);
    } finally {
      setIsSavingDocHead(false);
    }
  };

  const handleDeleteDocHeadFromEnrollment = async (code: string) => {
    if (!token) return;
    if (!confirm('Remove this document requirement from the school checklist?')) return;
    try {
      const existing = (tenant?.settings?.document_checklist_heads || docHeads || []) as DocumentChecklistHead[];
      const updatedHeads = existing.filter(h => h.code !== code);
      const res = await fetch('/api/v1/academic/academy-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_checklist_heads: updatedHeads,
        }),
      });
      if (res.ok) {
        if (tenant?.settings) {
          tenant.settings.document_checklist_heads = updatedHeads;
        }
        setDocHeads(updatedHeads);
        setSubmittedDocuments(prev => {
          const next = { ...prev };
          delete next[code];
          return next;
        });
        if (refreshSession) refreshSession();
      }
    } catch (err) {
      console.error('Error removing document head:', err);
    }
  };

  const handleLoadStandardDocHeads = async () => {
    if (!token) return;
    setIsSavingDocHead(true);
    try {
      const standardHeads: DocumentChecklistHead[] = [
        { id: `doc-${Date.now()}-1`, code: 'B_FORM_CNIC', title: 'Student B-Form / CNIC Copy', is_required: true },
        { id: `doc-${Date.now()}-2`, code: 'FATHER_CNIC', title: 'Father / Guardian CNIC Copy', is_required: true },
        { id: `doc-${Date.now()}-3`, code: 'PHOTOS_PASSPORT', title: '4x Passport Size Photographs (Blue Background)', is_required: true },
        { id: `doc-${Date.now()}-4`, code: 'PREV_SCHOOL_SLC', title: 'Previous School Leaving Certificate (SLC) / Character Certificate', is_required: false },
      ];
      const existing = (tenant?.settings?.document_checklist_heads || docHeads || []) as DocumentChecklistHead[];
      const existingTitles = new Set(existing.map(h => (h.title || '').toLowerCase()));
      const toAdd = standardHeads.filter(h => !existingTitles.has((h.title || '').toLowerCase()));
      const updatedHeads = [...existing, ...toAdd];

      const res = await fetch('/api/v1/academic/academy-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_checklist_heads: updatedHeads,
        }),
      });

      if (res.ok) {
        if (tenant?.settings) {
          tenant.settings.document_checklist_heads = updatedHeads;
        }
        setDocHeads(updatedHeads);
        if (refreshSession) refreshSession();
      }
    } catch (err) {
      console.error('Error loading standard document heads:', err);
    } finally {
      setIsSavingDocHead(false);
    }
  };

  // Fee Challan Print State
  const [showFeeChallanModal, setShowFeeChallanModal] = useState<boolean>(false);
  const [feeChallanPdfBytes, setFeeChallanPdfBytes] = useState<Uint8Array | null>(null);
  const [feeChallanPdfFilename, setFeeChallanPdfFilename] = useState<string>('Fee_Challan.pdf');
  const [isGeneratingFeeChallanPdf, setIsGeneratingFeeChallanPdf] = useState<boolean>(false);

  // Subject selection stability refs
  const prevProgIdRef = useRef(enrollForm.program_id);
  const prevElectiveGroupIdRef = useRef(enrollForm.elective_group_id);

  const cleanPhoneForWhatsApp = (p?: string | number | null) => {
    if (!p) return '';
    const str = String(p);
    let cleaned = str.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('03')) {
      cleaned = '92' + cleaned.slice(1);
    }
    return cleaned;
  };

  // Load all initial academic and SIS data with robust timeout and fallback
  const fetchData = async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    const headers = { Authorization: `Bearer ${token}` };

    const safeFetchJson = async (url: string) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return null;
        return await res.json();
      } catch (e) {
        console.warn(`Fetch timed out or failed for ${url}:`, e);
        return null;
      }
    };

    try {
      const [progs, bts, subs, grps, fields, studs, inqs, headsData] = await Promise.all([
        safeFetchJson('/api/v1/academic/programs'),
        safeFetchJson('/api/v1/academic/batches'),
        safeFetchJson('/api/v1/academic/subjects'),
        safeFetchJson('/api/v1/academic/groups'),
        safeFetchJson('/api/v1/academic/custom-fields?entity_type=student'),
        safeFetchJson('/api/v1/sis/students'),
        safeFetchJson('/api/v1/sis/inquiries'),
        safeFetchJson('/api/v1/finance/heads'),
      ]);

      if (progs?.success && Array.isArray(progs.data)) setPrograms(progs.data);
      if (bts?.success && Array.isArray(bts.data)) setBatches(bts.data);
      if (subs?.success && Array.isArray(subs.data)) setSubjects(subs.data);
      if (grps?.success && Array.isArray(grps.data)) setSubjectGroups(grps.data);
      if (fields?.success && Array.isArray(fields.data)) setCustomFields(fields.data);
      if (studs?.success && Array.isArray(studs.data)) setStudents(studs.data);
      if (inqs?.success && Array.isArray(inqs.data)) setInquiries(inqs.data);
      if (headsData?.success && Array.isArray(headsData.data)) setFeeHeads(headsData.data);
    } catch (err: any) {
      console.error('Error fetching academic data:', err);
      setError('Failed to synchronize academic hierarchy from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();
    return students.filter(s => {
      const name = String(s.full_name || '').toLowerCase();
      const adm = String(s.admission_number || '').toLowerCase();
      const ph = String(s.phone || '');
      const matchesSearch = !q || name.includes(q) || adm.includes(q) || ph.includes(q);
      
      const matchesProgram = selectedProgramFilter === 'all' || s.program_id === selectedProgramFilter;
      const matchesBatch = selectedBatchFilter === 'all' || s.batch_id === selectedBatchFilter;
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;

      return matchesSearch && matchesProgram && matchesBatch && matchesStatus;
    });
  }, [students, searchQuery, selectedProgramFilter, selectedBatchFilter, statusFilter]);

  useEffect(() => {
    setDirectoryPage(1);
  }, [searchQuery, selectedProgramFilter, selectedBatchFilter, statusFilter]);

  const directoryPageCount = Math.max(1, Math.ceil(filteredStudents.length / DIRECTORY_PAGE_SIZE));
  const pagedStudents = filteredStudents.slice(
    (directoryPage - 1) * DIRECTORY_PAGE_SIZE,
    directoryPage * DIRECTORY_PAGE_SIZE
  );

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
      const q = (searchQuery || '').toLowerCase().trim();
      const matchesSearch = 
        !q ||
        (i.student_name || '').toLowerCase().includes(q) ||
        (i.inquiry_number || '').toLowerCase().includes(q) ||
        (i.phone || '').includes(q);
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
      } else {
        alert(data.error?.message || 'Failed to update inquiry stage');
      }
    } catch (err) {
      console.error('Failed to update stage:', err);
      alert('Failed to update inquiry stage due to a network or server error.');
    }
  };

  // Handle 1-Click Admit from Inquiry
  const handleExecuteAdmit = async () => {
    if (!admitInquiryModal || !admitBatchId) return;

    const targetBatch = batches.find(b => b.id === admitBatchId);
    if (targetBatch && (targetBatch.current_enrollment || 0) >= targetBatch.max_capacity) {
      alert(`Section/batch "${targetBatch.name}" has reached maximum capacity (${targetBatch.current_enrollment}/${targetBatch.max_capacity}). Please increase batch capacity in Academic Structure before admitting.`);
      return;
    }

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
            concession_type: concession > 0 ? 'flat' : 'none',
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
      const parseCsvRow = (text: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let j = 0; j < text.length; j++) {
          const c = text[j];
          if (c === '"') {
            if (inQuotes && text[j + 1] === '"') {
              cur += '"';
              j++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (c === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += c;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const headers = parseCsvRow(lines[0]).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = parseCsvRow(line).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        rows.push({
          full_name: rowObj.full_name || rowObj.name || rowObj['student name'] || '',
          phone: rowObj.phone || rowObj.mobile || undefined,
          email: rowObj.email || undefined,
          guardian_name: rowObj.guardian_name || rowObj.father_name || rowObj['guardian name'] || 'Guardian',
          guardian_phone: rowObj.guardian_phone || rowObj.guardian_mobile || rowObj.phone || undefined,
          guardian_id_card: rowObj.guardian_id_card || rowObj.guardian_cnic || rowObj.cnic || undefined,
          guardian_relation: rowObj.guardian_relation || rowObj.relation || 'Father',
          batch_id: rowObj.batch_id || bulkImportBatchId || (batches[0]?.id || ''),
          gender: rowObj.gender || undefined,
          blood_group: rowObj.blood_group || undefined,
          date_of_birth: rowObj.date_of_birth || rowObj.dob || undefined,
          student_b_form: rowObj.student_b_form || rowObj.b_form || rowObj.bform || undefined,
          previous_school: rowObj.previous_school || rowObj.previous_academy || rowObj.last_school || undefined,
          religion: rowObj.religion || undefined,
          residential_address: rowObj.residential_address || rowObj.address || undefined,
          city: rowObj.city || undefined,
          father_name: rowObj.father_name || rowObj.guardian_name || undefined,
          father_cnic: rowObj.father_cnic || rowObj.guardian_id_card || rowObj.guardian_cnic || undefined,
          father_phone: rowObj.father_phone || rowObj.guardian_phone || undefined,
          father_occupation: rowObj.father_occupation || undefined,
          mother_name: rowObj.mother_name || undefined,
          mother_cnic: rowObj.mother_cnic || undefined,
          mother_phone: rowObj.mother_phone || undefined,
          mother_occupation: rowObj.mother_occupation || undefined,
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
      } else {
        alert(result.error?.message || 'Failed to create prospective candidate inquiry.');
      }
    } catch (err: any) {
      console.error('Failed to create inquiry:', err);
      alert(err?.message || 'Network error occurred while submitting student inquiry.');
    }
  };

  // Single Student Archive Handler
  const handleArchiveStudent = async () => {
    if (!studentToArchive || !token) return;
    setIsArchiving(true);
    try {
      const res = await fetch(`/api/v1/sis/students/${studentToArchive.id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: archiveReason.trim() || 'Administrative student archival',
          cancel_unpaid_invoices: cancelUnpaidOnArchive,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedbackMessage({
          type: 'success',
          text: `Student "${studentToArchive.full_name}" has been archived successfully.`,
        });
        setStudentToArchive(null);
        await fetchData();
      } else {
        setActionFeedbackMessage({
          type: 'error',
          text: data.error?.message || 'Failed to archive student record.',
        });
      }
    } catch (err: any) {
      setActionFeedbackMessage({
        type: 'error',
        text: err.message || 'Network error while archiving student.',
      });
    } finally {
      setIsArchiving(false);
    }
  };

  // Single Student Unarchive Handler
  const handleUnarchiveStudent = async (student: Student) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/sis/students/${student.id}/unarchive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: 'Restored from archive to active standing',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedbackMessage({
          type: 'success',
          text: `Student "${student.full_name}" restored to active status successfully.`,
        });
        await fetchData();
      } else {
        setActionFeedbackMessage({
          type: 'error',
          text: data.error?.message || 'Failed to restore student record.',
        });
      }
    } catch (err: any) {
      setActionFeedbackMessage({
        type: 'error',
        text: err.message || 'Network error while restoring student.',
      });
    }
  };

  // Single Student Permanent Delete Handler
  const handleDeleteStudent = async () => {
    if (!studentToDelete || !token) return;
    setIsDeleting(true);
    setDeleteErrorMessage(null);
    try {
      const res = await fetch(`/api/v1/sis/students/${studentToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          force: deleteForce,
          reason: deleteReason.trim() || 'Administrative permanent student deletion',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedbackMessage({
          type: 'success',
          text: `Student "${studentToDelete.full_name}" permanently deleted.`,
        });
        setStudentToDelete(null);
        await fetchData();
      } else {
        if (res.status === 409 || data.error?.hasPaidTransactions) {
          setDeleteRequiresForce(true);
        }
        setDeleteErrorMessage(data.error?.message || 'Failed to delete student record.');
      }
    } catch (err: any) {
      setDeleteErrorMessage(err.message || 'Network error while deleting student.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk Archive Handler
  const handleBulkArchive = async () => {
    if (selectedDirectoryStudentIds.size === 0 || !token) return;
    setIsBulkOperating(true);
    try {
      const res = await fetch('/api/v1/sis/students/bulk-archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_ids: Array.from(selectedDirectoryStudentIds),
          reason: bulkArchiveReason.trim() || 'Bulk administrative archival',
          cancel_unpaid_invoices: bulkArchiveCancelUnpaid,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedbackMessage({
          type: 'success',
          text: data.message || `${data.data?.archived_count || selectedDirectoryStudentIds.size} student(s) archived successfully.`,
        });
        setSelectedDirectoryStudentIds(new Set());
        setShowBulkArchiveModal(false);
        await fetchData();
      } else {
        setActionFeedbackMessage({
          type: 'error',
          text: data.error?.message || 'Failed to perform bulk archival.',
        });
      }
    } catch (err: any) {
      setActionFeedbackMessage({
        type: 'error',
        text: err.message || 'Network error during bulk archival.',
      });
    } finally {
      setIsBulkOperating(false);
    }
  };

  // Bulk Delete Handler
  const handleBulkDelete = async () => {
    if (selectedDirectoryStudentIds.size === 0 || !token) return;
    setIsBulkOperating(true);
    try {
      const res = await fetch('/api/v1/sis/students/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_ids: Array.from(selectedDirectoryStudentIds),
          force: bulkDeleteForce,
          reason: bulkDeleteReason.trim() || 'Bulk administrative deletion',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedbackMessage({
          type: 'success',
          text: data.message || `${data.data?.deleted_count || selectedDirectoryStudentIds.size} student(s) deleted successfully.`,
        });
        setSelectedDirectoryStudentIds(new Set());
        setShowBulkDeleteModal(false);
        await fetchData();
      } else {
        setActionFeedbackMessage({
          type: 'error',
          text: data.error?.message || 'Failed to perform bulk deletion.',
        });
      }
    } catch (err: any) {
      setActionFeedbackMessage({
        type: 'error',
        text: err.message || 'Network error during bulk deletion.',
      });
    } finally {
      setIsBulkOperating(false);
    }
  };

  // Transfer Inquiry data directly into Admission Form
  const handleTransferInquiryToAdmission = (inq: StudentInquiry) => {
    setTransferInquiryId(inq.id);
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
    if (inq.guardian_name) setFatherName(inq.guardian_name);
    if (inq.guardian_phone) setFatherPhone(inq.guardian_phone);
    if ((inq as any).guardian_id_card) setFatherCnic((inq as any).guardian_id_card);
    const prevSch = (inq as any).previous_school || (inq.custom_field_values as any)?.previous_school;
    if (prevSch) setPreviousSchool(prevSch);
    setActiveTab('new_admission');
  };

  // Open direct section/batch admit modal for inquiry with smart defaults
  const handleOpenAdmitInquiryModal = (inq: StudentInquiry) => {
    setAdmitInquiryModal(inq);
    const matchingBatch = (inq.program_id ? batches.find(b => b.program_id === inq.program_id) : null) || batches[0];
    if (matchingBatch) {
      setAdmitBatchId(matchingBatch.id);
      const prog = programs.find(p => p.id === matchingBatch.program_id);
      const tuition = matchingBatch.fee_amount ?? matchingBatch.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount ?? prog?.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount ?? 0;
      setAdmitTuitionFee(tuition || '');
      const admFee = matchingBatch.fee_schedule?.find(f => f.fee_type === 'admission')?.amount ?? prog?.fee_schedule?.find(f => f.fee_type === 'admission')?.amount ?? 0;
      setAdmitAdmissionFee(admFee || '');
    } else {
      setAdmitBatchId('');
      setAdmitTuitionFee('');
      setAdmitAdmissionFee('');
    }
    setAdmitGuardianCnic((inq as any).guardian_id_card || '');
    setAdmitConcessionAmount('');
    setAdmitConcessionReason('');
  };

  // Sync batch fee schedule dynamically when batch is selected (no hardcoded fee fallbacks)
  useEffect(() => {
    if (enrollForm.batch_id) {
      const b = batches.find(x => x.id === enrollForm.batch_id);
      const p = programs.find(x => x.id === enrollForm.program_id);
      const tuition = b?.fee_amount
        ?? b?.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount 
        ?? p?.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount;
      if (tuition !== undefined) setAdmissionTuition(tuition);
      if (b?.billing_mode) {
        setBillingMode(b.billing_mode);
      }
    }
  }, [enrollForm.batch_id, enrollForm.program_id, batches, programs]);

  const tuitionNum = typeof admissionTuition === 'number' ? admissionTuition : 0;
  const concessionValNum = typeof concessionVal === 'number' ? concessionVal : 0;

  const discountAmount = useMemo(() => {
    if (concessionType === 'none' || concessionValNum <= 0) return 0;
    if (concessionMode === 'percentage') {
      return Math.round((tuitionNum * Math.min(100, concessionValNum)) / 100);
    }
    return Math.min(tuitionNum, concessionValNum);
  }, [concessionType, concessionMode, concessionValNum, tuitionNum]);

  const netMonthlyTuition = Math.max(0, tuitionNum - discountAmount);

  const availableAdmissionHeads = useMemo(() => {
    return feeHeads.filter(h => h.code !== 'TUITION' && !selectedAdmissionHeads.some(s => s.fee_head_id === h.id));
  }, [feeHeads, selectedAdmissionHeads]);

  const additionalHeadsTotal = useMemo(() => {
    return selectedAdmissionHeads.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
  }, [selectedAdmissionHeads]);

  const firstMonthTotal = netMonthlyTuition + additionalHeadsTotal;

  // Auto-calculate installment schedule whenever billingMode, count, net tuition or admission date changes
  useEffect(() => {
    if (billingMode === 'installment') {
      const n = Math.max(2, Math.min(6, installmentCount));
      const baseAmt = Math.floor(netMonthlyTuition / n);
      const remainder = netMonthlyTuition - (baseAmt * n);
      const [ay, am, ad] = (admissionDate || localISODate()).split('-').map(Number);
      const baseDate = new Date(ay, (am || 1) - 1, ad || 1);

      setInstallments(prev => {
        return Array.from({ length: n }, (_, i) => {
          const instNum = i + 1;
          const amt = i === 0 ? baseAmt + remainder : baseAmt;
          const d = new Date(baseDate);
          if (i === 0) {
            d.setDate(d.getDate() + 7);
          } else {
            d.setMonth(d.getMonth() + i);
            d.setDate(Math.min(d.getDate(), 28));
          }
          const dueIso = localISODate(d);
          return {
            installment_number: instNum,
            due_date: prev[i]?.due_date || dueIso,
            amount: amt,
            status: 'pending' as const,
          };
        });
      });
    }
  }, [billingMode, installmentCount, netMonthlyTuition, admissionDate]);

  const handleUpdateInstallmentAmount = (index: number, newAmount: number) => {
    setInstallments(prev => prev.map((ins, i) => i === index ? { ...ins, amount: Math.max(0, newAmount) } : ins));
  };

  const handleUpdateInstallmentDueDate = (index: number, newDate: string) => {
    setInstallments(prev => prev.map((ins, i) => i === index ? { ...ins, due_date: newDate } : ins));
  };

  const installmentTotalSum = useMemo(() => {
    return installments.reduce((sum, ins) => sum + (Number(ins.amount) || 0), 0);
  }, [installments]);

  const firstChallanDue = billingMode === 'installment'
    ? (installments[0]?.amount || 0) + additionalHeadsTotal
    : firstMonthTotal;

  const handleAddAdmissionHead = (feeHeadId: string) => {
    if (!feeHeadId) return;
    const head = feeHeads.find(h => h.id === feeHeadId);
    if (!head) return;
    setSelectedAdmissionHeads(prev => [
      ...prev,
      { fee_head_id: head.id, amount: (head.default_amount && head.default_amount > 0) ? head.default_amount : '' }
    ]);
    setHeadToAdd('');
  };

  const handleRemoveAdmissionHead = (feeHeadId: string) => {
    setSelectedAdmissionHeads(prev => prev.filter(h => h.fee_head_id !== feeHeadId));
  };

  const handleUpdateAdmissionHeadAmount = (feeHeadId: string, val: string) => {
    const amount = val === '' ? '' : Math.max(0, Number(val));
    setSelectedAdmissionHeads(prev => prev.map(h => h.fee_head_id === feeHeadId ? { ...h, amount } : h));
  };

  // Direct Admission Submit
  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollForm.batch_id || !enrollForm.full_name) {
      alert('Please select a batch or class section, and provide the student name.');
      return;
    }
    if (enrollmentType === 'class' && !enrollForm.program_id) {
      alert('Please select an Academic Class.');
      return;
    }

    if (discountAmount > 0 && !concessionReason.trim()) {
      alert('A justification reason is mandatory when applying a student fee concession.');
      return;
    }

    const selectedBatch = batches.find(b => b.id === enrollForm.batch_id);
    if (selectedBatch && (selectedBatch.current_enrollment || 0) >= selectedBatch.max_capacity) {
      alert(`Section/batch "${selectedBatch.name}" has reached maximum capacity (${selectedBatch.current_enrollment}/${selectedBatch.max_capacity}). Please increase batch capacity in Academic Structure before enrolling.`);
      return;
    }

    if (billingMode === 'installment' && installmentTotalSum !== netMonthlyTuition) {
      alert(`Installment schedule sum (PKR ${installmentTotalSum.toLocaleString()}) does not match net tuition (PKR ${netMonthlyTuition.toLocaleString()}). Please balance the installments before submitting.`);
      return;
    }

    const effectiveGuardianName = primaryContact === 'father'
      ? (fatherName.trim() || enrollForm.guardian_name.trim())
      : primaryContact === 'mother'
      ? (motherName.trim() || enrollForm.guardian_name.trim())
      : enrollForm.guardian_name.trim();

    const effectiveGuardianPhone = primaryContact === 'father'
      ? (fatherPhone.trim() || enrollForm.guardian_phone.trim())
      : primaryContact === 'mother'
      ? (motherPhone.trim() || enrollForm.guardian_phone.trim())
      : enrollForm.guardian_phone.trim();

    const effectiveGuardianCnic = primaryContact === 'father'
      ? (fatherCnic.trim() || ((enrollForm as any).guardian_id_card || '').trim())
      : primaryContact === 'mother'
      ? (motherCnic.trim() || ((enrollForm as any).guardian_id_card || '').trim())
      : ((enrollForm as any).guardian_id_card || '').trim();

    const effectiveGuardianRelation = primaryContact === 'father'
      ? 'Father'
      : primaryContact === 'mother'
      ? 'Mother'
      : guardianRelation;

    if (!effectiveGuardianName || !effectiveGuardianPhone) {
      alert('Please provide the parent or guardian name and contact phone number.');
      return;
    }

    const feeRules = tenant?.settings?.fee_rules;
    const kinshipRules = feeRules?.kinship_rules;
    if (concessionType === 'kinship' && kinshipRules?.require_active_sibling) {
      if (!siblingStudentId) {
        alert('Kinship fee concession requires selecting an active enrolled sibling.');
        return;
      }
      const sib = students.find(s => s.id === siblingStudentId);
      if (!sib || sib.status !== 'active') {
        alert(`Kinship fee concession requires an active sibling currently enrolled at this institution.${sib ? ` (Selected student status is ${sib.status})` : ''}`);
        return;
      }
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
          inquiry_id: transferInquiryId || undefined,
          full_name: enrollForm.full_name.trim(),
          phone: enrollForm.phone.trim() || undefined,
          student_whatsapp: studentWhatsapp.trim() || undefined,
          emergency_contact_name: emergencyContactName.trim() || undefined,
          emergency_contact_phone: emergencyContactPhone.trim() || undefined,
          emergency_contact_relation: emergencyContactRelation.trim() || undefined,
          email: enrollForm.email.trim() || undefined,
          photo_url: photoUrl || undefined,
          date_of_birth: dob.trim() || undefined,
          gender: gender || undefined,
          student_b_form: studentBForm.trim() || undefined,
          previous_school: previousSchool.trim() || undefined,
          religion: religion.trim() || undefined,
          submitted_documents: submittedDocuments,
          residential_address: residentialAddress.trim() || undefined,
          city: city.trim() || undefined,
          father_name: fatherName.trim() || undefined,
          father_cnic: fatherCnic.trim() || undefined,
          father_phone: fatherPhone.trim() || undefined,
          father_occupation: fatherOccupation.trim() || undefined,
          mother_name: motherName.trim() || undefined,
          mother_cnic: motherCnic.trim() || undefined,
          mother_phone: motherPhone.trim() || undefined,
          mother_occupation: motherOccupation.trim() || undefined,
          primary_contact: primaryContact,
          sibling_student_id: siblingStudentId || undefined,
          concession_category: concessionType !== 'none' ? concessionType : undefined,
          guardian_name: effectiveGuardianName,
          guardian_relation: effectiveGuardianRelation,
          guardian_phone: effectiveGuardianPhone,
          guardian_email: enrollForm.guardian_email.trim() || undefined,
          guardian_id_card: effectiveGuardianCnic || undefined,
          guardian_whatsapp: (guardianWhatsapp || effectiveGuardianPhone).trim(),
          program_id: enrollForm.program_id,
          batch_id: enrollForm.batch_id,
          admission_date: admissionDate || undefined,
          elective_group_id: enrollForm.elective_group_id || undefined,
          blood_group: bloodGroup || undefined,
          fee_structure: {
            base_tuition: tuitionNum,
            admission_fee: selectedAdmissionHeads.find(h => feeHeads.find(fh => fh.id === h.fee_head_id)?.code === 'ADMISSION')?.amount || 0,
            exam_fee: selectedAdmissionHeads.find(h => feeHeads.find(fh => fh.id === h.fee_head_id)?.code === 'EXAM')?.amount || 0,
            additional_heads: selectedAdmissionHeads.map(h => ({
              fee_head_id: h.fee_head_id,
              amount: Number(h.amount) || 0
            })),
            concession_type: concessionMode,
            concession_category: concessionType !== 'none' ? concessionType : undefined,
            concession_val: discountAmount > 0 ? concessionValNum : 0,
            concession_reason: discountAmount > 0 ? concessionReason : undefined,
            net_tuition: netMonthlyTuition,
            first_month_total: firstMonthTotal,
          },
          generate_first_month_invoice: generateFirstChallan,
          subjects: subjectIds,
          custom_field_values: enrollForm.custom_field_values,
          billing_mode: billingMode,
          installment_plan: billingMode === 'installment' ? {
            total_fee: netMonthlyTuition,
            total_installments: installments.length || installmentCount,
            installments: installments.map((ins, idx) => ({
              installment_number: idx + 1,
              due_date: ins.due_date,
              amount: Number(ins.amount) || 0,
              invoice_id: null,
              status: 'pending' as const,
            })),
          } : undefined,
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
        const challanErr = result.challan_error || result.data?.challan_error;
        if (challanErr) {
          setEnrollSuccessMessage(`Enrollment confirmed! Admission: ${result.data.admission_number}. Fee challan generation failed: ${challanErr}`);
        } else {
          setEnrollSuccessMessage(`Enrollment confirmed! Admission: ${result.data.admission_number}`);
        }

        let recordedPayment: any = null;
        const payAmt = typeof initialPaymentAmount === 'number' && initialPaymentAmount > 0 ? initialPaymentAmount : firstChallanDue;

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
        const tuitionItemName = billingMode === 'installment'
          ? `Tuition Fee (Installment 1 of ${installmentCount})`
          : (billingMode === 'one_time' ? 'Course Package Tuition (Net)' : billingMode === 'quarterly' ? 'Quarterly Tuition (Net)' : 'Monthly Tuition (Net)');
        const tuitionItemAmount = billingMode === 'installment'
          ? (installments[0]?.amount || 0)
          : netMonthlyTuition;

        const receiptItems = [
          { name: tuitionItemName, amount: tuitionItemAmount },
          ...selectedAdmissionHeads.map(h => {
            const head = feeHeads.find(fh => fh.id === h.fee_head_id);
            return { name: head?.name || 'Fee Head', amount: Number(h.amount) || 0 };
          }).filter(it => it.amount > 0)
        ];

        // Trigger Branded WhatsApp Receipt Modal
        setReceiptModalData({
          student: result.data,
          payment: recordedPayment,
          amountPaid: collectInitialPayment ? payAmt : 0,
          totalDue: firstChallanDue,
          billingMonth: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          items: receiptItems,
        });

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
        setStudentWhatsapp('');
        setStudentWhatsappSameAsPhone(true);
        setGuardianRelation('');
        setGuardianWhatsapp('');
        setWhatsappSameAsCalling(true);
        setEmergencyContactName('');
        setEmergencyContactPhone('');
        setEmergencyContactRelation('');
        setBloodGroup('');
        setAdmissionDate('');
        setAdmissionTuition('');
        setBillingMode('monthly');
        setInstallmentCount(3);
        setInstallments([]);
        setSelectedAdmissionHeads([]);
        setHeadToAdd('');
        setConcessionType('none');
        setConcessionVal('');
        setConcessionReason('');
        setCollectInitialPayment(false);
        setInitialPaymentAmount('');
        setInitialPaymentReference('');
        setDob('');
        setGender('');
        setStudentBForm('');
        setPreviousSchool('');
        setReligion('');
        setSubmittedDocuments(defaultChecklistState);
        setResidentialAddress('');
        setCity('');
        setFatherName('');
        setFatherCnic('');
        setFatherPhone('');
        setFatherOccupation('');
        setMotherName('');
        setMotherCnic('');
        setMotherPhone('');
        setMotherOccupation('');
        setPrimaryContact('father');
        setSiblingStudentId('');
        setSiblingSearchQuery('');
        setTransferInquiryId(null);
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
  const getProgramName = (progId?: string | null) => {
    if (!progId) return 'General Academic';
    const p = programs.find(x => x.id === progId);
    return (p && p.name) ? String(p.name) : 'General Academic';
  };
  const getBatchName = (batchId?: string | null) => {
    if (!batchId) return 'Unassigned Batch';
    const b = batches.find(x => x.id === batchId);
    if (!b || !b.name) return 'Unassigned Batch';
    const bName = String(b.name);
    if (b.shift && typeof b.shift === 'string' && !bName.toLowerCase().includes(b.shift.toLowerCase())) {
      return `${bName} (${b.shift.charAt(0).toUpperCase() + b.shift.slice(1).toLowerCase()})`;
    }
    return bName;
  };
  const getSubjectNames = (subIds: string[]) => {
    return subIds.map(id => subjects.find(s => s.id === id)?.name || id).filter(Boolean);
  };

  // Sibling Information Autofill
  const handleCopySiblingDetails = (sib: Student) => {
    if (!sib) return;
    if (sib.father_name) setFatherName(sib.father_name);
    if (sib.father_cnic) setFatherCnic(sib.father_cnic);
    if (sib.father_phone) setFatherPhone(sib.father_phone);
    if (sib.father_occupation) setFatherOccupation(sib.father_occupation);
    if (sib.mother_name) setMotherName(sib.mother_name);
    if (sib.mother_cnic) setMotherCnic(sib.mother_cnic);
    if (sib.mother_phone) setMotherPhone(sib.mother_phone);
    if (sib.mother_occupation) setMotherOccupation(sib.mother_occupation);
    if (sib.residential_address) setResidentialAddress(sib.residential_address);
    if (sib.city) setCity(sib.city);
    if (sib.emergency_contact_name) setEmergencyContactName(sib.emergency_contact_name);
    if (sib.emergency_contact_phone) setEmergencyContactPhone(sib.emergency_contact_phone);
    if (sib.emergency_contact_relation) setEmergencyContactRelation(sib.emergency_contact_relation);
    if (sib.guardian_relation) setGuardianRelation(sib.guardian_relation);
    if (sib.primary_contact) setPrimaryContact(sib.primary_contact as any);
    if (sib.guardian_name) setEnrollForm(prev => ({ ...prev, guardian_name: sib.guardian_name }));
    if (sib.guardian_phone) setEnrollForm(prev => ({ ...prev, guardian_phone: sib.guardian_phone }));
    if (sib.guardian_id_card) setEnrollForm(prev => ({ ...prev, guardian_id_card: sib.guardian_id_card } as any));
    if (sib.guardian_email) setEnrollForm(prev => ({ ...prev, guardian_email: sib.guardian_email || '' }));
    if (sib.guardian_whatsapp) {
      setGuardianWhatsapp(sib.guardian_whatsapp);
    } else if (whatsappSameAsCalling) {
      const gPhone = sib.father_phone || sib.guardian_phone || sib.mother_phone;
      if (gPhone) setGuardianWhatsapp(gPhone);
    }
  };

  // Fee Challan Print Generator
  const handlePrintFeeChallan = async (student: Student) => {
    if (!token) return;
    setIsGeneratingFeeChallanPdf(true);
    try {
      let inv: any = null;
      if (student.first_invoice_id) {
        const invRes = await fetch(`/api/v1/finance/invoices/${student.first_invoice_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const invJson = await invRes.json();
        if (invJson.success && invJson.data) {
          inv = invJson.data;
        }
      }

      const letterhead = await academyLetterheadFromAuth(tenant);
      const sSettings = (tenant?.settings as any) || {};
      const bankDetails = {
        bankName: sSettings.bank_name || '',
        accountTitle: sSettings.bank_account_title || tenant?.name || '',
        accountNumber: sSettings.bank_account_number || '',
        branchName: sSettings.bank_branch || tenant?.city || '',
      };

      const progName = getProgramName(student.program_id);
      const batchName = getBatchName(student.batch_id);
      const fatherName = student.father_name || student.guardian_name || 'Guardian';

      const items: ChallanItem[] = (inv?.items && inv.items.length > 0)
        ? inv.items.map((it: any) => ({ head_name: it.head_name || 'Tuition Fee', amount: it.net_amount }))
        : [
            { head_name: 'Tuition Fee', amount: student.fee_structure?.net_tuition || 0 },
            ...(student.fee_structure?.additional_heads || []).map((h: any) => {
              const head = feeHeads.find(fh => fh.id === h.fee_head_id);
              return { head_name: head?.name || 'Fee Head', amount: h.amount };
            })
          ];

      const challanData: StudentChallanData = {
        challan_number: inv?.invoice_number || `CH-${student.admission_number}`,
        roll_number: student.admission_number || '—',
        admission_number: student.admission_number || undefined,
        student_name: student.full_name,
        father_name: fatherName,
        class_name: progName,
        batch_name: batchName,
        billing_month: inv?.billing_month ? normalizeBillingMonth(inv.billing_month) : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        issue_date: inv?.issue_date || student.admission_date || new Date().toISOString().split('T')[0],
        due_date: inv?.due_date || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
        items,
        concession_amount: student.fee_structure?.concession_val ? student.fee_structure.concession_val : undefined,
        net_amount: inv?.net_amount || student.fee_structure?.first_month_total || student.fee_structure?.net_tuition || 0,
        history_months: [],
      };

      const bytes = await buildBatchChallansPdfBytes({
        academy: letterhead,
        bankDetails,
        challans: [challanData],
      });

      setFeeChallanPdfBytes(bytes);
      setFeeChallanPdfFilename(`Fee_Challan_${student.admission_number}.pdf`);
      setShowFeeChallanModal(true);
    } catch (err) {
      console.error('Failed to generate fee challan PDF:', err);
      alert('Failed to generate Fee Challan PDF. Please try again.');
    } finally {
      setIsGeneratingFeeChallanPdf(false);
    }
  };

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

  const selectedEnrollBatch = useMemo(() => {
    return batches.find(b => b.id === enrollForm.batch_id) || null;
  }, [batches, enrollForm.batch_id]);

  const isSelectedBatchFull = useMemo(() => {
    return Boolean(selectedEnrollBatch && (selectedEnrollBatch.current_enrollment || 0) >= selectedEnrollBatch.max_capacity);
  }, [selectedEnrollBatch]);

  // Auto-sync selected subjects when program or elective track changes
  useEffect(() => {
    const progChanged = prevProgIdRef.current !== enrollForm.program_id;
    const elecChanged = prevElectiveGroupIdRef.current !== enrollForm.elective_group_id;

    if (progChanged || elecChanged) {
      prevProgIdRef.current = enrollForm.program_id;
      prevElectiveGroupIdRef.current = enrollForm.elective_group_id;

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
    }
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
    <div className="space-y-2.5 sm:space-y-3">
      {/* Page Header & Single Consolidated Icon Menu */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          {activeTab !== 'directory' && (
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold mb-1 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Students</span>
            </button>
          )}
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
            {activeTab === 'directory'
              ? 'Students'
              : activeTab === 'inquiries'
              ? 'Inquiries Pipeline'
              : activeTab === 'new_admission'
              ? 'New Student Admission'
              : 'Student ID Cards Studio'}
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {activeTab === 'directory'
              ? 'Enrolled student roster, admission records, and academic profiles.'
              : activeTab === 'inquiries'
              ? 'Prospect inquiries tracking, lead stages, and 1-click admission.'
              : activeTab === 'new_admission'
              ? 'Register new student enrollment and generate admission challan.'
              : 'Official duplex identity cards generator and print studio.'}
          </p>
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
            Retry
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: STUDENT DIRECTORY & STUDENT PROFILE                                 */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <>
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs relative z-20">
          {actionFeedbackMessage && (
            <div className={`p-3 border-b flex items-center justify-between text-xs font-semibold ${
              actionFeedbackMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {actionFeedbackMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{actionFeedbackMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionFeedbackMessage(null)}
                className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {/* Controls Toolbar: Standalone Search Bar + Icon-Only Filter & Overview Button */}
          <div className="p-3 bg-white">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search students by name, roll #, guardian, contact..."
                  aria-label="Search students by name, admission number, or contact"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 sm:py-1.5 text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors font-sans text-slate-900"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Button */}
              <button
                type="button"
                onClick={() => setShowDirectoryFilters(prev => !prev)}
                className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 relative ${
                  showDirectoryFilters || activeDirectoryFilterCount > 0
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Toggle Filters"
                aria-label="Toggle Filters"
              >
                <SlidersHorizontal className="w-4 h-4 text-slate-600" />
                {activeDirectoryFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {activeDirectoryFilterCount}
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

                {/* Dropdown Menu containing all options */}
                {showModuleMenu && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-50 divide-y divide-slate-100 text-left animate-in fade-in zoom-in-95 duration-100"
                  >
                    {/* Primary Action */}
                    <div className="p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowModuleMenu(false);
                          setActiveTab('new_admission');
                        }}
                        className="w-full px-3 py-2 text-xs text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg flex items-center gap-2 font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-amber-700" />
                        <span>+ New Admission</span>
                      </button>
                    </div>

                    {/* Navigation Section */}
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        Views
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowModuleMenu(false);
                          setActiveTab('directory');
                        }}
                        className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          activeTab === 'directory' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>Students Roster</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">{students.length}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowModuleMenu(false);
                          setActiveTab('inquiries');
                        }}
                        className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          (activeTab as string) === 'inquiries' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                          <span>Inquiries Pipeline</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">{inquiries.length}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowModuleMenu(false);
                          setActiveTab('id_cards');
                        }}
                        className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          (activeTab as string) === 'id_cards' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                          <span>Student ID Cards</span>
                        </div>
                      </button>
                    </div>

                    {/* Display Options Section (Slider Item) */}
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
                        <div className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          showOverviewCards ? 'bg-amber-600' : 'bg-slate-200'
                        }`}>
                          <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            showOverviewCards ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </div>
                      </button>
                    </div>

                    {/* Administrative Tools */}
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        Tools
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowModuleMenu(false);
                          setShowBulkImportModal(true);
                          setBulkImportResult(null);
                          setBulkImportCsvText('');
                          if (batches.length > 0 && !bulkImportBatchId) setBulkImportBatchId(batches[0].id);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Bulk CSV Upload</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowModuleMenu(false);
                          setIsAddingDocHead(true);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>Physical Document Checklist</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Overview Summary Cards (Controlled by Overview Cards slider item in menu) */}
            {showOverviewCards && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                {/* 5-Card Metric Summary Strip (Sidebar Dark Navy Design) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3 py-2 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 block">Total Students</span>
                      <span className="font-mono font-bold text-white text-base">{students.length}</span>
                    </div>
                    <span className="w-7 h-7 rounded-lg bg-white/10 text-white border border-white/10 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3 py-2 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 block">Active Enrolled</span>
                      <span className="font-mono font-bold text-emerald-400 text-base">{students.filter(s => s.status === 'active').length}</span>
                    </div>
                    <span className="w-7 h-7 rounded-lg bg-white/10 text-emerald-400 border border-white/10 flex items-center justify-center shrink-0">
                      <UserCheck className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3 py-2 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 block">Inquiries</span>
                      <span className="font-mono font-bold text-amber-400 text-base">{inquiries.length}</span>
                    </div>
                    <span className="w-7 h-7 rounded-lg bg-white/10 text-amber-400 border border-white/10 flex items-center justify-center shrink-0">
                      <HelpCircle className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3 py-2 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 block">Defaulters</span>
                      <span className="font-mono font-bold text-rose-400 text-base">
                        {students.filter(s => s.fee_clearance_status === 'defaulter' || (Boolean(s.unpaid_balance) && s.unpaid_balance! > 0 && s.status === 'active')).length}
                      </span>
                    </div>
                    <span className="w-7 h-7 rounded-lg bg-white/10 text-rose-400 border border-white/10 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3 py-2 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)] col-span-2 sm:col-span-1">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 block">Inactive / Alumni</span>
                      <span className="font-mono font-bold text-slate-300 text-base">{students.filter(s => s.status !== 'active').length}</span>
                    </div>
                    <span className="w-7 h-7 rounded-lg bg-white/10 text-slate-300 border border-white/10 flex items-center justify-center shrink-0">
                      <Archive className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Selectors (Controlled by Filter button parallel to search) */}
            {showDirectoryFilters && (
              <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 flex-1 min-w-[140px]">
                    <span className="text-[11px] font-medium text-slate-500">Class:</span>
                    <select
                      value={selectedProgramFilter}
                      onChange={e => {
                        setSelectedProgramFilter(e.target.value);
                        setSelectedBatchFilter('all');
                      }}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                    >
                      <option value="all">All Classes ({programs.length})</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600 flex-1 min-w-[140px]">
                    <span className="text-[11px] font-medium text-slate-500">
                      {directoryCohortType === 'section' ? 'Section:' : directoryCohortType === 'batch' ? 'Batch:' : 'Cohort:'}
                    </span>
                    <select
                      value={selectedBatchFilter}
                      onChange={e => setSelectedBatchFilter(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                    >
                      <option value="all">
                        {directoryCohortType === 'section'
                          ? `All Sections (${availableDirectoryBatches.length})`
                          : `All Batches (${availableDirectoryBatches.length})`}
                      </option>
                      {availableDirectoryBatches.map(b => (
                        <option key={b.id} value={b.id}>
                          {selectedProgramFilter === 'all' ? `${getProgramName(b.program_id)} • ${b.name}` : b.name} ({b.shift.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600 flex-1 min-w-[130px]">
                    <span className="text-[11px] font-medium text-slate-500">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                    >
                      <option value="all">All Statuses ({students.length})</option>
                      <option value="active">Active ({students.filter(s => s.status === 'active').length})</option>
                      <option value="withdrawn">Withdrawn ({students.filter(s => s.status === 'withdrawn').length})</option>
                      <option value="suspended">Suspended ({students.filter(s => s.status === 'suspended').length})</option>
                      <option value="on_leave">On Leave ({students.filter(s => s.status === 'on_leave').length})</option>
                      <option value="alumni">Alumni ({students.filter(s => s.status === 'alumni').length})</option>
                      <option value="waitlisted">Waitlisted ({students.filter(s => s.status === 'waitlisted').length})</option>
                      <option value="archived">Archived ({students.filter(s => s.status === 'archived').length})</option>
                    </select>
                  </div>

                  {activeDirectoryFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProgramFilter('all');
                        setSelectedBatchFilter('all');
                        setStatusFilter('all');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Action Bar */}
        {selectedDirectoryStudentIds.size > 0 && (
          <div className="sticky top-0 sm:static z-20 bg-amber-50 text-amber-950 p-2.5 px-3 sm:px-4 flex flex-wrap items-center justify-between gap-2 border border-amber-200 rounded-xl shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <CheckSquare className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{selectedDirectoryStudentIds.size} student{selectedDirectoryStudentIds.size > 1 ? 's' : ''} selected</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowBulkIdCardsModal(true)}
                className="flex-1 sm:flex-initial h-8.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>Print ID Cards ({selectedDirectoryStudentIds.size})</span>
              </button>
              {canArchiveStudents && (
                <button
                  type="button"
                  onClick={() => {
                    setBulkArchiveReason('Bulk administrative student archival');
                    setBulkArchiveCancelUnpaid(false);
                    setShowBulkArchiveModal(true);
                  }}
                  className="flex-1 sm:flex-initial h-8.5 px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Archive Selected Students"
                >
                  <Archive className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>Archive ({selectedDirectoryStudentIds.size})</span>
                </button>
              )}
              {canDeleteStudents && (
                <button
                  type="button"
                  onClick={() => {
                    setBulkDeleteForce(false);
                    setBulkDeleteReason('Bulk administrative student deletion');
                    setShowBulkDeleteModal(true);
                  }}
                  className="flex-1 sm:flex-initial h-8.5 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Permanently Delete Selected Students"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Delete ({selectedDirectoryStudentIds.size})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedDirectoryStudentIds(new Set())}
                className="h-8.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Desktop Directory Table (>= 768px) */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2 px-3 w-10 text-center">
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
                    <th className="py-2 px-3">Student Details</th>
                    <th className="py-2 px-3 whitespace-nowrap min-w-[130px]">Admission #</th>
                    <th className="py-2 px-3">
                      {directoryCohortType === 'section' ? 'Class & Section' : directoryCohortType === 'batch' ? 'Class & Batch' : 'Class & Section / Batch'}
                    </th>
                    <th className="py-2 px-3">Guardian Contact</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {isLoading ? (
                    <InstitutionalLoader variant="table" colSpan={7} label="Loading student records..." />
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No students found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    pagedStudents.map((student, idx) => (
                      <tr key={student.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="py-2 px-3 text-center">
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
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-[#0E2A47] font-bold text-xs">
                              {student.photo_url ? (
                                <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{student.full_name.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div
                                onClick={() => setSelectedStudent(student)}
                                className="font-bold text-[#0E2A47] group-hover:text-[#B88634] transition-colors truncate cursor-pointer"
                              >
                                {student.full_name}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                                <span>{student.phone || 'No phone'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap tabular-nums min-w-[130px]">
                          {student.admission_number || '—'}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-800">{getProgramName(student.program_id)}</span>
                            {((student.active_enrollments_count ?? 1) > 1) && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                +{(student.active_enrollments_count ?? 1) - 1} {((student.active_enrollments_count ?? 1) - 1) === 1 ? 'class' : 'classes'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-[#B88634] font-medium">{getBatchName(student.batch_id)}</div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="text-slate-800 font-medium flex items-center gap-1">
                            <span>{student.guardian_name}</span>
                            {student.guardian_relation && (
                              <span className="text-[10px] text-slate-500 font-normal">({student.guardian_relation})</span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-slate-500 font-mono">{student.guardian_phone}</div>
                        </td>
                        <td className="py-2 px-3">
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
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(canDeleteStudents || canArchiveStudents) && (
                              <div className="relative inline-block text-left student-action-menu-container">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteMenuStudentId(deleteMenuStudentId === student.id ? null : student.id);
                                  }}
                                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                    deleteMenuStudentId === student.id
                                      ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-200'
                                      : 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-200 hover:border-rose-200'
                                  }`}
                                  title="Delete or Archive student"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                </button>

                                {deleteMenuStudentId === student.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className={`absolute right-0 ${
                                      idx >= Math.max(1, pagedStudents.length - 2) ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                    } w-44 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-30 divide-y divide-slate-100 text-left`}
                                  >
                                    <div className="py-1">
                                      {canDeleteStudents && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeleteMenuStudentId(null);
                                            setStudentToDelete(student);
                                            setDeleteReason('Administrative student deletion');
                                            setDeleteForce(false);
                                            setDeleteRequiresForce(false);
                                            setDeleteErrorMessage(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors font-medium cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                          <span>Delete Student</span>
                                        </button>
                                      )}
                                      {canArchiveStudents && (
                                        student.status === 'archived' ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setDeleteMenuStudentId(null);
                                              handleUnarchiveStudent(student);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors font-medium cursor-pointer"
                                          >
                                            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Restore Student</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setDeleteMenuStudentId(null);
                                              setStudentToArchive(student);
                                              setArchiveReason('Administrative student archival');
                                              setCancelUnpaidOnArchive(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 transition-colors font-medium cursor-pointer"
                                          >
                                            <Archive className="w-3.5 h-3.5 text-amber-600" />
                                            <span>Archive Student</span>
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <button
                              onClick={() => setSelectedStudent(student)}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 hover:text-amber-900 border border-amber-200/80 rounded-lg text-xs font-semibold transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Profile</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredStudents.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-xs">
                <span className="text-slate-500 font-mono text-[11px]">
                  Page {directoryPage} of {directoryPageCount} ({filteredStudents.length} students)
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={directoryPage <= 1}
                    onClick={() => setDirectoryPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 border border-slate-200 rounded-md bg-white disabled:opacity-40 text-xs font-semibold cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={directoryPage >= directoryPageCount}
                    onClick={() => setDirectoryPage(p => Math.min(directoryPageCount, p + 1))}
                    className="px-3 py-1.5 border border-slate-200 rounded-md bg-white disabled:opacity-40 text-xs font-semibold cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Box Cards List (< 768px) - 100% Full Width Directly on Page */}
          <div className="md:hidden space-y-2.5" data-testid="mobile-student-roster">
            {isLoading ? (
              <InstitutionalLoader variant="card" label="Loading student records..." />
            ) : filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 shadow-2xs p-4">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No students found matching current filters.</p>
                {(activeDirectoryFilterCount > 0 || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProgramFilter('all');
                      setSelectedBatchFilter('all');
                      setStatusFilter('all');
                      setSearchQuery('');
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer touch-press"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Filters</span>
                  </button>
                )}
              </div>
            ) : (
              pagedStudents.map(student => {
                const guardianPhone = student.guardian_phone || student.father_phone || student.student_whatsapp || student.phone;
                const guardianDisplay = student.guardian_name
                  ? `${student.guardian_name}${student.guardian_relation ? ` (${student.guardian_relation})` : ''}`
                  : student.father_name
                  ? `${student.father_name} (Father)`
                  : 'Guardian unlisted';
                const cleanWaPhone = cleanPhoneForWhatsApp(guardianPhone);

                return (
                  <div
                    key={student.id}
                    data-testid="student-roster-cell"
                    className="w-full bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 space-y-2.5 transition-all"
                  >
                    {/* Top Row: Avatar/Initials + Full Student Name + Admission Number + Status Pill */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDirectoryStudent(student.id);
                          }}
                          className="p-1 -ml-1 text-slate-400 active:text-slate-900 shrink-0 cursor-pointer"
                          aria-label="Select student"
                        >
                          {selectedDirectoryStudentIds.has(student.id) ? (
                            <CheckSquare className="w-4 h-4 text-slate-900" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>

                        <div className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold text-slate-700 text-xs shrink-0 overflow-hidden shadow-2xs">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            student.full_name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              onClick={() => setSelectedStudent(student)}
                              className="font-semibold text-sm text-slate-800 leading-snug cursor-pointer hover:text-amber-700 break-words"
                            >
                              {student.full_name}
                            </span>
                            {((student.active_enrollments_count ?? 1) > 1) && (
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                +{(student.active_enrollments_count ?? 1) - 1}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                            Adm #{student.admission_number || '—'}
                          </div>
                        </div>
                      </div>

                      {/* Institutional Status Pill */}
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-700 bg-slate-50 border border-slate-200 capitalize shrink-0 font-mono">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          student.status === 'active' ? 'bg-emerald-600' :
                          student.status === 'withdrawn' ? 'bg-rose-600' :
                          student.status === 'suspended' ? 'bg-amber-600' :
                          student.status === 'on_leave' ? 'bg-blue-600' : 'bg-slate-400'
                        }`}></span>
                        {student.status ? student.status.replace('_', ' ') : 'Active'}
                      </span>
                    </div>

                    {/* Middle Details: Flat single surface - ZERO nested inner card */}
                    <div className="text-xs text-slate-600 space-y-1 pt-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-slate-400 font-normal">Class:</span>
                        <span className="font-medium text-slate-700 text-right">
                          {getProgramName(student.program_id)} • {getBatchName(student.batch_id)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-slate-400 font-normal">Guardian:</span>
                        <span className="text-slate-700 text-right">
                          {guardianDisplay} {guardianPhone && <span className="font-mono text-slate-400 text-[11px]">({guardianPhone})</span>}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action Strip: Sleek Icon Buttons only! */}
                    <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                      {guardianPhone && (
                        <a
                          href={`tel:${guardianPhone}`}
                          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                          title="Call Guardian"
                          aria-label="Call Guardian"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {guardianPhone && (
                        <a
                          href={`https://wa.me/${cleanWaPhone || guardianPhone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-emerald-700 hover:text-emerald-800 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                          title="WhatsApp Guardian"
                          aria-label="WhatsApp Guardian"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                        title="Student Profile"
                        aria-label="Student Profile"
                      >
                        <User className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        data-testid="student-actions-trigger"
                        onClick={() => setMobileActionStudent(student)}
                        className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-500 hover:text-slate-800 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                        title="More Options"
                        aria-label="More Options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {filteredStudents.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs">
                <span className="text-slate-500 font-mono text-[11px]">
                  Page {directoryPage} of {directoryPageCount} ({filteredStudents.length} students)
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={directoryPage <= 1}
                    onClick={() => setDirectoryPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-40 text-xs font-semibold cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={directoryPage >= directoryPageCount}
                    onClick={() => setDirectoryPage(p => Math.min(directoryPageCount, p + 1))}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 disabled:opacity-40 text-xs font-semibold cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
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
              <button
                type="button"
                onClick={() => setActiveTab('directory')}
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Roster</span>
              </button>
              {[
                { id: 'all', label: 'All Inquiries' },
                { id: 'new', label: 'New' },
                { id: 'follow_up', label: 'Follow Up' },
                { id: 'trial_scheduled', label: 'Trial Scheduled' },
                { id: 'trial_attended', label: 'Trial Attended' },
                { id: 'fee_discussion', label: 'Fee Discussion' },
                { id: 'admitted', label: 'Admitted' },
                { id: 'closed', label: 'Closed' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setInquiryStageFilter(st.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                    inquiryStageFilter === st.id
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
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
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="new">New</option>
                                <option value="follow_up">Follow Up</option>
                                <option value="trial_scheduled">Trial Scheduled</option>
                                <option value="trial_attended">Trial Attended</option>
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
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1"
                                  title="Open candidate in Admission Form"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>Admit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAdmitInquiryModal(inq)}
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
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top Institutional Header */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('directory')}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shrink-0 mt-0.5"
                title="Back to Students Roster"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-slate-900">New Student Registration</h2>
                  <span className="text-[11px] font-bold font-mono px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Session: {tenant?.academic_session || '2026-2027'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Student admission registration, academic details, family records, and fee allocation.
                </p>
              </div>
            </div>

            {/* Academic Placement Toggle */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <span className="text-xs font-semibold text-slate-500">Admission Mode:</span>
              <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEnrollmentType('class');
                    setEnrollForm(prev => ({ ...prev, batch_id: '' }));
                  }}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    enrollmentType === 'class' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Academic Class
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnrollmentType('batch');
                    setEnrollForm(prev => ({ ...prev, program_id: '', batch_id: '' }));
                  }}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    enrollmentType === 'batch' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Batch / Course
                </button>
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {enrollSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-bold text-sm">{enrollSuccessMessage}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200/60">
                {createdStudentResult && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(createdStudentResult)}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-amber-200" />
                      <span>View Student Profile</span>
                    </button>
                    {createdStudentResult.first_invoice_id && (
                      <button
                        type="button"
                        onClick={() => handlePrintFeeChallan(createdStudentResult)}
                        disabled={isGeneratingFeeChallanPdf}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        <span>{isGeneratingFeeChallanPdf ? 'Generating Challan...' : 'Print Fee Challan'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (createdStudentResult) {
                          setSelectedDirectoryStudentIds(new Set([createdStudentResult.id]));
                          setShowBulkIdCardsModal(true);
                        }
                      }}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                      <span>Print ID Card</span>
                    </button>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('fee_desk')}
                        className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-emerald-200" />
                        <span>Collect Fee Now</span>
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('directory')}
                  className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                >
                  View in Directory
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleEnrollStudent} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* =================================================================== */}
            {/* LEFT COLUMN: STUDENT DOSSIER (8 COLUMNS)                           */}
            {/* =================================================================== */}
            <div className="lg:col-span-8 space-y-6">

              {/* 1. Academic Placement & Course Subjects */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Academic Details & Subjects
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Class, section, admission date, and enrolled subjects.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {enrollmentType === 'class' ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Class <span className="text-rose-500">*</span>
                        </label>
                        <ModernSelect
                          value={enrollForm.program_id}
                          onChange={val => {
                            setEnrollForm(prev => ({
                              ...prev,
                              program_id: val,
                              batch_id: '',
                              elective_group_id: '',
                            }));
                          }}
                          required
                          placeholder="Select Class"
                          options={[
                            { value: '', label: 'Select Class' },
                            ...programs.map(p => ({
                              value: p.id,
                              label: p.name,
                            })),
                          ]}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Section Batch <span className="text-rose-500">*</span>
                        </label>
                        <ModernSelect
                          value={enrollForm.batch_id}
                          onChange={val => setEnrollForm(prev => ({ ...prev, batch_id: val }))}
                          required
                          disabled={!enrollForm.program_id}
                          placeholder={
                            !enrollForm.program_id
                              ? 'Select Class First'
                              : availableBatchesForEnroll.length === 0
                              ? 'No Sections Available'
                              : 'Select Section'
                          }
                          options={[
                            {
                              value: '',
                              label: !enrollForm.program_id
                                ? 'Select Class First'
                                : availableBatchesForEnroll.length === 0
                                ? 'No Sections Available'
                                : 'Select Section',
                            },
                            ...availableBatchesForEnroll.map(b => {
                              const isFull = (b.current_enrollment || 0) >= b.max_capacity;
                              return {
                                value: b.id,
                                label: `${b.name} (${b.shift.toUpperCase()} Shift • ${isFull ? '[FULL] ' : ''}Enrolled: ${b.current_enrollment || 0} of ${b.max_capacity})`,
                                disabled: isFull,
                              };
                            }),
                          ]}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Section Batch <span className="text-rose-500">*</span>
                      </label>
                      <ModernSelect
                        value={enrollForm.batch_id}
                        onChange={val => {
                          const b = batches.find(x => x.id === val);
                          setEnrollForm(prev => ({
                            ...prev,
                            batch_id: val,
                            program_id: b?.program_id || '',
                            elective_group_id: '',
                          }));
                        }}
                        required
                        placeholder="Select Batch"
                        options={[
                          { value: '', label: 'Select Batch' },
                          ...batches
                            .filter(b => b.status === 'active')
                            .map(b => {
                              const isFull = (b.current_enrollment || 0) >= b.max_capacity;
                              return {
                                value: b.id,
                                label: `${b.name} (${b.shift.toUpperCase()} Shift${b.fee_amount != null ? ` • PKR ${b.fee_amount.toLocaleString()}` : ''} • ${isFull ? '[FULL] ' : ''}Enrolled: ${b.current_enrollment || 0} of ${b.max_capacity})`,
                                disabled: isFull,
                              };
                            }),
                        ]}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Admission Date
                    </label>
                    <input
                      type="date"
                      value={admissionDate}
                      onChange={e => setAdmissionDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Batch Full Warning */}
                {isSelectedBatchFull && selectedEnrollBatch && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>Section at Maximum Capacity:</strong> "{selectedEnrollBatch.name}" has reached capacity ({selectedEnrollBatch.current_enrollment}/{selectedEnrollBatch.max_capacity}). Please increase batch capacity in Academic Structure before enrolling students.
                    </span>
                  </div>
                )}

                {/* Elective Track Dropdown */}
                {electiveGroupsForEnroll.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Elective Group
                    </label>
                    <ModernSelect
                      value={enrollForm.elective_group_id}
                      onChange={val => setEnrollForm(prev => ({ ...prev, elective_group_id: val }))}
                      placeholder="Select Elective Group (Optional)"
                      options={[
                        { value: '', label: 'Select Elective Group (Optional)' },
                        ...electiveGroupsForEnroll.map(eg => ({
                          value: eg.id,
                          label: `${eg.name} (${getSubjectNames(eg.subject_ids).join(', ')})`,
                        })),
                      ]}
                    />
                  </div>
                )}

                {/* Enrolled Subjects Register */}
                {(enrollForm.program_id || (enrollmentType === 'batch' && enrollForm.batch_id && subjects.length > 0)) && (
                  <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-slate-700" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Enrolled Course Subjects ({selectedEnrollSubjectIds.length} Selected)
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500">Uncheck if student attends partial subjects</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Standalone Batch Subjects fallback */}
                      {!compulsoryGroupForEnroll && electiveGroupsForEnroll.length === 0 && subjects.length > 0 && (
                        <div className="space-y-1.5 sm:col-span-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                            <span>Available Subjects ({subjects.length})</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                            {subjects.map(s => {
                              const isChecked = selectedEnrollSubjectIds.includes(s.id);
                              return (
                                <label
                                  key={s.id}
                                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                                    isChecked ? 'bg-indigo-50/50 shadow-2xs border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedEnrollSubjectIds(prev =>
                                          prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                        );
                                      }}
                                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                    />
                                    <div>
                                      <span className="font-semibold text-slate-900">{s.name}</span>
                                      <span className="text-[10px] font-mono text-slate-500 ml-2">({s.code})</span>
                                    </div>
                                  </div>
                                  {s.is_core && (
                                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-200/60 px-1.5 py-0.5 rounded">
                                      Compulsory
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Compulsory Subjects */}
                      {compulsoryGroupForEnroll && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Compulsory Subjects</span>
                          </div>
                          <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                            {compulsoryGroupForEnroll.subject_ids.map(subId => {
                              const sub = subjects.find(s => s.id === subId);
                              const isChecked = selectedEnrollSubjectIds.includes(subId);
                              return (
                                <label
                                  key={subId}
                                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                                    isChecked ? 'bg-emerald-50/50 shadow-2xs border border-emerald-200' : 'hover:bg-slate-50 border border-transparent'
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
                                    Compulsory
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
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            <span>{eg.name} Group</span>
                          </div>
                          <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                            {eg.subject_ids.map(subId => {
                              const sub = subjects.find(s => s.id === subId);
                              const isChecked = selectedEnrollSubjectIds.includes(subId);
                              return (
                                <label
                                  key={subId}
                                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                                    isChecked ? 'bg-indigo-50/50 shadow-2xs border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'
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

              {/* 2. Student Identity & Demographics */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Personal Details & Identity
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Student personal details, photograph, contact, and address.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Top Section: Photo + Core Identity */}
                <div className="flex flex-col sm:flex-row items-start gap-4 p-4 bg-slate-50/70 rounded-xl border border-slate-200">
                  {/* Passport Photo Box */}
                  <div className="flex flex-col items-center gap-2 shrink-0 self-center sm:self-start">
                    <div className="w-28 h-36 rounded-lg border border-slate-300 bg-white flex items-center justify-center overflow-hidden shadow-2xs relative">
                      {photoUrl ? (
                        <img src={photoUrl} alt="Student Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 p-2 text-center">
                          <Camera className="w-6 h-6 mb-1 text-slate-400" />
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Passport Photo</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">3:4 Ratio</span>
                        </div>
                      )}
                    </div>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-md text-xs font-semibold border border-slate-300 shadow-2xs transition-colors">
                      <Camera className="w-3 h-3 text-slate-500" />
                      <span>{photoUrl ? 'Change' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAdmissionPhotoUpload}
                        className="hidden"
                      />
                    </label>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        className="text-[10px] text-rose-600 hover:underline font-semibold"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>

                  {/* Core Identity Form Inputs */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Student Full Legal Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={enrollForm.full_name}
                        onChange={e => setEnrollForm(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder=""
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Date of Birth <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={dob}
                        onChange={e => setDob(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Gender <span className="text-rose-500">*</span>
                      </label>
                      <ModernSelect
                        value={gender}
                        onChange={val => setGender(val)}
                        placeholder="Select Gender"
                        options={[
                          { value: '', label: 'Select Gender' },
                          { value: 'male', label: 'Male' },
                          { value: 'female', label: 'Female' },
                          { value: 'other', label: 'Other' },
                        ]}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Student B-Form or CNIC
                      </label>
                      <input
                        type="text"
                        value={studentBForm}
                        onChange={e => setStudentBForm(e.target.value)}
                        placeholder=""
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Blood Group
                      </label>
                      <ModernSelect
                        value={bloodGroup}
                        onChange={val => setBloodGroup(val)}
                        placeholder="Select Blood Group"
                        options={[
                          { value: '', label: 'Select Blood Group' },
                          { value: 'A+', label: 'A+' },
                          { value: 'A-', label: 'A-' },
                          { value: 'B+', label: 'B+' },
                          { value: 'B-', label: 'B-' },
                          { value: 'O+', label: 'O+' },
                          { value: 'O-', label: 'O-' },
                          { value: 'AB+', label: 'AB+' },
                          { value: 'AB-', label: 'AB-' },
                        ]}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Religion
                      </label>
                      <ModernSelect
                        value={religion}
                        onChange={val => setReligion(val)}
                        placeholder="Select Religion"
                        options={[
                          { value: '', label: 'Select Religion' },
                          { value: 'Muslim', label: 'Muslim' },
                          { value: 'Christian', label: 'Christian' },
                          { value: 'Hindu', label: 'Hindu' },
                          { value: 'Sikh', label: 'Sikh' },
                          { value: 'Other', label: 'Other' },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Residential & Contact Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Student Mobile (Optional)
                    </label>
                    <input
                      type="text"
                      value={enrollForm.phone}
                      onChange={e => {
                        const val = e.target.value;
                        setEnrollForm(prev => ({ ...prev, phone: val }));
                        if (studentWhatsappSameAsPhone) {
                          setStudentWhatsapp(val);
                        }
                      }}
                      placeholder=""
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-700">
                        Student WhatsApp
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={studentWhatsappSameAsPhone}
                          onChange={e => {
                            const checked = e.target.checked;
                            setStudentWhatsappSameAsPhone(checked);
                            if (checked) {
                              setStudentWhatsapp(enrollForm.phone);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Same as Mobile</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={studentWhatsapp}
                      onChange={e => {
                        setStudentWhatsapp(e.target.value);
                        setStudentWhatsappSameAsPhone(false);
                      }}
                      placeholder=""
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Student Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={enrollForm.email}
                      onChange={e => setEnrollForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder=""
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Residential Address
                    </label>
                    <input
                      type="text"
                      value={residentialAddress}
                      onChange={e => setResidentialAddress(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Previous School (Optional)
                    </label>
                    <input
                      type="text"
                      value={previousSchool}
                      onChange={e => setPreviousSchool(e.target.value)}
                      placeholder=""
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Parent, Family & Kinship Records */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Family & Parent Records
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Parent or guardian details and emergency contact.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs font-bold text-slate-600">Primary Contact:</span>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setPrimaryContact('father');
                          if (whatsappSameAsCalling && fatherPhone) setGuardianWhatsapp(fatherPhone);
                        }}
                        className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                          primaryContact === 'father' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Father
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrimaryContact('mother');
                          if (whatsappSameAsCalling && motherPhone) setGuardianWhatsapp(motherPhone);
                        }}
                        className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                          primaryContact === 'mother' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Mother
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrimaryContact('guardian');
                          if (whatsappSameAsCalling && enrollForm.guardian_phone) setGuardianWhatsapp(enrollForm.guardian_phone);
                        }}
                        className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                          primaryContact === 'guardian' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Legal Guardian
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sibling Kinship Quick-Link Bar */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      Enrolled Sibling Link & Quick Sync
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Link an enrolled sibling to autofill family details
                    </span>
                  </div>

                  {selectedSibling ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-emerald-950">{selectedSibling.full_name}</span>
                          <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Adm: {selectedSibling.admission_number}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800">
                          Parent: {selectedSibling.father_name || selectedSibling.guardian_name} | Phone: {selectedSibling.guardian_phone}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopySiblingDetails(selectedSibling)}
                          className="text-[11px] text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 font-bold px-2.5 py-1 rounded shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                          title="Copy father, mother, address, city, and emergency contacts"
                        >
                          <Copy className="w-3 h-3 text-indigo-600" />
                          <span>Copy Family Info & Address</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSiblingStudentId('');
                            setSiblingSearchQuery('');
                          }}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          Unlink
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Auto-suggested matching siblings */}
                      {suggestedSiblings.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Suggested Siblings:
                          </span>
                          <div className="space-y-1">
                            {suggestedSiblings.map(s => (
                              <div
                                key={s.id}
                                className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 text-xs"
                              >
                                <div>
                                  <span className="font-bold text-slate-900">{s.full_name}</span>
                                  <span className="text-[10px] font-mono text-slate-500 ml-2">
                                    (Adm: {s.admission_number})
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-2">
                                    Parent: {s.father_name || s.guardian_name} ({s.guardian_phone})
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSiblingStudentId(s.id)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Link Sibling
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Manual Search */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={siblingSearchQuery}
                          onChange={e => setSiblingSearchQuery(e.target.value)}
                          placeholder="Search by student name, admission #, or CNIC..."
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        {siblingSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setSiblingSearchQuery('')}
                            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {filteredSiblingOptions.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-lg shadow-sm divide-y divide-slate-100 max-h-48 overflow-y-auto">
                          {filteredSiblingOptions.map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setSiblingStudentId(s.id);
                                setSiblingSearchQuery('');
                              }}
                              className="p-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer text-xs transition-colors"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{s.full_name}</span>
                                <span className="text-[10px] font-mono text-slate-500 ml-2">
                                  Adm: {s.admission_number}
                                </span>
                                <span className="text-[10px] text-slate-400 block font-sans">
                                  Father/Guardian: {s.father_name || s.guardian_name} • Phone: {s.guardian_phone}
                                </span>
                              </div>
                              <span className="text-xs text-indigo-600 font-bold">Select</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Parents & Guardian Dossier */}
                {primaryContact === 'guardian' ? (
                  <div className="space-y-4">
                    {/* Legal Guardian Card (When parents are deceased, absent, or relative is primary) */}
                    <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 ring-1 ring-indigo-200 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-indigo-200/80">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                            Legal Guardian Particulars
                          </span>
                          <p className="text-[11px] text-slate-500">
                            Guardian particulars when parents are deceased or unavailable.
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                          Primary Contact
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Guardian Full Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={enrollForm.guardian_name}
                            onChange={e => setEnrollForm(prev => ({ ...prev, guardian_name: e.target.value }))}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Guardian Relationship <span className="text-rose-500">*</span>
                          </label>
                          <ModernSelect
                            value={guardianRelation}
                            onChange={val => setGuardianRelation(val)}
                            placeholder="Select Relationship"
                            options={[
                              { value: '', label: 'Select Relationship' },
                              { value: 'Father', label: 'Father' },
                              { value: 'Mother', label: 'Mother' },
                              { value: 'Uncle', label: 'Uncle' },
                              { value: 'Aunt', label: 'Aunt' },
                              { value: 'Brother', label: 'Brother' },
                              { value: 'Sister', label: 'Sister' },
                              { value: 'Grandfather', label: 'Grandfather' },
                              { value: 'Grandmother', label: 'Grandmother' },
                              { value: 'Legal Guardian', label: 'Legal Guardian' },
                              { value: 'Orphanage/Sponsor', label: 'Trustee or Sponsor' },
                              { value: 'Other', label: 'Other' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Guardian CNIC <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={enrollForm.guardian_id_card || ''}
                            onChange={e => setEnrollForm(prev => ({ ...prev, guardian_id_card: e.target.value }))}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
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
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-slate-700">
                              Guardian WhatsApp
                            </label>
                            <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
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
                              <span>Same as Mobile</span>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={guardianWhatsapp}
                            onChange={e => {
                              setGuardianWhatsapp(e.target.value);
                              setWhatsappSameAsCalling(false);
                            }}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Guardian Email Address (Optional)
                          </label>
                          <input
                            type="email"
                            value={enrollForm.guardian_email || ''}
                            onChange={e => setEnrollForm(prev => ({ ...prev, guardian_email: e.target.value }))}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Guardian Occupation
                          </label>
                          <input
                            type="text"
                            value={fatherOccupation}
                            onChange={e => setFatherOccupation(e.target.value)}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Record for Biological Parents if Deceased or Unavailable */}
                    <details className="bg-slate-50/60 p-3.5 rounded-xl border border-slate-200 text-xs group">
                      <summary className="font-bold text-slate-700 cursor-pointer select-none flex items-center justify-between">
                        <span>Biological Parents Record (Optional)</span>
                        <span className="text-[10px] text-slate-400 font-normal group-open:hidden">+ Show details</span>
                      </summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Father Name</label>
                          <input
                            type="text"
                            value={fatherName}
                            onChange={e => setFatherName(e.target.value)}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Mother Name</label>
                          <input
                            type="text"
                            value={motherName}
                            onChange={e => setMotherName(e.target.value)}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Father Details */}
                    <div className={`p-4 rounded-xl border transition-colors ${
                      primaryContact === 'father' ? 'bg-indigo-50/40 border-indigo-300 ring-1 ring-indigo-200' : 'bg-slate-50/70 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/80">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Father's Particulars
                        </span>
                        {primaryContact === 'father' && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                            Primary Contact
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Father Full Name {primaryContact === 'father' && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            type="text"
                            required={primaryContact === 'father'}
                            value={fatherName}
                            onChange={e => setFatherName(e.target.value)}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Father CNIC {primaryContact === 'father' && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            type="text"
                            required={primaryContact === 'father'}
                            value={fatherCnic}
                            onChange={e => setFatherCnic(e.target.value)}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Father Mobile {primaryContact === 'father' && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            type="text"
                            required={primaryContact === 'father'}
                            value={fatherPhone}
                            onChange={e => {
                              const val = e.target.value;
                              setFatherPhone(val);
                              if (primaryContact === 'father' && whatsappSameAsCalling) {
                                setGuardianWhatsapp(val);
                              }
                            }}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        {/* Integrated WhatsApp & Email directly inside Father's card when primary */}
                        {primaryContact === 'father' && (
                          <>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-slate-700">
                                  Father WhatsApp
                                </label>
                                <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={whatsappSameAsCalling}
                                    onChange={e => {
                                      const checked = e.target.checked;
                                      setWhatsappSameAsCalling(checked);
                                      if (checked) {
                                        setGuardianWhatsapp(fatherPhone);
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span>Same as Mobile</span>
                                </label>
                              </div>
                              <input
                                type="text"
                                value={guardianWhatsapp}
                                onChange={e => {
                                  setGuardianWhatsapp(e.target.value);
                                  setWhatsappSameAsCalling(false);
                                }}
                                placeholder=""
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                Father Email Address (Optional)
                              </label>
                              <input
                                type="email"
                                value={enrollForm.guardian_email || ''}
                                onChange={e => setEnrollForm(prev => ({ ...prev, guardian_email: e.target.value }))}
                                placeholder=""
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Father Occupation
                          </label>
                          <input
                            type="text"
                            value={fatherOccupation}
                            onChange={e => setFatherOccupation(e.target.value)}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Mother Details */}
                    <div className={`p-4 rounded-xl border transition-colors ${
                      primaryContact === 'mother' ? 'bg-indigo-50/40 border-indigo-300 ring-1 ring-indigo-200' : 'bg-slate-50/70 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/80">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Mother's Particulars
                        </span>
                        {primaryContact === 'mother' && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                            Primary Contact
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Mother Full Name {primaryContact === 'mother' && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            type="text"
                            required={primaryContact === 'mother'}
                            value={motherName}
                            onChange={e => setMotherName(e.target.value)}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Mother CNIC {primaryContact === 'mother' && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            type="text"
                            required={primaryContact === 'mother'}
                            value={motherCnic}
                            onChange={e => setMotherCnic(e.target.value)}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Mother Mobile {primaryContact === 'mother' && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            type="text"
                            required={primaryContact === 'mother'}
                            value={motherPhone}
                            onChange={e => {
                              const val = e.target.value;
                              setMotherPhone(val);
                              if (primaryContact === 'mother' && whatsappSameAsCalling) {
                                setGuardianWhatsapp(val);
                              }
                            }}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        {/* Integrated WhatsApp & Email directly inside Mother's card when primary */}
                        {primaryContact === 'mother' && (
                          <>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-slate-700">
                                  Mother WhatsApp
                                </label>
                                <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={whatsappSameAsCalling}
                                    onChange={e => {
                                      const checked = e.target.checked;
                                      setWhatsappSameAsCalling(checked);
                                      if (checked) {
                                        setGuardianWhatsapp(motherPhone);
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span>Same as Mobile</span>
                                </label>
                              </div>
                              <input
                                type="text"
                                value={guardianWhatsapp}
                                onChange={e => {
                                  setGuardianWhatsapp(e.target.value);
                                  setWhatsappSameAsCalling(false);
                                }}
                                placeholder=""
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                Mother Email Address (Optional)
                              </label>
                              <input
                                type="email"
                                value={enrollForm.guardian_email || ''}
                                onChange={e => setEnrollForm(prev => ({ ...prev, guardian_email: e.target.value }))}
                                placeholder=""
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Mother Occupation
                          </label>
                          <input
                            type="text"
                            value={motherOccupation}
                            onChange={e => setMotherOccupation(e.target.value)}
                            placeholder=""
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Emergency Contact Details */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Emergency Contact (Optional)
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Emergency Contact Person
                      </label>
                      <input
                        type="text"
                        value={emergencyContactName}
                        onChange={e => setEmergencyContactName(e.target.value)}
                        placeholder=""
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Emergency Contact Phone
                      </label>
                      <input
                        type="text"
                        value={emergencyContactPhone}
                        onChange={e => setEmergencyContactPhone(e.target.value)}
                        placeholder=""
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Relationship to Student
                      </label>
                      <ModernSelect
                        value={emergencyContactRelation}
                        onChange={val => setEmergencyContactRelation(val)}
                        placeholder="Select Relationship"
                        options={[
                          { value: '', label: 'Select Relationship' },
                          { value: 'Uncle', label: 'Uncle' },
                          { value: 'Aunt', label: 'Aunt' },
                          { value: 'Mother', label: 'Mother' },
                          { value: 'Father', label: 'Father' },
                          { value: 'Brother', label: 'Brother' },
                          { value: 'Sister', label: 'Sister' },
                          { value: 'Grandfather', label: 'Grandfather' },
                          { value: 'Grandmother', label: 'Grandmother' },
                          { value: 'Relative', label: 'Relative' },
                          { value: 'Neighbor', label: 'Neighbor' },
                          { value: 'Family Friend', label: 'Family Friend' },
                          { value: 'Other', label: 'Other' },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Document Submission Checklist (Only added heads are shown) */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Document Verification Checklist
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Verification status of physical documents, certificates, and hardcopy records on file (status tracking only, no file uploads).
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingDocHead(true)}
                    className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Manage Requirements</span>
                  </button>
                </div>

                {/* Only added heads are shown in this space */}
                {configuredDocHeads.length === 0 ? (
                  <div className="p-4 bg-slate-50/70 rounded-lg border border-slate-200 text-center text-xs text-slate-500 space-y-2">
                    <p>No document checklist requirements configured for this academy.</p>
                    <button
                      type="button"
                      onClick={() => setIsAddingDocHead(true)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-300 rounded-lg shadow-2xs inline-flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Configure Document Requirements</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {configuredDocHeads.map((head: DocumentChecklistHead) => {
                      const currentStatus = submittedDocuments[head.code] || 'pending';
                      return (
                        <div
                          key={head.code}
                          className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 space-y-2.5 flex flex-col justify-between hover:border-slate-300 transition-colors shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex items-start gap-1.5 flex-1 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span className="text-xs font-bold text-slate-800 truncate" title={head.title}>
                                {head.title}
                              </span>
                            </div>
                            <div className="shrink-0">
                              {head.is_required ? (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  Mandatory
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  Optional
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-slate-200 text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() => setSubmittedDocuments(prev => ({ ...prev, [head.code]: 'submitted' }))}
                              className={`py-1 rounded text-center transition-colors cursor-pointer ${
                                currentStatus === 'submitted'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                            >
                              Submitted
                            </button>
                            <button
                              type="button"
                              onClick={() => setSubmittedDocuments(prev => ({ ...prev, [head.code]: 'pending' }))}
                              className={`py-1 rounded text-center transition-colors cursor-pointer ${
                                currentStatus === 'pending'
                                  ? 'bg-amber-500 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                            >
                              Pending
                            </button>
                            <button
                              type="button"
                              onClick={() => setSubmittedDocuments(prev => ({ ...prev, [head.code]: 'exempted' }))}
                              className={`py-1 rounded text-center transition-colors cursor-pointer ${
                                currentStatus === 'exempted'
                                  ? 'bg-slate-700 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                            >
                              Exempted
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 5. Additional Institutional Fields (if configured) */}
              {customFields.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Additional Profile Fields
                    </h3>
                    <p className="text-[11px] text-slate-500">Custom registration fields.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                    {customFields.map(field => (
                      <div key={field.id} className={field.field_type === 'select' ? '' : 'sm:col-span-2'}>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
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
                        ) : field.field_type === 'checkbox' ? (
                          <label className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!enrollForm.custom_field_values[field.field_key]}
                              onChange={e => {
                                const checked = e.target.checked;
                                setEnrollForm(prev => ({
                                  ...prev,
                                  custom_field_values: {
                                    ...prev.custom_field_values,
                                    [field.field_key]: checked,
                                  },
                                }));
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span className="text-xs text-slate-700 font-medium">Yes / Confirmed</span>
                          </label>
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
            </div>

            {/* =================================================================== */}
            {/* RIGHT COLUMN: STICKY FINANCIAL & ACTION DESK (4 COLUMNS)           */}
            {/* =================================================================== */}
            <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-4">

              {/* Fee Schedule & Terms Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Fee Schedule & Terms
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    {billingMode === 'monthly' ? 'Monthly' : billingMode === 'quarterly' ? 'Quarterly' : billingMode === 'one_time' ? 'One-Time' : 'Installment'}
                  </span>
                </div>

                {/* Billing Mode Switcher */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700">Billing Mode & Terms</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setBillingMode('monthly')}
                      className={`py-1.5 px-2 rounded-md font-bold text-center transition-all cursor-pointer text-[11px] ${
                        billingMode === 'monthly' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingMode('quarterly')}
                      className={`py-1.5 px-2 rounded-md font-bold text-center transition-all cursor-pointer text-[11px] ${
                        billingMode === 'quarterly' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Quarterly
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingMode('one_time')}
                      className={`py-1.5 px-2 rounded-md font-bold text-center transition-all cursor-pointer text-[11px] ${
                        billingMode === 'one_time' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      One-Time
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingMode('installment')}
                      className={`py-1.5 px-2 rounded-md font-bold text-center transition-all cursor-pointer text-[11px] ${
                        billingMode === 'installment' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Installment
                    </button>
                  </div>
                </div>

                {/* Tuition Fee */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-xs">
                    {billingMode === 'monthly' ? 'Monthly Tuition (PKR)' : billingMode === 'quarterly' ? 'Quarterly Tuition (PKR)' : 'Total Course Tuition / Package Fee (PKR)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 font-mono">PKR</span>
                    <input
                      type="number"
                      min={0}
                      value={admissionTuition === '' ? '' : admissionTuition}
                      onChange={e => setAdmissionTuition(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full pl-12 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder=""
                    />
                  </div>
                </div>

                {/* Additional Admission Fee Heads */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-800 font-bold text-xs">Additional Fee Heads</label>
                    <span className="text-[10px] text-slate-400">One-time charges</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={headToAdd}
                      onChange={e => setHeadToAdd(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500 truncate"
                    >
                      <option value="">Select Fee Head</option>
                      {availableAdmissionHeads.map(head => (
                        <option key={head.id} value={head.id}>
                          {head.name} - PKR {head.default_amount}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAddAdmissionHead(headToAdd)}
                      disabled={!headToAdd}
                      className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-40 flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>

                  {selectedAdmissionHeads.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200 overflow-hidden">
                      {selectedAdmissionHeads.map(item => {
                        const head = feeHeads.find(h => h.id === item.fee_head_id);
                        return (
                          <div key={item.fee_head_id} className="p-2 flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-800 truncate" title={head?.name}>{head?.name || 'Fee Head'}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-slate-400 font-mono">PKR</span>
                              <input
                                type="number"
                                min="0"
                                value={item.amount === 0 ? '' : item.amount}
                                placeholder=""
                                onChange={e => handleUpdateAdmissionHeadAmount(item.fee_head_id, e.target.value)}
                                onFocus={e => e.target.select()}
                                className="w-20 px-1.5 py-0.5 text-right font-mono font-bold text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveAdmissionHead(item.fee_head_id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                title="Remove Fee Head"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Scholarship / Concession Category */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      Scholarship or Concession
                    </label>
                    {discountAmount > 0 && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        -PKR {discountAmount.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <select
                    value={concessionType}
                    onChange={e => {
                      const type = e.target.value as any;
                      setConcessionType(type);
                      const kRule = tenant?.settings?.fee_rules?.kinship_rules;
                      if (type === 'kinship') {
                        if (kRule && kRule.enabled) {
                          setConcessionMode('percentage');
                          setConcessionVal(kRule.discount_percentage);
                          setConcessionReason(kRule.description || `Kinship concession (${kRule.discount_percentage}%)`);
                        } else {
                          setConcessionMode('percentage');
                          setConcessionVal(20);
                          setConcessionReason('Kinship concession policy');
                        }
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
                    <option value="kinship">
                      Kinship or Sibling {tenant?.settings?.fee_rules?.kinship_rules?.enabled ? `(${tenant.settings.fee_rules.kinship_rules.discount_percentage}%)` : '(20%)'}
                    </option>
                    <option value="merit">Academic Merit (25%)</option>
                    <option value="hardship">Financial Hardship (30%)</option>
                    <option value="staff">Staff Child (50%)</option>
                    <option value="custom">Custom Concession</option>
                  </select>

                  {concessionType !== 'none' && (
                    <div className="space-y-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1 text-[10px]">Discount Value</label>
                        <div className="flex gap-1.5">
                          <select
                            value={concessionMode}
                            onChange={e => setConcessionMode(e.target.value as any)}
                            className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                          >
                            <option value="percentage">%</option>
                            <option value="flat">PKR</option>
                          </select>
                          <input
                            type="number"
                            min={0}
                            value={concessionVal === '' ? '' : concessionVal}
                            onChange={e => setConcessionVal(e.target.value === '' ? '' : Number(e.target.value))}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                            placeholder=""
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-medium mb-1 text-[10px]">
                          Approval Justification <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={concessionReason}
                          onChange={e => setConcessionReason(e.target.value)}
                          placeholder=""
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>

                      {concessionType === 'kinship' && !selectedSibling && (
                        <p className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                          Sibling not linked in Family Records.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Installment Plan Breakdown (if installment mode) */}
                {billingMode === 'installment' && (
                  <div className="pt-2 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-800 font-bold text-xs">Installment Schedule</label>
                      <select
                        value={installmentCount}
                        onChange={e => setInstallmentCount(Number(e.target.value))}
                        className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-800"
                      >
                        <option value={2}>2 Installments</option>
                        <option value={3}>3 Installments</option>
                        <option value={4}>4 Installments</option>
                        <option value={5}>5 Installments</option>
                        <option value={6}>6 Installments</option>
                      </select>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                      <table className="w-full">
                        <thead className="bg-slate-50 text-[10px] uppercase font-mono text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-1.5 px-2 text-left">#</th>
                            <th className="py-1.5 px-2 text-left">Due Date</th>
                            <th className="py-1.5 px-2 text-right">PKR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {installments.map((ins, idx) => (
                            <tr key={idx} className={idx === 0 ? 'bg-indigo-50/40' : ''}>
                              <td className="py-1.5 px-2 font-sans font-medium text-slate-800">
                                Ins {ins.installment_number}
                                {idx === 0 && <span className="text-[10px] text-indigo-700 font-semibold block">Opening</span>}
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="date"
                                  value={ins.due_date}
                                  onChange={e => handleUpdateInstallmentDueDate(idx, e.target.value)}
                                  className="w-full px-1 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  value={ins.amount}
                                  onChange={e => handleUpdateInstallmentAmount(idx, Number(e.target.value) || 0)}
                                  className="w-20 px-1 py-0.5 bg-white border border-slate-200 rounded text-right font-bold font-mono text-[11px]"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200 text-[11px]">
                          <tr>
                            <td colSpan={2} className="py-1.5 px-2 font-bold text-slate-700 font-sans">
                              Total Sum:
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                              {installmentTotalSum.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {installmentTotalSum !== netMonthlyTuition && (
                      <p className="text-[10px] text-rose-600 font-bold">
                        Discrepancy: PKR {Math.abs(netMonthlyTuition - installmentTotalSum).toLocaleString()} from tuition
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Opening Challan & Payment Capture Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Opening Challan & Desk Payment
                  </h3>
                </div>

                {/* Real-Time Challan Summary Strip */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Net Course / Monthly Tuition:</span>
                    <span className="font-mono font-bold text-slate-800">PKR {netMonthlyTuition.toLocaleString()}</span>
                  </div>
                  {selectedAdmissionHeads
                    .filter(item => (Number(item.amount) || 0) > 0)
                    .map(item => {
                      const head = feeHeads.find(h => h.id === item.fee_head_id);
                      return (
                        <div key={item.fee_head_id} className="flex items-center justify-between text-xs text-slate-600">
                          <span className="truncate pr-2">{head?.name || 'Fee Head'}:</span>
                          <span className="font-mono font-bold text-slate-800 shrink-0">
                            +PKR {(Number(item.amount) || 0).toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  {billingMode === 'installment' && (
                    <div className="flex items-center justify-between text-xs text-indigo-700">
                      <span>Installment 1 of {installmentCount}:</span>
                      <span className="font-mono font-bold">PKR {(installments[0]?.amount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-bold text-slate-900">
                        {billingMode === 'installment' ? 'First Challan Due:' : 'Opening Challan Total:'}
                      </span>
                      <span className="text-[10px] text-slate-400">Official student copy</span>
                    </div>
                    <span className="text-xl font-bold text-indigo-950 font-mono">
                      PKR {firstChallanDue.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Generate Challan Checkbox */}
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={generateFirstChallan}
                    onChange={e => setGenerateFirstChallan(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 mt-0.5"
                  />
                  <span className="text-slate-700 text-xs font-semibold leading-tight">
                    {billingMode === 'installment'
                      ? 'Generate opening installment invoice and fee challan immediately'
                      : billingMode === 'quarterly'
                      ? 'Generate quarterly invoice and fee challan immediately'
                      : billingMode === 'one_time'
                      ? 'Generate full course package invoice and fee challan immediately'
                      : 'Generate first month invoice and fee challan immediately'}
                  </span>
                </label>

                {/* Desk Cashier Payment Collection */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={collectInitialPayment}
                      onChange={e => {
                        const checked = e.target.checked;
                        setCollectInitialPayment(checked);
                        if (checked && (initialPaymentAmount === '' || initialPaymentAmount === 0)) {
                          setInitialPaymentAmount(firstChallanDue);
                        }
                      }}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="text-slate-800 text-xs font-bold flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                      Collect Initial Payment at Desk
                    </span>
                  </label>

                  {collectInitialPayment && (
                    <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Amount Collected (PKR) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={firstChallanDue || undefined}
                          required={collectInitialPayment}
                          value={initialPaymentAmount === '' ? '' : initialPaymentAmount}
                          onChange={e => setInitialPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Payment Method <span className="text-rose-500">*</span>
                        </label>
                        <ModernSelect
                          value={initialPaymentMethod}
                          onChange={val => setInitialPaymentMethod(val as any)}
                          options={[
                            { value: 'cash', label: 'Cash Counter' },
                            { value: 'meezan_bank', label: 'Bank Transfer (Meezan IBFT)' },
                            { value: 'easypaisa', label: 'EasyPaisa' },
                            { value: 'jazzcash', label: 'JazzCash' },
                            { value: 'cheque', label: 'Bank Cheque' },
                          ]}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Receipt Reference Note
                        </label>
                        <input
                          type="text"
                          value={initialPaymentReference}
                          onChange={e => setInitialPaymentReference(e.target.value)}
                          placeholder=""
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2.5">
                <button
                  type="submit"
                  disabled={isSubmittingEnrollment || isSelectedBatchFull}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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

                <button
                  type="button"
                  onClick={() => setActiveTab('directory')}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center"
                >
                  Cancel & Return
                </button>

                {isSelectedBatchFull && (
                  <p className="text-[10px] text-rose-600 text-center font-bold">
                    Section at maximum capacity. Increase capacity to enroll.
                  </p>
                )}
              </div>
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
        <StudentProfileModal
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
      {admitInquiryModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 ring-1 ring-slate-900/10 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Admit Inquiring Student</span>
              </div>
              <button
                type="button"
                onClick={() => setAdmitInquiryModal(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Enroll candidate into an academic class or batch.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {(() => {
                    const b = batches.find(x => x.id === admitBatchId);
                    const isSec = b ? (b.cohort_type || (/section/i.test(b.name) ? 'section' : 'batch')) === 'section' : false;
                    return isSec ? 'Target Section' : 'Target Section or Batch';
                  })()}
                </label>
                <select
                  value={admitBatchId}
                  onChange={e => {
                    const newBatchId = e.target.value;
                    setAdmitBatchId(newBatchId);
                    const b = batches.find(x => x.id === newBatchId);
                    if (b) {
                      const prog = programs.find(p => p.id === b.program_id);
                      const tuition = b.fee_amount ?? b.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount ?? prog?.fee_schedule?.find(f => f.fee_type === 'tuition')?.amount ?? 0;
                      setAdmitTuitionFee(tuition || '');
                      const admFee = b.fee_schedule?.find(f => f.fee_type === 'admission')?.amount ?? prog?.fee_schedule?.find(f => f.fee_type === 'admission')?.amount ?? 0;
                      setAdmitAdmissionFee(admFee || '');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {batches.map(b => {
                    const isFull = (b.current_enrollment || 0) >= b.max_capacity;
                    return (
                      <option key={b.id} value={b.id} disabled={isFull}>
                        {getProgramName(b.program_id)} • {b.name} ({b.shift.toUpperCase()} • {isFull ? '[FULL] ' : ''}{b.current_enrollment} of {b.max_capacity})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Elective Group (Optional)</label>
                <select
                  value={admitElectiveGroupId}
                  onChange={e => setAdmitElectiveGroupId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Compulsory Subjects Only --</option>
                  {subjectGroups.filter(g => g.type === 'elective_track').map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {admitBatchId && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
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

              {/* Guardian CNIC */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Guardian CNIC
                </label>
                <input
                  type="text"
                  value={admitGuardianCnic}
                  onChange={e => setAdmitGuardianCnic(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Fee Breakdown Schedule */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Fee Schedule & First Challan</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold font-mono">
                    Auto-Issues Fee Challan
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
                    <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Concession (PKR)</label>
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
                      placeholder=""
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
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* NEW INQUIRY MODAL                                                        */}
      {/* ========================================================================= */}
      {showNewInquiryModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 ring-1 ring-slate-900/10 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Log Prospective Candidate Inquiry</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNewInquiryModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInquiry} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Guardian Name</label>
                  <input
                    type="text"
                    value={newInquiryForm.guardian_name}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, guardian_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Guardian Phone</label>
                  <input
                    type="text"
                    value={newInquiryForm.guardian_phone}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, guardian_phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Guardian CNIC</label>
                <input
                  type="text"
                  value={newInquiryForm.guardian_id_card}
                  onChange={e => setNewInquiryForm(prev => ({ ...prev, guardian_id_card: e.target.value }))}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Program of Interest</label>
                  <select
                    value={newInquiryForm.program_id}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, program_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Program --</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Lead Source</label>
                  <select
                    value={newInquiryForm.source}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, source: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Walk-in">Walk-in Desk</option>
                    <option value="Phone Call">Phone Call</option>
                    <option value="Referral">Student Referral</option>
                    <option value="Social Media">Social Media or Website</option>
                    <option value="Banner">Banner or Pamphlet</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Next Follow-Up Date</label>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Previous Institution</label>
                  <input
                    type="text"
                    value={newInquiryForm.previous_school}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, previous_school: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Previous Marks or Percentage</label>
                  <input
                    type="text"
                    value={newInquiryForm.previous_marks}
                    onChange={e => setNewInquiryForm(prev => ({ ...prev, previous_marks: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Discussion Notes</label>
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
        </div>,
        document.body
      )}

      {/* Bulk ID Card Printing Modal */}
      {showBulkIdCardsModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150 no-sheet-overlay">
          <div className="bg-white rounded-2xl w-full max-w-5xl p-4 sm:p-6 shadow-2xl border border-slate-200 ring-1 ring-slate-900/10 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <CreditCard className="w-4 h-4 text-slate-700" />
                <span>Student ID Cards</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkIdCardsModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
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
        </div>,
        document.body
      )}
      {/* Native Mobile Student Action Sheet */}
      {mobileActionStudent && createPortal(
        <div
          className="fixed inset-0 z-[9995] flex items-end justify-center p-0 m-0 bg-slate-900/60 backdrop-blur-xs mobile-sheet"
          onClick={e => {
            if (e.target === e.currentTarget) setMobileActionStudent(null);
          }}
          data-testid="student-action-sheet"
        >
          <div className="bg-white rounded-t-3xl border-t border-slate-300 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col mobile-sheet-card max-h-[85dvh]">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-sm truncate">
                  {mobileActionStudent.full_name}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  Adm #{mobileActionStudent.admission_number || '—'} · {getProgramName(mobileActionStudent.program_id)}
                </p>
              </div>
              <button
                type="button"
                data-testid="student-action-sheet-close"
                onClick={() => setMobileActionStudent(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 space-y-1.5 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  const s = mobileActionStudent;
                  setMobileActionStudent(null);
                  setSelectedDirectoryStudentIds(new Set([s.id]));
                  setShowBulkIdCardsModal(true);
                }}
                className="w-full h-9 px-3 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-800 hover:bg-slate-100 active:bg-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-slate-600 shrink-0" />
                <span>Print Official ID Card</span>
              </button>

              {canArchiveStudents && (
                <button
                  type="button"
                  onClick={() => {
                    const s = mobileActionStudent;
                    setMobileActionStudent(null);
                    setStudentToArchive(s);
                  }}
                  className="w-full h-9 px-3 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 active:bg-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Archive className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Archive Student Record</span>
                </button>
              )}

              {canDeleteStudents && (
                <button
                  type="button"
                  onClick={() => {
                    const s = mobileActionStudent;
                    setMobileActionStudent(null);
                    setStudentToDelete(s);
                    setDeleteReason('Administrative student deletion');
                    setDeleteForce(false);
                    setDeleteRequiresForce(false);
                    setDeleteErrorMessage(null);
                  }}
                  className="w-full h-9 px-3 py-1.5 rounded-lg text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 active:bg-rose-100 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Delete Student Permanently</span>
                </button>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50/70 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setMobileActionStudent(null)}
                className="w-full h-8.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Contact Options Modal for Student & Guardian */}
      {contactStudentModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-200 ring-1 ring-slate-900/10 space-y-4 mobile-sheet-card max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Contact Options</h3>
                <p className="text-[11px] text-slate-500 font-medium">{contactStudentModal.full_name} • Adm: {contactStudentModal.admission_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setContactStudentModal(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
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
        </div>,
        document.body
      )}

      {/* Branded WhatsApp Fee Receipt & Admission Slip Modal */}
      {receiptModalData && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150 no-sheet-overlay">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 ring-1 ring-slate-900/10 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Admission Confirmed & Fee Receipt</span>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalData(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #admission-receipt-slip, #admission-receipt-slip * {
                  visibility: visible !important;
                }
                #admission-receipt-slip {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  border: 1px solid #cbd5e1 !important;
                  background-color: #ffffff !important;
                  box-shadow: none !important;
                  padding: 20px !important;
                  margin: 0 !important;
                }
              }
            `}</style>

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
                  <span className="text-slate-500 block">Admission #:</span>
                  <span className="font-mono font-bold text-slate-900">{receiptModalData.student.admission_number}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Guardian:</span>
                  <span className="text-slate-800 font-medium">
                    {receiptModalData.student.guardian_name} {receiptModalData.student.guardian_relation ? `(${receiptModalData.student.guardian_relation})` : ''}
                  </span>
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
                        <td className="py-1.5 px-3">{item.name}</td>
                        <td className="py-1.5 px-3 text-right font-bold">PKR {item.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                    <tr>
                      <td className="py-1.5 px-3">Total Billed</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-900">PKR {receiptModalData.totalDue.toLocaleString()}</td>
                    </tr>
                    {receiptModalData.amountPaid > 0 && (
                      <tr>
                        <td className="py-1.5 px-3 text-emerald-700">Amount Received</td>
                        <td className="py-1.5 px-3 text-right font-mono text-emerald-700">PKR {receiptModalData.amountPaid.toLocaleString()}</td>
                      </tr>
                    )}
                    {receiptModalData.totalDue - receiptModalData.amountPaid > 0 && (
                      <tr>
                        <td className="py-1.5 px-3 text-rose-700">Balance Due</td>
                        <td className="py-1.5 px-3 text-right font-mono text-rose-700">PKR {(receiptModalData.totalDue - receiptModalData.amountPaid).toLocaleString()}</td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              {receiptModalData.payment?.receipt_number && (
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-800 flex items-center justify-between font-mono">
                  <span>Receipt #{receiptModalData.payment.receipt_number}</span>
                  <span className="capitalize">{receiptModalData.payment.payment_method?.replace('_', ' ')}</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setReceiptModalData(null)}
                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = cleanPhoneForWhatsApp(receiptModalData.student.guardian_whatsapp || receiptModalData.student.guardian_phone);
                    const academyTitle = tenant?.name || 'Apex Academy';
                    const lines = [
                      `*${academyTitle.toUpperCase()}*`,
                      `*OFFICIAL ADMISSION & FEE RECEIPT*`,
                      ``,
                      `Student: *${receiptModalData.student.full_name}*`,
                      `Admission No: *${receiptModalData.student.admission_number}*`,
                      `Guardian: ${receiptModalData.student.guardian_name}`,
                      `Date: ${receiptModalData.student.admission_date}`,
                      ``,
                      `*Fee Breakdown:*`,
                      ...receiptModalData.items.map(i => `• ${i.name}: PKR ${i.amount.toLocaleString()}`),
                      `---------------------------`,
                      `Total Billed: PKR ${receiptModalData.totalDue.toLocaleString()}`,
                      receiptModalData.amountPaid > 0 ? `Amount Received: PKR ${receiptModalData.amountPaid.toLocaleString()}` : `Payment Status: Due`,
                      receiptModalData.totalDue - receiptModalData.amountPaid > 0 ? `Balance Due: PKR ${(receiptModalData.totalDue - receiptModalData.amountPaid).toLocaleString()}` : ``,
                      receiptModalData.payment?.receipt_number ? `Receipt No: ${receiptModalData.payment.receipt_number}` : ``,
                      ``,
                      `Thank you. For any inquiries, please contact the academy administration.`
                    ].filter(Boolean).join('\n');

                    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`;
                    window.open(url, '_blank');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
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
                      `Admission No: *${receiptModalData.student.admission_number}*`,
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
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* ========================================================================= */}
      {/* BULK CSV IMPORT MODAL                                                     */}
      {/* ========================================================================= */}
      {showBulkImportModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 ring-1 ring-slate-900/10 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span>Bulk Student CSV Import</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Bulk enroll students by pasting CSV rows. Must include full name and primary guardian details.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Class & Section Batch</label>
                <select
                  value={bulkImportBatchId}
                  onChange={e => setBulkImportBatchId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select Target Section or Batch --</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {getProgramName(b.program_id)} • {b.name} ({b.shift.toUpperCase()} • {b.current_enrollment} of {b.max_capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">CSV Data</label>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = `full_name,phone,guardian_name,guardian_phone,guardian_relation,guardian_id_card\nAhmad Khan,03001234567,Tariq Khan,03007654321,Father,35201-1234567-1\nSara Ali,03121234567,Ali Raza,03127654321,Father,35201-7654321-3`;
                      setBulkImportCsvText(sample);
                    }}
                    className="text-[11px] text-indigo-600 hover:underline font-medium"
                  >
                    Paste Sample CSV
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={bulkImportCsvText}
                  onChange={e => setBulkImportCsvText(e.target.value)}
                  placeholder="full_name,phone,guardian_name,guardian_phone,guardian_relation,guardian_id_card&#10;Muhammad Bilal,03001234567,Tariq Bilal,03009876543,Father,35202-1234567-1"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
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
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
        </div>,
        document.body
      )}

      {/* SINGLE STUDENT ARCHIVE CONFIRMATION MODAL */}
      {studentToArchive && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-5 m-0 animate-in fade-in duration-150 mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-xl max-w-lg w-full shadow-2xl border border-amber-300 ring-1 ring-amber-900/10 overflow-hidden flex flex-col mobile-sheet-card max-h-[90dvh]">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold">Archive Student Record</h2>
              </div>
              <button
                type="button"
                onClick={() => setStudentToArchive(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 overflow-y-auto">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Archiving Student: {studentToArchive.full_name}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Admission No: <strong className="font-mono">{studentToArchive.admission_number}</strong>
                </p>
                <p className="text-[11px] leading-relaxed text-amber-700">
                  Archiving marks this student as inactive and releases their seat in the batch roster. All academic history, exam marks, and fee ledgers remain preserved.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrative Reason <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={archiveReason}
                  onChange={e => setArchiveReason(e.target.value)}
                  placeholder="Reason for archival"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cancelUnpaidOnArchive}
                    onChange={e => setCancelUnpaidOnArchive(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-xs text-slate-800 font-medium leading-relaxed">
                    Cancel outstanding unpaid invoices for this student
                    <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                      Sets unpaid/partial balance to zero with an administrative cancellation remark.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 p-3.5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setStudentToArchive(null)}
                className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveStudent}
                disabled={isArchiving || !archiveReason.trim()}
                className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{isArchiving ? 'Archiving...' : 'Confirm Archival'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SINGLE STUDENT PERMANENT DELETE MODAL */}
      {studentToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5 m-0 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-lg w-full shadow-2xl border border-rose-300 ring-1 ring-rose-900/10 overflow-hidden flex flex-col max-h-[90dvh] mobile-sheet-card">
            <div className="bg-rose-700 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-white" />
                <h2 className="text-sm font-bold">Permanently Delete Student Record</h2>
              </div>
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="text-white/80 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 overflow-y-auto">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Warning: Permanent Deletion of {studentToDelete.full_name}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-800">
                  Admission No: <strong className="font-mono">{studentToDelete.admission_number}</strong>
                </p>
                <p className="text-[11px] leading-relaxed text-rose-700">
                  This action permanently removes the student from the database, deletes associated attendance registers, exam evaluations, and portal credentials.
                </p>
              </div>

              {deleteErrorMessage && (
                <div className="p-3 bg-rose-100 border border-rose-300 rounded-lg text-rose-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">{deleteErrorMessage}</p>
                    <p className="text-[11px] text-rose-700">
                      Recommendation: Use the <strong>Archive</strong> button instead to preserve institutional fee registers and accounting records.
                    </p>
                  </div>
                </div>
              )}

              {deleteRequiresForce && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteForce}
                      onChange={e => setDeleteForce(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-semibold leading-relaxed">
                      Administrative Override: Force delete this student despite recorded financial transactions.
                    </span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Deletion <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  placeholder="Reason for deletion"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-3.5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="h-8.5 px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStudent}
                disabled={isDeleting || !deleteReason.trim() || (deleteRequiresForce && !deleteForce)}
                className="h-8.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm Permanent Deletion'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* BULK ARCHIVE CONFIRMATION MODAL */}
      {showBulkArchiveModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5 m-0 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-lg w-full shadow-2xl border border-amber-300 ring-1 ring-amber-900/10 overflow-hidden flex flex-col max-h-[90dvh] mobile-sheet-card">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold">Bulk Archive Students ({selectedDirectoryStudentIds.size})</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkArchiveModal(false)}
                className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 overflow-y-auto">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Archiving {selectedDirectoryStudentIds.size} Selected Students</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Archiving removes all selected students from active class rosters and decrements current batch enrollments. Historical academic data, results, and fee transactions remain fully intact.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrative Reason <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={bulkArchiveReason}
                  onChange={e => setBulkArchiveReason(e.target.value)}
                  placeholder="Reason for archival"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkArchiveCancelUnpaid}
                    onChange={e => setBulkArchiveCancelUnpaid(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-xs text-slate-800 font-medium leading-relaxed">
                    Cancel outstanding unpaid invoices for all selected students
                    <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                      Sets unpaid balances to zero with an administrative cancellation remark.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-3.5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowBulkArchiveModal(false)}
                className="h-8.5 px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkArchive}
                disabled={isBulkOperating || !bulkArchiveReason.trim()}
                className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{isBulkOperating ? 'Archiving...' : `Archive (${selectedDirectoryStudentIds.size}) Students`}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5 m-0 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-lg w-full shadow-2xl border border-rose-300 ring-1 ring-rose-900/10 overflow-hidden flex flex-col max-h-[90dvh] mobile-sheet-card">
            <div className="bg-rose-700 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-white" />
                <h2 className="text-sm font-bold">Permanently Delete Selected Students ({selectedDirectoryStudentIds.size})</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="text-white/80 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 overflow-y-auto">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Warning: Permanent Deletion of {selectedDirectoryStudentIds.size} Students</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-700">
                  This action permanently expunges the selected student records, attendance, and exam marks.
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkDeleteForce}
                    onChange={e => setBulkDeleteForce(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-semibold leading-relaxed">
                    Administrative Override: Force delete students even if they possess recorded financial receipts or paid invoices.
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Deletion <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={bulkDeleteReason}
                  onChange={e => setBulkDeleteReason(e.target.value)}
                  placeholder="Reason for deletion"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-3.5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="h-8.5 px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isBulkOperating || !bulkDeleteReason.trim()}
                className="h-8.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBulkOperating ? 'Deleting...' : `Delete (${selectedDirectoryStudentIds.size}) Students`}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* GLOBAL MODAL: DOCUMENT CHECKLIST (ACCESSIBLE FROM ALL TABS) */}
      {isAddingDocHead && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Physical Document Requirements</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddingDocHead(false);
                  setNewDocHeadTitle('');
                  setNewDocHeadMandatory(false);
                }}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Simple Add Input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDocHeadTitle}
                  onChange={e => setNewDocHeadTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newDocHeadTitle.trim() && !isSavingDocHead) {
                      e.preventDefault();
                      handleAddDocHeadFromEnrollment();
                    }
                  }}
                  placeholder="Document name (e.g. B-Form, Father CNIC)"
                  className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <button
                  type="button"
                  disabled={!newDocHeadTitle.trim() || isSavingDocHead}
                  onClick={handleAddDocHeadFromEnrollment}
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs rounded-lg transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  {isSavingDocHead ? 'Saving...' : 'Add'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newDocHeadMandatory}
                    onChange={e => setNewDocHeadMandatory(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-amber-600 border-slate-300 focus:ring-amber-500"
                  />
                  <span className="text-xs text-slate-700">Mandatory</span>
                </label>

                {configuredDocHeads.length === 0 && (
                  <button
                    type="button"
                    disabled={isSavingDocHead}
                    onClick={handleLoadStandardDocHeads}
                    className="text-xs text-amber-600 hover:text-amber-700 font-semibold cursor-pointer"
                  >
                    + Load default checklist
                  </button>
                )}
              </div>
            </div>

            {/* Document List */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Documents ({configuredDocHeads.length})</span>
                {configuredDocHeads.length > 0 && (
                  <button
                    type="button"
                    disabled={isSavingDocHead}
                    onClick={handleLoadStandardDocHeads}
                    className="text-[11px] text-amber-600 hover:text-amber-700 cursor-pointer"
                  >
                    + Add standard docs
                  </button>
                )}
              </div>

              {configuredDocHeads.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No documents added yet.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {configuredDocHeads.map((h: DocumentChecklistHead) => (
                    <div key={h.code} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-slate-800 truncate">{h.title}</span>
                        {h.is_required ? (
                          <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            Mandatory
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            Optional
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocHeadFromEnrollment(h.code)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsAddingDocHead(false);
                  setNewDocHeadTitle('');
                  setNewDocHeadMandatory(false);
                }}
                className="h-8.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showFeeChallanModal && feeChallanPdfBytes && (
        <InPortalPdfViewerModal
          isOpen={showFeeChallanModal}
          pdfBytes={feeChallanPdfBytes}
          title={`Fee Challan • ${createdStudentResult?.full_name || 'Student'}`}
          filename={feeChallanPdfFilename}
          onClose={() => setShowFeeChallanModal(false)}
        />
      )}
    </div>
  );
};
