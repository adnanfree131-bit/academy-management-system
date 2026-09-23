import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PhoneForwarded,
  MessageCircle,
  Phone,
  CheckCircle2,
  Calendar,
  Send,
  Plus,
  Zap,
  ChevronRight,
  ChevronLeft,
  X,
  FileCheck,
  AlertTriangle,
  CheckCheck,
  Users,
  UserX,
  PhoneCall,
  PhoneMissed,
  Clock,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  MoreVertical,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  AbsenteeFollowupItem,
  AbsenteeDeskSummaryKPI,
  RetentionCounselingCase,
  WhatsAppTemplate,
  WhatsAppAuditLog,
  AbsenteeCallOutcome,
  AbsenteeReasonCategory,
  Batch
} from '@apex/shared-types';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';

export const AbsenteeRetentionDeskView: React.FC = () => {
  const { token, tenant } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'roster' | 'retention' | 'templates'>('roster');

  // Core Data States
  const [followups, setFollowups] = useState<AbsenteeFollowupItem[]>([]);
  const [kpi, setKpi] = useState<AbsenteeDeskSummaryKPI>({
    total_absentees: 0,
    contacted_count: 0,
    contacted_percentage: 0,
    unreachable_count: 0,
    pending_count: 0,
    excused_count: 0
  });
  const [retentionCases, setRetentionCases] = useState<RetentionCounselingCase[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [auditLogs, setAuditLogs] = useState<WhatsAppAuditLog[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Filter States
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedBatchId, setSelectedBatchId] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOverviewFilters, setShowOverviewFilters] = useState(false);
  const [showAbsenteeModuleMenu, setShowAbsenteeModuleMenu] = useState(false);
  const [showAbsenteeFilters, setShowAbsenteeFilters] = useState(false);
  const absenteeModuleContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (absenteeModuleContainerRef.current && !absenteeModuleContainerRef.current.contains(e.target as Node)) {
        setShowAbsenteeModuleMenu(false);
      }
    };
    if (showAbsenteeModuleMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showAbsenteeModuleMenu]);

  // Filtered followups based on search query
  const filteredFollowups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return followups;
    return followups.filter(f =>
      f.student_name.toLowerCase().includes(q) ||
      (f.admission_number && f.admission_number.toLowerCase().includes(q)) ||
      (f.guardian_name && f.guardian_name.toLowerCase().includes(q)) ||
      (f.guardian_phone && f.guardian_phone.includes(q))
    );
  }, [followups, searchQuery]);

  // Phone selection mapping for followups: id -> 'PRIMARY' | 'BACKUP'
  const [phoneSelectionMap, setPhoneSelectionMap] = useState<Record<string, 'PRIMARY' | 'BACKUP'>>({});

  // WhatsApp Dispatch Modal State
  const [activeWhatsAppFollowup, setActiveWhatsAppFollowup] = useState<AbsenteeFollowupItem | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customMessageText, setCustomMessageText] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Log Response Modal State
  const [activeLogFollowup, setActiveLogFollowup] = useState<AbsenteeFollowupItem | null>(null);
  const [logCallOutcome, setLogCallOutcome] = useState<AbsenteeCallOutcome>('CONNECTED');
  const [logReasonCategory, setLogReasonCategory] = useState<AbsenteeReasonCategory>('MEDICAL');
  const [logParentRemarks, setLogParentRemarks] = useState('');
  const [logExpectedReturn, setLogExpectedReturn] = useState('');
  const [logConvertToMedical, setLogConvertToMedical] = useState(false);

  // Rapid Queue Mode State
  const [rapidQueueOpen, setRapidQueueOpen] = useState(false);
  const [rapidQueueIndex, setRapidQueueIndex] = useState(0);

  // Schedule Counseling Modal State
  const [activeRetentionCase, setActiveRetentionCase] = useState<RetentionCounselingCase | null>(null);
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');

  // Create Template Modal State
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [newTmplTitle, setNewTmplTitle] = useState('');
  const [newTmplCategory, setNewTmplCategory] = useState<'ABSENCE' | 'FEE_REMINDER' | 'EXAM_RESULT' | 'GENERAL'>('ABSENCE');
  const [newTmplBody, setNewTmplBody] = useState('');

  // Notifications
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Load Data
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { authorization: `Bearer ${token}` };

      const [fRes, kpiRes, retRes, tmplRes, logRes, batchRes] = await Promise.all([
        fetch(`/api/v1/absentee?date=${selectedDate}${selectedBatchId !== 'ALL' ? `&batch_id=${selectedBatchId}` : ''}${selectedStatusFilter !== 'ALL' ? `&status=${selectedStatusFilter}` : ''}`, { headers }),
        fetch(`/api/v1/absentee/kpi?date=${selectedDate}`, { headers }),
        fetch('/api/v1/absentee/retention', { headers }),
        fetch('/api/v1/whatsapp/templates', { headers }),
        fetch('/api/v1/whatsapp/audit-logs', { headers }),
        fetch('/api/v1/academic/batches', { headers })
      ]);

      if (fRes.ok) {
        const d = await fRes.json();
        setFollowups(d.data || []);
      }
      if (kpiRes.ok) {
        const d = await kpiRes.json();
        setKpi(d.data || {
          total_absentees: 0,
          contacted_count: 0,
          contacted_percentage: 0,
          unreachable_count: 0,
          pending_count: 0,
          excused_count: 0
        });
      }
      if (retRes.ok) {
        const d = await retRes.json();
        setRetentionCases(d.data || []);
      }
      if (tmplRes.ok) {
        const d = await tmplRes.json();
        setTemplates(d.data || []);
        if (d.data?.length > 0 && !selectedTemplateId) {
          const def = d.data.find((t: WhatsAppTemplate) => t.category === 'ABSENCE' && t.is_default) || d.data[0];
          setSelectedTemplateId(def.id);
        }
      }
      if (logRes.ok) {
        const d = await logRes.json();
        setAuditLogs(d.data || []);
      }
      if (batchRes.ok) {
        const d = await batchRes.json();
        setBatches(d.data || []);
      }
    } catch (err) {
      console.error('Failed loading absentee desk data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedBatchId, selectedStatusFilter, token]);


  // Build dynamic message for student
  const buildDynamicMessage = (templateBody: string, item: AbsenteeFollowupItem) => {
    let msg = templateBody;
    const adm = item.admission_number || item.roll_number || '';
    const data: Record<string, string> = {
      student_name: item.student_name,
      admission_number: adm,
      roll_number: adm,
      batch_name: item.batch_name,
      guardian_name: item.guardian_name,
      current_date: item.date,
      academy_name: tenant?.name || 'Academy Administration',
      academy_phone: tenant?.phone || 'Academy Office',
      due_amount: '0',
      due_date: item.date,
      exam_title: 'Term Assessment',
      obtained_marks: '—',
      total_marks: '—',
      percentage: '—',
      teacher_remarks: 'Uninformed absence recorded today. Kindly contact the administration office.'
    };

    for (const [key, val] of Object.entries(data)) {
      msg = msg.split(`{${key}}`).join(val);
    }
    return msg;
  };

  // Open WhatsApp Modal for a student
  const handleOpenWhatsAppModal = async (item: AbsenteeFollowupItem) => {
    setActiveWhatsAppFollowup(item);
    const tmpl = templates.find(t => t.id === selectedTemplateId) || templates.find(t => t.category === 'ABSENCE') || templates[0];
    if (tmpl) {
      setCustomMessageText(buildDynamicMessage(tmpl.body, item));
    }

    // Check duplicate
    try {
      const res = await fetch(`/api/v1/whatsapp/check-duplicate?student_id=${item.student_id}&category=ABSENCE`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        if (d.data?.wasDispatchedToday) {
          setDuplicateWarning(`Alert already dispatched today at ${new Date(d.data.lastDispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by ${d.data.dispatchedBy || 'Staff'}.`);
        } else {
          setDuplicateWarning(null);
        }
      }
    } catch (e) {
      console.error('Error checking duplicate:', e);
    }
  };

  // When selected template changes in modal, update preview text
  useEffect(() => {
    if (activeWhatsAppFollowup && selectedTemplateId) {
      const tmpl = templates.find(t => t.id === selectedTemplateId);
      if (tmpl) {
        setCustomMessageText(buildDynamicMessage(tmpl.body, activeWhatsAppFollowup));
      }
    }
  }, [selectedTemplateId]);

  // Dispatch WhatsApp Message
  const handleDispatchWhatsApp = async (item: AbsenteeFollowupItem, messageText: string) => {
    if (!token) return;
    const phoneType = phoneSelectionMap[item.id] || 'PRIMARY';
    const recipientPhone = phoneType === 'BACKUP' && item.backup_phone ? item.backup_phone : item.guardian_phone;

    try {
      const res = await fetch('/api/v1/whatsapp/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          student_id: item.student_id,
          recipient_phone: recipientPhone,
          phone_type: phoneType,
          template_id: selectedTemplateId || null,
          message_body: messageText,
          status: 'SENT'
        })
      });

      if (res.ok) {
        const d = await res.json();
        // Open the sanitized WhatsApp URL in new window
        window.open(d.data.link.encoded_url, '_blank');
        setActionSuccessMsg(`WhatsApp alert opened for ${item.student_name} (${recipientPhone})`);
        fetchData();
        setActiveWhatsAppFollowup(null);
        setTimeout(() => setActionSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed dispatching whatsapp:', err);
    }
  };

  // Open Log Response Modal
  const handleOpenLogModal = (item: AbsenteeFollowupItem) => {
    setActiveLogFollowup(item);
    setLogCallOutcome(item.call_outcome || 'CONNECTED');
    setLogReasonCategory(item.reason_category || 'MEDICAL');
    setLogParentRemarks(item.parent_remarks || '');
    setLogExpectedReturn(item.expected_return_date || '');
    setLogConvertToMedical(item.status === 'RESOLVED_EXCUSED');
  };

  // Save Log Response
  const handleSaveLogResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLogFollowup || !token) return;

    try {
      const res = await fetch(`/api/v1/absentee/${activeLogFollowup.id}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          call_outcome: logCallOutcome,
          reason_category: logReasonCategory,
          parent_remarks: logParentRemarks,
          expected_return_date: logExpectedReturn || null,
          convert_to_medical_leave: logConvertToMedical
        })
      });

      if (res.ok) {
        setActionSuccessMsg(`Call log updated for ${activeLogFollowup.student_name}`);
        setActiveLogFollowup(null);
        fetchData();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed saving call response:', err);
    }
  };

  // Schedule Counseling Meeting
  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRetentionCase || !token || !meetingDate || !meetingNotes) return;

    try {
      const res = await fetch(`/api/v1/absentee/retention/${activeRetentionCase.id}/meeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          meeting_date: meetingDate,
          notes: meetingNotes
        })
      });

      if (res.ok) {
        setActionSuccessMsg(`Parent counseling meeting scheduled for ${activeRetentionCase.student_name}`);
        setActiveRetentionCase(null);
        setMeetingDate('');
        setMeetingNotes('');
        fetchData();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed scheduling counseling meeting:', err);
    }
  };

  // Create New WhatsApp Template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTmplTitle || !newTmplBody || !token) return;

    try {
      const res = await fetch('/api/v1/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newTmplTitle,
          category: newTmplCategory,
          body: newTmplBody,
          is_default: false
        })
      });

      if (res.ok) {
        setShowCreateTemplateModal(false);
        setNewTmplTitle('');
        setNewTmplBody('');
        setActionSuccessMsg('New WhatsApp template created successfully');
        fetchData();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed creating template:', err);
    }
  };

  // Rapid Queue Current Item
  const rapidCurrentItem = followups[rapidQueueIndex] || null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeading
        title="Absentee Follow-Up"
        description="Daily morning follow-up roster, parent communications, leave conversion, and student attendance tracking."
        icon={<PhoneForwarded className="w-4 h-4 text-slate-700" />}
      />

      {/* 5-Card Metric Summary Strip (Sidebar Dark Navy Design) */}
      {showOverviewFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 animate-in fade-in duration-150">
          {/* Card 1: Total Absentees */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Total Absentees
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-white text-sm sm:text-base leading-none">
                  {kpi.total_absentees}
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  Recorded
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/10 text-rose-400 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <UserX className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 2: Contacted Rate */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Contacted Rate
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-emerald-400 text-sm sm:text-base leading-none">
                  {kpi.contacted_percentage}%
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  ({kpi.contacted_count}/{kpi.total_absentees})
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/10 text-emerald-400 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <PhoneCall className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 3: Unreachable / Rings */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Unreachable
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-amber-400 text-sm sm:text-base leading-none">
                  {kpi.unreachable_count}
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  Retry
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/10 text-amber-400 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <PhoneMissed className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 4: Pending Calls */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)]">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Pending Calls
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-sky-400 text-sm sm:text-base leading-none">
                  {kpi.pending_count}
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  Awaiting
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/10 text-sky-400 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Card 5: Excused Leaves */}
          <div className="bg-[#081A2F] border border-[#173252] rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-[0_2px_8px_rgba(8,26,47,0.18)] col-span-2 sm:col-span-1">
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block leading-tight truncate">
                Excused Leaves
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-purple-400 text-sm sm:text-base leading-none">
                  {kpi.excused_count}
                </span>
                <span className="text-xs font-medium text-slate-400 leading-none">
                  Sanctioned
                </span>
              </div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-white/10 text-purple-400 border border-white/10 flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      )}

      {/* Global Action Success Banner */}
      {actionSuccessMsg && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* =====================================================================
          TAB 1: DAILY MORNING ABSENTEE DESK
          ===================================================================== */}
      {activeTab === 'roster' && (
        <div className="space-y-3.5 sm:space-y-4">
          {/* Standalone Search Bar & Parallel Filter + Options */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search absent student by name, admission #, guardian..."
                className="w-full pl-8 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs font-normal"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowAbsenteeFilters(prev => !prev)}
              className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 relative ${
                showAbsenteeFilters || selectedBatchId !== 'ALL' || selectedStatusFilter !== 'ALL'
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Toggle Filters"
              aria-label="Toggle Filters"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-600" />
              {(selectedBatchId !== 'ALL' || selectedStatusFilter !== 'ALL') && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-600" />
              )}
            </button>

            {/* Simple Options Button Parallel to Filter */}
            <div ref={absenteeModuleContainerRef} className="relative">
              <button
                type="button"
                onClick={() => setShowAbsenteeModuleMenu(prev => !prev)}
                className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0 relative ${
                  showAbsenteeModuleMenu
                    ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Actions & Options"
                aria-label="Actions & Options"
              >
                <MoreVertical className="w-4 h-4 text-slate-600" />
              </button>

              {/* Dropdown Menu */}
              {showAbsenteeModuleMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-40 divide-y divide-slate-100 text-left animate-in fade-in zoom-in-95 duration-100">
                  {/* Primary Action */}
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAbsenteeModuleMenu(false);
                        setRapidQueueIndex(0);
                        setRapidQueueOpen(true);
                      }}
                      disabled={followups.length === 0}
                      className="w-full px-3 py-1.5 text-xs text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-2 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Zap className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Start Rapid Follow-Up</span>
                    </button>
                  </div>

                  {/* Views */}
                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Module Views
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAbsenteeModuleMenu(false);
                        setActiveTab('roster');
                      }}
                      className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        activeTab === 'roster' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <PhoneForwarded className="w-3.5 h-3.5 text-slate-500" />
                        <span>Absentee Roster ({followups.length})</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAbsenteeModuleMenu(false);
                        setActiveTab('retention');
                      }}
                      className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        (activeTab as string) === 'retention' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>Retention Desk ({retentionCases.length})</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAbsenteeModuleMenu(false);
                        setActiveTab('templates');
                      }}
                      className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        (activeTab as string) === 'templates' ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                        <span>Templates ({templates.length})</span>
                      </div>
                    </button>
                  </div>

                  {/* Display (Slider Item) */}
                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Display
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOverviewFilters(prev => !prev)}
                      className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                        <span>Overview Cards</span>
                      </div>
                      <div className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        showOverviewFilters ? 'bg-amber-600' : 'bg-slate-200'
                      }`}>
                        <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          showOverviewFilters ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Filter Panel */}
          {showAbsenteeFilters && (
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-100">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-700">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Batch:</span>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="ALL">All Batches</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Status:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Calls</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="UNREACHABLE">Unreachable / Rings</option>
                  <option value="RESOLVED_EXCUSED">Excused / Medical Leave</option>
                </select>
              </div>
            </div>
          )}

          {/* Absentee Follow-Up Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Desktop Absentee Follow-Up Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">Student & Adm No</th>
                    <th className="p-3">Batch</th>
                    <th className="p-3">Consecutive Days</th>
                    <th className="p-3">Guardian Contact</th>
                    <th className="p-3">Target Number Switcher</th>
                    <th className="p-3">Status / Outcome</th>
                    <th className="p-3 text-right">Front-Desk Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">Loading absentees roster...</td>
                    </tr>
                  ) : followups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                        No absent students found matching criteria for {selectedDate}. All students present or excused!
                      </td>
                    </tr>
                  ) : (
                    followups.map(item => {
                      const currentPhoneChoice = phoneSelectionMap[item.id] || 'PRIMARY';
                      const hasBackup = !!item.backup_phone;
                      const activePhone = currentPhoneChoice === 'BACKUP' && hasBackup ? item.backup_phone : item.guardian_phone;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-slate-900 text-xs">{item.student_name}</div>
                            <div className="text-[11px] font-mono text-slate-500">Adm: {item.admission_number || item.roll_number || '—'}</div>
                          </td>

                          <td className="p-3 font-medium text-slate-700">
                            {item.batch_name}
                          </td>

                          <td className="p-3">
                            {item.consecutive_days >= 3 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                Day {item.consecutive_days} (High Absence)
                              </span>
                            ) : item.consecutive_days === 2 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Day 2
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                Day 1
                              </span>
                            )}
                          </td>

                          <td className="p-3">
                            <div className="font-semibold text-slate-800">{item.guardian_name}</div>
                            <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
                              <span>{activePhone}</span>
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setPhoneSelectionMap(prev => ({ ...prev, [item.id]: 'PRIMARY' }))}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                                  currentPhoneChoice === 'PRIMARY'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                Primary
                              </button>
                              <button
                                type="button"
                                disabled={!hasBackup}
                                onClick={() => setPhoneSelectionMap(prev => ({ ...prev, [item.id]: 'BACKUP' }))}
                                title={!hasBackup ? 'No backup phone on file' : `Switch to backup phone: ${item.backup_phone}`}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                                  !hasBackup
                                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                                    : currentPhoneChoice === 'BACKUP'
                                      ? 'bg-amber-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                Backup
                              </button>
                            </div>
                            {!hasBackup && (
                              <span className="text-[9px] text-slate-400 block mt-0.5">No backup phone</span>
                            )}
                          </td>

                          <td className="p-3">
                            {item.status === 'RESOLVED_EXCUSED' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" /> Excused Leave
                                </span>
                                {item.expected_return_date && (
                                  <div className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                                    Snoozed until {item.expected_return_date}
                                  </div>
                                )}
                              </div>
                            ) : item.status === 'CONTACTED' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                  Contacted ({item.call_outcome || 'Spoke'})
                                </span>
                                {item.reason_category && (
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    Reason: {item.reason_category}
                                  </div>
                                )}
                              </div>
                            ) : item.status === 'UNREACHABLE' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  Unreachable ({item.call_outcome})
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Pending Follow-Up
                              </span>
                            )}
                            {item.parent_remarks && (
                              <div className="text-[10px] text-slate-600 italic mt-0.5 max-w-xs truncate" title={item.parent_remarks}>
                                "{item.parent_remarks}"
                              </div>
                            )}
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1. Send WhatsApp */}
                              <button
                                onClick={() => handleOpenWhatsAppModal(item)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold rounded-lg text-xs flex items-center gap-1 transition-all"
                                title="Send WhatsApp Notification"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                WhatsApp
                              </button>

                              {/* 2. Direct Phone Dialer */}
                              <a
                                href={`tel:${activePhone}`}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-all"
                                title={`Direct call to ${activePhone}`}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>

                              {/* 3. Log Call Response & 1-Click Medical Leave */}
                              <button
                                onClick={() => handleOpenLogModal(item)}
                                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all shadow-xs"
                                title="Log Call Outcome & Medical Leave"
                              >
                                <FileCheck className="w-3.5 h-3.5" />
                                Log
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Native Absentee Follow-Up Cards (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100 bg-white">
              {filteredFollowups.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No absent students found matching criteria.
                </div>
              ) : (
                filteredFollowups.map(item => {
                  const currentPhoneChoice = phoneSelectionMap[item.id] || 'PRIMARY';
                  const hasBackup = !!item.backup_phone;
                  const activePhone = currentPhoneChoice === 'BACKUP' && hasBackup ? item.backup_phone : item.guardian_phone;

                  return (
                    <div key={item.id} className="p-3.5 flex flex-col gap-2">
                      {/* Top: Student & Consecutive Days */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-slate-800 text-sm leading-tight truncate">{item.student_name}</h4>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                            Adm: {item.admission_number || item.roll_number || '—'} • {item.batch_name}
                          </p>
                        </div>
                        {item.consecutive_days >= 3 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse shrink-0">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Day {item.consecutive_days} (Critical)
                          </span>
                        ) : item.consecutive_days === 2 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                            Day 2 Absent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                            Day 1 Absent
                          </span>
                        )}
                      </div>

                      {/* Guardian & Contact - Flat line, NO box-in-box! */}
                      <div className="flex items-center justify-between text-xs py-0.5">
                        <div className="min-w-0 flex-1 truncate">
                          <span className="text-[11px] text-slate-400 font-normal">Guardian: </span>
                          <span className="font-medium text-slate-700">{item.guardian_name || 'Parent'}</span>
                          <span className="text-[11px] font-mono text-slate-400 ml-1.5">{activePhone || 'No Phone'}</span>
                        </div>
                        {hasBackup && (
                          <select
                            value={currentPhoneChoice}
                            onChange={e => setPhoneSelectionMap(prev => ({ ...prev, [item.id]: e.target.value as 'PRIMARY' | 'BACKUP' }))}
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-700 font-medium shrink-0 ml-2"
                          >
                            <option value="PRIMARY">Primary</option>
                            <option value="BACKUP">Backup</option>
                          </select>
                        )}
                      </div>

                      {/* Status Outcome if any */}
                      {item.status && item.status !== 'PENDING' && (
                        <div className="text-[11px] text-slate-500 font-medium">
                          Status: <span className="font-semibold text-slate-700">{item.status.replace('_', ' ')}</span>
                          {item.call_outcome && ` (${item.call_outcome})`}
                          {item.reason_category && ` • ${item.reason_category}`}
                        </div>
                      )}

                      {/* Action Triggers: Sleek Icons */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenWhatsAppModal(item)}
                            className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 flex items-center justify-center transition-colors cursor-pointer"
                            title="WhatsApp Notification"
                            aria-label="WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <a
                            href={`tel:${activePhone}`}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
                            title={`Call: ${activePhone}`}
                            aria-label="Call"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenLogModal(item)}
                          className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          title="Log Call Response / Medical Leave"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>Log Call</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: CHRONIC ABSENTEEISM & RETENTION COUNSELING
          ===================================================================== */}
      {activeTab === 'retention' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title="Back to Absentee Roster"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Roster</span>
            </button>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-rose-950 text-sm">Attendance Alert & Counseling List</h3>
                <p className="text-xs text-rose-800">
                  Identifies students with monthly attendance below 70% or multiple consecutive unexcused absences. Schedule parent counseling meetings to address attendance gaps.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-white text-rose-900 font-bold rounded-lg border border-rose-200 text-xs shadow-2xs">
              {retentionCases.length} Cases Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {retentionCases.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{c.student_name}</h4>
                    <p className="text-xs font-mono text-slate-500">Adm: {c.admission_number || c.roll_number || '—'} • {c.batch_name}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider ${
                    c.risk_level === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {c.risk_level} RISK
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-500 block text-[10px]">Monthly Attendance</span>
                    <span className="font-bold text-sm text-rose-600">{c.monthly_attendance_pct}%</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-500 block text-[10px]">Consecutive Absences</span>
                    <span className="font-bold text-sm text-slate-900">{c.consecutive_absences} Days</span>
                  </div>
                </div>

                {c.counseling_notes && (
                  <div className="text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-700">
                    <strong className="text-[10px] text-slate-500 uppercase block">Counseling Notes:</strong>
                    {c.counseling_notes}
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <div className="text-xs">
                    <span className="text-slate-500">Status: </span>
                    <strong className="uppercase text-slate-900 font-bold">{c.status}</strong>
                    {c.scheduled_meeting_date && (
                      <span className="text-indigo-600 font-semibold ml-2">
                        Meeting: {new Date(c.scheduled_meeting_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setActiveRetentionCase(c)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Schedule Meeting
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: WHATSAPP TEMPLATES & AUDIT HISTORY
          ===================================================================== */}
      {activeTab === 'templates' && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('roster')}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Back to Absentee Roster"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back to Roster</span>
              </button>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Dynamic Tag Message Templates</h3>
                <p className="text-xs text-slate-500">
                  Customizable message templates with live tag replacement and zero Meta API fees.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateTemplateModal(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Template
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      {tmpl.title}
                      {tmpl.is_default && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[9px] font-bold">
                          DEFAULT
                        </span>
                      )}
                    </h4>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Category: {tmpl.category}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {tmpl.body}
                </div>
              </div>
            ))}
          </div>

          {/* Audit History Log */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm mb-3">WhatsApp Dispatches Audit Trail</h3>
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">Dispatched Time</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Recipient Phone</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Dispatched By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">No WhatsApp messages dispatched yet.</td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-[11px] text-slate-500">
                          {new Date(log.dispatched_at).toLocaleString()}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {log.student_name || 'Student'}
                        </td>
                        <td className="p-3 font-mono text-slate-700">
                          {log.recipient_phone}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                            {log.phone_type}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                            {log.status}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-600">
                          {log.dispatched_by_name || 'Staff'}
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

      {/* =====================================================================
          MODAL: WHATSAPP 1-CLICK DISPATCH & LIVE PREVIEW
          ===================================================================== */}
      {activeWhatsAppFollowup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 my-0 sm:my-8 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                Dispatch WhatsApp Alert
              </h3>
              <button onClick={() => setActiveWhatsAppFollowup(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {duplicateWarning && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{duplicateWarning}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Message Template:</label>
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.category})</option>
                  ))}
                </select>
              </div>

              {/* Target Phone Switcher */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="font-bold text-slate-700 block">Recipient Phone:</span>
                  <span className="font-mono text-slate-600">
                    {(phoneSelectionMap[activeWhatsAppFollowup.id] || 'PRIMARY') === 'BACKUP' && activeWhatsAppFollowup.backup_phone
                      ? activeWhatsAppFollowup.backup_phone
                      : activeWhatsAppFollowup.guardian_phone}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPhoneSelectionMap(prev => ({ ...prev, [activeWhatsAppFollowup.id]: 'PRIMARY' }))}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                      (phoneSelectionMap[activeWhatsAppFollowup.id] || 'PRIMARY') === 'PRIMARY'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Primary
                  </button>
                  <button
                    type="button"
                    disabled={!activeWhatsAppFollowup.backup_phone}
                    onClick={() => setPhoneSelectionMap(prev => ({ ...prev, [activeWhatsAppFollowup.id]: 'BACKUP' }))}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                      !activeWhatsAppFollowup.backup_phone
                        ? 'opacity-40 cursor-not-allowed bg-slate-100'
                        : (phoneSelectionMap[activeWhatsAppFollowup.id] || 'PRIMARY') === 'BACKUP'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Backup
                  </button>
                </div>
              </div>

              {/* Native WhatsApp Chat Bubble Preview */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Live Chat Bubble Preview:
                </label>
                <div className="p-4 bg-[#e5ddd5] rounded-xl border border-slate-300">
                  <div className="bg-white rounded-xl rounded-tl-xs p-3.5 shadow-xs max-w-sm space-y-2 text-xs text-slate-900 font-sans">
                    <p className="whitespace-pre-wrap leading-relaxed">{customMessageText}</p>
                    <div className="flex justify-end items-center gap-1 text-[10px] text-slate-400">
                      <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveWhatsAppFollowup(null)}
                className="h-8.5 px-3.5 py-1.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDispatchWhatsApp(activeWhatsAppFollowup, customMessageText)}
                className="h-8.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Open WhatsApp Web / App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: LOG PARENT RESPONSE & 1-CLICK MEDICAL LEAVE
          ===================================================================== */}
      {activeLogFollowup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 my-0 sm:my-8 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo
                title="Log Call Outcome"
                description="Record parent communication and optional medical leave conversion"
              />
              <button onClick={() => setActiveLogFollowup(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLogResponse} className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Student:</span>
                <span className="font-bold text-slate-900 text-sm">{activeLogFollowup.student_name} (Adm: {activeLogFollowup.admission_number || activeLogFollowup.roll_number || '—'})</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Call Outcome:</label>
                <select
                  value={logCallOutcome}
                  onChange={e => setLogCallOutcome(e.target.value as AbsenteeCallOutcome)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="CONNECTED">Connected & Spoke with Parent</option>
                  <option value="NO_ANSWER">Ringing / No Answer</option>
                  <option value="SWITCHED_OFF">Phone Switched Off / Busy</option>
                  <option value="WHATSAPP_SENT">WhatsApp Message Sent</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason Category:</label>
                <select
                  value={logReasonCategory}
                  onChange={e => setLogReasonCategory(e.target.value as AbsenteeReasonCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="MEDICAL">Medical / Sick</option>
                  <option value="EMERGENCY">Family Emergency / Out of City</option>
                  <option value="TRANSPORT">Transportation / Rain</option>
                  <option value="FEE_DISPUTE">Fee Dispute / Thinking of Leaving</option>
                  <option value="TRUANCY">Woke up Late / Truancy</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Parent Remarks / Notes:</label>
                <textarea
                  rows={2}
                  value={logParentRemarks}
                  onChange={e => setLogParentRemarks(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Expected Return Date (Smart Snooze):
                </label>
                <input
                  type="date"
                  value={logExpectedReturn}
                  onChange={e => setLogExpectedReturn(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Setting an expected return date automatically snoozes daily calls until that date.
                </p>
              </div>

              {/* 1-Click Conversion to Medical Leave */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logConvertToMedical}
                    onChange={e => setLogConvertToMedical(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-purple-300 focus:ring-purple-500"
                  />
                  <span className="font-bold text-purple-900 text-xs">
                    Convert to Approved Medical Leave
                  </span>
                </label>
                <p className="text-[10px] text-purple-700 pl-6">
                  Updates today's attendance status from absent to excused leave.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveLogFollowup(null)}
                  className="h-8.5 px-3.5 py-1.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold rounded-lg shadow-xs transition-colors text-xs cursor-pointer"
                >
                  Save Call Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: WHATSAPP RAPID QUEUE MODE
          ===================================================================== */}
      {rapidQueueOpen && rapidCurrentItem && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-0 sm:my-8 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  WhatsApp Attendance Follow-Up
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 font-mono font-bold rounded text-xs">
                  {rapidQueueIndex + 1} of {followups.length}
                </span>
                <button onClick={() => setRapidQueueOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Student details header */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{rapidCurrentItem.student_name}</h4>
                <p className="text-xs text-slate-500 font-mono">Adm: {rapidCurrentItem.admission_number || rapidCurrentItem.roll_number || '—'} • {rapidCurrentItem.batch_name}</p>
                <p className="text-xs text-slate-700 mt-1">Guardian: <strong>{rapidCurrentItem.guardian_name}</strong></p>
              </div>
              <div className="text-right">
                {rapidCurrentItem.consecutive_days >= 3 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    Day {rapidCurrentItem.consecutive_days}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 block">
                    Day {rapidCurrentItem.consecutive_days}
                  </span>
                )}
                <span className="text-[11px] font-mono text-slate-500 block mt-1">
                  {rapidCurrentItem.guardian_phone}
                </span>
              </div>
            </div>

            {/* Message Bubble Preview */}
            <div className="p-4 bg-[#e5ddd5] rounded-xl border border-slate-300">
              <div className="bg-white rounded-xl rounded-tl-xs p-3.5 shadow-xs text-xs text-slate-900 font-sans space-y-1">
                <p className="whitespace-pre-wrap leading-relaxed">
                  {buildDynamicMessage(
                    templates.find(t => t.id === selectedTemplateId)?.body || templates[0]?.body || 'Dear Parent, your child was marked absent today.',
                    rapidCurrentItem
                  )}
                </p>
                <div className="flex justify-end text-[10px] text-slate-400">
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={rapidQueueIndex === 0}
                onClick={() => setRapidQueueIndex(prev => prev - 1)}
                className="h-8.5 px-3 py-1.5 border border-slate-300 text-slate-700 disabled:opacity-30 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const msg = buildDynamicMessage(templates.find(t => t.id === selectedTemplateId)?.body || templates[0]?.body || '', rapidCurrentItem);
                    handleDispatchWhatsApp(rapidCurrentItem, msg);
                  }}
                  className="h-8.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" /> Open WhatsApp
                </button>

                <button
                  type="button"
                  disabled={rapidQueueIndex >= followups.length - 1}
                  onClick={() => setRapidQueueIndex(prev => prev + 1)}
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-30 text-white font-semibold rounded-lg shadow-xs text-xs flex items-center gap-1 transition-colors cursor-pointer"
                >
                  Next Student <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: SCHEDULE PARENT COUNSELING MEETING
          ===================================================================== */}
      {activeRetentionCase && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 my-0 sm:my-8 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo
                title="Parent Counseling"
                description="Schedule director/counselor meeting with parent"
              />
              <button onClick={() => setActiveRetentionCase(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleMeeting} className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Student:</span>
                <span className="font-bold text-slate-900 text-sm">{activeRetentionCase.student_name} (Adm: {activeRetentionCase.admission_number || activeRetentionCase.roll_number || '—'})</span>
                <span className="text-rose-600 font-semibold block text-[11px] mt-0.5">
                  Monthly Attendance: {activeRetentionCase.monthly_attendance_pct}% • {activeRetentionCase.consecutive_absences} Consecutive Absences
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Meeting Date & Time:</label>
                <input
                  type="datetime-local"
                  required
                  value={meetingDate}
                  onChange={e => setMeetingDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Director / Counselor Agenda Notes:</label>
                <textarea
                  rows={3}
                  required
                  value={meetingNotes}
                  onChange={e => setMeetingNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveRetentionCase(null)}
                  className="h-8.5 px-3.5 py-1.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold rounded-lg shadow-xs transition-colors text-xs cursor-pointer"
                >
                  Confirm & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CREATE NEW WHATSAPP TEMPLATE
          ===================================================================== */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 my-0 sm:my-8 mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <SectionInfo
                title="WhatsApp Template"
                description="Create a message template with dynamic placeholders"
              />
              <button onClick={() => setShowCreateTemplateModal(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Template Title:</label>
                <input
                  type="text"
                  required
                  value={newTmplTitle}
                  onChange={e => setNewTmplTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category:</label>
                <select
                  value={newTmplCategory}
                  onChange={e => setNewTmplCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="ABSENCE">Absence Alert</option>
                  <option value="FEE_REMINDER">Fee Reminder</option>
                  <option value="EXAM_RESULT">Exam Result</option>
                  <option value="GENERAL">General Announcement</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Message Body (Supports WhatsApp *bold* and {`{tags}`}):</label>
                <textarea
                  rows={4}
                  required
                  value={newTmplBody}
                  onChange={e => setNewTmplBody(e.target.value)}
                  className="w-full p-3 font-mono border border-slate-300 rounded-lg text-xs"
                />
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg mt-1 text-[10px] text-slate-500 font-mono">
                  Supported tags: {`{student_name}, {admission_number}, {batch_name}, {guardian_name}, {current_date}, {academy_name}, {academy_phone}`}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplateModal(false)}
                  className="h-8.5 px-3.5 py-1.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs text-xs cursor-pointer"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
