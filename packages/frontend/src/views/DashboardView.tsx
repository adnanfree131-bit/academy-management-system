import React from 'react';
import { 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  TrendingUp, 
  CreditCard, 
  Clock, 
  Send
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (screenId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-5">
      
      {/* Daily Operational Pulse */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-900">Campus Overview</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Campus Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Gulberg III Campus • Morning & Evening Sessions</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => onNavigate('attendance')}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Take Attendance</span>
          </button>
          <button 
            onClick={() => onNavigate('voucher')}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Fee Vouchers</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Active Enrollment</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">1,180</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>+42 new this month</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Today's Attendance</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">94.8%</p>
          <p className="text-[11px] text-slate-500 mt-1">1,118 present • 62 absent</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Absent Students</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 font-mono">28</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-slate-500">Pending Follow-Up</span>
            <button 
              onClick={() => onNavigate('absentee')}
              className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center"
            >
              Follow-Up <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Fee Recovery Rate</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">86.4%</p>
          <p className="text-[11px] text-slate-500 mt-1">PKR 2,420,000 collected</p>
        </div>
      </div>

      {/* Operational Pulse Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Attendance Priority Action Feed */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Today's Classes & Timetable
            </h2>
            <span className="text-xs text-slate-400 font-mono">Today's Schedule</span>
          </div>

          <div className="space-y-2.5">
            {[
              { batch: 'MDCAT Morning - Batch A', teacher: 'Sir Tariq', room: 'Hall 1', time: '08:30 - 10:00 AM', status: 'In Progress', count: '48/50' },
              { batch: 'FSc Pre-Medical - Section B', teacher: 'Prof. Shakeel', room: 'Lab 2', time: '10:15 - 11:45 AM', status: 'Scheduled', count: '42 Enrolled' },
              { batch: 'ECAT Engineering - Section A', teacher: 'Engr. Bilal', room: 'Hall 3', time: '12:00 - 01:30 PM', status: 'Scheduled', count: '55 Enrolled' },
            ].map((session, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-xs font-bold text-slate-800">{session.batch}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Faculty: {session.teacher} • Room: {session.room} • {session.time}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    session.status === 'In Progress' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {session.status}
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{session.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Absentee Rapid Dispatch */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-rose-500" />
              Absence Follow-Up Queue
            </h2>
            <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded border border-rose-200">
              28 Pending
            </span>
          </div>

          <p className="text-xs text-slate-500">
            WhatsApp absence notices prepared for consecutive unexcused absentees.
          </p>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Multi-Day Absence Notice
            </p>
            <p className="text-[11px] leading-relaxed">
              3 students in MDCAT Morning have 3+ consecutive absences this week. Immediate guardian outreach advised.
            </p>
          </div>

          <button 
            onClick={() => onNavigate('absentee')}
            className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Open Absence Follow-Up</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </div>
  );
};
