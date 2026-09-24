import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useMobileOverlay } from '../lib/mobileOverlay';
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
  Clock,
  User,
  ShieldAlert,
  AlertCircle,
  History,
  Edit3,
  Camera,
  Key,
  Copy,
  Check,
  Archive,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileCheck,
  Plus,
  ArrowRightLeft,
  ArrowRight
} from 'lucide-react';
import { 
  Student, 
  Batch, 
  AcademicProgram, 
  Subject, 
  SubjectGroup, 
  StudentInvoice, 
  StudentStatus, 
  StudentAttendanceRecord,
  DocumentChecklistHead,
  StudentEnrollment,
  StudentEnrollmentStatus
} from '@apex/shared-types';
import { StudentIDCardModal } from './StudentIDCardModal';

interface StudentProfileModalProps {
  student: Student;
  programs: AcademicProgram[];
  batches: Batch[];
  subjects: Subject[];
  subjectGroups: SubjectGroup[];
  onClose: () => void;
  onStudentUpdated?: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  student,
  programs,
  batches,
  subjects,
  subjectGroups,
  onClose,
  onStudentUpdated,
}) => {
  const { token, tenant, user } = useAuth();
  const isAdmin = user?.role === 'tenant_admin' || user?.role === 'super_admin';
  const canManageAcademicStatus = isAdmin || user?.role === 'academic_head';
  const [currentStudent, setCurrentStudent] = useState<Student>(student);
  useMobileOverlay('sheet', true, onClose);
  useEffect(() => {
    setCurrentStudent(student);
    setStatusTarget(student.status || 'active');
    setResetGuardianCnic(student.guardian_id_card || '');
    setEditSubjectIds(student.subjects || []);
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
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Modal Archive & Delete States
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveModalReason, setArchiveModalReason] = useState('Administrative student record archival');
  const [archiveModalCancelUnpaid, setArchiveModalCancelUnpaid] = useState(false);
  const [isArchivingStudent, setIsArchivingStudent] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteModalReason, setDeleteModalReason] = useState('Administrative permanent student deletion');
  const [deleteModalForce, setDeleteModalForce] = useState(false);
  const [deleteModalRequiresForce, setDeleteModalRequiresForce] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  const handleArchiveFromModal = async () => {
    if (!token) return;
    setIsArchivingStudent(true);
    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: archiveModalReason.trim() || 'Administrative student record archival',
          cancel_unpaid_invoices: archiveModalCancelUnpaid,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStudent(prev => ({ ...prev, status: 'archived' }));
        setStatusTarget('archived');
        setShowArchiveDialog(false);
        onStudentUpdated?.();
      } else {
        alert(data.error?.message || 'Failed to archive student');
      }
    } catch (err: any) {
      alert(err.message || 'Network error while archiving student');
    } finally {
      setIsArchivingStudent(false);
    }
  };

  const handleUnarchiveFromModal = async () => {
    if (!token) return;
    setIsArchivingStudent(true);
    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}/unarchive`, {
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
        setCurrentStudent(prev => ({ ...prev, status: 'active' }));
        setStatusTarget('active');
        onStudentUpdated?.();
      } else {
        alert(data.error?.message || 'Failed to restore student');
      }
    } catch (err: any) {
      alert(err.message || 'Network error while restoring student');
    } finally {
      setIsArchivingStudent(false);
    }
  };

  const handleDeleteFromModal = async () => {
    if (!token) return;
    setIsDeletingStudent(true);
    setDeleteModalError(null);
    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          force: deleteModalForce,
          reason: deleteModalReason.trim() || 'Administrative permanent student deletion',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowDeleteDialog(false);
        onStudentUpdated?.();
        onClose();
      } else {
        if (res.status === 409 || data.error?.hasPaidTransactions) {
          setDeleteModalRequiresForce(true);
        }
        setDeleteModalError(data.error?.message || 'Failed to delete student');
      }
    } catch (err: any) {
      setDeleteModalError(err.message || 'Network error while deleting student');
    } finally {
      setIsDeletingStudent(false);
    }
  };

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

  const getWhatsAppCredentialsUrl = (username: string, pass?: string, phone?: string) => {
    const targetPhone = (phone || currentStudent.guardian_whatsapp || currentStudent.guardian_phone || '').replace(/[^0-9]/g, '');
    const passLine = pass && pass !== '[As provided upon admission/reset]'
      ? `\n*Temporary Password:* ${pass}\n_Please sign in and update your password immediately._`
      : `\n*Password:* Confidential (use your registered password or contact administration for assistance).`;
    const message = `*Student Portal Access Notification*\n\nStudent: *${currentStudent.full_name}* (Roll: ${currentStudent.roll_number || 'N/A'})\nInstitution: *${tenant?.name || 'The Academy'}*\nPortal Link: ${window.location.origin}\n\n*Identifier (CNIC):* ${username}${passLine}\n\n_Keep your institutional access credentials secure._`;
    return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
  };

  const [activeTab, setActiveTab] = useState<'academic' | 'finance' | 'attendance' | 'status'>('academic');

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
  const [editSubjectIds, setEditSubjectIds] = useState<string[]>(student.subjects || []);
  const [isManagingSubjects, setIsManagingSubjects] = useState(false);
  const [isSavingSubjects, setIsSavingSubjects] = useState(false);
  const [editSubjectsSuccess, setEditSubjectsSuccess] = useState<string | null>(null);
  const [editSubjectsError, setEditSubjectsError] = useState<string | null>(null);

  // Student Particulars Management
  const [showEditParticularsModal, setShowEditParticularsModal] = useState(false);
  const [editFullName, setEditFullName] = useState(student.full_name);
  const [editPhone, setEditPhone] = useState(student.phone || '');
  const [editEmail, setEditEmail] = useState(student.email || '');
  const [editStudentWhatsapp, setEditStudentWhatsapp] = useState(student.student_whatsapp || '');
  const [editDob, setEditDob] = useState(student.date_of_birth || '');
  const [editGender, setEditGender] = useState(student.gender || '');
  const [editStudentBForm, setEditStudentBForm] = useState(student.student_b_form || '');
  const [editReligion, setEditReligion] = useState(student.religion || '');
  const [editPreviousSchool, setEditPreviousSchool] = useState(student.previous_school || (student.custom_field_values as any)?.previous_school || '');
  const [editResidentialAddress, setEditResidentialAddress] = useState(student.residential_address || '');
  const [editCity, setEditCity] = useState(student.city || '');
  const [editFatherName, setEditFatherName] = useState(student.father_name || '');
  const [editFatherCnic, setEditFatherCnic] = useState(student.father_cnic || '');
  const [editFatherPhone, setEditFatherPhone] = useState(student.father_phone || '');
  const [editFatherOccupation, setEditFatherOccupation] = useState(student.father_occupation || '');
  const [editMotherName, setEditMotherName] = useState(student.mother_name || '');
  const [editMotherCnic, setEditMotherCnic] = useState(student.mother_cnic || '');
  const [editMotherPhone, setEditMotherPhone] = useState(student.mother_phone || '');
  const [editMotherOccupation, setEditMotherOccupation] = useState(student.mother_occupation || '');
  const [editPrimaryContact, setEditPrimaryContact] = useState<'father' | 'mother' | 'guardian' | string>(student.primary_contact || 'father');
  const [editGuardianName, setEditGuardianName] = useState(student.guardian_name);
  const [editGuardianPhone, setEditGuardianPhone] = useState(student.guardian_phone);
  const [editGuardianEmail, setEditGuardianEmail] = useState(student.guardian_email || '');
  const [editGuardianIdCard, setEditGuardianIdCard] = useState(student.guardian_id_card || '');
  const [editGuardianWhatsapp, setEditGuardianWhatsapp] = useState(student.guardian_whatsapp || '');
  const [editGuardianRelation, setEditGuardianRelation] = useState(student.guardian_relation || '');
  const [editEmergencyName, setEditEmergencyName] = useState(student.emergency_contact_name || '');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState(student.emergency_contact_phone || '');
  const [editEmergencyRelation, setEditEmergencyRelation] = useState(student.emergency_contact_relation || '');
  const [editBloodGroup, setEditBloodGroup] = useState(student.blood_group || '');
  const [editPhotoUrl, setEditPhotoUrl] = useState(student.photo_url || '');
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>(student.custom_field_values || {});
  const [isSavingParticulars, setIsSavingParticulars] = useState(false);

  // Academic Placement & Class Transfer in Particulars
  const [editProgramId, setEditProgramId] = useState(student.program_id);
  const [editBatchId, setEditBatchId] = useState(student.batch_id);
  const [editElectiveGroupId, setEditElectiveGroupId] = useState(student.elective_group_id || '');
  const [editTransferDate, setEditTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [editTransferReason, setEditTransferReason] = useState('Administrative class/section transfer');
  const [editFeeMode, setEditFeeMode] = useState<'keep_current' | 'batch_standard' | 'custom'>('keep_current');
  const [editCustomFeeAmount, setEditCustomFeeAmount] = useState<number | string>(() => {
    const curB = batches.find(b => b.id === student.batch_id);
    return curB?.fee_amount || 0;
  });
  const [editUpdateUnpaidChallans, setEditUpdateUnpaidChallans] = useState(true);
  const [editParticularsError, setEditParticularsError] = useState<string | null>(null);

  // Dedicated Class Transfer Modal (Multi-Class Support)
  const [transferEnrollment, setTransferEnrollment] = useState<StudentEnrollment | null>(null);
  const [transferTargetProgramId, setTransferTargetProgramId] = useState('');
  const [transferTargetBatchId, setTransferTargetBatchId] = useState('');
  const [transferTargetElectiveGroupId, setTransferTargetElectiveGroupId] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transferReason, setTransferReason] = useState('');
  const [transferFeeMode, setTransferFeeMode] = useState<'keep_current' | 'batch_standard' | 'custom'>('keep_current');
  const [transferCustomFee, setTransferCustomFee] = useState<number | string>('');
  const [transferUpdateUnpaidChallans, setTransferUpdateUnpaidChallans] = useState(true);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Document Verification Quick Switcher State
  const [updatingDocCode, setUpdatingDocCode] = useState<string | null>(null);

  const handleUpdateDocumentStatus = async (headCode: string, newStatus: 'submitted' | 'pending' | 'exempted') => {
    if (!token || updatingDocCode) return;
    const currentDocs = currentStudent.submitted_documents || {};
    if (currentDocs[headCode] === newStatus) return;

    const updatedDocs = {
      ...currentDocs,
      [headCode]: newStatus,
    };

    setUpdatingDocCode(headCode);
    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          submitted_documents: updatedDocs,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStudent(data.data);
        if (onStudentUpdated) onStudentUpdated();
      } else {
        alert(data.error?.message || 'Failed to update document status');
      }
    } catch (err) {
      console.error('Error updating document status:', err);
      alert('Failed to update document status');
    } finally {
      setUpdatingDocCode(null);
    }
  };

  const studentDocHeads = useMemo<DocumentChecklistHead[]>(() => {
    const configured = (tenant?.settings?.document_checklist_heads || []) as DocumentChecklistHead[];
    const result = [...configured];
    const studentDocs = currentStudent.submitted_documents || {};
    Object.keys(studentDocs).forEach(code => {
      if (!result.some(h => h.code === code)) {
        result.push({
          id: `doc-${code}`,
          code,
          title: code.replace(/_/g, ' '),
          is_required: false,
        });
      }
    });
    return result;
  }, [tenant?.settings?.document_checklist_heads, currentStudent.submitted_documents]);

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
    setEditStudentWhatsapp(currentStudent.student_whatsapp || '');
    setEditDob(currentStudent.date_of_birth || '');
    setEditGender(currentStudent.gender || '');
    setEditStudentBForm(currentStudent.student_b_form || '');
    setEditReligion(currentStudent.religion || '');
    setEditPreviousSchool(currentStudent.previous_school || (currentStudent.custom_field_values as any)?.previous_school || '');
    setEditResidentialAddress(currentStudent.residential_address || '');
    setEditCity(currentStudent.city || '');
    setEditFatherName(currentStudent.father_name || '');
    setEditFatherCnic(currentStudent.father_cnic || '');
    setEditFatherPhone(currentStudent.father_phone || '');
    setEditFatherOccupation(currentStudent.father_occupation || '');
    setEditMotherName(currentStudent.mother_name || '');
    setEditMotherCnic(currentStudent.mother_cnic || '');
    setEditMotherPhone(currentStudent.mother_phone || '');
    setEditMotherOccupation(currentStudent.mother_occupation || '');
    setEditPrimaryContact(currentStudent.primary_contact || 'father');
    setEditGuardianName(currentStudent.guardian_name);
    setEditGuardianPhone(currentStudent.guardian_phone);
    setEditGuardianEmail(currentStudent.guardian_email || '');
    setEditGuardianIdCard(currentStudent.guardian_id_card || '');
    setEditGuardianWhatsapp(currentStudent.guardian_whatsapp || '');
    setEditGuardianRelation(currentStudent.guardian_relation || '');
    setEditEmergencyName(currentStudent.emergency_contact_name || '');
    setEditEmergencyPhone(currentStudent.emergency_contact_phone || '');
    setEditEmergencyRelation(currentStudent.emergency_contact_relation || '');
    setEditBloodGroup(currentStudent.blood_group || '');
    setEditPhotoUrl(currentStudent.photo_url || '');
    setEditCustomFields(currentStudent.custom_field_values || {});
    setEditProgramId(currentStudent.program_id);
    setEditBatchId(currentStudent.batch_id);
    setEditElectiveGroupId(currentStudent.elective_group_id || '');
    setEditTransferDate(new Date().toISOString().split('T')[0]);
    setEditTransferReason('Administrative class/section transfer');
    setEditFeeMode('keep_current');
    const curB = batches.find(b => b.id === currentStudent.batch_id);
    setEditCustomFeeAmount(curB?.fee_amount || 0);
    setEditUpdateUnpaidChallans(true);
    setEditParticularsError(null);
  }, [currentStudent, batches]);

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
    setEditParticularsError(null);

    const isBatchTransfer = Boolean(editBatchId && editBatchId !== currentStudent.batch_id);
    if (isBatchTransfer) {
      const targetB = batches.find(b => b.id === editBatchId);
      if (targetB && targetB.max_capacity > 0 && (targetB.current_enrollment || 0) >= targetB.max_capacity) {
        setEditParticularsError(`Target batch "${targetB.name}" has reached full capacity (${targetB.current_enrollment}/${targetB.max_capacity}). Transfer blocked.`);
        return;
      }
    }

    setIsSavingParticulars(true);
    try {
      let resolvedFeeStructure: any = undefined;
      if (isBatchTransfer) {
        const targetB = batches.find(b => b.id === editBatchId);
        if (editFeeMode === 'batch_standard') {
          resolvedFeeStructure = {
            ...(currentStudent.fee_structure || {}),
            tuition_fee: targetB?.fee_amount || 0,
            base_tuition_fee: targetB?.fee_amount || 0,
          };
        } else if (editFeeMode === 'custom') {
          resolvedFeeStructure = {
            ...(currentStudent.fee_structure || {}),
            tuition_fee: Number(editCustomFeeAmount),
            base_tuition_fee: Number(editCustomFeeAmount),
          };
        }
      }

      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: editFullName.trim(),
          program_id: editProgramId,
          batch_id: editBatchId,
          elective_group_id: editElectiveGroupId || undefined,
          ...(isBatchTransfer ? {
            transfer_effective_date: editTransferDate,
            transfer_reason: editTransferReason.trim() || 'Administrative class/section transfer',
            update_unpaid_challans: editUpdateUnpaidChallans,
            ...(resolvedFeeStructure ? { fee_structure: resolvedFeeStructure } : {}),
          } : {}),
          phone: editPhone.trim() || undefined,
          student_whatsapp: editStudentWhatsapp.trim() || undefined,
          email: editEmail.trim() || undefined,
          date_of_birth: editDob || undefined,
          gender: editGender || undefined,
          student_b_form: editStudentBForm.trim() || undefined,
          religion: editReligion.trim() || undefined,
          previous_school: editPreviousSchool.trim() || undefined,
          residential_address: editResidentialAddress.trim() || undefined,
          city: editCity.trim() || undefined,
          father_name: editFatherName.trim() || undefined,
          father_cnic: editFatherCnic.trim() || undefined,
          father_phone: editFatherPhone.trim() || undefined,
          father_occupation: editFatherOccupation.trim() || undefined,
          mother_name: editMotherName.trim() || undefined,
          mother_cnic: editMotherCnic.trim() || undefined,
          mother_phone: editMotherPhone.trim() || undefined,
          mother_occupation: editMotherOccupation.trim() || undefined,
          primary_contact: editPrimaryContact || undefined,
          guardian_name: editGuardianName.trim(),
          guardian_phone: editGuardianPhone.trim(),
          guardian_email: editGuardianEmail.trim() || undefined,
          guardian_id_card: editGuardianIdCard.trim() || undefined,
          guardian_whatsapp: editGuardianWhatsapp.trim() || undefined,
          guardian_relation: editGuardianRelation,
          emergency_contact_name: editEmergencyName.trim() || undefined,
          emergency_contact_phone: editEmergencyPhone.trim() || undefined,
          emergency_contact_relation: editEmergencyRelation || undefined,
          blood_group: editBloodGroup || undefined,
          photo_url: editPhotoUrl || undefined,
          custom_field_values: {
            ...editCustomFields,
            ...(editPreviousSchool.trim() ? { previous_school: editPreviousSchool.trim() } : {}),
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStudent(data.data);
        setShowEditParticularsModal(false);
        if (isBatchTransfer) {
          await Promise.all([fetchEnrollments(), fetchInvoices()]);
        }
        if (onStudentUpdated) onStudentUpdated();
      } else {
        setEditParticularsError(data.error?.message || 'Failed to update student particulars');
      }
    } catch (err: any) {
      console.error('Error updating student particulars:', err);
      setEditParticularsError(err.message || 'Failed to update student particulars');
    } finally {
      setIsSavingParticulars(false);
    }
  };

  // Invoices & Payments state
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [isLoadingFinance, setIsLoadingFinance] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [selectedIdCardEnrollmentId, setSelectedIdCardEnrollmentId] = useState<string | undefined>(undefined);
  const [challanInvoice, setChallanInvoice] = useState<StudentInvoice | null>(null);


  // Resolution
  const activeProgram = useMemo(() => programs.find(p => p.id === currentStudent.program_id), [programs, currentStudent]);
  const activeBatch = useMemo(() => batches.find(b => b.id === currentStudent.batch_id), [batches, currentStudent]);
  const isBatchSection = useMemo(() => {
    if (!activeBatch) return true;
    return (activeBatch.cohort_type || (/section/i.test(activeBatch.name) ? 'section' : 'batch')) === 'section';
  }, [activeBatch]);
  const activeElectiveGroup = useMemo(() => subjectGroups.find(g => g.id === currentStudent.elective_group_id), [subjectGroups, currentStudent]);
  const activeCompulsoryGroup = useMemo(() => {
    return subjectGroups.find(g => g.program_id === currentStudent.program_id && g.type === 'compulsory');
  }, [subjectGroups, currentStudent]);

  const allProgramSubjectGroups = useMemo(() => {
    return subjectGroups.filter(g => g.program_id === currentStudent.program_id);
  }, [subjectGroups, currentStudent.program_id]);

  const availableClassSubjectIds = useMemo(() => {
    const idSet = new Set<string>();
    for (const group of allProgramSubjectGroups) {
      for (const sid of (group.subject_ids || [])) {
        idSet.add(sid);
      }
    }
    for (const sid of (currentStudent.subjects || [])) {
      idSet.add(sid);
    }
    if (idSet.size === 0 && subjects.length > 0) {
      for (const s of subjects) {
        idSet.add(s.id);
      }
    }
    return Array.from(idSet);
  }, [allProgramSubjectGroups, currentStudent.subjects, subjects]);

  const hasSubjectChanges = useMemo(() => {
    const orig = currentStudent.subjects || [];
    if (orig.length !== editSubjectIds.length) return true;
    const origSet = new Set(orig);
    return editSubjectIds.some(id => !origSet.has(id));
  }, [currentStudent.subjects, editSubjectIds]);

  const handleToggleSubject = (subId: string) => {
    setEditSubjectsSuccess(null);
    setEditSubjectsError(null);
    setEditSubjectIds(prev => 
      prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
    );
  };

  const handleSelectAllSubjects = () => {
    setEditSubjectsSuccess(null);
    setEditSubjectsError(null);
    setEditSubjectIds([...availableClassSubjectIds]);
  };

  const handleSelectCompulsorySubjects = () => {
    setEditSubjectsSuccess(null);
    setEditSubjectsError(null);
    const compIds = activeCompulsoryGroup?.subject_ids || [];
    setEditSubjectIds(compIds);
  };

  const handleClearAllSubjects = () => {
    setEditSubjectsSuccess(null);
    setEditSubjectsError(null);
    setEditSubjectIds([]);
  };

  const handleDiscardSubjectChanges = () => {
    setEditSubjectsSuccess(null);
    setEditSubjectsError(null);
    setEditSubjectIds(currentStudent.subjects || []);
    setIsManagingSubjects(false);
  };

  const handleSaveSubjects = async () => {
    if (!token) return;
    setIsSavingSubjects(true);
    setEditSubjectsSuccess(null);
    setEditSubjectsError(null);

    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subjects: editSubjectIds,
          audit_reason: 'Updated enrolled subjects roster',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStudent(data.data);
        setEditSubjectIds(data.data.subjects || []);
        setIsManagingSubjects(false);
        setEditSubjectsSuccess('Enrolled subjects updated successfully.');
        if (onStudentUpdated) onStudentUpdated();
        setTimeout(() => {
          setEditSubjectsSuccess(null);
        }, 3500);
      } else {
        setEditSubjectsError(data.error?.message || 'Failed to update enrolled subjects');
      }
    } catch (err: any) {
      console.error('Error updating subjects:', err);
      setEditSubjectsError(err?.message || 'Network error updating enrolled subjects');
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

  // =========================================================================
  // Student Enrollments State & Operations (Multi-Class Support)
  // =========================================================================
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [_isLoadingEnrollments, setIsLoadingEnrollments] = useState(false);

  const primaryEnrollment = useMemo(() => {
    return enrollments.find(e => e.is_primary) || enrollments[0] || (currentStudent.batch_id ? {
      id: 'primary',
      student_id: currentStudent.id,
      program_id: currentStudent.program_id,
      batch_id: currentStudent.batch_id,
      is_primary: true,
      status: (currentStudent.status as any) || 'active',
    } as StudentEnrollment : null);
  }, [enrollments, currentStudent]);

  const secondaryEnrollments = useMemo(() => {
    if (!primaryEnrollment) return [];
    return enrollments.filter(e => e.id !== primaryEnrollment.id);
  }, [enrollments, primaryEnrollment]);

  // Leave Class Modal State
  const [leaveClassEnrollment, setLeaveClassEnrollment] = useState<StudentEnrollment | null>(null);
  const [leaveClassStatus, setLeaveClassStatus] = useState<StudentEnrollmentStatus>('withdrawn');
  const [leaveClassReason, setLeaveClassReason] = useState('');
  const [leaveClassCancelUnpaid, setLeaveClassCancelUnpaid] = useState(true);
  const [isLeavingClass, setIsLeavingClass] = useState(false);
  const [leaveClassError, setLeaveClassError] = useState<string | null>(null);

  // Add Class Modal State
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [addClassProgramId, setAddClassProgramId] = useState('');
  const [addClassBatchId, setAddClassBatchId] = useState('');
  const [addClassTuitionFee, setAddClassTuitionFee] = useState<number | string>('');
  const [addClassBillingMode, setAddClassBillingMode] = useState<'monthly' | 'installment'>('monthly');
  const [addClassElectiveGroupId, setAddClassElectiveGroupId] = useState('');
  const [addClassGenerateChallan, setAddClassGenerateChallan] = useState(true);
  const [addClassDueDate, setAddClassDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [addClassError, setAddClassError] = useState<string | null>(null);

  const fetchEnrollments = async () => {
    if (!token || !currentStudent.id) return;
    setIsLoadingEnrollments(true);
    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}/enrollments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnrollments(data.data || []);
      }
    } catch (err) {
      console.error('Error loading student enrollments:', err);
    } finally {
      setIsLoadingEnrollments(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [currentStudent.id, token]);

  const getEnrollmentBalance = (enrollmentId: string, batchId: string) => {
    const classInvoices = invoices.filter(
      i => (i.enrollment_id === enrollmentId || (!i.enrollment_id && i.batch_id === batchId)) &&
           i.status !== 'voided' && i.status !== 'cancelled' && i.status !== 'rolled_over'
    );
    return classInvoices.reduce((sum, inv) => sum + Number(inv.balance_due ?? inv.balance_amount ?? 0), 0);
  };

  const getEnrollmentFee = (enrollment: StudentEnrollment, batch?: Batch | null) => {
    const feeStr = enrollment.fee_structure;
    const recurring = feeStr?.recurring_monthly ?? feeStr?.net_tuition ?? feeStr?.base_tuition;
    if (recurring != null && Number(recurring) > 0) return Number(recurring);
    if (batch?.fee_amount && Number(batch.fee_amount) > 0) return Number(batch.fee_amount);
    return 0;
  };

  const handleMakePrimary = async (enrollmentId: string) => {
    if (!token || !currentStudent.id) return;
    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}/enrollments/${enrollmentId}/make-primary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchEnrollments();
        if (data.data) {
          const updatedEnr = data.data;
          setCurrentStudent(prev => ({
            ...prev,
            batch_id: updatedEnr.batch_id,
            program_id: updatedEnr.program_id || prev.program_id,
            admission_number: updatedEnr.admission_number || prev.admission_number,
            roll_number: updatedEnr.admission_number || updatedEnr.roll_number || prev.roll_number,
          }));
        }
        if (onStudentUpdated) onStudentUpdated();
      } else {
        alert(data.error?.message || 'Failed to designate primary class');
      }
    } catch (err: any) {
      alert(err.message || 'Network error updating primary class');
    }
  };

  const handleConfirmLeaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentStudent.id || !leaveClassEnrollment) return;
    setIsLeavingClass(true);
    setLeaveClassError(null);
    const effectiveReason = leaveClassReason.trim() || 'Left class';
    try {
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}/enrollments/${leaveClassEnrollment.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: leaveClassStatus,
          reason: effectiveReason,
          cancel_unpaid_invoices: leaveClassCancelUnpaid,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLeaveClassEnrollment(null);
        await fetchEnrollments();
        await fetchInvoices();
        if (onStudentUpdated) onStudentUpdated();
      } else {
        setLeaveClassError(data.error?.message || 'Failed to update class exit status');
      }
    } catch (err: any) {
      setLeaveClassError(err.message || 'Network error updating class exit status');
    } finally {
      setIsLeavingClass(false);
    }
  };

  const handleOpenTransferModal = (enr: StudentEnrollment) => {
    setTransferEnrollment(enr);
    setTransferTargetProgramId(enr.program_id || '');
    setTransferTargetBatchId(enr.batch_id);
    setTransferTargetElectiveGroupId(enr.elective_group_id || '');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferReason('');
    setTransferFeeMode('keep_current');
    const curB = batches.find(b => b.id === enr.batch_id);
    setTransferCustomFee(curB?.fee_amount || 0);
    setTransferUpdateUnpaidChallans(true);
    setTransferError(null);
  };

  const handleConfirmTransferClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentStudent.id || !transferEnrollment) return;
    if (transferTargetBatchId === transferEnrollment.batch_id) {
      setTransferError('Please select a different batch or section to transfer into.');
      return;
    }
    const targetB = batches.find(b => b.id === transferTargetBatchId);
    if (targetB && targetB.max_capacity > 0 && (targetB.current_enrollment || 0) >= targetB.max_capacity) {
      setTransferError(`Target batch "${targetB.name}" has reached full capacity (${targetB.current_enrollment}/${targetB.max_capacity}). Transfer blocked.`);
      return;
    }

    setIsSubmittingTransfer(true);
    setTransferError(null);
    try {
      let feeObj: any = undefined;
      if (transferFeeMode === 'batch_standard') {
        feeObj = {
          ...(transferEnrollment.fee_structure || {}),
          tuition_fee: targetB?.fee_amount || 0,
          base_tuition_fee: targetB?.fee_amount || 0,
        };
      } else if (transferFeeMode === 'custom') {
        feeObj = {
          ...(transferEnrollment.fee_structure || {}),
          tuition_fee: Number(transferCustomFee),
          base_tuition_fee: Number(transferCustomFee),
        };
      }

      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}/enrollments/${transferEnrollment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          program_id: transferTargetProgramId,
          batch_id: transferTargetBatchId,
          elective_group_id: transferTargetElectiveGroupId || undefined,
          transfer_effective_date: transferDate,
          transfer_reason: transferReason.trim() || 'Academic class/section transfer',
          update_unpaid_challans: transferFeeMode !== 'keep_current' ? transferUpdateUnpaidChallans : false,
          ...(feeObj ? { fee_structure: feeObj } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTransferEnrollment(null);
        await Promise.all([
          fetchEnrollments(),
          fetchInvoices(),
        ]);
        const sRes = await fetch(`/api/v1/sis/students/${currentStudent.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const sData = await sRes.json();
        if (sData.success) {
          setCurrentStudent(sData.data);
        }
        if (onStudentUpdated) onStudentUpdated();
      } else {
        setTransferError(data.error?.message || 'Failed to transfer class enrollment');
      }
    } catch (err: any) {
      setTransferError(err.message || 'Network error executing transfer');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleOpenAddClassModal = () => {
    const defaultProg = programs[0]?.id || '';
    setAddClassProgramId(defaultProg);
    const progBatches = batches.filter(b => b.program_id === defaultProg);
    const defaultBatch = progBatches[0];
    if (defaultBatch) {
      setAddClassBatchId(defaultBatch.id);
      setAddClassTuitionFee(defaultBatch.fee_amount || '');
      setAddClassBillingMode((defaultBatch.billing_mode as any) || 'monthly');
    } else {
      setAddClassBatchId('');
      setAddClassTuitionFee('');
    }
    setAddClassElectiveGroupId('');
    setAddClassGenerateChallan(true);
    setAddClassError(null);
    setShowAddClassModal(true);
  };

  const handleProgramChange = (progId: string) => {
    setAddClassProgramId(progId);
    const progBatches = batches.filter(b => b.program_id === progId);
    const defaultBatch = progBatches[0];
    if (defaultBatch) {
      setAddClassBatchId(defaultBatch.id);
      setAddClassTuitionFee(defaultBatch.fee_amount || '');
      setAddClassBillingMode((defaultBatch.billing_mode as any) || 'monthly');
    } else {
      setAddClassBatchId('');
      setAddClassTuitionFee('');
    }
    setAddClassElectiveGroupId('');
  };

  const handleBatchChange = (bId: string) => {
    setAddClassBatchId(bId);
    const b = batches.find(x => x.id === bId);
    if (b) {
      if (b.fee_amount) setAddClassTuitionFee(b.fee_amount);
      if (b.billing_mode) setAddClassBillingMode(b.billing_mode as any);
    }
  };

  const handleConfirmAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentStudent.id) return;
    if (!addClassBatchId) {
      setAddClassError('Please select a batch/section for enrollment.');
      return;
    }
    setIsAddingClass(true);
    setAddClassError(null);
    try {
      const payload: any = {
        program_id: addClassProgramId || undefined,
        batch_id: addClassBatchId,
        billing_mode: addClassBillingMode,
        generate_opening_challan: addClassGenerateChallan,
        generate_first_month_invoice: addClassGenerateChallan,
        opening_challan_due_date: addClassDueDate,
        due_date: addClassDueDate,
      };
      if (addClassTuitionFee !== '' && Number(addClassTuitionFee) >= 0) {
        payload.fee_structure = {
          base_tuition: Number(addClassTuitionFee),
          net_tuition: Number(addClassTuitionFee),
          recurring_monthly: Number(addClassTuitionFee),
        };
      }
      if (addClassElectiveGroupId) {
        payload.elective_group_id = addClassElectiveGroupId;
      }
      const res = await fetch(`/api/v1/sis/students/${currentStudent.id}/enrollments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowAddClassModal(false);
        await fetchEnrollments();
        await fetchInvoices();
        if (onStudentUpdated) onStudentUpdated();
      } else {
        setAddClassError(data.error?.message || 'Failed to enroll in class');
      }
    } catch (err: any) {
      setAddClassError(err.message || 'Network error during class enrollment');
    } finally {
      setIsAddingClass(false);
    }
  };

  // Ledger Computations
  const totalBilled = useMemo(() => invoices.reduce((acc, i) => acc + (i.net_total ?? i.net_amount ?? 0), 0), [invoices]);
  const totalPaid = useMemo(() => invoices.reduce((acc, i) => acc + (i.paid_amount || 0), 0), [invoices]);
  const totalOutstanding = useMemo(() => invoices.reduce((acc, i) => acc + (i.balance_due ?? i.balance_amount ?? 0), 0), [invoices]);


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
  const examStats = useMemo(() => {
    if (examRows.length === 0) {
      return { count: 0, totalMarks: 0, obtainedMarks: 0, percentage: '0' };
    }
    const totalMarks = examRows.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
    const obtainedMarks = examRows.reduce((acc, r) => acc + (Number(r.obtained) || 0), 0);
    const percentage = totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100).toFixed(1) : '0';
    return { count: examRows.length, totalMarks, obtainedMarks, percentage };
  }, [examRows]);
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
        }
      })
      .catch(err => {
        console.error('Error loading student academic summary:', err);
        setExamRows([]);
      });
  }, [token, currentStudent.id]);

  return createPortal(
    <div className="fixed inset-0 z-[9990] overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-5 m-0 animate-in fade-in duration-150 mobile-sheet">
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
      <div className="bg-white rounded-t-3xl sm:rounded-xl w-full max-w-5xl shadow-2xl border-t sm:border border-slate-300/90 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[94vh] sm:zoom-in-95 duration-200 mobile-sheet-card">
        {/* Institutional Student Profile Header */}
        <div className="bg-white border-b border-slate-200 px-3.5 sm:px-6 py-3 shrink-0 relative">
          {/* Dedicated Close Button for Mobile (Top-Right) */}
          <button
            type="button"
            onClick={onClose}
            className="sm:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer z-10"
            title="Close Profile"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Identity Block */}
            <div className="flex items-center gap-3 min-w-0 pr-8 sm:pr-0">
              {/* 3:4 Passport Portrait Frame */}
              <div className="w-12 h-15 sm:w-13 sm:h-16 rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {currentStudent.photo_url ? (
                  <img 
                    src={currentStudent.photo_url} 
                    alt={currentStudent.full_name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <User className="w-6 h-6 text-slate-400 stroke-1.5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                {/* Name & Badges */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
                    {currentStudent.full_name}
                  </h1>

                  <span className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold border flex items-center gap-1 shrink-0 ${
                    currentStudent.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : currentStudent.status === 'withdrawn'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      currentStudent.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} />
                    <span className="capitalize">{currentStudent.status === 'active' ? 'Active' : currentStudent.status}</span>
                  </span>

                  {currentStudent.blood_group && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      {currentStudent.blood_group}
                    </span>
                  )}

                  {currentStudent.id_card_reprint_required && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                      Reprint Card
                    </span>
                  )}
                </div>

                {/* Academic Placement Breadcrumb */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                  <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-800 font-mono font-medium border border-slate-200 text-[11px]">
                    Adm: {currentStudent.admission_number}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-800 font-medium">
                    {activeProgram?.name || 'Class'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600">
                    {isBatchSection ? 'Sec:' : 'Batch:'} {activeBatch?.name || '—'} ({activeBatch?.shift || 'Morning'})
                  </span>
                </div>

                {/* Guardian Quick-Contact line */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 mt-1">
                  <span>Guardian: <strong className="text-slate-900 font-semibold">{currentStudent.guardian_name}</strong> <span className="text-slate-400 font-normal">({guardianRelation})</span></span>
                  {currentStudent.guardian_phone && (
                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-slate-300">•</span>
                      <span className="font-mono font-medium text-slate-800">{currentStudent.guardian_phone}</span>
                      <a
                        href={`tel:${currentStudent.guardian_phone.replace(/[^0-9+]/g, '')}`}
                        className="w-5.5 h-5.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                        title={`Call Guardian: ${currentStudent.guardian_phone}`}
                      >
                        <Phone className="w-3 h-3 text-slate-600" />
                      </a>
                      <a
                        href={`https://wa.me/${(currentStudent.guardian_whatsapp || currentStudent.guardian_phone).replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-5.5 h-5.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center transition-colors cursor-pointer"
                        title="WhatsApp Guardian"
                      >
                        <MessageSquare className="w-3 h-3 text-emerald-700" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Primary Action Buttons Right */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
              <button
                type="button"
                onClick={() => setShowEditParticularsModal(true)}
                className="flex-1 sm:flex-none h-9 sm:h-10 px-3.5 sm:px-4.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg text-xs sm:text-[13px] font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                title="Edit Student Profile & Photo"
              >
                <Edit3 className="w-4 h-4 text-slate-300" />
                <span>Edit Profile</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedIdCardEnrollmentId(undefined);
                  setShowIdCardModal(true);
                }}
                className="flex-1 sm:flex-none h-9 sm:h-10 px-3.5 sm:px-4.5 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs sm:text-[13px] font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                title="Print Student ID Card"
              >
                <CreditCard className="w-4 h-4 text-slate-600" />
                <span>ID Card</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="hidden sm:flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Close Profile"
                aria-label="Close"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Clean Navigation Tabs (4 Standard Tabs) */}
        <div className="flex items-center overflow-x-auto md:overflow-x-visible no-scrollbar border-b border-slate-200 px-3 sm:px-4 bg-slate-50/70 text-xs font-medium gap-1 whitespace-nowrap shrink-0">
          <button
            onClick={() => setActiveTab('academic')}
            aria-label="Academic Details"
            className={`py-1.5 px-2.5 sm:px-3 h-8.5 border-b-2 flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
              activeTab === 'academic'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white -mb-px'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 font-medium'
            }`}
          >
            <GraduationCap className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'academic' ? 'text-slate-800' : 'text-slate-400'}`} />
            <span><span className="hidden sm:inline">Academic Details</span><span className="sm:hidden">Academic</span></span>
            {enrollments.length > 1 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-slate-200 text-slate-700">
                {enrollments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            aria-label="Fee Ledger"
            className={`py-1.5 px-2.5 sm:px-3 h-8.5 border-b-2 flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
              activeTab === 'finance'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white -mb-px'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 font-medium'
            }`}
          >
            <DollarSign className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'finance' ? 'text-slate-800' : 'text-slate-400'}`} />
            <span><span className="hidden sm:inline">Fee Ledger</span><span className="sm:hidden">Fees</span></span>
            {totalOutstanding > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                PKR {totalOutstanding.toLocaleString()}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            aria-label="Attendance & Results"
            className={`py-1.5 px-2.5 sm:px-3 h-8.5 border-b-2 flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white -mb-px'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 font-medium'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'attendance' ? 'text-slate-800' : 'text-slate-400'}`} />
            <span><span className="hidden sm:inline">Attendance & Results</span><span className="sm:hidden">Attendance</span></span>
            {attendanceMetrics.total > 0 && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-medium ${
                attendanceMetrics.isEligible ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {attendanceMetrics.percentage}%
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('status');
              setStatusTarget(currentStudent.status || 'active');
            }}
            aria-label="Status & Records"
            className={`py-1.5 px-2.5 sm:px-3 h-8.5 border-b-2 flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
              activeTab === 'status'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white -mb-px'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 font-medium'
            }`}
          >
            <History className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'status' ? 'text-slate-800' : 'text-slate-400'}`} />
            <span><span className="hidden sm:inline">Status & Records</span><span className="sm:hidden">Status</span></span>
            {currentStudent.status !== 'active' && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200 text-slate-700 capitalize">
                {currentStudent.status}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 space-y-4 sm:space-y-6 bg-slate-50/40">
          
          {/* TAB 1: ACADEMIC DETAILS */}
          {activeTab === 'academic' && (
            <div className="space-y-4 sm:space-y-5">
              {/* 2-Column Responsive Institutional Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* CARD 1: Academic & Enrollment Placement */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-slate-700" />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                        Academic Placement
                      </h3>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Session {activeBatch?.academic_session || '2026–2027'}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Program / Class</span>
                      <span className="font-bold text-slate-900 text-right truncate">{activeProgram?.name || 'Academic Class'}</span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">{isBatchSection ? 'Section' : 'Batch'}</span>
                      <span className="font-semibold text-slate-900 text-right truncate">{activeBatch?.name || '—'}</span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Shift & Timings</span>
                      <span className="font-mono text-slate-800 text-right text-[11px] truncate">
                        {activeBatch?.shift ? activeBatch.shift.toUpperCase() : 'MORNING'} {activeBatch?.start_time && activeBatch?.end_time ? `• ${activeBatch.start_time} – ${activeBatch.end_time}` : ''}
                      </span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Admission Date</span>
                      <span className="font-mono text-slate-800 text-right">{student.admission_date}</span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Roll / Admission #</span>
                      <span className="font-mono font-bold text-slate-900 text-right">{currentStudent.admission_number}</span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Monthly Tuition Fee</span>
                      <span className="font-mono font-bold text-slate-900 text-right">
                        PKR {Number(currentStudent.fee_structure?.base_tuition || activeBatch?.fee_amount || 0).toLocaleString()}
                        <span className="text-[10px] text-slate-400 font-sans font-normal ml-1">/mo</span>
                      </span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Academic Standing</span>
                      <span className="text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${
                          currentStudent.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : currentStudent.status === 'withdrawn'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            currentStudent.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`} />
                          {currentStudent.status || 'Active'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Transfer / Change Class Action Button */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                    {canManageAcademicStatus && (
                      <button
                        type="button"
                        onClick={() => {
                          if (primaryEnrollment) handleOpenTransferModal(primaryEnrollment);
                        }}
                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Transfer / Change Section</span>
                      </button>
                    )}
                    {canManageAcademicStatus && (
                      <button
                        type="button"
                        onClick={handleOpenAddClassModal}
                        className="py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-500" />
                        <span>Add Class</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* CARD 2: Family & Guardian Record */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-700" />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                        Guardian Particulars
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ({guardianRelation})
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Primary Guardian</span>
                      <span className="font-bold text-slate-900 text-right truncate">{student.guardian_name}</span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Guardian Mobile</span>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="font-mono font-bold text-slate-900 text-right">{student.guardian_phone}</span>
                        {student.guardian_phone && (
                          <div className="inline-flex items-center gap-1 shrink-0">
                            <a
                              href={`tel:${student.guardian_phone.replace(/[^0-9+]/g, '')}`}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                              title={`Call Guardian: ${student.guardian_phone}`}
                            >
                              <Phone className="w-3 h-3 text-slate-600" />
                            </a>
                            <a
                              href={`https://wa.me/${(student.guardian_whatsapp || student.guardian_phone).replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-6 h-6 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center transition-colors cursor-pointer"
                              title="WhatsApp Guardian"
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-700" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Guardian CNIC</span>
                      <span className="font-mono font-bold text-slate-900 text-right">
                        {student.guardian_id_card || <span className="text-slate-400 font-sans font-normal italic text-[11px]">Not assigned</span>}
                      </span>
                    </div>
                    {student.father_name && (
                      <div className="py-2 flex items-center justify-between gap-2">
                        <span className="text-slate-500 font-medium shrink-0">Father</span>
                        <span className="text-slate-900 text-right truncate">
                          <span className="font-semibold">{student.father_name}</span>
                          {student.father_cnic && <span className="text-[10px] font-mono text-slate-500 ml-1.5">({student.father_cnic})</span>}
                        </span>
                      </div>
                    )}
                    {student.mother_name && (
                      <div className="py-2 flex items-center justify-between gap-2">
                        <span className="text-slate-500 font-medium shrink-0">Mother</span>
                        <span className="text-slate-900 text-right truncate">
                          <span className="font-semibold">{student.mother_name}</span>
                          {student.mother_cnic && <span className="text-[10px] font-mono text-slate-500 ml-1.5">({student.mother_cnic})</span>}
                        </span>
                      </div>
                    )}
                    {(student.residential_address || student.city) && (
                      <div className="py-2 flex items-start justify-between gap-2">
                        <span className="text-slate-500 font-medium shrink-0">Residential Address</span>
                        <span className="text-slate-800 text-right text-[11px] max-w-[65%] break-words">
                          {student.residential_address}{student.city ? `, ${student.city}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CARD 3: Portal Access & Credentials */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-slate-700" />
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                          Portal Credentials
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    </div>

                    <div className="space-y-3 pt-2.5">
                      {/* Username */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mb-1">
                          <span>Username (Guardian CNIC)</span>
                          <span className="text-[10px] text-slate-400 font-sans">Login ID</span>
                        </div>
                        {currentStudent.guardian_id_card ? (
                          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                            <span className="font-mono font-bold text-slate-900 text-xs">{currentStudent.guardian_id_card}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(currentStudent.guardian_id_card!);
                                setCopiedCredentials(true);
                                setTimeout(() => setCopiedCredentials(false), 2000);
                              }}
                              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer flex items-center gap-1 text-xs"
                              title="Copy Login Identifier"
                            >
                              {copiedCredentials ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              <span className="text-[10px] text-slate-500">{copiedCredentials ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                            <div className="flex items-center gap-1.5 font-bold">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>No Guardian CNIC Assigned</span>
                            </div>
                            <span className="text-[10px] text-amber-700 mt-0.5 block">Guardian CNIC is required for guardian and student portal login.</span>
                          </div>
                        )}
                      </div>

                      {/* Password */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mb-1">
                          <span>Portal Password</span>
                          <span className="text-[10px] text-slate-400 font-sans">Status</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="font-mono text-xs text-slate-700 tracking-wider">••••••••••••</span>
                          </div>
                          <span className="text-[10px] text-slate-600 font-medium bg-white px-2 py-0.5 rounded border border-slate-200">
                            Encrypted
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                    {canManageAcademicStatus && (
                      <button
                        type="button"
                        onClick={() => {
                          setResetGuardianCnic(currentStudent.guardian_id_card || '');
                          setShowResetPasswordModal(true);
                          setResetSuccessData(null);
                          setResetErrorMsg(null);
                        }}
                        className="flex-1 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Key className="w-3.5 h-3.5 text-slate-300" />
                        <span>Reset Password</span>
                      </button>
                    )}

                    {currentStudent.guardian_id_card && (
                      <a
                        href={getWhatsAppCredentialsUrl(currentStudent.guardian_id_card)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors text-center cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Send Login Link</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* CARD 4: Personal Particulars & Identity */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-700" />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                        Personal Details
                      </h3>
                    </div>
                    {student.blood_group && (
                      <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Blood: {student.blood_group}
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Date of Birth</span>
                      <span className="font-mono text-slate-800 text-right">{student.date_of_birth || '—'}</span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Gender</span>
                      <span className="capitalize text-slate-800 text-right font-medium">{student.gender || '—'}</span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">B-Form / CRC #</span>
                      <span className="font-mono text-slate-800 text-right">{student.student_b_form || '—'}</span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Religion</span>
                      <span className="text-slate-800 text-right font-medium">{student.religion || '—'}</span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Previous School</span>
                      <span className="text-slate-800 text-right truncate max-w-[65%]">{student.previous_school || '—'}</span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Direct Phone</span>
                      <span className="font-mono text-slate-800 text-right">{student.phone || '—'}</span>
                    </div>
                    <div className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Direct Email</span>
                      <span className="font-mono text-slate-800 text-right truncate max-w-[65%]">{student.email || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary Class Enrollments (Multi-Class Support) */}
              {secondaryEnrollments.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-slate-700" />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                        Additional Enrolled Classes ({secondaryEnrollments.length})
                      </h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {secondaryEnrollments.map(enr => {
                      const prog = programs.find(p => p.id === enr.program_id);
                      const b = batches.find(x => x.id === enr.batch_id);
                      const bal = getEnrollmentBalance(enr.id, enr.batch_id);
                      const fee = getEnrollmentFee(enr, b);
                      const isActiveOrLeave = enr.status === 'active' || enr.status === 'on_leave';

                      return (
                        <div key={enr.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 block">{prog?.name || 'Academic Class'}</span>
                              <span className="text-slate-600 text-[11px] block">{b?.name || 'Section'} ({b?.shift || 'Morning'})</span>
                            </div>
                            <span className="font-mono font-bold text-slate-900 text-xs">PKR {fee.toLocaleString()}/mo</span>
                          </div>
                          {bal > 0 && (
                            <div className="text-[11px] font-mono font-semibold text-rose-700">
                              Outstanding Balance: PKR {bal.toLocaleString()}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200 flex-wrap">
                            {canManageAcademicStatus && isActiveOrLeave && (
                              <button
                                type="button"
                                onClick={() => handleMakePrimary(enr.id)}
                                className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-medium cursor-pointer"
                              >
                                Make Primary
                              </button>
                            )}
                            {canManageAcademicStatus && isActiveOrLeave && (
                              <button
                                type="button"
                                onClick={() => handleOpenTransferModal(enr)}
                                className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-medium cursor-pointer"
                              >
                                Transfer
                              </button>
                            )}
                            {canManageAcademicStatus && isActiveOrLeave && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLeaveClassEnrollment(enr);
                                  setLeaveClassStatus('withdrawn');
                                  setLeaveClassReason('');
                                  setLeaveClassCancelUnpaid(true);
                                  setLeaveClassError(null);
                                }}
                                className="px-2 py-0.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded text-[11px] font-medium cursor-pointer"
                              >
                                Leave Class
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Enrolled Subjects Card */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-slate-700" />
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <span>Enrolled Curriculum Subjects</span>
                        <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-800">
                          {editSubjectIds.length} of {availableClassSubjectIds.length} Enrolled
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Track: <strong className="text-slate-700">{activeElectiveGroup?.name || 'General Curriculum Stream'}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {!isManagingSubjects ? (
                      <button
                        type="button"
                        onClick={() => setIsManagingSubjects(true)}
                        className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit Subjects</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleDiscardSubjectChanges}
                          disabled={isSavingSubjects}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveSubjects}
                          disabled={isSavingSubjects || !hasSubjectChanges}
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          {isSavingSubjects ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notifications */}
                {editSubjectsSuccess && (
                  <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{editSubjectsSuccess}</span>
                  </div>
                )}
                {editSubjectsError && (
                  <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-rose-900 text-xs flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{editSubjectsError}</span>
                  </div>
                )}

                {/* Compact Institutional View Mode */}
                {!isManagingSubjects ? (
                  <div className="p-4">
                    {editSubjectIds.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        <BookOpen className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                        <p className="font-semibold text-slate-700">No subjects currently enrolled</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Click &ldquo;Edit Subjects&rdquo; to assign course subjects to this student.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {editSubjectIds.map(subId => {
                          const isCore = activeCompulsoryGroup?.subject_ids.includes(subId) ?? true;
                          const name = getSubjectName(subId);
                          const code = getSubjectCode(subId);
                          return (
                            <div key={subId} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 text-xs block truncate">{name}</span>
                                <span className="font-mono text-[10px] text-slate-500 block">{code}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                                isCore ? 'bg-slate-200/70 text-slate-700' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}>
                                {isCore ? 'Core' : 'Elective'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Edit Matrix Mode */
                  <div>
                    {/* Quick Selection Toolbar */}
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="font-medium text-slate-500">Quick Selection:</span>
                        {activeCompulsoryGroup && (
                          <button
                            type="button"
                            onClick={handleSelectCompulsorySubjects}
                            className="font-medium text-slate-700 hover:text-slate-900 hover:underline cursor-pointer"
                          >
                            Compulsory Only
                          </button>
                        )}
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={handleSelectAllSubjects}
                          className="font-medium text-slate-700 hover:text-slate-900 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={handleClearAllSubjects}
                          className="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>

                      {hasSubjectChanges && (
                        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Unsaved changes
                        </span>
                      )}
                    </div>

                    {/* Mobile Checklist View */}
                    <div className="divide-y divide-slate-100 sm:hidden">
                      {availableClassSubjectIds.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs italic">
                          No subjects configured for this class program.
                        </div>
                      ) : (
                        availableClassSubjectIds.map(subId => {
                          const isEnrolled = editSubjectIds.includes(subId);
                          const isCore = activeCompulsoryGroup?.subject_ids.includes(subId) ?? true;
                          const name = getSubjectName(subId);
                          const code = getSubjectCode(subId);

                          return (
                            <div
                              key={subId}
                              onClick={() => handleToggleSubject(subId)}
                              className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                isEnrolled ? 'bg-indigo-50/30' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isEnrolled}
                                  onChange={() => handleToggleSubject(subId)}
                                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-900 text-xs block truncate">{name}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="font-mono text-[10px] text-slate-500">{code}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                                      isCore ? 'bg-slate-100 text-slate-700' : 'bg-indigo-50 text-indigo-700'
                                    }`}>
                                      {isCore ? 'Core' : 'Elective'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span className={`text-[11px] font-medium shrink-0 ${isEnrolled ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {isEnrolled ? 'Enrolled' : 'Not Enrolled'}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                            <th className="py-2.5 px-4 w-12 text-center">Enrolled</th>
                            <th className="py-2.5 px-4">Subject Code</th>
                            <th className="py-2.5 px-4">Subject Title</th>
                            <th className="py-2.5 px-4">Type</th>
                            <th className="py-2.5 px-4">Curriculum Group</th>
                            <th className="py-2.5 px-4 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {availableClassSubjectIds.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400 text-xs italic">
                                No subjects configured for this class program.
                              </td>
                            </tr>
                          ) : (
                            availableClassSubjectIds.map(subId => {
                              const isEnrolled = editSubjectIds.includes(subId);
                              const isCore = activeCompulsoryGroup?.subject_ids.includes(subId) ?? true;
                              const name = getSubjectName(subId);
                              const code = getSubjectCode(subId);
                              const groupName = allProgramSubjectGroups.find(g => g.subject_ids.includes(subId))?.name || (isCore ? 'Core Curriculum' : (activeElectiveGroup?.name || 'Elective Stream'));

                              return (
                                <tr
                                  key={subId}
                                  onClick={() => handleToggleSubject(subId)}
                                  className={`cursor-pointer transition-colors ${
                                    isEnrolled ? 'bg-indigo-50/20 hover:bg-indigo-50/40' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <td className="py-2.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isEnrolled}
                                      onChange={() => handleToggleSubject(subId)}
                                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-700">{code}</td>
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
                                  <td className="py-2.5 px-4 text-slate-600 font-medium">{groupName}</td>
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
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Document Checklist */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-slate-600" />
                    <span>Document Checklist</span>
                  </h3>
                </div>

                {studentDocHeads.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 text-slate-500 text-xs">
                    <FileCheck className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                    <p className="font-semibold text-slate-700">No document checklist heads defined.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Configure required certificates in Academy Settings to track verification status.</p>
                  </div>
                ) : (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {studentDocHeads.map((head: DocumentChecklistHead) => {
                      const status = currentStudent.submitted_documents?.[head.code] || 'pending';
                      const isBusy = updatingDocCode === head.code;
                      return (
                        <div
                          key={head.code}
                          className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between gap-2.5"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">{head.title}</span>
                              <span className="text-[10px] font-mono text-slate-400 block">{head.code}</span>
                            </div>
                            {head.is_required && (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded shrink-0">Mandatory</span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-slate-200 text-[11px] font-bold">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUpdateDocumentStatus(head.code, 'submitted')}
                              className={`py-1 rounded text-center transition-colors cursor-pointer ${
                                status === 'submitted'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                            >
                              Submitted
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUpdateDocumentStatus(head.code, 'pending')}
                              className={`py-1 rounded text-center transition-colors cursor-pointer ${
                                status === 'pending'
                                  ? 'bg-amber-500 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                            >
                              Pending
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUpdateDocumentStatus(head.code, 'exempted')}
                              className={`py-1 rounded text-center transition-colors cursor-pointer ${
                                status === 'exempted'
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
                      type="button"
                      onClick={() => {
                        onClose();
                        const targetHash = `#fees?student_id=${encodeURIComponent(currentStudent.id)}`;
                        if (window.location.hash === targetHash) {
                          window.dispatchEvent(new HashChangeEvent('hashchange'));
                        } else {
                          window.location.hash = targetHash;
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      title="Route to Fee Desk for fee collection and cashier operations"
                    >
                      <span>Go to Fee Desk</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-3 text-left">
                  <div className="sm:border-r border-slate-100 sm:pr-4">
                    <span className="text-slate-500 text-[10px] sm:text-[11px] font-medium block">Total Invoiced</span>
                    <div className="text-sm sm:text-lg font-bold text-slate-900 font-mono mt-0.5">
                      PKR {totalBilled.toLocaleString()}
                    </div>
                  </div>

                  <div className="sm:border-r border-slate-100 sm:pr-4">
                    <span className="text-slate-500 text-[10px] sm:text-[11px] font-medium block">Total Paid</span>
                    <div className="text-sm sm:text-lg font-bold text-emerald-700 font-mono mt-0.5">
                      PKR {totalPaid.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] sm:text-[11px] font-medium block">Balance Due</span>
                    <div className={`text-sm sm:text-lg font-bold font-mono mt-0.5 ${
                      totalOutstanding > 0 ? 'text-rose-700' : 'text-slate-800'
                    }`}>
                      PKR {totalOutstanding.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee Structure Note */}
              {currentStudent.fee_structure && (
                <div className="p-3.5 bg-white border border-slate-200 rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 block">Fee Structure</span>
                    <div className="text-slate-600 font-mono text-[11px] flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Tuition: <strong>PKR {Number(currentStudent.fee_structure.base_tuition || 0).toLocaleString()}/mo</strong></span>
                      {Boolean(currentStudent.fee_structure.admission_fee) && (
                        <>
                          <span>•</span>
                          <span>Admission: <strong>PKR {Number(currentStudent.fee_structure.admission_fee || 0).toLocaleString()}</strong></span>
                        </>
                      )}
                      {Boolean(currentStudent.fee_structure.exam_fee) && (
                        <>
                          <span>•</span>
                          <span>Exam: <strong>PKR {Number(currentStudent.fee_structure.exam_fee || 0).toLocaleString()}</strong></span>
                        </>
                      )}
                      {Array.isArray(currentStudent.fee_structure.custom_heads) && currentStudent.fee_structure.custom_heads.map((ch: any, idx: number) => (
                        <span key={idx} className="flex items-center gap-1">
                          <span>•</span>
                          <span>{ch.head_name || ch.name || 'Head'}: <strong>PKR {Number(ch.amount || 0).toLocaleString()}</strong></span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {currentStudent.fee_structure.concession_val ? (
                    <div className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium text-[11px]">
                      Concession: <strong>{currentStudent.fee_structure.concession_type === 'percentage' ? `${currentStudent.fee_structure.concession_val}%` : `PKR ${currentStudent.fee_structure.concession_val}`}</strong> {currentStudent.fee_structure.concession_category ? `[${currentStudent.fee_structure.concession_category.toUpperCase()}]` : ''} ({currentStudent.fee_structure.concession_reason || 'Approved'})
                    </div>
                  ) : null}
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
                    {invoices.length} {invoices.length === 1 ? 'Challan' : 'Challans'}
                  </span>
                </div>

                {/* Mobile Challan Card List */}
                <div className="divide-y divide-slate-100 sm:hidden">
                  {invoices.map(inv => {
                    const netPayable = inv.net_total ?? inv.net_amount ?? 0;
                    const balanceDue = inv.balance_due ?? inv.balance_amount ?? 0;
                    const isPaid = inv.status === 'PAID' || (inv.status as string) === 'paid';
                    const isPartial = inv.status === 'PARTIAL' || (inv.status as string) === 'partially_paid';

                    return (
                      <div key={inv.id} className="p-3.5 space-y-2.5 bg-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-slate-900 text-xs">{inv.invoice_number}</span>
                            <span className="text-slate-500 text-[11px] block font-medium">{inv.billing_month}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : isPartial
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}>
                            {inv.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-slate-50 rounded-lg text-center text-xs border border-slate-100">
                          <div>
                            <span className="text-slate-400 text-[10px] block font-medium">Billed</span>
                            <span className="font-mono font-semibold text-slate-800">PKR {netPayable.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block font-medium">Paid</span>
                            <span className="font-mono font-semibold text-emerald-700">PKR {inv.paid_amount.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block font-medium">Balance</span>
                            <span className={`font-mono font-bold ${balanceDue > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                              PKR {balanceDue.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>Due: <strong className="font-mono text-slate-700">{inv.due_date}</strong></span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setChallanInvoice(inv)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Print A4 3-Part Bank Challan"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-500" />
                              <span>Print Challan</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {invoices.length === 0 && !isLoadingFinance && (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No challans generated yet for this student.
                    </div>
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
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
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setChallanInvoice(inv)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                title="Print A4 3-Part Bank Challan"
                              >
                                <Printer className="w-3.5 h-3.5 text-slate-500" />
                                <span>Print Challan</span>
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

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-4 pt-3 text-left">
                  <div className="p-2 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg sm:rounded-none">
                    <span className="text-slate-500 text-[10px] sm:text-[11px] block">Overall Attendance</span>
                    <div className={`text-base sm:text-lg font-bold ${attendanceMetrics.isEligible ? 'text-emerald-700' : 'text-rose-700'} font-mono mt-0.5`}>
                      {attendanceMetrics.total === 0 ? '—' : `${attendanceMetrics.percentage}%`}
                    </div>
                  </div>
                  <div className="p-2 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg sm:rounded-none">
                    <span className="text-slate-500 text-[10px] sm:text-[11px] block">Working Days</span>
                    <div className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5">{attendanceMetrics.total} <span className="text-xs font-sans font-normal text-slate-500">Days</span></div>
                  </div>
                  <div className="p-2 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg sm:rounded-none">
                    <span className="text-slate-500 text-[10px] sm:text-[11px] block">Present</span>
                    <div className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5">{attendanceMetrics.present} <span className="text-xs font-sans font-normal text-slate-500">Days</span></div>
                  </div>
                  <div className="p-2 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg sm:rounded-none">
                    <span className="text-slate-500 text-[10px] sm:text-[11px] block">Late</span>
                    <div className="text-base sm:text-lg font-bold text-amber-700 font-mono mt-0.5">{attendanceMetrics.late} <span className="text-xs font-sans font-normal text-slate-500">Days</span></div>
                  </div>
                  <div className="p-2 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg sm:rounded-none">
                    <span className="text-slate-500 text-[10px] sm:text-[11px] block">Excused</span>
                    <div className="text-base sm:text-lg font-bold text-indigo-700 font-mono mt-0.5">{attendanceMetrics.excused} <span className="text-xs font-sans font-normal text-slate-500">Days</span></div>
                  </div>
                  <div className="p-2 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg sm:rounded-none">
                    <span className="text-slate-500 text-[10px] sm:text-[11px] block">Absences</span>
                    <div className="text-base sm:text-lg font-bold text-rose-700 font-mono mt-0.5">{attendanceMetrics.absent} <span className="text-xs font-sans font-normal text-slate-500">Days</span></div>
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
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs font-mono">Loading live attendance records...</p>
                  </div>
                ) : attendanceLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-bold text-slate-700">No attendance records on file</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Attendance records marked in the Attendance Desk will appear here.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Attendance Logs List */}
                    <div className="divide-y divide-slate-100 sm:hidden">
                      {attendanceLogs.map(log => {
                        let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (log.status === 'present') badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                        if (log.status === 'absent') badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';
                        if (log.status === 'late') badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                        if (log.status === 'excused') badgeStyle = 'bg-indigo-50 text-indigo-800 border-indigo-200';

                        return (
                          <div key={log.id} className="py-2.5 px-3.5 flex items-center justify-between text-xs hover:bg-slate-50">
                            <div>
                              <div className="font-mono font-medium text-slate-900">{log.date}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span>{log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No check-in'}</span>
                                <span>•</span>
                                <span>{log.marked_by || 'Staff'}</span>
                              </div>
                              {log.remarks && <p className="text-[10px] text-slate-500 italic mt-0.5">{log.remarks}</p>}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize border ${badgeStyle} shrink-0`}>
                              {log.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto">
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
                  </>
                )}
              </div>

              {/* Examination Transcript */}
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Examination Transcript
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Published marks and official grades from term, monthly, and midterm assessments.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-800 font-bold">
                      {examStats.count} published result{examStats.count === 1 ? '' : 's'}
                    </span>
                    {examStats.count > 0 && examStats.totalMarks > 0 && (
                      <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 font-bold">
                        {examStats.obtainedMarks}/{examStats.totalMarks} ({examStats.percentage}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile Examination Results List */}
                <div className="divide-y divide-slate-100 sm:hidden">
                  {examRows.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No graded examinations for this student yet.
                    </div>
                  ) : (
                    examRows.map(row => (
                      <div key={row.title + row.date} className="p-3.5 space-y-2 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-semibold text-slate-900 text-xs block">{row.title}</span>
                            <span className="font-mono text-[11px] text-slate-500">{row.date}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 shrink-0">
                            {row.grade}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50">
                          <span className="text-slate-500">Marks: <strong className="font-mono text-slate-900">{row.obtained}</strong> / {row.total}</span>
                          {row.remarks && <span className="text-slate-500 italic text-[11px] truncate max-w-[55%]">{row.remarks}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
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

          {/* TAB 4: STATUS & RECORDS */}
          {activeTab === 'status' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Top Banner / Current Status */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold border uppercase tracking-wider ${
                    currentStudent.status === 'active'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : currentStudent.status === 'withdrawn'
                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                      : currentStudent.status === 'suspended'
                      ? 'bg-red-50 text-red-800 border-red-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}>
                    {currentStudent.status || 'Active'}
                  </span>
                  {currentStudent.status_reason && (
                    <span className="text-xs text-slate-500 italic">({currentStudent.status_reason})</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-3">
                  <span>Admission: <strong className="font-mono text-slate-700">{currentStudent.admission_date || '—'}</strong></span>
                  {currentStudent.updated_at && (
                    <span>Updated: <strong className="font-mono text-slate-700">{new Date(currentStudent.updated_at).toLocaleDateString()}</strong></span>
                  )}
                </div>
              </div>

              {/* Status Update Card */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    Update Student Status
                  </h3>
                </div>

                <form onSubmit={handleUpdateStatus} className="p-4 sm:p-5 space-y-3.5">
                  {statusSuccessMsg && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{statusSuccessMsg}</span>
                    </div>
                  )}

                  {statusErrorMsg && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{statusErrorMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        New Status <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={statusTarget}
                        onChange={(e) => setStatusTarget(e.target.value as StudentStatus)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-medium"
                      >
                        <option value="active">Active</option>
                        <option value="on_leave">On Leave</option>
                        <option value="suspended">Suspended</option>
                        <option value="withdrawn">Withdrawn</option>
                        <option value="alumni">Alumni / Graduated</option>
                        <option value="waitlisted">Waitlisted</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Billing Option
                      </label>
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cancelUnpaidInvoices}
                            onChange={(e) => setCancelUnpaidInvoices(e.target.checked)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                          />
                          <span className="text-xs text-slate-700 font-medium">
                            Cancel unpaid invoices on withdrawal
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Reason <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      placeholder="e.g. Relocated to another city, fee default, completed course"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-sans"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={isUpdatingStatus || !statusReason.trim()}
                      className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>{isUpdatingStatus ? 'Saving...' : 'Update Status'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Status Change History */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    Status History
                  </h3>
                  <History className="w-4 h-4 text-slate-400" />
                </div>

                {/* Mobile Status History List */}
                <div className="divide-y divide-slate-100 sm:hidden">
                  {(!currentStudent.status_change_history || currentStudent.status_change_history.length === 0) ? (
                    <div className="py-6 px-4 text-center text-slate-400 text-xs">
                      No status changes recorded.
                    </div>
                  ) : (
                    currentStudent.status_change_history.map((h, idx) => (
                      <div key={idx} className="p-3 space-y-1.5 bg-white text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-slate-500">{new Date(h.changed_at).toLocaleDateString()}</span>
                          <span className="font-mono text-slate-400 text-[10px]">{h.changed_by}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 uppercase">
                            {h.previous_status}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase border ${
                            h.new_status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : h.new_status === 'withdrawn'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}>
                            {h.new_status}
                          </span>
                        </div>
                        {h.reason && (
                          <p className="text-slate-700 text-[11px]">{h.reason}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Previous Status</th>
                        <th className="py-2.5 px-4">New Status</th>
                        <th className="py-2.5 px-4">Reason</th>
                        <th className="py-2.5 px-4">Updated By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(!currentStudent.status_change_history || currentStudent.status_change_history.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                            No status changes recorded.
                          </td>
                        </tr>
                      ) : (
                        currentStudent.status_change_history.map((h, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                              {new Date(h.changed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
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

              {/* Class & Section Transfer History */}
              {currentStudent.transfer_history && currentStudent.transfer_history.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                      <span>Class & Section Transfer History</span>
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500">
                      {currentStudent.transfer_history.length} {currentStudent.transfer_history.length === 1 ? 'Record' : 'Records'}
                    </span>
                  </div>
                  {/* Mobile Timeline Cards */}
                  <div className="divide-y divide-slate-100 sm:hidden">
                    {currentStudent.transfer_history.map((t, idx) => {
                      const fromB = batches.find(b => b.id === t.from_batch_id)?.name || t.from_batch_id;
                      const toB = batches.find(b => b.id === t.to_batch_id)?.name || t.to_batch_id;
                      return (
                        <div key={(t as any).id || idx} className="py-2.5 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-slate-500">{t.effective_date}</span>
                            <span className="font-mono text-[10px] text-slate-400">{t.changed_by || 'Administration'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span className="text-rose-700">{fromB}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-emerald-700">{toB}</span>
                          </div>
                          {t.reason && <p className="text-slate-600 text-[11px] italic">{t.reason}</p>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Effective Date</th>
                          <th className="py-2 px-3">From Section</th>
                          <th className="py-2 px-3">To Section</th>
                          <th className="py-2 px-3">Reason</th>
                          <th className="py-2 px-3">Authorized By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {currentStudent.transfer_history.map((t, idx) => {
                          const fromB = batches.find(b => b.id === t.from_batch_id)?.name || t.from_batch_id;
                          const toB = batches.find(b => b.id === t.to_batch_id)?.name || t.to_batch_id;
                          return (
                            <tr key={(t as any).id || idx} className="hover:bg-slate-50/60">
                              <td className="py-2 px-3 font-mono text-slate-600">{t.effective_date}</td>
                              <td className="py-2 px-3 text-rose-700 font-medium">{fromB}</td>
                              <td className="py-2 px-3 text-emerald-700 font-medium">{toB}</td>
                              <td className="py-2 px-3 text-slate-600">{t.reason || '—'}</td>
                              <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{t.changed_by || 'Administration'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Administrative Actions */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    Administrative Actions
                  </h3>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* View Audit Trail */}
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Activity Log</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          View profile edit history.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          fetchAuditLogs();
                          setShowAuditLogsModal(true);
                        }}
                        className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5 text-slate-500" />
                        <span>View Log</span>
                      </button>
                    </div>

                    {/* Student Identity Card */}
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Student ID Card</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Print card with photo & QR.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIdCardEnrollmentId(undefined);
                          setShowIdCardModal(true);
                        }}
                        className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                        <span>Print ID Card</span>
                      </button>
                    </div>

                    {/* Archive / Restore */}
                    {canManageAcademicStatus && (
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between gap-2.5">
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            {currentStudent.status === 'archived' ? 'Restore Student' : 'Archive Student'}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {currentStudent.status === 'archived'
                              ? 'Restore student to active lists.'
                              : 'Hide from active lists while keeping records.'}
                          </p>
                        </div>
                        {currentStudent.status === 'archived' ? (
                          <button
                            type="button"
                            onClick={handleUnarchiveFromModal}
                            disabled={isArchivingStudent}
                            className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isArchivingStudent ? 'Restoring...' : 'Restore'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowArchiveDialog(true)}
                            className="py-1.5 px-3 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5 text-amber-600" />
                            <span>Archive Student</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Delete (Admin Only) */}
                    {isAdmin && (
                      <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/40 flex flex-col justify-between gap-2.5">
                        <div>
                          <span className="text-xs font-bold text-rose-800 block">Delete Student</span>
                          <p className="text-[11px] text-rose-600 mt-0.5">
                            Permanently delete student record.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteModalForce(false);
                            setDeleteModalRequiresForce(false);
                            setDeleteModalError(null);
                            setShowDeleteDialog(true);
                          }}
                          className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Student</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 px-6 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span>Admission Date:</span>
            <span className="font-mono text-slate-900 font-semibold">{student.admission_date}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* FEE CHALLAN PRINT MODAL */}
      {challanInvoice && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto m-0 no-sheet-overlay">
          <div className="bg-white rounded-lg max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-slate-300 space-y-4 my-auto print:border-none print:shadow-none print:p-0">
            {/* Modal Toolbar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Printer className="w-5 h-5 text-slate-700 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm truncate">
                    Fee Challan — {challanInvoice.invoice_number}
                  </h3>
                  <span className="text-[11px] text-slate-500 block truncate">
                    Month: {challanInvoice.billing_month} • Due Date: {challanInvoice.due_date}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => window.print()}
                  className="px-3 sm:px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span><span className="hidden sm:inline">Print Challan (A4 Landscape)</span><span className="sm:hidden">Print</span></span>
                </button>
                <button
                  onClick={() => setChallanInvoice(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Fee Challan Grid: Stacks on mobile viewport, columns on desktop and print */}
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
                    <h4 className="font-bold text-xs uppercase text-slate-950 mt-1 line-clamp-1">
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
                      <div className="text-slate-700 font-mono text-[8px]">Adm: {student.admission_number}</div>
                      <div className="text-slate-700 text-[8px]">Class: {activeProgram?.name || '—'} • {isBatchSection ? 'Section' : 'Batch'}: {activeBatch?.name || '—'}</div>
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
                        <div className="flex justify-between font-bold text-slate-950 text-xs">
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



      {/* EDIT PARTICULARS MODAL */}
      {showEditParticularsModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5 m-0 mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-xl max-w-2xl w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90dvh] mobile-sheet-card">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-slate-300" />
                  Edit Student Particulars
                </h2>
                <p className="text-[11px] text-slate-300">
                  {currentStudent.full_name} • Admission: {currentStudent.admission_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditParticularsModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
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
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Student Phone (Optional)</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      placeholder="0300-1234567"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Student WhatsApp (Optional)</label>
                    <input
                      type="text"
                      value={editStudentWhatsapp}
                      onChange={e => setEditStudentWhatsapp(e.target.value)}
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

              {/* Academic Placement & Section Transfer */}
              <div className="space-y-3 pb-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-600" />
                    <span>Academic Placement & Section Transfer</span>
                  </h4>
                  {editBatchId !== currentStudent.batch_id && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      Transfer Pending
                    </span>
                  )}
                </div>

                {editParticularsError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="leading-tight">{editParticularsError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Academic Class / Program *
                    </label>
                    <select
                      value={editProgramId || ''}
                      onChange={e => {
                        const newProgId = e.target.value;
                        setEditProgramId(newProgId);
                        const pBatches = batches.filter(b => b.program_id === newProgId);
                        if (pBatches.length > 0 && !pBatches.some(b => b.id === editBatchId)) {
                          setEditBatchId(pBatches[0].id);
                        }
                        const electives = subjectGroups.filter(g => g.program_id === newProgId && g.type === 'elective_track');
                        if (electives.length > 0 && !electives.some(g => g.id === editElectiveGroupId)) {
                          setEditElectiveGroupId(electives[0].id);
                        } else if (electives.length === 0) {
                          setEditElectiveGroupId('');
                        }
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium bg-white"
                    >
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Batch / Section *
                    </label>
                    <select
                      value={editBatchId || ''}
                      onChange={e => {
                        setEditBatchId(e.target.value);
                        setEditParticularsError(null);
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium bg-white"
                    >
                      {batches
                        .filter(b => !editProgramId || b.program_id === editProgramId)
                        .map(b => {
                          const isCurrent = b.id === currentStudent.batch_id;
                          const isFull = !isCurrent && b.max_capacity > 0 && (b.current_enrollment || 0) >= b.max_capacity;
                          return (
                            <option key={b.id} value={b.id} disabled={isFull}>
                              {b.name} ({b.shift}) {isFull ? `[FULL: ${b.current_enrollment}/${b.max_capacity}]` : `(${b.current_enrollment || 0}/${b.max_capacity || '∞'})`}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Elective Track Stream
                    </label>
                    <select
                      value={editElectiveGroupId}
                      onChange={e => setEditElectiveGroupId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium bg-white"
                    >
                      <option value="">-- General / Core Only --</option>
                      {subjectGroups
                        .filter(g => g.program_id === editProgramId && g.type === 'elective_track')
                        .map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Section Transfer Sub-Panel (Only displays when batch has changed) */}
                {editBatchId !== currentStudent.batch_id && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3 mt-2 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                      <ArrowRightLeft className="w-4 h-4 text-slate-600" />
                      <span>Class Transfer Details & Fee Allocation</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                          Effective Transfer Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={editTransferDate}
                          onChange={e => setEditTransferDate(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-slate-900 font-mono"
                        />
                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                          Attendance & gradebook records transition from this date forward.
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                          Administrative Reason *
                        </label>
                        <input
                          type="text"
                          required
                          value={editTransferReason}
                          onChange={e => setEditTransferReason(e.target.value)}
                          placeholder="e.g. Schedule clash, academic stream transfer"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    {/* Tuition Fee Adjustment Options */}
                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <label className="block text-[10.5px] font-bold text-slate-800">
                        Monthly Tuition Fee Policy
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <label className={`p-2.5 rounded border text-xs cursor-pointer transition-colors ${editFeeMode === 'keep_current' ? 'bg-white border-slate-900 shadow-xs' : 'bg-white/60 border-slate-200 hover:bg-white'}`}>
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="editFeeMode"
                              checked={editFeeMode === 'keep_current'}
                              onChange={() => setEditFeeMode('keep_current')}
                              className="text-slate-900 focus:ring-slate-900"
                            />
                            <span className="font-semibold text-slate-900">Keep Current Fee</span>
                          </div>
                          <span className="text-[10.5px] text-slate-500 block mt-1">
                            Carry forward locked agreed fee without rate increase.
                          </span>
                        </label>

                        <label className={`p-2.5 rounded border text-xs cursor-pointer transition-colors ${editFeeMode === 'batch_standard' ? 'bg-white border-slate-900 shadow-xs' : 'bg-white/60 border-slate-200 hover:bg-white'}`}>
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="editFeeMode"
                              checked={editFeeMode === 'batch_standard'}
                              onChange={() => setEditFeeMode('batch_standard')}
                              className="text-slate-900 focus:ring-slate-900"
                            />
                            <span className="font-semibold text-slate-900">New Batch Standard</span>
                          </div>
                          <span className="text-[10.5px] text-slate-500 block mt-1">
                            Rs. {batches.find(b => b.id === editBatchId)?.fee_amount?.toLocaleString() || 0} / month
                          </span>
                        </label>

                        <label className={`p-2.5 rounded border text-xs cursor-pointer transition-colors ${editFeeMode === 'custom' ? 'bg-white border-slate-900 shadow-xs' : 'bg-white/60 border-slate-200 hover:bg-white'}`}>
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="editFeeMode"
                              checked={editFeeMode === 'custom'}
                              onChange={() => setEditFeeMode('custom')}
                              className="text-slate-900 focus:ring-slate-900"
                            />
                            <span className="font-semibold text-slate-900">Custom Negotiated</span>
                          </div>
                          {editFeeMode === 'custom' && (
                            <div className="mt-1.5">
                              <input
                                type="number"
                                min="0"
                                value={editCustomFeeAmount}
                                onChange={e => setEditCustomFeeAmount(e.target.value)}
                                placeholder="Fee in PKR"
                                className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white font-mono"
                              />
                            </div>
                          )}
                        </label>
                      </div>
                    </div>

                    {/* Unpaid Challans & Arrears Note */}
                    <div className="pt-2 border-t border-slate-200 space-y-1">
                      <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editUpdateUnpaidChallans}
                          onChange={e => setEditUpdateUnpaidChallans(e.target.checked)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 mt-0.5"
                        />
                        <div>
                          <span className="font-semibold text-slate-800 block text-xs">
                            Update unpaid fee challan(s) to new batch rate
                          </span>
                          <span className="text-[10.5px] text-slate-600 leading-tight block mt-0.5">
                            Automatically updates pending challans for this class. Past arrears from previous months remain locked on the student ledger and roll forward onto future challans.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Student Demographics & Identification */}
              <div className="space-y-3 pb-3 border-b border-slate-200">
                <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Demographics & Academic Background</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editDob}
                      onChange={e => setEditDob(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gender</label>
                    <select
                      value={editGender}
                      onChange={e => setEditGender(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium bg-white"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Student B-Form / CNIC</label>
                    <input
                      type="text"
                      value={editStudentBForm}
                      onChange={e => setEditStudentBForm(e.target.value)}
                      placeholder="35201-1234567-1"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Religion</label>
                    <input
                      type="text"
                      value={editReligion}
                      onChange={e => setEditReligion(e.target.value)}
                      placeholder="Religion"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Previous School / Academy</label>
                    <input
                      type="text"
                      value={editPreviousSchool}
                      onChange={e => setEditPreviousSchool(e.target.value)}
                      placeholder="Previous school name"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Residential Location */}
              <div className="space-y-3 pb-3 border-b border-slate-200">
                <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Residential Location</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={editResidentialAddress}
                      onChange={e => setEditResidentialAddress(e.target.value)}
                      placeholder="House / Street / Sector"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={e => setEditCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Dual Parent Particulars */}
              <div className="space-y-3 pb-3 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Parent Particulars</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-semibold text-slate-600">Primary Contact:</span>
                    <select
                      value={editPrimaryContact}
                      onChange={e => setEditPrimaryContact(e.target.value)}
                      className="px-2 py-1 border border-slate-300 rounded text-xs font-medium bg-white text-slate-800"
                    >
                      <option value="father">Father</option>
                      <option value="mother">Mother</option>
                      <option value="guardian">Guardian</option>
                    </select>
                  </div>
                </div>

                {/* Father Details */}
                <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">Father Particulars</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Father Name</label>
                      <input
                        type="text"
                        value={editFatherName}
                        onChange={e => setEditFatherName(e.target.value)}
                        placeholder="Father full name"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Father CNIC</label>
                      <input
                        type="text"
                        value={editFatherCnic}
                        onChange={e => setEditFatherCnic(e.target.value)}
                        placeholder="35201-XXXXXXX-X"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Father Phone</label>
                      <input
                        type="text"
                        value={editFatherPhone}
                        onChange={e => setEditFatherPhone(e.target.value)}
                        placeholder="0300-1234567"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Occupation</label>
                      <input
                        type="text"
                        value={editFatherOccupation}
                        onChange={e => setEditFatherOccupation(e.target.value)}
                        placeholder="Occupation"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Mother Details */}
                <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">Mother Particulars</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Mother Name</label>
                      <input
                        type="text"
                        value={editMotherName}
                        onChange={e => setEditMotherName(e.target.value)}
                        placeholder="Mother full name"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Mother CNIC</label>
                      <input
                        type="text"
                        value={editMotherCnic}
                        onChange={e => setEditMotherCnic(e.target.value)}
                        placeholder="35201-XXXXXXX-X"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Mother Phone</label>
                      <input
                        type="text"
                        value={editMotherPhone}
                        onChange={e => setEditMotherPhone(e.target.value)}
                        placeholder="0300-1234567"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Occupation</label>
                      <input
                        type="text"
                        value={editMotherOccupation}
                        onChange={e => setEditMotherOccupation(e.target.value)}
                        placeholder="Occupation"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
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
                      <option value="">Select Relation</option>
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
                      Guardian CNIC
                    </label>
                    <input
                      type="text"
                      value={editGuardianIdCard}
                      onChange={e => setEditGuardianIdCard(e.target.value)}
                      placeholder="35201-1234567-1"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-2 pb-3 border-b border-slate-200">
                <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Emergency Contact Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={editEmergencyName}
                      onChange={e => setEditEmergencyName(e.target.value)}
                      placeholder="Contact Full Name"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={editEmergencyPhone}
                      onChange={e => setEditEmergencyPhone(e.target.value)}
                      placeholder="0300-1234567"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Relationship</label>
                    <select
                      value={editEmergencyRelation}
                      onChange={e => setEditEmergencyRelation(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden bg-white"
                    >
                      <option value="">Select Relation</option>
                      {['Uncle', 'Aunt', 'Mother', 'Father', 'Brother', 'Sister', 'Grandfather', 'Grandmother', 'Relative', 'Neighbor', 'Family Friend', 'Other'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Custom Fields (Key / Value) */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Custom Profile Attributes</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Board Registration / Enrollment No.</label>
                    <input
                      type="text"
                      value={editCustomFields.board_registration || ''}
                      onChange={e => setEditCustomFields(prev => ({ ...prev, board_registration: e.target.value }))}
                      placeholder="Board registration number"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Previous Marks / Grade</label>
                    <input
                      type="text"
                      value={editCustomFields.previous_marks || ''}
                      onChange={e => setEditCustomFields(prev => ({ ...prev, previous_marks: e.target.value }))}
                      placeholder="Grade or marks"
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
                  className="px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
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
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5 m-0 mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-xl max-w-lg w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col mobile-sheet-card max-h-[90dvh]">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold leading-tight">Reset Student Portal Password</h2>
                  <p className="text-[11px] text-slate-300">
                    {currentStudent.full_name} • Adm: {currentStudent.admission_number}
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
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-lg cursor-pointer"
                aria-label="Close"
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
                    <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-200 text-sm">
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
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
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
                    <label className="text-xs font-semibold text-slate-700">Username (Father / Guardian CNIC)</label>
                    <span className="text-[10px] text-slate-500 font-mono">National ID Card</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={resetGuardianCnic}
                    onChange={e => setResetGuardianCnic(e.target.value)}
                    placeholder="35201-1234567-1"
                    className="w-full px-3 py-2 bg-slate-50/50 border border-slate-300 rounded-lg font-mono font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all text-xs"
                  />
                </div>

                {/* Password Selection */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-semibold text-slate-700 block">Password Option</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setResetPasswordType('default')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        resetPasswordType === 'default'
                          ? 'border-slate-900 bg-slate-50 text-slate-900 font-semibold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs">Standard Default</span>
                        {resetPasswordType === 'default' && <CheckCircle2 className="w-3.5 h-3.5 text-slate-900" />}
                      </div>
                      <span className="font-mono text-xs text-slate-900 block font-semibold">Student@123</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setResetPasswordType('custom')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        resetPasswordType === 'custom'
                          ? 'border-slate-900 bg-slate-50 text-slate-900 font-semibold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs">Custom Password</span>
                        {resetPasswordType === 'custom' && <CheckCircle2 className="w-3.5 h-3.5 text-slate-900" />}
                      </div>
                      <span className="text-[11px] text-slate-500 block">Enter temporary password</span>
                    </button>
                  </div>
                </div>

                {resetPasswordType === 'custom' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Custom Temporary Password</label>
                    <input
                      type="text"
                      required
                      value={customResetPassword}
                      onChange={e => setCustomResetPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900 text-xs"
                    />
                  </div>
                )}

                {/* Audit Reason */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Administrative Reason (Audit Log)</label>
                  <input
                    type="text"
                    required
                    value={resetReason}
                    onChange={e => setResetReason(e.target.value)}
                    placeholder="Reason for password reset"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-800 text-xs"
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
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Key className="w-3.5 h-3.5 text-slate-300" />
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
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5 m-0 mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-xl max-w-3xl w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90dvh] mobile-sheet-card">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  Student Profile Audit Trail
                </h2>
                <p className="text-[11px] text-slate-300">
                  {currentStudent.full_name} • Admission: {currentStudent.admission_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditLogsModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
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
                className="px-4 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE STUDENT CONFIRMATION MODAL */}
      {showArchiveDialog && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-5 m-0 animate-in fade-in duration-150 mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-xl max-w-lg w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col mobile-sheet-card max-h-[90dvh]">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-slate-300" />
                <h2 className="text-sm font-bold">Archive Student Record</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowArchiveDialog(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 overflow-y-auto">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-slate-900">
                  <AlertTriangle className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Archiving Student: {currentStudent.full_name}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-700">
                  Admission No: <strong className="font-mono">{currentStudent.admission_number}</strong>
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Archiving marks this student as inactive and releases their seat in the batch roster. All academic history, exam marks, and fee ledgers remain preserved.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrative Reason <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={archiveModalReason}
                  onChange={e => setArchiveModalReason(e.target.value)}
                  placeholder="e.g., Transfer to another academy, Completed session"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={archiveModalCancelUnpaid}
                    onChange={e => setArchiveModalCancelUnpaid(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-xs text-slate-800 font-medium leading-relaxed">
                    Cancel unpaid invoices on archive
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 p-3.5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowArchiveDialog(false)}
                className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveFromModal}
                disabled={isArchivingStudent || !archiveModalReason.trim()}
                className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Archive className="w-3.5 h-3.5 text-slate-300" />
                <span>{isArchivingStudent ? 'Archiving...' : 'Archive Student'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* DELETE STUDENT CONFIRMATION MODAL */}
      {showDeleteDialog && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-5 m-0 animate-in fade-in duration-150 mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-xl max-w-lg w-full shadow-2xl border border-rose-300 ring-1 ring-rose-900/10 overflow-hidden flex flex-col mobile-sheet-card max-h-[90dvh]">
            <div className="bg-rose-700 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-white" />
                <h2 className="text-sm font-bold">Delete Student Record</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 overflow-y-auto">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Warning: Permanent Deletion of {currentStudent.full_name}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-800">
                  Admission No: <strong className="font-mono">{currentStudent.admission_number}</strong>
                </p>
                <p className="text-[11px] leading-relaxed text-rose-700">
                  Permanently deletes student profile, attendance, and exam records.
                </p>
              </div>

              {deleteModalError && (
                <div className="p-3 bg-rose-100 border border-rose-300 rounded-lg text-rose-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">{deleteModalError}</p>
                    <p className="text-[11px] text-rose-700">
                      Recommendation: Archive instead to preserve fee registers and accounting records.
                    </p>
                  </div>
                </div>
              )}

              {deleteModalRequiresForce && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteModalForce}
                      onChange={e => setDeleteModalForce(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-semibold leading-relaxed">
                      Force delete this student despite recorded financial transactions.
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
                  value={deleteModalReason}
                  onChange={e => setDeleteModalReason(e.target.value)}
                  placeholder="Reason for deletion"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 p-3.5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFromModal}
                disabled={isDeletingStudent || !deleteModalReason.trim() || (deleteModalRequiresForce && !deleteModalForce)}
                className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingStudent ? 'Deleting...' : 'Delete Student'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ADD CLASS MODAL */}
      {showAddClassModal && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-xl border border-slate-300 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col mobile-sheet-card max-h-[90dvh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Add Class/Batch Enrollment</h3>
                  <p className="text-[11px] text-slate-500">
                    {currentStudent.full_name} • Adm: <strong className="font-mono text-slate-700">{currentStudent.admission_number}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddClassModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAddClass} className="p-5 space-y-4 text-xs overflow-y-auto">
              {addClassError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">{addClassError}</span>
                </div>
              )}

              {/* Program Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Academic Class / Program <span className="text-rose-500">*</span>
                </label>
                <select
                  value={addClassProgramId}
                  onChange={e => handleProgramChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                >
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Batch Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Batch / Section <span className="text-rose-500">*</span>
                </label>
                <select
                  value={addClassBatchId}
                  onChange={e => handleBatchChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                >
                  <option value="">-- Select Section or Batch --</option>
                  {batches
                    .filter(b => !addClassProgramId || b.program_id === addClassProgramId)
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.shift ? b.shift.toUpperCase() : 'General'}) — [{b.current_enrollment || 0}/{b.max_capacity || 0} enrolled]
                      </option>
                    ))}
                </select>
              </div>

              {/* Tuition Fee & Billing Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Monthly Tuition (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={addClassTuitionFee}
                    onChange={e => setAddClassTuitionFee(e.target.value)}
                    placeholder="Pre-filled from batch"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Batch fee baseline</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Billing Mode</label>
                  <select
                    value={addClassBillingMode}
                    onChange={e => setAddClassBillingMode(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="monthly">Monthly Billing</option>
                    <option value="installment">Installment Plan</option>
                  </select>
                </div>
              </div>

              {/* Elective Stream */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Elective Stream</label>
                <select
                  value={addClassElectiveGroupId}
                  onChange={e => setAddClassElectiveGroupId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">Core Subjects</option>
                  {subjectGroups
                    .filter(g => (!addClassProgramId || g.program_id === addClassProgramId) && g.type === 'elective_track')
                    .map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
              </div>

              {/* Opening Challan Option */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addClassGenerateChallan}
                    onChange={e => setAddClassGenerateChallan(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="font-semibold text-slate-800">Generate opening fee challan now</span>
                </label>
                {addClassGenerateChallan && (
                  <div className="pt-1 pl-5">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Challan Due Date
                    </label>
                    <input
                      type="date"
                      value={addClassDueDate}
                      onChange={e => setAddClassDueDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingClass || !addClassBatchId}
                  className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingClass ? 'Enrolling...' : 'Complete Class Enrollment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* LEAVE CLASS MODAL */}
      {leaveClassEnrollment && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-xl border border-slate-300 max-w-md w-full shadow-2xl overflow-hidden flex flex-col mobile-sheet-card max-h-[90dvh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Leave Class</h3>
                  <p className="text-[11px] text-slate-500">
                    {batches.find(b => b.id === leaveClassEnrollment.batch_id)?.name || 'Class Batch'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLeaveClassEnrollment(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmLeaveClass} className="p-5 space-y-4 text-xs overflow-y-auto">
              {leaveClassError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">{leaveClassError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-[11px] leading-relaxed">
                Leaving this class frees the seat immediately in this batch. If this student has other active classes, their student standing and portal account remain active.
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Exit Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={leaveClassStatus}
                  onChange={e => setLeaveClassStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                >
                  <option value="withdrawn">Withdrawn / Departed</option>
                  <option value="completed">Completed / Course Finished</option>
                  <option value="on_leave">On Temporary Leave</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Exiting Class <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={leaveClassReason}
                  onChange={e => setLeaveClassReason(e.target.value)}
                  placeholder="e.g. Completed course, schedule conflict (optional)"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={leaveClassCancelUnpaid}
                    onChange={e => setLeaveClassCancelUnpaid(e.target.checked)}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Cancel unpaid fee challans for this class</span>
                  </div>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setLeaveClassEnrollment(null)}
                  className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLeavingClass}
                  className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>{isLeavingClass ? 'Processing...' : 'Leave Class'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* TRANSFER CLASS MODAL (MULTI-CLASS SUPPORT) */}
      {transferEnrollment && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs mobile-sheet">
          <div className="bg-white rounded-t-3xl sm:rounded-xl border border-slate-300 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col mobile-sheet-card max-h-[90dvh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                  <ArrowRightLeft className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Change Class/Batch</h3>
                  <p className="text-[11px] text-slate-500">
                    Current: {batches.find(b => b.id === transferEnrollment.batch_id)?.name || 'Class Batch'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransferEnrollment(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmTransferClass} className="p-5 space-y-4 text-xs overflow-y-auto">
              {transferError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">{transferError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Class / Program <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={transferTargetProgramId}
                    onChange={e => {
                      const newProgId = e.target.value;
                      setTransferTargetProgramId(newProgId);
                      const pBatches = batches.filter(b => b.program_id === newProgId);
                      if (pBatches.length > 0) {
                        setTransferTargetBatchId(pBatches[0].id);
                      }
                      const electives = subjectGroups.filter(g => g.program_id === newProgId && g.type === 'elective_track');
                      if (electives.length > 0) {
                        setTransferTargetElectiveGroupId(electives[0].id);
                      } else {
                        setTransferTargetElectiveGroupId('');
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                  >
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Batch / Section <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={transferTargetBatchId}
                    onChange={e => {
                      setTransferTargetBatchId(e.target.value);
                      setTransferError(null);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                  >
                    {batches
                      .filter(b => !transferTargetProgramId || b.program_id === transferTargetProgramId)
                      .map(b => {
                        const isCurrent = b.id === transferEnrollment.batch_id;
                        const isFull = !isCurrent && b.max_capacity > 0 && (b.current_enrollment || 0) >= b.max_capacity;
                        return (
                          <option key={b.id} value={b.id} disabled={isFull}>
                            {b.name} ({b.shift}) {isFull ? `[FULL: ${b.current_enrollment}/${b.max_capacity}]` : `(${b.current_enrollment || 0}/${b.max_capacity || '∞'})`}
                          </option>
                        );
                      })}
                  </select>
                </div>
              </div>

              {/* Elective Track Stream (if applicable) */}
              {subjectGroups.some(g => g.program_id === transferTargetProgramId && g.type === 'elective_track') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Elective Track Stream
                  </label>
                  <select
                    value={transferTargetElectiveGroupId}
                    onChange={e => setTransferTargetElectiveGroupId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                  >
                    <option value="">-- General / Core Only --</option>
                    {subjectGroups
                      .filter(g => g.program_id === transferTargetProgramId && g.type === 'elective_track')
                      .map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Effective Transfer Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={e => setTransferDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Attendance and gradebooks shift from this date.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Administrative Reason <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={transferReason}
                    onChange={e => setTransferReason(e.target.value)}
                    placeholder="e.g. Schedule adjustment, track change (optional)"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Monthly Tuition Fee Policy */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <label className="block font-bold text-slate-800 text-[11px]">
                  Monthly Tuition Fee Policy
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="transferFeeMode"
                      checked={transferFeeMode === 'keep_current'}
                      onChange={() => setTransferFeeMode('keep_current')}
                      className="text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-slate-800 font-medium">Keep current agreed fee (carry-forward locked fee)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="transferFeeMode"
                      checked={transferFeeMode === 'batch_standard'}
                      onChange={() => setTransferFeeMode('batch_standard')}
                      className="text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-slate-800 font-medium">
                      Adopt new batch standard fee (Rs. {batches.find(b => b.id === transferTargetBatchId)?.fee_amount?.toLocaleString() || 0} / month)
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="transferFeeMode"
                      checked={transferFeeMode === 'custom'}
                      onChange={() => setTransferFeeMode('custom')}
                      className="text-slate-900 focus:ring-slate-900 mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="text-slate-800 font-medium block">Custom negotiated fee</span>
                      {transferFeeMode === 'custom' && (
                        <input
                          type="number"
                          min="0"
                          value={transferCustomFee}
                          onChange={e => setTransferCustomFee(e.target.value)}
                          placeholder="Tuition amount in PKR"
                          className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Unpaid Challan Update Checkbox — only shown when fee rate changes (batch_standard or custom) */}
              {transferFeeMode !== 'keep_current' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg animate-in fade-in duration-150">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={transferUpdateUnpaidChallans}
                      onChange={e => setTransferUpdateUnpaidChallans(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 mt-0.5"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">
                        Update unpaid fee challan(s) to new rate
                      </span>
                      <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                        Adjusts open unpaid challan(s) for this class to the new tuition rate. Past arrears from previous months remain locked on the student ledger and roll forward onto future challans.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setTransferEnrollment(null)}
                  className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="w-full sm:w-auto h-8.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>{isSubmittingTransfer ? 'Changing Class/Batch...' : 'Confirm Class/Batch Change'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* SINGLE ID CARD MODAL */}
      {showIdCardModal && (
        <StudentIDCardModal
          student={currentStudent}
          batch={activeBatch}
          program={activeProgram}
          batches={batches}
          programs={programs}
          enrollments={enrollments}
          initialEnrollmentId={selectedIdCardEnrollmentId}
          academyName={tenant?.name || 'Academy'}
          campusAddress={tenant?.campus_name}
          onClose={() => {
            setShowIdCardModal(false);
            setSelectedIdCardEnrollmentId(undefined);
          }}
        />
      )}
    </div>,
    document.body
  );
};

export const Student360Modal = StudentProfileModal;
