import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (screenId: string) => void;
}

const ADMIN_MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'enrollment', label: 'Student Admissions' },
  { id: 'id_cards', label: 'Student ID Cards' },
  { id: 'classes', label: 'Classes & Batches' },
  { id: 'timetable', label: 'Timetable & Scheduling' },
  { id: 'attendance', label: 'Student Attendance' },
  { id: 'absentee', label: 'Absence Follow-Up' },
  { id: 'homework', label: 'Homework & Notebooks' },
  { id: 'exams', label: 'Exams & Results' },
  { id: 'voucher', label: 'Fee Invoices & Vouchers' },
  { id: 'expenses', label: 'Income & Expenses' },
  { id: 'payroll', label: 'Staff Payroll' },
  { id: 'geofence', label: 'Staff Attendance' },
  { id: 'complaints', label: 'Complaints & Feedback' },
  { id: 'settings', label: 'Academy Settings' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, onNavigate }) => {
  const { token, user } = useAuth();
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<{ id: string; full_name: string; roll_number: string; admission_number: string; guardian_name?: string; phone?: string }[]>([]);
  const [invoices, setInvoices] = useState<{ id: string; invoice_number: string; student_name?: string }[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !token || user?.role === 'super_admin') return;
    let cancelled = false;
    fetch('/api/v1/sis/students', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(body => {
        if (!cancelled && body.success && Array.isArray(body.data)) {
          setStudents(body.data.map((s: any) => ({
            id: s.id,
            full_name: s.full_name,
            roll_number: s.roll_number,
            admission_number: s.admission_number,
            guardian_name: s.guardian_name,
            phone: s.phone || s.guardian_phone,
          })));
        }
      })
      .catch(() => {});
    fetch('/api/v1/finance/invoices', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(body => {
        if (!cancelled && Array.isArray(body.data)) {
          setInvoices(body.data.map((inv: any) => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            student_name: inv.student_name,
          })));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, token, user?.role]);

  const modules = user?.role === 'super_admin'
    ? [{ id: 'superadmin', label: 'Academy Directory' }]
    : ADMIN_MODULES;

  const q = query.trim().toLowerCase();
  const moduleHits = useMemo(
    () => {
      if (!q) return [];
      return modules.filter(m => m.label.toLowerCase().includes(q));
    },
    [modules, q]
  );
  const studentHits = useMemo(
    () => {
      if (!q) return [];
      return students.filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        (s.roll_number || '').toLowerCase().includes(q) ||
        (s.admission_number || '').toLowerCase().includes(q) ||
        (s.guardian_name || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q)
      ).slice(0, 8);
    },
    [students, q]
  );
  const invoiceHits = useMemo(
    () => {
      if (!q) return [];
      return invoices.filter(inv =>
        (inv.invoice_number || '').toLowerCase().includes(q) ||
        (inv.student_name || '').toLowerCase().includes(q)
      ).slice(0, 5);
    },
    [invoices, q]
  );

  const items = [
    ...moduleHits.map(m => ({ kind: 'module' as const, id: m.id, label: m.label, hint: 'Page' })),
    ...studentHits.map(s => ({
      kind: 'student' as const,
      id: s.id,
      label: s.full_name,
      hint: [s.roll_number, s.admission_number].filter(Boolean).join(' · ') || 'Student',
    })),
    ...invoiceHits.map(inv => ({
      kind: 'invoice' as const,
      id: inv.id,
      label: inv.invoice_number,
      hint: inv.student_name || 'Fee challan',
    })),
  ];

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const choose = (item: typeof items[number]) => {
    if (item.kind === 'module') onNavigate(item.id);
    else if (item.kind === 'invoice') onNavigate('voucher');
    else onNavigate('enrollment');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(i => Math.min(i + 1, Math.max(items.length - 1, 0)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(i => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && items[activeIndex]) {
                e.preventDefault();
                choose(items[activeIndex]);
              }
            }}
            placeholder="Search students, fees, pages…"
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent py-1"
          />
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {!q ? (
            <p className="px-4 py-8 text-sm text-slate-500 text-center">
              Type to search students, challans, or pages.
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-xs text-slate-500 text-center">No matching students, fees, or pages.</p>
          ) : items.map((item, idx) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              onClick={() => choose(item)}
              className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 text-sm ${
                idx === activeIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              <span className="font-semibold text-slate-900 truncate">{item.label}</span>
              <span className="text-[10px] font-mono uppercase text-slate-400 shrink-0">{item.hint}</span>
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
          Ctrl+K to open · Enter to open · Esc to close
        </div>
      </div>
    </div>
  );
};
