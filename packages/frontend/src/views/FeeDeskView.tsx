import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Users,
  Calendar,
  ArrowRight,
  Phone,
  SlidersHorizontal,
  User,
  RotateCcw,
  MoreHorizontal,
  ArrowLeft
} from 'lucide-react';
import { academyLetterheadFromAuth, buildSimpleStatementPdf, downloadPdfBytes } from '../lib/officialDocumentPdf';
import { buildTabularFeeReportPdfBytes } from '../lib/feeReportsPdf';
import { InPortalPdfViewerModal } from '../components/InPortalPdfViewerModal';
import { ModernSelect } from '../components/ModernSelect';
import { useMobileOverlay } from '../lib/mobileOverlay';
import {
  FeeHead,
  StudentInvoice,
  PaymentDistributionItem,
  FeeDiscount,
  DailyCashbookEntry,
  StudentLedgerEntry,
  PaymentMethod,
  FeePayment
} from '@apex/shared-types';
import { SectionInfo } from '../components/SectionInfo';
import { localISODate, addLocalDays } from '../lib/localDate';
import { normalizeBillingMonth } from './FeeChallansView';
import {
  FeeSlipData,
  AcademyInfo,
  dispatchWhatsAppFeeSlipWithPicture,
  copyAndDownloadFeeSlip,
  renderFeeSlipCanvas
} from '../lib/feeSlipPicture';

