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
  Check, 
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';
import { 
  Student, 
  Batch, 
  AcademicProgram, 
  Subject, 
  SubjectGroup, 
  StudentInvoice
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
}

export const Student360Modal: React.FC<Student360ModalProps> = ({
  student,
  programs,
  batches,
  subjects,
  subjectGroups,
  onClose,
  onStudentUpdated,
}) => {
  const { token, tenant } = useAuth();
  const [currentStudent, setCurrentStudent] = useState<Student>(student);
  useEffect(() => {
    setCurrentStudent(student);
  }, [student]);

  const [activeTab, setActiveTab] = useState<'academic' | 'finance' | 'attendance' | 'exams' | 'notebook'>('academic');

  // Enrolled Subjects Management
  const [showEditSubjectsModal, setShowEditSubjectsModal] = useState(false);
  const [editSubjectIds, setEditSubjectIds] = useState<string[]>([]);
  const [isSavingSubjects, setIsSavingSubjects] = useState(false);
  const [editSubjectsSuccess, setEditSubjectsSuccess] = useState<string | null>(null);

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
    if (!token) return;
    setIsLoadingFinance(true);
    try {
      const res = await fetch(`/api/v1/finance/invoices?studentId=${student.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const invList: StudentInvoice[] = data.data || [];
        setInvoices(invList);
        if (invList.length > 0) {
          const unpaid = invList.find(i => i.status !== 'PAID' && (i.status as string) !== 'paid');
          if (unpaid) {
            setCollectInvoiceId(unpaid.id);
            setCollectAmount(unpaid.balance_due ?? unpaid.balance_amount ?? 0);
          } else {
            setCollectInvoiceId(invList[0].id);
            setCollectAmount(invList[0].balance_due ?? invList[0].balance_amount ?? 0);
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
  }, [student.id, token]);

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
          notes: collectNotes || undefined,
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

  const getSubjectName = (subId: string) => {
    return subjects.find(s => s.id === subId)?.name || subId;
  };

  const getSubjectCode = (subId: string) => {
    return subjects.find(s => s.id === subId)?.code || subId.slice(0, 6).toUpperCase();
  };

  const guardianRelation = (student.custom_field_values?.relation as string) || 'Father';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      {/* Print Stylesheet */}
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

      {/* Main Container */}
      <div className="bg-white rounded-xl max-w-5xl w-full shadow-xl border border-slate-300 overflow-hidden flex flex-col my-auto max-h-[94vh]">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Student Details */}
            <div className="flex items-start sm:items-center gap-4">
              {/* Photo Box */}
              <div className="w-14 h-16 sm:w-16 sm:h-20 rounded border border-slate-300 bg-slate-100 flex items-center justify-center font-mono font-bold text-slate-700 text-sm overflow-hidden shrink-0">
                {student.photo_url ? (
                  <img 
                    src={student.photo_url} 
                    alt={student.full_name} 
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
                    {student.full_name}
                  </h1>
                  
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    student.status === 'active'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}>
                    {student.status === 'active' ? 'Active' : student.status}
                  </span>

                  <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                    {student.blood_group || 'O+'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 text-[11px] mr-1">Roll #:</span>
                    <span className="font-mono font-bold text-slate-900">{student.roll_number}</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div>
                    <span className="text-slate-400 text-[11px] mr-1">Admission #:</span>
                    <span className="font-mono text-slate-900">{student.admission_number}</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div>
                    <span className="text-slate-400 text-[11px] mr-1">Class:</span>
                    <span className="font-medium text-slate-900">{activeProgram?.name || 'Class'} ({activeBatch?.name || 'Batch'})</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div>
                    <span className="text-slate-400 text-[11px] mr-1">Shift:</span>
                    <span className="font-medium text-slate-800 capitalize">{activeBatch?.shift || 'Morning'}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 pt-0.5">
                  <span>Guardian: <strong className="text-slate-800 font-medium">{student.guardian_name}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span className="font-mono text-slate-700">{student.guardian_phone}</span>
                  <span className="text-slate-400 text-[11px]">({guardianRelation})</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center flex-wrap gap-2 lg:self-start pt-1">
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
                onClick={() => setShowIdCardModal(true)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-300" />
                <span>ID Card</span>
              </button>

              <a
                href={`https://wa.me/${student.guardian_phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors ml-1"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 px-6 bg-slate-50 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('academic')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
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
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
              activeTab === 'finance'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-4 h-4 text-slate-500" />
            <span>Fee Ledger & Challans</span>
            {totalOutstanding > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200">
                Due: PKR {totalOutstanding.toLocaleString()}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
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
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
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
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors shrink-0 ${
              activeTab === 'notebook'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span>Notebook Checking</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/40">
          
          {/* TAB 1: ACADEMIC DETAILS */}
          {activeTab === 'academic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                        <td className="py-2 font-semibold text-slate-900">{activeProgram?.name || 'Class 10'}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Section / Batch</td>
                        <td className="py-2 font-semibold text-slate-900">{activeBatch?.name || 'Section A'}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Shift & Room</td>
                        <td className="py-2 font-mono text-slate-800">
                          {activeBatch?.shift.toUpperCase()} • Room {activeBatch?.room_number || '101'}
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
                      Guardian & Contact Information
                    </h3>
                  </div>

                  <table className="w-full text-xs text-left border-collapse">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 text-slate-500 w-2/5">Guardian Name</td>
                        <td className="py-2 font-semibold text-slate-900">{student.guardian_name}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Relationship</td>
                        <td className="py-2 text-slate-800">{guardianRelation}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-500">Guardian Mobile</td>
                        <td className="py-2 font-mono font-bold text-slate-900">{student.guardian_phone}</td>
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
                      {/* Compulsory Courses */}
                      {activeCompulsoryGroup?.subject_ids.map(subId => {
                        const isEnrolled = currentStudent.subjects?.includes(subId);
                        return (
                          <tr key={subId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 font-mono text-slate-700">{getSubjectCode(subId)}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-900">{getSubjectName(subId)}</td>
                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Core
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">Standard Core</td>
                            <td className="py-2.5 px-4 text-center font-mono text-slate-600">6</td>
                            <td className="py-2.5 px-4 text-right">
                              {isEnrolled ? (
                                <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium inline-flex items-center gap-1 text-[11px]">
                                  Not Enrolled / Excluded
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Elective Courses */}
                      {activeElectiveGroup?.subject_ids.map(subId => {
                        const isEnrolled = currentStudent.subjects?.includes(subId);
                        return (
                          <tr key={subId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 font-mono text-slate-700">{getSubjectCode(subId)}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-900">{getSubjectName(subId)}</td>
                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                Elective
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 font-medium">{activeElectiveGroup.name}</td>
                            <td className="py-2.5 px-4 text-center font-mono text-slate-600">6</td>
                            <td className="py-2.5 px-4 text-right">
                              {isEnrolled ? (
                                <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium inline-flex items-center gap-1 text-[11px]">
                                  Not Enrolled / Dropped
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {(!currentStudent.subjects || currentStudent.subjects.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                            No subjects assigned yet.
                          </td>
                        </tr>
                      )}
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

                    <button
                      onClick={fetchInvoices}
                      disabled={isLoadingFinance}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded text-xs font-medium flex items-center gap-1"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFinance ? 'animate-spin' : ''}`} />
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
                          placeholder="e.g. Cheque #00412"
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
                        placeholder="Optional cashier notes"
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
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 self-start sm:self-auto">
                    Eligible (94.2%)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-left">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Overall Attendance</span>
                    <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">94.2%</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Working Days</span>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">26 Days</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Present</span>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">24 Days</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Absences</span>
                    <div className="text-lg font-bold text-rose-700 font-mono mt-0.5">1 Day</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    Recent Attendance Logs
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">Current Month</span>
                </div>

                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Scheduled</th>
                      <th className="py-2.5 px-4">Check-In</th>
                      <th className="py-2.5 px-4">Method</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Notification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-900">08 Sep 2026 (Tue)</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">08:00 AM</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">07:53 AM</td>
                      <td className="py-2.5 px-4 text-slate-600">Campus GPS</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Present (On Time)
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-500">
                        WhatsApp notification sent
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-900">07 Sep 2026 (Mon)</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">08:00 AM</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">07:58 AM</td>
                      <td className="py-2.5 px-4 text-slate-600">Biometric Machine #2</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Present (On Time)
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-500">
                        WhatsApp notification sent
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-900">05 Sep 2026 (Sat)</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">08:00 AM</td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-slate-400">Manual Register</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                          Absent
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[11px] text-rose-700 font-medium">
                        Absence alert sent to guardian
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-900">04 Sep 2026 (Fri)</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">08:00 AM</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">08:09 AM</td>
                      <td className="py-2.5 px-4 text-slate-600">Biometric Machine #1</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Late (+9m)
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-500">
                        WhatsApp notification sent
                      </td>
                    </tr>
                  </tbody>
                </table>
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
                      First Term Examination Results (2026-2027)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Subject marks, grades, and teacher remarks.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-800 font-bold">
                      Total: 462 / 500 (92.4%)
                    </span>
                    <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded">
                      Grade: A+
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Subject</th>
                        <th className="py-2.5 px-4 text-center">Theory (75)</th>
                        <th className="py-2.5 px-4 text-center">Practical (25)</th>
                        <th className="py-2.5 px-4 text-center">Total (100)</th>
                        <th className="py-2.5 px-4 text-center">Percentage</th>
                        <th className="py-2.5 px-4 text-center">Grade</th>
                        <th className="py-2.5 px-4">Teacher Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">Physics</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">70</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">24</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">94</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">94.0%</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-700">A+</td>
                        <td className="py-2.5 px-4 text-slate-600 text-[11px]">Good conceptual understanding and lab work.</td>
                      </tr>

                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">Chemistry</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">65</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">23</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">88</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">88.0%</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-700">A</td>
                        <td className="py-2.5 px-4 text-slate-600 text-[11px]">Satisfactory performance in theory and practicals.</td>
                      </tr>

                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">Biology / Mathematics</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">68</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">24</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">92</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">92.0%</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-700">A+</td>
                        <td className="py-2.5 px-4 text-slate-600 text-[11px]">Consistent effort, well-maintained notes.</td>
                      </tr>

                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">English</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">88</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-400">—</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">88</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">88.0%</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-700">A</td>
                        <td className="py-2.5 px-4 text-slate-600 text-[11px]">Good reading comprehension and grammar.</td>
                      </tr>

                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">Pakistan Studies & Islamiyat</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">100</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-400">—</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">100</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-800">100%</td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-700">A+</td>
                        <td className="py-2.5 px-4 text-slate-600 text-[11px]">Well prepared and active in class.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-3">
                  <div>
                    <span className="font-semibold text-slate-800">Position:</span> 2nd in Class
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    Verified by Examination Incharge
                  </div>
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
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                    Status: Checked
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Subject</th>
                        <th className="py-2.5 px-4">Notebook Type</th>
                        <th className="py-2.5 px-4">Work Status</th>
                        <th className="py-2.5 px-4">Teacher Check</th>
                        <th className="py-2.5 px-4">Parent Signature</th>
                        <th className="py-2.5 px-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-800">07 Sep 2026</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">Physics</td>
                        <td className="py-2.5 px-4 text-slate-600">Theory & Numericals</td>
                        <td className="py-2.5 px-4">
                          <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Complete
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">Signed (Sir Tariq)</td>
                        <td className="py-2.5 px-4 font-mono text-emerald-700">Verified</td>
                        <td className="py-2.5 px-4 text-slate-600 text-[11px]">Classwork and numericals complete.</td>
                      </tr>

                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-800">05 Sep 2026</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">Chemistry</td>
                        <td className="py-2.5 px-4 text-slate-600">Lab Journal</td>
                        <td className="py-2.5 px-4">
                          <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Complete
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">Signed (Dr. Farooq)</td>
                        <td className="py-2.5 px-4 font-mono text-emerald-700">Verified</td>
                        <td className="py-2.5 px-4 text-slate-600 text-[11px]">Lab observations complete.</td>
                      </tr>

                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-800">03 Sep 2026</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">English</td>
                        <td className="py-2.5 px-4 text-slate-600">Homework Notebook</td>
                        <td className="py-2.5 px-4">
                          <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Complete
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">Signed (Ms. Ayesha)</td>
                        <td className="py-2.5 px-4 font-mono text-emerald-700">Verified</td>
                        <td className="py-2.5 px-4 text-slate-600 text-[11px]">Homework checked and signed.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Student ID:</span>
            <span className="font-mono text-slate-700 font-semibold">{student.id}</span>
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
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
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

            {/* Printable 3-Part Grid */}
            <div id="printable-challan-area" className="grid grid-cols-3 gap-3 text-[10px] font-sans">
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
                      {tenant?.name || 'Apex Academy'}
                    </h4>
                    <div className="text-[8px] text-slate-700 font-mono">
                      Meezan Bank Ltd • A/C: 0102-0103492810 • IBAN: PK52MEZN0001020103492810
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
                      <div className="text-slate-700 text-[8px]">Class: {activeProgram?.name || 'Class 10'} ({activeBatch?.name || 'Section Morning'})</div>
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
                  <div className="border-t-2 border-slate-900 pt-2 space-y-1 text-[10px]">
                    <div className="flex justify-between font-extrabold text-slate-950 text-xs">
                      <span>Amount by Due Date:</span>
                      <span className="font-mono">PKR {(challanInvoice.net_total ?? challanInvoice.net_amount ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-600">
                      <span>Late Payment Surcharge:</span>
                      <span className="font-mono">PKR 500</span>
                    </div>
                    <div className="flex justify-between font-bold text-[9px] text-rose-900">
                      <span>After Due Date:</span>
                      <span className="font-mono">PKR {((challanInvoice.net_total ?? challanInvoice.net_amount ?? 0) + 500).toLocaleString()}</span>
                    </div>
                  </div>

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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-300 space-y-4">
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

      {/* SINGLE ID CARD MODAL */}
      {showIdCardModal && (
        <StudentIDCardModal
          student={currentStudent}
          batch={activeBatch}
          program={activeProgram}
          academyName={tenant?.name || 'Apex Academy'}
          campusAddress={tenant?.campus_name}
          onClose={() => setShowIdCardModal(false)}
        />
      )}
    </div>
  );
};
