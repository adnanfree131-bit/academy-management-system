import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ALL_PORTAL_DESKS, PORTAL_GROUPS, deskCount } from '../lib/portalAccess';
import {
  Users,
  Plus,
  X,
  ShieldCheck,
  ShieldOff,
  RefreshCw,
  Check,
} from 'lucide-react';

interface StaffRow {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  designation: string;
  status: string;
  permissions: string[];
}

export const StaffDeskView: React.FC = () => {
  const { token } = useAuth();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [accessFor, setAccessFor] = useState<StaffRow | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    designation: '',
    password: '',
  });

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/academic/staff', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 404) {
        throw new Error('Staff API is not on the live server yet. Wait a minute for Render, then refresh.');
      }
      if (!res.ok) throw new Error(body.error?.message || 'Could not load staff.');
      setRows(body.data || []);
    } catch (err: any) {
      setError(err.message || 'Could not load staff.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    const res = await fetch('/api/v1/academic/staff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error?.message || 'Could not add staff.');
      return;
    }
    setAddOpen(false);
    setForm({ full_name: '', email: '', phone: '', designation: '', password: '' });
    await load();
    setAccessFor(body.data);
  };

  const saveAccess = async (staff: StaffRow, permissions: string[]) => {
    if (!token) return;
    setSavingId(staff.id);
    const res = await fetch(`/api/v1/academic/staff/${staff.id}/access`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions }),
    });
    const body = await res.json();
    setSavingId(null);
    if (!res.ok) {
      setError(body.error?.message || 'Could not update access.');
      return;
    }
    const next = body.data as StaffRow;
    setRows(prev => prev.map(r => (r.id === next.id ? { ...r, ...next } : r)));
    setAccessFor(next);
  };

  const toggleDesk = (staff: StaffRow, deskId: string) => {
    const on = staff.permissions.includes(deskId);
    const permissions = on
      ? staff.permissions.filter(p => p !== deskId)
      : [...staff.permissions, deskId];
    saveAccess(staff, permissions);
  };

  const setAll = (staff: StaffRow, grant: boolean) => {
    saveAccess(staff, grant ? ALL_PORTAL_DESKS.map(d => d.id) : []);
  };

  const toggleActive = async (staff: StaffRow) => {
    if (!token) return;
    const status = staff.status === 'active' ? 'inactive' : 'active';
    const res = await fetch(`/api/v1/academic/staff/${staff.id}/access`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = await res.json();
    if (res.ok) {
      setRows(prev => prev.map(r => (r.id === staff.id ? { ...r, status } : r)));
    } else {
      setError(body.error?.message || 'Could not update status.');
    }
  };

  const totalDesks = deskCount();

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Staff</h1>
            <p className="text-sm text-slate-500">
              Add teachers, accountants, and coordinators. Then grant each desk of the academy portal.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setAddOpen(true); setError(null); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          Add staff
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">{error}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading staff…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            No staff yet. Add a person, then use Access to open the desks they need.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Email</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">Designation</th>
                <th className="px-5 py-3 font-medium">Portal access</th>
                <th className="px-5 py-3 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const granted = row.permissions.length;
                return (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{row.full_name}</p>
                      <p className="text-xs text-slate-500 sm:hidden">{row.email}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600 hidden sm:table-cell">{row.email}</td>
                    <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{row.designation || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium ${granted ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {granted} / {totalDesks} desks
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleActive(row)}
                        className="mr-2 text-xs text-slate-500 hover:text-slate-800"
                      >
                        {row.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAccessFor(row); setError(null); }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                      >
                        Access
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={addStaff}
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add staff</h2>
              <button type="button" onClick={() => setAddOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              They sign in on this academy with the email and password you set. Then you grant desks.
            </p>
            <input
              required
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              placeholder="Full name"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2"
            />
            <input
              required
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2"
            />
            <input
              value={form.designation}
              onChange={e => setForm({ ...form, designation: e.target.value })}
              placeholder="Designation (Teacher, Accountant, Coordinator…)"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2"
            />
            <input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone (optional)"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2"
            />
            <input
              required
              type="password"
              minLength={6}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Sign-in password (min 6 characters)"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setAddOpen(false)} className="px-3 py-2 text-xs rounded-lg border border-slate-200">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white">
                Save and set access
              </button>
            </div>
          </form>
        </div>
      )}

      {accessFor && (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 flex justify-end">
          <div className="w-full max-w-lg h-full bg-white border-l border-slate-200 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Portal access</h2>
                <p className="text-sm text-slate-600 mt-0.5">{accessFor.full_name}</p>
                <p className="text-xs text-slate-500">
                  {accessFor.designation || 'Staff'} · {accessFor.permissions.length} of {totalDesks} desks open
                </p>
              </div>
              <button type="button" onClick={() => setAccessFor(null)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setAll(accessFor, true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white"
              >
                Grant all
              </button>
              <button
                type="button"
                onClick={() => setAll(accessFor, false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700"
              >
                Revoke all
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {PORTAL_GROUPS.map(group => (
                <div key={group.group}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">{group.group}</p>
                  <div className="space-y-2">
                    {group.desks.map(desk => {
                      const on = accessFor.permissions.includes(desk.id);
                      return (
                        <div
                          key={desk.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{desk.label}</p>
                            <p className="text-xs text-slate-500">{desk.hint}</p>
                          </div>
                          <button
                            type="button"
                            disabled={savingId === accessFor.id}
                            onClick={() => toggleDesk(accessFor, desk.id)}
                            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                              on
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                          >
                            {on ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                            {on ? 'Granted' : 'Revoked'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-400">
                Dashboard stays available so they can sign in. Academy Settings stays with the administrator.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Changes apply on their next screen load.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
