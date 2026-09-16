import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  X, 
  GraduationCap, 
  DollarSign, 
  CreditCard, 
  BookOpen, 
  CheckCircle2, 
  Phone, 
  MessageSquare, 
  Printer, 
  RefreshCw, 
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  ShieldAlert,
  AlertCircle,
  History,
  Edit3,
  Camera,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  Student, 
  Batch, 
  AcademicProgram, 
  Subject, 
  SubjectGroup, 
  StudentInvoice,
  StudentStatus,
  StudentAttendanceRecord
} from '@apex/shared-types';
import { StudentIDCardModal } from './StudentIDCardModal';

interface Student360ModalProps {
  student: Student;
  programs: AcademicProgram[];
  batches: Batch[];
  subjects: Subject[];
  subjectGroups: SubjectGroup[];
  onClose: () => void;
  onStudentUpdated?: () => void;
  onPreviewPortal?: (studentId: string) => void;
}

export const Student360Modal: React.FC<Student360ModalProps> = ({
  student,
  programs,
  batches,
  subjects,
  subjectGroups,
  onClose,
  onStudentUpdated,
  onPreviewPortal,
}) => {
  const { token, tenant } = useAuth();
  const [currentStudent, setCurrentStudent] = useState<Student>(student);
  useEffect(() => {
    setCurrentStudent(student);
    setStatusTarget(student.status || 'active');
    setResetGuardianCnic(student.guardian_id_card || '');
  }, [student]);

  // Portal Credentials & Admin Password Reset State
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetGuardianCnic, setResetGuardianCnic] = useState(student.guardian_id_card || '');
  const [resetPasswordType, setResetPasswordType] = useState<'default' | 'custom'>('default');
  const [customResetPassword, setCustomResetPassword] = useState('');
  const [resetReason, setResetReason] = useState('Parent requested credential reset at campus administration');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSuccessData, setResetSuccessData] = useState<{ username: string; password: string } | null>(null);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);
  const [showCredentialsPassword, setShowCredentialsPassword] = useState(false);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  const handleResetStudentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const finalPassword = resetPasswordType === 'default' ? 'Student@123' : customResetPassword.trim();
    if (!finalPassword || finalPassword.length < 6) {
      setResetErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (!resetReason.trim()) {
      setResetErrorMsg('Administrative reason is required for password reset audit trail.');
      return;
    }

    setIsResettingPassword(true);
    setResetErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          new_password: finalPassword,
          reason: resetReason.trim(),
          guardian_id_card: resetGuardianCnic.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetSuccessData({
          username: data.data.username,
          password: data.data.default_password,
        });
        if (data.data.guardian_id_card && data.data.guardian_id_card !== currentStudent.guardian_id_card) {
          setCurrentStudent(prev => ({ ...prev, guardian_id_card: data.data.guardian_id_card }));
        }
        if (onStudentUpdated) onStudentUpdated();
      } else {
        setResetErrorMsg(data.error?.message || 'Failed to reset password');
      }
    } catch (err: any) {
      setResetErrorMsg(err.message || 'Network error resetting password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleCopyCredentials = (username: string, pass: string) => {
    const text = `Student Portal Credentials\nAcademy: ${tenant?.name || 'Academy'}\nURL: ${window.location.origin}\nUsername (Father/Guardian CNIC): ${username}\nPassword: ${pass}`;
    navigator.clipboard.writeText(text);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2000);
  };

  const getWhatsAppCredentialsUrl = (username: string, pass: string, phone?: string) => {
    const targetPhone = (phone || currentStudent.guardian_whatsapp || currentStudent.guardian_phone || '').replace(/[^0-9]/g, '');
    const message = `*Student Portal Access Credentials*\n\nStudent: *${currentStudent.full_name}* (Roll: ${currentStudent.roll_number})\nAcademy: *${tenant?.name || 'The Academy'}*\nPortal Link: ${window.location.origin}\n\n*Username (Guardian CNIC):* ${username}\n*Password:* ${pass}\n\n_Please sign in and change your password in settings if needed. Keep these credentials confidential._`;
    return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
  };

  const [activeTab, setActiveTab] = useState<'academic' | 'finance' | 'attendance' | 'exams' | 'notebook' | 'status'>('academic');

  // Student Status & Exit Management
  const [statusTarget, setStatusTarget] = useState<StudentStatus>(student.status || 'active');
  const [statusReason, setStatusReason] = useState('');
  const [cancelUnpaidInvoices, setCancelUnpaidInvoices] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusSuccessMsg, setStatusSuccessMsg] = useState<string | null>(null);
  const [statusErrorMsg, setStatusErrorMsg] = useState<string | null>(null);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!statusReason.trim()) {
      setStatusErrorMsg('Administrative reason is mandatory for status changes.');
      return;
    }
    setIsUpdatingStatus(true);
    setStatusSuccessMsg(null);
    setStatusErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: statusTarget,
          reason: statusReason.trim(),
          cancel_unpaid_invoices: cancelUnpaidInvoices,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStudent(data.data);
        setStatusSuccessMsg(`Student status updated to "${data.data.status}".`);
        setStatusReason('');
        if (cancelUnpaidInvoices) {
          fetchInvoices();
        }
        if (onStudentUpdated) onStudentUpdated();
      } else {
        setStatusErrorMsg(data.error?.message || 'Failed to update student status');
      }
    } catch (err: any) {
      setStatusErrorMsg(err.message || 'Network error updating student status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Enrolled Subjects Management
  const [showEditSubjectsModal, setShowEditSubjectsModal] = useState(false);
  const [editSubjectIds, setEditSubjectIds] = useState<string[]>([]);
  const [isSavingSubjects, setIsSavingSubjects] = useState(false);
  const [editSubjectsSuccess, setEditSubjectsSuccess] = useState<string | null>(null);

  // Student Particulars Management
  const [showEditParticularsModal, setShowEditParticularsModal] = useState(false);
  const [editFullName, setEditFullName] = useState(student.full_name);
  const [editPhone, setEditPhone] = useState(student.phone || '');
  const [editEmail, setEditEmail] = useState(student.email || '');
  const [editGuardianName, setEditGuardianName] = useState(student.guardian_name);
  const [editGuardianPhone, setEditGuardianPhone] = useState(student.guardian_phone);
  const [editGuardianEmail, setEditGuardianEmail] = useState(student.guardian_email || '');
  const [editGuardianIdCard, setEditGuardianIdCard] = useState(student.guardian_id_card || '');
  const [editGuardianWhatsapp, setEditGuardianWhatsapp] = useState(student.guardian_whatsapp || '');
  const [editGuardianRelation, setEditGuardianRelation] = useState(student.guardian_relation || 'Father');
  const [editBloodGroup, setEditBloodGroup] = useState(student.blood_group || '');
  const [editPhotoUrl, setEditPhotoUrl] = useState(student.photo_url || '');
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>(student.custom_field_values || {});
  const [isSavingParticulars, setIsSavingParticulars] = useState(false);

  // Student Profile Change Audit History
  const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  const fetchAuditLogs = async () => {
    if (!token) return;
    setLoadingAuditLogs(true);
    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuditLogs(data.data || []);
      }
    } catch (err) {
      console.error('Failed fetching student audit logs:', err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  useEffect(() => {
    setEditFullName(currentStudent.full_name);
    setEditPhone(currentStudent.phone || '');
    setEditEmail(currentStudent.email || '');
    setEditGuardianName(currentStudent.guardian_name);
    setEditGuardianPhone(currentStudent.guardian_phone);
    setEditGuardianEmail(currentStudent.guardian_email || '');
    setEditGuardianIdCard(currentStudent.guardian_id_card || '');
    setEditGuardianWhatsapp(currentStudent.guardian_whatsapp || '');
    setEditGuardianRelation(currentStudent.guardian_relation || 'Father');
    setEditBloodGroup(currentStudent.blood_group || '');
    setEditPhotoUrl(currentStudent.photo_url || '');
    setEditCustomFields(currentStudent.custom_field_values || {});
  }, [currentStudent]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('Photo must be less than 3MB in size');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveParticulars = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSavingParticulars(true);
    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: editFullName,
          phone: editPhone,
          email: editEmail || undefined,
          guardian_name: editGuardianName,
          guardian_phone: editGuardianPhone,
          guardian_email: editGuardianEmail || undefined,
          guardian_id_card: editGuardianIdCard || undefined,
          guardian_whatsapp: editGuardianWhatsapp || undefined,
          guardian_relation: editGuardianRelation,
          blood_group: editBloodGroup || undefined,
          photo_url: editPhotoUrl || undefined,
          custom_field_values: editCustomFields,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStudent(data.data);
        setShowEditParticularsModal(false);
        if (onStudentUpdated) onStudentUpdated();
      } else {
        alert(data.error?.message || 'Failed to update student particulars');
      }
    } catch (err) {
      console.error('Error updating student particulars:', err);
      alert('Failed to update student particulars');
    } finally {
      setIsSavingParticulars(false);
    }
  };

  // Invoices & Payments state
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [isLoadingFinance, setIsLoadingFinance] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [challanInvoice, setChallanInvoice] = useState<StudentInvoice | null>(null);

  // Cashier Drawer State
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [collectInvoiceId, setCollectInvoiceId] = useState<string>('');
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectMethod, setCollectMethod] = useState<'cash' | 'bank_transfer' | 'easypaisa' | 'jazzcash' | 'cheque'>('cash');
  const [collectReference, setCollectReference] = useState('');
  const [collectNotes, setCollectNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);

  // Resolution
  const activeProgram = useMemo(() => programs.find(p => p.id === currentStudent.program_id), [programs, currentStudent]);
  const activeBatch = useMemo(() => batches.find(b => b.id === currentStudent.batch_id), [batches, currentStudent]);
  const activeElectiveGroup = useMemo(() => subjectGroups.find(g => g.id === currentStudent.elective_group_id), [subjectGroups, currentStudent]);
  const activeCompulsoryGroup = useMemo(() => {
    return subjectGroups.find(g => g.program_id === currentStudent.program_id && g.type === 'compulsory');
  }, [subjectGroups, currentStudent]);

  const allProgramSubjectGroups = useMemo(() => {
    return subjectGroups.filter(g => g.program_id === currentStudent.program_id);
  }, [subjectGroups, currentStudent.program_id]);

  const handleSaveSubjects = async () => {
    if (!token) return;
    setIsSavingSubjects(true);
    setEditSubjectsSuccess(null);

    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subjects: editSubjectIds,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStudent(data.data);
        setEditSubjectsSuccess('Enrolled subjects updated successfully.');
        if (onStudentUpdated) onStudentUpdated();
        setTimeout(() => {
          setShowEditSubjectsModal(false);
          setEditSubjectsSuccess(null);
        }, 1000);
      } else {
        alert(data.error?.message || 'Failed to update subjects');
      }
    } catch (err) {
      console.error('Error updating subjects:', err);
      alert('Failed to update subjects');
    } finally {
      setIsSavingSubjects(false);
    }
  };

  // Fetch Invoices
  const fetchInvoices = async () => {
    if (!token || !currentStudent.id) return;
    setIsLoadingFinance(true);
    try {
      const res = await fetch(`/api/v1/finance/invoices?student_id=${currentStudent.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const invList: StudentInvoice[] = data.data || [];
        setInvoices(invList);
        if (invList.length > 0) {
          const unpaid = invList.find(i => {
            const st = String(i.status || '').toLowerCase();
            const bal = i.balance_due ?? i.balance_amount ?? 0;
            return bal > 0 && st !== 'paid' && st !== 'cancelled' && st !== 'voided' && st !== 'rolled_over';
          });
          if (unpaid) {
            setCollectInvoiceId(unpaid.id);
            setCollectAmount(unpaid.balance_due ?? unpaid.balance_amount ?? 0);
          } else {
            setCollectInvoiceId('');
            setCollectAmount(0);
          }
        }
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setIsLoadingFinance(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [currentStudent.id, token]);

  // Ledger Computations
  const totalBilled = useMemo(() => invoices.reduce((acc, i) => acc + (i.net_total ?? i.net_amount ?? 0), 0), [invoices]);
  const totalPaid = useMemo(() => invoices.reduce((acc, i) => acc + (i.paid_amount || 0), 0), [invoices]);
  const totalOutstanding = useMemo(() => invoices.reduce((acc, i) => acc + (i.balance_due ?? i.balance_amount ?? 0), 0), [invoices]);

  // Collect Fee
  const handleCollectFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !collectInvoiceId || collectAmount <= 0) return;

    setIsSubmittingPayment(true);
    setPaymentSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/finance/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invoice_id: collectInvoiceId,
          amount_paid: Number(collectAmount),
          payment_method: collectMethod,
          reference_number: collectReference || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPaymentSuccessMsg(`Payment of PKR ${collectAmount.toLocaleString()} recorded. Receipt #${data.data?.payment?.receipt_number || data.data?.payment?.id?.slice(0, 8) || 'RC-POSTED'}`);
        fetchInvoices();
        if (onStudentUpdated) onStudentUpdated();
      } else {
        alert(data?.error?.message || 'Payment collection failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error collecting payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const openCashierForInvoice = (inv: StudentInvoice) => {
    setActiveTab('finance');
    setIsCashierOpen(true);
    setCollectInvoiceId(inv.id);
    setCollectAmount(inv.balance_due ?? inv.balance_amount ?? 0);
  };

  const [showContactPopup, setShowContactPopup] = useState(false);

  const getSubjectObj = (subId: string) => {
    return subjects.find(s => s.id === subId || s.name.toLowerCase() === subId.toLowerCase() || (s.code && s.code.toLowerCase() === subId.toLowerCase()));
  };

  const getSubjectName = (subId: string) => {
    const found = getSubjectObj(subId);
    if (found) return found.name;
    if (!subId.includes('-') || subId.length < 20) return subId;
    return 'Assigned Subject';
  };

  const getSubjectCode = (subId: string) => {
    const found = getSubjectObj(subId);
    if (found?.code) return found.code;
    return '—';
  };

  const guardianRelation = (student.custom_field_values?.relation as string) || 
    (student.custom_field_values?.guardian_relation as string) || 
    (student as any).guardian_relation || 
    'Guardian';

  const [examRows, setExamRows] = useState<{ title: string; date: string; obtained: number; total: number; grade: string; remarks: string }[]>([]);
  const [notebookRows, setNotebookRows] = useState<{ date: string; title: string; status: string; remarks: string }[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<StudentAttendanceRecord[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);

  useEffect(() => {
    if (!token || !currentStudent.id) return;
    setIsLoadingAttendance(true);
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`/api/v1/attendance/attendance/students?student_id=${currentStudent.id}`, { headers })
      .then(r => r.json())
      .then(body => {
        if (body.success && Array.isArray(body.data)) {
          setAttendanceLogs(body.data);
        } else {
          setAttendanceLogs([]);
        }
      })
      .catch(err => {
        console.error('Error fetching student attendance history:', err);
        setAttendanceLogs([]);
      })
      .finally(() => setIsLoadingAttendance(false));
  }, [token, currentStudent.id]);

  const attendanceMetrics = useMemo(() => {
    const total = attendanceLogs.length;
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    attendanceLogs.forEach(rec => {
      if (rec.status === 'present') present++;
      else if (rec.status === 'absent') absent++;
      else if (rec.status === 'late') late++;
      else if (rec.status === 'excused') excused++;
    });

    const attended = present + late;
    const effectiveTotal = Math.max(0, total - excused);
    const percentage = effectiveTotal > 0 ? Math.min(100, (attended / effectiveTotal) * 100) : (total > 0 ? 100 : 100);
    const isEligible = percentage >= 75;

    return {
      total,
      present,
      absent,
      late,
      excused,
      percentage: percentage.toFixed(1),
      isEligible,
    };
  }, [attendanceLogs]);

  useEffect(() => {
    if (!token || !currentStudent.id) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`/api/v1/sis/students/${currentStudent.id}/academic-summary`, { headers })
      .then(r => r.json())
      .then(body => {
        if (body.success && body.data) {
          const exData = body.data.exams || [];
          const rowsExams: typeof examRows = exData
            .filter((e: any) => e.total_obtained !== null || e.status === 'evaluated')
            .map((e: any) => ({
              title: e.title,
              date: e.exam_date,
              obtained: e.total_obtained ?? 0,
              total: e.total_marks,
              grade: e.grade || '—',
              remarks: e.remarks || '—',
            }));
          setExamRows(rowsExams);

          const hwData = body.data.homework || [];
          const rowsNotebook: typeof notebookRows = hwData.map((h: any) => ({
            date: h.due_date,
            title: `${h.subject_name ? h.subject_name + ': ' : ''}${h.title}`,
            status: h.submission_status || 'pending',
            remarks: h.remarks || '—',
          }));
          setNotebookRows(rowsNotebook);
        }
      })
      .catch(err => {
        console.error('Error loading student academic summary:', err);
        setExamRows([]);
        setNotebookRows([]);
      });
  }, [token, currentStudent.id]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5 m-0">
      {/* Print Stylesheet (rendered only when viewing a challan to avoid overriding global page prints) */}
      {challanInvoice && (
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-challan-area, #printable-challan-area * {
              visibility: visible;
            }
            #printable-challan-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 8mm;
              background: white !important;
            }
            .no-print {
              display: none !important;
            }
            @page {
              size: A4 landscape;
              margin: 6mm;
            }
          }
        `}</style>
      )}

      {/* Main Container / Bottom Sheet on Mobile */}
      <div className="bg-white rounded-t-3xl sm:rounded-xl max-w-5xl w-full shadow-2xl border-t sm:border border-slate-300/90 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[94vh] animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 has-drag-handle">
        {/* Mobile Swipe / Grab Handle Pill */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Student Details + Mobile Close Button */}
            <div className="flex items-start justify-between w-full lg:w-auto gap-3">
              <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                {/* Photo Box */}
              <div className="w-14 h-16 sm:w-16 sm:h-20 rounded border border-slate-300 bg-slate-100 flex items-center justify-center font-mono font-bold text-slate-700 text-sm overflow-hidden shrink-0">
                {currentStudent.photo_url ? (
                  <img 
                    src={currentStudent.photo_url} 
                    alt={currentStudent.full_name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <User className="w-6 h-6 stroke-1 mb-0.5" />
                    <span className="text-[9px] uppercase font-sans">Photo</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900 leading-tight">
                    {currentStudent.full_name}
                  </h1>
                  
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    currentStudent.status === 'active'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}>
                    {currentStudent.status === 'active' ? 'Active' : currentStudent.status}
                  </span>

                  {currentStudent.blood_group && (
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                      {currentStudent.blood_group}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 text-[11px] mr-1">Roll #:</span>
                    <span className="font-mono font-bold text-slate-900">{currentStudent.roll_number}</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div>
                    <span className="text-slate-400 text-[11px] mr-1">Admission #:</span>
                    <span className="font-mono text-slate-900">{currentStudent.admission_number}</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div>
                    <span className="text-slate-400 text-[11px] mr-1">Class:</span>
                    <span className="font-medium text-slate-900">{activeProgram?.name || '—'}</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div>
                    <span className="text-slate-400 text-[11px] mr-1">Section:</span>
                    <span className="font-medium text-slate-900">{activeBatch?.name || '—'}</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div>
                    <span className="text-slate-400 text-[11px] mr-1">Shift:</span>
                    <span className="font-medium text-slate-800 capitalize">{activeBatch?.shift || 'Morning'}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 pt-0.5">
                  <span>Guardian: <strong className="text-slate-800 font-medium">{currentStudent.guardian_name}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span className="font-mono text-slate-700">{currentStudent.guardian_phone}</span>
                  <span className="text-slate-400 text-[11px]">({currentStudent.guardian_relation || (currentStudent.custom_field_values?.relation as string) || (currentStudent.custom_field_values?.guardian_relation as string) || 'Guardian'})</span>
                  {currentStudent.guardian_id_card && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-400 text-[11px]">CNIC:</span>
                      <span className="font-mono text-slate-900 font-bold">{currentStudent.guardian_id_card}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions: Horizontally Scrollable on Mobile */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full lg:w-auto shrink-0">
              <button
                onClick={() => {
                  setActiveTab('finance');
                  setIsCashierOpen(true);
                }}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Receive Fee</span>
              </button>

              <button
                onClick={() => setShowEditParticularsModal(true)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Edit Student Particulars & Photo"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                <span>Edit Particulars</span>
              </button>

              <button
                onClick={() => {
                  fetchAuditLogs();
                  setShowAuditLogsModal(true);
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="View Student Profile Audit Trail"
              >
                <History className="w-3.5 h-3.5 text-slate-600" />
                <span>Audit Trail</span>
              </button>

              <button
                onClick={() => setShowIdCardModal(true)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-300" />
                <span>ID Card</span>
              </button>

              <button
                onClick={() => {
                  setResetGuardianCnic(currentStudent.guardian_id_card || '');
                  setShowResetPasswordModal(true);
                  setResetSuccessData(null);
                  setResetErrorMsg(null);
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Reset Student & Guardian Portal Login Password"
              >
                <Key className="w-3.5 h-3.5 text-slate-600" />
                <span>Reset Password</span>
              </button>

              {/* Contact Options: Call & WhatsApp */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowContactPopup(!showContactPopup)}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-600" />
                  <span>Call</span>
                </button>

                {showContactPopup && (
                  <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-900">Contact Options</span>
                      <button onClick={() => setShowContactPopup(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Guardian Contact */}
                    <div className="space-y-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{student.guardian_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({guardianRelation})</span>
                      </div>
                      <p className="font-mono text-[11px] text-slate-600 font-medium">{student.guardian_phone}</p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <a
                          href={`tel:${student.guardian_phone.replace(/[^0-9+]/g, '')}`}
                          className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-center text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Call</span>
                        </a>
                        <a
                          href={`https://wa.me/${(student.guardian_whatsapp || student.guardian_phone).replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-center text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                      {student.guardian_whatsapp && student.guardian_whatsapp !== student.guardian_phone && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          WhatsApp: <span className="font-mono font-medium text-slate-700">{student.guardian_whatsapp}</span>
                        </p>
                      )}
                    </div>

                    {/* Student Direct Contact (if provided) */}
                    {student.phone && (
                      <div className="space-y-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{student.full_name}</span>
                          <span className="text-[10px] text-slate-500">Student</span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-600 font-medium">{student.phone}</p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <a
                            href={`tel:${student.phone.replace(/[^0-9+]/g, '')}`}
                            className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-center text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call</span>
                          </a>
                          <a
                            href={`https://wa.me/${student.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-center text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <a
                href={`https://wa.me/${(student.guardian_whatsapp || student.guardian_phone).replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>

              {onPreviewPortal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPreviewPortal(currentStudent.id);
                  }}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Preview Student & Parent Portal"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Preview Portal</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="hidden lg:flex p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors ml-1"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Smooth kinetic horizontal scroll on mobile) */}
        <div className="flex items-center overflow-x-auto no-scrollbar border-b border-slate-200 px-4 sm:px-6 bg-slate-50 text-xs font-medium gap-1 whitespace-nowrap shrink-0">
          <button
            onClick={() => setActiveTab('academic')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'academic'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-slate-500" />
            <span>Academic Details</span>
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'finance'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-4 h-4 text-slate-500" />
            <span>Fees & Challans</span>
            {totalOutstanding > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
                Due: PKR {totalOutstanding.toLocaleString()}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'attendance'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Attendance History</span>
          </button>

          <button
            onClick={() => setActiveTab('exams')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'exams'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-slate-500" />
            <span>Examination Results</span>
          </button>

          <button
            onClick={() => setActiveTab('notebook')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'notebook'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span>Notebook Checking</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('status');
              setStatusTarget(currentStudent.status || 'active');
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'status'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            <span>Status & Exit</span>
            {currentStudent.status !== 'active' && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 capitalize">
                {currentStudent.status}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/40">
          
          {/* TAB 1: ACADEMIC DETAILS */}
          {activeTab === 'academic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Academic Placement */}
                <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-slate-500" />
                      Enrollment Information
                    </h3>
                    <span className="font-mono text-[11px] text-slate-500">Session {activeBatch?.academic_session || '2026-2027'}</span>
                  </div>

                  <table className="w-full text-xs text-left border-collapse">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 text-slate-500 w-2/5">Class</td>
                        <td className="py-2 font-semibold text-slate-900">{activeProgram?.name || '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Section</td>
                        <td className="py-2 font-semibold text-slate-900">{activeBatch?.name || '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Shift & Timings</td>
                        <td className="py-2 font-mono text-slate-800">
                          {activeBatch?.shift ? activeBatch.shift.toUpperCase() : '—'} {activeBatch?.start_time && activeBatch?.end_time ? `• ${activeBatch.start_time} – ${activeBatch.end_time}` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Admission Date</td>
                        <td className="py-2 font-mono text-slate-800">{student.admission_date}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Status</td>
                        <td className="py-2 capitalize text-slate-800">{student.status}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Guardian Info */}
                <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-500" />
                      Guardian Particulars
                    </h3>
                    <span className="text-[10px] text-slate-500 font-mono">({guardianRelation})</span>
                  </div>

                  <table className="w-full text-xs text-left border-collapse">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 text-slate-500 w-2/5">Guardian Name</td>
                        <td className="py-2 font-semibold text-slate-900">{student.guardian_name}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Guardian Mobile</td>
                        <td className="py-2 font-mono font-bold text-slate-900">{student.guardian_phone}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Guardian CNIC</td>
                        <td className="py-2 font-mono font-bold text-slate-900">
                          {student.guardian_id_card || <span className="text-amber-600 font-sans font-normal italic text-[11px]">Not assigned</span>}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Student Phone</td>
                        <td className="py-2 font-mono text-slate-800">{student.phone || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Student Email</td>
                        <td className="py-2 font-mono text-slate-800">{student.email || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Student & Guardian Portal Login Credentials */}
                <div className="bg-white border border-slate-200 rounded p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Key className="w-4 h-4 text-indigo-600" />
                        Portal Access & Credentials
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    </div>

                    <div className="space-y-2.5 pt-2">
                      {/* Username */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mb-1">
                          <span>Username (Guardian CNIC)</span>
                          <span className="text-[10px] text-indigo-600 font-semibold font-sans">Login Identifier</span>
                        </div>
                        {currentStudent.guardian_id_card ? (
                          <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                            <span className="font-mono font-bold text-slate-900 text-xs">{currentStudent.guardian_id_card}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCredentials(currentStudent.guardian_id_card!, 'Student@123')}
                              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                              title="Copy Credentials"
                            >
                              {copiedCredentials ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ) : (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                            <div className="flex items-center gap-1 font-bold">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>No Guardian CNIC Assigned</span>
                            </div>
                            <span className="text-[10px]">Student cannot log in without Guardian CNIC.</span>
                          </div>
                        )}
                      </div>

                      {/* Default Password */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mb-1">
                          <span>Default Password</span>
                          <span className="text-[10px] text-slate-400 font-sans">Default Access</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {showCredentialsPassword ? 'Student@123' : '••••••••'}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setShowCredentialsPassword(!showCredentialsPassword)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                              title={showCredentialsPassword ? 'Hide password' : 'Show password'}
                            >
                              {showCredentialsPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText('Student@123');
                                setCopiedCredentials(true);
                                setTimeout(() => setCopiedCredentials(false), 2000);
                              }}
                              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                              title="Copy password"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setResetGuardianCnic(currentStudent.guardian_id_card || '');
                        setShowResetPasswordModal(true);
                        setResetSuccessData(null);
                        setResetErrorMsg(null);
                      }}
                      className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Key className="w-3.5 h-3.5 text-indigo-300" />
                      <span>Reset Password</span>
                    </button>

                    {currentStudent.guardian_id_card && (
                      <a
                        href={getWhatsAppCredentialsUrl(currentStudent.guardian_id_card, 'Student@123')}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors text-center"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Send to Guardian (WhatsApp)</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Subject Table */}
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Enrolled Subjects
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Core and elective subjects for this class.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditSubjectIds([...(currentStudent.subjects || [])]);
                        setShowEditSubjectsModal(true);
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-300" />
                      <span>Update Enrolled Subjects</span>
                    </button>
                    <span className="font-mono text-xs font-semibold px-2 py-1 bg-white border border-slate-200 rounded text-slate-700">
                      Track: {activeElectiveGroup?.name || 'General Stream'}
                    </span>
                    <span className="font-mono text-xs font-semibold px-2 py-1 bg-white border border-slate-200 rounded text-slate-700">
                      {currentStudent.subjects?.length || 0} Subjects
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Subject Code</th>
                        <th className="py-2.5 px-4">Subject Title</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Stream</th>
                        <th className="py-2.5 px-4 text-center">Periods / Week</th>
                        <th className="py-2.5 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const enrolledIds = currentStudent.subjects || [];
                        const programSubIds = [
                          ...(activeCompulsoryGroup?.subject_ids || []),
                          ...(activeElectiveGroup?.subject_ids || [])
                        ];
                        const displayIds = Array.from(new Set([
                          ...enrolledIds,
                          ...programSubIds
                        ]));

                        if (displayIds.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400 text-xs italic">
                                No subjects currently assigned. Click "Update Enrolled Subjects" above to enroll.
                              </td>
                            </tr>
                          );
                        }

                        return displayIds.map(subId => {
                          const isEnrolled = enrolledIds.includes(subId);
                          const isCore = activeCompulsoryGroup?.subject_ids.includes(subId) ?? true;
                          const name = getSubjectName(subId);
                          const code = getSubjectCode(subId);

                          return (
                            <tr key={subId} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-4 font-mono text-slate-700">{code}</td>
                              <td className="py-2.5 px-4 font-semibold text-slate-900">{name}</td>
                              <td className="py-2.5 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  isCore 
                                    ? 'bg-slate-100 text-slate-700 border border-slate-200' 
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}>
                                  {isCore ? 'Core' : 'Elective'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 font-medium">
                                {isCore ? 'Standard Core' : (activeElectiveGroup?.name || 'Elective Stream')}
                              </td>
                              <td className="py-2.5 px-4 text-center font-mono text-slate-600">6</td>
                              <td className="py-2.5 px-4 text-right">
                                {isEnrolled ? (
                                  <span className="text-emerald-700 font-medium inline-flex items-center gap-1 text-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-medium inline-flex items-center gap-1 text-[11px]">
                                    Not Enrolled
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FEE LEDGER & CHALLANS */}
          {activeTab === 'finance' && (
            <div className="space-y-6">
              
              {/* Summary Strip */}
              <div className="bg-white border border-slate-200 rounded p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Fee Summary
                    </span>
                    <span className="text-xs text-slate-600">
                      Session {activeBatch?.academic_session || '2026-2027'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsCashierOpen(!isCashierOpen)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        isCashierOpen 
                          ? 'bg-slate-200 text-slate-800 hover:bg-slate-300' 
                          : 'bg-emerald-700 text-white hover:bg-emerald-800'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{isCashierOpen ? 'Hide Payment Form' : 'Receive Payment'}</span>
                      {isCashierOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-left">
                  <div className="border-r border-slate-100 pr-4">
                    <span className="text-slate-500 text-[11px] font-medium block">Total Invoiced</span>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                      PKR {totalBilled.toLocaleString()}
                    </div>
                  </div>

                  <div className="border-r border-slate-100 pr-4">
                    <span className="text-slate-500 text-[11px] font-medium block">Total Paid</span>
                    <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
                      PKR {totalPaid.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] font-medium block">Balance Due</span>
                    <div className={`text-lg font-bold font-mono mt-0.5 ${
                      totalOutstanding > 0 ? 'text-rose-700' : 'text-slate-800'
                    }`}>
                      PKR {totalOutstanding.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee Structure Note */}
              {student.fee_structure && (
                <div className="p-3.5 bg-white border border-slate-200 rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 block">Fee Structure</span>
                    <div className="text-slate-600 font-mono text-[11px] space-x-3">
                      <span>Tuition: <strong>PKR {Number(student.fee_structure.base_tuition || 0).toLocaleString()}/mo</strong></span>
                      <span>•</span>
                      <span>Admission: <strong>PKR {Number(student.fee_structure.admission_fee || 0).toLocaleString()}</strong></span>
                      <span>•</span>
                      <span>Exam: <strong>PKR {Number(student.fee_structure.exam_fee || 0).toLocaleString()}</strong></span>
                    </div>
                  </div>
                  {student.fee_structure.concession_val ? (
                    <div className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium text-[11px]">
                      Concession: <strong>{student.fee_structure.concession_type === 'percentage' ? `${student.fee_structure.concession_val}%` : `PKR ${student.fee_structure.concession_val}`}</strong> ({student.fee_structure.concession_reason || 'Approved'})
                    </div>
                  ) : null}
                </div>
              )}

              {/* Payment Counter Drawer */}
              {isCashierOpen && (
                <div className="bg-white border border-emerald-600 rounded p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-700" />
                        Receive Fee Payment
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Record fee collection against student invoice/challan.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCashierOpen(false)}
                      className="text-slate-400 hover:text-slate-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {paymentSuccessMsg && (
                    <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded text-xs flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{paymentSuccessMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleCollectFee} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Challan / Invoice</label>
                        <select
                          value={collectInvoiceId}
                          onChange={e => {
                            const id = e.target.value;
                            setCollectInvoiceId(id);
                            const sel = invoices.find(i => i.id === id);
                            if (sel) setCollectAmount(sel.balance_due ?? sel.balance_amount ?? 0);
                          }}
                          required
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
                        >
                          {invoices.map(inv => (
                            <option key={inv.id} value={inv.id}>
                              {inv.invoice_number} ({inv.billing_month}) — Balance: PKR {(inv.balance_due ?? inv.balance_amount ?? 0).toLocaleString()} [{inv.status}]
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-slate-700 font-semibold">Amount (PKR)</label>
                          {collectInvoiceId && (
                            <button
                              type="button"
                              onClick={() => {
                                const sel = invoices.find(i => i.id === collectInvoiceId);
                                if (sel) setCollectAmount(sel.balance_due ?? sel.balance_amount ?? 0);
                              }}
                              className="text-[11px] text-emerald-800 font-semibold hover:underline"
                            >
                              Fill Full Balance
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          min={1}
                          required
                          value={collectAmount}
                          onChange={e => setCollectAmount(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-800 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Payment Method</label>
                        <select
                          value={collectMethod}
                          onChange={e => setCollectMethod(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
                        >
                          <option value="cash">Cash at Counter</option>
                          <option value="bank_transfer">Bank Transfer / Online</option>
                          <option value="easypaisa">EasyPaisa</option>
                          <option value="jazzcash">JazzCash</option>
                          <option value="cheque">Bank Cheque / Pay Order</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Reference / Cheque # (Optional)</label>
                        <input
                          type="text"
                          value={collectReference}
                          onChange={e => setCollectReference(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Remarks (Optional)</label>
                      <input
                        type="text"
                        value={collectNotes}
                        onChange={e => setCollectNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsCashierOpen(false)}
                        className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded font-medium text-xs transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingPayment || collectAmount <= 0}
                        className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{isSubmittingPayment ? 'Processing...' : `Receive PKR ${collectAmount.toLocaleString()}`}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Invoices List */}
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Fee Invoices & Challans
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      History of generated challans and receipts.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    {invoices.length} Challans
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Challan #</th>
                        <th className="py-2.5 px-4">Month</th>
                        <th className="py-2.5 px-4">Issue Date</th>
                        <th className="py-2.5 px-4">Due Date</th>
                        <th className="py-2.5 px-4 text-right">Net Amount</th>
                        <th className="py-2.5 px-4 text-right">Paid</th>
                        <th className="py-2.5 px-4 text-right">Balance</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map(inv => {
                        const netPayable = inv.net_total ?? inv.net_amount ?? 0;
                        const balanceDue = inv.balance_due ?? inv.balance_amount ?? 0;
                        const isPaid = inv.status === 'PAID' || (inv.status as string) === 'paid';
                        const isPartial = inv.status === 'PARTIAL' || (inv.status as string) === 'partially_paid';

                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                            <td className="py-2.5 px-4 font-medium text-slate-800">{inv.billing_month}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-600">{inv.issue_date}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-600">{inv.due_date}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                              {netPayable.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-emerald-700 font-medium">
                              {inv.paid_amount.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold">
                              <span className={balanceDue > 0 ? 'text-rose-700' : 'text-slate-400'}>
                                {balanceDue.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : isPartial
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-rose-50 text-rose-800 border-rose-300'
                              }`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right space-x-2">
                              {!isPaid && (
                                <button
                                  onClick={() => openCashierForInvoice(inv)}
                                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-semibold transition-colors"
                                >
                                  Collect
                                </button>
                              )}

                              <button
                                onClick={() => setChallanInvoice(inv)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
                              >
                                <Printer className="w-3 h-3 text-slate-300" />
                                <span>Challan</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {invoices.length === 0 && !isLoadingFinance && (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                            No challans generated yet for this student.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ATTENDANCE HISTORY */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Attendance Summary
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Minimum 75% attendance required for examinations.
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    attendanceMetrics.isEligible
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border border-rose-300'
                  } self-start sm:self-auto`}>
                    {attendanceMetrics.total === 0 ? 'No Records (100%)' : `${attendanceMetrics.isEligible ? 'Eligible' : 'Ineligible'} (${attendanceMetrics.percentage}%)`}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 pt-3 text-left">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Overall Attendance</span>
                    <div className={`text-lg font-bold ${attendanceMetrics.isEligible ? 'text-emerald-700' : 'text-rose-700'} font-mono mt-0.5`}>
                      {attendanceMetrics.total === 0 ? '—' : `${attendanceMetrics.percentage}%`}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Working Days</span>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">{attendanceMetrics.total} Days</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Present</span>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">{attendanceMetrics.present} Days</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Late</span>
                    <div className="text-lg font-bold text-amber-700 font-mono mt-0.5">{attendanceMetrics.late} Days</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Excused</span>
                    <div className="text-lg font-bold text-indigo-700 font-mono mt-0.5">{attendanceMetrics.excused} Days</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Absences</span>
                    <div className="text-lg font-bold text-rose-700 font-mono mt-0.5">{attendanceMetrics.absent} Days</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    Attendance History Logs
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {attendanceLogs.length} record{attendanceLogs.length === 1 ? '' : 's'}
                  </span>
                </div>

                {isLoadingAttendance ? (
                  <div className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    <p className="text-xs font-mono">Loading live attendance records...</p>
                  </div>
                ) : attendanceLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-bold text-slate-700">No attendance records on file</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Attendance records marked in the Attendance Desk will appear here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4">Check-In</th>
                          <th className="py-2.5 px-4">Marked By</th>
                          <th className="py-2.5 px-4">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendanceLogs.map(log => {
                          let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                          if (log.status === 'present') badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                          if (log.status === 'absent') badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';
                          if (log.status === 'late') badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                          if (log.status === 'excused') badgeStyle = 'bg-indigo-50 text-indigo-800 border-indigo-200';

                          return (
                            <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{log.date}</td>
                              <td className="py-2.5 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize border ${badgeStyle}`}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-mono text-slate-600">
                                {log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">
                                {log.marked_by || 'Staff'}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">
                                {log.remarks || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: EXAMINATION RESULTS */}
          {activeTab === 'exams' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Examination results
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Published marks for this student. Empty until exams are graded.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-800 font-bold">
                      {examRows.length} published result{examRows.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Examination</th>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4 text-center">Obtained</th>
                        <th className="py-2.5 px-4 text-center">Total</th>
                        <th className="py-2.5 px-4 text-center">Grade</th>
                        <th className="py-2.5 px-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {examRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">No graded examinations for this student yet.</td>
                        </tr>
                      ) : examRows.map(row => (
                      <tr key={row.title + row.date} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{row.title}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{row.date}</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">{row.obtained}</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">{row.total}</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-700">{row.grade}</td>
                        <td className="py-2.5 px-4 text-slate-600 text-[11px]">{row.remarks}</td>
                      </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NOTEBOOK CHECKING */}
          {activeTab === 'notebook' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Notebook & Homework Checks
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Teacher checks for classwork and homework completion.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                    {notebookRows.length} checks
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Assignment</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {notebookRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500">No notebook checks recorded for this student yet.</td>
                        </tr>
                      ) : notebookRows.map(row => (
                        <tr key={row.title + row.date} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-4 font-mono text-slate-800">{String(row.date).slice(0, 10)}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{row.title}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-800 capitalize">{row.status}</td>
                          <td className="py-2.5 px-4 text-slate-600">{row.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ADMINISTRATIVE STATUS & EXIT REGULARIZATION */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              {/* Top Banner / Standing */}
              <div className="bg-white border border-slate-200 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Standing:</span>
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold border uppercase tracking-wider ${
                      currentStudent.status === 'active'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : currentStudent.status === 'withdrawn'
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : currentStudent.status === 'suspended'
                        ? 'bg-red-50 text-red-800 border-red-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      {currentStudent.status || 'active'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {currentStudent.status_reason ? (
                      <span><strong>Reason on File:</strong> {currentStudent.status_reason}</span>
                    ) : (
                      <span>Student is enrolled in standard academic standing.</span>
                    )}
                  </p>
                </div>
                <div className="text-xs text-slate-500 text-left md:text-right">
                  <div>Admission Date: <strong className="font-mono text-slate-700">{currentStudent.admission_date || '—'}</strong></div>
                  <div>Last Updated: <strong className="font-mono text-slate-700">{currentStudent.updated_at ? new Date(currentStudent.updated_at).toLocaleDateString() : '—'}</strong></div>
                </div>
              </div>

              {/* Status Regularization Action Card */}
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Administrative Status Regularization
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Change enrollment standing, issue withdrawal clearance, or manage disciplinary suspension.
                    </p>
                  </div>
                  <ShieldAlert className="w-4 h-4 text-slate-400" />
                </div>

                <form onSubmit={handleUpdateStatus} className="p-5 space-y-4">
                  {statusSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{statusSuccessMsg}</span>
                    </div>
                  )}

                  {statusErrorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{statusErrorMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        New Standing / Target Status <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={statusTarget}
                        onChange={(e) => setStatusTarget(e.target.value as StudentStatus)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-medium"
                      >
                        <option value="active">Active (Regular Enrollment)</option>
                        <option value="waitlisted">Waitlisted (Capacity Exceeded / Pending Seat)</option>
                        <option value="on_leave">On Leave (Approved Absence)</option>
                        <option value="suspended">Suspended (Disciplinary / Admin Hold)</option>
                        <option value="alumni">Alumni (Course Completed / Graduated)</option>
                        <option value="withdrawn">Withdrawn (Formal Clearance Issued)</option>
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Withdrawn and suspended students are excluded from daily attendance registers.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Administrative Billing Action
                      </label>
                      <div className="mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cancelUnpaidInvoices}
                            onChange={(e) => setCancelUnpaidInvoices(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span className="text-xs text-slate-700 font-medium leading-relaxed">
                            Cancel outstanding unpaid & partially paid invoices for this student
                            <span className="block text-[11px] text-slate-500 font-normal">
                              Zeroes outstanding ledger balances and writes audit cancellation remarks.
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Reason for Status Change <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-sans"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={isUpdatingStatus || !statusReason.trim()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{isUpdatingStatus ? 'Updating Status...' : 'Apply Status Transition'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Status Audit Log */}
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Status Change History & Audit Trail
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Immutable institutional record of transitions and authorized signatories.
                    </p>
                  </div>
                  <History className="w-4 h-4 text-slate-400" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Date & Time</th>
                        <th className="py-2.5 px-4">Previous Standing</th>
                        <th className="py-2.5 px-4">New Standing</th>
                        <th className="py-2.5 px-4">Reason / Remarks</th>
                        <th className="py-2.5 px-4">Changed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(!currentStudent.status_change_history || currentStudent.status_change_history.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">
                            No status transitions recorded. Student remains in initial admission standing ({currentStudent.status || 'active'}).
                          </td>
                        </tr>
                      ) : (
                        currentStudent.status_change_history.map((h, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                              {new Date(h.changed_at).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                                {h.previous_status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase ${
                                h.new_status === 'active'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : h.new_status === 'withdrawn'
                                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}>
                                {h.new_status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-800 font-medium">
                              {h.reason}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-600 text-[11px]">
                              {h.changed_by}
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

        </div>

        {/* Footer */}
        <div className="p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span>Admission Date:</span>
            <span className="font-mono text-slate-700 font-medium">{student.admission_date}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* 3-PART BANK CHALLAN PRINT MODAL */}
      {challanInvoice && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto m-0">
          <div className="bg-white rounded-lg max-w-5xl w-full p-6 shadow-2xl border border-slate-300 space-y-4 my-auto print:border-none print:shadow-none print:p-0">
            {/* Modal Toolbar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-slate-700" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Fee Challan — {challanInvoice.invoice_number}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Month: {challanInvoice.billing_month} • Due Date: {challanInvoice.due_date}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Challan (A4 Landscape)</span>
                </button>
                <button
                  onClick={() => setChallanInvoice(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable 3-Part Grid: Stacks on mobile viewport, 3 columns on desktop and print */}
            <div id="printable-challan-area" className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-3 text-[10px] font-sans">
              {['BANK COPY', 'ACADEMY COPY', 'STUDENT COPY'].map((copyTitle, copyIdx) => (
                <div 
                  key={copyIdx} 
                  className="border-2 border-slate-900 p-3 rounded flex flex-col justify-between min-h-[580px] bg-white relative"
                >
                  {/* Header */}
                  <div className="text-center border-b border-slate-900 pb-2 space-y-0.5">
                    <span className="font-mono text-[8px] bg-slate-900 text-white px-2 py-0.5 rounded font-bold uppercase block w-max mx-auto">
                      {copyTitle}
                    </span>
                    <h4 className="font-extrabold text-xs uppercase text-slate-950 mt-1 line-clamp-1">
                      {tenant?.name || 'Academy'}
                    </h4>
                    <div className="text-[8px] text-slate-700 font-mono">
                      {(tenant?.settings as any)?.bank_name 
                        ? `${(tenant?.settings as any).bank_name} • A/C: ${(tenant?.settings as any).account_number || 'Official Account'}${(tenant?.settings as any).iban ? ` • IBAN: ${(tenant?.settings as any).iban}` : ''}`
                        : 'Official Fee Voucher • Authorized Campus Counter'}
                    </div>
                  </div>

                  {/* Student Particulars */}
                  <div className="py-2 border-b border-slate-300 space-y-1 text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Challan #:</span>
                      <strong className="font-mono text-slate-950">{challanInvoice.invoice_number}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Billing Month:</span>
                      <strong className="font-mono text-slate-950">{challanInvoice.billing_month}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Issue Date:</span>
                      <span className="font-mono">{challanInvoice.issue_date}</span>
                    </div>
                    <div className="flex justify-between font-bold text-rose-800">
                      <span>Due Date:</span>
                      <span className="font-mono">{challanInvoice.due_date}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-200">
                      <div className="text-slate-950 font-bold truncate">Student: {student.full_name}</div>
                      <div className="text-slate-700 font-mono text-[8px]">Roll: {student.roll_number} | Adm: {student.admission_number}</div>
                      <div className="text-slate-700 text-[8px]">Class: {activeProgram?.name || '—'} • Section: {activeBatch?.name || '—'}</div>
                    </div>
                  </div>

                  {/* Itemized Fee Breakdown */}
                  <div className="flex-1 py-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-900 text-[8px] uppercase">
                          <th className="py-1">Fee Description</th>
                          <th className="py-1 text-right">Amount (PKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[9px]">
                        {challanInvoice.items.map((item, i) => (
                          <tr key={i}>
                            <td className="py-1 text-slate-800">{item.head_name}</td>
                            <td className="py-1 text-right font-mono font-bold text-slate-950">
                              {item.net_amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total Payable Block */}
                  {(() => {
                    const netPayable = Number(challanInvoice.net_total ?? challanInvoice.net_amount ?? 0);
                    const paidAmount = Number(challanInvoice.paid_amount ?? 0);
                    const balanceAmount = Number(challanInvoice.balance_amount ?? challanInvoice.balance_due ?? (netPayable - paidAmount));
                    return (
                      <div className="border-t-2 border-slate-900 pt-2 space-y-1 text-[10px]">
                        <div className="flex justify-between font-extrabold text-slate-950 text-xs">
                          <span>Total Payable Amount:</span>
                          <span className="font-mono">PKR {netPayable.toLocaleString()}</span>
                        </div>
                        {paidAmount > 0 && (
                          <div className="flex justify-between text-[9px] text-emerald-700 font-semibold">
                            <span>Amount Paid:</span>
                            <span className="font-mono">PKR {paidAmount.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-[10px] text-slate-800">
                          <span>Balance Due:</span>
                          <span className="font-mono">PKR {balanceAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Signatures */}
                  <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-2 text-center text-[8px] text-slate-500">
                    <div className="border-t border-slate-400 pt-1">
                      Cashier Stamp
                    </div>
                    <div className="border-t border-slate-400 pt-1">
                      Bank Officer Signature
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* UPDATE ENROLLED SUBJECTS MODAL */}
      {showEditSubjectsModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 m-0">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-2xl border border-slate-300 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-slate-800" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Update Enrolled Subjects</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {currentStudent.full_name} • Roll: {currentStudent.roll_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditSubjectsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Select or deselect subjects for this student. Changes will immediately update examination grading eligibility and attendance records.
            </p>

            <div className="flex items-center justify-between py-1 border-y border-slate-100 text-xs">
              <span className="font-semibold text-slate-700">
                Selected: <strong className="text-indigo-600 font-mono">{editSubjectIds.length}</strong> subjects
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = [
                      ...(activeCompulsoryGroup ? activeCompulsoryGroup.subject_ids : []),
                      ...(activeElectiveGroup ? activeElectiveGroup.subject_ids : [])
                    ];
                    setEditSubjectIds([...new Set(allIds)]);
                  }}
                  className="text-[11px] text-indigo-600 hover:underline font-bold"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setEditSubjectIds([])}
                  className="text-[11px] text-slate-500 hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
              {/* Compulsory Core */}
              {activeCompulsoryGroup && activeCompulsoryGroup.subject_ids.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Compulsory Core Subjects</span>
                  </div>
                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {activeCompulsoryGroup.subject_ids.map(subId => {
                      const isChecked = editSubjectIds.includes(subId);
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
                                setEditSubjectIds(prev => 
                                  prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
                                );
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <div>
                              <span className="font-semibold text-slate-900">{getSubjectName(subId)}</span>
                              <span className="text-[10px] font-mono text-slate-500 ml-2">({getSubjectCode(subId)})</span>
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

              {/* Elective Tracks */}
              {allProgramSubjectGroups.filter(g => g.type === 'elective_track').map(group => (
                <div key={group.id} className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span>{group.name}</span>
                  </div>
                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {group.subject_ids.map(subId => {
                      const isChecked = editSubjectIds.includes(subId);
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
                                setEditSubjectIds(prev => 
                                  prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
                                );
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <div>
                              <span className="font-semibold text-slate-900">{getSubjectName(subId)}</span>
                              <span className="text-[10px] font-mono text-slate-500 ml-2">({getSubjectCode(subId)})</span>
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

            {editSubjectsSuccess && (
              <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs rounded-lg flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{editSubjectsSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowEditSubjectsModal(false)}
                disabled={isSavingSubjects}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSubjects}
                disabled={isSavingSubjects}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isSavingSubjects ? 'Saving...' : 'Save Subject Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PARTICULARS MODAL */}
      {showEditParticularsModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 m-0">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-400" />
                  Edit Student Particulars
                </h2>
                <p className="text-[11px] text-slate-300">
                  {currentStudent.full_name} • Roll: {currentStudent.roll_number} • Admission: {currentStudent.admission_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditParticularsModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveParticulars} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Photo & Basic Info */}
              <div className="flex flex-col sm:flex-row gap-4 items-start pb-3 border-b border-slate-200">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-24 rounded border border-slate-300 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 relative">
                    {editPhotoUrl ? (
                      <img src={editPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <label className="cursor-pointer px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1 border border-slate-300">
                    <Camera className="w-3 h-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {editPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditPhotoUrl('')}
                      className="text-[10px] text-rose-600 hover:underline"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={e => setEditFullName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Student Phone</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      placeholder="0300-1234567"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Student Email (Portal Login)</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      placeholder="student@example.com"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Blood Group</label>
                    <select
                      value={editBloodGroup}
                      onChange={e => setEditBloodGroup(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium bg-white"
                    >
                      <option value="">-- Select Blood Group --</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Guardian Information */}
              <div className="space-y-3 pb-3 border-b border-slate-200">
                <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Guardian Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Guardian Name *</label>
                    <input
                      type="text"
                      required
                      value={editGuardianName}
                      onChange={e => setEditGuardianName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Relationship</label>
                    <select
                      value={editGuardianRelation}
                      onChange={e => setEditGuardianRelation(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium bg-white"
                    >
                      {['Father', 'Mother', 'Brother', 'Sister', 'Uncle', 'Guardian', 'Other'].map(rel => (
                        <option key={rel} value={rel}>{rel}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Guardian Phone *</label>
                    <input
                      type="text"
                      required
                      value={editGuardianPhone}
                      onChange={e => setEditGuardianPhone(e.target.value)}
                      placeholder="0300-1234567"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Guardian WhatsApp</label>
                    <input
                      type="text"
                      value={editGuardianWhatsapp}
                      onChange={e => setEditGuardianWhatsapp(e.target.value)}
                      placeholder="0300-1234567"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Guardian Email (Optional)</label>
                    <input
                      type="email"
                      value={editGuardianEmail}
                      onChange={e => setEditGuardianEmail(e.target.value)}
                      placeholder="guardian@example.com"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Guardian CNIC / ID Card (Parent Portal Login)
                    </label>
                    <input
                      type="text"
                      value={editGuardianIdCard}
                      onChange={e => setEditGuardianIdCard(e.target.value)}
                      placeholder="35201-1234567-1"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Primary login identifier for the parent portal. Enter 13-digit CNIC with or without dashes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Custom Fields (Key / Value) */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Custom Profile Attributes</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Previous School</label>
                    <input
                      type="text"
                      value={editCustomFields.previous_school || ''}
                      onChange={e => setEditCustomFields(prev => ({ ...prev, previous_school: e.target.value }))}
                      placeholder="e.g. Army Public School"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Previous Marks / Grade</label>
                    <input
                      type="text"
                      value={editCustomFields.previous_marks || ''}
                      onChange={e => setEditCustomFields(prev => ({ ...prev, previous_marks: e.target.value }))}
                      placeholder="e.g. 980/1100 (A+)"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditParticularsModal(false)}
                  disabled={isSavingParticulars}
                  className="px-3.5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingParticulars}
                  className="px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSavingParticulars ? 'Saving...' : 'Save Particulars'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMINISTRATIVE STUDENT PASSWORD RESET MODAL */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 m-0">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold leading-tight">Reset Student Portal Password</h2>
                  <p className="text-[11px] text-slate-300">
                    {currentStudent.full_name} • Roll: {currentStudent.roll_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setResetSuccessData(null);
                  setResetErrorMsg(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content / Form */}
            {resetSuccessData ? (
              <div className="p-6 space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Portal Password Updated Successfully</span>
                  </div>
                  <p className="text-emerald-800 text-[11px] leading-relaxed">
                    The student and guardian portal credentials have been reset. You can share these credentials with the parent directly via WhatsApp or copy them to clipboard.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Username (Guardian CNIC):</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-200">
                      {resetSuccessData.username}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">New Password:</span>
                    <span className="font-mono font-bold text-indigo-700 bg-white px-2.5 py-1 rounded border border-slate-200 text-sm">
                      {resetSuccessData.password}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Portal URL:</span>
                    <span className="font-mono text-slate-700 text-[11px]">
                      {window.location.origin}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <a
                    href={getWhatsAppCredentialsUrl(resetSuccessData.username, resetSuccessData.password)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs text-center"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Share via WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(resetSuccessData.username, resetSuccessData.password)}
                    className="py-2.5 px-4 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {copiedCredentials ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCredentials ? 'Copied!' : 'Copy Credentials'}</span>
                  </button>
                </div>

                <div className="pt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPasswordModal(false);
                      setResetSuccessData(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetStudentPassword} className="p-6 space-y-4 text-xs">
                {resetErrorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{resetErrorMsg}</span>
                  </div>
                )}

                {/* Login Identifier (Father/Guardian CNIC) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Username (Father / Guardian CNIC)</label>
                    <span className="text-[10px] text-slate-500 font-mono">National ID Card</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={resetGuardianCnic}
                    onChange={e => setResetGuardianCnic(e.target.value)}
                    placeholder="e.g. 35201-1234567-1"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    The student uses this Father/Guardian CNIC as their unique username to log into the academy portal.
                  </p>
                </div>

                {/* Password Selection */}
                <div className="space-y-2 pt-1">
                  <label className="font-bold text-slate-700 block">Password Option</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setResetPasswordType('default')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        resetPasswordType === 'default'
                          ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 font-bold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs">Standard Default</span>
                        {resetPasswordType === 'default' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <span className="font-mono text-xs text-slate-900 block font-black">Student@123</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setResetPasswordType('custom')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        resetPasswordType === 'custom'
                          ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 font-bold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs">Custom Password</span>
                        {resetPasswordType === 'custom' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <span className="text-[11px] text-slate-500 block">Enter temporary password</span>
                    </button>
                  </div>
                </div>

                {resetPasswordType === 'custom' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Custom Temporary Password</label>
                    <input
                      type="text"
                      required
                      value={customResetPassword}
                      onChange={e => setCustomResetPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900"
                    />
                  </div>
                )}

                {/* Audit Reason */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Administrative Reason (Audit Log)</label>
                  <input
                    type="text"
                    required
                    value={resetReason}
                    onChange={e => setResetReason(e.target.value)}
                    placeholder="e.g. Parent requested password reset at front desk"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-800"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowResetPasswordModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingPassword || !resetGuardianCnic.trim()}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{isResettingPassword ? 'Resetting Password...' : 'Confirm & Reset Password'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* STUDENT PROFILE AUDIT LOGS MODAL */}
      {showAuditLogsModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 m-0">
          <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  Student Profile Audit Trail
                </h2>
                <p className="text-[11px] text-slate-300">
                  {currentStudent.full_name} • Roll: {currentStudent.roll_number} • Admission: {currentStudent.admission_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditLogsModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {loadingAuditLogs ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Loading student audit history...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-medium">No profile modification logs recorded yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Changes made to student particulars or enrollment status will appear here.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider">
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Modified By</th>
                        <th className="p-3">Reason / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log, idx) => (
                        <tr key={log.id || idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold text-slate-900">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono uppercase font-bold">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 font-mono text-[11px]">
                            {log.changed_by}
                          </td>
                          <td className="p-3 text-slate-600">
                            {log.reason && (
                              <div className="font-semibold text-slate-800 mb-1">{log.reason}</div>
                            )}
                            {log.changes && Object.keys(log.changes).length > 0 && (
                              <div className="text-[10px] font-mono bg-slate-50 p-1.5 rounded border border-slate-200 space-y-0.5">
                                {Object.entries(log.changes).map(([k, v]) => (
                                  <div key={k} className="text-slate-700">
                                    <span className="font-bold text-slate-900">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end p-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowAuditLogsModal(false)}
                className="px-4 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE ID CARD MODAL */}
      {showIdCardModal && (
        <StudentIDCardModal
          student={currentStudent}
          batch={activeBatch}
          program={activeProgram}
          academyName={tenant?.name || 'Academy'}
          campusAddress={tenant?.campus_name}
          onClose={() => setShowIdCardModal(false)}
        />
      )}
    </div>
  );
};
