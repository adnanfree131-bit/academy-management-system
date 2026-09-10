import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { TenantTrialStatus } from '@apex/shared-types';
import { 
  AlertOctagon, 
  CreditCard, 
  UploadCloud, 
  Clock, 
  PhoneCall, 
  Mail, 
  CheckCircle2, 
  RefreshCw,
  LogOut
} from 'lucide-react';

interface LockoutModalProps {
  onUnlocked?: () => void;
}

export const TrialExpiredLockoutModal: React.FC<LockoutModalProps> = ({ onUnlocked }) => {
  const { tenant, token, logout } = useAuth();
  const [trialStatus, setTrialStatus] = useState<TenantTrialStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Form State
  const [amount, setAmount] = useState<number>(15000);
  const [planMonths, setPlanMonths] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string>('');

  const fetchTrialStatus = async () => {
    if (!tenant?.id) return;
    try {
      const res = await fetch(`/api/v1/saas/trial-status?tenant_id=${tenant.id}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const body = await res.json();
        setTrialStatus(body.data);
        if (!body.data.is_locked && onUnlocked) {
          onUnlocked();
        }
      }
    } catch (err) {
      console.error('Failed fetching trial status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialStatus();
  }, [tenant?.id, token]);

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id || !amount || !referenceNumber) {
      setErrorMsg('Please enter valid amount and bank transaction reference number.');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/saas/receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          tenant_id: tenant.id,
          amount: Number(amount),
          plan_duration_months: Number(planMonths),
          payment_method: paymentMethod,
          reference_number: referenceNumber,
          receipt_image_url: receiptUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
          notes
        })
      });

      if (res.ok) {
        setSuccessMsg('Payment proof receipt uploaded successfully! Super-Admin will verify and unlock your account.');
        fetchTrialStatus();
      } else {
        const d = await res.json();
        setErrorMsg(d.error?.message || 'Failed submitting payment proof.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission error.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!trialStatus?.is_locked) return null;

  const banking = trialStatus.banking_config;
  const pendingReceipt = trialStatus.pending_receipt;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-rose-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Warning Banner */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-rose-900 text-white p-6 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/30 border border-rose-300/40 text-rose-200 flex items-center justify-center">
                <AlertOctagon className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <img src="/kampus-logo.png" alt="Kampus" className="h-4 w-auto object-contain mr-1" />
                  <span className="px-2 py-0.5 bg-rose-500/40 text-rose-200 text-[10px] font-black uppercase tracking-wider rounded-md border border-rose-400/40">
                    Subscription Expired
                  </span>
                  <span className="text-xs text-rose-200 font-mono">Status: {trialStatus.status.toUpperCase()}</span>
                </div>
                <h2 className="text-xl font-black tracking-tight mt-1">
                  Subscription Expired — {trialStatus.tenant_name}
                </h2>
              </div>
            </div>

            <button
              onClick={logout}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-white/20"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>

          <p className="text-xs text-rose-100 mt-3 leading-relaxed bg-rose-950/40 p-3 rounded-xl border border-rose-400/30">
            {trialStatus.lock_reason || 'Your 30-day free trial has expired. To continue using the academy system, please transfer the subscription fee to the bank details below and submit your receipt for immediate account activation.'}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          
          {/* Pending Receipt Notification Banner */}
          {pendingReceipt && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
              <div className="text-xs">
                <div className="font-bold text-sm text-amber-950 flex items-center gap-2">
                  <span>Subscription Payment Receipt Under Review</span>
                  <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-mono rounded text-[10px]">
                    Ref: {pendingReceipt.reference_number}
                  </span>
                </div>
                <p className="mt-0.5 text-amber-800">
                  You submitted a payment proof for PKR {pendingReceipt.amount.toLocaleString()} ({pendingReceipt.plan_duration_months} Month(s)) on {new Date(pendingReceipt.created_at).toLocaleDateString()}. Super-Admin will verify the funds and unlock your academy shortly.
                </p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Official Super-Admin Bank Account Details */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Official Payment Bank Details
                </h3>
              </div>

              {banking ? (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Bank Name</span>
                    <p className="font-bold text-slate-900 text-sm">{banking.bank_name}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{banking.branch_code}</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Account Title</span>
                    <p className="font-bold text-slate-900 text-sm">{banking.account_title}</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Account / IBAN Number</span>
                    <p className="font-mono font-black text-slate-900 text-sm tracking-wide">{banking.account_number}</p>
                    {banking.iban && (
                      <p className="font-mono text-[11px] text-indigo-600 font-semibold">{banking.iban}</p>
                    )}
                  </div>

                  <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1 text-[11px]">
                    <span className="text-[10px] text-indigo-800 uppercase font-bold">Standard Subscription Rate</span>
                    <p className="font-black text-indigo-950 text-base">
                      PKR {banking.monthly_subscription_fee.toLocaleString()} <span className="text-xs font-normal text-indigo-700">/ month</span>
                    </p>
                  </div>

                  {banking.instructions && (
                    <div className="text-[11px] text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200">
                      "{banking.instructions}"
                    </div>
                  )}

                  {/* Hotlines */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                    {banking.whatsapp_support && (
                      <a 
                        href={`https://wa.me/${banking.whatsapp_support.replace(/\D/g, '')}?text=Hello%20Apex%20Support,%20we%20have%20transferred%20the%20subscription%20fee%20for%20${encodeURIComponent(trialStatus.tenant_name)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
                      >
                        <PhoneCall className="w-3 h-3" /> WhatsApp Support
                      </a>
                    )}
                    {banking.support_email && (
                      <a href={`mailto:${banking.support_email}`} className="text-indigo-600 font-bold hover:underline flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {banking.support_email}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Loading banking details...</p>
              )}
            </div>

            {/* Right Column: Upload Receipt Form */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Upload Bank Transfer Proof
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={fetchTrialStatus}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  title="Refresh Status"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleSubmitReceipt} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Plan Duration:</label>
                    <select
                      value={planMonths}
                      onChange={e => {
                        const m = Number(e.target.value);
                        setPlanMonths(m);
                        setAmount((banking?.monthly_subscription_fee || 15000) * m);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                    >
                      <option value={1}>1 Month (PKR 15,000)</option>
                      <option value={3}>3 Months (PKR 45,000)</option>
                      <option value={6}>6 Months (PKR 90,000)</option>
                      <option value={12}>1 Year (PKR 180,000)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount Transferred (PKR):</label>
                    <input
                      type="number"
                      required
                      value={amount}
                      onChange={e => setAmount(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Channel:</label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="BANK_TRANSFER">Online Bank Transfer</option>
                      <option value="RAAST_INSTANT">Raast Instant Pay</option>
                      <option value="ATM_DEPOSIT">ATM Cash Deposit</option>
                      <option value="CHEQUE">Cheque / Pay Order</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Transaction Ref / TRX ID *:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ALF-9948210"
                      value={referenceNumber}
                      onChange={e => setReferenceNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Screenshot / Receipt Image URL:</label>
                  <input
                    type="text"
                    placeholder="https://... receipt image or upload URL"
                    value={receiptUrl}
                    onChange={e => setReceiptUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Leave blank for default verified mock receipt</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Additional Notes / Branch info:</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Transferred from Meezan Bank via Raast to Bank Alfalah at 10:15 AM."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !referenceNumber}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Submitting Receipt...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      Submit Bank Transfer Receipt
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <img src="/kampus-logo.png" alt="Kampus" className="h-4 w-auto object-contain" />
            <span className="text-slate-300">|</span>
            <span>Subscription & Licensing Platform</span>
          </div>
          <button
            onClick={logout}
            className="text-slate-600 hover:text-slate-900 font-bold hover:underline flex items-center gap-1"
          >
            Switch Account / Sign In as Different Academy
          </button>
        </div>
      </div>
    </div>
  );
};
