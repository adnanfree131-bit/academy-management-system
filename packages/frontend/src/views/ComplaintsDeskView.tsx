import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  MessageSquare, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  User,
  X
} from 'lucide-react';
import { 
  ComplaintTicket, 
  ComplaintCategory, 
  ComplaintPriority, 
  ComplaintStatus 
} from '@apex/shared-types';

export const ComplaintsDeskView: React.FC = () => {
  const { token } = useAuth();

  // State
  const [tickets, setTickets] = useState<ComplaintTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New Ticket Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({
    category: 'facility' as ComplaintCategory,
    priority: 'normal' as ComplaintPriority,
    subject: '',
    description: '',
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
  }, [token]);

  // Submit Ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/complaints/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to submit ticket');

      setShowNewModal(false);
      setNewForm({
        category: 'facility',
        priority: 'normal',
        subject: '',
        description: '',
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
    const matchCat = categoryFilter === 'all' || t.category === categoryFilter;
    const matchStat = statusFilter === 'all' || t.status === statusFilter;
    return matchCat && matchStat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 text-white shadow-xs">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Complaints & Feedback</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit and track campus facility requests, academic inquiries, and student feedback.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTickets}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            title="Refresh Tickets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Ticket</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Category:</span>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none"
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
            <span className="text-xs font-bold text-slate-700">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="under_investigation">Under Investigation</option>
              <option value="action_taken">Action Taken</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </span>
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs font-mono">Loading feedback tickets...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No complaints matching filter</p>
          <p className="text-xs text-slate-400 mt-1">Submit feedback tickets above to initiate service resolution.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map(ticket => (
            <div
              key={ticket.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 font-bold uppercase text-slate-700">
                    {ticket.category.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase ${
                      ticket.priority === 'urgent'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : ticket.priority === 'high'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}>
                      {ticket.priority}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase ${
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

                <h3 className="text-sm font-extrabold text-slate-900">{ticket.subject}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ticket.description}</p>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {ticket.user_name || 'Complainant'}
                  </span>
                  <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                </div>

                {ticket.resolution_reply && (
                  <div className="mt-3 p-3 bg-emerald-50/60 border border-emerald-200/70 rounded-xl text-xs space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Official Resolution Reply:</span>
                    </div>
                    <p className="text-emerald-900 text-[11px] leading-relaxed">
                      {ticket.resolution_reply}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setTargetStatus(ticket.status);
                    setResolutionReply(ticket.resolution_reply || '');
                    setInternalNotes(ticket.internal_notes || '');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all"
                >
                  {ticket.status === 'resolved' ? 'View Resolution' : 'Update & Resolve'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <h2 className="text-sm font-extrabold text-slate-900">Submit Institutional Feedback</h2>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitTicket} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
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

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Ticket Subject</label>
                <input
                  type="text"
                  value={newForm.subject}
                  onChange={e => setNewForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Summary of issue..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Issue Details</label>
                <textarea
                  value={newForm.description}
                  onChange={e => setNewForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe details, room, date, and impact..."
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  required
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <h2 className="text-sm font-extrabold text-slate-900">Manage Complaint Resolution</h2>
              <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-xl text-xs space-y-1">
                <p className="font-bold text-slate-900">{selectedTicket.subject}</p>
                <p className="text-slate-600 text-[11px]">{selectedTicket.description}</p>
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
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Resolution Reply</label>
                <textarea
                  value={resolutionReply}
                  onChange={e => setResolutionReply(e.target.value)}
                  placeholder="Message visible to student/guardian upon resolution..."
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Internal Administrative Notes</label>
                <input
                  type="text"
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                  placeholder="Confidential notes for staff log..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                >
                  {isUpdating ? 'Saving...' : 'Save Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