export const FeeDeskView: React.FC = () => {
  const { token, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'cashier' | 'defaulters' | 'reports'>('cashier');

  // Core Data
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [discounts, setDiscounts] = useState<FeeDiscount[]>([]);
  const [cashbook, setCashbook] = useState<DailyCashbookEntry[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [academySettings, setAcademySettings] = useState<any>(null);
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [dayCloseDate, setDayCloseDate] = useState<string>(() => localISODate());
  const [dayCloseRecords, setDayCloseRecords] = useState<DailyCashbookEntry[]>([]);
  const [duesView, setDuesView] = useState<'all' | 'overdue' | 'current'>('all');
  const [unpaidMonthsFilter, setUnpaidMonthsFilter] = useState<'any' | '1' | '2' | '3+'>('any');
  const [selectedDefaulterHead, setSelectedDefaulterHead] = useState<string>('all');
  const [selectedDefaulterModal, setSelectedDefaulterModal] = useState<any | null>(null);
  const [showCashierSummaryAndFilter, setShowCashierSummaryAndFilter] = useState<boolean>(false);
  const [showDefaulterSummaryAndFilter, setShowDefaulterSummaryAndFilter] = useState<boolean>(false);

  const activeDefaulterFilterCount = useMemo(() => {
    let count = 0;
    if (selectedBatch !== 'all') count++;
    if (unpaidMonthsFilter !== 'any') count++;
    if (selectedDefaulterHead !== 'all') count++;
    return count;
  }, [selectedBatch, unpaidMonthsFilter, selectedDefaulterHead]);

  // Register mobile back button handler for defaulter details modal
  useMobileOverlay('sheet', Boolean(selectedDefaulterModal), () => setSelectedDefaulterModal(null));
  const [siblingReportOpen, setSiblingReportOpen] = useState(false);
  const [siblingReportScope, setSiblingReportScope] = useState<'one_student' | 'one_class' | 'all_classes'>('all_classes');
  const [siblingReportStudentId, setSiblingReportStudentId] = useState('');
  const [siblingReportProgramId, setSiblingReportProgramId] = useState('all');

  // Cashier Student Search & Family Desk
  const [cashierSearch, setCashierSearch] = useState<string>('');
  const [cashierClassFilter, setCashierClassFilter] = useState<string>('all');
  const [selectedCashierStudentId, setSelectedCashierStudentId] = useState<string | null>(null);
  const [showSearchPopup, setShowSearchPopup] = useState<boolean>(false);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [studentDeskTab, setStudentDeskTab] = useState<'challans' | 'history' | 'siblings'>('challans');
  const [historyViewMode, setHistoryViewMode] = useState<'receipts' | 'ledger'>('receipts');
  const [quickDiscountAmount, setQuickDiscountAmount] = useState<number>(0);
  const [familyHeadAllocations, setFamilyHeadAllocations] = useState<Record<string, number>>({});
  const [familyTotalInput, setFamilyTotalInput] = useState<number | ''>('');

  // Embedded Fee Heads Drawer / Modal State
  const [showFeeHeadsModal, setShowFeeHeadsModal] = useState<boolean>(false);

  // Cashier Collection Custom Date & Head-Wise Counter Discount
  const [paymentDate, setPaymentDate] = useState<string>(() => localISODate());
  const [showCounterDiscount, setShowCounterDiscount] = useState<boolean>(false);
  const [counterDiscounts, setCounterDiscounts] = useState<Record<string, number>>({});
  const [counterDiscountReason, setCounterDiscountReason] = useState<string>('');
  const [showDiscountSection, setShowDiscountSection] = useState<boolean>(false);
  const [showAllocationBreakdown, setShowAllocationBreakdown] = useState<boolean>(false);
  // Module Options Menu
  const [showFeeModuleMenu, setShowFeeModuleMenu] = useState<boolean>(false);
  const feeModuleContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (feeModuleContainerRef.current && !feeModuleContainerRef.current.contains(e.target as Node)) {
        setShowFeeModuleMenu(false);
      }
    };
    if (showFeeModuleMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showFeeModuleMenu]);

  // Unified Concessions Report Modal State
  const [showConcessionReportModal, setShowConcessionReportModal] = useState<boolean>(false);
  const [concessionReportType, setConcessionReportType] = useState<'all' | 'scholarship' | 'counter'>('all');
  const [concessionPeriodType, setConcessionPeriodType] = useState<'monthly' | 'yearly' | 'date_range'>('monthly');
  const [concessionClassFilter, setConcessionClassFilter] = useState<string>('all');
  const [concessionMonth, setConcessionMonth] = useState<string>(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const [concessionYear, setConcessionYear] = useState<string>(() => new Date().getFullYear().toString());
  const [concessionStartDate, setConcessionStartDate] = useState<string>(() => {
    const d = new Date();
    return localISODate(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [concessionEndDate, setConcessionEndDate] = useState<string>(() => localISODate());

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
    breakdown: Array<{ studentName: string; admissionNumber?: string; rollNumber?: string; className: string; amountPaid: number }>;
  } | null>(null);

  // Reports Hub State
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    return localISODate(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => localISODate());
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

  // Operational Modals & Drawers
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showDiscountModal, setShowDiscountModal] = useState<boolean>(false);
  const [showBulkRevisionModal, setShowBulkRevisionModal] = useState<boolean>(false);
  const [showCashierDrawer, setShowCashierDrawer] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showPictureSlipModal, setShowPictureSlipModal] = useState<boolean>(false);

  // Register mobile back button handler for cashier drawer modal
  useMobileOverlay('sheet', showCashierDrawer, () => setShowCashierDrawer(false));

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
  const [voidPaymentModal, setVoidPaymentModal] = useState<{ id: string; receipt_number: string; amount: number; student_name: string } | null>(null);
  const [voidReasonText, setVoidReasonText] = useState<string>('');
  const [voidSubmitting, setVoidSubmitting] = useState<boolean>(false);

  // Cancel / Void Invoice State
  const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState<StudentInvoice | null>(null);
  const [cancelInvoiceReason, setCancelInvoiceReason] = useState<string>('');
  const [cancelSubmitting, setCancelSubmitting] = useState<boolean>(false);

  // Form States: Discount
  const [discountStudentId, setDiscountStudentId] = useState<string>('');
  const [discountInvoiceId, setDiscountInvoiceId] = useState<string>('');
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [discountReason, setDiscountReason] = useState<string>('');

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

  const fetchCashbook = useCallback(async () => {
    if (!token) return;
    try {
      const cashRes = await fetch(
        `/api/v1/finance/reports/cashbook?startDate=${encodeURIComponent(reportStartDate)}&endDate=${encodeURIComponent(reportEndDate)}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      if (cashRes.ok) setCashbook((await cashRes.json()).data || []);
    } catch (err) {
      console.error('Failed to load cashbook:', err);
    }
  }, [token, reportStartDate, reportEndDate]);

  // Fetch Core Data
  const fetchData = async () => {
    if (!token) return;
    try {
      const [invRes, headsRes, discRes, studRes, batchRes, progRes, settRes, priorityRes, payRes] = await Promise.all([
        fetch('/api/v1/finance/invoices', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/heads', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/finance/discounts', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/sis/students', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/batches', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/programs', { headers: { authorization: `Bearer ${token}` } }),
        fetch('/api/v1/academic/academy-settings', { headers: { authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/v1/finance/priority-config', { headers: { authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/v1/finance/payments', { headers: { authorization: `Bearer ${token}` } }).catch(() => null),
      ]);

      if (invRes.ok) setInvoices((await invRes.json()).data || []);
      if (payRes && payRes.ok) setPayments((await payRes.json()).data || []);
      
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

      if (discRes.ok) setDiscounts((await discRes.json()).data || []);
      await fetchCashbook();
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
    setDayCloseDate(addLocalDays(dayCloseDate, -1));
  };

  const handleNextDay = () => {
    setDayCloseDate(addLocalDays(dayCloseDate, 1));
  };

  const handleToday = () => {
    setDayCloseDate(localISODate());
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    void fetchCashbook();
  }, [fetchCashbook]);

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

  const billingMonthKey = (m: string) => {
    const n = normalizeBillingMonth(m || '');
    const d = new Date(n);
    if (Number.isNaN(d.getTime())) return 0;
    return d.getFullYear() * 12 + d.getMonth();
  };

  const currentMonthKey = (() => {
    const t = new Date();
    return t.getFullYear() * 12 + t.getMonth();
  })();

  // Stable list of all students with outstanding dues (for Cashier Dashboard & global metrics)
  const allUnpaidStudents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const liveUnpaid = invoices
      .filter(inv => {
        const st = String(inv.status || '').toLowerCase();
        if (st === 'paid' || st === 'voided' || st === 'cancelled' || st === 'rolled_over') return false;
        return (inv.balance_amount ?? inv.balance_due ?? 0) > 0;
      })
      .map(inv => {
        const due = new Date(inv.due_date);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
        return {
          ...inv,
          overdue_days: diffDays,
        };
      });

    const grouped = new Map<string, any>();
    for (const inv of liveUnpaid) {
      const stud = students.find(s => s.id === inv.student_id);
      let entry = grouped.get(inv.student_id);
      if (!entry) {
        const progName = inv.program_name || getProgramName(inv.program_id || stud?.program_id) || 'Class';
        entry = {
          student_id: inv.student_id,
          student_name: inv.student_name,
          admission_number: stud?.admission_number || inv.admission_number || '',
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

    return Array.from(grouped.values()).sort((a, b) => b.total_balance - a.total_balance);
  }, [invoices, students, getProgramName]);

  // Global counts for defaulters & outstanding dues
  const duesSummary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const liveUnpaid = invoices.filter(inv => {
      const st = String(inv.status || '').toLowerCase();
      if (st === 'paid' || st === 'voided' || st === 'cancelled' || st === 'rolled_over') return false;
      return (inv.balance_amount ?? inv.balance_due ?? 0) > 0;
    });

    const allStudentIds = new Set<string>();
    const overdueStudentIds = new Set<string>();
    const currentStudentIds = new Set<string>();
    let totalAllBalance = 0;
    let totalOverdueBalance = 0;
    let totalCurrentBalance = 0;

    const todayIso = localISODate(today);

    for (const inv of liveUnpaid) {
      allStudentIds.add(inv.student_id);
      totalAllBalance += (inv.balance_amount || 0);

      const dueIso = (inv.due_date || '').split('T')[0];
      const isPastDue = Boolean(dueIso && todayIso > dueIso);
      const isPriorMonth = billingMonthKey(inv.billing_month) < currentMonthKey;
      if (isPastDue || isPriorMonth) {
        overdueStudentIds.add(inv.student_id);
        totalOverdueBalance += (inv.balance_amount || 0);
      }

      if (billingMonthKey(inv.billing_month) === currentMonthKey) {
        currentStudentIds.add(inv.student_id);
        totalCurrentBalance += (inv.balance_amount || 0);
      }
    }

    const totalInvoicedAmount = invoices.reduce((acc, i) => acc + (i.net_amount ?? i.net_total ?? i.total_amount ?? i.subtotal_amount ?? 0), 0);
    const totalCollectedAmount = invoices.reduce((acc, i) => acc + (i.paid_amount || 0), 0);

    return {
      allCount: allStudentIds.size,
      allAmount: totalAllBalance,
      overdueCount: overdueStudentIds.size,
      overdueAmount: totalOverdueBalance,
      currentCount: currentStudentIds.size,
      currentAmount: totalCurrentBalance,
      totalInvoiced: totalInvoicedAmount,
      totalCollected: totalCollectedAmount,
    };
  }, [invoices, currentMonthKey]);

  // Defaulters list filtered according to user controls in Defaulters Tab
  const defaultersList = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayIso = localISODate(today);

    const liveUnpaid = invoices
      .filter(inv => {
        const st = String(inv.status || '').toLowerCase();
        if (st === 'paid' || st === 'voided' || st === 'cancelled' || st === 'rolled_over') return false;
        return (inv.balance_amount ?? inv.balance_due ?? 0) > 0;
      })
      .map(inv => {
        const dueIso = (inv.due_date || '').split('T')[0];
        const isPastDue = Boolean(dueIso && todayIso > dueIso);
        let diffDays = 0;
        if (isPastDue && dueIso) {
          const [dy, dm, dd] = dueIso.split('-').map(Number);
          const dueDt = new Date(dy, (dm || 1) - 1, dd || 1);
          diffDays = Math.max(0, Math.floor((today.getTime() - dueDt.getTime()) / (1000 * 60 * 60 * 24)));
        }
        const isPriorMonth = billingMonthKey(inv.billing_month) < currentMonthKey;
        const isCurrentMonth = billingMonthKey(inv.billing_month) === currentMonthKey;
        return {
          ...inv,
          overdue_days: diffDays,
          is_overdue: isPastDue || isPriorMonth,
          is_current_month: isCurrentMonth,
        };
      });

    const relevant = liveUnpaid.filter(inv => {
      if (duesView === 'current') return inv.is_current_month;
      if (duesView === 'overdue') return inv.is_overdue;
      return true; // 'all'
    });

    type DefaulterEntry = {
      student_id: string;
      student_name: string;
      admission_number?: string;
      roll_number?: string;
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
    };

    const grouped = new Map<string, DefaulterEntry>();

    for (const inv of relevant) {
      const stud = students.find(s => s.id === inv.student_id);
      let entry = grouped.get(inv.student_id);
      if (!entry) {
        const progName = inv.program_name || getProgramName(inv.program_id || stud?.program_id) || 'Class';
        const newEntry: DefaulterEntry = {
          student_id: inv.student_id,
          student_name: inv.student_name,
          admission_number: stud?.admission_number || inv.admission_number || '',
          roll_number: inv.roll_number || undefined,
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
        grouped.set(inv.student_id, newEntry);
        entry = newEntry;
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
          const hit =
            (def.student_name?.toLowerCase().includes(q) ?? false) ||
            (def.admission_number?.toLowerCase().includes(q) ?? false) ||
            (def.father_name?.toLowerCase().includes(q) ?? false) ||
            (def.guardian_phone?.toLowerCase().includes(q) ?? false) ||
            def.unpaid_months.some(m => m?.toLowerCase().includes(q));
          if (!hit) return false;
        }
        const monthCount = def.unpaid_months.length;
        if (unpaidMonthsFilter === '1' && monthCount !== 1) return false;
        if (unpaidMonthsFilter === '2' && monthCount !== 2) return false;
        if (unpaidMonthsFilter === '3+' && monthCount < 3) return false;
        if (selectedDefaulterHead !== 'all') {
          const pendingHeads = new Set(
            def.invoices.flatMap(inv =>
              (inv.items || [])
                .filter(it => Number(it.balance_due ?? it.net_amount ?? 0) > 0)
                .map(it => it.fee_head_id)
            )
          );
          if (!pendingHeads.has(selectedDefaulterHead)) return false;
        }
        return true;
      })
      .sort((a, b) => b.total_balance - a.total_balance);
  }, [invoices, students, selectedBatch, searchQuery, getProgramName, duesView, unpaidMonthsFilter, selectedDefaulterHead, currentMonthKey]);

  // Summary Totals
  const totalDefaultersCount = defaultersList.length;
  const totalDefaultersAmount = defaultersList.reduce((s, d) => s + d.total_balance, 0);

  // Open student in Student Desk directly
  const handleViewStudentInDesk = (studentId: string) => {
    setSelectedCashierStudentId(studentId);
    setLedgerStudentId(studentId);
    setStudentDeskTab('challans');
    setActiveTab('cashier');
  };

  // Sibling Finder Helper
  const getStudentSiblings = useCallback((student: any) => {
    if (!student) return [];
    return students.filter(other => {
      if (other.id === student.id) return false;
      // Direct explicit sibling link
      if (student.sibling_student_id && student.sibling_student_id === other.id) return true;
      if (other.sibling_student_id && other.sibling_student_id === student.id) return true;

      const sCnic = (student.guardian_id_card || '').trim();
      const oCnic = (other.guardian_id_card || '').trim();
      if (sCnic && oCnic && sCnic === oCnic) return true;

      const sPhone = (student.guardian_phone || student.phone || '').replace(/\D/g, '');
      const oPhone = (other.guardian_phone || other.phone || '').replace(/\D/g, '');
      if (sPhone.length >= 10 && oPhone.length >= 10 && sPhone === oPhone) return true;

      return false;
    });
  }, [students]);

  // Open Family Sibling Modal for a student
  const handleOpenFamilyModal = (student: any) => {
    const siblings = getStudentSiblings(student);
    const allFamilyStudents = [student, ...siblings];

    const members = allFamilyStudents.map(stud => {
      const studInvoices = invoices.filter(i => i.student_id === stud.id && i.status !== 'cancelled' && i.status !== 'voided');
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

    const initialHeadAlloc: Record<string, number> = {};
    const initialAlloc: Record<string, number> = {};
    for (const m of members) {
      for (const inv of m.unpaidInvoices) {
        let invTotal = 0;
        for (const it of inv.items || []) {
          const due = it.balance_due || 0;
          initialHeadAlloc[`${inv.id}_${it.fee_head_id}`] = due;
          invTotal += due;
        }
        initialAlloc[inv.id] = invTotal > 0 ? invTotal : inv.balance_amount;
      }
    }

    setFamilyHeadAllocations(initialHeadAlloc);
    setFamilyAllocations(initialAlloc);
    setFamilyTotalInput(totalFamilyDue);
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

  // Recalculate auto-distribution across all family fee heads by priority order
  const handleFamilyTotalAmountChange = (totalAmt: number | '') => {
    setFamilyTotalInput(totalAmt);
    if (!selectedFamily) return;

    const num = totalAmt === '' ? 0 : Number(totalAmt);
    if (num <= 0) {
      setFamilyHeadAllocations({});
      setFamilyAllocations({});
      return;
    }

    // Collect all unpaid items across all family students
    const allItems: Array<{ invoice_id: string; fee_head_id: string; head_name: string; balance_due: number; priority: number }> = [];
    for (const m of selectedFamily.members) {
      for (const inv of m.unpaidInvoices) {
        for (const it of inv.items || []) {
          const headConfig = feeHeads.find(h => h.id === it.fee_head_id);
          const priority = headConfig?.priority_order ?? 99;
          allItems.push({
            invoice_id: inv.id,
            fee_head_id: it.fee_head_id,
            head_name: it.head_name,
            balance_due: it.balance_due,
            priority,
          });
        }
      }
    }

    // Sort by priority order (lower priority number = paid first)
    allItems.sort((a, b) => a.priority - b.priority);

    let remaining = num;
    const newHeadAlloc: Record<string, number> = {};
    const newInvAlloc: Record<string, number> = {};

    for (const it of allItems) {
      const alloc = Math.min(remaining, it.balance_due);
      newHeadAlloc[`${it.invoice_id}_${it.fee_head_id}`] = alloc;
      newInvAlloc[it.invoice_id] = (newInvAlloc[it.invoice_id] || 0) + alloc;
      remaining -= alloc;
    }

    setFamilyHeadAllocations(newHeadAlloc);
    setFamilyAllocations(newInvAlloc);
  };

  // Manually tweak an individual head cell for a student
  const handleManualSiblingHeadChange = (invoiceId: string, headId: string, val: number) => {
    const key = `${invoiceId}_${headId}`;
    const newHeadAlloc = { ...familyHeadAllocations, [key]: val };
    setFamilyHeadAllocations(newHeadAlloc);

    const newInvAlloc: Record<string, number> = {};
    for (const [k, v] of Object.entries(newHeadAlloc)) {
      const [invId] = k.split('_');
      newInvAlloc[invId] = (newInvAlloc[invId] || 0) + (Number(v) || 0);
    }
    setFamilyAllocations(newInvAlloc);

    const grandTotal = Object.values(newHeadAlloc).reduce((sum, v) => sum + (Number(v) || 0), 0);
    setFamilyTotalInput(grandTotal);
  };

  // Commit Family Payment
  const handleCommitFamilyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFamily || !token) return;

    const paymentItems = Object.entries(familyAllocations)
      .filter(([_, amount]) => Number(amount) > 0)
      .map(([invId, amount]) => {
        const invAllocations: Array<{ fee_head_id: string; head_name: string; allocated_amount: number }> = [];
        for (const [k, v] of Object.entries(familyHeadAllocations)) {
          if (k.startsWith(`${invId}_`) && Number(v) > 0) {
            const headId = k.slice(invId.length + 1);
            const headName = feeHeads.find(h => h.id === headId)?.name || 'Fee Head';
            invAllocations.push({
              fee_head_id: headId,
              head_name: headName,
              allocated_amount: Number(v),
            });
          }
        }
        return {
          invoice_id: invId,
          amount_paid: Number(amount),
          allocations: invAllocations.length > 0 ? invAllocations : undefined,
        };
      });

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
          admissionNumber: r.invoice.admission_number || r.invoice.roll_number,
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

  // Selected Student for Fee Dossier
  const selectedStudent = useMemo(() => {
    if (!selectedCashierStudentId) return null;
    return students.find(s => s.id === selectedCashierStudentId) || null;
  }, [students, selectedCashierStudentId]);

  // Cashier Filtered Students Roster (Shows initial roster on focus, filters dynamically on typing)
  const cashierFilteredStudents = useMemo(() => {
    let list = students;
    if (cashierClassFilter !== 'all') {
      list = list.filter(s => s.program_id === cashierClassFilter);
    }
    if (!cashierSearch.trim()) {
      return [];
    }
    const q = cashierSearch.toLowerCase().trim();
    return list.filter(s => {
      const nameMatch = s.full_name?.toLowerCase().includes(q);
      const admMatch = s.admission_number?.toLowerCase().includes(q);
      const guardMatch = s.guardian_name?.toLowerCase().includes(q) || s.father_name?.toLowerCase().includes(q);
      const phoneMatch = s.phone?.includes(q) || s.guardian_phone?.includes(q);
      const cnicMatch = s.guardian_id_card?.includes(q);
      return nameMatch || admMatch || guardMatch || phoneMatch || cnicMatch;
    }).slice(0, 50);
  }, [students, cashierClassFilter, cashierSearch]);

  // Unified Concession Report Generator (Scholarship / Needy vs. Counter Concessions)
  const handleGenerateConcessionReport = async () => {
    setIsGeneratingPdf(true);
    try {
      const letterhead = await academyLetterheadFromAuth(tenant);
      let filteredDiscounts = [...discounts];

      // 1. Filter by Concession Type
      if (concessionReportType === 'scholarship') {
        filteredDiscounts = filteredDiscounts.filter(d => {
          const r = ((d as any).reason || d.mandatory_reason || '').toLowerCase();
          return r.includes('scholarship') || r.includes('needy') || r.includes('kinship') || r.includes('merit') || r.includes('orphan') || !d.invoice_id;
        });
      } else if (concessionReportType === 'counter') {
        filteredDiscounts = filteredDiscounts.filter(d => Boolean(d.invoice_id));
      }

      // 2. Filter by Class
      if (concessionClassFilter !== 'all') {
        filteredDiscounts = filteredDiscounts.filter(d => {
          const stud = students.find(s => s.id === d.student_id);
          return stud?.program_id === concessionClassFilter;
        });
      }

      // 3. Filter by Time Period
      if (concessionPeriodType === 'monthly') {
        filteredDiscounts = filteredDiscounts.filter(d => {
          const timestamp = d.applied_at || (d as any).created_at;
          if (!timestamp) return true;
          const dt = new Date(timestamp);
          const mName = dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          return mName.toLowerCase() === concessionMonth.toLowerCase();
        });
      } else if (concessionPeriodType === 'yearly') {
        filteredDiscounts = filteredDiscounts.filter(d => {
          const timestamp = d.applied_at || (d as any).created_at;
          if (!timestamp) return true;
          return new Date(timestamp).getFullYear().toString() === concessionYear;
        });
      } else if (concessionPeriodType === 'date_range') {
        filteredDiscounts = filteredDiscounts.filter(d => {
          const timestamp = d.applied_at || (d as any).created_at;
          if (!timestamp) return true;
          const dStr = timestamp.split('T')[0];
          return dStr >= concessionStartDate && dStr <= concessionEndDate;
        });
      }

      const totalConcessionAmount = filteredDiscounts.reduce((sum, d) => sum + (d.actual_discount_amount || d.discount_value || 0), 0);

      const typeLabel = concessionReportType === 'scholarship'
        ? 'Scholarship / Needy-Based Students Register'
        : concessionReportType === 'counter'
        ? 'Counter Concessions Register'
        : 'Approved Concessions & Scholarships Register';

      const title = `${typeLabel}`;
      const filename = `Concessions_${concessionReportType}_${new Date().toISOString().split('T')[0]}.pdf`;

      const rows = filteredDiscounts.map((d, i) => {
        const stud = students.find(s => s.id === d.student_id);
        const progName = stud ? getProgramName(stud.program_id) : '—';
        const batch = batches.find(b => b.id === stud?.batch_id);
        return {
          sr: String(i + 1),
          adm: stud?.admission_number || '—',
          student: stud?.full_name || 'Student',
          class_name: `${progName}${batch?.name ? ` (${batch.name})` : ''}`,
          type: d.discount_type.toUpperCase(),
          amount: `${d.discount_value}${d.discount_type === 'percentage' ? '%' : ' PKR'}`,
          reason: (d as any).reason || d.mandatory_reason || 'Approved Concession',
          approved_by: (d as any).approved_by || 'Academic Director',
        };
      });

      const bytes = await buildTabularFeeReportPdfBytes({
        title,
        academy: letterhead,
        filterInfo: [
          { label: 'Category', value: typeLabel },
          { label: 'Period Filter', value: concessionPeriodType.toUpperCase() },
          { label: 'Class', value: concessionClassFilter === 'all' ? 'All Classes' : getProgramName(concessionClassFilter) },
        ],
        summaryStrip: [
          { label: 'Total Concessions', value: `${filteredDiscounts.length} Students` },
          { label: 'Total Value', value: `PKR ${totalConcessionAmount.toLocaleString()}` },
        ],
        columns: [
          { key: 'sr', label: 'S#', width: 24 },
          { key: 'adm', label: 'Adm #', width: 44 },
          { key: 'student', label: 'Student Name', width: 105 },
          { key: 'class_name', label: 'Class & Sec', width: 85 },
          { key: 'type', label: 'Type', width: 45 },
          { key: 'amount', label: 'Concession', width: 65, align: 'right' },
          { key: 'reason', label: 'Mandatory Approval Reason', width: 150 },
        ],
        rows,
        filename,
      });

      setPdfBytes(bytes);
      setPdfTitle(title);
      setPdfFilename(filename);
      setPdfModalOpen(true);
      setShowConcessionReportModal(false);
    } catch (err: any) {
      alert(`Error generating concession report: ${err.message}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

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
          adm: d.admission_number || '—',
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
            { key: 'adm', label: 'Adm #', width: 44 },
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
        let sourceStudents = students;
        if (siblingReportScope === 'one_student') {
          const seed = students.find(s => s.id === siblingReportStudentId);
          sourceStudents = seed ? [seed, ...getStudentSiblings(seed)] : [];
        } else if (siblingReportScope === 'one_class' && siblingReportProgramId !== 'all') {
          sourceStudents = students.filter(s => s.program_id === siblingReportProgramId);
        }
        for (const s of sourceStudents) {
          const key = (s.guardian_id_card || s.guardian_phone || s.guardian_name || '').trim();
          if (!key) continue;
          let fam = familiesMap.get(key);
          const studInvs = invoices.filter(i => i.student_id === s.id && i.status !== 'paid');
          const due = studInvs.reduce((sum, inv) => sum + inv.balance_amount, 0);
          const progName = getProgramName(s.program_id) || 'Class';
          const childDesc = `${s.full_name} (${progName} - Adm ${s.admission_number})`;
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
            head: 'All heads',
            total_students: String(progStudents.length),
            billed: `PKR ${billed.toLocaleString()}`,
            collected: `PKR ${collected.toLocaleString()}`,
            pending: `PKR ${pending.toLocaleString()}`,
            recovery: recoveryPct,
          });
          const byHead = new Map<string, { billed: number; collected: number; pending: number }>();
          for (const inv of progInvoices) {
            if (['cancelled', 'voided', 'rolled_over'].includes(String(inv.status || '').toLowerCase())) continue;
            for (const it of inv.items || []) {
              const name = it.head_name || it.head_code || 'Fee';
              const rec = byHead.get(name) || { billed: 0, collected: 0, pending: 0 };
              rec.billed += Number(it.net_amount || it.original_amount || 0);
              rec.collected += Number(it.paid_amount || 0);
              rec.pending += Number(it.balance_due ?? Math.max(0, Number(it.net_amount || 0) - Number(it.paid_amount || 0)));
              byHead.set(name, rec);
            }
          }
          for (const [head, rec] of byHead) {
            rows.push({
              class_name: `  ${prog.name}`,
              head,
              total_students: '',
              billed: `PKR ${rec.billed.toLocaleString()}`,
              collected: `PKR ${rec.collected.toLocaleString()}`,
              pending: `PKR ${rec.pending.toLocaleString()}`,
              recovery: rec.billed > 0 ? `${((rec.collected / rec.billed) * 100).toFixed(1)}%` : '0%',
            });
          }
        }
        bytes = await buildTabularFeeReportPdfBytes({
          title,
          academy: letterhead,
          landscape: true,
          summaryStrip: [
            { label: 'Total Billed', value: `PKR ${grandBilled.toLocaleString()}` },
            { label: 'Total Collected', value: `PKR ${grandCollected.toLocaleString()}` },
            { label: 'Total Outstanding', value: `PKR ${grandPending.toLocaleString()}` },
            { label: 'Recovery Rate', value: grandBilled > 0 ? `${((grandCollected / grandBilled) * 100).toFixed(1)}%` : '0%' },
          ],
          columns: [
            { key: 'class_name', label: 'Class / Program', width: 150 },
            { key: 'head', label: 'Fee Head', width: 130 },
            { key: 'total_students', label: 'Students', width: 55, align: 'right' },
            { key: 'billed', label: 'Billed', width: 80, align: 'right' },
            { key: 'collected', label: 'Collected', width: 80, align: 'right' },
            { key: 'pending', label: 'Outstanding', width: 85, align: 'right' },
            { key: 'recovery', label: 'Recovery %', width: 62, align: 'right' },
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
        const monthInvoices = invoices.filter(i => (i.billing_month || '').toLowerCase() === (reportMonth || '').toLowerCase());
        const billed = monthInvoices.reduce((s, i) => s + i.net_amount, 0);
        const collected = monthInvoices.reduce((s, i) => s + i.paid_amount, 0);
        const pending = monthInvoices.reduce((s, i) => s + i.balance_amount, 0);
        const rows = monthInvoices.map((inv, i) => ({
          sr: String(i + 1),
          inv_no: inv.invoice_number,
          adm: inv.admission_number || '',
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
            { key: 'adm', label: 'Adm #', width: 44 },
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
            adm: stud?.admission_number || '—',
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
            { key: 'adm', label: 'Adm #', width: 44 },
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
        filename = `Ledger_${stud?.admission_number || 'student'}.pdf`;
        bytes = await buildSimpleStatementPdf({
          title: 'Student Fee Ledger',
          academy: letterhead,
          identity: [
            { label: 'Student', value: stud?.full_name || '—' },
            { label: 'Admission #', value: stud?.admission_number || '—' },
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

  // Open Embedded Cashier Drawer for Invoice (instant 0ms opening, zero jerking)
  const handleOpenCashierDrawer = (inv: StudentInvoice) => {
    setActiveInvoice(inv);
    const amountToPay = inv.balance_amount;
    setCollectionAmount(amountToPay);
    setQuickDiscountAmount(0);
    setShowCounterDiscount(false);
    setCounterDiscounts({});
    setCounterDiscountReason('');
    setPaymentMethod('cash');
    setPaymentReference('');
    setPaymentBankName('');
    setPaymentChequeNumber('');
    setPaymentClearingDate('');
    setIsOverrideActive(false);
    setOverrideReason('');
    setShowDiscountSection(false);
    setShowAllocationBreakdown(false);

    // Immediate default distribution items from invoice items so modal is prefilled instantly
    if (inv.items && inv.items.length > 0) {
      setDistributionItems(
        inv.items.map(it => ({
          fee_head_id: it.fee_head_id,
          head_name: it.head_name,
          allocated_amount: it.balance_due ?? it.net_amount ?? 0,
          due_amount: it.balance_due ?? it.net_amount ?? 0
        }))
      );
    } else {
      setDistributionItems([]);
    }

    // Open drawer synchronously immediately (0ms touch response, NO screen jerk)
    setShowCashierDrawer(true);

    // Fetch backend distribution preview asynchronously in the background
    if (token) {
      fetch('/api/v1/finance/distribute-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: inv.id, amount: amountToPay })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setDistributionItems(data.data);
          }
        })
        .catch(err => {
          console.error('Failed to preview distribution:', err);
        });
    }
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

    let currentItems = distributionItems;
    const currentAllocSum = currentItems.reduce((s, i) => s + Number(i.allocated_amount), 0);
    if (Math.abs(currentAllocSum - numCollectionAmount) > 0.05 && !isOverrideActive) {
      try {
        const previewRes = await fetch('/api/v1/finance/distribute-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ invoice_id: activeInvoice.id, amount: numCollectionAmount }),
        });
        const previewData = await previewRes.json();
        if (previewData.success && Array.isArray(previewData.data)) {
          currentItems = previewData.data;
          setDistributionItems(previewData.data);
        }
      } catch (err) {
        console.error('Failed to sync allocation preview:', err);
      }
    }

    const totalAllocated = currentItems.reduce((s, i) => s + Number(i.allocated_amount), 0);
    if (Math.abs(totalAllocated - numCollectionAmount) > 0.05) {
      alert(`Allocated sum (${totalAllocated} PKR) must match collected amount (${numCollectionAmount} PKR)`);
      return;
    }

    if (isOverrideActive && !overrideReason.trim()) {
      alert('Please provide a mandatory reason explaining the manual allocation override.');
      return;
    }

    // Check counter discount or quick discount mandatory reason
    const activeCounterEntries = showCounterDiscount
      ? Object.entries(counterDiscounts).filter(([_, val]) => Number(val) > 0)
      : [];

    if ((activeCounterEntries.length > 0 || quickDiscountAmount > 0) && !counterDiscountReason.trim()) {
      alert('Please enter a mandatory approval remark / justification for the counter concession / discount.');
      return;
    }

    setIsCommittingPayment(true);
    try {
      let allocationsToSend = distributionItems;
      // 1. Process head-wise counter concessions or quick discount if applied
      if (activeCounterEntries.length > 0) {
        for (const [headId, val] of activeCounterEntries) {
          const discRes = await fetch('/api/v1/finance/discounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({
              student_id: activeInvoice.student_id,
              invoice_id: activeInvoice.id,
              fee_head_id: headId,
              discount_type: 'flat',
              discount_value: Number(val),
              mandatory_reason: counterDiscountReason.trim(),
            }),
          });
          const discData = await discRes.json();
          if (!discRes.ok || !discData.success) {
            throw new Error(discData.error?.message || 'Concession was not applied. Payment was not recorded.');
          }
        }
        const previewRes = await fetch('/api/v1/finance/distribute-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ invoice_id: activeInvoice.id, amount: numCollectionAmount }),
        });
        const previewData = await previewRes.json();
        if (previewData.success && Array.isArray(previewData.data)) {
          allocationsToSend = previewData.data;
          setDistributionItems(previewData.data);
        }
      } else if (quickDiscountAmount > 0) {
        const primaryHeadId = activeInvoice.items[0]?.fee_head_id;
        const discRes = await fetch('/api/v1/finance/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            student_id: activeInvoice.student_id,
            invoice_id: activeInvoice.id,
            fee_head_id: primaryHeadId,
            discount_type: 'flat',
            discount_value: Number(quickDiscountAmount),
            mandatory_reason: counterDiscountReason.trim() || 'Counter fee concession at receiving',
          }),
        });
        const discData = await discRes.json();
        if (!discRes.ok || !discData.success) {
          throw new Error(discData.error?.message || 'Concession was not applied. Payment was not recorded.');
        }
        const previewRes = await fetch('/api/v1/finance/distribute-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ invoice_id: activeInvoice.id, amount: numCollectionAmount }),
        });
        const previewData = await previewRes.json();
        if (previewData.success && Array.isArray(previewData.data)) {
          allocationsToSend = previewData.data;
          setDistributionItems(previewData.data);
        }
      }

      if (paymentMethod === 'cheque' && !paymentChequeNumber.trim()) {
        throw new Error('Cheque number is required.');
      }

      // 2. Commit payment with custom payment_date
      const res = await fetch('/api/v1/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          invoice_id: activeInvoice.id,
          amount_paid: numCollectionAmount,
          payment_method: paymentMethod,
          payment_date: paymentDate,
          reference_number: paymentReference || undefined,
          bank_name: paymentBankName || undefined,
          cheque_number: paymentChequeNumber || undefined,
          clearing_date: paymentClearingDate || undefined,
          is_override: isOverrideActive,
          override_reason: isOverrideActive ? overrideReason : undefined,
          allocations: allocationsToSend
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
      roll_number: inv.roll_number || undefined,
      admission_number: stud?.admission_number || inv.admission_number || '',
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
    const stud = students.find(s => s.id === studentId || (s.admission_number && s.admission_number === payment?.admission_number));
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
      roll_number: payment.roll_number || inv?.roll_number || stud?.roll_number || undefined,
      admission_number: stud?.admission_number || inv?.admission_number || payment.admission_number || '',
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
          const validPayments = data.data.filter((p: any) => p.status !== 'void' && p.status !== 'voided');
          const targetPayment = validPayments[validPayments.length - 1] || data.data[0];
          setActivePaymentReceipt(targetPayment);
          setShowReceiptModal(true);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch genuine payment receipt', err);
    }

    showToast('No payment receipt found for this challan.');
  };

  // Handle Cancel / Void Invoice
  const handleCancelInvoice = async () => {
    if (!token || !cancelInvoiceTarget || !cancelInvoiceReason.trim()) return;
    setCancelSubmitting(true);
    try {
      const res = await fetch(`/api/v1/finance/invoices/${cancelInvoiceTarget.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: cancelInvoiceReason.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Invoice #${cancelInvoiceTarget.invoice_number} successfully cancelled.`);
        setCancelInvoiceTarget(null);
        setCancelInvoiceReason('');
        await fetchData();
      } else {
        alert(data.error?.message || 'Failed to cancel invoice.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error while cancelling invoice.');
    } finally {
      setCancelSubmitting(false);
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

  // In-Place Student / Sibling Concession Modal Opener
  const handleOpenDiscountModalForStudent = (studentId: string, invoiceId?: string, defaultReason?: string) => {
    setDiscountStudentId(studentId);
    if (invoiceId) {
      setDiscountInvoiceId(invoiceId);
    } else {
      const unpaid = invoices.find(i => i.student_id === studentId && i.status !== 'paid' && i.balance_amount > 0);
      if (unpaid) setDiscountInvoiceId(unpaid.id);
      else setDiscountInvoiceId('');
    }
    setDiscountType('flat');
    setDiscountValue('');
    setDiscountReason(defaultReason || 'Sibling Concession');
    setShowDiscountModal(true);
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
    <div className="space-y-2.5 sm:space-y-3">
      {/* Toast Notification */}
      {feedbackNotice && (
        <div
          className={`fixed left-3 right-3 sm:left-auto sm:right-4 top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] z-50 p-3 rounded-xl shadow-xl flex items-center gap-3 border text-xs font-semibold max-w-md animate-in fade-in slide-in-from-top-2 ${
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

      {/* Header & Single Consolidated Icon Menu */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          {activeTab !== 'cashier' && (
            <button
              type="button"
              onClick={() => setActiveTab('cashier')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold mb-1 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Receiving Desk</span>
            </button>
          )}
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
            {activeTab === 'cashier'
              ? 'Fee Ledger & Collections'
              : activeTab === 'defaulters'
              ? 'Fee Defaulters'
              : 'Finance Reports'}
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {activeTab === 'cashier'
              ? 'Student fee invoicing, cashier collection desk, payment allocations, and ledger records.'
              : activeTab === 'defaulters'
              ? 'Track overdue fee receivables, outstanding balance aging, and recovery dispatches.'
              : 'Financial statements, revenue summaries, fee head audits, and running ledgers.'}
          </p>
        </div>

        {/* ONE Icon Place to open all financial desks & configuration tools */}
        <div ref={feeModuleContainerRef} className="relative self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowFeeModuleMenu(prev => !prev)}
            className={`w-8.5 h-8.5 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shadow-2xs ${
              showFeeModuleMenu
                ? 'bg-slate-100 border-slate-300 text-slate-900'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title="Fee Desks & Options"
            aria-label="Fee Desks & Options"
          >
            <MoreHorizontal className="w-4 h-4 text-slate-600" />
          </button>

          {showFeeModuleMenu && (
            <div
              className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-40 divide-y divide-slate-100 text-left animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Financial Desks
              </div>
              <div className="py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('cashier');
                    setShowFeeModuleMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    activeTab === 'cashier' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5 text-slate-500" />
                    <span>Fees Receiving Desk</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('defaulters');
                    setShowFeeModuleMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    activeTab === 'defaulters' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>Fee Defaulters</span>
                  </div>
                  {duesSummary.allCount > 0 && (
                    <span className="font-mono text-[10px] text-rose-600 font-bold">{duesSummary.allCount}</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('reports');
                    setShowFeeModuleMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    activeTab === 'reports' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Finance Reports</span>
                  </div>
                </button>
              </div>

              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Configuration & Tools
              </div>
              <div className="py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowFeeModuleMenu(false);
                    setShowFeeHeadsModal(true);
                  }}
                  className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                  <span>Fee Heads & Priority</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowFeeModuleMenu(false);
                    setShowBulkRevisionModal(true);
                  }}
                  className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                  <span>Bulk Fee Revision</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TAB: FEES RECEIVING (Hero Search, Popup Selector & 3-Section Dossier) */}
      {activeTab === 'cashier' && (
        <div className="space-y-2.5 sm:space-y-3">
          {/* Controls Toolbar: Standalone Search Bar + Single Expand Button for Summary & Filter */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  setShowSearchPopup(true);
                }}
                className="relative flex-1"
              >
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search student by name, Roll #, Phone, CNIC..."
                  aria-label="Search by student name, admission number, phone, or CNIC"
                  value={cashierSearch}
                  onChange={e => {
                    const next = e.target.value;
                    setCashierSearch(next);
                    if (next.trim()) setShowSearchPopup(true);
                    else setShowSearchPopup(false);
                  }}
                  className="w-full pl-8 pr-7 py-2 sm:py-1.5 text-xs bg-slate-50/70 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-amber-600 text-slate-900 transition-colors font-sans"
                />
                {cashierSearch && (
                  <button
                    type="button"
                    onClick={() => setCashierSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* Single Icon-Only Button to Expand Summary & Class Filter */}
              <button
                type="button"
                onClick={() => setShowCashierSummaryAndFilter(prev => !prev)}
                className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 relative ${
                  showCashierSummaryAndFilter || cashierClassFilter !== 'all'
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Toggle Summary & Filter"
                aria-label="Toggle Summary & Filter"
              >
                <SlidersHorizontal className="w-4 h-4 text-slate-600" />
                {cashierClassFilter !== 'all' && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Expandable Section: 4 Summary Cards + Class Filter (Collapsed by default on mobile) */}
            {showCashierSummaryAndFilter && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                {/* 4 Financial Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-medium text-slate-400 block">Total Invoiced</span>
                      <span className="font-mono font-semibold text-slate-800 text-xs sm:text-sm">
                        PKR {duesSummary.totalInvoiced.toLocaleString()}
                      </span>
                    </div>
                    <CreditCard className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-medium text-slate-400 block">Collections</span>
                      <span className="font-mono font-semibold text-emerald-700 text-xs sm:text-sm">
                        PKR {duesSummary.totalCollected.toLocaleString()}
                      </span>
                    </div>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-medium text-slate-400 block">Overdue Receivables</span>
                      <span className="font-mono font-semibold text-rose-600 text-xs sm:text-sm">
                        PKR {duesSummary.allAmount.toLocaleString()}
                      </span>
                    </div>
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-medium text-slate-400 block">Defaulters</span>
                      <span className="font-mono font-semibold text-slate-800 text-xs sm:text-sm">
                        {duesSummary.allCount} Students
                      </span>
                    </div>
                    <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  </div>
                </div>

                {/* Class Filter Row */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-full sm:w-60">
                    <ModernSelect
                      value={cashierClassFilter}
                      onChange={val => setCashierClassFilter(val)}
                      buttonClassName="bg-white border-slate-200 text-xs py-1.5"
                    >
                      <option value="all">All Classes ({programs.length})</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </ModernSelect>
                  </div>
                  {cashierClassFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setCashierClassFilter('all')}
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

          {/* When No Student Selected: Active Dues Register */}
          {!selectedStudent && (
            <div className="space-y-2.5 sm:space-y-3">
              {allUnpaidStudents.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl shadow-2xs py-8 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-7 h-7 mx-auto mb-1.5 text-emerald-500" />
                  <p className="font-semibold text-slate-700">All student fees are fully cleared</p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">Use the search bar above to look up any student dossier or payment history.</p>
                </div>
              ) : (
                <>
                  {/* Mobile High-Density Outstanding Fee Box Cards (< 640px) - 100% Full Width Directly on Page */}
                  <div className="sm:hidden space-y-2.5" data-testid="mobile-unpaid-fee-list">
                    {allUnpaidStudents.slice(0, 30).map(def => {
                      const stud = students.find(s => s.id === def.student_id);
                      const guardianPhone = def.guardian_phone || stud?.guardian_phone || stud?.father_phone || stud?.student_whatsapp || stud?.phone;
                      const targetInvoice = def.latest_invoice || (def.invoices && def.invoices[0]);

                      return (
                        <div
                          key={def.student_id}
                          className="w-full bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 space-y-2.5 transition-all"
                        >
                          {/* Top Row: Avatar + Full Student Name + Admission # + Challan Badge */}
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 font-mono shadow-2xs">
                                {def.student_name?.charAt(0) || 'S'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCashierStudentId(def.student_id);
                                    setLedgerStudentId(def.student_id);
                                    setStudentDeskTab('challans');
                                  }}
                                  className="font-semibold text-sm text-slate-900 leading-snug text-left block hover:text-amber-800 break-words cursor-pointer"
                                >
                                  {def.student_name}
                                </button>
                                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                  Adm #{def.admission_number || '—'}
                                </div>
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-slate-100 text-rose-700 border border-slate-200 shrink-0">
                              {def.overdue_invoices_count || 1} Due
                            </span>
                          </div>

                          {/* Middle Details: Flat divider lines - ZERO nested pink box */}
                          <div className="py-2 border-y border-slate-100 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between gap-2 text-slate-600">
                              <span className="text-slate-400 font-normal">Class:</span>
                              <span className="font-medium text-slate-700 text-right">
                                {def.program_name} {def.batch_name ? `• ${def.batch_name}` : ''}
                              </span>
                            </div>
                            {def.father_name && (
                              <div className="flex items-center justify-between gap-2 text-slate-600">
                                <span className="text-slate-400 font-normal">Guardian:</span>
                                <span className="text-slate-700 text-right">
                                  {def.father_name}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <span className="text-[11px] text-slate-500 font-mono">
                                Cycle: {targetInvoice?.billing_month || 'Current'}
                              </span>
                              <span className="font-mono font-bold text-rose-600 text-sm">
                                PKR {def.total_balance.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Bottom Action Strip: Sleek Icon Buttons for Call & WhatsApp + Receive Fee button */}
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <div className="flex items-center gap-1.5">
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

                              {guardianPhone && targetInvoice && (
                                <button
                                  type="button"
                                  onClick={() => handleDispatchWhatsAppSlip(targetInvoice, guardianPhone)}
                                  className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-emerald-700 hover:text-emerald-800 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                                  title="WhatsApp Reminder Slip"
                                  aria-label="WhatsApp Reminder Slip"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (targetInvoice) {
                                  handleOpenCashierDrawer(targetInvoice);
                                } else {
                                  handleViewStudentInDesk(def.student_id);
                                }
                              }}
                              className="px-3 h-8 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Receive Fee</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Active Dues Table (>= 640px) */}
                  <div className="hidden sm:block bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Students with Outstanding Dues</span>
                        <span className="text-[11px] text-slate-500 font-mono">({allUnpaidStudents.length})</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                          <tr>
                            <th className="py-2 px-3">Student</th>
                            <th className="py-2 px-3">Class & Section</th>
                            <th className="py-2 px-3">Latest Challan #</th>
                            <th className="py-2 px-3">Billing Month</th>
                            <th className="py-2 px-3 text-right">Outstanding Due</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {allUnpaidStudents.slice(0, 30).map(def => (
                            <tr key={def.student_id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2 px-3 font-sans whitespace-nowrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-8 rounded border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 font-mono">
                                    {def.student_name?.charAt(0) || 'S'}
                                  </div>
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCashierStudentId(def.student_id);
                                        setLedgerStudentId(def.student_id);
                                        setStudentDeskTab('challans');
                                      }}
                                      className="font-bold text-slate-900 hover:text-[#0E2A47] transition-colors text-left cursor-pointer"
                                    >
                                      {def.student_name}
                                    </button>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      Adm: #{def.admission_number || '—'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-600 whitespace-nowrap">
                                {def.program_name} {def.batch_name ? `• ${def.batch_name}` : ''}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap font-bold text-slate-800">
                                {def.latest_invoice?.invoice_number || '—'}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-600 whitespace-nowrap">
                                {def.unpaid_months.slice(0, 2).join(', ') || def.latest_invoice?.billing_month || '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                                PKR {def.total_balance.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-right font-sans whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (def.latest_invoice) {
                                      handleOpenCashierDrawer(def.latest_invoice);
                                    } else {
                                      handleViewStudentInDesk(def.student_id);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 active:scale-[0.98] text-white font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Receive Fee</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Student Fee Dossier (When student selected) */}
          {selectedStudent && (() => {
            const studInvoices = invoices.filter(i => i.student_id === selectedStudent.id && i.status !== 'cancelled' && i.status !== 'voided');
            const unpaidInvoices = studInvoices.filter(i => i.status !== 'paid' && i.balance_amount > 0);
            const totalDue = unpaidInvoices.reduce((s, inv) => s + inv.balance_amount, 0);
            const totalPaid = studInvoices.reduce((s, inv) => s + (inv.paid_amount || 0), 0);
            const siblings = getStudentSiblings(selectedStudent);
            const studentPayments = payments.filter(p => p.student_id === selectedStudent.id && (p as any).status !== 'voided' && (p as any).status !== 'cancelled');
            const activeLedgerEntries = studentLedger.filter(e => {
              const desc = (e.description || '').toUpperCase();
              return !desc.includes('[CANCELLED]') && !desc.includes('[VOID') && !desc.includes('VOIDED');
            });

            return (
              <div className="space-y-4">
                {/* 1. Student Particulars & Account Balance Header */}
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
                  {/* Top Bar: Avatar + Full Name + Adm # + Class + Clear Button */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-base shrink-0 uppercase font-mono shadow-2xs">
                        {selectedStudent.full_name?.charAt(0) || 'S'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900 leading-snug">
                            {selectedStudent.full_name}
                          </h3>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-bold border border-slate-200">
                            Adm #{selectedStudent.admission_number || '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold text-[11px]">
                            {getProgramName(selectedStudent.program_id) || 'Academic Class'}
                            {batches.find(b => b.id === selectedStudent.batch_id)?.name ? ` • ${batches.find(b => b.id === selectedStudent.batch_id)?.name}` : ''}
                          </span>
                          {((selectedStudent as any).fee_structure?.concession_category || (selectedStudent as any).concession_category) && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                              {((selectedStudent as any).fee_structure?.concession_category || (selectedStudent as any).concession_category).toUpperCase()} CONCESSION
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCashierStudentId(null);
                        setCashierSearch('');
                        setStudentDeskTab('challans');
                      }}
                      className="min-h-[36px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                      title="Clear student selection"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  </div>

                  {/* Middle: Guardian & Contact Details */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <span>Father / Guardian: <strong className="text-slate-800 font-medium">{selectedStudent.father_name || selectedStudent.guardian_name || '—'}</strong></span>
                    {(selectedStudent.guardian_phone || selectedStudent.phone) && (
                      <span>• Phone: <strong className="text-slate-800 font-mono font-medium">{selectedStudent.guardian_phone || selectedStudent.phone}</strong></span>
                    )}
                    {selectedStudent.guardian_id_card && (
                      <span>• CNIC: <strong className="text-slate-800 font-mono font-medium">{selectedStudent.guardian_id_card}</strong></span>
                    )}
                  </div>

                  {/* Bottom: 2-Card Financial Summary Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className={`p-2.5 rounded-xl border ${totalDue > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-emerald-50/70 border-emerald-200'}`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block leading-tight">
                        Outstanding Due
                      </span>
                      <div className={`text-base sm:text-lg font-bold font-mono mt-0.5 ${totalDue > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {totalDue > 0 ? `PKR ${totalDue.toLocaleString()}` : 'Cleared'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block leading-tight">
                        Total Realized
                      </span>
                      <div className="text-base sm:text-lg font-bold font-mono mt-0.5 text-emerald-700">
                        PKR {totalPaid.toLocaleString()}
                      </div>
                    </div>

                    <div className="hidden sm:block p-2.5 rounded-xl border bg-slate-50 border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block leading-tight">
                        Challan Status
                      </span>
                      <div className="text-xs font-semibold text-slate-700 mt-1">
                        {unpaidInvoices.length > 0 ? `${unpaidInvoices.length} Overdue / Pending` : 'All Fees Cleared'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Sub-Navigation Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 gap-2 pb-1 sm:pb-0">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setStudentDeskTab('challans')}
                      className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        studentDeskTab === 'challans'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span className="sm:hidden">Challans</span>
                      <span className="hidden sm:inline">Fee Challans</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        unpaidInvoices.length > 0
                          ? 'bg-rose-100 text-rose-800 font-bold'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {studInvoices.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStudentDeskTab('history')}
                      className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        studentDeskTab === 'history'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span className="sm:hidden">Ledger</span>
                      <span className="hidden sm:inline">Payment History & Ledger</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                        {studentPayments.length}
                      </span>
                    </button>

                    {siblings.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setStudentDeskTab('siblings')}
                        className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          studentDeskTab === 'siblings'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                        <span className="sm:hidden">Siblings</span>
                        <span className="hidden sm:inline">Family Siblings</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-purple-100 text-purple-800 font-bold">
                          {siblings.length + 1}
                        </span>
                      </button>
                    )}
                  </div>

                  {siblings.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenFamilyModal(selectedStudent)}
                      className="hidden sm:flex px-2.5 py-1.5 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md transition-colors items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>1-Click Sibling Fee Collection</span>
                    </button>
                  )}
                </div>

                {/* TAB 1: FEE CHALLANS */}
                {studentDeskTab === 'challans' && (
                  <div>
                    {studInvoices.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs shadow-2xs">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                        <p className="font-semibold text-slate-700">No active fee challans found for this student.</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Monthly challans can be generated from the{' '}
                          <button
                            type="button"
                            className="font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
                            onClick={() => { window.location.hash = '#challans'; }}
                          >
                            Fee Challans
                          </button>{' '}
                          section.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Mobile: Challan Box Cards (< 640px) - 100% Full Width Directly on Page */}
                        <div className="sm:hidden space-y-2.5">
                          {studInvoices.map(inv => {
                            const isPaid = inv.status === 'paid' || inv.balance_amount <= 0;
                            const guardianPhone = selectedStudent?.guardian_phone || selectedStudent?.phone;
                            return (
                              <div
                                key={inv.id}
                                className={`w-full rounded-xl border shadow-2xs p-3.5 space-y-2.5 transition-all ${
                                  isPaid ? 'bg-slate-50/60 border-slate-200' : 'bg-white border-slate-200'
                                }`}
                              >
                                {/* Header: Challan # + Billing Month + Status Pill */}
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-mono font-bold text-sm text-slate-900">
                                      {inv.invoice_number}
                                    </div>
                                    <div className="text-xs text-slate-600 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                      <span>{inv.billing_month}</span>
                                      {inv.installment_number && (
                                        <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px]">
                                          Inst. {inv.installment_number}{inv.total_installments ? `/${inv.total_installments}` : ''}
                                        </span>
                                      )}
                                      <span className="text-slate-400">•</span>
                                      <span className="text-slate-500 font-mono text-[11px]">Due: {inv.due_date}</span>
                                    </div>
                                  </div>

                                  <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold uppercase shrink-0 ${
                                    inv.status === 'paid'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : inv.status === 'partially_paid'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                                  }`}>
                                    {inv.status?.replace('_', ' ')}
                                  </span>
                                </div>

                                {/* Fee Heads Breakdown Chips */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                  {inv.items.map((item, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded-md border border-slate-200 text-[10.5px] font-mono">
                                      <span className="text-slate-500">{item.head_name}:</span>
                                      <strong className="text-slate-800 font-semibold">PKR {Number(item.net_amount ?? item.original_amount ?? 0).toLocaleString()}</strong>
                                    </span>
                                  ))}
                                  {(inv.arrears_amount || 0) > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded-md border border-amber-200 text-[10.5px] font-mono text-amber-800">
                                      <span>Arrears:</span>
                                      <strong>PKR {Number(inv.arrears_amount || 0).toLocaleString()}</strong>
                                    </span>
                                  )}
                                </div>

                                {/* Financial Summary Strip */}
                                <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-center font-mono">
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Net Due</span>
                                    <span className="text-xs font-bold text-slate-700">
                                      PKR {inv.net_amount.toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Paid</span>
                                    <span className="text-xs font-bold text-emerald-700">
                                      PKR {(inv.paid_amount || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Balance</span>
                                    <span className={`text-xs font-bold ${inv.balance_amount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      PKR {inv.balance_amount.toLocaleString()}
                                    </span>
                                  </div>
                                </div>

                                {/* Action Buttons Row: Sleek Icons on Left, Receive Fee on Right */}
                                <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveInvoice(inv);
                                        setShowPrintModal(true);
                                      }}
                                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                                      title="Print fee challan"
                                      aria-label="Print"
                                    >
                                      <Printer className="w-4 h-4" />
                                    </button>

                                    {inv.balance_amount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleDispatchWhatsAppSlip(inv, guardianPhone)}
                                        className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center transition-colors cursor-pointer"
                                        title="WhatsApp fee slip"
                                        aria-label="WhatsApp"
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                      </button>
                                    )}

                                    {inv.paid_amount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleViewReceiptFromInvoice(inv)}
                                        className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center transition-colors cursor-pointer"
                                        title="View receipt"
                                        aria-label="Receipt"
                                      >
                                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handlePreviewSlipPicture(inv)}
                                      className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                                      title="Preview slip picture"
                                      aria-label="Preview"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {inv.balance_amount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCashierDrawer(inv)}
                                      className="px-3 h-8 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                                    >
                                      <CreditCard className="w-3.5 h-3.5" />
                                      <span>Receive Fee</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Desktop Table (>= 640px) */}
                        <div className="hidden sm:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase font-mono tracking-wider">
                              <tr>
                                <th className="py-2.5 px-3">Challan #</th>
                                <th className="py-2.5 px-3">Month</th>
                                <th className="py-2.5 px-3">Fee Heads Breakdown</th>
                                <th className="py-2.5 px-3">Due Date</th>
                                <th className="py-2.5 px-3 text-right">Net Payable</th>
                                <th className="py-2.5 px-3 text-right">Paid</th>
                                <th className="py-2.5 px-3 text-right">Balance Due</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                                <th className="py-2.5 px-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                              {studInvoices.map(inv => {
                                const isPaid = inv.status === 'paid' || inv.balance_amount <= 0;
                                return (
                                  <tr key={inv.id} className={isPaid ? 'bg-slate-50/40 hover:bg-slate-50' : 'hover:bg-slate-50'}>
                                    <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                                      {inv.invoice_number}
                                    </td>
                                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5">
                                        <span>{inv.billing_month}</span>
                                        {inv.installment_number && (
                                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px]">
                                            Installment {inv.installment_number}{inv.total_installments ? ` of ${inv.total_installments}` : ''}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 font-sans text-slate-600 text-[11px]">
                                      <div className="flex flex-wrap items-center gap-1.5 max-w-sm">
                                        {inv.items.map((item, i) => (
                                          <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px] font-mono whitespace-nowrap">
                                            <span className="text-slate-500">{item.head_name}:</span>
                                            <strong className="text-slate-800">PKR {Number(item.net_amount ?? item.original_amount ?? 0).toLocaleString()}</strong>
                                          </span>
                                        ))}
                                        {(inv.arrears_amount || 0) > 0 && (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 rounded border border-amber-200 text-[10px] font-mono text-amber-800 whitespace-nowrap">
                                            <span>Arrears:</span>
                                            <strong>{Number(inv.arrears_amount || 0).toLocaleString()}</strong>
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                      {inv.due_date}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                      PKR {inv.net_amount.toLocaleString()}
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold whitespace-nowrap">
                                      PKR {(inv.paid_amount || 0).toLocaleString()}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                                      <span className={inv.balance_amount > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                        PKR {inv.balance_amount.toLocaleString()}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                        inv.status === 'paid'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : inv.status === 'partially_paid'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {inv.status?.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-sans whitespace-nowrap">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {inv.balance_amount > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => handleOpenCashierDrawer(inv)}
                                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
                                            title="Receive fee payment"
                                          >
                                            <CreditCard className="w-3.5 h-3.5" />
                                            <span>Receive Fee</span>
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveInvoice(inv);
                                            setShowPrintModal(true);
                                          }}
                                          className="px-2 py-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 text-xs font-medium rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                                          title="Print fee challan"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                          <span>Print</span>
                                        </button>
                                        {inv.balance_amount > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => handleDispatchWhatsAppSlip(inv)}
                                            className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs rounded-md transition-colors border border-emerald-200 flex items-center gap-1 cursor-pointer"
                                            title="Send WhatsApp fee slip"
                                          >
                                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>WA</span>
                                          </button>
                                        )}
                                        {inv.paid_amount > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => handleViewReceiptFromInvoice(inv)}
                                            className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs rounded-md transition-colors border border-emerald-200 flex items-center gap-1 cursor-pointer"
                                            title="View payment receipt"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Receipt</span>
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handlePreviewSlipPicture(inv)}
                                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors cursor-pointer"
                                          title="Preview fee slip picture"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                  </div>
                )}

                {/* TAB 2: PAYMENT HISTORY & FEE LEDGER */}
                {studentDeskTab === 'history' && (
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-4 shadow-2xs space-y-4">
                    {/* Header & Sub-Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Payment History & Fee Ledger</h4>
                        <p className="text-xs text-slate-500">
                          {historyViewMode === 'receipts'
                            ? 'Cleared payment receipts recorded for this student'
                            : 'Chronological double-entry statement showing fee charges (debits), payments (credits), and balance'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setHistoryViewMode('receipts')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                            historyViewMode === 'receipts'
                              ? 'bg-white text-indigo-700 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Payment Receipts ({studentPayments.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryViewMode('ledger')}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                            historyViewMode === 'ledger'
                              ? 'bg-white text-indigo-700 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Fee Ledger Statement ({activeLedgerEntries.length})
                        </button>
                      </div>
                    </div>

                    {/* Sub-View A: Payment Receipts */}
                    {historyViewMode === 'receipts' && (
                      studentPayments.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          No cleared payment receipts recorded for this student yet.
                        </div>
                      ) : (
                        <>
                          {/* Mobile Receipt Cards (< 640px) */}
                          <div className="sm:hidden space-y-2.5">
                            {studentPayments.map(pay => {
                              const linkedInv = invoices.find(i => i.id === pay.invoice_id);
                              const allocSummary = (pay.allocations || [])
                                .map(a => `${a.head_name}: PKR ${a.allocated_amount.toLocaleString()}`)
                                .join(', ') || 'General Allocation';

                              return (
                                <div key={pay.id} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-2xs">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="font-mono font-bold text-xs text-slate-900">{pay.receipt_number}</div>
                                      <div className="text-[11px] text-slate-500 mt-0.5">{pay.payment_date} • {linkedInv?.billing_month || 'Current'}</div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                                      Cleared
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-600">
                                    <span>Method: <strong className="capitalize text-slate-800">{pay.payment_method?.replace('_', ' ')}</strong></span>
                                    {(pay.reference_number || pay.bank_name) && (
                                      <span className="ml-2 font-mono text-[11px] text-slate-500">({pay.reference_number || pay.bank_name})</span>
                                    )}
                                  </div>
                                  <div className="bg-slate-50 rounded-lg p-2 flex items-center justify-between text-xs">
                                    <span className="text-[11px] text-slate-500 font-medium">Amount Paid</span>
                                    <span className="font-mono font-bold text-emerald-700 text-sm">PKR {pay.amount_paid.toLocaleString()}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono truncate" title={allocSummary}>
                                    Alloc: {allocSummary}
                                  </div>
                                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActivePaymentReceipt(pay);
                                        if (linkedInv) setActiveInvoice(linkedInv);
                                        setShowReceiptModal(true);
                                      }}
                                      className="flex-1 min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                      <span>Print Receipt</span>
                                    </button>
                                    {pay.receipt_number && (
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadReceiptPicture(pay, linkedInv)}
                                        className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                        title="Download receipt image"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Image</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Desktop Table (>= 640px) */}
                          <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-700">
                              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase font-mono">
                                <tr>
                                  <th className="py-2.5 px-3">Receipt #</th>
                                  <th className="py-2.5 px-3">Date</th>
                                  <th className="py-2.5 px-3">Month</th>
                                  <th className="py-2.5 px-3">Method</th>
                                  <th className="py-2.5 px-3">Reference / Bank</th>
                                  <th className="py-2.5 px-3 text-right">Amount Submitted</th>
                                  <th className="py-2.5 px-3">Head Allocation Breakdown</th>
                                  <th className="py-2.5 px-3 text-right">Balance Left</th>
                                  <th className="py-2.5 px-3 text-center">Status</th>
                                  <th className="py-2.5 px-3 text-right">Receipt</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                {studentPayments.map(pay => {
                                  const linkedInv = invoices.find(i => i.id === pay.invoice_id);
                                  const allocSummary = (pay.allocations || [])
                                    .map(a => `${a.head_name}: ${a.allocated_amount.toLocaleString()}`)
                                    .join(', ') || 'General Allocation';

                                  return (
                                    <tr key={pay.id} className="hover:bg-slate-50">
                                      <td className="py-2.5 px-3 font-bold text-slate-900">
                                        {pay.receipt_number}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-600 font-sans">
                                        {pay.payment_date}
                                      </td>
                                      <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                                        {linkedInv?.billing_month || '—'}
                                      </td>
                                      <td className="py-2.5 px-3 capitalize font-sans">
                                        {pay.payment_method?.replace('_', ' ')}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-500 font-sans text-[11px] truncate max-w-[120px]">
                                        {pay.reference_number || pay.bank_name || '—'}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                                        PKR {pay.amount_paid.toLocaleString()}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-600 font-sans text-[10px] max-w-[200px] truncate" title={allocSummary}>
                                        {allocSummary}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-700">
                                        {linkedInv ? `PKR ${linkedInv.balance_amount.toLocaleString()}` : '—'}
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-sans">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                                          Cleared
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-sans">
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActivePaymentReceipt(pay);
                                              if (linkedInv) setActiveInvoice(linkedInv);
                                              setShowReceiptModal(true);
                                            }}
                                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition-colors flex items-center gap-1 cursor-pointer"
                                            title="View official payment receipt"
                                          >
                                            <Printer className="w-3 h-3" />
                                            <span>Receipt</span>
                                          </button>
                                          {pay.receipt_number && (
                                            <button
                                              type="button"
                                              onClick={() => handleDownloadReceiptPicture(pay, linkedInv)}
                                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors cursor-pointer"
                                              title="Download receipt image"
                                            >
                                              <Download className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )
                    )}

                    {/* Sub-View B: Fee Ledger Statement */}
                    {historyViewMode === 'ledger' && (
                      activeLedgerEntries.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          No active ledger entries recorded for this student yet.
                        </div>
                      ) : (
                        <>
                          {/* Mobile Ledger Cards (< 640px) */}
                          <div className="sm:hidden space-y-2">
                            {activeLedgerEntries.map((entry, idx) => (
                              <div key={entry.id || idx} className="bg-white rounded-xl border border-slate-200 p-2.5 space-y-1.5 shadow-2xs text-xs">
                                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                  <span className="font-mono">{entry.date}</span>
                                  <span className="font-mono font-bold text-slate-800">Bal: PKR {entry.running_balance.toLocaleString()}</span>
                                </div>
                                <p className="font-medium text-slate-800">{entry.description}</p>
                                <div className="flex items-center justify-between pt-1 border-t border-slate-100 font-mono text-[11px]">
                                  {entry.debit > 0 ? (
                                    <span className="font-bold text-rose-700">Debit: +PKR {entry.debit.toLocaleString()}</span>
                                  ) : <span />}
                                  {entry.credit > 0 ? (
                                    <span className="font-bold text-emerald-700">Credit: -PKR {entry.credit.toLocaleString()}</span>
                                  ) : <span />}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop Table (>= 640px) */}
                          <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-700">
                              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase font-mono">
                                <tr>
                                  <th className="py-2.5 px-3">Date</th>
                                  <th className="py-2.5 px-3">Description / Transaction</th>
                                  <th className="py-2.5 px-3 text-right">Debit (PKR)</th>
                                  <th className="py-2.5 px-3 text-right">Credit (PKR)</th>
                                  <th className="py-2.5 px-3 text-right">Running Balance (PKR)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                {activeLedgerEntries.map((entry, idx) => (
                                  <tr key={entry.id || idx} className="hover:bg-slate-50">
                                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{entry.date}</td>
                                    <td className="py-2.5 px-3 font-sans text-slate-800">{entry.description}</td>
                                    <td className="py-2.5 px-3 text-right font-bold text-rose-700 whitespace-nowrap">
                                      {entry.debit > 0 ? entry.debit.toLocaleString() : '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                                      {entry.credit > 0 ? entry.credit.toLocaleString() : '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                      {entry.running_balance.toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )
                    )}
                  </div>
                )}

                {/* TAB 3: FAMILY SIBLINGS */}
                {studentDeskTab === 'siblings' && (
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-4 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-600" />
                          <span>Family Siblings Roster</span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Guardian: <strong className="text-slate-800">{selectedStudent.father_name || selectedStudent.guardian_name || '—'}</strong>
                          {(selectedStudent.guardian_phone || selectedStudent.phone) && ` • Phone: ${selectedStudent.guardian_phone || selectedStudent.phone}`}
                          {selectedStudent.guardian_id_card && ` • CNIC: ${selectedStudent.guardian_id_card}`}
                        </p>
                      </div>

                      {siblings.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenFamilyModal(selectedStudent)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>1-Click Receive All Sibling Fees</span>
                        </button>
                      )}
                    </div>

                    {siblings.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-700">No siblings detected for this student.</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Siblings are automatically recognized when students share the same Father/Guardian phone number or CNIC.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {siblings.map(sib => {
                          const sibInvoices = invoices.filter(i => i.student_id === sib.id && i.status !== 'cancelled' && i.status !== 'voided');
                          const sibUnpaid = sibInvoices.filter(i => i.status !== 'paid' && i.balance_amount > 0);
                          const sibDue = sibUnpaid.reduce((s, i) => s + i.balance_amount, 0);
                          const sibBatch = batches.find(b => b.id === sib.batch_id);

                          return (
                            <div key={sib.id} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h5 className="font-bold text-slate-900 text-xs">{sib.full_name}</h5>
                                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    Adm #{sib.admission_number || '—'} • {getProgramName(sib.program_id)} {sibBatch?.name ? `(${sibBatch.name})` : ''}
                                  </p>
                                </div>
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                  sibDue > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {sibDue > 0 ? `PKR ${sibDue.toLocaleString()} Due` : 'Cleared'}
                                </span>
                              </div>

                              {/* Sibling Available Heads Preview */}
                              {sibUnpaid.length > 0 && (
                                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200 text-[11px]">
                                  <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block">Outstanding Fee Heads</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {sibUnpaid.flatMap(inv => inv.items || []).map((it, idx) => (
                                      <span key={idx} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono">
                                        {it.head_name}: <strong>PKR {it.balance_due.toLocaleString()}</strong>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => handleOpenFamilyModal(sib)}
                                  className="flex-1 py-1.5 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Receive Fees</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenDiscountModalForStudent(sib.id, undefined, 'Sibling Concession')}
                                  className="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Grant approved sibling concession"
                                >
                                  <Percent className="w-3 h-3" />
                                  <span>Concession</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCashierStudentId(sib.id);
                                    setLedgerStudentId(sib.id);
                                    setStudentDeskTab('challans');
                                  }}
                                  className="py-1.5 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Open Dossier</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 2: DEFAULTERS LIST (Overdue Accounts & Follow-ups) */}
      {activeTab === 'defaulters' && (
        <div className="space-y-3">
          {/* Controls Toolbar: Standalone Search Bar + Single Expand Button for Overview & Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search defaulters by name, admission #..."
                  aria-label="Search defaulters by name or admission number"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 sm:py-1.5 text-xs bg-slate-50/70 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-amber-600 text-slate-900 transition-colors font-sans"
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

              {/* Single Icon-Only Button to Expand All Overview & Filters */}
              <button
                type="button"
                onClick={() => setShowDefaulterSummaryAndFilter(prev => !prev)}
                className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 relative ${
                  showDefaulterSummaryAndFilter || activeDefaulterFilterCount > 0 || duesView !== 'all'
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Toggle Overview & Filters"
                aria-label="Toggle Overview & Filters"
              >
                <SlidersHorizontal className="w-4 h-4 text-slate-600" />
                {(activeDefaulterFilterCount > 0 || duesView !== 'all') && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {activeDefaulterFilterCount + (duesView !== 'all' ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>

            {/* Expandable Section: Overview Metrics, Dues View Tabs & Dropdown Filters (Collapsed by default on mobile) */}
            {showDefaulterSummaryAndFilter && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                {/* Summary Metrics & PDF Export */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-medium text-slate-400">Filtered:</span>
                      <span className="font-mono font-semibold text-slate-800 text-xs">{totalDefaultersCount} Students</span>
                    </div>
                    <div className="bg-rose-50 border border-rose-200/80 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-medium text-rose-500">Total Dues:</span>
                      <span className="font-mono font-semibold text-rose-700 text-xs">PKR {totalDefaultersAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenReportPdf('defaulters')}
                    disabled={isGeneratingPdf || defaultersList.length === 0}
                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                    title="Generate printable PDF of currently filtered defaulters"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isGeneratingPdf ? 'Rendering PDF...' : 'Export Defaulters PDF'}</span>
                  </button>
                </div>

                {/* Dues View Segmented Tabs */}
                <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium shrink-0 self-start">
                  <button
                    type="button"
                    onClick={() => setDuesView('all')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      duesView === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>All Outstanding</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200/80 text-slate-700">{duesSummary.allCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuesView('overdue')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      duesView === 'overdue'
                        ? 'bg-white text-rose-700 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    <span>Overdue</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-100 text-rose-700">{duesSummary.overdueCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuesView('current')}
                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      duesView === 'current'
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Current Month</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200/80 text-slate-700">{duesSummary.currentCount}</span>
                  </button>
                </div>

                {/* Dropdown Filters: Class, Overdue Period, Fee Head */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="w-full sm:w-48">
                    <ModernSelect
                      value={selectedBatch}
                      onChange={val => setSelectedBatch(val)}
                      buttonClassName="bg-slate-50 border-slate-200 text-xs py-1.5"
                    >
                      <option value="all">All Classes</option>
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>
                          {getProgramName(b.program_id) ? `${getProgramName(b.program_id)} • ` : ''}{b.name}
                        </option>
                      ))}
                    </ModernSelect>
                  </div>

                  <div className="w-full sm:w-36">
                    <ModernSelect
                      value={unpaidMonthsFilter}
                      onChange={val => setUnpaidMonthsFilter(val as any)}
                      buttonClassName="bg-slate-50 border-slate-200 text-xs py-1.5"
                    >
                      <option value="any">All Periods</option>
                      <option value="1">1 Month</option>
                      <option value="2">2 Months</option>
                      <option value="3+">3+ Months</option>
                    </ModernSelect>
                  </div>

                  <div className="w-full sm:w-40">
                    <ModernSelect
                      value={selectedDefaulterHead}
                      onChange={val => setSelectedDefaulterHead(val)}
                      buttonClassName="bg-slate-50 border-slate-200 text-xs py-1.5"
                    >
                      <option value="all">All Fee Heads</option>
                      {feeHeads.filter(h => h.code !== 'ARREARS').map(h => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </ModernSelect>
                  </div>

                  {(selectedBatch !== 'all' || unpaidMonthsFilter !== 'any' || selectedDefaulterHead !== 'all' || duesView !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBatch('all');
                        setUnpaidMonthsFilter('any');
                        setSelectedDefaulterHead('all');
                        setDuesView('all');
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

          {/* Defaulters Table & List Container */}
          {/* Mobile Native Defaulter Cards (< 640px) - 100% Full Width Directly on Page */}
          {defaultersList.length > 0 && (
            <div className="sm:hidden space-y-2.5" data-testid="mobile-defaulters-list">
              {defaultersList.map(def => {
                const stud = students.find(s => s.id === def.student_id);
                const guardianPhone = def.guardian_phone || stud?.guardian_phone || stud?.father_phone || stud?.student_whatsapp || stud?.phone;
                const targetInvoice = def.latest_invoice || (def.invoices && def.invoices[0]);

                return (
                  <div
                    key={def.student_id}
                    data-testid="defaulter-roster-cell"
                    className="w-full bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 space-y-2.5 transition-all"
                  >
                      {/* Top Row: Avatar + Full Student Name + Admission # + Challan Count Badge */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            onClick={() => setSelectedDefaulterModal(def)}
                            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold text-slate-700 text-xs shrink-0 font-mono shadow-2xs cursor-pointer touch-press"
                            title="View Defaulter Dossier"
                          >
                            {def.student_name?.charAt(0) || 'S'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => setSelectedDefaulterModal(def)}
                              className="font-semibold text-sm text-slate-800 leading-snug text-left block hover:text-amber-700 break-words cursor-pointer"
                            >
                              {def.student_name}
                            </button>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              Adm #{def.admission_number || '—'}
                            </div>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium font-mono bg-slate-100 text-rose-700 border border-slate-200 shrink-0">
                          {def.overdue_invoices_count} Challan{def.overdue_invoices_count > 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Middle Details: Flat single surface - ZERO nested inner card */}
                      <div className="text-xs text-slate-600 space-y-1 pt-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-slate-400 font-normal">Class:</span>
                          <span className="font-medium text-slate-700 text-right">
                            {def.program_name} {def.batch_name ? `• ${def.batch_name}` : ''}
                          </span>
                        </div>
                        {def.father_name && (
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-slate-400 font-normal">Guardian:</span>
                            <span className="text-slate-700 text-right">
                              {def.father_name}
                            </span>
                          </div>
                        )}
                        <div className="flex items-baseline justify-between gap-2 pt-0.5">
                          <span className="text-[11px] text-slate-400 font-normal">
                            {def.max_overdue_days > 0 ? `${def.max_overdue_days}d overdue` : 'Current billing cycle'}
                          </span>
                          <span className="font-mono font-semibold text-rose-600 text-sm">
                            PKR {def.total_balance.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Action Strip: Sleek Icon Buttons + Compact Receive Button */}
                      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                        {guardianPhone ? (
                          <a
                            href={`tel:${guardianPhone}`}
                            className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                            title="Call Guardian"
                            aria-label="Call Guardian"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        ) : null}

                        {guardianPhone && targetInvoice ? (
                          <button
                            type="button"
                            onClick={() => handleDispatchWhatsAppSlip(targetInvoice, guardianPhone)}
                            className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-emerald-700 hover:text-emerald-800 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                            title="WhatsApp Fee Slip"
                            aria-label="WhatsApp Fee Slip"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => setSelectedDefaulterModal(def)}
                          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-500 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                          title="Defaulter Dossier"
                          aria-label="Defaulter Dossier"
                        >
                          <User className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (targetInvoice) {
                              handleOpenCashierDrawer(targetInvoice);
                            } else {
                              handleViewStudentInDesk(def.student_id);
                            }
                          }}
                          className="h-8 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Receive</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {/* Defaulters Desktop Table (>= 640px) */}
          <div className="hidden sm:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3.5">S#</th>
                    <th className="py-2.5 px-3.5">Adm #</th>
                    <th className="py-2.5 px-3.5">Student Name</th>
                    <th className="py-2.5 px-3.5">Class & Section</th>
                    <th className="py-2.5 px-3.5">Father / Guardian</th>
                    <th className="py-2.5 px-3.5">Phone</th>
                    <th className="py-2.5 px-3.5">Unpaid Challans</th>
                    <th className="py-2.5 px-3.5 text-right">Outstanding (PKR)</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {defaultersList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        <div className="max-w-sm mx-auto text-center space-y-1.5">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
                          <p className="text-sm font-bold text-slate-800">
                            {duesView === 'overdue'
                              ? 'No Overdue Defaulters'
                              : duesView === 'current'
                              ? 'No Current Month Unpaid Dues'
                              : 'No Outstanding Fee Dues Found'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {searchQuery || selectedBatch !== 'all' || unpaidMonthsFilter !== 'any' || selectedDefaulterHead !== 'all'
                              ? 'No records match the selected filter criteria. Click "Clear Filters" to view all records.'
                              : 'All active student fee challans are cleared.'}
                          </p>
                        </div>
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
                            <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                              <button
                                type="button"
                                onClick={() => handleViewStudentInDesk(def.student_id)}
                                className="text-left text-slate-900 hover:text-indigo-600 transition-colors underline-offset-2 hover:underline font-mono font-bold cursor-pointer"
                                title="Open Student Profile in Fees Desk"
                              >
                                {def.admission_number || '—'}
                              </button>
                            </td>
                            <td className="py-3 px-3.5 font-bold text-slate-900">
                              <button
                                type="button"
                                onClick={() => handleViewStudentInDesk(def.student_id)}
                                className="text-left text-slate-900 hover:text-indigo-600 transition-colors underline-offset-2 hover:underline font-bold cursor-pointer"
                                title="Open Student Profile in Fees Desk"
                              >
                                {def.student_name}
                              </button>
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="font-semibold text-slate-900 block">{def.program_name}</span>
                              <span className="text-[11px] text-slate-500 font-mono">{def.batch_name}</span>
                            </td>
                            <td className="py-3 px-3.5 text-slate-700">{def.father_name}</td>
                            <td className="py-3 px-3.5 font-mono text-slate-600">{def.guardian_phone || '—'}</td>
                            <td className="py-3 px-3.5 font-mono">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDefaulterModal(def)}
                                  className="text-left font-semibold text-slate-900 hover:text-indigo-600 underline-offset-2 hover:underline cursor-pointer inline-flex items-center gap-1"
                                  title="Click to view detailed dues breakdown"
                                >
                                  <span>{def.overdue_invoices_count} Challan{def.overdue_invoices_count > 1 ? 's' : ''}</span>
                                </button>
                                {(() => {
                                  const instInvs = def.invoices.filter((i: any) => i.installment_number);
                                  if (instInvs.length === 0) return null;
                                  const latest = instInvs.reduce((max: any, cur: any) => ((cur.installment_number || 0) > (max.installment_number || 0) ? cur : max), instInvs[0]);
                                  return (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-sans font-bold">
                                      Installment {latest.installment_number}{latest.total_installments ? ` of ${latest.total_installments}` : ''}
                                    </span>
                                  );
                                })()}
                                {def.max_overdue_days > 0 ? (
                                  <span className="px-1.5 py-0.2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-mono font-bold">
                                    {def.max_overdue_days}d overdue
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-mono font-bold">
                                    Due cycle
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 truncate max-w-[180px] mt-0.5">
                                {def.unpaid_months.join(', ')}
                              </p>
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-rose-600 text-sm">
                              PKR {def.total_balance.toLocaleString()}
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDefaulterModal(def)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded border border-slate-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  title="View Itemized Pending Dues Breakdown"
                                >
                                  <Eye className="w-3 h-3 text-slate-600" />
                                  <span>Details</span>
                                </button>
                                {siblings.length > 0 && stud && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenFamilyModal(stud)}
                                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold rounded border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                                    title={`Settle all ${siblings.length + 1} family members`}
                                  >
                                    <Users className="w-3 h-3 text-indigo-600" />
                                    <span>Family ({siblings.length + 1})</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDispatchWhatsAppSlip(def.latest_invoice, def.guardian_phone)}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px] rounded border border-emerald-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  title="Send Fee Slip via WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3 text-emerald-600" />
                                  <span>Slip</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCashierDrawer(def.latest_invoice)}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-[11px] rounded transition-colors inline-flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="Open Cashier to Receive Fee"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  <span>Receive</span>
                                </button>
                              </div>
                            </td>
                          </tr>
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

      {/* TAB: REPORTS HUB (Sleek Slip Rectangle Cards with Direct In-Portal PDF Viewer) */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-slate-700" />
                <span>Reports</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Print overdue, cashbook, class, and concession lists.
              </p>
            </div>
            {isGeneratingPdf && (
              <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1.5 self-start sm:self-auto bg-indigo-50 px-3 py-1.5 rounded-xl">
                <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                Rendering PDF document...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* 1. Fee Defaulters Register */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2">
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
                <p className="text-xs text-slate-500">Students past due date.</p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('defaulters')}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Defaulters PDF</span>
              </button>
            </div>

            {/* 2. Family & Sibling Record */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2">
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
                <p className="text-xs text-slate-500">Siblings grouped by CNIC or phone.</p>
              </div>
              <button
                type="button"
                onClick={() => setSiblingReportOpen(true)}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Family PDF</span>
              </button>
            </div>

            {/* 3. Class-wise Summary */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2">
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
                <p className="text-xs text-slate-500">Billed vs collected by class.</p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('class_wise')}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Class-wise PDF</span>
              </button>
            </div>

            {/* 4. Date Range Cashbook */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2">
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
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Cashbook PDF</span>
              </button>
            </div>

            {/* 5. Month-wise Billing */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2">
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
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Monthly PDF</span>
              </button>
            </div>

            {/* 6. Daily Cashier Closing */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2">
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
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Daily Close PDF</span>
              </button>
            </div>

            {/* 7. Fee Head Revenue Summary */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2">
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
                <p className="text-xs text-slate-500">Billed vs collected by fee head.</p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('fee_heads')}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Fee Heads PDF</span>
              </button>
            </div>

            {/* 8. Approved Concessions Register */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2">
              <div className="space-y-1.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <Percent className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Approved Concessions Register</h4>
                      <span className="text-[10px] text-indigo-600 font-mono font-semibold">Scholarships & Waivers</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {discounts.length} Approved
                  </span>
                </div>
                <p className="text-xs text-slate-500">Approved discounts and scholarships.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowConcessionReportModal(true)}
                disabled={isGeneratingPdf}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Configure & Generate PDF</span>
              </button>
            </div>

            {/* 9. Student Running Ledger Statement */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between space-y-2">
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
                  <ModernSelect
                    value={ledgerStudentId}
                    onChange={val => setLedgerStudentId(val)}
                    buttonClassName="w-full text-xs bg-slate-50 border-slate-200"
                    placeholder="Select Student..."
                  >
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.admission_number || 'No Adm #'})
                      </option>
                    ))}
                  </ModernSelect>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenReportPdf('student_ledger')}
                disabled={isGeneratingPdf || !ledgerStudentId}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Ledger PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECEIVE FEE PAYMENT MODAL (CENTERED INSTITUTIONAL DIALOG) */}
      {/* ========================================================================= */}
      {showCashierDrawer && activeInvoice && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] mobile-sheet-card">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Receive Fee Payment
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Challan: <span className="font-semibold text-slate-700">{activeInvoice.invoice_number}</span> • Month: <span className="font-semibold text-slate-700">{activeInvoice.billing_month}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCashierDrawer(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Close"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="p-3.5 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              {/* Student & Due Summary */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Student</span>
                  <div className="font-bold text-slate-900 text-sm truncate">{activeInvoice.student_name}</div>
                  <div className="text-xs text-slate-600 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>Adm: <strong className="text-slate-800 font-bold whitespace-nowrap">{activeInvoice.admission_number || activeInvoice.roll_number || '—'}</strong></span>
                    <span>•</span>
                    <span className="text-slate-700 font-medium truncate">{activeInvoice.batch_name}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Balance Due</span>
                  <div className="text-lg font-bold font-mono text-rose-600 tabular-nums">
                    PKR {activeInvoice.balance_amount.toLocaleString()}
                  </div>
                </div>
              </div>

              <form onSubmit={handleCommitPayment} id="cashierDrawerForm" className="space-y-4">
                {/* Payment Fields: Amount, Method, Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Amount Received (PKR) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 font-mono pointer-events-none">PKR</span>
                      <input
                        type="number"
                        min="1"
                        value={collectionAmount}
                        onChange={e => handleAmountChange(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full pl-12 pr-3 py-2 text-base font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-900 tabular-nums"
                        required
                        aria-label="Amount Received"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
                    <ModernSelect
                      value={paymentMethod}
                      onChange={val => setPaymentMethod(val as PaymentMethod)}
                      buttonClassName="w-full text-base sm:text-xs bg-white border-slate-300 py-2.5 sm:py-2"
                    >
                      <option value="cash">Cash (Counter)</option>
                      <option value="bank_transfer">Bank Transfer / Meezan IBFT</option>
                      <option value="easypaisa">EasyPaisa</option>
                      <option value="jazzcash">JazzCash</option>
                      <option value="cheque">Bank Cheque</option>
                    </ModernSelect>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-xs font-mono font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 cursor-pointer"
                      required
                    />
                  </div>
                </div>

                {/* Conditional Bank / Cheque Details */}
                {(paymentMethod === 'bank_transfer' || paymentMethod === 'cheque') && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <p className="text-[11px] font-bold text-slate-700">Bank / Cheque Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Bank Name</label>
                        <input
                          type="text"
                          value={paymentBankName}
                          onChange={e => setPaymentBankName(e.target.value)}
                          className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs bg-white border border-slate-200 rounded-md text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                          {paymentMethod === 'cheque' ? 'Cheque # *' : 'Transaction Ref / Trx ID'}
                        </label>
                        <input
                          type="text"
                          value={paymentChequeNumber}
                          onChange={e => setPaymentChequeNumber(e.target.value)}
                          className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs bg-white border border-slate-200 rounded-md text-slate-800"
                          required={paymentMethod === 'cheque'}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Clearing Date</label>
                        <input
                          type="date"
                          value={paymentClearingDate}
                          onChange={e => setPaymentClearingDate(e.target.value)}
                          className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs bg-white border border-slate-200 rounded-md text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Concession / Discount Section (Clean & Collapsible) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setShowDiscountSection(!showDiscountSection)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Percent className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Concession / Discount</span>
                      {quickDiscountAmount > 0 && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold">
                          -PKR {quickDiscountAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500 text-[11px] font-normal hover:underline">
                      {showDiscountSection ? 'Hide' : quickDiscountAmount > 0 ? 'Edit Discount' : '+ Add Discount'}
                    </span>
                  </button>

                  {showDiscountSection && (
                    <div className="p-3 bg-indigo-50/20 border-t border-slate-200 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Discount Amount (PKR)</label>
                          <input
                            type="number"
                            min="0"
                            max={activeInvoice.balance_amount}
                            value={quickDiscountAmount === 0 ? '' : quickDiscountAmount}
                            placeholder="0"
                            onChange={e => {
                              const disc = Math.min(activeInvoice.balance_amount, Math.max(0, Number(e.target.value) || 0));
                              setQuickDiscountAmount(disc);
                              const payable = Math.max(0, activeInvoice.balance_amount - disc);
                              setCollectionAmount(payable);
                              void handleAmountChange(payable);
                            }}
                            className="w-full px-3 py-2 sm:py-1.5 text-base sm:text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg text-indigo-700 focus:outline-none focus:border-indigo-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Approval Reason *</label>
                          <input
                            type="text"
                            placeholder="e.g. Director approved, sibling discount"
                            value={counterDiscountReason}
                            onChange={e => setCounterDiscountReason(e.target.value)}
                            className="w-full px-3 py-2 sm:py-1.5 text-base sm:text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-600"
                            required={quickDiscountAmount > 0}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional Note / Reference */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Note / Memo (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid at counter by father"
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-slate-800"
                  />
                </div>

                {/* Calculation Summary Strip */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Due</span>
                    <span className="font-mono font-bold text-slate-700 text-xs sm:text-sm">
                      PKR {activeInvoice.balance_amount.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Receiving</span>
                    <span className="font-mono font-bold text-emerald-700 text-xs sm:text-sm">
                      PKR {(Number(collectionAmount) || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Remaining</span>
                    {(() => {
                      const remaining = Math.max(0, activeInvoice.balance_amount - (quickDiscountAmount || 0) - (Number(collectionAmount) || 0));
                      return (
                        <span className={`font-mono font-bold text-xs sm:text-sm ${remaining === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {remaining === 0 ? 'PKR 0 (Settled)' : `PKR ${remaining.toLocaleString()}`}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Collapsible Advanced Payment Allocation */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setShowAllocationBreakdown(!showAllocationBreakdown)}
                    className="w-full px-3.5 py-2 bg-slate-50/50 hover:bg-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Fee Head Allocation Details</span>
                    </div>
                    <span className="text-slate-400">{showAllocationBreakdown ? 'Hide Details' : 'Show Details'}</span>
                  </button>

                  {showAllocationBreakdown && (
                    <div className="p-3 border-t border-slate-200 space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">Distribution across fee heads</span>
                        <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isOverrideActive}
                            onChange={e => setIsOverrideActive(e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          <span>Manual Override</span>
                        </label>
                      </div>

                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-mono text-[10px] uppercase border-b border-slate-100">
                          <tr>
                            <th className="py-1 px-2">Fee Head</th>
                            <th className="py-1 px-2 text-right">Due</th>
                            <th className="py-1 px-2 text-right">Allocated</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {distributionItems.map(item => {
                            const invItem = activeInvoice.items.find(i => i.fee_head_id === item.fee_head_id);
                            const due = invItem ? invItem.balance_due : 0;
                            return (
                              <tr key={item.fee_head_id}>
                                <td className="py-1.5 px-2 font-medium text-slate-800">{item.head_name}</td>
                                <td className="py-1.5 px-2 text-right font-mono text-slate-500">{due.toLocaleString()}</td>
                                <td className="py-1.5 px-2 text-right">
                                  {isOverrideActive ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={item.allocated_amount}
                                      onChange={e => handleEditAllocation(item.fee_head_id, Number(e.target.value) || 0)}
                                      className="w-24 px-2 py-1 text-right font-mono font-bold text-base sm:text-xs bg-amber-50 border border-amber-300 rounded"
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
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                          <label className="block text-[11px] font-bold text-amber-900">
                            Reason for Allocation Override *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Parent requested paying tuition first"
                            value={overrideReason}
                            onChange={e => setOverrideReason(e.target.value)}
                            className="w-full px-2.5 py-2 sm:py-1 text-base sm:text-xs bg-white border border-amber-300 rounded text-slate-800"
                            required
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowCashierDrawer(false)}
                className="h-8.5 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="cashierDrawerForm"
                disabled={isCommittingPayment || (Number(collectionAmount) || 0) <= 0}
                className="flex-1 sm:flex-initial h-8.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {isCommittingPayment ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Receiving Payment...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Receive Payment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL: OFFICIAL PAYMENT RECEIPT (A6 VERTICAL) WITH 1-CLICK WHATSAPP */}
      {/* ========================================================================= */}
      {showReceiptModal && activePaymentReceipt && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white/75 backdrop-blur-md flex items-center justify-center p-4 no-sheet-overlay">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 shadow-2xl space-y-4 my-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Official Fee Payment Receipt</h3>
                  <p className="text-[11px] text-slate-500 font-mono">A6 Portrait Receipt</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="h-8 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Print A6 portrait receipt"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print A6</span>
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  aria-label="Close dialog"
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white/75 backdrop-blur-md flex items-center justify-center p-4 no-sheet-overlay">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 shadow-2xl space-y-4 my-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Fee Due Reminder Slip</h3>
                  <p className="text-[11px] text-slate-500 font-mono">A6 Portrait Slip</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="h-8 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Print A6 portrait slip"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print A6</span>
                </button>
                <button
                  onClick={() => setShowPictureSlipModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  aria-label="Close dialog"
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
                <span>Adm: {previewSlipImage.invoice.admission_number || previewSlipImage.invoice.roll_number} • {previewSlipImage.invoice.student_name}</span>
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
      {/* MODAL: PRINTABLE FEE CHALLAN (A4 SHEET) WITH DYNAMIC BANK INFO */}
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
          <div className="fixed inset-0 bg-white/75 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto no-sheet-overlay">
            <div id="printable-challan-modal" className="bg-white rounded-lg max-w-5xl w-full p-6 shadow-2xl space-y-4 my-0 sm:my-8">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3 print:hidden challan-no-print">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Official Fee Challan (A4 Sheet Preview)</h3>
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
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF Challan
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
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
                      <h4 className="font-bold text-slate-900 tracking-tight text-xs uppercase">{academyInfo.name}</h4>
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
                      <span className="text-slate-500">Admission No:</span>
                      <span className="font-bold text-slate-900">{activeInvoice.admission_number || activeInvoice.roll_number}</span>
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
                    <p className="text-center text-[8px] text-slate-400">Computerized Official Fee Voucher</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    )}

      {/* ========================================================================= */}
      {/* MODAL: CANCEL / VOID INVOICE */}
      {/* ========================================================================= */}
      {cancelInvoiceTarget && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-md w-full p-6 shadow-2xl border border-slate-200/90 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Void / Cancel Invoice</h3>
                <p className="text-xs text-slate-500">Invoice #{cancelInvoiceTarget.invoice_number} ({cancelInvoiceTarget.billing_month})</p>
              </div>
              <button
                type="button"
                onClick={() => setCancelInvoiceTarget(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Student:</span>
                <span className="font-bold text-slate-900">{cancelInvoiceTarget.student_name} ({cancelInvoiceTarget.admission_number || cancelInvoiceTarget.roll_number})</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Amount:</span>
                <span className="font-bold font-mono text-slate-900">PKR {cancelInvoiceTarget.net_amount.toLocaleString()}</span>
              </div>
              {cancelInvoiceTarget.arrears_amount ? (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>Rolled Arrears:</span>
                  <span className="font-mono">PKR {Number(cancelInvoiceTarget.arrears_amount).toLocaleString()} (will be restored to previous invoices)</span>
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mandatory Cancellation Reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={cancelInvoiceReason}
                onChange={e => setCancelInvoiceReason(e.target.value)}
                placeholder="Specify reason for cancelling this voucher (e.g., student shifted section, duplicate voucher, incorrect fee structure)..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelInvoiceTarget(null)}
                className="h-8.5 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={cancelSubmitting || cancelInvoiceReason.trim().length < 3}
                onClick={handleCancelInvoice}
                className="h-8.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs cursor-pointer"
              >
                {cancelSubmitting ? 'Cancelling...' : 'Confirm Void Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FEE HEAD MANAGEMENT */}
      {/* ========================================================================= */}
      {showHeadModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-md w-full p-6 shadow-2xl border border-slate-200/90 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo
                title={editingHead ? "Edit Fee Head" : "New Fee Head"}
                description="Configure billing head and allocation priority"
              />
              <button
                type="button"
                onClick={() => setShowHeadModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHead} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Head Name</label>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Code</label>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Default Amount (PKR)</label>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Allocation Priority</label>
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
                  className="h-8.5 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHead}
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-md w-full p-6 shadow-2xl border border-slate-200/90 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Grant Student Fee Concession</h3>
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyDiscount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Student</label>
                <ModernSelect
                  value={discountStudentId}
                  onChange={val => {
                    setDiscountStudentId(val);
                    const unpaidInv = invoices.find(i => i.student_id === val && i.status !== 'paid');
                    if (unpaidInv) setDiscountInvoiceId(unpaidInv.id);
                  }}
                  buttonClassName="w-full text-xs bg-slate-50 border-slate-200 py-2"
                  placeholder="Select student..."
                  required
                >
                  <option value="">Select student</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</option>
                  ))}
                </ModernSelect>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Invoice</label>
                <ModernSelect
                  value={discountInvoiceId}
                  onChange={val => setDiscountInvoiceId(val)}
                  buttonClassName="w-full text-xs bg-slate-50 border-slate-200 py-2 font-mono"
                  placeholder="Select invoice..."
                  required
                >
                  <option value="">Select invoice</option>
                  {invoices
                    .filter(i => !discountStudentId || i.student_id === discountStudentId)
                    .map(i => (
                      <option key={i.id} value={i.id}>
                        {i.invoice_number} ({i.billing_month} - Balance: {i.balance_amount} PKR)
                      </option>
                    ))}
                </ModernSelect>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                  <ModernSelect
                    value={discountType}
                    onChange={val => setDiscountType(val as any)}
                    buttonClassName="w-full text-xs bg-slate-50 border-slate-200 py-2"
                  >
                    <option value="flat">Fixed PKR Amount</option>
                    <option value="percentage">Percentage (%)</option>
                  </ModernSelect>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Value</label>
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
                <label className="block text-xs font-medium text-slate-700 mb-1">
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
                  className="h-8.5 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-xs cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-md w-full p-6 shadow-2xl border border-slate-200/90 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Void Payment Receipt
              </h3>
              <button
                type="button"
                onClick={() => setVoidPaymentModal(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You are voiding receipt <strong className="font-mono text-slate-900">{voidPaymentModal.receipt_number}</strong> of{' '}
              <strong className="font-mono text-rose-600">PKR {voidPaymentModal.amount.toLocaleString()}</strong> for{' '}
              <strong>{voidPaymentModal.student_name}</strong>. The invoice balance will be restored.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mandatory Reason for Void *</label>
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
                className="h-8.5 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={voidSubmitting}
                className="h-8.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shadow-xs cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-xl w-full p-6 shadow-2xl border border-slate-200/90 space-y-4 max-h-[90dvh] flex flex-col justify-between mobile-sheet-card">
            <div className="overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Bulk Tuition Fee Revision</h3>
                    <p className="text-[11px] text-slate-500">Change tuition for all students, a class, or a section.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBulkRevisionModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleExecuteBulkRevision} id="bulkRevForm" className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pr-1">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Target Scope</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'all', label: 'Entire Academy' },
                      { id: 'program', label: 'Specific Class' },
                      { id: 'batch', label: 'Specific Section' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setBulkRevScope(tab.id as any);
                          if (tab.id === 'program' && programs.length > 0 && !bulkRevProgramId) {
                            setBulkRevProgramId(programs[0].id);
                          }
                          if (tab.id === 'batch' && batches.length > 0 && !bulkRevBatchId) {
                            setBulkRevBatchId(batches[0].id);
                          }
                        }}
                        className={`py-1.5 px-2.5 text-xs font-semibold rounded-lg border transition-all ${
                          bulkRevScope === tab.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {bulkRevScope === 'program' && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Select Academic Class</label>
                      <ModernSelect
                        value={bulkRevProgramId}
                        onChange={val => setBulkRevProgramId(val)}
                        buttonClassName="w-full text-xs bg-slate-50 border-slate-200 py-2"
                        placeholder="Select class..."
                        required
                      >
                        <option value="" disabled>Select class</option>
                        {programs.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </ModernSelect>
                    </div>
                  )}

                  {bulkRevScope === 'batch' && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Select Section / Batch</label>
                      <ModernSelect
                        value={bulkRevBatchId}
                        onChange={val => setBulkRevBatchId(val)}
                        buttonClassName="w-full text-xs bg-slate-50 border-slate-200 py-2"
                        placeholder="Select section..."
                        required
                      >
                        <option value="" disabled>Select section</option>
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.academic_session})</option>
                        ))}
                      </ModernSelect>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Adjustment Method</label>
                    <ModernSelect
                      value={bulkRevType}
                      onChange={val => setBulkRevType(val as 'percentage' | 'fixed')}
                      buttonClassName="w-full text-xs bg-slate-50 border-slate-200 py-2"
                    >
                      <option value="percentage">Percentage Hike (+%)</option>
                      <option value="fixed">Fixed Increment (+PKR)</option>
                    </ModernSelect>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Rounding Rule</label>
                  <ModernSelect
                    value={bulkRevRounding}
                    onChange={val => setBulkRevRounding(val as any)}
                    buttonClassName="w-full text-xs bg-slate-50 border-slate-200 py-2"
                  >
                    <option value="nearest_100">Round to nearest 100 PKR (e.g. 5,480 → 5,500)</option>
                    <option value="nearest_50">Round to nearest 50 PKR (e.g. 5,420 → 5,450)</option>
                    <option value="none">Exact calculation (no rounding)</option>
                  </ModernSelect>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mandatory Audit Rationale</label>
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

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setShowBulkRevisionModal(false)}
                className="h-8.5 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="bulkRevForm"
                disabled={isSubmittingBulkRev || affectedStudents.length === 0}
                className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-2xl w-full p-6 shadow-2xl border border-slate-200/90 space-y-5 my-0 sm:my-6 animate-in fade-in zoom-in-95 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
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
                type="button"
                onClick={() => setSelectedFamily(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCommitFamilyPayment} className="space-y-4">
              {/* 1. Lump-Sum Total Amount Input with Priority Auto-Distribution */}
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-purple-950">
                      Total Family Amount Received (PKR) *
                    </label>
                    <p className="text-[11px] text-purple-700 mt-0.5">
                      Enter total lump sum. System automatically distributes across all children and fee heads by priority order.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleFamilyTotalAmountChange(selectedFamily.totalFamilyDue)}
                      className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      Full Due (PKR {selectedFamily.totalFamilyDue.toLocaleString()})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFamilyTotalAmountChange('')}
                      className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 font-mono">PKR</span>
                  <input
                    type="number"
                    min="0"
                    placeholder={`Enter total payment (e.g. ${selectedFamily.totalFamilyDue})`}
                    value={familyTotalInput}
                    onChange={e => handleFamilyTotalAmountChange(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full pl-12 pr-4 py-2 text-base font-bold font-mono bg-white border border-purple-300 rounded-lg focus:outline-none focus:border-purple-600 text-slate-900 shadow-2xs"
                  />
                </div>
              </div>

              {/* 2. Sibling Members Roster & Head-Wise Cells */}
              <div className="space-y-3.5 max-h-[46vh] overflow-y-auto pr-1">
                {selectedFamily.members.map(member => {
                  const s = member.student;
                  const batch = batches.find(b => b.id === s.batch_id);
                  const progName = getProgramName(s.program_id) || (batch?.program_id ? getProgramName(batch.program_id) : '') || 'Class';

                  return (
                    <div key={s.id} className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-3">
                      {/* Sibling Header */}
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-xs">
                            {s.full_name?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{s.full_name}</h4>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Adm #{s.admission_number || '—'} • {progName} {batch?.name ? `(${batch.name})` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Outstanding</span>
                          <span className={`text-xs font-bold ${member.totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {member.totalDue > 0 ? `PKR ${member.totalDue.toLocaleString()}` : 'Cleared'}
                          </span>
                        </div>
                      </div>

                      {member.unpaidInvoices.length === 0 ? (
                        <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg font-medium">
                          No outstanding dues for this student.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {member.unpaidInvoices.map(inv => (
                            <div key={inv.id} className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="font-bold text-slate-800">{inv.invoice_number}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-600 font-sans font-medium">{inv.billing_month}</span>
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Balance Due: <strong className="text-rose-600">PKR {inv.balance_amount.toLocaleString()}</strong>
                                </span>
                              </div>

                              {/* Available Fee Head Cells in a Row */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {inv.items.map(it => {
                                  const key = `${inv.id}_${it.fee_head_id}`;
                                  const allocVal = familyHeadAllocations[key] ?? 0;

                                  return (
                                    <div key={it.fee_head_id} className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1">
                                      <div className="flex justify-between items-center text-[11px]">
                                        <span className="font-semibold text-slate-700 truncate" title={it.head_name}>
                                          {it.head_name}
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-400">
                                          Due: {it.balance_due.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-mono text-slate-400">PKR</span>
                                        <input
                                          type="number"
                                          min="0"
                                          max={it.balance_due}
                                          value={allocVal === 0 ? '' : allocVal}
                                          placeholder="0"
                                          onChange={e => handleManualSiblingHeadChange(inv.id, it.fee_head_id, Math.min(it.balance_due, Math.max(0, Number(e.target.value) || 0)))}
                                          className="w-full px-2 py-1 text-right font-mono font-bold text-xs bg-white border border-slate-200 rounded focus:border-indigo-500 focus:outline-none text-slate-900"
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 3. Total & Payment Parameters */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase font-mono">Total Family Collection</span>
                  <span className="text-lg font-bold font-mono text-emerald-600">
                    PKR {Object.values(familyAllocations).reduce((sum, v) => sum + (Number(v) || 0), 0).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
                    <ModernSelect
                      value={familyPaymentMethod}
                      onChange={val => setFamilyPaymentMethod(val as PaymentMethod)}
                      buttonClassName="w-full text-xs bg-white border-slate-200 py-2"
                    >
                      <option value="cash">Cash Counter</option>
                      <option value="bank_transfer">Bank IBFT / Meezan</option>
                      <option value="easypaisa">EasyPaisa</option>
                      <option value="jazzcash">JazzCash</option>
                      <option value="cheque">Bank Cheque</option>
                    </ModernSelect>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Reference # / Trx ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 982341 or Chq #4091"
                      value={familyReference}
                      onChange={e => setFamilyReference(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Bank Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Meezan Bank"
                      value={familyBankName}
                      onChange={e => setFamilyBankName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedFamily(null)}
                  className="h-8.5 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFamily || Object.values(familyAllocations).reduce((sum, v) => sum + (Number(v) || 0), 0) <= 0}
                  className="h-8.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white/75 backdrop-blur-md flex items-center justify-center p-4 no-sheet-overlay">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-2xl border border-slate-200/90 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Official Family Payment Receipt</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Receipt #{familyReceiptData.receiptNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFamilyReceiptData(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                aria-label="Close dialog"
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
                      <p className="text-[11px] text-slate-500 font-mono">Adm #{item.admissionNumber || item.rollNumber || '—'} • {item.className}</p>
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
                  const text = `Fee Payment Receipt - ${tenant?.name || 'Academy'}\nReceipt #: ${familyReceiptData.receiptNumber}\nDate: ${familyReceiptData.date}\nGuardian: ${familyReceiptData.guardianName}\nTotal Paid: PKR ${familyReceiptData.totalPaid.toLocaleString()}\nPayment Mode: ${familyReceiptData.paymentMethod.toUpperCase()}\n\nBreakdown:\n${familyReceiptData.breakdown.map(b => `• ${b.studentName} (Adm ${b.admissionNumber || b.rollNumber || '—'}): PKR ${b.amountPaid.toLocaleString()}`).join('\n')}\n\nThank you!`;
                  const phone = (familyReceiptData.guardianPhone || '').replace(/\D/g, '');
                  const url = phone ? `https://wa.me/${phone.startsWith('0') ? '92' + phone.slice(1) : phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
                  window.open(url, '_blank');
                }}
                className="h-8.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp Share</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-8.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => setFamilyReceiptData(null)}
                className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: STUDENT SEARCH RESULTS POPUP */}
      {/* ========================================================================= */}
      {showSearchPopup && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90dvh] flex flex-col mobile-sheet-card">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-600" />
                  <span>Student Search Results</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {cashierFilteredStudents.length} student{cashierFilteredStudents.length !== 1 ? 's' : ''} found
                  {cashierSearch ? ` for "${cashierSearch}"` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSearchPopup(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Refine Search Bar in Popup */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={cashierSearch}
                onChange={e => setCashierSearch(e.target.value)}
                placeholder="Type to filter results by name, admission #, phone, CNIC..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600"
              />
              {cashierSearch && (
                <button
                  type="button"
                  onClick={() => setCashierSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Results List */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {cashierFilteredStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No students found matching "{cashierSearch}"</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Try searching by admission number, student name, guardian mobile, or CNIC.
                  </p>
                </div>
              ) : (
                cashierFilteredStudents.map(student => {
                  const studInvoices = invoices.filter(i => i.student_id === student.id);
                  const unpaidInvoices = studInvoices.filter(i => i.status !== 'paid' && i.balance_amount > 0);
                  const totalDue = unpaidInvoices.reduce((sum, inv) => sum + inv.balance_amount, 0);
                  const batch = batches.find(b => b.id === student.batch_id);
                  const progName = getProgramName(student.program_id) || (batch?.program_id ? getProgramName(batch.program_id) : '') || 'Class';
                  const siblings = getStudentSiblings(student);

                  return (
                    <div
                      key={student.id}
                      onClick={() => {
                        setSelectedCashierStudentId(student.id);
                        setLedgerStudentId(student.id);
                        setStudentDeskTab('challans');
                        setCashierSearch('');
                        setShowSearchPopup(false);
                      }}
                      className="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 uppercase">
                          {student.full_name?.charAt(0) || 'S'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs">{student.full_name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-semibold">
                              Adm #{student.admission_number || '—'}
                            </span>
                            {siblings.length > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-100">
                                {siblings.length + 1} Siblings
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            <strong className="text-slate-700">{progName}</strong>
                            {batch?.name ? ` • Section ${batch.name}` : ''}
                            <span className="text-slate-300 mx-1">•</span>
                            Father: {student.father_name || student.guardian_name || '—'}
                            {student.guardian_phone || student.phone ? ` (${student.guardian_phone || student.phone})` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-right">
                          {totalDue > 0 ? (
                            <div>
                              <span className="text-xs font-mono font-bold text-rose-600 block">
                                PKR {totalDue.toLocaleString()} Due
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {unpaidInvoices.length} Challan{unpaidInvoices.length > 1 ? 's' : ''} Pending
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-xs font-mono font-bold text-emerald-600 block">
                                All Cleared
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">No pending dues</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="h-8.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <span>Select</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSearchPopup(false)}
                className="h-8.5 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FEE HEADS & PAYMENT ALLOCATION PRIORITY DRAWER / MODAL */}
      {/* ========================================================================= */}
      {showFeeHeadsModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-3xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90dvh] flex flex-col mobile-sheet-card">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-indigo-600" />
                  <span>Fee Heads & Payment Allocation Order</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Order determines distribution priority when partial fee payments are received.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenNewHead}
                  className="h-8.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Fee Head</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFeeHeadsModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3.5 text-center">Priority</th>
                    <th className="py-2.5 px-3.5">Head Name</th>
                    <th className="py-2.5 px-3.5">Code</th>
                    <th className="py-2.5 px-3.5 text-right">Standard Rate</th>
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
                            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded disabled:opacity-25 transition-colors cursor-pointer"
                            title="Move Up in priority"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === feeHeads.length - 1}
                            onClick={() => handleMovePriority(idx, 'down')}
                            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded disabled:opacity-25 transition-colors cursor-pointer"
                            title="Move Down in priority"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditHead(head)}
                            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                            title="Edit Head"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!head.is_system_default && head.code !== 'TUITION' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteFeeHead(head.id)}
                              className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
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

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFeeHeadsModal(false)}
                className="h-8.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: UNIFIED CONCESSIONS & SCHOLARSHIPS REPORT FILTER */}
      {/* ========================================================================= */}
      {showConcessionReportModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90dvh] overflow-y-auto mobile-sheet-card">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-teal-600" />
                  <span>Configure Concessions Register</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filter concessions by category, time duration, and academic class.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConcessionReportModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Category Filter */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Concession Register Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setConcessionReportType('all')}
                    className={`py-1.5 px-2 rounded-lg border text-center text-xs transition-all ${
                      concessionReportType === 'all'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All Concessions
                  </button>
                  <button
                    type="button"
                    onClick={() => setConcessionReportType('scholarship')}
                    className={`py-1.5 px-2 rounded-lg border text-center text-xs transition-all ${
                      concessionReportType === 'scholarship'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Scholarships / Needy
                  </button>
                  <button
                    type="button"
                    onClick={() => setConcessionReportType('counter')}
                    className={`py-1.5 px-2 rounded-lg border text-center text-xs transition-all ${
                      concessionReportType === 'counter'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Counter Concessions
                  </button>
                </div>
              </div>

              {/* Period Filter */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Period Duration
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setConcessionPeriodType('monthly')}
                    className={`py-1 px-2 rounded-lg border text-center text-xs transition-all ${
                      concessionPeriodType === 'monthly'
                        ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setConcessionPeriodType('yearly')}
                    className={`py-1 px-2 rounded-lg border text-center text-xs transition-all ${
                      concessionPeriodType === 'yearly'
                        ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Yearly
                  </button>
                  <button
                    type="button"
                    onClick={() => setConcessionPeriodType('date_range')}
                    className={`py-1 px-2 rounded-lg border text-center text-xs transition-all ${
                      concessionPeriodType === 'date_range'
                        ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Date Range
                  </button>
                </div>

                {concessionPeriodType === 'monthly' && (
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Month & Year</label>
                    <input
                      type="text"
                      value={concessionMonth}
                      onChange={e => setConcessionMonth(e.target.value)}
                      placeholder="e.g. October 2026"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium"
                    />
                  </div>
                )}

                {concessionPeriodType === 'yearly' && (
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Academic Year</label>
                    <input
                      type="text"
                      value={concessionYear}
                      onChange={e => setConcessionYear(e.target.value)}
                      placeholder="e.g. 2026"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium"
                    />
                  </div>
                )}

                {concessionPeriodType === 'date_range' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">From Date</label>
                      <input
                        type="date"
                        value={concessionStartDate}
                        onChange={e => setConcessionStartDate(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">To Date</label>
                      <input
                        type="date"
                        value={concessionEndDate}
                        onChange={e => setConcessionEndDate(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Class Scope Filter */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Academic Class Filter
                </label>
                <ModernSelect
                  value={concessionClassFilter}
                  onChange={val => setConcessionClassFilter(val)}
                  buttonClassName="w-full text-xs bg-slate-50 border-slate-200 py-2"
                >
                  <option value="all">All Classes ({programs.length})</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </ModernSelect>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConcessionReportModal(false)}
                className="h-8.5 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateConcessionReport}
                disabled={isGeneratingPdf}
                className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Rendering PDF...' : 'Generate & Open PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {siblingReportOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90dvh] mobile-sheet-card">
            <h3 className="text-sm font-bold text-slate-900">Sibling fee report</h3>
            <p className="text-xs text-slate-500">Choose the scope, then open the PDF in the viewer.</p>
            <div className="space-y-2">
              {([
                { id: 'one_student', label: 'One student' },
                { id: 'one_class', label: 'One class' },
                { id: 'all_classes', label: 'All classes' },
              ] as const).map(opt => (
                <label key={opt.id} className="min-h-[36px] flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="sibling-scope"
                    checked={siblingReportScope === opt.id}
                    onChange={() => setSiblingReportScope(opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {siblingReportScope === 'one_student' && (
              <ModernSelect
                value={siblingReportStudentId}
                onChange={val => setSiblingReportStudentId(val)}
                buttonClassName="w-full text-xs border-slate-200 py-2"
                placeholder="Select student..."
              >
                <option value="">Select student</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</option>
                ))}
              </ModernSelect>
            )}
            {siblingReportScope === 'one_class' && (
              <ModernSelect
                value={siblingReportProgramId}
                onChange={val => setSiblingReportProgramId(val)}
                buttonClassName="w-full text-xs border-slate-200 py-2"
              >
                <option value="all">Select class</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </ModernSelect>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSiblingReportOpen(false)}
                className="h-8.5 px-3.5 py-1.5 text-xs border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSiblingReportOpen(false);
                  void handleOpenReportPdf('family');
                }}
                className="h-8.5 px-3.5 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-semibold transition-colors shadow-xs cursor-pointer"
              >
                Open PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DEFAULTER ITEMISED PENDING DUES BREAKDOWN (Fee Heads & Month-Wise) */}
      {/* ========================================================================= */}
      {selectedDefaulterModal && (() => {
        const def = selectedDefaulterModal;

        // Aggregate fee head breakdown across all unpaid invoices of this student
        const headMap = new Map<string, {
          head_id: string;
          head_name: string;
          total_billed: number;
          total_discount: number;
          total_paid: number;
          balance_due: number;
          challan_count: number;
        }>();

        for (const inv of def.invoices) {
          const items = inv.items && inv.items.length > 0 ? inv.items : [];
          if (items.length > 0) {
            for (const it of items) {
              const headId = it.fee_head_id || it.head_name || 'general';
              const headName = it.head_name || feeHeads.find(h => h.id === headId)?.name || 'Tuition Fee';
              const billed = Number(it.net_amount ?? it.original_amount ?? 0);
              const discount = Number(it.discount_amount ?? 0);
              const paid = Number(it.paid_amount ?? 0);
              const balance = Number(it.balance_due ?? Math.max(0, billed - paid));

              if (!headMap.has(headId)) {
                headMap.set(headId, {
                  head_id: headId,
                  head_name: headName,
                  total_billed: 0,
                  total_discount: 0,
                  total_paid: 0,
                  balance_due: 0,
                  challan_count: 0,
                });
              }
              const entry = headMap.get(headId)!;
              entry.total_billed += billed;
              entry.total_discount += discount;
              entry.total_paid += paid;
              entry.balance_due += balance;
              if (balance > 0) {
                entry.challan_count += 1;
              }
            }
          } else {
            const headId = 'tuition_composite';
            const headName = 'Tuition Fee / Composite';
            if (!headMap.has(headId)) {
              headMap.set(headId, {
                head_id: headId,
                head_name: headName,
                total_billed: 0,
                total_discount: 0,
                total_paid: 0,
                balance_due: 0,
                challan_count: 0,
              });
            }
            const entry = headMap.get(headId)!;
            entry.total_billed += inv.net_amount;
            entry.total_discount += inv.discount_amount || 0;
            entry.total_paid += inv.paid_amount || 0;
            entry.balance_due += inv.balance_amount;
            entry.challan_count += 1;
          }
        }

        const headList = Array.from(headMap.values()).filter(h => h.balance_due > 0 || h.total_billed > 0);

        // Chronologically sorted invoices
        const sortedInvoices = [...def.invoices].sort((a, b) => {
          return new Date(a.due_date || a.issue_date || 0).getTime() - new Date(b.due_date || b.issue_date || 0).getTime();
        });

        return createPortal(
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
            <div className="bg-white rounded-t-2xl sm:rounded-lg max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-0 sm:my-6 animate-in fade-in zoom-in-95 max-h-[90dvh] flex flex-col mobile-sheet-card">
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3 shrink-0">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-mono font-bold text-sm shrink-0">
                    {def.admission_number || def.roll_number || '—'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">{def.student_name}</h3>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {def.program_name} • {def.batch_name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Father / Guardian: <strong className="text-slate-800">{def.father_name}</strong>
                      {def.guardian_phone && (
                        <span> • Phone: <span className="font-mono text-slate-700">{def.guardian_phone}</span></span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDefaulterModal(null)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                  title="Close"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="overflow-y-auto pr-1 space-y-4 flex-1">
                {/* Summary KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase font-mono tracking-wider text-rose-700 block">Total Pending</span>
                    <span className="text-lg font-bold font-mono text-rose-700">
                      PKR {def.total_balance.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase font-mono tracking-wider text-slate-500 block">Unpaid Challans</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {def.overdue_invoices_count} Challan{def.overdue_invoices_count > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase font-mono tracking-wider text-slate-500 block">Status / Overdue</span>
                    <span className={`text-sm font-bold font-mono block mt-0.5 ${def.max_overdue_days > 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {def.max_overdue_days > 0 ? `${def.max_overdue_days} Days Overdue` : 'Current Due Cycle'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase font-mono tracking-wider text-slate-500 block">Billing Cycles</span>
                    <span className="text-xs font-semibold text-slate-800 block truncate mt-0.5" title={def.unpaid_months.join(', ')}>
                      {def.unpaid_months.join(', ')}
                    </span>
                  </div>
                </div>

                {/* Section 1: Types of Pending Fees (Aggregated Head-Wise Breakdown) */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">
                      1. Pending Dues by Fee Head / Type
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {headList.length} Fee Head{headList.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100/60 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 text-left">Fee Head / Type</th>
                        <th className="py-2 px-3 text-center">Unpaid Cycles</th>
                        <th className="py-2 px-3 text-right">Total Billed</th>
                        <th className="py-2 px-3 text-right">Paid</th>
                        <th className="py-2 px-3 text-right font-bold text-slate-900">Pending Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {headList.map((h, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-sans font-semibold text-slate-800">{h.head_name}</td>
                          <td className="py-2 px-3 text-center text-slate-500">
                            {h.challan_count} Challan{h.challan_count > 1 ? 's' : ''}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">PKR {h.total_billed.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-emerald-600">PKR {h.total_paid.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-bold text-rose-600">PKR {h.balance_due.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/80 font-mono font-bold border-t border-slate-200 text-xs">
                      <tr>
                        <td colSpan={2} className="py-2 px-3 text-slate-800 font-sans">Total Outstanding</td>
                        <td className="py-2 px-3 text-right text-slate-700">
                          PKR {headList.reduce((s, h) => s + h.total_billed, 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-700">
                          PKR {headList.reduce((s, h) => s + h.total_paid, 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-700">
                          PKR {def.total_balance.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Section 2: Month-Wise & Challan-Wise Breakdown */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider">
                      2. Challan-Wise & Month-Wise Breakdown
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {sortedInvoices.length} Challan{sortedInvoices.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {sortedInvoices.map((inv) => (
                      <div key={inv.id} className="border border-slate-200 rounded-lg p-3 bg-white shadow-2xs space-y-2.5">
                        {/* Challan Card Top Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                            <span className="font-bold text-slate-900">{inv.invoice_number}</span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold font-sans">
                              {inv.billing_month}
                            </span>
                            {inv.installment_number && (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold font-sans text-[11px]">
                                Installment {inv.installment_number}{inv.total_installments ? ` of ${inv.total_installments}` : ''}
                              </span>
                            )}
                            <span className="text-slate-500">Due: {inv.due_date}</span>
                            {inv.overdue_days > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                                {inv.overdue_days}d Overdue
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                                Current Cycle
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto font-mono">
                            <span className="text-xs text-slate-500 font-sans">Challan Balance:</span>
                            <span className="font-bold text-rose-600 text-sm">PKR {inv.balance_amount.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Itemized heads inside this challan */}
                        <div className="bg-slate-50/60 rounded border border-slate-100 p-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[10px] uppercase font-mono tracking-wider text-slate-500 border-b border-slate-200/80 pb-1">
                                <th className="text-left font-semibold pb-1">Fee Head</th>
                                <th className="text-right font-semibold pb-1">Net Amount</th>
                                <th className="text-right font-semibold pb-1">Paid</th>
                                <th className="text-right font-semibold pb-1">Balance Due</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                              {(inv.items && inv.items.length > 0) ? (
                                inv.items.map((it: any, idx: number) => (
                                  <tr key={idx}>
                                    <td className="py-1 text-slate-800 font-sans font-medium">{it.head_name}</td>
                                    <td className="py-1 text-right text-slate-600">PKR {Number(it.net_amount ?? it.original_amount ?? 0).toLocaleString()}</td>
                                    <td className="py-1 text-right text-emerald-600">PKR {Number(it.paid_amount ?? 0).toLocaleString()}</td>
                                    <td className="py-1 text-right font-bold text-rose-600">PKR {Number(it.balance_due ?? (Number(it.net_amount ?? 0) - Number(it.paid_amount ?? 0))).toLocaleString()}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td className="py-1 text-slate-800 font-sans font-medium">Tuition / General</td>
                                  <td className="py-1 text-right text-slate-600">PKR {inv.net_amount.toLocaleString()}</td>
                                  <td className="py-1 text-right text-emerald-600">PKR {inv.paid_amount.toLocaleString()}</td>
                                  <td className="py-1 text-right font-bold text-rose-600">PKR {inv.balance_amount.toLocaleString()}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Challan Actions */}
                        <div className="flex justify-end items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleDispatchWhatsAppSlip(inv, def.guardian_phone)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            title="Send WhatsApp Fee Slip for this challan"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            <span>WhatsApp Slip</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDefaulterModal(null);
                              handleOpenCashierDrawer(inv);
                            }}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                            title="Receive payment for this specific challan"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Receive This Challan</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedDefaulterModal(null)}
                    className="h-8.5 px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer w-full sm:w-auto"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const studId = def.student_id;
                      setSelectedDefaulterModal(null);
                      handleViewStudentInDesk(studId);
                    }}
                    className="h-8.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer w-full sm:w-auto flex items-center justify-center gap-1.5"
                    title="Open full student profile & ledger"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Full Student Profile</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Total Pending</span>
                    <span className="font-mono font-bold text-rose-600 text-sm">PKR {def.total_balance.toLocaleString()}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const latestInv = def.latest_invoice;
                      setSelectedDefaulterModal(null);
                      handleOpenCashierDrawer(latestInv);
                    }}
                    className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Receive Fee (Cashier)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

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
