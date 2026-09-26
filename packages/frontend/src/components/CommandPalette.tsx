import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canOpenScreen } from '../lib/portalAccess';

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
  { id: 'voucher', label: 'Fees Receiving' },
  { id: 'challans', label: 'Fee Challans' },
  { id: 'fee_reversals', label: 'Fee Reversals' },
  { id: 'expenses', label: 'Income & Expenses' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'geofence', label: 'Staff Attendance' },
  { id: 'complaints', label: 'Complaints & Feedback' },
  { id: 'staff', label: 'Staff' },
  { id: 'settings', label: 'Academy Settings' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, onNavigate }) => {
  const { token, user } = useAuth();
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<{ id: string; full_name: string; admission_number: string; guardian_name?: string; phone?: string }[]>([]);
  const [invoices, setInvoices] = useState<{ id: string; invoice_number: string; student_name?: string }[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      inputRef.current?.focus();
    } else {
      setQuery('');
      setActiveIndex(0);
      if (previouslyFocusedRef.current && document.body.contains(previouslyFocusedRef.current)) {
        previouslyFocusedRef.current.focus();
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'input, button:not([disabled])'
        );
        if (focusableElements.length === 0) return;
        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !token || user?.role === 'super_admin') return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      fetch('/api/v1/sis/students', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(body => {
          if (!cancelled && body.success && Array.isArray(body.data)) {
            setStudents(body.data.map((s: any) => ({
              id: s.id,
              full_name: s.full_name,
              admission_number: s.admission_number,
              guardian_name: s.guardian_name,
              phone: s.phone || s.guardian_phone,
            })));
          }
        }),
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
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, token, user?.role]);

  const modules = user?.role === 'super_admin'
    ? [{ id: 'superadmin', label: 'Academy Directory' }]
    : ADMIN_MODULES.filter(m => canOpenScreen(user?.role, user?.permissions, m.id, user?.access));

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
      hint: s.admission_number ? `Adm: ${s.admission_number}` : 'Student',
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
    else onNavigate(`enrollment?student_id=${item.id}`);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick search and navigation"
      className="fixed inset-0 z-[80] no-sheet-overlay bg-slate-900/50 backdrop-blur-xs flex md:items-start justify-center md:pt-[10vh] p-0 md:px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="w-full md:max-w-lg bg-white h-full md:h-auto md:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-slate-200 bg-white">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            type="search"
            placeholder="Search students, challans, or pages..."
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
            className="flex-1 text-base md:text-sm text-slate-900 placeholder-slate-400 outline-none bg-transparent py-1 font-sans"
          />
          {query && (
            <button 
              type="button" 
              onClick={() => setQuery('')} 
              aria-label="Clear search query"
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button 
            type="button" 
            onClick={onClose} 
            className="md:hidden px-2 py-1 text-xs font-bold text-indigo-600 active:text-indigo-800"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={onClose} 
            aria-label="Close command palette"
            className="hidden md:block p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 md:max-h-80 overflow-y-auto py-1 divide-y divide-slate-100">
          {!q ? (
            <div className="px-4 py-12 text-center space-y-2">
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Search Academy ERP</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Quickly locate student records, fee vouchers, or jump directly to any operational desk.
              </p>
            </div>
          ) : loading && items.length === 0 ? (
            <div className="px-4 py-10 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mx-auto" />
              <p className="text-xs font-medium text-slate-500">Searching academy records...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-600">No matching results found</p>
              <p className="text-[11px] text-slate-400">Try searching by student name, admission number, or invoice #</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                onClick={() => choose(item)}
                className={`w-full text-left px-4 py-3 md:py-2.5 flex items-center justify-between gap-3 text-sm transition-colors active:bg-slate-100 ${
                  idx === activeIndex ? 'bg-slate-50 md:bg-slate-100' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    item.kind === 'student' ? 'bg-blue-500' :
                    item.kind === 'invoice' ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`} />
                  <span className="font-semibold text-slate-900 truncate text-sm">{item.label}</span>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 font-semibold">
                  {item.hint}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Desktop Keyboard Hints Footer */}
        <div className="hidden md:block px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
          Ctrl+K to open · Enter to select · Esc to close
        </div>
      </div>
    </div>
  );
};
