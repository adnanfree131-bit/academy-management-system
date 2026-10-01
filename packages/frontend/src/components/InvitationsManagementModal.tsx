import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Mail,
  UserPlus,
  Copy,
  Check,
  RotateCw,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { InstitutionalLoader } from './InstitutionalLoader';

export interface TenantInvitationRecord {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  invited_by_membership_id?: string | null;
  invited_by_name?: string | null;
  invited_by_email?: string | null;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
}

interface InvitationsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InvitationsManagementModal: React.FC<InvitationsManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { token, tenant } = useAuth();

  const [invitations, setInvitations] = useState<TenantInvitationRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [emailInput, setEmailInput] = useState<string>('');
  const [roleInput, setRoleInput] = useState<string>('teacher');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Newly Created Invitation Link Card
  const [lastCreatedToken, setLastCreatedToken] = useState<string | null>(null);
  const [lastCreatedEmail, setLastCreatedEmail] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Revoke Confirmation State
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  const fetchInvitations = useCallback(async () => {
    if (!token || !tenant?.id) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/auth/invitations', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': tenant.id,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to load tenant invitations.');
      }
      setInvitations(Array.isArray(data.data) ? data.data : []);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while loading invitations.');
    } finally {
      setIsLoading(false);
    }
  }, [token, tenant?.id]);

  useEffect(() => {
    if (isOpen) {
      fetchInvitations();
      setFormError(null);
      setSuccessMsg(null);
      setLastCreatedToken(null);
      setLastCreatedEmail(null);
      setCopiedLink(false);
    }
  }, [isOpen, fetchInvitations]);

  if (!isOpen) return null;

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);
    setLastCreatedToken(null);
    setLastCreatedEmail(null);
    setCopiedLink(false);

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (!token || !tenant?.id) {
      setFormError('Authentication required to issue invitations.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/invitations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': tenant.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          role: roleInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to generate invitation.');
      }

      const generatedToken = data.data?.token;
      setLastCreatedToken(generatedToken);
      setLastCreatedEmail(cleanEmail);
      setEmailInput('');
      setSuccessMsg(`Invitation issued to ${cleanEmail}. Copy the link below to distribute.`);
      await fetchInvitations();
    } catch (err: any) {
      setFormError(err.message || 'Failed to issue invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!lastCreatedToken) return;
    const inviteUrl = `${window.location.origin}/#invite/${lastCreatedToken}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    if (!token || !tenant?.id) return;
    setIsRevoking(true);
    try {
      const res = await fetch(`/api/v1/auth/invitations/${id}/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': tenant.id,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to revoke invitation.');
      }

      setRevokingId(null);
      setSuccessMsg('Invitation revoked successfully.');
      await fetchInvitations();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to revoke invitation.');
    } finally {
      setIsRevoking(false);
    }
  };

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case 'tenant_admin': return 'Administrator';
      case 'academic_head': return 'Academic Head';
      case 'teacher': return 'Teacher / Faculty';
      case 'finance_manager': return 'Accountant / Finance';
      case 'student': return 'Student';
      case 'parent': return 'Parent / Guardian';
      default: return role;
    }
  };

  const filteredInvitations = invitations.filter(inv => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      inv.email.toLowerCase().includes(q) ||
      inv.role.toLowerCase().includes(q) ||
      inv.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 no-sheet-overlay animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Staff & Member Invitations
              </h2>
              <p className="text-xs text-slate-500">
                Issue, monitor, and revoke invitations for faculty and staff members
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Global Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Global Success Banner */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {/* Newly Generated Invitation Link Callout */}
          {lastCreatedToken && (
            <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Invitation Link Generated for <span className="font-mono text-slate-700">{lastCreatedEmail}</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">Valid for 7 days</span>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/#invite/${lastCreatedToken}`}
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Share this secure link with the recipient. The invitee must sign in or register with their verified email address (<span className="font-mono text-slate-700">{lastCreatedEmail}</span>) to claim membership.
              </p>
            </div>
          )}

          {/* Create Invitation Section */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-600" />
              <span>Issue New Invitation</span>
            </div>

            <form onSubmit={handleCreateInvitation} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Recipient Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. instructor@academy.edu.pk"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Assigned Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  >
                    <option value="teacher">Teacher / Faculty</option>
                    <option value="finance_manager">Accountant / Finance</option>
                    <option value="academic_head">Academic Head</option>
                    <option value="tenant_admin">Academy Administrator</option>
                    <option value="student">Student</option>
                    <option value="parent">Parent / Guardian</option>
                  </select>
                </div>
              </div>

              {formError && (
                <div className="text-rose-600 text-xs font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Generating...' : 'Generate Invitation Link'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Invitations Register */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-xs">Invitations Register</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  {invitations.length} Total
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by email or role..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 w-48 sm:w-60 focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <button
                  type="button"
                  onClick={fetchInvitations}
                  disabled={isLoading}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                  title="Refresh list"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {isLoading ? (
              <InstitutionalLoader variant="table" label="Loading invitation register..." />
            ) : filteredInvitations.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50/50 space-y-1">
                <p className="font-semibold text-slate-700">No invitations found</p>
                <p className="text-slate-500 text-[11px]">
                  {filterQuery ? 'No invitations match the search criteria.' : 'No invitations have been issued yet for this academy.'}
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-[11px] font-semibold">
                        <th className="py-2.5 px-3">Recipient Email</th>
                        <th className="py-2.5 px-3">Assigned Role</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Issued Date</th>
                        <th className="py-2.5 px-3">Expires At</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-xs">
                      {filteredInvitations.map((inv) => {
                        const isExpired = inv.status === 'expired';
                        const isPending = inv.status === 'pending';
                        const isAccepted = inv.status === 'accepted';
                        const isRevoked = inv.status === 'revoked';

                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                              {inv.email}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {formatRoleLabel(inv.role)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock className="w-3 h-3" />
                                  <span>Pending</span>
                                </span>
                              )}
                              {isAccepted && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3" />
                                  <span>Accepted</span>
                                </span>
                              )}
                              {isRevoked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                  <Ban className="w-3 h-3" />
                                  <span>Revoked</span>
                                </span>
                              )}
                              {isExpired && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Expired</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                              {new Date(inv.created_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                              {new Date(inv.expires_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {isPending && (
                                revokingId === inv.id ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      disabled={isRevoking}
                                      onClick={() => handleRevokeInvitation(inv.id)}
                                      className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10.5px] font-bold transition-colors disabled:opacity-50"
                                    >
                                      {isRevoking ? 'Revoking...' : 'Confirm'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isRevoking}
                                      onClick={() => setRevokingId(null)}
                                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10.5px] font-semibold transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setRevokingId(inv.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors text-[11px] font-medium"
                                    title="Revoke pending invitation"
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>Revoke</span>
                                  </button>
                                )
                              )}
                              {!isPending && (
                                <span className="text-slate-300 text-[11px]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
