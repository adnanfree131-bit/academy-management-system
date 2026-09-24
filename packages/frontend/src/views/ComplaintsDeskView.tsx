import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  MessageSquare, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  User,
  X,
  Search,
  Sliders,
  Eye
} from 'lucide-react';
import { 
  ComplaintTicket, 
  ComplaintCategory, 
  ComplaintPriority, 
  ComplaintStatus 
} from '@apex/shared-types';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';
import { resolveUserAccessMap, can } from '../lib/access';

export const ComplaintsDeskView: React.FC = () => {
  const { token, user } = useAuth();
  const isStaff = user?.role ? !['student', 'parent'].includes(user.role) : false;
  const accessMap = resolveUserAccessMap(user?.role, user?.permissions, user?.access);
  const canEdit = can(accessMap, 'complaints', 'edit');

  // State
  const [tickets, setTickets] = useState<ComplaintTicket[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // New Ticket Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({
    category: 'facility' as ComplaintCategory,
    priority: 'normal' as ComplaintPriority,
    subject: '',
    description: '',
    student_id: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update Status / Resolve Modal
  const [selectedTicket, setSelectedTicket] = useState<ComplaintTicket | null>(null);
  const [targetStatus, setTargetStatus] = useState<ComplaintStatus>('under_investigation');
  const [resolutionReply, setResolutionReply] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchTickets = async () => {
    if (!token) return;
    setIsLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const res = await fetch('/api/v1/complaints/complaints', { headers });
      const data = await res.json();
      if (data.success) {
        setTickets(data.data || []);
      }
    } catch (err) {
      console.error('Error loading complaints:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    if (isStaff && token) {
      fetch('/api/v1/sis/students', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.data)) {
            setStudents(data.data);
          }
        })
        .catch(err => console.error('Error loading students for complaints desk:', err));
    }
  }, [token, isStaff]);

  // Submit Ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    try {
      const payload: any = {
        category: newForm.category,
        priority: newForm.priority,
        subject: newForm.subject,
        description: newForm.description,
      };
      if (isStaff && newForm.student_id) {
        payload.student_id = newForm.student_id;
      }
      const res = await fetch('/api/v1/complaints/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to submit ticket');

      setShowNewModal(false);
      setNewForm({
        category: 'facility',
        priority: 'normal',
        subject: '',
        description: '',
        student_id: '',
      });
      fetchTickets();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Ticket Status / Reply
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedTicket) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/v1/complaints/complaints/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: targetStatus,
          resolution_reply: resolutionReply || undefined,
          internal_notes: internalNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to update complaint status');

      setSelectedTicket(null);
      setResolutionReply('');
      setInternalNotes('');
      fetchTickets();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter tickets
  const filteredTickets = tickets.filter(t => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q ||
      (t.subject || '').toLowerCase().includes(q) ||
      (t.user_name || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.student_name || '').toLowerCase().includes(q) ||
      (t.batch_name || '').toLowerCase().includes(q);
    const matchCat = categoryFilter === 'all' || t.category === categoryFilter;
    const matchStat = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchCat && matchStat;
  });

  const hasActiveFilters = categoryFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeading
        title="Complaints"
        description="Submit and track campus facility requests, academic inquiries, and student feedback."
        icon={<MessageSquare className="w-4 h-4 text-slate-700" />}
      >
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Ticket</span>
        </button>
      </PageHeading>

      {/* Standalone Search Bar & Filters Strip */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tickets by subject, complainant, description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 text-slate-900 transition-colors placeholder:text-slate-400 shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs flex items-center justify-center relative cursor-pointer shrink-0 ${
            showFilters ? 'border-primary-500 bg-primary-50/30' : ''
          }`}
          title="Filters"
          aria-label="Filters"
        >
          <Sliders className="w-4 h-4 text-slate-600" />
          {hasActiveFilters && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
          )}
        </button>

        <span className="hidden sm:inline-flex text-xs font-mono text-slate-500 px-2.5 py-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs shrink-0">
          <strong className="text-slate-900">{filteredTickets.length}</strong> / {tickets.length}
        </span>
      </div>

      {/* Collapsible Filters Container */}
      <div className={showFilters ? 'block' : 'hidden sm:block'}>
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Category:</span>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="facility">Campus Facilities</option>
              <option value="teaching_quality">Teaching Quality</option>
              <option value="fee_billing">Fee & Billing</option>
              <option value="disciplinary">Disciplinary</option>
              <option value="general">General</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="under_investigation">Under Investigation</option>
              <option value="action_taken">Action Taken</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold ml-auto cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs font-mono">Loading feedback tickets...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl shadow-2xs">
          <MessageSquare className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700">No complaints matching filter</p>
          <p className="text-[11px] text-slate-400 mt-1">No tickets yet. Use New Ticket.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTickets.map(ticket => (
            <div
              key={ticket.id}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 font-semibold uppercase text-slate-700">
                    {ticket.category.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md uppercase ${
                      ticket.priority === 'urgent'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : ticket.priority === 'high'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}>
                      {ticket.priority}
                    </span>
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md uppercase ${
                      ticket.status === 'resolved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : ticket.status === 'action_taken'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : ticket.status === 'under_investigation'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <h3 className="text-xs sm:text-sm font-semibold text-slate-900">{ticket.subject}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ticket.description}</p>

                {(ticket.student_name || ticket.batch_name) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    {ticket.student_name && (
                      <span>Student: <strong className="font-semibold text-slate-700">{ticket.student_name}</strong></span>
                    )}
                    {ticket.student_name && ticket.batch_name && <span className="text-slate-300">•</span>}
                    {ticket.batch_name && (
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">{ticket.batch_name}</span>
                    )}
                  </div>
                )}

                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {ticket.user_name || 'Complainant'}
                  </span>
                  <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                </div>

                {/* Flat Callout - Zero Card-in-Card */}
                {ticket.resolution_reply && (
                  <div className="mt-2.5 pl-3 border-l-2 border-emerald-500 py-0.5 text-xs space-y-0.5">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Resolution Reply:</span>
                    </div>
                    <p className="text-slate-700 text-[11px] leading-relaxed">
                      {ticket.resolution_reply}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setTargetStatus(ticket.status);
                    setResolutionReply(ticket.resolution_reply || '');
                    setInternalNotes(ticket.internal_notes || '');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  {ticket.status === 'resolved' ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{canEdit ? (ticket.status === 'resolved' ? 'Resolution' : 'Update & Resolve') : (ticket.status === 'resolved' ? 'Resolution' : 'View Ticket')}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl overflow-hidden mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <SectionInfo
                title="Submit Ticket"
                description="Tell the office what happened."
              />
              <button onClick={() => setShowNewModal(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitTicket} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={newForm.category}
                    onChange={e => setNewForm(prev => ({ ...prev, category: e.target.value as ComplaintCategory }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800"
                  >
                    <option value="facility">Campus Facility</option>
                    <option value="teaching_quality">Teaching Quality</option>
                    <option value="fee_billing">Fee & Billing</option>
                    <option value="disciplinary">Disciplinary</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newForm.priority}
                    onChange={e => setNewForm(prev => ({ ...prev, priority: e.target.value as ComplaintPriority }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium text-slate-800 capitalize"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {isStaff && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Student <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <select
                    value={newForm.student_id}
                    onChange={e => setNewForm(prev => ({ ...prev, student_id: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800"
                  >
                    <option value="">No specific student (General)</option>
                    {students.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} {s.roll_number ? `(${s.roll_number})` : ''} {s.batch_name ? `• ${s.batch_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Ticket Subject</label>
                <input
                  type="text"
                  value={newForm.subject}
                  onChange={e => setNewForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Issue Details</label>
                <textarea
                  value={newForm.description}
                  onChange={e => setNewForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  required
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="h-8.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Filing...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update / Resolve Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl overflow-hidden mobile-sheet-card max-h-[92dvh] overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <SectionInfo
                title={canEdit ? 'Manage Resolution' : 'Ticket Details & Resolution'}
                description={canEdit ? 'Update ticket status and provide official resolution notes' : 'View ticket status and official administration reply'}
              />
              <button onClick={() => setSelectedTicket(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {canEdit ? (
              <form onSubmit={handleUpdateStatus} className="p-5 space-y-4">
                <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-slate-900">{selectedTicket.subject}</p>
                  <p className="text-slate-600 text-[11px]">{selectedTicket.description}</p>
                  {(selectedTicket.student_name || selectedTicket.batch_name) && (
                    <div className="text-[11px] text-slate-500 pt-1">
                      {selectedTicket.student_name && <span>Student: <strong className="text-slate-700">{selectedTicket.student_name}</strong> </span>}
                      {selectedTicket.batch_name && <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-semibold">{selectedTicket.batch_name}</span>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Update Status</label>
                  <select
                    value={targetStatus}
                    onChange={e => setTargetStatus(e.target.value as ComplaintStatus)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800 capitalize"
                  >
                    <option value="open">Open</option>
                    <option value="under_investigation">Under Investigation</option>
                    <option value="action_taken">Action Taken</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Reply to parent</label>
                  <textarea
                    value={resolutionReply}
                    onChange={e => setResolutionReply(e.target.value)}
                    rows={3}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Office notes</label>
                  <input
                    type="text"
                    value={internalNotes}
                    onChange={e => setInternalNotes(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    className="h-8.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="h-8.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs cursor-pointer transition-colors"
                  >
                    {isUpdating ? 'Saving...' : 'Save Resolution'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-5 space-y-4">
                <div className="bg-slate-50 border border-slate-200/70 p-4 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold uppercase text-slate-700">
                      {selectedTicket.category.replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase ${
                      selectedTicket.status === 'resolved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedTicket.status === 'action_taken'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : selectedTicket.status === 'under_investigation'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {selectedTicket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{selectedTicket.subject}</h4>
                  <p className="text-slate-600 text-xs leading-relaxed">{selectedTicket.description}</p>
                  {(selectedTicket.student_name || selectedTicket.batch_name) && (
                    <div className="text-[11px] text-slate-500 pt-1">
                      {selectedTicket.student_name && <span>Student: <strong className="text-slate-700">{selectedTicket.student_name}</strong> </span>}
                      {selectedTicket.batch_name && <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-semibold">{selectedTicket.batch_name}</span>}
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200/60 text-[10px] text-slate-400 font-mono">
                    Submitted on: {new Date(selectedTicket.created_at).toLocaleString()}
                  </div>
                </div>

                {selectedTicket.resolution_reply ? (
                  <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Reply to parent:</span>
                    </div>
                    <p className="text-emerald-950 text-xs leading-relaxed">
                      {selectedTicket.resolution_reply}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-500 text-center">
                    The office has not replied yet.
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                    className="h-8.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer shadow-2xs transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
