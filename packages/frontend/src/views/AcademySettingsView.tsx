import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Landmark,
  Clock,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  GraduationCap,
  UploadCloud,
  X,
  Globe,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Users,
  Plus,
  Trash2,
  FileCheck,
  ArrowUp,
  ArrowDown,
  Edit2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { AcademicSession, TenantSettings, defaultAcademicSessions, DocumentChecklistHead } from '@apex/shared-types';
import { compressImageFile } from '../components/LoginModal';
import { PageHeading } from '../components/PageHeading';
import { SectionInfo } from '../components/SectionInfo';
import { InstitutionalLoader } from '../components/InstitutionalLoader';

export const AcademySettingsView: React.FC = () => {
  const { token, tenant, user, applySession, refreshSession, setWorkingSession } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<'profile' | 'departments' | 'challan' | 'documents' | 'shifts' | 'security'>('profile');
  const [batches, setBatches] = useState<{ id: string; academic_session?: string }[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Departments State
  const [departments, setDepartments] = useState<string[]>([
    'Science', 'Mathematics', 'Humanities', 'Languages', 'Commerce', 'Administration', 'Accounts'
  ]);
  const [newDeptInput, setNewDeptInput] = useState<string>('');

  // Director Password Change State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState<boolean>(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  // Form State
  const [academyName, setAcademyName] = useState<string>('');
  const [campusName, setCampusName] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [subdomain, setSubdomain] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [academicSession, setAcademicSession] = useState<string>('2026-2027');
  const [academicSessions, setAcademicSessions] = useState<AcademicSession[]>(() => defaultAcademicSessions('2026-2027'));
  const [newSessionStart, setNewSessionStart] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [affiliationNo, setAffiliationNo] = useState<string>('');

  // Bank Details for Challan
  const [bankName, setBankName] = useState<string>('');
  const [accountTitle, setAccountTitle] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [iban, setIban] = useState<string>('');
  const [raastId, setRaastId] = useState<string>('');

  const [dueDay, setDueDay] = useState<number>(10);
  const [graceDays, setGraceDays] = useState<number>(5);
  const [paymentAllocationPriority, setPaymentAllocationPriority] = useState<string[]>([]);
  const [feeHeads, setFeeHeads] = useState<{ id: string; name: string; code: string; is_system_default?: boolean }[]>([]);
  const [newHeadName, setNewHeadName] = useState('');
  const [editingHeadId, setEditingHeadId] = useState<string | null>(null);
  const [editingHeadName, setEditingHeadName] = useState('');
  const [otpModal, setOtpModal] = useState<'change' | 'reset' | null>(null);

  // Kinship Rules State
  const [kinshipEnabled, setKinshipEnabled] = useState<boolean>(true);
  const [kinshipDiscountPercentage, setKinshipDiscountPercentage] = useState<number>(20);
  const [kinshipApplicableTo, setKinshipApplicableTo] = useState<string>('2nd child onwards');
  const [kinshipRuleDescription, setKinshipRuleDescription] = useState<string>('20% concession on monthly tuition for second and subsequent siblings enrolled in the academy.');
  const [kinshipRequireActiveSibling, setKinshipRequireActiveSibling] = useState<boolean>(true);

  // Document Checklist Heads State
  const [documentChecklistHeads, setDocumentChecklistHeads] = useState<DocumentChecklistHead[]>([]);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCode, setNewDocCode] = useState('');
  const [newDocRequired, setNewDocRequired] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocTitle, setEditingDocTitle] = useState('');
  const [editingDocRequired, setEditingDocRequired] = useState(false);

  // Next Academic Session Modal State
  const [showNextSessionModal, setShowNextSessionModal] = useState<boolean>(false);
  const [nextSessionStep, setNextSessionStep] = useState<1 | 2 | 3>(1);
  const [targetSessionName, setTargetSessionName] = useState<string>('');
  const [isCopyingClasses, setIsCopyingClasses] = useState<boolean>(false);
  const [isMovingStudents, setIsMovingStudents] = useState<boolean>(false);
  const [copiedBatchCount, setCopiedBatchCount] = useState<number>(0);
  const [nextSessionSourceBatches, setNextSessionSourceBatches] = useState<Array<{ id: string; name: string; shift: string; current_enrollment: number }>>([]);
  const [nextSessionTargetBatches, setNextSessionTargetBatches] = useState<Array<{ id: string; name: string; shift: string; copied_from_batch_id?: string | null }>>([]);
  const [nextSessionMappings, setNextSessionMappings] = useState<Record<string, { action: 'move' | 'retain' | 'leave'; target_batch_id: string }>>({});
  const [moveStats, setMoveStats] = useState<{ moved: number; retained: number; left: number; skipped: number } | null>(null);
  const [nextSessionError, setNextSessionError] = useState<string | null>(null);

  const handleOpenNextSessionModal = () => {
    const active = tenant?.academic_session || academicSession || '2026-2027';
    const inactive = academicSessions.filter(s => !s.is_active && s.name !== active);
    setTargetSessionName(inactive[0]?.name || '');
    setNextSessionStep(1);
    setNextSessionError(null);
    setShowNextSessionModal(true);
  };

  const loadBatchesForMove = async (sourceSess: string, targetSess: string) => {
    if (!token) return;
    try {
      const [srcRes, tgtRes] = await Promise.all([
        fetch(`/api/v1/academic/batches?academic_session=${encodeURIComponent(sourceSess)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/academic/batches?academic_session=${encodeURIComponent(targetSess)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const srcData = await srcRes.json();
      const tgtData = await tgtRes.json();

      const srcList: any[] = (srcData.success && Array.isArray(srcData.data)) ? srcData.data : [];
      const tgtList: any[] = (tgtData.success && Array.isArray(tgtData.data)) ? tgtData.data : [];

      setNextSessionSourceBatches(srcList);
      setNextSessionTargetBatches(tgtList);

      const initialMappings: Record<string, { action: 'move' | 'retain' | 'leave'; target_batch_id: string }> = {};
      for (const src of srcList) {
        const match = tgtList.find(t => t.copied_from_batch_id === src.id) ||
          tgtList.find(t => t.name.toLowerCase() === src.name.toLowerCase()) ||
          tgtList[0];
        initialMappings[src.id] = {
          action: 'move',
          target_batch_id: match ? match.id : '',
        };
      }
      setNextSessionMappings(initialMappings);
    } catch (e) {
      console.error('Failed to load batches for move', e);
    }
  };

  const handleCopyClasses = async () => {
    if (!token || !targetSessionName) return;
    const active = tenant?.academic_session || academicSession || '2026-2027';
    setIsCopyingClasses(true);
    setNextSessionError(null);

    try {
      const res = await fetch('/api/v1/academic/sessions/copy-classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source_session: active,
          target_session: targetSessionName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.code === 'YEAR_NOT_EMPTY') {
          await loadBatchesForMove(active, targetSessionName);
          setNextSessionStep(2);
          return;
        }
        throw new Error(data.error?.message || 'Failed to copy classes into target session');
      }

      setCopiedBatchCount(data.created_count || 0);
      await loadBatchesForMove(active, targetSessionName);
      setNextSessionStep(2);
    } catch (err: any) {
      setNextSessionError(err.message || 'Error copying classes');
    } finally {
      setIsCopyingClasses(false);
    }
  };

  const handleExecuteMoveStudents = async () => {
    if (!token) return;
    const active = tenant?.academic_session || academicSession || '2026-2027';
    setIsMovingStudents(true);
    setNextSessionError(null);

    const mappings = Object.entries(nextSessionMappings).map(([source_batch_id, m]) => ({
      source_batch_id,
      action: m.action,
      target_batch_id: m.action === 'leave' ? undefined : m.target_batch_id,
    }));

    try {
      const res = await fetch('/api/v1/academic/sessions/move-students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source_session: active,
          target_session: targetSessionName,
          mappings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to move students into new session');
      }

      setMoveStats({
        moved: data.moved || 0,
        retained: data.retained || 0,
        left: data.left || 0,
        skipped: data.skipped || 0,
      });
      setNextSessionStep(3);
    } catch (err: any) {
      setNextSessionError(err.message || 'Error moving students');
    } finally {
      setIsMovingStudents(false);
    }
  };

  const handleMakeTargetActive = async () => {
    if (!token || !targetSessionName) return;
    try {
      const updatedSessions = academicSessions.map(s => ({
        ...s,
        is_active: s.name === targetSessionName,
      }));

      const res = await fetch('/api/v1/saas/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          academic_session: targetSessionName,
          academic_sessions: updatedSessions,
        }),
      });

      if (res.ok) {
        await fetch('/api/v1/academic/working-session', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ academic_session: targetSessionName }),
        });

        setAcademicSession(targetSessionName);
        setAcademicSessions(updatedSessions);
        if (setWorkingSession) setWorkingSession(targetSessionName);
        if (refreshSession) await refreshSession();
      }
    } catch (e) {
      console.error('Failed to make target session active', e);
    } finally {
      setShowNextSessionModal(false);
    }
  };

  const handleAddDocHead = () => {
    if (!newDocTitle.trim()) return;
    const code = newDocCode.trim()
      ? newDocCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
      : newDocTitle.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 20);

    if (documentChecklistHeads.some(h => h.code === code)) {
      alert(`A document head with code "${code}" already exists.`);
      return;
    }

    const newHead: DocumentChecklistHead = {
      id: `doc-${Date.now()}`,
      code,
      title: newDocTitle.trim(),
      is_required: newDocRequired,
    };

    setDocumentChecklistHeads(prev => [...prev, newHead]);
    setNewDocTitle('');
    setNewDocCode('');
    setNewDocRequired(false);
  };

  const handleDeleteDocHead = (id: string) => {
    setDocumentChecklistHeads(prev => prev.filter(h => h.id !== id));
  };

  const handleToggleDocRequired = (id: string) => {
    setDocumentChecklistHeads(prev => prev.map(h => h.id === id ? { ...h, is_required: !h.is_required } : h));
  };

  const handleMoveDocHead = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === documentChecklistHeads.length - 1)) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const next = [...documentChecklistHeads];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setDocumentChecklistHeads(next);
  };

  const handleStartEditDocHead = (head: DocumentChecklistHead) => {
    setEditingDocId(head.id);
    setEditingDocTitle(head.title);
    setEditingDocRequired(Boolean(head.is_required));
  };

  const handleSaveEditDocHead = () => {
    if (!editingDocId || !editingDocTitle.trim()) return;
    setDocumentChecklistHeads(prev => prev.map(h => h.id === editingDocId ? {
      ...h,
      title: editingDocTitle.trim(),
      is_required: editingDocRequired,
    } : h));
    setEditingDocId(null);
    setEditingDocTitle('');
  };

  const handleClearAllDocHeads = () => {
    if (confirm('Clear all document requirements? Enrolling students will not have any document requirements.')) {
      setDocumentChecklistHeads([]);
    }
  };


  // Shifts
  const [morningStart, setMorningStart] = useState<string>('08:00');
  const [morningEnd, setMorningEnd] = useState<string>('13:30');
  const [eveningStart, setEveningStart] = useState<string>('15:00');
  const [eveningEnd, setEveningEnd] = useState<string>('19:30');

  // Load Settings
  const fetchSettings = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/academic/academy-settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        const t = data.data;
        const s = t.settings || {};
        setAcademyName(t.name || tenant?.name || '');
        setCampusName(s.campus_name || tenant?.campus_name || '');
        const sessionName = s.academic_session || tenant?.academic_session || '2026-2027';
        setAcademicSession(sessionName);
        const rawSessions: AcademicSession[] = Array.isArray(s.academic_sessions) && s.academic_sessions.length > 0
          ? (s.academic_sessions as AcademicSession[])
          : defaultAcademicSessions(sessionName);
        setAcademicSessions(rawSessions);
        const dummyEmail = !s.email || s.email === 'info@kampus.pk';
        const dummyAff = !s.affiliation_number || String(s.affiliation_number).includes('BISE/LHR-2026');
        const dummyAddr = !s.address || String(s.address).includes('Campus Avenue');
        const dummyPhone = !s.phone || s.phone.includes('300 1234567');
        setPhone(dummyPhone ? '' : s.phone);
        setEmail(dummyEmail ? '' : s.email);
        setAddress(dummyAddr ? '' : s.address);
        setAffiliationNo(dummyAff ? '' : s.affiliation_number);

        if (s.logo_url) setLogoUrl(s.logo_url);
        if (s.city) setCity(s.city);
        if (s.subdomain || t.slug) setSubdomain(s.subdomain || t.slug);
        if (s.domain || t.domain) setDomain(s.domain || t.domain);

        setBankName(s.bank_name || '');
        setAccountTitle(s.account_title || '');
        setAccountNumber(s.account_number || '');
        setIban(s.iban || '');
        setRaastId(s.raast_id || (s as any).payment_settings?.raast_id || '');

        const feeRules = (s as any).fee_rules;
        if (feeRules) {
          if (feeRules.due_day) setDueDay(feeRules.due_day);
          if (feeRules.grace_days) setGraceDays(feeRules.grace_days);
          if (feeRules.kinship_rules) {
            setKinshipEnabled(feeRules.kinship_rules.enabled ?? true);
            setKinshipDiscountPercentage(feeRules.kinship_rules.discount_percentage ?? 20);
            setKinshipApplicableTo(feeRules.kinship_rules.applicable_to ?? '2nd child onwards');
            setKinshipRuleDescription(feeRules.kinship_rules.description ?? '20% concession on monthly tuition for second and subsequent siblings enrolled in the academy.');
            setKinshipRequireActiveSibling(feeRules.kinship_rules.require_active_sibling ?? true);
          }
        }

        if (s.shifts) {
          if (s.shifts.morning) {
            setMorningStart(s.shifts.morning.start || '08:00');
            setMorningEnd(s.shifts.morning.end || '13:30');
          }
          if (s.shifts.evening) {
            setEveningStart(s.shifts.evening.start || '15:00');
            setEveningEnd(s.shifts.evening.end || '19:30');
          }
        }

        const rawDocs = s.document_checklist_heads;
        if (Array.isArray(rawDocs)) {
          setDocumentChecklistHeads(rawDocs);
        } else {
          setDocumentChecklistHeads([]);
        }
        if (s.departments && Array.isArray(s.departments) && s.departments.length > 0) {
          setDepartments(s.departments);
        }
      }

      fetch('/api/v1/academic/batches', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(bData => {
          if (bData.success && Array.isArray(bData.data)) {
            setBatches(bData.data);
          }
        })
        .catch(() => {});

      const headsRes = await fetch('/api/v1/finance/heads', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const headsBody = await headsRes.json().catch(() => ({}));
      const heads = (headsBody.data || []).map((h: any) => ({
        id: String(h.id || ''),
        name: String(h.name || ''),
        code: String(h.code || ''),
        is_system_default: Boolean(h.is_system_default || h.code === 'TUITION'),
      }));
      setFeeHeads(heads);
      const savedOrder: string[] = data?.data?.settings?.fee_rules?.priority_order || [];
      const dummyKeys = ['admission_fee', 'exam_fee', 'lab_fee', 'tuition_fee', 'fine'];
      const looksDummy = savedOrder.length === 0 || savedOrder.every((k: string) => dummyKeys.includes(k));
      if (looksDummy) {
        setPaymentAllocationPriority(heads.map((h: { name: string }) => h.name));
      } else {
        const known = savedOrder.filter((name: string) => heads.some((h: { name: string; id: string }) => h.name === name || h.id === name));
        const missing = heads.map((h: { name: string }) => h.name).filter((n: string) => !known.includes(n));
        setPaymentAllocationPriority([...known, ...missing]);
      }
    } catch (err) {
      console.error('Failed to load academy settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);



  // 60-second cooldown timer effect (starts ONLY on 200 OK from server)
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSecurityError(null);
    setSecuritySuccess(null);

    if (!currentPassword) {
      setSecurityError('Current password is required.');
      return;
    }
    if (newPassword.length < 6) {
      setSecurityError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setSecurityError('New password cannot be the same as your current password.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/v1/auth/change-password-otp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message || 'Failed to send verification code.');
      }
      setCooldown(body.data?.cooldown_seconds || 60);
      setOtpCode('');
      setOtpModal('change');
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to send verification code.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (!token || otpCode.trim().length !== 6) {
      setSecurityError('Enter the 6-digit code from your email.');
      return;
    }
    setIsChangingPassword(true);
    setSecurityError(null);
    try {
      if (otpModal === 'reset') {
        const res = await fetch('/api/v1/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user?.email,
            otp: otpCode.trim(),
            new_password: newPassword,
            tenant_slug: tenant?.slug,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error?.message || 'Failed to reset password.');
      } else {
        const res = await fetch('/api/v1/auth/change-password', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
            otp: otpCode.trim(),
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error?.message || 'Failed to update password.');
        if (applySession && body.data) applySession(body.data);
      }
      setSecuritySuccess('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpCode('');
      setOtpModal(null);
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleForgotOldPassword = async () => {
    if (!user?.email) return;
    setSecurityError(null);
    setIsRequestingOtp(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, tenant_slug: tenant?.slug }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || 'Failed to send code.');
      setOtpCode('');
      setOtpModal('reset');
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to send code.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const headLocked = (h: { code: string; name: string; is_system_default?: boolean }) =>
    h.code === 'TUITION' || h.name.toLowerCase().includes('monthly tuition');

  const refreshFeeHeads = async () => {
    if (!token) return;
    const headsRes = await fetch('/api/v1/finance/heads', { headers: { Authorization: `Bearer ${token}` } });
    const headsBody = await headsRes.json().catch(() => ({}));
    const heads = (headsBody.data || []).map((h: any) => ({
      id: String(h.id || ''),
      name: String(h.name || ''),
      code: String(h.code || ''),
      is_system_default: Boolean(h.is_system_default || h.code === 'TUITION'),
    }));
    setFeeHeads(heads);
    setPaymentAllocationPriority(prev => {
      const names = heads.map((h: { name: string }) => h.name);
      const kept = prev.filter(n => names.includes(n));
      const missing = names.filter((n: string) => !kept.includes(n));
      return [...kept, ...missing];
    });
  };

  const handleAddFeeHead = async () => {
    if (!token || !newHeadName.trim()) return;
    const code = newHeadName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 16);
    const res = await fetch('/api/v1/finance/heads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newHeadName.trim(), code, default_amount: 0, priority_order: feeHeads.length + 1 }),
    });
    if (res.ok) {
      setNewHeadName('');
      await refreshFeeHeads();
    }
  };

  const handleSaveHeadName = async (id: string) => {
    if (!token || !editingHeadName.trim()) return;
    await fetch(`/api/v1/finance/heads/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingHeadName.trim() }),
    });
    setEditingHeadId(null);
    await refreshFeeHeads();
  };

  const handleDeleteFeeHead = async (id: string) => {
    if (!token) return;
    await fetch(`/api/v1/finance/heads/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await refreshFeeHeads();
  };



  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file (PNG, JPG, SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Logo file size must be less than 2MB.');
      return;
    }
    try {
      const compressed = await compressImageFile(file, 400, 400, 0.85);
      setLogoUrl(compressed);
      setErrorMsg(null);
    } catch {
      setErrorMsg('Failed to process uploaded logo image.');
    }
  };

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const updatedSettings: Partial<TenantSettings> = {
      campus_name: campusName,
      academic_session: academicSessions.find(s => s.is_active)?.name || academicSession,
      academic_sessions: academicSessions,
      phone,
      email,
      address,
      city,
      logo_url: logoUrl,
      subdomain,
      domain,
      domain_verified: true,
      affiliation_number: affiliationNo,
      bank_name: bankName,
      account_title: accountTitle,
      account_number: accountNumber,
      iban,
      raast_id: raastId,
      fee_rules: {
        due_day: dueDay,
        grace_days: graceDays,
        priority_order: paymentAllocationPriority,
        kinship_rules: {
          enabled: kinshipEnabled,
          discount_percentage: kinshipDiscountPercentage,
          applicable_to: kinshipApplicableTo,
          description: kinshipRuleDescription,
          require_active_sibling: kinshipRequireActiveSibling,
        },
      },
      shifts: {
        morning: { start: morningStart, end: morningEnd },
        evening: { start: eveningStart, end: eveningEnd },
      },
      departments: departments,
      document_checklist_heads: documentChecklistHeads,
    };

    try {
      const res = await fetch('/api/v1/academic/academy-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: academyName,
          settings: updatedSettings,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to save settings');

      setSuccessMsg('Institutional academy settings updated successfully. Challans and badges updated.');
      if (refreshSession) refreshSession();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <PageHeading
        title="Settings"
        description="Manage campus profile, bank accounts for fee challans, shift timings, and fee payment rules."
        icon={<Building2 className="w-4 h-4 text-slate-700" />}
      />

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      {isLoading ? (
        <InstitutionalLoader variant="card" label="Loading academy operational profile..." />
      ) : (
        <div className="space-y-6">
          {/* Institutional Navigation Tabs - Native Segmented Control */}
          {/* Mobile Tab Selector (Eliminates horizontal scrolling hurdle) */}
          <div className="sm:hidden w-full">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Settings Section</label>
            <select
              value={activeTab}
              onChange={e => {
                const tab = e.target.value as any;
                setActiveTab(tab);
                setSuccessMsg(null);
                setErrorMsg(null);
                if (tab === 'security') {
                  setSecurityError(null);
                  setSecuritySuccess(null);
                }
              }}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 shadow-xs focus:ring-2 focus:ring-slate-900"
            >
              <option value="profile">Campus Profile</option>
              <option value="departments">Academic Departments</option>
              <option value="challan">Bank & Challan Rules</option>
              <option value="documents">Admission Document Heads</option>
              <option value="shifts">Shift Timings</option>
              <option value="security">Security & Sessions</option>
            </select>
          </div>

          {/* Desktop/Tablet Segmented Control */}
          <div className="hidden sm:flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 text-xs font-semibold overflow-x-auto no-scrollbar whitespace-nowrap">
            <button
              type="button"
              onClick={() => { setActiveTab('profile'); setSuccessMsg(null); setErrorMsg(null); }}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 touch-press ${
                activeTab === 'profile'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Campus Profile</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('departments'); setSuccessMsg(null); setErrorMsg(null); }}
              className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 touch-press ${
                activeTab === 'departments'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-sky-600" />
              <span>Departments</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('challan'); setSuccessMsg(null); setErrorMsg(null); }}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 touch-press ${
                activeTab === 'challan'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bank & Challan</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('documents'); setSuccessMsg(null); setErrorMsg(null); }}
              className={`flex-1 min-w-[140px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 touch-press ${
                activeTab === 'documents'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Admission Documents</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('shifts'); setSuccessMsg(null); setErrorMsg(null); }}
              className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 touch-press ${
                activeTab === 'shifts'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span>Shift Timings</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('security'); setSecurityError(null); setSecuritySuccess(null); }}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 touch-press ${
                activeTab === 'security'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Security</span>
            </button>
          </div>

          {activeTab !== 'security' ? (
            <form onSubmit={handleSave} className="space-y-6">
              {/* SECTION 1: INSTITUTION PROFILE */}
              {activeTab === 'profile' && (
                <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <SectionInfo
                      title="Campus Profile"
                      description="Institutional details, brand logo, and campus contact information"
                    />
                  </div>

                  {/* Academy Logo Card */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="w-16 h-16 rounded-xl border border-slate-300 bg-white p-1 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Academy Logo" className="w-full h-full object-contain" />
                      ) : (
                        <GraduationCap className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="block text-xs font-bold text-slate-800">Academy Brand Logo</span>
                      <span className="block text-[11px] text-slate-500">
                        Reflected on your white-labeled login screen, student profiles, and official fee challans.
                      </span>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>{logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                        </button>
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl(null)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Remove Logo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dedicated Portal Domain Card (Verified & Active) */}
                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-slate-700" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-800">Dedicated Portal Domain</span>
                        <span className="block text-[11px] font-mono text-slate-600 mt-0.5">
                          https://{subdomain}.kampus.pk
                        </span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100/80 border border-emerald-300 text-emerald-800 rounded-full text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Domain Verified & Active</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Institution Name</label>
                      <input
                        type="text"
                        value={academyName}
                        onChange={e => setAcademyName(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Campus Title</label>
                      <input
                        type="text"
                        value={campusName}
                        onChange={e => setCampusName(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Academic Sessions</label>
                      <p className="text-[11px] text-slate-500 mb-2">
                        The active academic session is the global default across all batches, admissions, and fee challans. Open a year to look at that year’s classes. Set Active is the year the campus is running.
                      </p>
                      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                        {academicSessions.map(sess => {
                          const isWorkingYear = (user?.working_session || tenant?.academic_session) === sess.name;
                          return (
                            <div key={sess.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-slate-800">{sess.name}</span>
                                {sess.is_active && (
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Global Default
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isWorkingYear}
                                  onClick={() => setWorkingSession(sess.name)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                                    isWorkingYear
                                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-default'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer'
                                  }`}
                                >
                                  {isWorkingYear ? 'Viewing' : 'Open'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAcademicSessions(prev => prev.map(s => ({ ...s, is_active: s.id === sess.id })));
                                    setAcademicSession(sess.name);
                                  }}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                                    sess.is_active
                                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer'
                                  }`}
                                >
                                  {sess.is_active ? 'Active' : 'Set Active'}
                                </button>
                                {!sess.is_active && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (batches.some(b => b.academic_session === sess.name)) {
                                        alert('This year has class records. Keep it so history stays.');
                                        return;
                                      }
                                      setAcademicSessions(prev => prev.filter(s => s.id !== sess.id));
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                    title={`Remove session ${sess.name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="number"
                          min={2000}
                          max={2100}
                          value={newSessionStart}
                          onChange={e => setNewSessionStart(e.target.value)}
                          placeholder="Start year e.g. 2029"
                          className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-md p-2 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const y = parseInt(newSessionStart, 10);
                            if (!y) return;
                            const name = `${y}-${y + 1}`;
                            if (academicSessions.some(s => s.start_year === y)) return;
                            setAcademicSessions(prev => [...prev, {
                              id: `session-${y}`,
                              name,
                              start_year: y,
                              end_year: y + 1,
                              is_active: false,
                            }].sort((a, b) => a.start_year - b.start_year));
                            setNewSessionStart('');
                          }}
                          className="px-3 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-md text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Affiliation / Registration #</label>
                      <input
                        type="text"
                        value={affiliationNo}
                        onChange={e => setAffiliationNo(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Contact Phone</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Contact Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Campus Physical Address</label>
                      <input
                        type="text"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: STAFF & ACADEMIC DEPARTMENTS */}
              {activeTab === 'departments' && (
                <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-5">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <SectionInfo
                      title="Staff & Academic Departments"
                      description="Configure institutional departments for your faculty and administration. These departments populate staff onboarding, registers, and analytics."
                    />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-bold">
                      {departments.length} Departments
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newDeptInput}
                      onChange={e => setNewDeptInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = newDeptInput.trim();
                          if (trimmed && !departments.includes(trimmed)) {
                            setDepartments([...departments, trimmed]);
                            setNewDeptInput('');
                          }
                        }
                      }}
                      placeholder="Enter department name (e.g., Computer Science, Accounts, Physical Education)..."
                      className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newDeptInput.trim();
                        if (trimmed && !departments.includes(trimmed)) {
                          setDepartments([...departments, trimmed]);
                          setNewDeptInput('');
                        }
                      }}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Department</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-3">
                      Active Department Roster
                    </label>
                    {departments.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-xs font-medium">No departments registered yet.</p>
                        <p className="text-[11px] text-slate-400">Add departments above to organize staff members.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {departments.map((dept, idx) => (
                          <div
                            key={dept}
                            className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-xl shadow-xs group hover:border-slate-300 transition-all"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-semibold text-slate-800 truncate">{dept}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDepartments(departments.filter(d => d !== dept))}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                              title={`Remove ${dept}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 2 & 3: BANK DETAILS & PAYMENT ALLOCATION */}
              {activeTab === 'challan' && (
                <>
                  <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <SectionInfo
                        title="Fee Challan Bank Accounts"
                        description="Banking details rendered on institutional fee challans (Bank, Academy, Student copies)"
                      />
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        Printed on Challans
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Designated Bank Name</label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={e => setBankName(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Title</label>
                        <input
                          type="text"
                          value={accountTitle}
                          onChange={e => setAccountTitle(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Number</label>
                        <input
                          type="text"
                          value={accountNumber}
                          onChange={e => setAccountNumber(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">IBAN (24 Characters)</label>
                        <input
                          type="text"
                          value={iban}
                          onChange={e => setIban(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800 font-bold"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Raast ID <span className="text-slate-400 font-normal">(Optional — Registered mobile number or Raast ID for instant fee transfers)</span>
                        </label>
                        <input
                          type="text"
                          value={raastId}
                          onChange={e => setRaastId(e.target.value)}
                          placeholder="e.g. 03001234567 or Raast ID (leave blank if not applicable)"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <SectionInfo
                        title="Fee Invoicing & Payment Allocation"
                        description="Set the due day and the order used when a parent pays part of a bill"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Default Due Day of Month</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            max="28"
                            value={dueDay}
                            onChange={e => setDueDay(parseInt(e.target.value) || 10)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 font-bold"
                            required
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">th of month</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Grace Period Days</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="15"
                            value={graceDays}
                            onChange={e => setGraceDays(parseInt(e.target.value) || 0)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 font-bold"
                            required
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">days</span>
                        </div>
                      </div>

                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-3">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block mb-1">Fee heads</span>
                        <p className="text-[11px] text-slate-500 mb-2">
                          Monthly tuition stays. Add, rename, or remove every other head. Partial payments follow the order below.
                        </p>
                        <div className="flex gap-2 mb-2">
                          <input
                            value={newHeadName}
                            onChange={e => setNewHeadName(e.target.value)}
                            className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                          />
                          <button type="button" onClick={handleAddFeeHead} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs transition-colors">
                            Add head
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {feeHeads.map(head => (
                            <div key={head.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200">
                              {editingHeadId === head.id ? (
                                <input
                                  value={editingHeadName}
                                  onChange={e => setEditingHeadName(e.target.value)}
                                  className="flex-1 text-xs border border-slate-200 rounded px-2 py-1"
                                />
                              ) : (
                                <span className="flex-1 text-xs font-semibold text-slate-800">
                                  {head.name}
                                  {headLocked(head) ? <span className="ml-2 text-[10px] text-slate-400 font-medium">kept</span> : null}
                                </span>
                              )}
                              {headLocked(head) ? null : editingHeadId === head.id ? (
                                <button type="button" onClick={() => handleSaveHeadName(head.id)} className="text-[10px] px-2 py-0.5 border rounded">Save</button>
                              ) : (
                                <>
                                  <button type="button" onClick={() => { setEditingHeadId(head.id); setEditingHeadName(head.name); }} className="text-[10px] px-2 py-0.5 border rounded">Edit</button>
                                  <button type="button" onClick={() => handleDeleteFeeHead(head.id)} className="text-[10px] px-2 py-0.5 border rounded text-rose-600">Delete</button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block mb-1">Payment order for partial fees</span>
                        <p className="text-[11px] text-slate-500 mb-2">
                          If a parent pays less than the full bill, money is applied in this order.
                        </p>
                        {paymentAllocationPriority.length === 0 ? (
                          <p className="text-xs text-slate-500">Add a fee head first.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {paymentAllocationPriority.map((item, idx) => (
                              <div key={item} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200">
                                <span className="text-xs font-semibold text-slate-800">
                                  {idx + 1}. {item}
                                </span>
                                <span className="flex gap-1">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => {
                                      const next = [...paymentAllocationPriority];
                                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                      setPaymentAllocationPriority(next);
                                    }}
                                    className="px-2 py-0.5 text-[10px] border border-slate-200 rounded disabled:opacity-30"
                                  >
                                    Up
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === paymentAllocationPriority.length - 1}
                                    onClick={() => {
                                      const next = [...paymentAllocationPriority];
                                      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                      setPaymentAllocationPriority(next);
                                    }}
                                    className="px-2 py-0.5 text-[10px] border border-slate-200 rounded disabled:opacity-30"
                                  >
                                    Down
                                  </button>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Institutional Kinship / Sibling Concession Policy */}
                  <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <SectionInfo
                        title="Kinship / Sibling Concession Policy"
                        description="Define the institutional tuition discount rules applied to siblings at admission"
                      />
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                        Shown at Admission
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={kinshipEnabled}
                          onChange={e => setKinshipEnabled(e.target.checked)}
                          className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          Enable Institutional Sibling / Kinship Concession Policy
                        </span>
                      </label>

                      {kinshipEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Standard Sibling Concession Rate (%)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={kinshipDiscountPercentage}
                                onChange={e => setKinshipDiscountPercentage(Number(e.target.value) || 0)}
                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 font-bold"
                              />
                              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Default percentage deducted from monthly tuition.</p>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Applicable Sibling Tier
                            </label>
                            <input
                              type="text"
                              value={kinshipApplicableTo}
                              onChange={e => setKinshipApplicableTo(e.target.value)}
                              placeholder="e.g. 2nd child onwards"
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-medium"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Institutional eligibility criteria.</p>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Policy Terms & Official Description
                            </label>
                            <input
                              type="text"
                              value={kinshipRuleDescription}
                              onChange={e => setKinshipRuleDescription(e.target.value)}
                              placeholder="Official wording displayed on admission desk..."
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Rendered on the admission form when kinship discount is selected.</p>
                          </div>

                          <div className="sm:col-span-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <label className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={kinshipRequireActiveSibling}
                                onChange={e => setKinshipRequireActiveSibling(e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900"
                              />
                              <div>
                                <span className="text-xs font-bold text-slate-800 block">
                                  Enforce Sibling Verification at Admission
                                </span>
                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                  Requires receptionists to search and link an actively enrolled sibling record before applying kinship rates.
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* SECTION: ADMISSION DOCUMENT CHECKLIST HEADS */}
              {activeTab === 'documents' && (
                <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <SectionInfo
                      title="Admission Document Checklist Heads"
                      description="Configure institutional document requirements collected during student admission. Custom heads dynamically update the admission desk checklist and student verification profiles."
                    />
                    <button
                      type="button"
                      onClick={handleClearAllDocHeads}
                      disabled={documentChecklistHeads.length === 0}
                      className="text-xs text-rose-600 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 self-start sm:self-auto disabled:opacity-40"
                    >
                      Clear All Document Heads
                    </button>
                  </div>

                  {/* Add New Document Head Form */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Add Document Head
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Document Title <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newDocTitle}
                          onChange={e => setNewDocTitle(e.target.value)}
                          placeholder="e.g. Birth Certificate, Immunization Record, Previous School SLC, National ID"
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Identifier Code (Optional)
                        </label>
                        <input
                          type="text"
                          value={newDocCode}
                          onChange={e => setNewDocCode(e.target.value)}
                          placeholder="e.g. BIRTH_CERT"
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>

                      <div className="sm:col-span-3 flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer pb-2 sm:pb-0">
                          <input
                            type="checkbox"
                            checked={newDocRequired}
                            onChange={e => setNewDocRequired(e.target.checked)}
                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-bold text-slate-700">Mandatory</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleAddDocHead}
                          disabled={!newDocTitle.trim()}
                          className="flex-1 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Head</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Configured Document Heads Table */}
                  {documentChecklistHeads.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-slate-500 text-xs">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-slate-700">No document requirements defined yet.</p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                        Institutions have unique requirements. Add document heads using the form above to require specific documents from enrolling students.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] uppercase font-mono tracking-wider">
                            <th className="py-2.5 px-3 text-left font-semibold w-16">Order</th>
                            <th className="py-2.5 px-3 text-left font-semibold">Document Title</th>
                            <th className="py-2.5 px-3 text-left font-semibold w-36">Code Identifier</th>
                            <th className="py-2.5 px-3 text-left font-semibold w-28">Requirement</th>
                            <th className="py-2.5 px-3 text-right font-semibold w-28">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {documentChecklistHeads.map((head, idx) => (
                            <tr key={head.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveDocHead(idx, 'up')}
                                    disabled={idx === 0}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveDocHead(idx, 'down')}
                                    disabled={idx === documentChecklistHeads.length - 1}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>

                              <td className="py-2.5 px-3">
                                {editingDocId === head.id ? (
                                  <input
                                    type="text"
                                    value={editingDocTitle}
                                    onChange={e => setEditingDocTitle(e.target.value)}
                                    className="w-full px-2.5 py-1 text-xs bg-white border border-indigo-400 rounded focus:outline-none"
                                  />
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="font-semibold text-slate-900">{head.title}</span>
                                  </div>
                                )}
                              </td>

                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {head.code}
                                </span>
                              </td>

                              <td className="py-2.5 px-3">
                                {editingDocId === head.id ? (
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingDocRequired}
                                      onChange={e => setEditingDocRequired(e.target.checked)}
                                      className="w-3.5 h-3.5 rounded text-indigo-600"
                                    />
                                    <span className="text-[11px] font-semibold text-slate-700">Mandatory</span>
                                  </label>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleDocRequired(head.id)}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                                      head.is_required
                                        ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                                        : 'text-slate-600 bg-slate-100 border-slate-200 hover:bg-slate-200'
                                    }`}
                                    title="Click to toggle Mandatory / Optional"
                                  >
                                    {head.is_required ? 'Mandatory' : 'Optional'}
                                  </button>
                                )}
                              </td>

                            <td className="py-2.5 px-3 text-right">
                              {editingDocId === head.id ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={handleSaveEditDocHead}
                                    className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold hover:bg-emerald-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingDocId(null)}
                                    className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[11px] hover:bg-slate-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditDocHead(head)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                                    title="Edit Document Head"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDocHead(head.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                    title="Delete Document Head"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500">
                    <strong>Tip:</strong> Document heads defined here appear directly in the Student Admission checklist and on the Student Profile verification desk. Remember to click <strong>Save Academy Settings</strong> below to persist your changes.
                  </p>
                </div>
              )}

              {/* SECTION 4: CAMPUS SHIFTS */}
              {activeTab === 'shifts' && (
                <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <SectionInfo
                      title="Shift Operating Hours"
                      description="Configure morning and evening shift operational schedules"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                      <span className="text-xs font-bold text-slate-800 block">Morning Shift Timings</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Start Time</label>
                          <input
                            type="time"
                            value={morningStart}
                            onChange={e => setMorningStart(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">End Time</label>
                          <input
                            type="time"
                            value={morningEnd}
                            onChange={e => setMorningEnd(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                      <span className="text-xs font-bold text-slate-800 block">Evening Shift Timings</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Start Time</label>
                          <input
                            type="time"
                            value={eveningStart}
                            onChange={e => setEveningStart(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">End Time</label>
                          <input
                            type="time"
                            value={eveningEnd}
                            onChange={e => setEveningEnd(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Action */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                {activeTab === 'profile' && (user?.role === 'tenant_admin' || user?.role === 'super_admin') && (
                  <button
                    type="button"
                    onClick={handleOpenNextSessionModal}
                    className="w-full sm:w-auto px-6 py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <span>Start next session</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isSaving ? 'Saving Configuration...' : 'Save Academy Settings'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* ISOLATED FORM FOR ACCOUNT SECURITY: NO NESTED FORMS */
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <SectionInfo
                    title="Change Password"
                    description="Enter current and new password. A confirmation code will be emailed to you."
                  />
                </div>

                {securitySuccess && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold">{securitySuccess}</span>
                  </div>
                )}

                {securityError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-bold">{securityError}</span>
                  </div>
                )}

                {/* Password Change Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Current Password */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Current Administrative Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-slate-900"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      New Password (min. 6 characters)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-slate-900"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-900"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleForgotOldPassword}
                    disabled={isRequestingOtp}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {isRequestingOtp ? 'Sending code…' : 'Forgot old password?'}
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword || !currentPassword || !newPassword}
                    className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isChangingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>{isChangingPassword ? 'Sending code…' : 'Update password'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {otpModal && (
        <div className="fixed inset-0 z-[90] bg-slate-900/50 flex items-center justify-center p-4 no-sheet-overlay">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Enter email code</h3>
            <p className="text-xs text-slate-500 mt-1">
              A 6-digit code was sent to your email. It expires in 10 minutes.
            </p>
            {otpModal === 'reset' && (
              <div className="mt-3 space-y-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5"
                />
              </div>
            )}
            <input
              autoFocus
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              className="mt-3 w-full text-center text-base font-mono tracking-[0.3em] border border-slate-200 rounded-lg py-1.5"
            />
            {securityError && <p className="text-xs text-rose-600 mt-2">{securityError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOtpModal(null)} className="h-8.5 px-3.5 py-1.5 text-xs rounded-lg border border-slate-200 cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOtp}
                disabled={isChangingPassword || otpCode.length !== 6}
                className="h-8.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white disabled:opacity-50 shadow-xs transition-colors cursor-pointer"
              >
                {isChangingPassword ? 'Checking…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: START NEXT SESSION / MOVE STUDENTS */}
      {showNextSessionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 mobile-sheet">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 max-h-[92dvh] flex flex-col justify-between mobile-sheet-card overflow-y-auto space-y-4">
            <div>
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                    <GraduationCap className="w-4 h-4 text-amber-600" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {nextSessionStep === 1
                        ? 'Start next session'
                        : nextSessionStep === 2
                        ? 'Move students'
                        : 'Session Transition Complete'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {nextSessionStep === 1
                        ? 'Copy this year’s classes into the next year. Students move in the next step.'
                        : nextSessionStep === 2
                        ? `Assign students from ${tenant?.academic_session || academicSession} to sections in ${targetSessionName}.`
                        : `Students have been moved into ${targetSessionName}.`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNextSessionModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Error Notice */}
              {nextSessionError && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{nextSessionError}</span>
                </div>
              )}

              {/* Step 1: Copy Classes Form */}
              {nextSessionStep === 1 && (
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Copy from
                    </label>
                    <div className="w-full text-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-mono font-semibold flex items-center justify-between">
                      <span>{tenant?.academic_session || academicSession || '2026-2027'}</span>
                      <span className="text-[10px] uppercase font-sans font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Active Year
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Copy into <span className="text-rose-500">*</span>
                    </label>
                    {academicSessions.filter(s => !s.is_active && s.name !== (tenant?.academic_session || academicSession)).length === 0 ? (
                      <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                        Add a year in Academic Sessions first.
                      </p>
                    ) : (
                      <select
                        value={targetSessionName}
                        onChange={e => setTargetSessionName(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium"
                      >
                        {academicSessions
                          .filter(s => !s.is_active && s.name !== (tenant?.academic_session || academicSession))
                          .map(s => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Move Students Table */}
              {nextSessionStep === 2 && (
                <div className="space-y-3 mt-4">
                  {copiedBatchCount > 0 && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Copied {copiedBatchCount} classes into {targetSessionName}. Students have not been moved yet.</span>
                    </div>
                  )}

                  {nextSessionSourceBatches.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">
                      No source batches found in {tenant?.academic_session || academicSession}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[50vh] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 text-slate-600 font-semibold">
                          <tr>
                            <th className="py-2 px-3">From</th>
                            <th className="py-2 px-3 text-center">Students</th>
                            <th className="py-2 px-3">Action</th>
                            <th className="py-2 px-3">To class</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {nextSessionSourceBatches.map(b => {
                            const m = nextSessionMappings[b.id] || { action: 'move', target_batch_id: '' };
                            return (
                              <tr key={b.id} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {b.name} <span className="text-[11px] text-slate-500 font-normal">({b.shift})</span>
                                </td>
                                <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                                  {b.current_enrollment ?? 0}
                                </td>
                                <td className="py-2 px-3">
                                  <select
                                    value={m.action}
                                    onChange={e => {
                                      const action = e.target.value as 'move' | 'retain' | 'leave';
                                      let target_batch_id = m.target_batch_id;
                                      if (action === 'retain') {
                                        const match = nextSessionTargetBatches.find(t => t.copied_from_batch_id === b.id) || nextSessionTargetBatches[0];
                                        target_batch_id = match ? match.id : '';
                                      }
                                      setNextSessionMappings(prev => ({
                                        ...prev,
                                        [b.id]: { action, target_batch_id }
                                      }));
                                    }}
                                    className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium"
                                  >
                                    <option value="move">Move to class</option>
                                    <option value="retain">Stay in same class</option>
                                    <option value="leave">Mark as left</option>
                                  </select>
                                </td>
                                <td className="py-2 px-3">
                                  {m.action === 'leave' ? (
                                    <span className="text-slate-400 text-xs italic">Graduating / Leaving</span>
                                  ) : (
                                    <select
                                      value={m.target_batch_id}
                                      onChange={e => {
                                        const target_batch_id = e.target.value;
                                        setNextSessionMappings(prev => ({
                                          ...prev,
                                          [b.id]: { ...m, target_batch_id }
                                        }));
                                      }}
                                      className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium max-w-[200px]"
                                    >
                                      {nextSessionTargetBatches.map(tb => (
                                        <option key={tb.id} value={tb.id}>
                                          {tb.name} ({tb.shift})
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Set Active Step */}
              {nextSessionStep === 3 && (
                <div className="space-y-4 mt-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Students successfully moved into {targetSessionName}!</span>
                    </p>
                    {moveStats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                        <div>Moved: <strong>{moveStats.moved}</strong></div>
                        <div>Retained: <strong>{moveStats.retained}</strong></div>
                        <div>Left: <strong>{moveStats.left}</strong></div>
                        <div>Skipped: <strong>{moveStats.skipped}</strong></div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">
                    Would you like to make <strong>{targetSessionName}</strong> the active academic session across the academy now?
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              {nextSessionStep === 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowNextSessionModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyClasses}
                    disabled={isCopyingClasses || !targetSessionName || academicSessions.filter(s => !s.is_active && s.name !== (tenant?.academic_session || academicSession)).length === 0}
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white disabled:opacity-50 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isCopyingClasses ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Copy classes</span>
                  </button>
                </>
              )}

              {nextSessionStep === 2 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowNextSessionModal(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteMoveStudents}
                    disabled={isMovingStudents || nextSessionSourceBatches.length === 0}
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white disabled:opacity-50 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isMovingStudents ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Move students</span>
                  </button>
                </>
              )}

              {nextSessionStep === 3 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowNextSessionModal(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Stay on {tenant?.academic_session || academicSession}
                  </button>
                  <button
                    type="button"
                    onClick={handleMakeTargetActive}
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    Make {targetSessionName} active
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
