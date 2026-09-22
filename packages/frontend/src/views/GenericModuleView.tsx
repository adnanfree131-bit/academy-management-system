import React from 'react';
import { CheckCircle2, Phone, Printer, Wallet, UserPlus, Smartphone } from 'lucide-react';

interface ModuleViewProps {
  moduleId: string;
}

export const GenericModuleView: React.FC<ModuleViewProps> = ({ moduleId }) => {
  if (moduleId === 'attendance') {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              Student Attendance
            </h1>
            <p className="text-xs text-slate-500">Record class attendance and send parent notifications</p>
          </div>
          <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors">
            Save Attendance
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Adm No</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Batch / Section</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { adm: 'A-101', name: 'Muhammad Ali Raza', batch: 'Morning Batch 1', status: 'Present' },
                { adm: 'A-102', name: 'Zainab Bibi', batch: 'Morning Batch 1', status: 'Present' },
                { adm: 'A-103', name: 'Usman Farooq', batch: 'Morning Batch 1', status: 'Absent' },
                { adm: 'A-104', name: 'Hamza Shahid', batch: 'Morning Batch 1', status: 'Late' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono font-bold text-slate-700">{row.adm}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-500">{row.batch}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      row.status === 'Present' ? 'bg-emerald-100 text-emerald-800' :
                      row.status === 'Absent' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">Regular attendance</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (moduleId === 'absentee') {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Phone className="w-5 h-5 text-rose-600" />
              Absence Follow-Up
            </h1>
            <p className="text-xs text-slate-500">28 students pending follow-up outreach via WhatsApp</p>
          </div>
          <button className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-xs">
            Start WhatsApp Follow-Up
          </button>
        </div>
      </div>
    );
  }

  if (moduleId === 'voucher') {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-indigo-600" />
              Fee Invoices & Vouchers
            </h1>
            <p className="text-xs text-slate-500">Standard 3-copy printable fee vouchers (Academy, Student, Bank)</p>
          </div>
          <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors">
            Print Batch Vouchers (PDF)
          </button>
        </div>
      </div>
    );
  }

  if (moduleId === 'payroll') {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Staff Payroll & Salaries
            </h1>
            <p className="text-xs text-slate-500">Calculate salaries and generate staff payslips</p>
          </div>
          <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors">
            Generate Monthly Pay Slips
          </button>
        </div>
      </div>
    );
  }

  if (moduleId === 'enrollment') {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Student Admissions & Directory
            </h1>
            <p className="text-xs text-slate-500">Register new students, review inquiries, and update records</p>
          </div>
          <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors">
            New Student Registration
          </button>
        </div>
      </div>
    );
  }

  if (moduleId === 'mobile') {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              Mobile App (PWA)
            </h1>
            <p className="text-xs text-slate-500">Optimized mobile view for smartphones and tablets</p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-lg">
            PWA Ready
          </span>
        </div>
      </div>
    );
  }

  return <div>Module view not found</div>;
};
