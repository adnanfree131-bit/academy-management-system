import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Receipt,
  Plus,
  Search,
  Printer,
  CreditCard,
  CheckCircle2,
  FileText,
  DollarSign,
  Download,
  Building2,
  X,
  Edit2,
  TrendingUp,
  Percent,
  BarChart2,
  MessageSquare,
  AlertCircle,
  Check,
  Eye,
  ArrowUp,
  ArrowDown,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { academyLetterheadFromAuth, buildSimpleStatementPdf, downloadPdfBytes } from '../lib/officialDocumentPdf';
import { buildTabularFeeReportPdfBytes } from '../lib/feeReportsPdf';
import { InPortalPdfViewerModal } from '../components/InPortalPdfViewerModal';
import {
  FeeHead,
  StudentInvoice,
  PaymentDistributionItem,
  FeeDiscount,
  DailyCashbookEntry,
  StudentLedgerEntry,
  StudentFeeStructure,
  PaymentMethod
} from '@apex/shared-types';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';
import {
  FeeSlipData,
  AcademyInfo,
  dispatchWhatsAppFeeSlipWithPicture,
  copyAndDownloadFeeSlip,
  renderFeeSlipCanvas
} from '../lib/feeSlipPicture';

export const FeeDeskView: React.FC = () => {
  const { token, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'cashier' | 'invoices' | 'defaulters' | 'reports' | 'structures' | 'discounts' | 'fee_heads'>('cashier');

  // Core Data
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [feeStructures, setFeeStructures] = useState<StudentFeeStructure[]>([]);
  const [discounts, setDiscounts] = useState<FeeDiscount[]>([]);
  const [cashbook, setCashbook] = useState<DailyCashbookEntry[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [academySettings, setAcademySettings] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [dayCloseDate, setDayCloseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dayCloseRecords, setDayCloseRecords] = useState<DailyCashbookEntry[]>([]);
  const [expandedDefaulterId, setExpandedDefaulterId] = useState<string | null>(null);

  // Cashier Student Search & Family Desk
  const [cashierSearch, setCashierSearch] = useState<string>('');
  const [cashierClassFilter, setCashierClassFilter] = useState<string>('all');
  const [selectedCashierStudentId, setSelectedCashierStudentId] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<{
    guardian_name: string;
    guardian_phone: string;
    guardian_id_card: string;
    members: Array<{
      student: any;
      invoices: StudentInvoice[];
      unpaidInvoices: StudentInvoice[];
      totalDue: number;
    }>;
    totalFamilyDue: number;
  } | null>(null);
  const [familyAllocations, setFamilyAllocations] = useState<Record<string, number>>({});
  const [familyPaymentMethod, setFamilyPaymentMethod] = useState<PaymentMethod>('cash');
  const [familyReference, setFamilyReference] = useState<string>('');
  const [familyBankName, setFamilyBankName] = useState<string>('');
  const [isSubmittingFamily, setIsSubmittingFamily] = useState<boolean>(false);
  const [familyReceiptData, setFamilyReceiptData] = useState<{
    receiptNumber: string;
    totalPaid: number;
    paymentMethod: string;
    referenceNumber?: string;
    guardianName: string;
    guardianPhone: string;
    date: string;
    breakdown: Array<{ studentName: string; rollNumber: string; className: string; amountPaid: number }>;
  } | null>(null);

  // Reports Hub State
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState<string>(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // In-Portal PDF Viewer State
  const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfTitle, setPdfTitle] = useState<string>('Fee Report');
  const [pdfFilename, setPdfFilename] = useState<string>('Fee_Report.pdf');

  const getProgramName = useCallback((progId?: string) => {
    if (!progId) return '';
    return programs.find(p => p.id === progId)?.name || '';
  }, [programs]);

  const availableBatchesForFilter = useMemo(() => {
    if (selectedProgram === 'all') return batches;
    return batches.filter(b => b.program_id === selectedProgram);
  }, [batches, selectedProgram]);

  // Operational Modals & Drawers
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [showBatchInvoiceModal, setShowBatchInvoiceModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showDiscountModal, setShowDiscountModal] = useState<boolean>(false);
  const [showBulkRevisionModal, setShowBulkRevisionModal] = useState<boolean>(false);
  const [showCashierDrawer, setShowCashierDrawer] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showPictureSlipModal, setShowPictureSlipModal] = useState<boolean>(false);
  const [showStructureModal, setShowStructureModal] = useState<boolean>(false);

  // Active Entity Selection
  const [activeInvoice, setActiveInvoice] = useState<StudentInvoice | null>(null);
  const [activePaymentReceipt, setActivePaymentReceipt] = useState<any | null>(null);
  const [previewSlipImage, setPreviewSlipImage] = useState<{ dataUrl: string; invoice: StudentInvoice; student?: any } | null>(null);
  const [receiptSlipImage, setReceiptSlipImage] = useState<string | null>(null);
  const [isRenderingReceipt, setIsRenderingReceipt] = useState<boolean>(false);

  // Cashier Drawer Payment Form State
  const [collectionAmount, setCollectionAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentBankName, setPaymentBankName] = useState<string>('');
  const [paymentChequeNumber, setPaymentChequeNumber] = useState<string>('');
  const [paymentClearingDate, setPaymentClearingDate] = useState<string>('');
  const [distributionItems, setDistributionItems] = useState<PaymentDistributionItem[]>([]);
  const [isOverrideActive, setIsOverrideActive] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isCommittingPayment, setIsCommittingPayment] = useState<boolean>(false);

  // Bulk Fee Revision Form State
  const [bulkRevScope, setBulkRevScope] = useState<'all' | 'program' | 'batch'>('all');
  const [bulkRevProgramId, setBulkRevProgramId] = useState<string>('');
  const [bulkRevBatchId, setBulkRevBatchId] = useState<string>('');
  const [bulkRevType, setBulkRevType] = useState<'percentage' | 'fixed'>('percentage');
  const [bulkRevValue, setBulkRevValue] = useState<number>(10);
  const [bulkRevRounding, setBulkRevRounding] = useState<'none' | 'nearest_50' | 'nearest_100'>('nearest_100');
  const [bulkRevReason, setBulkRevReason] = useState<string>('Annual Tuition Fee Revision');
  const [isSubmittingBulkRev, setIsSubmittingBulkRev] = useState<boolean>(false);

  // Void Payment State
  const [voidPaymentModal, setVoidPaymentModal] = useState<DailyCashbookEntry | null>(null);
  const [voidReasonText, setVoidReasonText] = useState<string>('');
  const [voidSubmitting, setVoidSubmitting] = useState<boolean>(false);

  // Form States: New Single Invoice
  const [newInvStudentId, setNewInvStudentId] = useState<string>('');
  const [newInvMonth, setNewInvMonth] = useState<string>(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const [newInvDueDate, setNewInvDueDate] = useState<string>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString().split('T')[0]);
  const [newInvNotes, setNewInvNotes] = useState<string>('');
  const [newInvCustomItems, setNewInvCustomItems] = useState<{ fee_head_id: string; amount: number }[]>([]);

  // Form States: Batch Invoicing
  const [batchInvBatchId, setBatchInvBatchId] = useState<string>('');
  const [batchInvMonth, setBatchInvMonth] = useState<string>(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const [batchInvDueDate, setBatchInvDueDate] = useState<string>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString().split('T')[0]);

  // Form States: Discount
  const [discountStudentId, setDiscountStudentId] = useState<string>('');
  const [discountInvoiceId, setDiscountInvoiceId] = useState<string>('');
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [discountReason, setDiscountReason] = useState<string>('');

  // Form States: Fee Structures
  const [editingStructure, setEditingStructure] = useState<StudentFeeStructure | null>(null);
  const [structureBatchId, setStructureBatchId] = useState<string>('');
  const [structureSession, setStructureSession] = useState<string>('2026-2027');
  const [structureItems, setStructureItems] = useState<{ fee_head_id: string; amount: number }[]>([]);
  const [isSavingStructure, setIsSavingStructure] = useState<boolean>(false);

  // Form States: Fee Heads Management
  const [showHeadModal, setShowHeadModal] = useState<boolean>(false);
  const [editingHead, setEditingHead] = useState<FeeHead | null>(null);
  const [headForm, setHeadForm] = useState({
    name: '',
    code: '',
    default_amount: '' as number | '',
    priority_order: '' as number | '',
    show_at_admission: true,
  });
  const [isSavingHead, setIsSavingHead] = useState<boolean>(false);

  // Student Ledger
  const [ledgerStudentId, setLedgerStudentId] = useState<string>('');
  const [studentLedger, setStudentLedger] = useState<StudentLedgerEntry[]>([]);

  // Toast / Feedback banner
  const [feedbackNotice, setFeedbackNotice] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedbackNotice({ message, type });
    setTimeout(() => {
      setFeedbackNotice(null);
    }, 6000);
  };

  // Resolve Academy Institutional Info
  const academyInfo: AcademyInfo = useMemo(() => {
    const s = academySettings || (tenant?.settings as any) || {};
    return {
      name: tenant?.name || 'Academy',
      campus: s.campus_name || tenant?.campus_name || 'Main Campus',
      phone: s.phone || tenant?.phone || '',
      email: s.email || '',
      address: s.address || '',
      bank_name: s.bank_name || '',
      account_title: s.account_title || tenant?.name || '',
      account_number: s.account_number || '',
      iban: s.iban || '',
      easypaisa_number: s.raast_id || s.phone || tenant?.phone || '',
      jazzcash_number: s.raast_id || s.phone || tenant?.phone || '',
    };
  }, [tenant, academySettings]);

  // Fetch Core Data
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [invRes, headsRes, structRes, discRes, cashRes, studRes, batchRes, progRes, settRes, priorityRes] = await Promise.all([
        fetch('/api/v1/finance/invoices', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/heads', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/structures', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/discounts', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/reports/cashbook', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/sis/students', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/batches', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/programs', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/academy-settings', { headers: { authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/v1/finance/priority-config', { headers: { authorization: `Bearer ${token}` } }).catch(() => null),
      ]);

      if (invRes.ok) setInvoices((await invRes.json()).data || []);
      
      let fetchedHeads: FeeHead[] = [];
      if (headsRes.ok) fetchedHeads = (await headsRes.json()).data || [];
      if (priorityRes && priorityRes.ok) {
        const pData = await priorityRes.json();
        const order: string[] = pData?.data?.priority_order || [];
        if (order.length > 0 && fetchedHeads.length > 0) {
          fetchedHeads.sort((a, b) => {
            let idxA = order.indexOf(a.id);
            if (idxA === -1) idxA = order.indexOf(a.name);
            if (idxA === -1) idxA = 999;
            let idxB = order.indexOf(b.id);
            if (idxB === -1) idxB = order.indexOf(b.name);
            if (idxB === -1) idxB = 999;
            return idxA - idxB;
          });
        }
      }
      setFeeHeads(fetchedHeads);

      if (structRes.ok) setFeeStructures((await structRes.json()).data || []);
      if (discRes.ok) setDiscounts((await discRes.json()).data || []);
      if (cashRes.ok) setCashbook((await cashRes.json()).data || []);
      if (settRes && settRes.ok) {
        const sData = await settRes.json();
        if (sData.success && sData.data) {
          setAcademySettings(sData.data.settings || sData.data);
        }
      }
      if (studRes.ok) {
        const studList = (await studRes.json()).data || [];
        setStudents(studList);
        if (studList.length > 0) {
          setLedgerStudentId(prev => prev || studList[0].id);
        }
      }
      if (batchRes.ok) setBatches((await batchRes.json()).data || []);
      if (progRes && progRes.ok) setPrograms((await progRes.json()).data || []);
    } catch (err) {
      console.error('Failed to load fee data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Dedicated Cashier Day-Close fetch on date selection
  const fetchDayCloseData = useCallback(async (dateStr: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/finance/reports/cashbook?date=${dateStr}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDayCloseRecords(data.data);
      }
    } catch (err) {
      console.error('Failed to load day close records for date', dateStr, err);
    }
  }, [token]);

  useEffect(() => {
    fetchDayCloseData(dayCloseDate);
  }, [dayCloseDate, fetchDayCloseData]);

  const handlePrevDay = () => {
    const d = new Date(dayCloseDate);
    d.setDate(d.getDate() - 1);
    setDayCloseDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(dayCloseDate);
    d.setDate(d.getDate() + 1);
    setDayCloseDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setDayCloseDate(new Date().toISOString().split('T')[0]);
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Load student ledger when selected
  useEffect(() => {
    if (token && ledgerStudentId) {
      fetch(`/api/v1/finance/reports/student-ledger/${ledgerStudentId}`, {
        headers: { authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(res => setStudentLedger(res.data || []))
        .catch(err => console.error(err));
    }
  }, [token, ledgerStudentId]);

  // Filtered Invoices for Primary Ledger
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        inv.student_name.toLowerCase().includes(q) ||
        inv.roll_number.toLowerCase().includes(q) ||
        inv.invoice_number.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      const stud = students.find(s => s.id === inv.student_id);
      const invProgId = inv.program_id || stud?.program_id;
      const matchesProgram = selectedProgram === 'all' || invProgId === selectedProgram;
      const matchesBatch = selectedBatch === 'all' || inv.batch_id === selectedBatch;
      return matchesSearch && matchesStatus && matchesProgram && matchesBatch;
    });
  }, [invoices, searchQuery, statusFilter, selectedProgram, selectedBatch, students]);

  // Defaulters List Grouped by Student (Simple - No Aging Buckets)
  const defaultersList = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueInvoices = invoices
      .filter(inv => {
        if (inv.status === 'paid' || inv.status === 'voided' || inv.balance_amount <= 0) return false;
        const due = new Date(inv.due_date);
        due.setHours(0, 0, 0, 0);
        return today.getTime() > due.getTime();
      })
      .map(inv => {
        const due = new Date(inv.due_date);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.max(1, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
        return {
          ...inv,
          overdue_days: diffDays,
        };
      });

    const grouped = new Map<string, {
      student_id: string;
      student_name: string;
      roll_number: string;
      father_name: string;
      guardian_phone: string;
      program_name: string;
      batch_name: string;
      batch_id: string;
      overdue_invoices_count: number;
      unpaid_months: string[];
      max_overdue_days: number;
      total_balance: number;
      latest_invoice: StudentInvoice;
      invoices: (StudentInvoice & { overdue_days: number })[];
    }>();

    for (const inv of overdueInvoices) {
      const stud = students.find(s => s.id === inv.student_id);
      let entry = grouped.get(inv.student_id);
      if (!entry) {
        const progName = inv.program_name || getProgramName(inv.program_id || stud?.program_id) || 'Class';
        entry = {
          student_id: inv.student_id,
          student_name: inv.student_name,
          roll_number: inv.roll_number,
          program_name: progName,
          batch_id: inv.batch_id,
          batch_name: inv.batch_name,
          father_name: stud?.father_name || stud?.guardian_name || 'Guardian',
          guardian_phone: stud?.guardian_phone || stud?.guardian_whatsapp || stud?.phone || '',
          total_balance: 0,
          overdue_invoices_count: 0,
          max_overdue_days: 0,
          unpaid_months: [],
          invoices: [],
          latest_invoice: inv,
        };
        grouped.set(inv.student_id, entry);
      }

      entry.invoices.push(inv);
      entry.total_balance += inv.balance_amount;
      entry.overdue_invoices_count += 1;
      if (inv.overdue_days > entry.max_overdue_days) {
        entry.max_overdue_days = inv.overdue_days;
      }
      if (!entry.unpaid_months.includes(inv.billing_month)) {
        entry.unpaid_months.push(inv.billing_month);
      }
      if (new Date(inv.due_date).getTime() >= new Date(entry.latest_invoice.due_date).getTime()) {
        entry.latest_invoice = inv;
      }
    }

    return Array.from(grouped.values())
      .filter(def => {
        if (selectedBatch !== 'all' && def.batch_id !== selectedBatch) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            def.student_name.toLowerCase().includes(q) ||
            def.roll_number.toLowerCase().includes(q) ||
            def.father_name.toLowerCase().includes(q) ||
            def.unpaid_months.some(m => m.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => b.total_balance - a.total_balance);
  }, [invoices, students, selectedBatch, searchQuery, getProgramName]);

  // Summary Totals
  const totalDefaultersCount = defaultersList.length;
  const totalDefaultersAmount = defaultersList.reduce((s, d) => s + d.total_balance, 0);

  // Sibling Finder Helper
  const getStudentSiblings = useCallback((student: any) => {
    if (!student) return [];
    return students.filter(other => {
      if (other.id === student.id) return false;
      const sCnic = (student.guardian_id_card || '').trim();
      const oCnic = (other.guardian_id_card || '').trim();
      if (sCnic && oCnic && sCnic === oCnic) return true;

      const sPhone = (student.guardian_phone || student.phone || '').replace(/\D/g, '');
      const oPhone = (other.guardian_phone || other.phone || '').replace(/\D/g, '');
      if (sPhone.length >= 7 && oPhone.length >= 7 && sPhone === oPhone) return true;

      const sFather = (student.guardian_name || student.father_name || '').toLowerCase().trim();
      const oFather = (other.guardian_name || other.father_name || '').toLowerCase().trim();
      if (sFather && oFather && sFather.length > 3 && sFather === oFather) return true;

      return false;
    });
  }, [students]);

  // Open Family Sibling Modal for a student
  const handleOpenFamilyModal = (student: any) => {
    const siblings = getStudentSiblings(student);
    const allFamilyStudents = [student, ...siblings];

    const members = allFamilyStudents.map(stud => {
      const studInvoices = invoices.filter(i => i.student_id === stud.id);
      const unpaidInvoices = studInvoices.filter(i => i.status !== 'paid' && i.balance_amount > 0);
      const totalDue = unpaidInvoices.reduce((s, inv) => s + inv.balance_amount, 0);
      return {
        student: stud,
        invoices: studInvoices,
        unpaidInvoices,
        totalDue,
      };
    });

    const totalFamilyDue = members.reduce((sum, m) => sum + m.totalDue, 0);

    const initialAlloc: Record<string, number> = {};
    for (const m of members) {
      for (const inv of m.unpaidInvoices) {
        initialAlloc[inv.id] = inv.balance_amount;
      }
    }

    setFamilyAllocations(initialAlloc);
    setFamilyPaymentMethod('cash');
    setFamilyReference('');
    setFamilyBankName('');
    setSelectedFamily({
      guardian_name: student.guardian_name || student.father_name || 'Guardian',
      guardian_phone: student.guardian_phone || student.phone || '',
      guardian_id_card: student.guardian_id_card || '',
      members,
      totalFamilyDue,
    });
  };

  // Commit Family Payment
  const handleCommitFamilyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFamily || !token) return;

    const paymentItems = Object.entries(familyAllocations)
      .filter(([_, amount]) => Number(amount) > 0)
      .map(([invId, amount]) => ({
        invoice_id: invId,
        amount_paid: Number(amount),
      }));

    if (paymentItems.length === 0) {
      alert('Please enter a payment amount for at least one child.');
      return;
    }

    setIsSubmittingFamily(true);
    try {
      const res = await fetch('/api/v1/finance/family-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payment_method: familyPaymentMethod,
          reference_number: familyReference || undefined,
          bank_name: familyBankName || undefined,
          payments: paymentItems,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const breakdown = data.data.results.map((r: any) => ({
          studentName: r.invoice.student_name,
          rollNumber: r.invoice.roll_number,
          className: r.invoice.program_name || '',
          amountPaid: r.payment.amount_paid,
        }));

        setFamilyReceiptData({
          receiptNumber: data.data.family_receipt_number,
          totalPaid: data.data.total_amount,
          paymentMethod: familyPaymentMethod,
          referenceNumber: familyReference,
          guardianName: selectedFamily.guardian_name,
          guardianPhone: selectedFamily.guardian_phone,
          date: new Date().toISOString().split('T')[0],
          breakdown,
        });

        setSelectedFamily(null);
        showToast(`Family payment of PKR ${data.data.total_amount.toLocaleString()} recorded successfully.`);
        fetchData();
        fetchDayCloseData(dayCloseDate);
      } else {
        alert(data.error?.message || 'Failed to record family payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error recording family payment');
    } finally {
      setIsSubmittingFamily(false);
    }
  };

  // Cashier Filtered Students Roster (Only shows when search query is typed)
  const cashierFilteredStudents = useMemo(() => {
    if (!cashierSearch.trim()) {
      return [];
    }
    let list = students;
    if (cashierClassFilter !== 'all') {
      list = list.filter(s => s.program_id === cashierClassFilter);
    }
    const q = cashierSearch.toLowerCase().trim();
    return list.filter(s => {
      const nameMatch = s.full_name?.toLowerCase().includes(q);
      const rollMatch = s.roll_number?.toLowerCase().includes(q);
      const admMatch = s.admission_number?.toLowerCase().includes(q);
      const guardMatch = s.guardian_name?.toLowerCase().includes(q) || s.father_name?.toLowerCase().includes(q);
      const phoneMatch = s.phone?.includes(q) || s.guardian_phone?.includes(q);
      const cnicMatch = s.guardian_id_card?.includes(q);
      return nameMatch || rollMatch || admMatch || guardMatch || phoneMatch || cnicMatch;
    });
  }, [students, cashierClassFilter, cashierSearch]);

  // In-Portal PDF Report Generator & Viewer Handler
  const handleOpenReportPdf = async (reportType: string) => {
    setIsGeneratingPdf(true);
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      let title = 'Fee Report';
      let filename = 'Fee_Report.pdf';
      let bytes: Uint8Array | null = null;

      if (reportType === 'defaulters') {
        title = 'Student Fee Defaulters List';
        filename = `Fee_Defaulters_${new Date().toISOString().split('T')[0]}.pdf`;
        const rows = defaultersList.map((d, i) => ({
          sr: String(i + 1),
          roll: d.roll_number,
          name: d.student_name,
          class_sec: `${d.program_name} (${d.batch_name})`,
          father: d.father_name,
          phone: d.guardian_phone || '—',
          invoices_due: `${d.overdue_invoices_count} (${d.unpaid_months.join(', ')})`,
          balance: `PKR ${d.total_balance.toLocaleString()}`,
        }));
        bytes = await buildTabularFeeReportPdfBytes({
          title,
          academy: letterhead,
          filterInfo: [
            { label: 'Total Defaulters', value: `${defaultersList.length} Students` },
            { label: 'Date', value: new Date().toLocaleDateString('en-GB') },
          ],
          summaryStrip: [
            { label: 'Total Defaulters', value: `${defaultersList.length} Students` },
            { label: 'Total Outstanding', value: `PKR ${totalDefaultersAmount.toLocaleString()}` },
          ],
          columns: [
            { key: 'sr', label: 'S#', width: 26 },
            { key: 'roll', label: 'Roll #', width: 44 },
            { key: 'name', label: 'Student Name', width: 95 },
            { key: 'class_sec', label: 'Class & Sec', width: 95 },
            { key: 'father', label: 'Father Name', width: 85 },
            { key: 'phone', label: 'Phone', width: 75 },
            { key: 'balance', label: 'Unpaid Dues', width: 80, align: 'right' },
          ],
          rows,
          filename,
        });
      } else if (reportType === 'family') {
        title = 'Family & Sibling Fee Record';
        filename = `Family_Sibling_Fee_Record_${new Date().toISOString().split('T')[0]}.pdf`;
        const familiesMap = new Map<string, { guardian: string; phone: string; cnic: string; children: string[]; totalDue: number }>();
        for (const s of students) {
          const key = (s.guardian_id_card || s.guardian_phone || s.guardian_name || '').trim();
          if (!key) continue;
          let fam = familiesMap.get(key);
          const studInvs = invoices.filter(i => i.student_id === s.id && i.status !== 'paid');
          const due = studInvs.reduce((sum, inv) => sum + inv.balance_amount, 0);
          const progName = getProgramName(s.program_id) || 'Class';
          const childDesc = `${s.full_name} (${progName} - Roll ${s.roll_number})`;
          if (!fam) {
            fam = {
              guardian: s.guardian_name || s.father_name || 'Guardian',
              phone: s.guardian_phone || s.phone || '—',
              cnic: s.guardian_id_card || '—',
              children: [childDesc],
              totalDue: due,
            };
            familiesMap.set(key, fam);
          } else {
            fam.children.push(childDesc);
            fam.totalDue += due;
          }
        }
        const siblingFamilies = Array.from(familiesMap.values()).filter(f => f.children.length >= 2);
        const rows = siblingFamilies.map((f, i) => ({
          sr: String(i + 1),
          guardian: f.guardian,
          contact: `${f.phone} / ${f.cnic}`,
          children_list: f.children.join('; '),
          total_due: `PKR ${f.totalDue.toLocaleString()}`,
        }));
        bytes = await buildTabularFeeReportPdfBytes({
          title,
          academy: letterhead,
          summaryStrip: [
            { label: 'Total Families', value: `${siblingFamilies.length} Families` },
            { label: 'Combined Outstanding', value: `PKR ${siblingFamilies.reduce((s, f) => s + f.totalDue, 0).toLocaleString()}` },
          ],
          columns: [
            { key: 'sr', label: 'S#', width: 26 },
            { key: 'guardian', label: 'Father / Guardian', width: 100 },
            { key: 'contact', label: 'Phone / CNIC', width: 100 },
            { key: 'children_list', label: 'Enrolled Siblings', width: 195 },
            { key: 'total_due', label: 'Family Balance', width: 79, align: 'right' },
          ],
          rows,
          filename,
        });
      } else if (reportType === 'class_wise') {
        title = 'Class-wise Fee Collection Report';
        filename = `Class_Wise_Fee_Report_${new Date().toISOString().split('T')[0]}.pdf`;
        const rows: any[] = [];
        let grandBilled = 0;
        let grandCollected = 0;
        let grandPending = 0;

        for (const prog of programs) {
          const progInvoices = invoices.filter(i => {
            const stud = students.find(s => s.id === i.student_id);
            return (i.program_id || stud?.program_id) === prog.id;
          });
          const progStudents = students.filter(s => s.program_id === prog.id);
          const billed = progInvoices.reduce((s, i) => s + i.net_amount, 0);
          const collected = progInvoices.reduce((s, i) => s + i.paid_amount, 0);
          const pending = progInvoices.reduce((s, i) => s + i.balance_amount, 0);
          const recoveryPct = billed > 0 ? `${((collected / billed) * 100).toFixed(1)}%` : '0%';
          grandBilled += billed;
          grandCollected += collected;
          grandPending += pending;

          rows.push({
            class_name: prog.name,
            total_students: String(progStudents.length),
            billed: `PKR ${billed.toLocaleString()}`,
            collected: `PKR ${collected.toLocaleString()}`,
            pending: `PKR ${pending.toLocaleString()}`,
            recovery: recoveryPct,
          });
        }
        bytes = await buildTabularFeeReportPdfBytes({
          title,
          academy: letterhead,
          summaryStrip: [
            { label: 'Total Billed', value: `PKR ${grandBilled.toLocaleString()}` },
            { label: 'Total Collected', value: `PKR ${grandCollected.toLocaleString()}` },
            { label: 'Total Outstanding', value: `PKR ${grandPending.toLocaleString()}` },
            { label: 'Recovery Rate', value: grandBilled > 0 ? `${((grandCollected / grandBilled) * 100).toFixed(1)}%` : '0%' },
          ],
          columns: [
            { key: 'class_name', label: 'Class / Program', width: 140 },
            { key: 'total_students', label: 'Students', width: 60, align: 'right' },
            { key: 'billed', label: 'Total Billed', width: 75, align: 'right' },
            { key: 'collected', label: 'Collected', width: 75, align: 'right' },
            { key: 'pending', label: 'Outstanding', width: 80, align: 'right' },
            { key: 'recovery', label: 'Recovery %', width: 60, align: 'right' },
          ],
          rows,
          filename,
        });
      } else if (reportType === 'date_range') {
        title = 'Fee Collection Register (Cashbook)';
        filename = `Fee_Register_${reportStartDate}_to_${reportEndDate}.pdf`;
        const filteredCashbook = cashbook.filter(c => {
          if (c.status === 'voided') return false;
          return c.date >= reportStartDate && c.date <= reportEndDate;
        });
        const totalAmt = filteredCashbook.reduce((s, c) => s + Number(c.amount || 0), 0);
        const rows = filteredCashbook.map((c, i) => ({
          sr: String(i + 1),
          receipt_no: c.receipt_number || (c as any).voucher_number || `VCH-${i + 1}`,
          date: c.date,
          student: c.student_name || (c as any).paid_to_or_received_from || '—',
          method: (c.payment_method || 'Cash').toUpperCase(),
          ref_no: (c as any).reference_number || '—',
          amount: `PKR ${Number(c.amount).toLocaleString()}`,
        }));
        bytes = await buildTabularFeeReportPdfBytes({
          title,
          academy: letterhead,
          filterInfo: [
            { label: 'From Date', value: reportStartDate },
            { label: 'To Date', value: reportEndDate },
          ],
          summaryStrip: [
            { label: 'Total Receipts', value: `${filteredCashbook.length} Vouchers` },
            { label: 'Total Collected', value: `PKR ${totalAmt.toLocaleString()}` },
          ],
          columns: [
            { key: 'sr', label: 'S#', width: 26 },
            { key: 'receipt_no', label: 'Receipt #', width: 85 },
            { key: 'date', label: 'Date', width: 65 },
            { key: 'student', label: 'Received From', width: 124 },
            { key: 'method', label: 'Payment Mode', width: 75 },
            { key: 'ref_no', label: 'Reference / Chq', width: 50 },
            { key: 'amount', label: 'Amount Paid', width: 75, align: 'right' },
          ],
          rows,
          filename,
        });
      } else if (reportType === 'month_wise') {
        title = `Monthly Fee Billing Summary: ${reportMonth}`;
        filename = `Monthly_Fee_Summary_${reportMonth.replace(/\s+/g, '_')}.pdf`;
        const monthInvoices = invoices.filter(i => i.billing_month.toLowerCase() === reportMonth.toLowerCase());
        const billed = monthInvoices.reduce((s, i) => s + i.net_amount, 0);
        const collected = monthInvoices.reduce((s, i) => s + i.paid_amount, 0);
        const pending = monthInvoices.reduce((s, i) => s + i.balance_amount, 0);
        const rows = monthInvoices.map((inv, i) => ({
          sr: String(i + 1),
          inv_no: inv.invoice_number,
          roll: inv.roll_number,
          name: inv.student_name,
          class_name: inv.program_name || '',
          due_date: inv.due_date,
          status: inv.status.toUpperCase(),
          billed: `PKR ${inv.net_amount.toLocaleString()}`,
          paid: `PKR ${inv.paid_amount.toLocaleString()}`,
          balance: `PKR ${inv.balance_amount.toLocaleString()}`,
        }));
        bytes = await buildTabularFeeReportPdfBytes({
          title,
          academy: letterhead,
          summaryStrip: [
            { label: 'Total Invoices', value: `${monthInvoices.length} Challans` },
            { label: 'Total Billed', value: `PKR ${billed.toLocaleString()}` },
            { label: 'Total Collected', value: `PKR ${collected.toLocaleString()}` },
            { label: 'Total Remaining', value: `PKR ${pending.toLocaleString()}` },
          ],
          columns: [
            { key: 'sr', label: 'S#', width: 24 },
            { key: 'inv_no', label: 'Challan #', width: 65 },
            { key: 'roll', label: 'Roll #', width: 38 },
            { key: 'name', label: 'Student Name', width: 95 },
            { key: 'class_name', label: 'Class', width: 65 },
            { key: 'status', label: 'Status', width: 55 },
            { key: 'billed', label: 'Net Billed', width: 55, align: 'right' },
            { key: 'paid', label: 'Paid', width: 50, align: 'right' },
            { key: 'balance', label: 'Remaining', width: 53, align: 'right' },
          ],
          rows,
          filename,
        });
      } else if (reportType === 'daily_closing') {
        title = `Daily Cashier Collection Sheet: ${dayCloseDate}`;
        filename = `Daily_Collection_Sheet_${dayCloseDate}.pdf`;
        const rows = dayCloseEntries.map((c, i) => ({
          sr: String(i + 1),
          receipt_no: c.receipt_number || (c as any).voucher_number || `REC-${i + 1}`,
          student: c.student_name || (c as any).paid_to_or_received_from || '—',
          method: (c.payment_method || 'Cash').toUpperCase(),
          ref_no: (c as any).reference_number || '—',
          amount: `PKR ${Number(c.amount).toLocaleString()}`,
        }));
        bytes = await buildTabularFeeReportPdfBytes({
          title,
          academy: letterhead,
          summaryStrip: [
            { label: 'Cash in Hand', value: `PKR ${dayCloseSummary.cash.toLocaleString()}` },
            { label: 'Bank Transfers', value: `PKR ${dayCloseSummary.bank_transfer.toLocaleString()}` },
            { label: 'Mobile Wallets', value: `PKR ${(dayCloseSummary.easypaisa + dayCloseSummary.jazzcash).toLocaleString()}` },
            { label: 'Total Day Collection', value: `PKR ${dayCloseSummary.total.toLocaleString()}` },
          ],
          columns: [
            { key: 'sr', label: 'S#', width: 26 },
            { key: 'receipt_no', label: 'Receipt #', width: 95 },
            { key: 'student', label: 'Student / Payer', width: 145 },
            { key: 'method', label: 'Payment Mode', width: 85 },
            { key: 'ref_no', label: 'Ref # / Cheque', width: 65 },
            { key: 'amount', label: 'Amount (PKR)', width: 84, align: 'right' },
          ],
          rows,
          filename,
        });
      } else if (reportType === 'fee_heads') {
        title = 'Fee Head Revenue Summary';
        filename = `Fee_Head_Summary_${new Date().toISOString().split('T')[0]}.pdf`;
        const rows = feeHeads.map((h, i) => {
          let totalHeadBilled = 0;
          let totalHeadPaid = 0;
          for (const inv of invoices) {
            for (const item of inv.items || []) {
              if (item.fee_head_id === h.id) {
                totalHeadBilled += item.net_amount;
                totalHeadPaid += item.paid_amount;
              }
            }
          }
          const pending = totalHeadBilled - totalHeadPaid;
          return {
            sr: String(i + 1),
            code: h.code,
            name: h.name,
            default_rate: h.default_amount ? `PKR ${h.default_amount.toLocaleString()}` : 'Dynamic',
            billed: `PKR ${totalHeadBilled.toLocaleString()}`,
            paid: `PKR ${totalHeadPaid.toLocaleString()}`,
            pending: `PKR ${pending.toLocaleString()}`,
          };
        });
        bytes = await buildTabularFeeReportPdfBytes({
          title,
          academy: letterhead,
          columns: [
            { key: 'sr', label: 'S#', width: 26 },
            { key: 'code', label: 'Code', width: 60 },
            { key: 'name', label: 'Fee Head Description', width: 140 },
            { key: 'default_rate', label: 'Standard Rate', width: 70, align: 'right' },
            { key: 'billed', label: 'Total Billed', width: 68, align: 'right' },
            { key: 'paid', label: 'Total Paid', width: 68, align: 'right' },
            { key: 'pending', label: 'Uncollected', width: 68, align: 'right' },
          ],
          rows,
          filename,
        });
      } else if (reportType === 'concessions') {
        title = 'Approved Fee Concessions & Scholarships';
        filename = `Concessions_List_${new Date().toISOString().split('T')[0]}.pdf`;
        const rows = discounts.map((d, i) => {
          const stud = students.find(s => s.id === d.student_id);
          const progName = stud ? getProgramName(stud.program_id) : '—';
          return {
            sr: String(i + 1),
            roll: stud?.roll_number || '—',
            student: stud?.full_name || 'Student',
            class_name: progName,
            type: d.discount_type.toUpperCase(),
            amount: `${d.discount_value}${d.discount_type === 'percentage' ? '%' : ' PKR'}`,
            reason: (d as any).reason || d.mandatory_reason || 'Concession approved',
          };
        });
        bytes = await buildTabularFeeReportPdfBytes({
          title,
          academy: letterhead,
          summaryStrip: [
            { label: 'Total Concessions', value: `${discounts.length} Students` },
          ],
          columns: [
            { key: 'sr', label: 'S#', width: 26 },
            { key: 'roll', label: 'Roll #', width: 44 },
            { key: 'student', label: 'Student Name', width: 110 },
            { key: 'class_name', label: 'Class', width: 85 },
            { key: 'amount', label: 'Discount Value', width: 75, align: 'right' },
            { key: 'reason', label: 'Approved Reason', width: 160 },
          ],
          rows,
          filename,
        });
      } else if (reportType === 'student_ledger') {
        const stud = students.find(s => s.id === ledgerStudentId);
        title = `Student Fee Ledger: ${stud?.full_name || 'Student'}`;
        filename = `Ledger_${stud?.roll_number || 'student'}.pdf`;
        bytes = await buildSimpleStatementPdf({
          title: 'Student Fee Ledger',
          academy: letterhead,
          identity: [
            { label: 'Student', value: stud?.full_name || '—' },
            { label: 'Roll No', value: stud?.roll_number || '—' },
            { label: 'Class', value: getProgramName(stud?.program_id) || '—' },
            { label: 'Entries', value: String(studentLedger.length) },
          ],
          columns: [
            { key: 'date', label: 'Date', width: 90 },
            { key: 'particulars', label: 'Particulars', width: 220 },
            { key: 'debit', label: 'Debit (PKR)', width: 80, align: 'right' },
            { key: 'credit', label: 'Credit (PKR)', width: 80, align: 'right' },
            { key: 'balance', label: 'Balance (PKR)', width: 80, align: 'right' },
          ],
          rows: studentLedger.map(e => ({
            date: e.date,
            particulars: e.description || e.reference || 'Fee Movement',
            debit: e.debit > 0 ? e.debit.toLocaleString() : '-',
            credit: e.credit > 0 ? e.credit.toLocaleString() : '-',
            balance: e.running_balance.toLocaleString(),
          })),
          footerNote: 'Official computer-generated student running fee ledger.',
        });
      }

      if (bytes) {
        setPdfBytes(bytes);
        setPdfTitle(title);
        setPdfFilename(filename);
        setPdfModalOpen(true);
      }
    } catch (err: any) {
      console.error('Error generating report PDF:', err);
      alert('Failed to generate report PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Day-Close Daily Collections
  const dayCloseEntries = useMemo(() => {
    return dayCloseRecords.filter(c => c.status !== 'voided');
  }, [dayCloseRecords]);

  const dayCloseSummary = useMemo(() => {
    const summary = {
      cash: 0,
      bank_transfer: 0,
      easypaisa: 0,
      jazzcash: 0,
      cheque: 0,
      total: 0,
    };
    for (const c of dayCloseEntries) {
      const amt = Number(c.amount) || 0;
      summary.total += amt;
      const m = (c.payment_method || 'cash').toLowerCase();
      if (m === 'cash') summary.cash += amt;
      else if (m === 'bank_transfer') summary.bank_transfer += amt;
      else if (m === 'easypaisa') summary.easypaisa += amt;
      else if (m === 'jazzcash') summary.jazzcash += amt;
      else if (m === 'cheque') summary.cheque += amt;
      else summary.cash += amt;
    }
    return summary;
  }, [dayCloseEntries]);

  // Open Embedded Cashier Drawer for Invoice
  const handleOpenCashierDrawer = async (inv: StudentInvoice) => {
    setActiveInvoice(inv);
    const amountToPay = inv.balance_amount;
    setCollectionAmount(amountToPay);
    setPaymentMethod('cash');
    setPaymentReference('');
    setPaymentBankName('');
    setPaymentChequeNumber('');
    setPaymentClearingDate('');
    setIsOverrideActive(false);
    setOverrideReason('');

    try {
      const res = await fetch('/api/v1/finance/distribute-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: inv.id, amount: amountToPay })
      });
      const data = await res.json();
      if (data.success) {
        setDistributionItems(data.data || []);
      }
    } catch (err) {
      console.error('Failed to preview distribution:', err);
    }
    setShowCashierDrawer(true);
  };

  // Recalculate auto-distribution when cashier changes collection amount
  const handleAmountChange = async (amt: number | '') => {
    setCollectionAmount(amt);
    if (!activeInvoice || !token) return;
    const numAmt = amt === '' ? 0 : amt;
    try {
      const res = await fetch('/api/v1/finance/distribute-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: activeInvoice.id, amount: numAmt })
      });
      const data = await res.json();
      if (data.success) {
        setDistributionItems(data.data || []);
        setIsOverrideActive(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Cashier manually edits distributed cell
  const handleEditAllocation = (headId: string, val: number) => {
    setIsOverrideActive(true);
    setDistributionItems(prev => prev.map(item => {
      if (item.fee_head_id === headId) {
        return { ...item, allocated_amount: val };
      }
      return item;
    }));
  };

  // Commit Payment from Cashier Drawer
  const handleCommitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice || !token) return;

    const numCollectionAmount = Number(collectionAmount) || 0;
    if (numCollectionAmount <= 0) {
      alert('Please enter a valid payment amount greater than zero.');
      return;
    }

    const totalAllocated = distributionItems.reduce((s, i) => s + Number(i.allocated_amount), 0);
    if (Math.abs(totalAllocated - numCollectionAmount) > 0.05) {
      alert(`Allocated sum (${totalAllocated} PKR) must match collected amount (${numCollectionAmount} PKR)`);
      return;
    }

    if (isOverrideActive && !overrideReason.trim()) {
      alert('Please provide a mandatory reason explaining the manual allocation override.');
      return;
    }

    setIsCommittingPayment(true);
    try {
      const res = await fetch('/api/v1/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          invoice_id: activeInvoice.id,
          amount_paid: numCollectionAmount,
          payment_method: paymentMethod,
          reference_number: paymentReference || undefined,
          bank_name: paymentBankName || undefined,
          cheque_number: paymentChequeNumber || undefined,
          clearing_date: paymentClearingDate || undefined,
          is_override: isOverrideActive,
          override_reason: isOverrideActive ? overrideReason : undefined,
          allocations: distributionItems
        })
      });

      const data = await res.json();
      if (data.success) {
        setActivePaymentReceipt(data.data.payment);
        if (data.data.invoice) {
          setActiveInvoice(data.data.invoice);
        }
        setShowCashierDrawer(false);
        setShowReceiptModal(true);
        showToast(`Payment of PKR ${numCollectionAmount.toLocaleString()} recorded successfully.`);
        fetchData();
        fetchDayCloseData(dayCloseDate);
      } else {
        alert(data.error?.message || 'Payment committal failed');
      }
    } catch (err: any) {
      alert(err.message || 'Payment committal error');
    } finally {
      setIsCommittingPayment(false);
    }
  };

  // Helper to build FeeSlipData from invoice (Due Reminder)
  const buildSlipData = (inv: StudentInvoice): FeeSlipData => {
    const stud = students.find(s => s.id === inv.student_id);
    return {
      slip_type: 'due_reminder',
      invoice_number: inv.invoice_number,
      billing_month: inv.billing_month,
      due_date: inv.due_date,
      issue_date: (inv as any).issue_date || new Date().toISOString().split('T')[0],
      student_name: inv.student_name,
      roll_number: inv.roll_number,
      admission_number: stud?.admission_number || inv.roll_number,
      father_name: stud?.father_name || stud?.guardian_name || 'Guardian',
      guardian_phone: stud?.guardian_phone || stud?.guardian_whatsapp || stud?.phone || '',
      program_name: inv.program_name || getProgramName(inv.program_id || stud?.program_id) || (inv as any).program_name || stud?.program_name || 'Class 7',
      batch_name: inv.batch_name || stud?.batch_name || 'Section A',
      items: (inv.items || []).map(it => ({
        head_name: it.head_name,
        amount: it.net_amount || it.original_amount,
        paid_amount: it.paid_amount,
        balance_due: it.balance_due,
      })),
      gross_amount: (inv as any).gross_amount || inv.net_amount,
      discount_amount: inv.discount_amount || 0,
      paid_amount: inv.paid_amount || 0,
      balance_due: inv.balance_amount,
      status: inv.status,
      notes: inv.notes || undefined,
    };
  };

  // Helper to build FeeSlipData for Official Payment Receipt
  const buildReceiptSlipData = (payment: any, inv?: StudentInvoice | null): FeeSlipData => {
    const studentId = inv?.student_id || payment?.student_id;
    const stud = students.find(s => s.id === studentId || s.roll_number === payment?.roll_number);
    const grossAmt = Number((inv as any)?.gross_amount || inv?.net_amount || (Number(payment.amount_paid || 0) + Number(inv?.balance_amount || 0)));
    const balanceDue = inv != null ? Number(inv.balance_amount) : 0;

    const items = (payment.allocations && payment.allocations.length > 0)
      ? payment.allocations.map((a: any) => ({
          head_name: a.head_name,
          amount: Number(a.allocated_amount),
          allocated_amount: Number(a.allocated_amount),
          paid_amount: Number(a.allocated_amount),
          balance_due: 0
        }))
      : (inv?.items && inv.items.length > 0)
        ? inv.items.map(it => ({
            head_name: it.head_name,
            amount: it.net_amount || it.original_amount,
            allocated_amount: it.paid_amount,
            paid_amount: it.paid_amount,
            balance_due: it.balance_due
          }))
        : [{ head_name: 'Academic Tuition / Fee', amount: Number(payment.amount_paid || 0), allocated_amount: Number(payment.amount_paid || 0), paid_amount: Number(payment.amount_paid || 0), balance_due: 0 }];

    return {
      slip_type: 'payment_receipt',
      receipt_number: payment.receipt_number || 'REC-CONFIRMED',
      invoice_number: inv?.invoice_number || `INV-${payment.invoice_id || 'OFFICIAL'}`,
      billing_month: inv?.billing_month || new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      due_date: inv?.due_date,
      issue_date: (inv as any)?.issue_date || new Date().toISOString().split('T')[0],
      payment_date: payment.payment_date ? payment.payment_date.split('T')[0] : new Date().toISOString().split('T')[0],
      payment_method: payment.payment_method || 'cash',
      reference_number: payment.reference_number || undefined,
      bank_name: payment.bank_name || undefined,
      cheque_number: payment.cheque_number || undefined,
      collected_by: payment.collected_by || 'Accounts Desk',
      student_name: payment.student_name || inv?.student_name || stud?.name || 'Student',
      roll_number: payment.roll_number || inv?.roll_number || stud?.roll_number,
      admission_number: stud?.admission_number || inv?.roll_number || payment.roll_number,
      father_name: stud?.father_name || stud?.guardian_name || 'Guardian',
      guardian_phone: stud?.guardian_phone || stud?.guardian_whatsapp || stud?.phone || '',
      program_name: inv?.program_name || getProgramName(inv?.program_id || stud?.program_id) || (inv as any)?.program_name || stud?.program_name || 'Class 7',
      batch_name: inv?.batch_name || stud?.batch_name || 'Section A',
      items,
      gross_amount: grossAmt,
      discount_amount: inv?.discount_amount || 0,
      paid_amount: Number(payment.amount_paid || 0),
      balance_due: balanceDue,
      status: balanceDue <= 0 ? 'paid' : 'partially_paid',
      notes: inv?.notes || (payment.is_override ? `Cashier override: ${payment.override_reason}` : undefined)
    };
  };

  // Live render A6 payment receipt canvas whenever activePaymentReceipt changes
  useEffect(() => {
    if (!activePaymentReceipt) {
      setReceiptSlipImage(null);
      return;
    }
    let isCancelled = false;
    const renderReceipt = async () => {
      setIsRenderingReceipt(true);
      try {
        const slip = buildReceiptSlipData(activePaymentReceipt, activeInvoice);
        const canvas = await renderFeeSlipCanvas(slip, academyInfo);
        if (!isCancelled) {
          setReceiptSlipImage(canvas.toDataURL('image/png'));
        }
      } catch (err) {
        console.error('Failed to render receipt slip canvas:', err);
      } finally {
        if (!isCancelled) setIsRenderingReceipt(false);
      }
    };
    renderReceipt();
    return () => {
      isCancelled = true;
    };
  }, [activePaymentReceipt, activeInvoice, academyInfo]);

  // 1-Click WhatsApp Picture Fee Slip Dispatch (Dues Reminder)
  const handleDispatchWhatsAppSlip = async (inv: StudentInvoice, customPhone?: string) => {
    const slip = buildSlipData(inv);
    try {
      const result = await dispatchWhatsAppFeeSlipWithPicture(slip, academyInfo, customPhone);
      showToast(
        result.copiedToClipboard
          ? 'Fee Slip image copied to clipboard & downloaded! In the opened WhatsApp chat, simply press Ctrl+V to attach the slip.'
          : 'Fee Slip image downloaded! Attach the downloaded image in WhatsApp.'
      );
    } catch (err: any) {
      alert(`Could not generate picture slip: ${err.message}`);
    }
  };

  // 1-Click WhatsApp Payment Receipt Dispatch
  const handleDispatchWhatsAppReceipt = async (payment: any, inv?: StudentInvoice | null, customPhone?: string) => {
    const slip = buildReceiptSlipData(payment, inv);
    try {
      const result = await dispatchWhatsAppFeeSlipWithPicture(slip, academyInfo, customPhone);
      showToast(
        result.copiedToClipboard
          ? 'Payment Receipt image copied to clipboard & downloaded! In WhatsApp, press Ctrl+V to attach the receipt.'
          : 'Payment Receipt image downloaded! Attach the downloaded receipt image in WhatsApp.'
      );
    } catch (err: any) {
      alert(`Could not generate receipt slip: ${err.message}`);
    }
  };

  // Download Payment Receipt PNG & Copy to Clipboard
  const handleDownloadReceiptPicture = async (payment: any, inv?: StudentInvoice | null) => {
    const slip = buildReceiptSlipData(payment, inv);
    try {
      const res = await copyAndDownloadFeeSlip(slip, academyInfo);
      showToast(
        res.copiedToClipboard
          ? 'Payment receipt image copied to clipboard & downloaded!'
          : 'Payment receipt image downloaded to your computer.'
      );
    } catch (err: any) {
      alert(`Could not download receipt image: ${err.message}`);
    }
  };

  // Preview Fee Slip Picture in Modal (Dues Reminder)
  const handlePreviewSlipPicture = async (inv: StudentInvoice) => {
    const slip = buildSlipData(inv);
    const stud = students.find(s => s.id === inv.student_id);
    try {
      const canvas = await renderFeeSlipCanvas(slip, academyInfo);
      const dataUrl = canvas.toDataURL('image/png');
      setPreviewSlipImage({ dataUrl, invoice: inv, student: stud });
      setShowPictureSlipModal(true);
    } catch (err: any) {
      alert(`Could not render slip preview: ${err.message}`);
    }
  };

  // View Payment Receipt from Invoice row (queries genuine payment records)
  const handleViewReceiptFromInvoice = async (inv: StudentInvoice) => {
    setActiveInvoice(inv);
    try {
      if (token) {
        const res = await fetch(`/api/v1/finance/payments?invoice_id=${inv.id}`, {
          headers: { authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const validPayments = data.data.filter((p: any) => p.status !== 'void');
          const targetPayment = validPayments[validPayments.length - 1] || data.data[0];
          setActivePaymentReceipt(targetPayment);
          setShowReceiptModal(true);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch genuine payment receipt', err);
    }

    const cashbookPayment = cashbook.find(c => ((c as any).invoice_id === inv.id || c.roll_number === inv.roll_number) && c.amount > 0);
    const payment = {
      id: cashbookPayment?.id || `pmt-${inv.id}`,
      receipt_number: cashbookPayment?.receipt_number || `REC-${new Date().getFullYear()}-${inv.invoice_number.replace(/\D/g, '').slice(-5).padStart(5, '0')}`,
      invoice_id: inv.id,
      student_id: inv.student_id,
      student_name: inv.student_name,
      roll_number: inv.roll_number,
      payment_date: cashbookPayment?.date || new Date().toISOString().split('T')[0],
      amount_paid: inv.paid_amount,
      payment_method: cashbookPayment?.payment_method || 'cash',
      collected_by: cashbookPayment?.collected_by || 'Accounts Desk',
      allocations: inv.items.map(it => ({
        head_name: it.head_name,
        allocated_amount: it.paid_amount || 0
      }))
    };
    setActivePaymentReceipt(payment);
    setShowReceiptModal(true);
  };

  // Single Invoice Creation
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newInvStudentId) return;

    try {
      const res = await fetch('/api/v1/finance/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          student_id: newInvStudentId,
          billing_month: newInvMonth,
          due_date: newInvDueDate,
          notes: newInvNotes,
          custom_items: newInvCustomItems.length > 0 ? newInvCustomItems : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowGenerateModal(false);
        setNewInvStudentId('');
        setNewInvNotes('');
        setNewInvCustomItems([]);
        showToast('Student invoice generated with previous arrears calculated.');
        fetchData();
      } else {
        alert(data.error?.message || 'Invoice generation failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Batch Invoice Generation
  const handleBatchInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !batchInvBatchId) return;

    try {
      const res = await fetch('/api/v1/finance/invoices/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          batch_id: batchInvBatchId,
          billing_month: batchInvMonth,
          due_date: batchInvDueDate
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowBatchInvoiceModal(false);
        showToast(`Successfully issued batch invoices for ${data.data?.invoices_created ?? 'all'} students.`);
        fetchData();
      } else {
        alert(data.error?.message || 'Batch invoicing failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Bulk Fee Revision Execution
  const affectedStudents = useMemo(() => {
    return students.filter(s => {
      if (s.status !== 'active') return false;
      if (bulkRevScope === 'program' && bulkRevProgramId && s.program_id !== bulkRevProgramId) return false;
      if (bulkRevScope === 'batch' && bulkRevBatchId && s.batch_id !== bulkRevBatchId) return false;
      return true;
    });
  }, [students, bulkRevScope, bulkRevProgramId, bulkRevBatchId]);

  const handleExecuteBulkRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || affectedStudents.length === 0) return;

    setIsSubmittingBulkRev(true);
    try {
      const res = await fetch('/api/v1/finance/fees/bulk-increment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope: bulkRevScope,
          program_id: bulkRevScope === 'program' ? bulkRevProgramId : undefined,
          batch_id: bulkRevScope === 'batch' ? bulkRevBatchId : undefined,
          increment_type: bulkRevType,
          increment_value: bulkRevValue,
          rounding: bulkRevRounding,
          reason: bulkRevReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to execute bulk fee revision');

      setShowBulkRevisionModal(false);
      showToast(`Successfully revised tuition fees for ${data.data?.count || affectedStudents.length} students.`);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingBulkRev(false);
    }
  };

  // Fee Structure Modal Handlers
  const handleOpenNewStructure = () => {
    setEditingStructure(null);
    setStructureBatchId(batches.length > 0 ? batches[0].id : '');
    setStructureSession('2026-2027');
    setStructureItems(feeHeads.map(h => ({
      fee_head_id: h.id,
      amount: h.default_amount || 0
    })));
    setShowStructureModal(true);
  };

  const handleOpenEditStructure = (str: StudentFeeStructure) => {
    setEditingStructure(str);
    setStructureBatchId(str.batch_id || '');
    setStructureSession(str.academic_session || '2026-2027');
    setStructureItems(str.items.map(it => ({
      fee_head_id: it.fee_head_id,
      amount: it.amount
    })));
    setShowStructureModal(true);
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !structureBatchId) return;

    setIsSavingStructure(true);
    try {
      const formattedItems = structureItems
        .filter(it => it.amount > 0)
        .map(it => {
          const h = feeHeads.find(fh => fh.id === it.fee_head_id);
          return {
            fee_head_id: it.fee_head_id,
            head_name: h?.name || 'Fee Head',
            amount: Number(it.amount)
          };
        });

      const res = await fetch('/api/v1/finance/structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          batch_id: structureBatchId,
          academic_session: structureSession,
          items: formattedItems
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowStructureModal(false);
        showToast('Batch fee structure saved successfully.');
        fetchData();
      } else {
        alert(data.error?.message || 'Failed to save fee structure');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingStructure(false);
    }
  };

  // Fee Head Form Handlers
  const handleOpenNewHead = () => {
    setEditingHead(null);
    setHeadForm({
      name: '',
      code: '',
      default_amount: '',
      priority_order: feeHeads.length + 1,
      show_at_admission: true,
    });
    setShowHeadModal(true);
  };

  const handleOpenEditHead = (head: FeeHead) => {
    setEditingHead(head);
    setHeadForm({
      name: head.name,
      code: head.code,
      default_amount: head.default_amount,
      priority_order: head.priority_order,
      show_at_admission: head.show_at_admission ?? true,
    });
    setShowHeadModal(true);
  };

  const handleSaveHead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSavingHead(true);

    try {
      if (editingHead) {
        const res = await fetch(`/api/v1/finance/heads/${editingHead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: headForm.name.trim(),
            code: headForm.code.toUpperCase().trim(),
            default_amount: headForm.default_amount === '' ? 0 : Number(headForm.default_amount),
            priority_order: headForm.priority_order === '' ? 1 : Number(headForm.priority_order),
            show_at_admission: headForm.show_at_admission,
          })
        });
        const data = await res.json();
        if (data.success) {
          setShowHeadModal(false);
          showToast('Fee head updated successfully.');
          fetchData();
        } else {
          alert(data.error?.message || 'Failed to update fee head');
        }
      } else {
        const res = await fetch('/api/v1/finance/heads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: headForm.name.trim(),
            code: headForm.code.toUpperCase().trim(),
            default_amount: headForm.default_amount === '' ? 0 : Number(headForm.default_amount),
            priority_order: headForm.priority_order === '' ? feeHeads.length + 1 : Number(headForm.priority_order),
            show_at_admission: headForm.show_at_admission,
            is_system_default: false
          })
        });
        const data = await res.json();
        if (data.success) {
          setShowHeadModal(false);
          showToast('New fee head created.');
          fetchData();
        } else {
          alert(data.error?.message || 'Failed to create fee head');
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingHead(false);
    }
  };

  // Void Receipt Handler
  const handleConfirmVoid = async () => {
    if (!voidPaymentModal || !token) return;
    if (!voidReasonText.trim()) {
      alert('Mandatory void reason is required.');
      return;
    }

    setVoidSubmitting(true);
    try {
      const res = await fetch(`/api/v1/finance/payments/${voidPaymentModal.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: voidReasonText, void_reason: voidReasonText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Void payment failed');

      setVoidPaymentModal(null);
      setVoidReasonText('');
      showToast('Payment receipt voided and invoice balance restored.');
      fetchData();
      fetchDayCloseData(dayCloseDate);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setVoidSubmitting(false);
    }
  };

  // Payment Allocation Priority Movement
  const handleMovePriority = async (idx: number, direction: 'up' | 'down') => {
    if (!token) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= feeHeads.length) return;

    const newHeads = [...feeHeads];
    const temp = newHeads[idx];
    newHeads[idx] = newHeads[targetIdx];
    newHeads[targetIdx] = temp;
    setFeeHeads(newHeads);

    try {
      const res = await fetch('/api/v1/finance/priority-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priority_order: newHeads.map(h => h.id) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to update priority order');
      showToast('Payment allocation order updated.');
    } catch (err: any) {
      alert(err.message);
      fetchData();
    }
  };

  // Fee Head Deletion
  const handleDeleteFeeHead = async (headId: string) => {
    if (!token) return;
    const head = feeHeads.find(h => h.id === headId);
    if (!head) return;
    if (head.code === 'TUITION' || head.is_system_default) {
      alert('Tuition fee and system default heads cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to delete fee head "${head.name}"?`)) return;

    try {
      const res = await fetch(`/api/v1/finance/heads/${headId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to delete fee head');
      showToast('Fee head deleted.');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Discount / Concession Creation
  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !discountStudentId || !discountInvoiceId) return;

    const numVal = Number(discountValue) || 0;
    if (numVal <= 0) {
      alert('Enter a valid concession amount or percentage');
      return;
    }

    if (!discountReason.trim()) {
      alert('A mandatory justification remark is required for fee concessions.');
      return;
    }

    try {
      const res = await fetch('/api/v1/finance/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          student_id: discountStudentId,
          invoice_id: discountInvoiceId,
          discount_type: discountType,
          discount_value: numVal,
          mandatory_reason: discountReason
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowDiscountModal(false);
        setDiscountStudentId('');
        setDiscountInvoiceId('');
        setDiscountValue('');
        setDiscountReason('');
        showToast('Approved concession granted and invoice updated.');
        fetchData();
      } else {
        alert(data.error?.message || 'Discount grant failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedbackNotice && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border text-xs font-semibold max-w-md animate-in slide-in-from-top-2 ${
            feedbackNotice.type === 'success'
              ? 'bg-slate-900 text-white border-slate-700'
              : feedbackNotice.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-indigo-900 text-white border-indigo-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1 leading-relaxed">{feedbackNotice.message}</span>
          <button onClick={() => setFeedbackNotice(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <PageHeading
        title="Fee Ledger & Invoicing"
        description="Issue monthly fee vouchers, manage batch fee schedules, record desk payments, and dispatch picture fee slips."
        icon={<Receipt className="w-4 h-4 text-slate-700" />}
      >
        <button
          onClick={() => setShowBulkRevisionModal(true)}
          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5"
          title="Adjust tuition fees globally or by class/section"
        >
          <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
          Bulk Fee Revision
        </button>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New Invoice
        </button>
      </PageHeading>

      {/* Main Tab Navigation */}
      {/* Mobile Tab Selector (Eliminates horizontal scrolling hurdle) */}
      <div className="sm:hidden w-full">
        <select
          value={activeTab}
          onChange={e => setActiveTab(e.target.value as any)}
          className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-slate-900"
        >
          <option value="cashier">🔍 Fee Collection</option>
          <option value="invoices">🧾 Invoices & Challans</option>
          <option value="defaulters">⚠️ Fee Defaulters {totalDefaultersCount > 0 ? `(${totalDefaultersCount})` : ''}</option>
          <option value="reports">📊 Reports & Analytics</option>
          <option value="structures">🏫 Fee Structures</option>
          <option value="discounts">🏷️ Concessions</option>
          <option value="fee_heads">💵 Fee Heads & Priority</option>
        </select>
      </div>

      {/* Desktop/Tablet Tab Bar */}
      <div className="hidden sm:flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 text-xs font-semibold overflow-x-auto no-scrollbar whitespace-nowrap">
        <button
          onClick={() => setActiveTab('cashier')}
          className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'cashier' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <span>Fee Collection</span>
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'invoices' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-slate-500" />
          <span>Invoices & Challans</span>
        </button>
        <button
          onClick={() => setActiveTab('defaulters')}
          className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'defaulters' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Fee Defaulters</span>
          {totalDefaultersCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold font-mono">
              {totalDefaultersCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'reports' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Reports</span>
        </button>
        <button
          onClick={() => setActiveTab('structures')}
          className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'structures' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Fee Structures</span>
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'discounts' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Percent className="w-3.5 h-3.5 text-slate-500" />
          <span>Concessions</span>
        </button>
        <button
          onClick={() => setActiveTab('fee_heads')}
          className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'fee_heads' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-slate-500" />
          <span>Fee Heads & Priority</span>
        </button>
      </div>

      {/* TAB: FEE COLLECTION COUNTER (Hero Student Search & Family Desk) */}
      {activeTab === 'cashier' && (
        <div className="space-y-4">
          {/* Hero Search & Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by student name, roll #, admission #, father/guardian, phone, or CNIC..."
                  value={cashierSearch}
                  onChange={e => setCashierSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-900 transition-colors"
                  autoFocus
                />
                {cashierSearch && (
                  <button
                    onClick={() => setCashierSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <select
                value={cashierClassFilter}
                onChange={e => setCashierClassFilter(e.target.value)}
                className="px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-700 font-medium min-w-[200px]"
              >
                <option value="all">All Classes ({programs.length})</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1 border-t border-slate-100">
              <span>
                Showing {cashierFilteredStudents.length} student{cashierFilteredStudents.length !== 1 ? 's' : ''}
                {cashierSearch ? ` matching "${cashierSearch}"` : ' (Type to search)'}
              </span>
              <span className="text-[11px] text-slate-400">
                Click <strong>Receive Fee</strong> for instant collection or <strong>Family</strong> to settle all siblings together.
              </span>
            </div>
          </div>

          {/* Student Roster / Search Results */}
          <div className="space-y-2.5">
            {!cashierSearch.trim() ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Search Student to Collect Fees</p>
                <p className="text-xs text-slate-400 mt-1">Enter student name, roll number, admission number, father/guardian name, phone, or CNIC in the search bar above.</p>
              </div>
            ) : cashierFilteredStudents.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">No students found matching "{cashierSearch}".</p>
                <p className="text-xs text-slate-400 mt-1">Check spelling or try searching with roll number, mobile number, or CNIC.</p>
              </div>
            ) : (
              cashierFilteredStudents.map(student => {
                const studInvoices = invoices.filter(i => i.student_id === student.id);
                const unpaidInvoices = studInvoices.filter(i => i.status !== 'paid' && i.balance_amount > 0);
                const totalDue = unpaidInvoices.reduce((sum, inv) => sum + inv.balance_amount, 0);
                const siblings = getStudentSiblings(student);
                const batch = batches.find(b => b.id === student.batch_id);
                const progName = getProgramName(student.program_id) || (batch?.program_id ? getProgramName(batch.program_id) : '') || 'Class';

                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedCashierStudentId(student.id === selectedCashierStudentId ? null : student.id)}
                    className={`bg-white border rounded-2xl p-4 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer ${
                      selectedCashierStudentId === student.id
                        ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/20'
                        : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {/* Student Info */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0 uppercase">
                        {student.full_name?.charAt(0) || 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm">{student.full_name}</h4>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-mono font-semibold">
                            Roll #{student.roll_number || '—'}
                          </span>
                          {student.admission_number && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono">
                              Adm #{student.admission_number}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          <span className="font-semibold text-slate-800">{progName}</span>
                          {batch?.name ? ` • Section ${batch.name}` : ''}
                          <span className="text-slate-300 mx-1.5">•</span>
                          <span>Father: <strong className="text-slate-700">{student.father_name || student.guardian_name || '—'}</strong></span>
                          {student.guardian_phone || student.phone ? (
                            <span className="text-slate-500 font-mono ml-1.5">({student.guardian_phone || student.phone})</span>
                          ) : null}
                          {student.guardian_id_card ? (
                            <span className="text-slate-400 font-mono ml-1.5">• CNIC: {student.guardian_id_card}</span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    {/* Dues Status & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-right">
                        {totalDue > 0 ? (
                          <div>
                            <span className="text-xs font-mono font-bold text-rose-600 block">
                              PKR {totalDue.toLocaleString()} Due
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {unpaidInvoices.length} Challan{unpaidInvoices.length > 1 ? 's' : ''} Pending
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-xs font-mono font-bold text-emerald-600 block">
                              No Dues / Paid
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              All cleared
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Receive Fee Button */}
                        <button
                          onClick={() => {
                            if (unpaidInvoices.length > 0) {
                              handleOpenCashierDrawer(unpaidInvoices[0]);
                            } else {
                              setNewInvStudentId(student.id);
                              setShowGenerateModal(true);
                            }
                          }}
                          className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors ${
                            totalDue > 0
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{totalDue > 0 ? 'Receive Fee' : 'New Invoice'}</span>
                        </button>

                        {/* Family Button (Shown when siblings exist) */}
                        {siblings.length > 0 && (
                          <button
                            onClick={() => handleOpenFamilyModal(student)}
                            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                            title={`View & settle fees for all ${siblings.length + 1} enrolled family members`}
                          >
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Family ({siblings.length + 1})</span>
                          </button>
                        )}

                        {/* View Invoices Link */}
                        <button
                          onClick={() => {
                            setSearchQuery(student.roll_number || student.full_name);
                            setActiveTab('invoices');
                          }}
                          className="px-2.5 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-medium rounded-xl transition-colors"
                          title="View student invoices"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 1: INVOICES & CHALLANS (Operational Ledger with Embedded Cashier Drawer) */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student, roll number, or challan #..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-700"
              >
                <option value="all">All Payment Statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
              </select>

              <select
                value={selectedProgram}
                onChange={e => {
                  const progId = e.target.value;
                  setSelectedProgram(progId);
                  if (progId !== 'all') {
                    const batchBelongs = batches.some(b => b.id === selectedBatch && b.program_id === progId);
                    if (!batchBelongs) setSelectedBatch('all');
                  }
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-700 font-medium"
              >
                <option value="all">All Classes / Programs ({programs.length})</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <select
                value={selectedBatch}
                onChange={e => setSelectedBatch(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-700 font-medium"
              >
                <option value="all">All Sections / Batches ({availableBatchesForFilter.length})</option>
                {availableBatchesForFilter.map(b => (
                  <option key={b.id} value={b.id}>
                    {selectedProgram === 'all' && getProgramName(b.program_id) ? `${getProgramName(b.program_id)} • ` : ''}{b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3.5">Challan #</th>
                    <th className="py-2.5 px-3.5">Student • Class & Section</th>
                    <th className="py-2.5 px-3.5">Billing Month</th>
                    <th className="py-2.5 px-3.5">Itemized Heads</th>
                    <th className="py-2.5 px-3.5 text-right">Net Billed</th>
                    <th className="py-2.5 px-3.5 text-right">Paid / Balance</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                    <th className="py-2.5 px-3.5 text-right">Operational Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">Loading fee records...</td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">No fee vouchers match your query.</td>
                    </tr>
                  ) : (
                    filteredInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-semibold text-indigo-900">{inv.invoice_number}</td>
                        <td className="py-3 px-3.5">
                          <p className="font-bold text-slate-900">{inv.student_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Roll: {inv.roll_number} • <span className="font-semibold text-slate-800">{inv.program_name || getProgramName(inv.program_id || students.find(s => s.id === inv.student_id)?.program_id) || 'Class'}</span> ({inv.batch_name})
                          </p>
                        </td>
                        <td className="py-3 px-3.5">
                          <p className="font-medium text-slate-800">{inv.billing_month}</p>
                          <p className="text-[10px] text-slate-400">Due: {inv.due_date}</p>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {inv.items.map(it => (
                              <span key={it.id} className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 font-mono">
                                {it.head_code || it.head_name}: {it.net_amount}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-slate-900 font-mono">
                          {inv.net_amount.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">PKR</span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono">
                          <p className="text-emerald-600 font-semibold">{inv.paid_amount.toLocaleString()}</p>
                          <p className={`font-bold ${inv.balance_amount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {inv.balance_amount.toLocaleString()}
                          </p>
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                            inv.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.status === 'partially_paid'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {inv.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {inv.status !== 'paid' && (
                              <button
                                onClick={() => handleOpenCashierDrawer(inv)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded transition-colors flex items-center gap-1 shadow-2xs"
                                title="Open Cashier Drawer to collect fee"
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>Receive</span>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setActiveInvoice(inv);
                                setShowPrintModal(true);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] rounded transition-colors flex items-center gap-1"
                              title="Print 3-Part Bank Challan"
                            >
                              <Printer className="w-3 h-3 text-slate-500" />
                              <span className="hidden lg:inline">Challan</span>
                            </button>
                            {inv.balance_amount > 0 && (
                              <button
                                onClick={() => handleDispatchWhatsAppSlip(inv)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] rounded transition-colors border border-emerald-200 flex items-center gap-1"
                                title="Generate picture slip & open WhatsApp with prefilled message"
                              >
                                <MessageSquare className="w-3 h-3 text-emerald-600" />
                                <span>WhatsApp</span>
                              </button>
                            )}
                            {inv.paid_amount > 0 && (
                              <button
                                onClick={() => handleViewReceiptFromInvoice(inv)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] rounded transition-colors border border-emerald-200 flex items-center gap-1"
                                title="View, Print & WhatsApp Official Payment Receipt"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span className="hidden lg:inline">Receipt</span>
                              </button>
                            )}
                            <button
                              onClick={() => handlePreviewSlipPicture(inv)}
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                              title="Preview Official Fee Slip Picture"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100 bg-white">
              {loading ? (
                <div className="py-8 text-center text-slate-400">Loading invoices...</div>
              ) : filteredInvoices.length === 0 ? (
                <div className="py-8 text-center text-slate-400">No invoices found.</div>
              ) : (
                filteredInvoices.map(inv => (
                  <div key={inv.id} className="p-3.5 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900">{inv.invoice_number}</span>
                        <h4 className="font-bold text-slate-900 text-sm mt-0.5">{inv.student_name}</h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                          Roll: {inv.roll_number} • <span className="font-semibold text-slate-800">{inv.program_name || getProgramName(inv.program_id || students.find(s => s.id === inv.student_id)?.program_id) || 'Class'}</span> ({inv.batch_name})
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                        inv.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : inv.status === 'partially_paid'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {inv.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg text-center font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Billed</span>
                        <span className="text-xs font-bold text-slate-800">{inv.net_amount.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Paid</span>
                        <span className="text-xs font-bold text-emerald-600">{inv.paid_amount.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Balance</span>
                        <span className="text-xs font-bold text-rose-600">{inv.balance_amount.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400 font-mono">Due: {inv.due_date}</span>
                      <div className="flex items-center gap-1.5">
                        {inv.status !== 'paid' && (
                          <button
                            onClick={() => handleOpenCashierDrawer(inv)}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold"
                          >
                            Receive
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setActiveInvoice(inv);
                            setShowPrintModal(true);
                          }}
                          className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs"
                        >
                          Challan
                        </button>
                        {inv.paid_amount > 0 && (
                          <button
                            onClick={() => handleViewReceiptFromInvoice(inv)}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Receipt</span>
                          </button>
                        )}
                        {inv.balance_amount > 0 && (
                          <button
                            onClick={() => handleDispatchWhatsAppSlip(inv)}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>WA</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEFAULTERS LIST (Simple & Direct - No Aging Buckets) */}
      {activeTab === 'defaulters' && (
        <div className="space-y-4">
          {/* Summary Strip */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Fee Defaulters List
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Students with unpaid fee challans past the due date.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Defaulters</span>
                <span className="text-base font-bold font-mono text-slate-900">{defaultersList.length} Students</span>
              </div>
              <div className="text-right border-l border-slate-200 pl-3">
                <span className="text-[10px] font-mono text-rose-600 uppercase block font-semibold">Total Overdue</span>
                <span className="text-base font-bold font-mono text-rose-600">PKR {totalDefaultersAmount.toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('defaulters')}
                disabled={isGeneratingPdf}
                className="ml-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Rendering PDF...' : 'Open Defaulters PDF'}</span>
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search defaulter by name, roll #, or phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={selectedBatch}
              onChange={e => setSelectedBatch(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-700 font-medium w-full sm:w-auto"
            >
              <option value="all">All Sections / Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {getProgramName(b.program_id) ? `${getProgramName(b.program_id)} • ` : ''}{b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Defaulters Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3.5">S#</th>
                    <th className="py-2.5 px-3.5">Roll #</th>
                    <th className="py-2.5 px-3.5">Student Name</th>
                    <th className="py-2.5 px-3.5">Class & Section</th>
                    <th className="py-2.5 px-3.5">Father / Guardian</th>
                    <th className="py-2.5 px-3.5">Phone</th>
                    <th className="py-2.5 px-3.5">Unpaid Challans</th>
                    <th className="py-2.5 px-3.5 text-right">Unpaid Dues (PKR)</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {defaultersList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No students with overdue fee dues found.
                      </td>
                    </tr>
                  ) : (
                    defaultersList.map((def, idx) => {
                      const stud = students.find(s => s.id === def.student_id);
                      const siblings = stud ? getStudentSiblings(stud) : [];

                      return (
                        <React.Fragment key={def.student_id}>
                          <tr className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3.5 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-3.5 font-mono font-bold text-slate-900">{def.roll_number}</td>
                            <td className="py-3 px-3.5 font-bold text-slate-900">{def.student_name}</td>
                            <td className="py-3 px-3.5">
                              <span className="font-semibold text-slate-900 block">{def.program_name}</span>
                              <span className="text-[11px] text-slate-500 font-mono">{def.batch_name}</span>
                            </td>
                            <td className="py-3 px-3.5 text-slate-700">{def.father_name}</td>
                            <td className="py-3 px-3.5 font-mono text-slate-600">{def.guardian_phone || '—'}</td>
                            <td className="py-3 px-3.5 font-mono">
                              <p className="text-slate-900 font-semibold">
                                {def.overdue_invoices_count} Challan{def.overdue_invoices_count > 1 ? 's' : ''}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate max-w-[170px]">
                                {def.unpaid_months.join(', ')}
                              </p>
                              {def.invoices.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedDefaulterId(expandedDefaulterId === def.student_id ? null : def.student_id)}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-sans font-medium flex items-center gap-0.5 mt-0.5"
                                >
                                  <span>{expandedDefaulterId === def.student_id ? 'Hide breakdown' : 'Show breakdown'}</span>
                                  {expandedDefaulterId === def.student_id ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-rose-600 text-sm">
                              {def.total_balance.toLocaleString()}
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {siblings.length > 0 && stud && (
                                  <button
                                    onClick={() => handleOpenFamilyModal(stud)}
                                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold rounded border border-indigo-200 transition-colors flex items-center gap-1"
                                    title={`Settle all ${siblings.length + 1} family members`}
                                  >
                                    <Users className="w-3 h-3 text-indigo-600" />
                                    <span>Family</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDispatchWhatsAppSlip(def.latest_invoice, def.guardian_phone)}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px] rounded border border-emerald-300 transition-colors inline-flex items-center gap-1"
                                  title="Send Fee Slip via WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3 text-emerald-600" />
                                  <span>Slip</span>
                                </button>
                                <button
                                  onClick={() => handleOpenCashierDrawer(def.latest_invoice)}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] rounded transition-colors inline-flex items-center gap-1"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  <span>Receive</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedDefaulterId === def.student_id && def.invoices.length > 1 && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={9} className="py-2.5 px-6 border-b border-slate-200">
                                <div className="space-y-1.5">
                                  <p className="text-[11px] font-bold text-slate-700 uppercase font-mono tracking-wider">
                                    Unpaid Challans Breakdown for {def.student_name}:
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {def.invoices.map(inv => (
                                      <div key={inv.id} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-1 text-xs">
                                        <div className="flex justify-between items-center font-mono">
                                          <span className="font-bold text-slate-900">{inv.invoice_number}</span>
                                          <span className="text-rose-600 font-bold">{inv.balance_amount.toLocaleString()} PKR</span>
                                        </div>
                                        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                                          <span>Month: {inv.billing_month}</span>
                                          <span>Due: {inv.due_date} ({inv.overdue_days}d overdue)</span>
                                        </div>
                                        <div className="flex justify-end gap-1.5 pt-1">
                                          <button
                                            onClick={() => handleOpenCashierDrawer(inv)}
                                            className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-semibold"
                                          >
                                            Receive
                                          </button>
                                          <button
                                            onClick={() => handleDispatchWhatsAppSlip(inv, def.guardian_phone)}
                                            className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded text-[10px] font-semibold"
                                          >
                                            Slip
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BATCH FEE STRUCTURES */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Academic Fee Structures (Class & Batch Schedules)</h3>
              <p className="text-xs text-slate-500">
                Default tuition and itemized heads mapped to academic cohorts for automatic voucher generation.
              </p>
            </div>
            <button
              onClick={handleOpenNewStructure}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Configure Batch Fee
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map(batch => {
              const struct = feeStructures.find(s => s.batch_id === batch.id);
              const items = struct?.items || [];
              const totalMonth = items.reduce((s, it) => s + Number(it.amount), 0);

              return (
                <div key={batch.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {getProgramName(batch.program_id) || 'Academic Class'}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{batch.name}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">Session: {batch.academic_session || '2026-2027'}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {batch.shift ? `${batch.shift.toUpperCase()}` : 'REGULAR'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    {items.length === 0 ? (
                      <p className="text-slate-400 text-xs py-2">No custom fee structure configured yet. (Default rates apply)</p>
                    ) : (
                      items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-[11px] py-0.5">
                          <span className="text-slate-600">{it.head_name}</span>
                          <span className="font-mono font-semibold text-slate-800">PKR {Number(it.amount).toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">Baseline Monthly</span>
                      <span className="font-mono font-bold text-sm text-slate-900">PKR {totalMonth.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (struct) handleOpenEditStructure(struct);
                        else {
                          setEditingStructure(null);
                          setStructureBatchId(batch.id);
                          setStructureSession(batch.academic_session || '2026-2027');
                          setStructureItems(feeHeads.map(h => ({ fee_head_id: h.id, amount: h.default_amount || 0 })));
                          setShowStructureModal(true);
                        }
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{struct ? 'Edit' : 'Configure'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: CONCESSIONS & DISCOUNTS */}
      {activeTab === 'discounts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Approved Student Concessions & Scholarships</h3>
              <p className="text-xs text-slate-500">
                Authorized adjustments with mandatory audit rationales and approved waivers.
              </p>
            </div>
            <button
              onClick={() => setShowDiscountModal(true)}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Grant Concession
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3.5">Date</th>
                    <th className="py-2.5 px-3.5">Student</th>
                    <th className="py-2.5 px-3.5">Type & Value</th>
                    <th className="py-2.5 px-3.5 text-right">Granted Amount</th>
                    <th className="py-2.5 px-3.5">Mandatory Approval Remark</th>
                    <th className="py-2.5 px-3.5">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {discounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">No concessions recorded.</td>
                    </tr>
                  ) : (
                    discounts.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3.5 font-mono text-slate-500">{d.applied_at.split('T')[0]}</td>
                        <td className="py-2.5 px-3.5 font-medium text-slate-900">{d.student_name}</td>
                        <td className="py-2.5 px-3.5 font-mono uppercase text-[11px]">
                          {d.discount_type === 'percentage' ? `${d.discount_value}%` : `PKR ${d.discount_value}`}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-600">
                          -{d.actual_discount_amount.toLocaleString()} PKR
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 italic text-[11px]">{d.mandatory_reason}</td>
                        <td className="py-2.5 px-3.5 text-slate-500 text-[11px] font-mono">{d.approved_by}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: FEE HEADS & PAYMENT ALLOCATION PRIORITY */}
      {activeTab === 'fee_heads' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Fee Heads & Payment Allocation Order</h3>
              <p className="text-xs text-slate-500">
                Itemized institutional fee heads and distribution priority order when partial fee payments are received.
              </p>
            </div>
            <button
              onClick={handleOpenNewHead}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New Fee Head
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3.5 text-center">Priority</th>
                    <th className="py-2.5 px-3.5">Head Name</th>
                    <th className="py-2.5 px-3.5">Code</th>
                    <th className="py-2.5 px-3.5 text-right">Default Amount</th>
                    <th className="py-2.5 px-3.5 text-center">At Admission</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {feeHeads.map((head, idx) => (
                    <tr key={head.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3.5 text-center font-mono font-bold text-indigo-700">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">{head.name}</td>
                      <td className="py-2.5 px-3.5 font-mono text-slate-500">{head.code}</td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-800">
                        {head.default_amount ? `${head.default_amount.toLocaleString()} PKR` : 'Dynamic'}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          head.show_at_admission ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {head.show_at_admission ? 'Included' : 'Excluded'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMovePriority(idx, 'up')}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded disabled:opacity-25 transition-colors"
                            title="Move Up in allocation priority"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === feeHeads.length - 1}
                            onClick={() => handleMovePriority(idx, 'down')}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded disabled:opacity-25 transition-colors"
                            title="Move Down in allocation priority"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditHead(head)}
                            className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Edit Head"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!head.is_system_default && head.code !== 'TUITION' && (
                            <button
                              onClick={() => handleDeleteFeeHead(head.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Delete Head"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: REPORTS HUB (Sleek Slip Rectangle Cards with Direct In-Portal PDF Viewer) */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-600" />
                <span>Financial & Recovery Reports</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any report slip below to open the vector A4 PDF directly inside the portal for preview, print, or download.
              </p>
            </div>
            {isGeneratingPdf && (
              <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1.5 self-start sm:self-auto bg-indigo-50 px-3 py-1.5 rounded-xl">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Rendering PDF document...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* 1. Fee Defaulters Register */}
            <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Fee Defaulters Register</h4>
                      <span className="text-[10px] text-rose-600 font-mono font-semibold">Overdue Accounts</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    {defaultersList.length} Students
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Overdue fee list displaying student roll #, class, father contact, unpaid months, and total outstanding dues.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('defaulters')}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Defaulters PDF</span>
              </button>
            </div>

            {/* 2. Family & Sibling Record */}
            <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Family & Sibling Record</h4>
                      <span className="text-[10px] text-indigo-600 font-mono font-semibold">Household Ledger</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Families
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Household fee record grouping enrolled siblings under guardian CNIC and phone with combined unpaid dues.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('family')}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Family PDF</span>
              </button>
            </div>

            {/* 3. Class-wise Summary */}
            <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Class-wise Fee Report</h4>
                      <span className="text-[10px] text-slate-500 font-mono font-semibold">Grade Breakdown</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {programs.length} Classes
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Class and batch comparison showing students enrolled, total billed, amount collected, pending, and recovery rate %.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('class_wise')}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Class-wise PDF</span>
              </button>
            </div>

            {/* 4. Date Range Cashbook */}
            <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Collection Register (Cashbook)</h4>
                      <span className="text-[10px] text-emerald-600 font-mono font-semibold">Date Range Ledger</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">From Date</label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={e => setReportStartDate(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block">To Date</label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={e => setReportEndDate(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-mono"
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('date_range')}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Cashbook PDF</span>
              </button>
            </div>

            {/* 5. Month-wise Billing */}
            <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Monthly Billing Summary</h4>
                      <span className="text-[10px] text-blue-600 font-mono font-semibold">Monthly Audit</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Billing Month</label>
                  <input
                    type="text"
                    value={reportMonth}
                    onChange={e => setReportMonth(e.target.value)}
                    placeholder="e.g. October 2026"
                    className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-medium"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('month_wise')}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Monthly PDF</span>
              </button>
            </div>

            {/* 6. Daily Cashier Closing */}
            <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Daily Cashier Closing Sheet</h4>
                      <span className="text-[10px] text-amber-600 font-mono font-semibold">Day-Close Slip</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs"
                    title="Previous Day"
                  >
                    &lt;
                  </button>
                  <input
                    type="date"
                    value={dayCloseDate}
                    onChange={e => setDayCloseDate(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleNextDay}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs"
                    title="Next Day"
                  >
                    &gt;
                  </button>
                  <button
                    type="button"
                    onClick={handleToday}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                    title="Today"
                  >
                    Today
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('daily_closing')}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Daily Close PDF</span>
              </button>
            </div>

            {/* 7. Fee Head Revenue Summary */}
            <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Fee Head Revenue Summary</h4>
                      <span className="text-[10px] text-purple-600 font-mono font-semibold">Account Heads</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    {feeHeads.length} Heads
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Breakdown by fee head (tuition, exam, lab, admission) showing standard rates, total billed, collected, and outstanding.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('fee_heads')}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Fee Heads PDF</span>
              </button>
            </div>

            {/* 8. Approved Concessions Register */}
            <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
                      <Percent className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Approved Concessions Register</h4>
                      <span className="text-[10px] text-teal-600 font-mono font-semibold">Scholarships & Waivers</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200">
                    {discounts.length} Approved
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Register of all student fee concessions and scholarships, displaying discount type, value, approved reason, and authority.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('concessions')}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Concessions PDF</span>
              </button>
            </div>

            {/* 9. Student Running Ledger Statement */}
            <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Student Running Ledger Statement</h4>
                      <span className="text-[10px] text-slate-500 font-mono font-semibold">Individual Account</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Select Student</label>
                  <select
                    value={ledgerStudentId}
                    onChange={e => setLedgerStudentId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded font-medium focus:outline-none focus:border-indigo-500"
                  >
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.roll_number || 'No Roll #'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('student_ledger')}
                disabled={isGeneratingPdf || !ledgerStudentId}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Ledger PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EMBEDDED CASHIER DRAWER (SLIDE-OVER ON FEE LEDGER) */}
      {/* ========================================================================= */}
      {showCashierDrawer && activeInvoice && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-white/75 backdrop-blur-md flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="p-5 space-y-5">
              {/* Drawer Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3.5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    Receive Fee Payment
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Challan: {activeInvoice.invoice_number} • Month: {activeInvoice.billing_month}
                  </p>
                </div>
                <button
                  onClick={() => setShowCashierDrawer(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Student Details Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{activeInvoice.student_name}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Roll: {activeInvoice.roll_number} • {activeInvoice.batch_name}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Balance Due</span>
                  <span className="text-lg font-bold font-mono text-rose-600">
                    PKR {activeInvoice.balance_amount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payment Entry Form */}
              <form onSubmit={handleCommitPayment} id="cashierDrawerForm" className="space-y-4">
                {/* Quick Payment Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAmountChange(activeInvoice.balance_amount)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors flex-1"
                  >
                    Pay Full (PKR {activeInvoice.balance_amount.toLocaleString()})
                  </button>
                  {activeInvoice.balance_amount > 1000 && (
                    <button
                      type="button"
                      onClick={() => handleAmountChange(Math.round(activeInvoice.balance_amount / 2))}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 transition-colors flex-1"
                    >
                      Pay 50% (PKR {Math.round(activeInvoice.balance_amount / 2).toLocaleString()})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Amount Received (PKR)</label>
                    <input
                      type="number"
                      min="1"
                      max={activeInvoice.balance_amount * 2}
                      value={collectionAmount}
                      onChange={e => handleAmountChange(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600 text-slate-800 font-semibold"
                    >
                      <option value="cash">Cash (Counter)</option>
                      <option value="bank_transfer">Online Bank Transfer / Meezan IBFT</option>
                      <option value="easypaisa">EasyPaisa</option>
                      <option value="jazzcash">JazzCash</option>
                      <option value="cheque">Bank Cheque</option>
                    </select>
                  </div>
                </div>

                {/* Conditional Fields for Bank / Cheque */}
                {(paymentMethod === 'bank_transfer' || paymentMethod === 'cheque') && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <p className="text-[11px] font-bold text-slate-700">Bank / Cheque Verification Particulars</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Bank Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Meezan Bank"
                          value={paymentBankName}
                          onChange={e => setPaymentBankName(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                          {paymentMethod === 'cheque' ? 'Cheque Number' : 'Transaction Ref / RRN'}
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. CHQ-991248"
                          value={paymentChequeNumber}
                          onChange={e => setPaymentChequeNumber(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Clearing Date</label>
                        <input
                          type="date"
                          value={paymentClearingDate}
                          onChange={e => setPaymentClearingDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Note / Reference # (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Parent paid at counter"
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                {/* Live Payment Allocation Preview */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 p-2.5 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                      Payment Allocation Breakdown
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isOverrideActive}
                        onChange={e => setIsOverrideActive(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Manual Override</span>
                    </label>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/50 text-slate-500 font-mono text-[10px] uppercase border-b border-slate-100">
                      <tr>
                        <th className="py-1.5 px-3">Fee Head</th>
                        <th className="py-1.5 px-3 text-right">Due</th>
                        <th className="py-1.5 px-3 text-right">Allocated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {distributionItems.map(item => {
                        const invItem = activeInvoice.items.find(i => i.fee_head_id === item.fee_head_id);
                        const due = invItem ? invItem.balance_due : 0;
                        return (
                          <tr key={item.fee_head_id}>
                            <td className="py-2 px-3 font-medium text-slate-800">{item.head_name}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">{due.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right">
                              {isOverrideActive ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={item.allocated_amount}
                                  onChange={e => handleEditAllocation(item.fee_head_id, Number(e.target.value) || 0)}
                                  className="w-24 px-2 py-1 text-right font-mono font-bold text-xs bg-amber-50 border border-amber-300 rounded"
                                />
                              ) : (
                                <span className="font-mono font-bold text-emerald-600">
                                  {item.allocated_amount.toLocaleString()} PKR
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {isOverrideActive && (
                    <div className="p-3 bg-amber-50/50 border-t border-amber-200 space-y-1.5">
                      <label className="block text-xs font-bold text-amber-900">
                        Mandatory Reason for Allocation Override *
                      </label>
                      <textarea
                        rows={2}
                        placeholder="State reason (e.g. Parent requested full payment to tuition first)"
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                        className="w-full p-2 text-xs bg-white border border-amber-300 rounded-lg text-slate-800"
                        required
                      />
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowCashierDrawer(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="cashierDrawerForm"
                disabled={isCommittingPayment}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{isCommittingPayment ? 'Committing...' : 'Commit & Issue Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: OFFICIAL PAYMENT RECEIPT (A6 VERTICAL) WITH 1-CLICK WHATSAPP */}
      {/* ========================================================================= */}
      {showReceiptModal && activePaymentReceipt && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 my-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Official Fee Payment Receipt (A6 Vertical)</h3>
                  <p className="text-[11px] text-slate-500">Verified institutional receipt voucher • Auto-credited to ledger</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Print A6 portrait slip"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print A6</span>
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* A6 Vertical Slip Canvas View */}
            <div className="bg-slate-100 p-3 rounded-xl flex justify-center max-h-[65vh] overflow-y-auto border border-slate-200">
              {!isRenderingReceipt && receiptSlipImage ? (
                <img
                  src={receiptSlipImage}
                  alt="Payment Receipt Slip"
                  className="w-full max-w-[380px] shadow-xl rounded-lg border border-slate-300"
                />
              ) : (
                <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Rendering official A6 receipt slip...</span>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 print:hidden">
              <div className="text-xs text-slate-500">
                <span>Receipt: <strong className="font-mono text-slate-900">{activePaymentReceipt.receipt_number}</strong> • PKR {Number(activePaymentReceipt.amount_paid).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={async () => {
                    await handleDownloadReceiptPicture(activePaymentReceipt, activeInvoice);
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 flex-1 sm:flex-initial"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PNG</span>
                </button>
                <button
                  onClick={() => {
                    handleDispatchWhatsAppReceipt(activePaymentReceipt, activeInvoice);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs flex-1 sm:flex-initial"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send Receipt (WhatsApp)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FEE SLIP PICTURE PREVIEW & 1-CLICK WHATSAPP DISPATCH */}
      {/* ========================================================================= */}
      {showPictureSlipModal && previewSlipImage && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 my-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Fee Due Reminder Slip (A6 Vertical)</h3>
                  <p className="text-[11px] text-slate-500">Official student dues voucher • Bank deposit channels</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Print A6 portrait slip"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print A6</span>
                </button>
                <button
                  onClick={() => setShowPictureSlipModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl flex justify-center max-h-[65vh] overflow-y-auto border border-slate-200">
              <img
                src={previewSlipImage.dataUrl}
                alt="Fee Due Reminder Slip"
                className="w-full max-w-[380px] shadow-xl rounded-lg border border-slate-300"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 print:hidden">
              <div className="text-xs text-slate-500">
                <span>Roll: {previewSlipImage.invoice.roll_number} • {previewSlipImage.invoice.student_name}</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={async () => {
                    const slip = buildSlipData(previewSlipImage.invoice);
                    const res = await copyAndDownloadFeeSlip(slip, academyInfo);
                    showToast(
                      res.copiedToClipboard
                        ? 'Fee slip copied to clipboard & downloaded!'
                        : 'Fee slip downloaded to your computer.'
                    );
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 flex-1 sm:flex-initial"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PNG</span>
                </button>
                <button
                  onClick={() => {
                    setShowPictureSlipModal(false);
                    handleDispatchWhatsAppSlip(previewSlipImage.invoice);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs flex-1 sm:flex-initial"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send via WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day Close A4 Portrait Print Stylesheet */}
      {activeTab === 'reports' && !showPrintModal && !showReceiptModal && !showPictureSlipModal && (
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            body * {
              visibility: hidden !important;
            }
            #printable-day-close-area, #printable-day-close-area * {
              visibility: visible !important;
            }
            #printable-day-close-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              display: block !important;
              z-index: 999999 !important;
            }
            #printable-day-close-area button, #printable-day-close-area input {
              display: none !important;
            }
          }
        `}</style>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE AREA FOR A6 DOCUMENT SLIPS (RECEIPT & DUE REMINDER) */}
      {/* ========================================================================= */}
      {(showReceiptModal || showPictureSlipModal) && (
        <>
          <style>{`
            @media print {
              @page {
                size: 105mm 148mm;
                margin: 4mm;
              }
              body * {
                visibility: hidden !important;
              }
              #printable-a6-slip-area, #printable-a6-slip-area * {
                visibility: visible !important;
              }
              #printable-a6-slip-area {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 97mm !important;
                max-width: 97mm !important;
                height: auto !important;
                margin: 0 auto !important;
                padding: 0 !important;
                background: white !important;
                display: block !important;
                z-index: 999999 !important;
              }
            }
          `}</style>
          <div id="printable-a6-slip-area" className="hidden print:block">
            {showReceiptModal && receiptSlipImage && (
              <img
                src={receiptSlipImage}
                alt="Payment Receipt Slip"
                className="w-full h-auto block"
              />
            )}
            {showPictureSlipModal && previewSlipImage && (
              <img
                src={previewSlipImage.dataUrl}
                alt="Fee Due Reminder Slip"
                className="w-full h-auto block"
              />
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL: 3-PART PRINTABLE BANK CHALLAN (A4 SHEET) WITH DYNAMIC BANK INFO */}
      {/* ========================================================================= */}
      {showPrintModal && activeInvoice && (
        <>
          <style>{`
            @media print {
              @page {
                size: A4 landscape;
                margin: 6mm;
              }
              body * {
                visibility: hidden !important;
              }
              #printable-challan-modal, #printable-challan-modal * {
                visibility: visible !important;
              }
              #printable-challan-modal {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: white !important;
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                z-index: 999999 !important;
              }
              .challan-no-print {
                display: none !important;
              }
            }
          `}</style>
          <div className="fixed inset-0 bg-white/75 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div id="printable-challan-modal" className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 my-0 sm:my-8">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3 print:hidden challan-no-print">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-sm">3-Part Fee Challan (A4 Sheet Preview)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const academy = await academyLetterheadFromAuth(tenant);
                      const bytes = await buildSimpleStatementPdf({
                        title: 'Fee Challan',
                        academy,
                        identity: [
                          { label: 'Invoice', value: activeInvoice.invoice_number },
                          { label: 'Student', value: activeInvoice.student_name || '—' },
                          { label: 'Class', value: activeInvoice.program_name || getProgramName(activeInvoice.program_id || students.find(s => s.id === activeInvoice.student_id)?.program_id) || 'Class' },
                          { label: 'Section / Batch', value: activeInvoice.batch_name },
                          { label: 'Month', value: activeInvoice.billing_month },
                          { label: 'Due date', value: activeInvoice.due_date },
                          { label: 'Net payable', value: `PKR ${(activeInvoice.net_amount || 0).toLocaleString()}` },
                          { label: 'Balance', value: `PKR ${(activeInvoice.balance_amount || 0).toLocaleString()}` },
                        ],
                        columns: [
                          { key: 'head', label: 'Fee head', width: 220 },
                          { key: 'original', label: 'Original', width: 90, align: 'right' },
                          { key: 'net', label: 'Net', width: 90, align: 'right' },
                          { key: 'balance', label: 'Balance', width: 90, align: 'right' },
                        ],
                        rows: (activeInvoice.items || []).map((it: any) => ({
                          head: it.head_name,
                          original: String(it.original_amount ?? it.net_amount ?? 0),
                          net: String(it.net_amount ?? 0),
                          balance: String(it.balance_due ?? 0),
                        })),
                        footerNote: `Bank: ${academyInfo.bank_name || 'Campus Desk'} · A/C: ${academyInfo.account_number || '—'} · Raast: ${academyInfo.easypaisa_number || '—'}`,
                      });
                      await downloadPdfBytes(bytes, `challan-${activeInvoice.invoice_number}.pdf`);
                    }}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF Challan
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print A4
                  </button>
                  <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 3-Column Challan Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border border-slate-300 p-4 rounded-xl bg-slate-50 print:bg-white print:border-none print:p-0">
                {['BANK COPY', 'ACADEMY COPY', 'STUDENT COPY'].map((copyTitle, idx) => (
                  <div key={idx} className="bg-white border border-slate-300 p-3 rounded-lg flex flex-col justify-between text-[11px] space-y-2 shadow-2xs print:shadow-none">
                    <div className="space-y-1.5 border-b border-slate-200 pb-2 text-center">
                      <h4 className="font-black text-slate-900 tracking-tight text-xs uppercase">{academyInfo.name}</h4>
                      <p className="text-[9px] text-slate-500 font-mono">{academyInfo.campus} • Official Fee Challan</p>
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[9px] font-bold tracking-wider">
                        {copyTitle}
                      </span>
                    </div>

                    {/* Bank Details Box */}
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 text-[9px] font-mono space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Bank:</span>
                        <span className="font-bold text-slate-800 truncate">{academyInfo.bank_name || 'Campus Accounts Desk'}</span>
                      </div>
                      {academyInfo.account_title && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">A/C Title:</span>
                          <span className="font-bold text-slate-800 truncate">{academyInfo.account_title}</span>
                        </div>
                      )}
                      {academyInfo.account_number && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">A/C No:</span>
                          <span className="font-bold text-indigo-900">{academyInfo.account_number}</span>
                        </div>
                      )}
                      {academyInfo.iban && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">IBAN:</span>
                          <span className="font-semibold text-slate-700 text-[8px]">{academyInfo.iban}</span>
                        </div>
                      )}
                      {academyInfo.easypaisa_number && (
                        <div className="flex justify-between border-t border-slate-200 pt-0.5">
                          <span className="text-slate-500">Raast / Mobile:</span>
                          <span className="font-bold text-emerald-800">{academyInfo.easypaisa_number}</span>
                        </div>
                      )}
                    </div>

                  <div className="space-y-1 text-[10px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Challan #:</span>
                      <span className="font-bold text-slate-900">{activeInvoice.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Month:</span>
                      <span className="font-bold text-slate-900">{activeInvoice.billing_month}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Due Date:</span>
                      <span className="font-bold text-rose-600">{activeInvoice.due_date}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-1">
                      <span className="text-slate-500">Student:</span>
                      <span className="font-bold text-slate-900 truncate">{activeInvoice.student_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Roll No:</span>
                      <span className="font-bold text-slate-900">{activeInvoice.roll_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Class:</span>
                      <span className="font-bold text-slate-900 truncate">
                        {activeInvoice.program_name || getProgramName(activeInvoice.program_id || students.find(s => s.id === activeInvoice.student_id)?.program_id) || 'Class'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Section / Batch:</span>
                      <span className="font-semibold text-slate-700 truncate">{activeInvoice.batch_name}</span>
                    </div>
                  </div>

                  <table className="w-full text-left text-[10px] border border-slate-200 mt-1">
                    <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[9px]">
                      <tr>
                        <th className="py-1 px-1.5">Head</th>
                        <th className="py-1 px-1.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {activeInvoice.items.map(it => (
                        <tr key={it.id}>
                          <td className="py-0.5 px-1.5 text-slate-700 truncate">{it.head_name}</td>
                          <td className="py-0.5 px-1.5 text-right">{it.net_amount.toLocaleString()}</td>
                        </tr>
                      ))}
                      {activeInvoice.discount_amount > 0 && (
                        <tr className="text-rose-600">
                          <td className="py-0.5 px-1.5">Concession</td>
                          <td className="py-0.5 px-1.5 text-right">-{activeInvoice.discount_amount.toLocaleString()}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold font-mono text-[10px] border-t border-slate-200">
                      <tr>
                        <td className="py-1 px-1.5">Net Payable:</td>
                        <td className="py-1 px-1.5 text-right text-indigo-900">{activeInvoice.net_amount.toLocaleString()} PKR</td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="pt-4 border-t border-dashed border-slate-200 text-[9px] text-slate-400 space-y-4">
                    <div className="flex justify-between">
                      <span className="border-t border-slate-400 pt-0.5 px-2">Bank Officer Stamp</span>
                      <span className="border-t border-slate-400 pt-0.5 px-2">Depositor Signature</span>
                    </div>
                    <p className="text-center text-[8px] text-slate-400">Zero Late Fines Applied • Official Fee Voucher</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    )}

      {/* ========================================================================= */}
      {/* MODAL: SINGLE INVOICE GENERATION */}
      {/* ========================================================================= */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-white/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/90 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Generate Student Fee Invoice</h3>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Student</label>
                <select
                  value={newInvStudentId}
                  onChange={e => setNewInvStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                  required
                >
                  <option value="">-- Choose Student --</option>
                  {students.map(s => {
                    const progName = getProgramName(s.program_id);
                    const batchObj = batches.find(b => b.id === s.batch_id);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.roll_number}) • {progName ? `${progName} - ` : ''}{batchObj?.name || 'Section'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Billing Month</label>
                  <input
                    type="text"
                    value={newInvMonth}
                    onChange={e => setNewInvMonth(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newInvDueDate}
                    onChange={e => setNewInvDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Regular monthly fee"
                  value={newInvNotes}
                  onChange={e => setNewInvNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BATCH INVOICE GENERATION */}
      {/* ========================================================================= */}
      {showBatchInvoiceModal && (
        <div className="fixed inset-0 bg-white/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/90 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Batch Invoicing (Whole Section)</h3>
                <p className="text-xs text-slate-500">Auto-rolls prior arrears & applies fee structures</p>
              </div>
              <button onClick={() => setShowBatchInvoiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBatchInvoice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Batch</label>
                <select
                  value={batchInvBatchId}
                  onChange={e => setBatchInvBatchId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                  required
                >
                  <option value="">-- Choose Batch --</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {getProgramName(b.program_id) ? `${getProgramName(b.program_id)} • ` : ''}{b.name} ({b.academic_session || '2026-2027'})
                    </option>
                  ))}
                </select>
              </div>

              {batchInvBatchId && (
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Enrolled Students:</span>
                    <span className="font-bold text-slate-900">
                      {students.filter(s => s.batch_id === batchInvBatchId && s.status === 'active').length} Active
                    </span>
                  </div>
                  {(() => {
                    const struct = feeStructures.find(s => s.batch_id === batchInvBatchId);
                    if (!struct) return <p className="text-slate-400 text-[11px]">No specific fee structure; baseline fees apply.</p>;
                    const total = struct.items.reduce((s, it) => s + Number(it.amount), 0);
                    return (
                      <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1">
                        <span>Configured Base Total:</span>
                        <span className="font-bold text-indigo-700 font-mono">PKR {total.toLocaleString()}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Billing Month</label>
                <input
                  type="text"
                  value={batchInvMonth}
                  onChange={e => setBatchInvMonth(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={batchInvDueDate}
                  onChange={e => setBatchInvDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchInvoiceModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  Generate for Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURE BATCH FEE STRUCTURE */}
      {/* ========================================================================= */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-white/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/90 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingStructure ? 'Edit Batch Fee Structure' : 'Configure Batch Fee Structure'}
                </h3>
                <p className="text-xs text-slate-500">Set standard fee items and default rates for this batch</p>
              </div>
              <button onClick={() => setShowStructureModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStructure} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batch</label>
                  <select
                    value={structureBatchId}
                    onChange={e => setStructureBatchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    required
                  >
                    <option value="">-- Choose Batch --</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Academic Session</label>
                  <input
                    type="text"
                    value={structureSession}
                    onChange={e => setStructureSession(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-2.5 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700">Fee Heads & Monthly Rates</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto p-2">
                  {feeHeads.map(head => {
                    const curr = structureItems.find(it => it.fee_head_id === head.id);
                    const amount = curr ? curr.amount : 0;
                    return (
                      <div key={head.id} className="py-2 px-1 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{head.name}</p>
                          <span className="font-mono text-[10px] text-slate-400">{head.code}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={amount}
                            onChange={e => {
                              const val = Number(e.target.value) || 0;
                              setStructureItems(prev => {
                                const exists = prev.some(it => it.fee_head_id === head.id);
                                if (exists) {
                                  return prev.map(it => it.fee_head_id === head.id ? { ...it, amount: val } : it);
                                } else {
                                  return [...prev, { fee_head_id: head.id, amount: val }];
                                }
                              });
                            }}
                            className="w-28 px-2.5 py-1 text-right font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded"
                          />
                          <span className="text-[10px] text-slate-400">PKR</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStructureModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStructure}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  {isSavingStructure ? 'Saving...' : 'Save Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FEE HEAD MANAGEMENT */}
      {/* ========================================================================= */}
      {showHeadModal && (
        <div className="fixed inset-0 bg-white/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/90 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo
                title={editingHead ? "Edit Fee Head" : "New Fee Head"}
                description="Configure billing head and allocation priority"
              />
              <button
                type="button"
                onClick={() => setShowHeadModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHead} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Head Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Science Lab Maintenance Fee"
                  value={headForm.name}
                  onChange={e => setHeadForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LAB_FEE"
                    value={headForm.code}
                    onChange={e => setHeadForm(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Default Amount (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={headForm.default_amount}
                    onChange={e => setHeadForm(prev => ({ ...prev, default_amount: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Allocation Priority</label>
                  <input
                    type="number"
                    min="1"
                    value={headForm.priority_order}
                    onChange={e => setHeadForm(prev => ({ ...prev, priority_order: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={headForm.show_at_admission}
                      onChange={e => setHeadForm(prev => ({ ...prev, show_at_admission: e.target.checked }))}
                      className="rounded text-indigo-600"
                    />
                    <span>Show at Admission</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHeadModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHead}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  {isSavingHead ? 'Saving...' : 'Save Fee Head'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GRANT AD-HOC CONCESSION */}
      {/* ========================================================================= */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-white/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/90 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Grant Student Fee Concession</h3>
              <button onClick={() => setShowDiscountModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyDiscount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Student</label>
                <select
                  value={discountStudentId}
                  onChange={e => {
                    setDiscountStudentId(e.target.value);
                    const unpaidInv = invoices.find(i => i.student_id === e.target.value && i.status !== 'paid');
                    if (unpaidInv) setDiscountInvoiceId(unpaidInv.id);
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  required
                >
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.roll_number})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Invoice</label>
                <select
                  value={discountInvoiceId}
                  onChange={e => setDiscountInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  required
                >
                  <option value="">-- Choose Invoice --</option>
                  {invoices
                    .filter(i => !discountStudentId || i.student_id === discountStudentId)
                    .map(i => (
                      <option key={i.id} value={i.id}>
                        {i.invoice_number} ({i.billing_month} - Balance: {i.balance_amount} PKR)
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
                  <select
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="flat">Fixed PKR Amount</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Value</label>
                  <input
                    type="number"
                    min="1"
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mandatory Audit Remark / Justification *
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Principal approved 50% sibling concession"
                  value={discountReason}
                  onChange={e => setDiscountReason(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  Grant Concession
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VOID RECEIPT */}
      {/* ========================================================================= */}
      {voidPaymentModal && (
        <div className="fixed inset-0 bg-white/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/90 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Void Payment Receipt
              </h3>
              <button onClick={() => setVoidPaymentModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You are voiding receipt <strong className="font-mono text-slate-900">{voidPaymentModal.receipt_number}</strong> of{' '}
              <strong className="font-mono text-rose-600">PKR {voidPaymentModal.amount.toLocaleString()}</strong> for{' '}
              <strong>{voidPaymentModal.student_name}</strong>. The invoice balance will be restored.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mandatory Reason for Void *</label>
              <textarea
                rows={2}
                placeholder="e.g. Counter entry error, cheque returned, or duplicate voucher"
                value={voidReasonText}
                onChange={e => setVoidReasonText(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidPaymentModal(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={voidSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-xs"
              >
                {voidSubmitting ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BULK TUITION FEE REVISION */}
      {/* ========================================================================= */}
      {showBulkRevisionModal && (
        <div className="fixed inset-0 bg-white/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200/90 space-y-4 max-h-[92vh] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Bulk Tuition Fee Revision</h3>
                    <p className="text-[11px] text-slate-500">Institutional adjustment of student baseline tuition fees</p>
                  </div>
                </div>
                <button onClick={() => setShowBulkRevisionModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleExecuteBulkRevision} id="bulkRevForm" className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pr-1">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Target Cohort Scope</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'all', label: 'Entire Academy' },
                      { id: 'program', label: 'Specific Class' },
                      { id: 'batch', label: 'Specific Section' },
                    ].map(tab => (
                      <button
                        type="button"
                        key={tab.id}
                        onClick={() => {
                          setBulkRevScope(tab.id as any);
                          if (tab.id === 'program' && programs.length > 0 && !bulkRevProgramId) {
                            setBulkRevProgramId(programs[0].id);
                          }
                          if (tab.id === 'batch' && batches.length > 0 && !bulkRevBatchId) {
                            setBulkRevBatchId(batches[0].id);
                          }
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                          bulkRevScope === tab.id
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {bulkRevScope === 'program' && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Select Academic Class</label>
                      <select
                        value={bulkRevProgramId}
                        onChange={e => setBulkRevProgramId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                        required
                      >
                        <option value="" disabled>-- Select Class --</option>
                        {programs.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {bulkRevScope === 'batch' && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Select Section / Batch</label>
                      <select
                        value={bulkRevBatchId}
                        onChange={e => setBulkRevBatchId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                        required
                      >
                        <option value="" disabled>-- Select Section --</option>
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.academic_session})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Method</label>
                    <select
                      value={bulkRevType}
                      onChange={e => setBulkRevType(e.target.value as 'percentage' | 'fixed')}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                    >
                      <option value="percentage">Percentage Hike (+%)</option>
                      <option value="fixed">Fixed Increment (+PKR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {bulkRevType === 'percentage' ? 'Percentage Rate (%)' : 'Amount Added (PKR)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={bulkRevValue}
                      onChange={e => setBulkRevValue(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rounding Rule</label>
                  <select
                    value={bulkRevRounding}
                    onChange={e => setBulkRevRounding(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                  >
                    <option value="nearest_100">Round to nearest 100 PKR (e.g. 5,480 → 5,500)</option>
                    <option value="nearest_50">Round to nearest 50 PKR (e.g. 5,420 → 5,450)</option>
                    <option value="none">Exact calculation (no rounding)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mandatory Audit Rationale</label>
                  <input
                    type="text"
                    value={bulkRevReason}
                    onChange={e => setBulkRevReason(e.target.value)}
                    placeholder="e.g. Annual academic inflation adjustment approved by Board"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                    required
                  />
                </div>
              </form>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowBulkRevisionModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="bulkRevForm"
                disabled={isSubmittingBulkRev || affectedStudents.length === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-xs"
              >
                {isSubmittingBulkRev ? 'Applying...' : `Apply Revision to ${affectedStudents.length} Students`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FAMILY FEE PAYMENT DESK (All Enrolled Siblings) */}
      {/* ========================================================================= */}
      {selectedFamily && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200/90 space-y-5 my-6 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Family Fee Collection Desk</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Father / Guardian: <strong className="text-slate-800">{selectedFamily.guardian_name}</strong>
                      {selectedFamily.guardian_phone ? ` • Phone: ${selectedFamily.guardian_phone}` : ''}
                      {selectedFamily.guardian_id_card ? ` • CNIC: ${selectedFamily.guardian_id_card}` : ''}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedFamily(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCommitFamilyPayment} className="space-y-4">
              {/* Sibling Members Roster & Amount Inputs */}
              <div className="space-y-3 max-h-[48vh] overflow-y-auto pr-1">
                {selectedFamily.members.map(member => {
                  const s = member.student;
                  const batch = batches.find(b => b.id === s.batch_id);
                  const progName = getProgramName(s.program_id) || (batch?.program_id ? getProgramName(batch.program_id) : '') || 'Class';

                  return (
                    <div key={s.id} className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-xs">
                            {s.full_name?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{s.full_name}</h4>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Roll #{s.roll_number || '—'} • {progName} ({batch?.name || 'Section'})
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Outstanding</span>
                          <span className="text-xs font-bold font-mono text-rose-600">
                            PKR {member.totalDue.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {member.unpaidInvoices.length === 0 ? (
                        <p className="text-[11px] text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg font-medium">
                          ✓ No outstanding fee vouchers for this student.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {member.unpaidInvoices.map(inv => (
                            <div key={inv.id} className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200/80 text-xs">
                              <div>
                                <span className="font-bold font-mono text-slate-800">{inv.invoice_number}</span>
                                <span className="text-slate-400 mx-1.5">•</span>
                                <span className="text-slate-600">{inv.billing_month}</span>
                                <span className="text-slate-400 text-[10px] ml-1.5 font-mono">(Due: PKR {inv.balance_amount.toLocaleString()})</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-mono text-slate-400">PKR</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={inv.balance_amount}
                                    value={familyAllocations[inv.id] ?? ''}
                                    onChange={e => {
                                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                                      setFamilyAllocations(prev => ({
                                        ...prev,
                                        [inv.id]: val,
                                      }));
                                    }}
                                    className="w-28 px-2.5 py-1 text-right font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFamilyAllocations(prev => ({
                                      ...prev,
                                      [inv.id]: inv.balance_amount,
                                    }));
                                  }}
                                  className="px-2 py-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200"
                                >
                                  Full
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFamilyAllocations(prev => ({
                                      ...prev,
                                      [inv.id]: 0,
                                    }));
                                  }}
                                  className="px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 rounded"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total & Payment Parameters */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase font-mono">Total Family Collection</span>
                  <span className="text-lg font-bold font-mono text-emerald-600">
                    PKR {Object.values(familyAllocations).reduce((sum, v) => sum + (Number(v) || 0), 0).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={familyPaymentMethod}
                      onChange={e => setFamilyPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-medium"
                    >
                      <option value="cash">Cash Counter</option>
                      <option value="bank_transfer">Bank IBFT / Raast</option>
                      <option value="easypaisa">EasyPaisa</option>
                      <option value="jazzcash">JazzCash</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Reference # / Trx ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 982341 or Chq #4091"
                      value={familyReference}
                      onChange={e => setFamilyReference(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Meezan Bank"
                      value={familyBankName}
                      onChange={e => setFamilyBankName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedFamily(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFamily || Object.values(familyAllocations).reduce((sum, v) => sum + (Number(v) || 0), 0) <= 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmittingFamily
                      ? 'Recording...'
                      : `Receive Family Payment (PKR ${Object.values(familyAllocations).reduce((sum, v) => sum + (Number(v) || 0), 0).toLocaleString()})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: OFFICIAL FAMILY PAYMENT RECEIPT */}
      {/* ========================================================================= */}
      {familyReceiptData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/90 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Official Family Payment Receipt</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Receipt #{familyReceiptData.receiptNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setFamilyReceiptData(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Date:</span>
                <span className="font-mono font-bold text-slate-900">{familyReceiptData.date}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Payer / Guardian:</span>
                <span className="font-bold text-slate-900">{familyReceiptData.guardianName}</span>
              </div>
              {familyReceiptData.guardianPhone && (
                <div className="flex justify-between text-slate-600">
                  <span>Phone:</span>
                  <span className="font-mono text-slate-700">{familyReceiptData.guardianPhone}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Payment Mode:</span>
                <span className="font-mono uppercase font-bold text-indigo-700">{familyReceiptData.paymentMethod}</span>
              </div>
              {familyReceiptData.referenceNumber && (
                <div className="flex justify-between text-slate-600">
                  <span>Reference #:</span>
                  <span className="font-mono text-slate-700">{familyReceiptData.referenceNumber}</span>
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-2.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700">
                Per-Child Fee Settlement Breakdown
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {familyReceiptData.breakdown.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">{item.studentName}</p>
                      <p className="text-[11px] text-slate-500 font-mono">Roll #{item.rollNumber} • {item.className}</p>
                    </div>
                    <span className="font-mono font-bold text-emerald-600">
                      PKR {item.amountPaid.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center font-bold text-xs">
                <span>Total Amount Paid:</span>
                <span className="font-mono text-base text-emerald-600">
                  PKR {familyReceiptData.totalPaid.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const text = `Fee Payment Receipt - ${tenant?.name || 'Academy'}\nReceipt #: ${familyReceiptData.receiptNumber}\nDate: ${familyReceiptData.date}\nGuardian: ${familyReceiptData.guardianName}\nTotal Paid: PKR ${familyReceiptData.totalPaid.toLocaleString()}\nPayment Mode: ${familyReceiptData.paymentMethod.toUpperCase()}\n\nBreakdown:\n${familyReceiptData.breakdown.map(b => `• ${b.studentName} (Roll ${b.rollNumber}): PKR ${b.amountPaid.toLocaleString()}`).join('\n')}\n\nThank you!`;
                  const phone = (familyReceiptData.guardianPhone || '').replace(/\D/g, '');
                  const url = phone ? `https://wa.me/${phone.startsWith('0') ? '92' + phone.slice(1) : phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
                  window.open(url, '_blank');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp Share</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => setFamilyReceiptData(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Portal Direct PDF Viewer Modal */}
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
