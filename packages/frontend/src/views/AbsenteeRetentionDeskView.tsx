import React, { useState, useEffect } from 'react';
import {
  PhoneForwarded,
  MessageCircle,
  Phone,
  CheckCircle2,
  Calendar,
  UserCheck,
  Send,
  Plus,
  RefreshCw,
  Zap,
  ChevronRight,
  ChevronLeft,
  X,
  FileCheck,
  FileText
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
  const [loading, setLoading] = useState(false);

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

  // Sync Daily Attendance
  const handleSyncAttendance = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/absentee/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: selectedDate })
      });
      if (res.ok) {
        setActionSuccessMsg(`Daily absentee roster synced for ${selectedDate}`);
        fetchData();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed syncing attendance:', err);
    }
  };

  // Build dynamic message for student
  const buildDynamicMessage = (templateBody: string, item: AbsenteeFollowupItem) => {
    let msg = templateBody;
    const data: Record<string, string> = {
      student_name: item.student_name,
      roll_number: item.roll_number,
      batch_name: item.batch_name,
      guardian_name: item.guardian_name,
      current_date: item.date,
      academy_name: tenant?.name || 'Apex Academy Lahore',
      academy_phone: '+92 42 35870000',
      due_amount: '8,000',
      due_date: '2026-09-20',
      exam_title: 'MDCAT Physics Mid-Term Assessment',
      obtained_marks: '27.5',
      total_marks: '30',
      percentage: '91.67',
      teacher_remarks: 'Superb conceptual clarity in equilibrium derivations.'
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
      {/* Top Banner & Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                <PhoneForwarded className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Absence Retention Desk & WhatsApp Rapid Queue
                </h1>
                <p className="text-xs text-slate-500">
                  Daily morning front-desk follow-up roster, 1-click medical leave conversion, zero-API-cost WhatsApp deep-links with dynamic tags, and chronic dropout prevention.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRapidQueueIndex(0);
                setRapidQueueOpen(true);
              }}
              disabled={followups.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Zap className="w-4 h-4" />
              Launch WhatsApp Rapid Queue
            </button>
            <button
              onClick={handleSyncAttendance}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Today
            </button>
          </div>
        </div>

        {/* Director Live Follow-Up Accountability Progress Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Absentees</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{kpi.total_absentees}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Recorded on {selectedDate}</div>
          </div>

          <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
            <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
              <span>Contacted Rate</span>
              <span className="font-bold">{kpi.contacted_percentage}%</span>
            </div>
            <div className="text-2xl font-black text-emerald-900 mt-1">{kpi.contacted_count} <span className="text-xs font-normal text-emerald-700">/ {kpi.total_absentees}</span></div>
            <div className="w-full bg-emerald-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.min(kpi.contacted_percentage, 100)}%` }} />
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80">
            <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Unreachable / Rings</div>
            <div className="text-2xl font-black text-amber-900 mt-1">{kpi.unreachable_count}</div>
            <div className="text-[10px] text-amber-700 mt-0.5">Needs afternoon retry</div>
          </div>

          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80">
            <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">Pending Calls</div>
            <div className="text-2xl font-black text-blue-900 mt-1">{kpi.pending_count}</div>
            <div className="text-[10px] text-blue-700 mt-0.5">Awaiting staff action</div>
          </div>

          <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200/80 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold text-purple-800 uppercase tracking-wider">Medical Leaves</div>
            <div className="text-2xl font-black text-purple-900 mt-1">{kpi.excused_count}</div>
            <div className="text-[10px] text-purple-700 mt-0.5">1-click converted</div>
          </div>
        </div>

        {/* Global Action Success Banner */}
        {actionSuccessMsg && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold text-slate-500">
        <button
          onClick={() => setActiveTab('roster')}
          className={`pb-2.5 flex items-center gap-2 transition-all ${
            activeTab === 'roster'
              ? 'border-b-2 border-rose-600 text-rose-600 font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <PhoneForwarded className="w-4 h-4" />
          Daily Morning Absentee Desk ({followups.length})
        </button>

        <button
          onClick={() => setActiveTab('retention')}
          className={`pb-2.5 flex items-center gap-2 transition-all ${
            activeTab === 'retention'
              ? 'border-b-2 border-rose-600 text-rose-600 font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Chronic Absenteeism & Retention Cases ({retentionCases.length})
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-2.5 flex items-center gap-2 transition-all ${
            activeTab === 'templates'
              ? 'border-b-2 border-rose-600 text-rose-600 font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp Templates & Dispatch Audit ({templates.length})
        </button>
      </div>

      {/* =====================================================================
          TAB 1: DAILY MORNING ABSENTEE DESK
          ===================================================================== */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-700">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Batch:</span>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs"
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
                  className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Calls</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="UNREACHABLE">Unreachable / Rings</option>
                  <option value="RESOLVED_EXCUSED">Excused / Medical Leave</option>
                </select>
              </div>
            </div>

            <div className="text-slate-400 font-mono text-[11px]">
              Showing {followups.length} Absent Students
            </div>
          </div>

          {/* Absentee Follow-Up Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">Student & Roll No</th>
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
                            <div className="text-[11px] font-mono text-slate-500">Roll: {item.roll_number}</div>
                          </td>

                          <td className="p-3 font-medium text-slate-700">
                            {item.batch_name}
                          </td>

                          <td className="p-3">
                            {item.consecutive_days >= 3 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                                ⚠️ Day {item.consecutive_days} (Critical Risk)
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
                                    ? 'bg-slate-900 text-white shadow-xs'
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
                                      ? 'bg-indigo-600 text-white shadow-xs'
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
                                title="Send 1-Click WhatsApp Alert"
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
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all shadow-2xs"
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
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: CHRONIC ABSENTEEISM & RETENTION COUNSELING
          ===================================================================== */}
      {activeTab === 'retention' && (
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="font-bold text-rose-950 text-sm">Automated Dropout Risk Detector</h3>
                <p className="text-xs text-rose-800">
                  Flags students with monthly attendance below 70% or 4+ consecutive unexplained absences. Schedule mandatory parent counseling meetings to prevent dropouts.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-white text-rose-900 font-black rounded-lg border border-rose-200 text-xs shadow-2xs">
              {retentionCases.length} Cases Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {retentionCases.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-slate-900 text-base">{c.student_name}</h4>
                    <p className="text-xs font-mono text-slate-500">Roll: {c.roll_number} • {c.batch_name}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider ${
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
                    <span className="font-black text-sm text-rose-600">{c.monthly_attendance_pct}%</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-500 block text-[10px]">Consecutive Absences</span>
                    <span className="font-black text-sm text-slate-900">{c.consecutive_absences} Days</span>
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
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1"
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
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Dynamic Tag Message Templates</h3>
              <p className="text-xs text-slate-500">
                Customizable message templates with live tag replacement and zero Meta API fees.
              </p>
            </div>
            <button
              onClick={() => setShowCreateTemplateModal(true)}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                Dispatch WhatsApp Alert
              </h3>
              <button onClick={() => setActiveWhatsAppFollowup(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {duplicateWarning && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
                <span>⚠️ {duplicateWarning}</span>
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
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                      (phoneSelectionMap[activeWhatsAppFollowup.id] || 'PRIMARY') === 'PRIMARY'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    Primary
                  </button>
                  <button
                    type="button"
                    disabled={!activeWhatsAppFollowup.backup_phone}
                    onClick={() => setPhoneSelectionMap(prev => ({ ...prev, [activeWhatsAppFollowup.id]: 'BACKUP' }))}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                      !activeWhatsAppFollowup.backup_phone
                        ? 'opacity-40 cursor-not-allowed bg-slate-100'
                        : (phoneSelectionMap[activeWhatsAppFollowup.id] || 'PRIMARY') === 'BACKUP'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700'
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
                      <span className="text-blue-500 font-black">✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveWhatsAppFollowup(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDispatchWhatsApp(activeWhatsAppFollowup, customMessageText)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 text-xs"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                Log Call Outcome & Medical Leave
              </h3>
              <button onClick={() => setActiveLogFollowup(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLogResponse} className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Student:</span>
                <span className="font-bold text-slate-900 text-sm">{activeLogFollowup.student_name} (Roll: {activeLogFollowup.roll_number})</span>
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
                  placeholder="e.g. High fever, doctor advised 3 days complete rest."
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
                    1-Click Convert to Approved Medical Leave
                  </span>
                </label>
                <p className="text-[10px] text-purple-700 pl-6">
                  Instantly changes today's attendance record from ABSENT to EXCUSED without requiring the class teacher to reopen the attendance sheet!
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveLogFollowup(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs"
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
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  WhatsApp Rapid Queue Mode
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 font-mono font-bold rounded text-xs">
                  {rapidQueueIndex + 1} of {followups.length}
                </span>
                <button onClick={() => setRapidQueueOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Student Header */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <h4 className="font-black text-slate-900 text-sm">{rapidCurrentItem.student_name}</h4>
                <p className="text-xs text-slate-500 font-mono">Roll: {rapidCurrentItem.roll_number} • {rapidCurrentItem.batch_name}</p>
                <p className="text-xs text-slate-700 mt-1">Guardian: <strong>{rapidCurrentItem.guardian_name}</strong></p>
              </div>
              <div className="text-right">
                {rapidCurrentItem.consecutive_days >= 3 ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse block">
                    Day {rapidCurrentItem.consecutive_days} ⚠️
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
                className="px-3 py-2 border border-slate-300 text-slate-700 disabled:opacity-30 rounded-lg text-xs font-bold flex items-center gap-1"
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs text-xs flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" /> Open WhatsApp
                </button>

                <button
                  type="button"
                  disabled={rapidQueueIndex >= followups.length - 1}
                  onClick={() => setRapidQueueIndex(prev => prev + 1)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white font-bold rounded-lg shadow-xs text-xs flex items-center gap-1"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Schedule Parent Counseling Meeting
              </h3>
              <button onClick={() => setActiveRetentionCase(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleMeeting} className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Student:</span>
                <span className="font-bold text-slate-900 text-sm">{activeRetentionCase.student_name} (Roll: {activeRetentionCase.roll_number})</span>
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
                  placeholder="e.g. Discuss repeated weekday absences and formulate academic recovery plan with father."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveRetentionCase(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Create WhatsApp Message Template
              </h3>
              <button onClick={() => setShowCreateTemplateModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Template Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mid-Term Absence Follow-Up"
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
                  placeholder="Dear {guardian_name}, this is an update regarding {student_name} (Roll: {roll_number}) in batch {batch_name}."
                  className="w-full p-3 font-mono border border-slate-300 rounded-lg text-xs"
                />
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg mt-1 text-[10px] text-slate-500 font-mono">
                  Supported tags: {`{student_name}, {roll_number}, {batch_name}, {guardian_name}, {current_date}, {academy_name}, {academy_phone}`}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplateModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs"
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
