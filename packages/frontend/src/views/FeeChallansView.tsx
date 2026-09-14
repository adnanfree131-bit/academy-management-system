import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  Printer, 
  Layers, 
  CheckCircle2, 
  RefreshCw, 
  Eye
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
  const [genScope, setGenScope] = useState<'class' | 'whole_institute'>('class');
  const [genProgramId, setGenProgramId] = useState<string>('all');
  const [genBatchId, setGenBatchId] = useState<string>('all');
  const [genMonth, setGenMonth] = useState<string>(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });
  const [genIssueDate, setGenIssueDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [genDueDate, setGenDueDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 10).toISOString().split('T')[0];
  });
  const [genLateFine, setGenLateFine] = useState<number>(200);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genSuccessMessage, setGenSuccessMessage] = useState<string | null>(null);

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
    let filtered = students.filter(s => s.status !== 'withdrawn');
    if (genScope === 'class' && genProgramId !== 'all') {
      filtered = filtered.filter(s => s.program_id === genProgramId);
      if (genBatchId !== 'all') {
        filtered = filtered.filter(s => s.batch_id === genBatchId);
      }
    }
    return filtered;
  }, [students, genScope, genProgramId, genBatchId]);

  // Handle Batch Challan Generation
  const handleGenerateChallans = async () => {
    if (!token || eligibleGenerationStudents.length === 0) return;
    setIsGenerating(true);
    setGenSuccessMessage(null);

    try {
      const payload = {
        scope: genScope === 'whole_institute' ? 'all' : (genBatchId !== 'all' ? 'batch' : (genProgramId !== 'all' ? 'program' : 'all')),
        target_id: genBatchId !== 'all' ? genBatchId : (genProgramId !== 'all' ? genProgramId : undefined),
        billing_month: genMonth,
        issue_date: genIssueDate,
        due_date: genDueDate,
        late_fee_fine: Number(genLateFine) || 200,
      };

      const res = await fetch('/api/v1/finance/invoices/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        setGenSuccessMessage(`Successfully generated ${resData.data?.count || eligibleGenerationStudents.length} challans for ${genMonth}.`);
        await fetchData();
        // Switch to print view for this month
        setPrintMonth(genMonth);
        if (genProgramId !== 'all') setPrintProgramId(genProgramId);
        if (genBatchId !== 'all') setPrintBatchId(genBatchId);
      } else {
        alert(resData.message || 'Failed to generate challans. Please verify inputs.');
      }
    } catch (err: any) {
      console.error('Error generating batch challans:', err);
      alert('Network or server error while generating challans.');
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
          late_fee_fine: 200,
          total_after_due_date: (inv.balance_amount > 0 ? inv.balance_amount : inv.net_amount) + 200,
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGenScope('class')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all text-center ${
                      genScope === 'class'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Class & Batch Wise
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenScope('whole_institute');
                      setGenProgramId('all');
                      setGenBatchId('all');
                    }}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all text-center ${
                      genScope === 'whole_institute'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Whole Institute
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

              {/* Billing Month & Dates */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Billing Month</label>
                  <input
                    type="text"
                    value={genMonth}
                    onChange={e => setGenMonth(e.target.value)}
                    placeholder="e.g. October 2026"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                  />
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Late Fee Fine (PKR)</label>
                  <input
                    type="number"
                    value={genLateFine}
                    onChange={e => setGenLateFine(Number(e.target.value))}
                    min={0}
                    step={50}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Automatically appended to total after due date on printed challans.
                  </span>
                </div>
              </div>

              {/* Feedback Success Message */}
              {genSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{genSuccessMessage}</span>
                </div>
              )}

              {/* Action Button */}
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
            </div>
          </div>

          {/* Student Roster Preview */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Student Roster to be Invoiced</h3>
                  <p className="text-[11px] text-slate-500">
                    {eligibleGenerationStudents.length} active students in selected scope
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                  {genMonth}
                </span>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Roll #</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Class & Batch</th>
                      <th className="py-2.5 px-3">Father Name</th>
                      <th className="py-2.5 px-3 text-right">Tuition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eligibleGenerationStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No active students found in this selection.
                        </td>
                      </tr>
                    ) : (
                      eligibleGenerationStudents.map(stud => {
                        const progName = getProgramName(stud.program_id);
                        const batchName = getBatchName(stud.batch_id);
                        const struct = feeStructures.find(s => s.batch_id === stud.batch_id);
                        const baseFee = (struct?.items || []).reduce((sum, it) => sum + Number(it.amount || 0), 0) || 2000;
                        return (
                          <tr key={stud.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{stud.roll_number}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-900">{stud.full_name}</td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {progName} {batchName ? `(${batchName})` : ''}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{stud.guardian_name || stud.father_name || '—'}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              PKR {baseFee.toLocaleString()}
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
