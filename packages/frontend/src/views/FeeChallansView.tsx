import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  Printer, 
  Layers, 
  CheckCircle2, 
  RefreshCw, 
  Search,
  AlertTriangle,
  Pencil,
  Trash2,
  Plus,
  X
} from 'lucide-react';
import { 
  StudentInvoice, 
  AcademicProgram, 
  StudentFeeStructure,
  FeeHead
} from '@apex/shared-types';
import { InPortalPdfViewerModal } from '../components/InPortalPdfViewerModal';
import { 
  buildBatchChallansPdfBytes, 
  StudentChallanData, 
  ChallanItem 
} from '../lib/feeReportsPdf';
import { academyLetterheadFromAuth } from '../lib/officialDocumentPdf';

function formatLocalDate(year: number, monthIdx: number, day: number): string {
  const m = String(monthIdx + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function lastDayOfMonth(year: number, monthIdx: number): string {
  const d = new Date(year, monthIdx + 1, 0);
  return formatLocalDate(d.getFullYear(), d.getMonth(), d.getDate());
}

export function normalizeBillingMonth(m: string): string {
  if (!m) return '';
  const trimmed = m.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    const year = isoMatch[1];
    const monthNum = parseInt(isoMatch[2], 10);
    const date = new Date(parseInt(year, 10), monthNum - 1, 1);
    const monthName = date.toLocaleString('en-US', { month: 'long' });
    return `${monthName} ${year}`;
  }
  return trimmed;
}

export function isSameBillingMonth(m1: string, m2: string): boolean {
  if (!m1 || !m2) return false;
  return normalizeBillingMonth(m1).toLowerCase() === normalizeBillingMonth(m2).toLowerCase();
}

export const FeeChallansView: React.FC = () => {
  const { token, tenant } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');

  // Core Data
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<StudentFeeStructure[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [academySettings, setAcademySettings] = useState<any>(null);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Generation Controls
  const [genScope, setGenScope] = useState<'class' | 'whole_institute' | 'single_student'>('class');
  const [genProgramId, setGenProgramId] = useState<string>('all');
  const [genBatchId, setGenBatchId] = useState<string>('all');
  const [singleAdmissionSearch, setSingleAdmissionSearch] = useState<string>('');
  const [additionalHeadsToAdd, setAdditionalHeadsToAdd] = useState<Array<{ fee_head_id: string; amount: number | '' }>>([]);
  const [selectedHeadId, setSelectedHeadId] = useState<string>('');
  const [genYear, setGenYear] = useState<number>(() => new Date().getFullYear());
  const [genMonthName, setGenMonthName] = useState<string>(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long' });
  });
  const genMonth = `${genMonthName} ${genYear}`;
  const [genIssueDate, setGenIssueDate] = useState<string>(() => {
    const d = new Date();
    return formatLocalDate(d.getFullYear(), d.getMonth(), 1);
  });
  const [genDueDate, setGenDueDate] = useState<string>(() => {
    const d = new Date();
    const tenth = new Date(d.getFullYear(), d.getMonth(), 10);
    if (tenth.getTime() < d.getTime()) {
      return lastDayOfMonth(d.getFullYear(), d.getMonth());
    }
    return formatLocalDate(d.getFullYear(), d.getMonth(), 10);
  });
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genSuccessMessage, setGenSuccessMessage] = useState<string | null>(null);
  const [genErrorMessage, setGenErrorMessage] = useState<string | null>(null);

  // Edit Challan Modal State
  const [editingInvoice, setEditingInvoice] = useState<StudentInvoice | null>(null);
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editItems, setEditItems] = useState<Array<{ fee_head_id: string; head_name: string; amount: number }>>([]);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editAdmissionQuery, setEditAdmissionQuery] = useState<string>('');

  // Delete Challan Modal State
  const [deletingInvoice, setDeletingInvoice] = useState<StudentInvoice | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleMonthChange = (newMonthName: string, newYear: number) => {
    setGenMonthName(newMonthName);
    setGenYear(newYear);
    const mIdx = MONTH_NAMES.indexOf(newMonthName);
    if (mIdx !== -1) {
      setGenIssueDate(formatLocalDate(newYear, mIdx, 1));
      const tenth = new Date(newYear, mIdx, 10);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (tenth.getTime() < today.getTime() && newYear === today.getFullYear() && mIdx === today.getMonth()) {
        setGenDueDate(lastDayOfMonth(newYear, mIdx));
      } else {
        setGenDueDate(formatLocalDate(newYear, mIdx, 10));
      }
    }
    setGenErrorMessage(null);
  };

  const activeSessionYear = useMemo(() => {
    const list = (academySettings?.academic_sessions || []) as Array<{ start_year: number; is_active?: boolean; name?: string }>;
    const activeSess = list.find(s => s.is_active);
    if (activeSess?.start_year) return activeSess.start_year;
    const sessionStr = tenant?.academic_session || academySettings?.academic_session || '';
    const match = sessionStr.match(/^(\d{4})/);
    if (match) return parseInt(match[1], 10);
    return new Date().getFullYear();
  }, [academySettings, tenant]);

  const availableYears = useMemo(() => {
    const list = ((academySettings?.academic_sessions || []) as Array<{ start_year: number; is_active?: boolean }>);
    const nowYear = new Date().getFullYear();
    const minYear = Math.min(nowYear, activeSessionYear);
    const validYears = list.filter(s => s.start_year >= minYear || s.is_active).map(s => s.start_year);
    if (validYears.length > 0) return [...new Set(validYears)].sort((a, b) => a - b);
    return [nowYear, nowYear + 1, nowYear + 2];
  }, [academySettings, activeSessionYear]);

  useEffect(() => {
    if (activeSessionYear && !availableYears.includes(genYear)) {
      setGenYear(activeSessionYear);
    }
  }, [activeSessionYear, availableYears, genYear]);

  const [printProgramId, setPrintProgramId] = useState<string>('all');
  const [printMonth, setPrintMonth] = useState<string>('all');
  const [selectedInvoiceIds] = useState<Set<string>>(new Set());

  // In-Portal PDF Viewer State
  const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfTitle, setPdfTitle] = useState<string>('Fee Challans');
  const [pdfFilename, setPdfFilename] = useState<string>('Challans.pdf');
  const [isPreparingPdf, setIsPreparingPdf] = useState<boolean>(false);

  // Fetch Core Data
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [invRes, studRes, progRes, batchRes, structRes, settRes, headsRes] = await Promise.all([
        fetch('/api/v1/finance/invoices', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/sis/students', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/programs', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/batches', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/structures', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/academy-settings', { headers: { authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/v1/finance/heads', { headers: { authorization: `Bearer ${token}` } }).catch(() => null),
      ]);

      if (invRes.ok) setInvoices((await invRes.json()).data || []);
      if (studRes.ok) setStudents((await studRes.json()).data || []);
      if (progRes.ok) setPrograms((await progRes.json()).data || []);
      if (batchRes.ok) setBatches((await batchRes.json()).data || []);
      if (structRes.ok) setFeeStructures((await structRes.json()).data || []);
      if (headsRes && headsRes.ok) setFeeHeads((await headsRes.json()).data || []);
      if (settRes && settRes.ok) {
        const sData = await settRes.json();
        if (sData.success && sData.data) {
          setAcademySettings(sData.data.settings || sData.data);
        }
      }
    } catch (err) {
      console.error('Failed to load challan data:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper mappings
  const getProgramName = useCallback((id?: string) => {
    if (!id) return 'General';
    return programs.find(p => p.id === id)?.name || 'General';
  }, [programs]);

  const getBatchName = useCallback((id?: string) => {
    if (!id) return '';
    return batches.find(b => b.id === id)?.name || '';
  }, [batches]);

  // Students eligible for generation based on selection
  const eligibleGenerationStudents = useMemo(() => {
    let filtered = students.filter(s => s.status === 'active');
    if (genScope === 'class' && genProgramId !== 'all') {
      filtered = filtered.filter(s => s.program_id === genProgramId);
      if (genBatchId !== 'all') {
        filtered = filtered.filter(s => s.batch_id === genBatchId);
      }
    }
    return filtered;
  }, [students, genScope, genProgramId, genBatchId]);

  // Single student match by admission number or name
  const matchedSingleStudent = useMemo(() => {
    if (genScope !== 'single_student' || !singleAdmissionSearch.trim()) return null;
    const q = singleAdmissionSearch.trim().toLowerCase();
    return students.find(s => 
      s.status === 'active' && (
        (s.admission_number && s.admission_number.toLowerCase() === q) ||
        (s.full_name && s.full_name.toLowerCase().includes(q))
      )
    ) || null;
  }, [students, genScope, singleAdmissionSearch]);

  const matchedEditStudent = useMemo(() => {
    const q = editAdmissionQuery.trim().toLowerCase();
    if (!q) return null;
    return students.find(s =>
      s.status === 'active' && (
        (s.admission_number && s.admission_number.toLowerCase() === q) ||
        (s.full_name && s.full_name.toLowerCase().includes(q))
      )
    ) || null;
  }, [students, editAdmissionQuery]);

  const editStudentInvoices = useMemo(() => {
    if (!matchedEditStudent) return [];
    return invoices
      .filter(i => i.student_id === matchedEditStudent.id && i.status !== 'voided')
      .sort((a, b) => String(b.issue_date || b.created_at).localeCompare(String(a.issue_date || a.created_at)));
  }, [invoices, matchedEditStudent]);

  useEffect(() => {
    if (!matchedEditStudent) return;
    if (editingInvoice && editingInvoice.student_id === matchedEditStudent.id) return;
    const st = (s: string) => String(s || '').toLowerCase();
    const preferred = editStudentInvoices.find(i => isSameBillingMonth(i.billing_month, genMonth) && st(i.status) !== 'cancelled')
      || editStudentInvoices.find(i => ['unpaid', 'partial', 'partially_paid'].includes(st(i.status)))
      || editStudentInvoices[0];
    if (preferred) handleOpenEditInvoice(preferred);
  }, [matchedEditStudent, editStudentInvoices, genMonth]);

  // Duplicate check for selected single student
  const singleStudentDuplicateChallan = useMemo(() => {
    if (!matchedSingleStudent || !genMonth) return null;
    return invoices.find(i => 
      i.student_id === matchedSingleStudent.id &&
      isSameBillingMonth(i.billing_month, genMonth) &&
      i.status !== 'voided' &&
      i.status !== 'cancelled'
    ) || null;
  }, [invoices, matchedSingleStudent, genMonth]);

  // Map student ID to active invoice for genMonth
  const studentBillingMap = useMemo(() => {
    const map = new Map<string, StudentInvoice>();
    for (const inv of invoices) {
      if (inv.status !== 'voided' && inv.status !== 'cancelled' && isSameBillingMonth(inv.billing_month, genMonth)) {
        map.set(inv.student_id, inv);
      }
    }
    return map;
  }, [invoices, genMonth]);

  const unbilledStudents = useMemo(() => {
    return eligibleGenerationStudents.filter(s => !studentBillingMap.has(s.id));
  }, [eligibleGenerationStudents, studentBillingMap]);

  // Handle Single Student Challan Generation
  const handleGenerateSingleChallan = async () => {
    if (!token || !matchedSingleStudent) return;
    setIsGenerating(true);
    setGenSuccessMessage(null);
    setGenErrorMessage(null);

    try {
      const res = await fetch('/api/v1/finance/invoices/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          student_id: matchedSingleStudent.id,
          billing_month: genMonth,
          issue_date: genIssueDate,
          due_date: genDueDate,
          notes: `Fee challan for ${genMonth}`,
          additional_heads: additionalHeadsToAdd.filter(a => (Number(a.amount) || 0) > 0).map(a => ({ fee_head_id: a.fee_head_id, amount: Number(a.amount) || 0 })),
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        setGenSuccessMessage(`Successfully issued Challan #${resData.data.invoice_number} for ${matchedSingleStudent.full_name} (${genMonth}).`);
        setAdditionalHeadsToAdd([]);
        await fetchData();
        setPrintMonth(genMonth);
      } else {
        setGenErrorMessage(resData.error?.message || resData.message || 'Failed to generate challan.');
      }
    } catch (err: any) {
      setGenErrorMessage(err.message || 'Network error generating challan.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Batch Challan Generation
  const handleGenerateChallans = async () => {
    if (!token || eligibleGenerationStudents.length === 0) return;
    if (genScope === 'class' && genProgramId === 'all' && genBatchId === 'all') {
      setGenErrorMessage('Select a class, or choose Whole Institute.');
      return;
    }
    if (feeHeads.length === 0 && additionalHeadsToAdd.length === 0) {
      setGenErrorMessage('Set fee heads and class fees in Settings before generating challans.');
      return;
    }
    setIsGenerating(true);
    setGenSuccessMessage(null);
    setGenErrorMessage(null);

    try {
      const validHeads = additionalHeadsToAdd.filter(a => (Number(a.amount) || 0) > 0).map(a => ({ fee_head_id: a.fee_head_id, amount: Number(a.amount) || 0 }));
      const payload = {
        scope: genScope === 'whole_institute' ? 'all' : (genBatchId !== 'all' ? 'batch' : (genProgramId !== 'all' ? 'program' : 'all')),
        target_id: genBatchId !== 'all' ? genBatchId : (genProgramId !== 'all' ? genProgramId : undefined),
        billing_month: genMonth,
        issue_date: genIssueDate,
        due_date: genDueDate,
        additional_heads: validHeads.length > 0 ? validHeads : undefined,
      };

      const res = await fetch('/api/v1/finance/invoices/generate-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        const generatedCount = resData.count ?? (Array.isArray(resData.data) ? resData.data.length : resData.data?.count) ?? eligibleGenerationStudents.length;
        setGenSuccessMessage(`Generated ${generatedCount} challan${generatedCount === 1 ? '' : 's'} for ${genMonth}.`);
        setAdditionalHeadsToAdd([]);
        await fetchData();
        // Switch to print view for this month
        setPrintMonth(genMonth);
        if (genProgramId !== 'all') setPrintProgramId(genProgramId);
      } else {
        setGenErrorMessage(resData.error?.message || resData.message || 'Failed to generate batch challans.');
      }
    } catch (err: any) {
      console.error('Error generating batch challans:', err);
      setGenErrorMessage('Network or server error while generating challans.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Edit Challan Handlers
  const handleOpenEditInvoice = (inv: StudentInvoice) => {
    setEditingInvoice(inv);
    setEditDueDate(inv.due_date);
    setEditNotes(inv.notes || '');
    setEditItems((inv.items || []).map(it => ({
      fee_head_id: it.fee_head_id,
      head_name: it.head_name || 'Fee Head',
      amount: it.net_amount || it.original_amount || 0,
    })));
  };

  const handleSaveEditInvoice = async () => {
    if (!token || !editingInvoice) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/finance/invoices/${editingInvoice.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          due_date: editDueDate,
          notes: editNotes,
          items: editItems.map(it => ({
            fee_head_id: it.fee_head_id,
            amount: Number(it.amount) || 0
          }))
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to update challan');
      await fetchData();
      if (data.data) handleOpenEditInvoice(data.data);
    } catch (err: any) {
      alert(err.message || 'Error updating challan');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDeleteInvoice = async () => {
    if (!token || !deletingInvoice) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/finance/invoices/${deletingInvoice.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: deleteReason.trim() || 'Deleted by administrator from Challans Desk'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to delete challan');
      setDeletingInvoice(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error deleting challan');
    } finally {
      setIsDeleting(false);
    }
  };

  // Invoices eligible for printing
  const printableInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.status === 'cancelled' || inv.status === 'voided') return false;
      if (printMonth !== 'all' && !isSameBillingMonth(inv.billing_month, printMonth)) {
        return false;
      }
      return true;
    });
  }, [invoices, printMonth]);

  // Render & Preview Challan PDF (In-Portal Modal)
  const handlePreviewAndPrint = async (targetInvoices?: StudentInvoice[]) => {
    const list = targetInvoices || (selectedInvoiceIds.size > 0 ? printableInvoices.filter(i => selectedInvoiceIds.has(i.id)) : printableInvoices);
    if (list.length === 0) {
      alert('No challans selected for printing.');
      return;
    }

    setIsPreparingPdf(true);
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const sSettings = academySettings || {};
      const bankDetails = {
        bankName: sSettings.bank_name || '',
        accountTitle: sSettings.bank_account_title || tenant?.name || '',
        accountNumber: sSettings.bank_account_number || '',
        branchName: sSettings.bank_branch || tenant?.city || '',
      };

      const challanItems: StudentChallanData[] = list.map(inv => {
        const student = students.find(s => s.id === inv.student_id);
        const fatherName = student?.guardian_name || student?.father_name || 'Guardian';
        const progName = inv.program_name || getProgramName(inv.program_id);
        const batchName = getBatchName(inv.batch_id);

        const items: ChallanItem[] = (inv.items && inv.items.length > 0)
          ? inv.items.map(it => ({ head_name: it.head_name || 'Tuition Fee', amount: it.net_amount }))
          : [{ head_name: 'Tuition Fee', amount: inv.net_amount }];

        // Last 4 Months History for printed voucher
        const pastInvoices = invoices.filter(i => 
          i.student_id === inv.student_id && 
          i.id !== inv.id && 
          i.status !== 'voided' && 
          i.status !== 'cancelled'
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const history_months = pastInvoices.slice(0, 4).map(pi => ({
          month: normalizeBillingMonth(pi.billing_month),
          paid: Number(pi.paid_amount || 0),
          balance: Number(pi.balance_amount || (pi.net_amount - (pi.paid_amount || 0))),
        }));

        return {
          challan_number: inv.invoice_number,
          admission_number: student?.admission_number || inv.admission_number || undefined,
          student_name: inv.student_name,
          father_name: fatherName,
          class_name: progName,
          batch_name: batchName,
          billing_month: normalizeBillingMonth(inv.billing_month),
          issue_date: inv.issue_date || new Date().toISOString().split('T')[0],
          due_date: inv.due_date,
          items,
          concession_amount: inv.discount_amount > 0 ? inv.discount_amount : undefined,
          net_amount: inv.net_amount,
          history_months,
        };
      });

      const bytes = await buildBatchChallansPdfBytes({
        academy: letterhead,
        bankDetails,
        challans: challanItems,
      });

      const scopeName = genScope === 'whole_institute' ? 'Institute_Wide' : (getProgramName(printProgramId).replace(/\s+/g, '_') || 'Batch');
      const filename = `Fee_Challans_${scopeName}_${new Date().toISOString().split('T')[0]}.pdf`;

      setPdfBytes(bytes);
      setPdfTitle(list.length === 1 ? `Fee Challan • ${list[0].student_name}` : `Fee Challans (${list.length} Vouchers • 3 Students / Page)`);
      setPdfFilename(filename);
      setPdfModalOpen(true);
    } catch (err: any) {
      console.error('Failed to prepare challan PDF:', err);
      alert('Error rendering Challans PDF.');
    } finally {
      setIsPreparingPdf(false);
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* Top Header - Behance Slide 1 Style */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            Fee Challans Desk
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Generate monthly 3-part bank challans, manage billing runs, and adjust itemized fee heads.
          </p>
        </div>

        {/* Tab Switcher - Behance Segmented Button Group */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'generate'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Generate Challans</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Inspect & Edit</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: CHALLAN GENERATION
          ========================================================================= */}
      {activeTab === 'generate' && (
        <div className="max-w-2xl space-y-3">
          {/* Generation Setup Card */}
          <div className="space-y-3">
            <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>Generate New Monthly Challans</span>
              </h2>

              {/* Scope selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Scope</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setGenScope('class')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all text-center cursor-pointer ${
                      genScope === 'class'
                        ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Class & Batch
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenScope('whole_institute');
                      setGenProgramId('all');
                      setGenBatchId('all');
                    }}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all text-center cursor-pointer ${
                      genScope === 'whole_institute'
                        ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Whole Institute
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenScope('single_student')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all text-center cursor-pointer ${
                      genScope === 'single_student'
                        ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Single Student
                  </button>
                </div>
              </div>

              {/* Class & Batch selectors if class-wise */}
              {genScope === 'class' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Class / Program</label>
                    <select
                      value={genProgramId}
                      onChange={e => {
                        setGenProgramId(e.target.value);
                        setGenBatchId('all');
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                    >
                      <option value="all">All Classes</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Section / Batch</label>
                    <select
                      value={genBatchId}
                      onChange={e => setGenBatchId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                    >
                      <option value="all">All Sections</option>
                      {batches
                        .filter(b => genProgramId === 'all' || b.program_id === genProgramId)
                        .map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Single Student Admission No Input */}
              {genScope === 'single_student' && (
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Student Admission #
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={singleAdmissionSearch}
                      onChange={e => {
                        setSingleAdmissionSearch(e.target.value);
                        setGenErrorMessage(null);
                      }}
                      placeholder="Enter exact Admission # or name..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                    />
                  </div>

                  {matchedSingleStudent ? (
                    <div className="py-2.5 px-3 border-l-2 border-indigo-500 bg-indigo-50/30 rounded-r-lg text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{matchedSingleStudent.full_name}</span>
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-mono font-medium text-[10px]">
                          Adm #{matchedSingleStudent.admission_number}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Class: <span className="font-semibold">{getProgramName(matchedSingleStudent.program_id)}</span>
                        {matchedSingleStudent.batch_id ? ` • ${getBatchName(matchedSingleStudent.batch_id)}` : ''}
                        {' • '}Father: {matchedSingleStudent.father_name || matchedSingleStudent.guardian_name || '—'}
                      </p>
                      {(() => {
                        const struct = feeStructures.find(s => s.batch_id === matchedSingleStudent.batch_id);
                        const baseFee = (struct?.items || []).reduce((sum, it) => sum + Number(it.amount || 0), 0);
                        return baseFee > 0 ? (
                          <p className="text-[10px] font-mono text-slate-500">
                            Batch Standard Fee: PKR {baseFee.toLocaleString()}
                          </p>
                        ) : null;
                      })()}
                      {singleStudentDuplicateChallan && (
                        <div className="pt-1 text-rose-700 text-[11px] flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                          <span>
                            Duplicate Shield: Challan #{singleStudentDuplicateChallan.invoice_number} already exists for {genMonth}.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : singleAdmissionSearch.trim() ? (
                    <p className="text-[11px] text-amber-600">No active student matched &ldquo;{singleAdmissionSearch}&rdquo;.</p>
                  ) : null}
                </div>
              )}

              {/* Billing Month & Dates */}
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Academic Session</label>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Default: {tenant?.academic_session || '2026-2027'}
                      </span>
                    </div>
                    <select
                      value={genYear}
                      onChange={e => handleMonthChange(genMonthName, Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                    >
                      {availableYears.map(yr => (
                        <option key={yr} value={yr}>
                          {yr}–{yr + 1} Session {yr === activeSessionYear ? '(Active Global)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Billing Month</label>
                    <select
                      value={genMonthName}
                      onChange={e => handleMonthChange(e.target.value, genYear)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                    >
                      {MONTH_NAMES.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Issue Date</label>
                    <input
                      type="date"
                      value={genIssueDate}
                      onChange={e => setGenIssueDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={genDueDate}
                      onChange={e => setGenDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium text-rose-700"
                    />
                  </div>
                </div>

                {/* Dynamic Additional Special Fee Heads */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-slate-800">Additional Fee Heads (Optional)</label>
                      <p className="text-[10px] text-slate-500">Add special charges (e.g. Exam Fee, Annual, Sports) to itemize on this challan.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedHeadId}
                      onChange={e => setSelectedHeadId(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Select fee head</option>
                      {feeHeads
                        .filter(h => h.code !== 'TUITION' && !additionalHeadsToAdd.some(a => a.fee_head_id === h.id))
                        .map(h => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.code}) - Default PKR {h.default_amount}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedHeadId) return;
                        const head = feeHeads.find(h => h.id === selectedHeadId);
                        if (!head) return;
                        setAdditionalHeadsToAdd(prev => [
                          ...prev,
                          { fee_head_id: head.id, amount: (head.default_amount && head.default_amount > 0) ? head.default_amount : '' }
                        ]);
                        setSelectedHeadId('');
                      }}
                      disabled={!selectedHeadId}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold disabled:opacity-40 flex items-center gap-1 shrink-0 transition-colors shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>

                  {additionalHeadsToAdd.length > 0 && (
                    <div className="border-y border-slate-100 divide-y divide-slate-100 py-1">
                      {additionalHeadsToAdd.map(item => {
                        const head = feeHeads.find(h => h.id === item.fee_head_id);
                        return (
                          <div key={item.fee_head_id} className="py-2 px-1 flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-800">{head?.name || 'Fee Head'}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 font-mono">PKR</span>
                              <input
                                type="number"
                                min={0}
                                value={item.amount === 0 ? '' : item.amount}
                                placeholder="0"
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                                  setAdditionalHeadsToAdd(prev => prev.map(a => a.fee_head_id === item.fee_head_id ? { ...a, amount: val } : a));
                                }}
                                className="w-20 px-2 py-0.5 text-right font-mono font-medium text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() => setAdditionalHeadsToAdd(prev => prev.filter(a => a.fee_head_id !== item.fee_head_id))}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
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
              </div>

              {/* Feedback Messages */}
              {genSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{genSuccessMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const issued = invoices.filter(i =>
                        isSameBillingMonth(i.billing_month, genMonth) &&
                        i.status !== 'cancelled' &&
                        i.status !== 'voided'
                      );
                      void handlePreviewAndPrint(issued);
                    }}
                    disabled={isPreparingPdf}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print issued
                  </button>
                </div>
              )}

              {genErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{genErrorMessage}</span>
                </div>
              )}

              {/* Action Button */}
              {genScope === 'single_student' ? (
                <button
                  type="button"
                  onClick={handleGenerateSingleChallan}
                  disabled={isGenerating || !matchedSingleStudent || Boolean(singleStudentDuplicateChallan)}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-all shadow-[0_1px_2px_rgba(217,119,6,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Challan...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Generate Single Challan {matchedSingleStudent ? `(${matchedSingleStudent.full_name})` : ''}</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateChallans}
                  disabled={isGenerating || eligibleGenerationStudents.length === 0 || unbilledStudents.length === 0}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-all shadow-[0_1px_2px_rgba(217,119,6,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Challans...</span>
                    </>
                  ) : unbilledStudents.length === 0 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>All Students Already Billed ({eligibleGenerationStudents.length})</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Generate challans ({unbilledStudents.length} student{unbilledStudents.length === 1 ? '' : 's'})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'edit' && (
        <div className="max-w-2xl space-y-3">
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[#0E2A47]" />
              <span>Inspect & Edit Student Challan</span>
            </h2>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Admission number</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={editAdmissionQuery}
                  onChange={e => {
                    setEditAdmissionQuery(e.target.value);
                    setEditingInvoice(null);
                  }}
                  placeholder="Enter admission number or name"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Type the admission number. The challan and fee heads open only after a match.</p>
            </div>

            {editAdmissionQuery.trim() && !matchedEditStudent && (
              <p className="text-xs text-amber-700">No student matched that admission number.</p>
            )}

            {matchedEditStudent && (
              <div className="space-y-4">
                <div className="py-2 border-b border-slate-100 text-xs">
                  <p className="font-semibold text-slate-900">{matchedEditStudent.full_name}</p>
                  <p className="text-slate-500 font-mono mt-0.5">
                    Adm #{matchedEditStudent.admission_number}
                  </p>
                </div>

                {editStudentInvoices.length === 0 ? (
                  <div className="p-3 border border-slate-200 rounded-lg text-xs space-y-2">
                    <p className="text-slate-600">No challan on file for this student.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('generate');
                        setGenScope('single_student');
                        setSingleAdmissionSearch(matchedEditStudent.admission_number || '');
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
                    >
                      Generate a challan
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Billing month</label>
                      <div className="flex flex-wrap gap-1.5">
                        {editStudentInvoices.map(inv => (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => handleOpenEditInvoice(inv)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                              editingInvoice?.id === inv.id
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {normalizeBillingMonth(inv.billing_month)}
                            <span className="ml-1 font-mono opacity-80">{inv.status}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {editingInvoice && editingInvoice.student_id === matchedEditStudent.id && (
                      <div className="space-y-3 text-xs pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <p className="font-semibold text-slate-900">Challan {editingInvoice.invoice_number}</p>
                          <button
                            type="button"
                            onClick={() => void handlePreviewAndPrint([editingInvoice])}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print
                          </button>
                        </div>
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Due date</label>
                          <input
                            type="date"
                            value={editDueDate}
                            onChange={e => setEditDueDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md font-mono"
                          />
                        </div>
                        {(() => {
                          const fs = (matchedEditStudent as any).fee_structure || {};
                          const studentFee = Number(fs.net_tuition || fs.recurring_monthly || fs.base_tuition || 0);
                          const challanNet = Number(editingInvoice.net_amount || 0);
                          if (studentFee > 0 && challanNet !== studentFee) {
                            return (
                              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                                Student fee PKR {studentFee.toLocaleString()} · This challan PKR {challanNet.toLocaleString()}. Save the student amount if this challan was generated wrong.
                              </p>
                            );
                          }
                          return null;
                        })()}
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Fee heads</label>
                          <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
                            {editItems.map((item, idx) => (
                              <div key={idx} className="px-3 py-2 flex items-center justify-between gap-2 bg-white">
                                <span className="font-medium text-slate-800">{item.head_name}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-slate-400 text-[10px]">PKR</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.amount}
                                    onChange={e => {
                                      const val = Number(e.target.value) || 0;
                                      setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, amount: val } : it));
                                    }}
                                    className="w-24 px-2 py-1 text-right font-mono font-bold bg-slate-50 border border-slate-200 rounded-md"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-right font-mono font-bold text-slate-900 mt-2">
                            Total PKR {editItems.reduce((s, it) => s + Number(it.amount || 0), 0).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Notes</label>
                          <input
                            type="text"
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleSaveEditInvoice}
                            disabled={isSavingEdit || editingInvoice.status === 'paid' || editingInvoice.status === 'cancelled'}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-md text-xs font-semibold disabled:opacity-40 transition-colors shadow-xs"
                          >
                            {isSavingEdit ? 'Saving…' : 'Save challan'}
                          </button>
                        </div>
                      </div>
                    )}
                    {!editingInvoice && (
                      <p className="text-xs text-slate-500">Select a billing month to load fee heads.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT CHALLAN MODAL — used only if opened outside the Edit tab */}
      {editingInvoice && activeTab !== 'edit' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Edit Fee Challan #{editingInvoice.invoice_number}</h3>
                <p className="text-[11px] text-slate-500">Student: {editingInvoice.student_name} • Month: {editingInvoice.billing_month}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Due Date</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={e => setEditDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Fee Heads Breakdown</label>
                <div className="border border-slate-200 rounded-xl p-2.5 divide-y divide-slate-100 space-y-1.5 bg-white">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{item.head_name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-400 text-[10px]">PKR</span>
                        <input
                          type="number"
                          min={0}
                          value={item.amount}
                          onChange={e => {
                            const val = Number(e.target.value) || 0;
                            setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, amount: val } : it));
                          }}
                          className="w-24 px-2 py-1 text-right font-mono font-medium bg-slate-50 border border-slate-200 rounded"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Optional reason for challan adjustment..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="h-8.5 px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditInvoice}
                disabled={isSavingEdit}
                className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-semibold text-xs shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CHALLAN MODAL */}
      {deletingInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-md w-full p-5 shadow-2xl border border-rose-200 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Delete Fee Challan #{deletingInvoice.invoice_number}</h3>
                  <p className="text-[11px] text-slate-500">Student: {deletingInvoice.student_name} • Month: {deletingInvoice.billing_month}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingInvoice(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                Cascade Deletion Warning:
              </p>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Deleting this challan will permanently purge it and all connected fee payments ({deletingInvoice.paid_amount > 0 ? `PKR ${deletingInvoice.paid_amount.toLocaleString()} paid` : '0 paid'}) and cashbook ledger transactions recorded against it.
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-700 font-bold">Reason for Deletion <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="e.g. Issued in error, student withdrawn, duplicate challan..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingInvoice(null)}
                className="h-8.5 px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteInvoice}
                disabled={isDeleting || !deleteReason.trim()}
                className="h-8.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete Challan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Portal PDF Viewer Modal */}
      <InPortalPdfViewerModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        pdfBytes={pdfBytes}
        title={pdfTitle}
        filename={pdfFilename}
      />
    </div>
  );
};
