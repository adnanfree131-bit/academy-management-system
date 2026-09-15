import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  Printer, 
  Layers, 
  CheckCircle2, 
  RefreshCw, 
  Eye,
  Search,
  AlertTriangle,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { 
  StudentInvoice, 
  AcademicProgram, 
  StudentFeeStructure
} from '@apex/shared-types';
import { InPortalPdfViewerModal } from '../components/InPortalPdfViewerModal';
import { 
  buildBatchChallansPdfBytes, 
  StudentChallanData, 
  ChallanItem 
} from '../lib/feeReportsPdf';
import { academyLetterheadFromAuth } from '../lib/officialDocumentPdf';

export const FeeChallansView: React.FC = () => {
  const { token, tenant } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'generate' | 'print'>('generate');

  // Core Data
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<StudentFeeStructure[]>([]);
  const [academySettings, setAcademySettings] = useState<any>(null);

  // Generation Controls
  const [genScope, setGenScope] = useState<'class' | 'whole_institute' | 'single_student'>('class');
  const [genProgramId, setGenProgramId] = useState<string>('all');
  const [genBatchId, setGenBatchId] = useState<string>('all');
  const [singleAdmissionSearch, setSingleAdmissionSearch] = useState<string>('');
  const [genYear, setGenYear] = useState<number>(() => new Date().getFullYear());
  const [genMonthName, setGenMonthName] = useState<string>(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long' });
  });
  const genMonth = `${genMonthName} ${genYear}`;
  const [genIssueDate, setGenIssueDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [genDueDate, setGenDueDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 10).toISOString().split('T')[0];
  });
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genSuccessMessage, setGenSuccessMessage] = useState<string | null>(null);
  const [genErrorMessage, setGenErrorMessage] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    const cy = new Date().getFullYear();
    return [cy - 1, cy, cy + 1, cy + 2];
  }, []);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Print Controls
  const [printScope, setPrintScope] = useState<'class' | 'whole_institute'>('class');
  const [printProgramId, setPrintProgramId] = useState<string>('all');
  const [printBatchId, setPrintBatchId] = useState<string>('all');
  const [printMonth, setPrintMonth] = useState<string>('all');
  const [printStatus, setPrintStatus] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [vouchersPerPage, setVouchersPerPage] = useState<'3_per_page' | '2_per_page'>('3_per_page');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

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
      const [invRes, studRes, progRes, batchRes, structRes, settRes] = await Promise.all([
        fetch('/api/v1/finance/invoices', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/sis/students', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/programs', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/batches', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/structures', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/academy-settings', { headers: { authorization: `Bearer ${token}` } }).catch(() => null),
      ]);

      if (invRes.ok) setInvoices((await invRes.json()).data || []);
      if (studRes.ok) setStudents((await studRes.json()).data || []);
      if (progRes.ok) setPrograms((await progRes.json()).data || []);
      if (batchRes.ok) setBatches((await batchRes.json()).data || []);
      if (structRes.ok) setFeeStructures((await structRes.json()).data || []);
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

  // Single student match by admission number or roll number
  const matchedSingleStudent = useMemo(() => {
    if (genScope !== 'single_student' || !singleAdmissionSearch.trim()) return null;
    const q = singleAdmissionSearch.trim().toLowerCase();
    return students.find(s => 
      s.status === 'active' && (
        (s.admission_number && s.admission_number.toLowerCase() === q) ||
        (s.roll_number && s.roll_number.toLowerCase() === q) ||
        (s.full_name && s.full_name.toLowerCase().includes(q))
      )
    ) || null;
  }, [students, genScope, singleAdmissionSearch]);

  // Duplicate check for selected single student
  const singleStudentDuplicateChallan = useMemo(() => {
    if (!matchedSingleStudent || !genMonth) return null;
    return invoices.find(i => 
      i.student_id === matchedSingleStudent.id &&
      i.billing_month.trim().toLowerCase() === genMonth.trim().toLowerCase() &&
      i.status !== 'voided' &&
      i.status !== 'cancelled'
    ) || null;
  }, [invoices, matchedSingleStudent, genMonth]);

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
          due_date: genDueDate,
          notes: `Individual Fee Challan for ${genMonth}`,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        setGenSuccessMessage(`Successfully issued Challan #${resData.data.invoice_number} for ${matchedSingleStudent.full_name} (${genMonth}).`);
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
    setIsGenerating(true);
    setGenSuccessMessage(null);
    setGenErrorMessage(null);

    try {
      const payload = {
        scope: genScope === 'whole_institute' ? 'all' : (genBatchId !== 'all' ? 'batch' : (genProgramId !== 'all' ? 'program' : 'all')),
        target_id: genBatchId !== 'all' ? genBatchId : (genProgramId !== 'all' ? genProgramId : undefined),
        billing_month: genMonth,
        issue_date: genIssueDate,
        due_date: genDueDate,
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
        setGenSuccessMessage(`Successfully generated ${generatedCount} challans for ${genMonth}.`);
        await fetchData();
        // Switch to print view for this month
        setPrintMonth(genMonth);
        if (genProgramId !== 'all') setPrintProgramId(genProgramId);
        if (genBatchId !== 'all') setPrintBatchId(genBatchId);
      } else {
        setGenErrorMessage(resData.error?.message || resData.message || 'Failed to generate challans. Please verify inputs.');
      }
    } catch (err: any) {
      console.error('Error generating batch challans:', err);
      setGenErrorMessage('Network or server error while generating challans.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Invoices eligible for printing
  const printableInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (printScope === 'class' && printProgramId !== 'all') {
        if (inv.program_id !== printProgramId) return false;
        if (printBatchId !== 'all' && inv.batch_id !== printBatchId) return false;
      }
      if (printMonth !== 'all' && inv.billing_month.toLowerCase() !== printMonth.toLowerCase()) {
        return false;
      }
      if (printStatus === 'unpaid' && (inv.status === 'paid' || inv.balance_amount <= 0)) {
        return false;
      }
      if (printStatus === 'paid' && inv.status !== 'paid') {
        return false;
      }
      return true;
    });
  }, [invoices, printScope, printProgramId, printBatchId, printMonth, printStatus]);

  // Auto select/deselect all
  const handleToggleSelectAll = () => {
    if (selectedInvoiceIds.size === printableInvoices.length) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(printableInvoices.map(i => i.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Distinct billing months in invoices
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach(i => {
      if (i.billing_month) set.add(i.billing_month);
    });
    return Array.from(set);
  }, [invoices]);

  // Open In-Portal PDF Preview for Selected or All Printable Challans
  const handlePreviewAndPrint = async (targetInvoices?: StudentInvoice[]) => {
    const list = targetInvoices || (
      selectedInvoiceIds.size > 0 
        ? printableInvoices.filter(i => selectedInvoiceIds.has(i.id))
        : printableInvoices
    );

    if (list.length === 0) {
      alert('No challans selected for printing.');
      return;
    }

    setIsPreparingPdf(true);
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      const sSettings = academySettings || {};

      const bankDetails = {
        bankName: sSettings.bank_name || 'Designated Bank / Cash Desk',
        accountTitle: sSettings.bank_account_title || tenant?.name || 'Academy Fee Account',
        accountNumber: sSettings.bank_account_number || '0102-0000000000',
        branchName: sSettings.bank_branch || tenant?.city || 'Main Campus',
      };

      const challanItems: StudentChallanData[] = list.map(inv => {
        const student = students.find(s => s.id === inv.student_id);
        const fatherName = student?.guardian_name || student?.father_name || 'Guardian';
        const progName = inv.program_name || getProgramName(inv.program_id);
        const batchName = getBatchName(inv.batch_id);

        const items: ChallanItem[] = (inv.items && inv.items.length > 0)
          ? inv.items.map(it => ({ head_name: it.head_name || 'Tuition Fee', amount: it.net_amount }))
          : [{ head_name: 'Tuition Fee', amount: inv.net_amount }];

        return {
          challan_number: inv.invoice_number,
          roll_number: inv.roll_number || student?.roll_number || '—',
          admission_number: student?.admission_number || undefined,
          student_name: inv.student_name,
          father_name: fatherName,
          class_name: progName,
          batch_name: batchName,
          billing_month: inv.billing_month,
          issue_date: inv.issue_date || new Date().toISOString().split('T')[0],
          due_date: inv.due_date,
          items,
          concession_amount: inv.discount_amount > 0 ? inv.discount_amount : undefined,
          net_amount: inv.balance_amount > 0 ? inv.balance_amount : inv.net_amount,
        };
      });

      const bytes = await buildBatchChallansPdfBytes({
        academy: letterhead,
        bankDetails,
        layout: vouchersPerPage,
        challans: challanItems,
      });

      const scopeName = printScope === 'whole_institute' ? 'Institute_Wide' : (getProgramName(printProgramId).replace(/\s+/g, '_') || 'Batch');
      const filename = `Fee_Challans_${scopeName}_${new Date().toISOString().split('T')[0]}.pdf`;

      setPdfBytes(bytes);
      setPdfTitle(`Fee Challans (${list.length} Vouchers) • ${vouchersPerPage === '3_per_page' ? '3 Copies / Page' : '2 Copies / Page'}`);
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
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Fee Challans & Vouchers
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate class-wise and institute-wide monthly fee challans, preview in-portal, and print multi-voucher A4 sheets.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('generate')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'generate'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Challan Generation</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('print')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'print'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Challan Print Section</span>
              {invoices.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-indigo-50 text-indigo-700 rounded-full font-mono font-bold">
                  {invoices.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: CHALLAN GENERATION
          ========================================================================= */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Generation Setup Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                Generate New Monthly Challans
              </h2>

              {/* Scope selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Scope</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setGenScope('class')}
                    className={`py-2 px-2.5 text-xs font-semibold rounded-xl border transition-all text-center ${
                      genScope === 'class'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
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
                    className={`py-2 px-2.5 text-xs font-semibold rounded-xl border transition-all text-center ${
                      genScope === 'whole_institute'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Whole Institute
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenScope('single_student')}
                    className={`py-2 px-2.5 text-xs font-semibold rounded-xl border transition-all text-center ${
                      genScope === 'single_student'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
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

              {/* Single Student Admission No / Roll No Input */}
              {genScope === 'single_student' && (
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Student Admission # or Roll #
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
                      placeholder="Enter exact Admission #, Roll #, or name..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                    />
                  </div>

                  {matchedSingleStudent ? (
                    <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{matchedSingleStudent.full_name}</span>
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-mono font-bold text-[10px]">
                          Roll #{matchedSingleStudent.roll_number}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Class: <strong>{getProgramName(matchedSingleStudent.program_id)}</strong>
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
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] flex items-center gap-1.5">
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">Academic Year</label>
                    <select
                      value={genYear}
                      onChange={e => {
                        setGenYear(Number(e.target.value));
                        setGenErrorMessage(null);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                    >
                      {availableYears.map(yr => (
                        <option key={yr} value={yr}>{yr}–{yr + 1} Session</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Billing Month</label>
                    <select
                      value={genMonthName}
                      onChange={e => {
                        setGenMonthName(e.target.value);
                        setGenErrorMessage(null);
                      }}
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
              </div>

              {/* Feedback Messages */}
              {genSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{genSuccessMessage}</span>
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
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
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
                  disabled={isGenerating || eligibleGenerationStudents.length === 0}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Challans...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Generate Challans ({eligibleGenerationStudents.length} Students)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Institutional Generation Summary & Policies Card (Replaces Roster Box) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Fee Challan Generation Protocol</h3>
                  <p className="text-xs text-slate-500">Standard operating guidelines and billing safeguards</p>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                  {genMonth}
                </span>
              </div>

              {/* Guardrails Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Duplicate Challan Shield</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Active protection prevents generating duplicate active fee challans for the same student and month.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                    <Layers className="w-4 h-4" />
                    <span>Roll-Forward Arrears</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Unpaid dues from previous months automatically consolidate into an Arrears head without double debiting.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-700 font-bold text-xs">
                    <FileText className="w-4 h-4" />
                    <span>3-Part Bank Challans</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Standard A4 tripartite layout (Bank Copy, Academy Copy, Student Copy) with bank account particulars.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-700 font-bold text-xs">
                    <Calendar className="w-4 h-4" />
                    <span>Timeline & Due Dates</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Issue Date: <span className="font-mono font-bold text-slate-800">{genIssueDate}</span> | Due Date:{' '}
                    <span className="font-mono font-bold text-rose-700">{genDueDate}</span>.
                  </p>
                </div>
              </div>

              {/* Live Target Scope Summary */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Active Scope: </span>
                  <strong className="text-slate-900 capitalize">
                    {genScope === 'single_student'
                      ? (matchedSingleStudent ? `Single: ${matchedSingleStudent.full_name}` : 'Single Student (Enter Admission #)')
                      : genScope === 'whole_institute'
                      ? 'Whole Institute Roster'
                      : `${getProgramName(genProgramId)} • ${genBatchId === 'all' ? 'All Batches' : getBatchName(genBatchId)}`}
                  </strong>
                </div>
                <div className="font-mono font-bold text-slate-700">
                  Target Students:{' '}
                  <span className="text-indigo-600">
                    {genScope === 'single_student' ? (matchedSingleStudent ? 1 : 0) : eligibleGenerationStudents.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: CHALLAN PRINT SECTION
          ========================================================================= */}
      {activeTab === 'print' && (
        <div className="space-y-4">
          {/* Print Configuration Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                {/* Scope selector */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPrintScope('class')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      printScope === 'class' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Class-wise
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintScope('whole_institute');
                      setPrintProgramId('all');
                      setPrintBatchId('all');
                    }}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      printScope === 'whole_institute' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Whole Institute
                  </button>
                </div>

                {/* Class dropdown if class-wise */}
                {printScope === 'class' && (
                  <>
                    <select
                      value={printProgramId}
                      onChange={e => {
                        setPrintProgramId(e.target.value);
                        setPrintBatchId('all');
                      }}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                    >
                      <option value="all">All Classes</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    <select
                      value={printBatchId}
                      onChange={e => setPrintBatchId(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                    >
                      <option value="all">All Batches</option>
                      {batches
                        .filter(b => printProgramId === 'all' || b.program_id === printProgramId)
                        .map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                  </>
                )}

                {/* Billing Month Filter */}
                <select
                  value={printMonth}
                  onChange={e => setPrintMonth(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                >
                  <option value="all">All Billing Months</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={printStatus}
                  onChange={e => setPrintStatus(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                >
                  <option value="all">All Statuses</option>
                  <option value="unpaid">Unpaid / Pending Only</option>
                  <option value="paid">Paid Only</option>
                </select>
              </div>

              {/* Vouchers Per Page Selector & PDF Action */}
              <div className="flex items-center gap-2 self-end md:self-auto">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setVouchersPerPage('3_per_page')}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                      vouchersPerPage === '3_per_page'
                        ? 'bg-white text-indigo-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="3 copies per A4 page: Bank Copy, Academy Copy, Student Copy"
                  >
                    3 Per Page (Bank, Office, Student)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVouchersPerPage('2_per_page')}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                      vouchersPerPage === '2_per_page'
                        ? 'bg-white text-indigo-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="2 copies per A4 page: Academy Copy, Student Copy"
                  >
                    2 Per Page (Admin, Student)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handlePreviewAndPrint()}
                  disabled={isPreparingPdf || printableInvoices.length === 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50 shrink-0"
                >
                  {isPreparingPdf ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Preparing PDF...</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview & Print Challans</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Selection Status Strip */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printableInvoices.length > 0 && selectedInvoiceIds.size === printableInvoices.length}
                    onChange={handleToggleSelectAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Select All ({printableInvoices.length} Challans)</span>
                </label>
                {selectedInvoiceIds.size > 0 && (
                  <span className="font-semibold text-indigo-700">
                    {selectedInvoiceIds.size} of {printableInvoices.length} selected
                  </span>
                )}
              </div>

              <div className="font-mono text-slate-700">
                Total Billed:{' '}
                <span className="font-bold text-slate-900">
                  PKR {printableInvoices.reduce((s, i) => s + i.net_amount, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Challans Table Register */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={printableInvoices.length > 0 && selectedInvoiceIds.size === printableInvoices.length}
                        onChange={handleToggleSelectAll}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="py-2.5 px-3">Challan #</th>
                    <th className="py-2.5 px-3">Roll #</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Class & Section</th>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Amount (PKR)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Print Single</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {printableInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400">
                        No challans found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    printableInvoices.map(inv => {
                      const isChecked = selectedInvoiceIds.has(inv.id);
                      return (
                        <tr key={inv.id} className={`hover:bg-slate-50 ${isChecked ? 'bg-indigo-50/40' : ''}`}>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectOne(inv.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{inv.invoice_number}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{inv.roll_number}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{inv.student_name}</td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {inv.program_name || getProgramName(inv.program_id)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{inv.billing_month}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{inv.due_date}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {inv.net_amount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                              inv.status === 'paid' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : inv.status === 'partially_paid'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handlePreviewAndPrint([inv])}
                              className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                            >
                              Print
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
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
