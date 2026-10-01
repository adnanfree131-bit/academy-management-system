import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, ShieldCheck, ShieldAlert, X, Copy, Check, Smartphone, Trash2 } from 'lucide-react';

interface MfaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MfaSettingsModal: React.FC<MfaSettingsModalProps> = ({ isOpen, onClose }) => {
  const { enrollMfa, verifyMfa, unenrollMfa, listMfaFactors } = useAuth();
  const [factors, setFactors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Enrollment state
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const loadFactors = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeFactors = await listMfaFactors();
      setFactors(activeFactors);
    } catch (err: any) {
      setError(err.message || 'Failed to load MFA factors.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFactors();
      setIsEnrolling(false);
      setEnrollmentData(null);
      setVerificationCode('');
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartEnrollment = async () => {
    setIsEnrolling(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await enrollMfa();
      setEnrollmentData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize MFA enrollment.');
      setIsEnrolling(false);
    }
  };

  const handleVerifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentData || verificationCode.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }
    setIsVerifying(true);
    setError(null);
    try {
      await verifyMfa(enrollmentData.factorId, verificationCode.trim());
      setSuccess('Two-factor authentication has been enabled successfully.');
      setIsEnrolling(false);
      setEnrollmentData(null);
      setVerificationCode('');
      await loadFactors();
    } catch (err: any) {
      setError(err.message || 'Invalid verification code. Please check your authenticator app.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUnenroll = async (factorId: string) => {
    if (!window.confirm('Are you sure you want to remove this authenticator factor? You may lose access to sensitive administrative actions.')) {
      return;
    }
    setError(null);
    try {
      await unenrollMfa(factorId);
      setSuccess('Authenticator factor removed.');
      await loadFactors();
    } catch (err: any) {
      setError(err.message || 'Failed to remove authenticator factor.');
    }
  };

  const handleCopySecret = () => {
    if (!enrollmentData?.secret) return;
    navigator.clipboard.writeText(enrollmentData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Two-Factor Authentication (MFA)</h2>
              <p className="text-xs text-slate-500">Authenticator App (TOTP) Security Controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Enrolled factors list */}
          {!isEnrolling && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 leading-relaxed">
                Authenticator applications generate one-time verification codes required for high-risk operations including role changes, fee reversals, payroll disbursement, and platform administration.
              </div>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {isLoading ? (
                  <div className="p-4 text-center text-xs text-slate-500">Checking configured authenticators...</div>
                ) : factors.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No authenticator apps configured yet. Enable TOTP below to protect your account.
                  </div>
                ) : (
                  factors.map((factor) => (
                    <div key={factor.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Smartphone className="w-4 h-4 text-slate-600" />
                        <div>
                          <div className="text-xs font-medium text-slate-800">
                            {factor.friendly_name || 'TOTP Authenticator'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Status: {factor.status === 'verified' ? 'Active' : 'Unverified'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnenroll(factor.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title="Remove authenticator"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={handleStartEnrollment}
                className="w-full py-2 px-4 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-medium transition-colors"
              >
                + Configure New Authenticator App
              </button>
            </div>
          )}

          {/* Enrollment wizard */}
          {isEnrolling && enrollmentData && (
            <form onSubmit={handleVerifyEnrollment} className="space-y-4">
              <div className="text-xs text-slate-600">
                1. Scan the QR code below using your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password):
              </div>

              <div className="flex justify-center p-3 bg-white border border-slate-200 rounded-lg">
                <img
                  src={enrollmentData.qrCode}
                  alt="MFA QR Code"
                  className="w-44 h-44 border border-slate-100 rounded"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Or enter secret key manually:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={enrollmentData.secret}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                    title="Copy Secret"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  2. Enter the 6-digit code generated by the app:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-widest text-lg font-mono border border-slate-300 rounded-lg py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEnrolling(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || verificationCode.length !== 6}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {isVerifying ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
