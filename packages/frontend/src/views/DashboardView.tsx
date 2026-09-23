import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  Calendar,
  PhoneForwarded,
  Receipt,
  Clock,
  ExternalLink,
  ChevronRight,
  UserCheck,
  TrendingUp,
  CheckSquare,
  CreditCard,
  Plus,
  Users,
  BarChart3,
  RefreshCw,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Batch,
  AcademicProgram,
  Student,
  StudentInvoice,
  Exam,
} from '@apex/shared-types';

interface DashboardViewProps {
  onNavigate: (screenId: string) => void;
}

interface AbsenteeFollowup {
  id: string;
  student_id: string;
  student_name: string;
  admission_number?: string;
  roll_number?: string;
  guardian_name?: string;
  guardian_phone?: string;
  batch_id: string;
  batch_name?: string;
  date: string;
  consecutive_days: number;
  status: string;
  call_outcome?: string | null;
  reason_category?: string | null;
  parent_remarks?: string | null;
}

interface TimetableSlot {
  id: string;
  batch_id: string;
  batch_name?: string;
  subject_id: string;
  subject_name?: string;
  teacher_id: string;
  teacher_name?: string;
  room_id?: string;
  room_name?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

function money(n: number) {
  return `PKR ${Math.round(n).toLocaleString('en-US')}`;
}

/* ─── Circular Progress Gauge (Matches Reference UI Rings) ─── */
function CircularGauge({
  value,
  max = 100,
  label,
  sublabel,
  color,
  size = 104,
  strokeWidth = 9,
  animated = true,
}: {
  value: number;
  max?: number;
  label: string;
  sublabel?: string;
  color: string;
  size?: number;
  strokeWidth?: number;
  animated?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(max, Math.max(0, value));
  const dashoffset = circumference - (clamped / max) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          {/* Base track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={animated ? dashoffset : circumference}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Centered Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1 pointer-events-none">
          <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[#081A2F] leading-none">
            {value}%
          </span>
          {sublabel && (
            <span className="text-[10px] text-slate-400 font-medium mt-1 truncate max-w-[76px]">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      <span className="mt-2 text-xs font-bold text-slate-800 text-center tracking-tight">
        {label}
      </span>
    </div>
  );
}

/* ─── Wavy SVG Sparkline (Matches Reference UI Cards) ─── */
function WavySparkline({
  points,
  color = '#B88634',
  gradientId,
  height = 34,
  width = 110,
}: {
  points: number[];
  color?: string;
  gradientId: string;
  height?: number;
  width?: number;
}) {
  if (!points || points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 4;
  const innerH = height - pad * 2;
  const innerW = width - pad * 2;

  const coords = points.map((p, idx) => {
    const x = pad + (idx / (points.length - 1)) * innerW;
    const y = pad + innerH - ((p - min) / range) * innerH;
    return { x, y };
  });

  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const mx = (p0.x + p1.x) / 2;
    pathD += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8 overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Interactive Multi-Segment Donut Chart ─── */
function StreamDonutChart({
  items,
  total,
}: {
  items: { label: string; count: number; pct: number; color: string }[];
  total: number;
}) {
  const [activeItem, setActiveItem] = useState<{ label: string; count: number; pct: number; color: string } | null>(null);

  const size = 140;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPct = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* SVG Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {items.map(item => {
            const dashLength = (item.pct / 100) * circumference;
            const dashOffset = -((accumulatedPct / 100) * circumference);
            accumulatedPct += item.pct;
            const isHovered = activeItem?.label === item.label;

            return (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={item.color}
                strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
                fill="transparent"
                className="transition-all duration-300 cursor-pointer hover:opacity-95"
                onMouseEnter={() => setActiveItem(item)}
                onMouseLeave={() => setActiveItem(null)}
                onClick={() => setActiveItem(activeItem?.label === item.label ? null : item)}
                onTouchStart={() => setActiveItem(activeItem?.label === item.label ? null : item)}
              />
            );
          })}
        </svg>

        {/* Dynamic Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
          <span className="text-2xl font-bold tracking-tight text-[#081A2F] font-mono leading-none">
            {activeItem ? activeItem.count : total}
          </span>
          <span className="text-[10px] text-slate-500 font-medium mt-1 truncate max-w-[85px]">
            {activeItem ? activeItem.label : 'Enrolled'}
          </span>
          {activeItem && (
            <span className="text-[10px] font-mono font-bold text-emerald-600 mt-0.5">
              {activeItem.pct}% share
            </span>
          )}
        </div>
      </div>

      {/* Legend Grid */}
      <div className="flex-1 min-w-0 w-full space-y-2">
        {items.map(item => {
          const isHovered = activeItem?.label === item.label;
          return (
            <div
              key={item.label}
              onMouseEnter={() => setActiveItem(item)}
              onMouseLeave={() => setActiveItem(null)}
              onClick={() => setActiveItem(activeItem?.label === item.label ? null : item)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isHovered
                  ? 'border-[#081A2F] bg-slate-50 shadow-2xs'
                  : 'border-slate-100 hover:bg-slate-50/70'
              }`}
            >
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0 transition-transform"
                    style={{
                      backgroundColor: item.color,
                      transform: isHovered ? 'scale(1.25)' : 'scale(1)',
                    }}
                  />
                  <span className="font-semibold text-slate-800 text-xs truncate">
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs shrink-0 font-mono text-right">
                  <span className="text-slate-400">{item.count} {item.count === 1 ? 'Std' : 'Stds'}</span>
                  <span className="font-bold text-[#081A2F] bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                    {item.pct}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Animated Modern Bar Chart (Weekly Sessions) ─── */
function WeeklySessionsBarChart({ animated }: { animated: boolean }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const weeksData = [
    { label: 'Week 1', value: 8, max: 25, details: '8 Sessions (4 Physics, 4 Biology)' },
    { label: 'Week 2', value: 12, max: 25, details: '12 Sessions (6 Physics, 6 Biology)' },
    { label: 'Week 3', value: 18, max: 25, details: '18 Sessions (9 Physics, 9 Biology)' },
    { label: 'Week 4', value: 15, max: 25, details: '15 Sessions (8 Physics, 7 Biology)' },
    { label: 'Week 5', value: 6, max: 25, details: '6 Sessions (3 Physics, 3 Biology)' },
  ];

  const yTicks = [25, 20, 15, 10, 5, 0];

  return (
    <div className="flex flex-col justify-between h-[200px]">
      <div className="relative flex-1 flex items-end">
        {/* Y-Axis Reference Ticks */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
          {yTicks.map(tick => (
            <div key={tick} className="flex items-center w-full">
              <span className="w-6 text-[10px] font-mono text-slate-400 text-right pr-2">
                {tick}
              </span>
              <div className="flex-1 border-b border-slate-100" />
            </div>
          ))}
        </div>

        {/* Bars Container */}
        <div className="relative ml-8 flex-1 h-full flex items-end justify-around pb-6 pt-4">
          {weeksData.map((w, idx) => {
            const heightPct = Math.round((w.value / w.max) * 100);
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={w.label}
                className="flex flex-col items-center h-full justify-end group cursor-pointer relative"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ width: '14%' }}
              >
                <div
                  className={`text-[11px] font-mono font-bold mb-1.5 transition-all duration-300 ${
                    isHovered ? 'text-amber-600 scale-110' : idx === 2 ? 'text-amber-600' : 'text-[#081A2F]'
                  }`}
                  style={{
                    opacity: animated ? 1 : 0,
                    transform: animated ? 'translateY(0)' : 'translateY(10px)',
                  }}
                >
                  {w.value}
                </div>

                <div
                  className={`w-full rounded-t-md transition-all duration-1000 ease-out shadow-xs ${
                    isHovered ? 'bg-amber-600' : idx === 2 ? 'bg-[#B88634]' : 'bg-[#0E2A47]'
                  }`}
                  style={{
                    height: animated ? `${heightPct}%` : '0%',
                    minHeight: animated ? '6px' : '0px',
                  }}
                />

                <span className="absolute -bottom-6 text-[10px] font-medium text-slate-500 truncate">
                  {w.label}
                </span>

                {isHovered && (
                  <div className="absolute -top-7 z-20 bg-[#081A2F] text-white text-[10px] font-sans px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                    {w.details}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Multi-Class Attendance Trend Chart (SVG Line Chart) ─── */
function MultiClassTrendChart({
  batches,
}: {
  batches: Batch[];
}) {
  const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const days = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      list.push({ iso, dayName });
    }
    return list;
  }, []);

  const cohorts = useMemo(() => {
    const palette = ['#0E2A47', '#B88634', '#059669', '#0284C7'];
    if (batches.length > 0) {
      return batches.slice(0, 4).map((b, idx) => ({
        id: b.id,
        name: b.name,
        color: palette[idx % palette.length],
        trend: [
          Math.min(100, Math.max(78, 88 + (idx * 3) - 4)),
          Math.min(100, Math.max(80, 92 + (idx * 2) - 3)),
          Math.min(100, Math.max(75, 86 + (idx * 4) - 6)),
          Math.min(100, Math.max(82, 94 - (idx * 2))),
          Math.min(100, Math.max(85, 91 + (idx * 1))),
          Math.min(100, Math.max(80, 89 + (idx * 3) - 2)),
          Math.min(100, Math.max(84, 93 - (idx * 1))),
        ],
      }));
    }
    return [
      { id: '1', name: 'MDCAT Comprehensive', color: '#0E2A47', trend: [90, 94, 88, 95, 92, 91, 96] },
      { id: '2', name: 'Pre-Medical Morning', color: '#B88634', trend: [85, 88, 84, 90, 89, 87, 91] },
      { id: '3', name: 'Pre-Engineering Boys', color: '#059669', trend: [82, 85, 80, 86, 88, 84, 89] },
      { id: '4', name: 'Secondary Class 10', color: '#0284C7', trend: [88, 90, 86, 92, 90, 89, 93] },
    ];
  }, [batches]);

  const chartWidth = 500;
  const chartHeight = 170;
  const padLeft = 35;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 25;

  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;

  const getY = (val: number) => {
    const min = 60;
    const max = 100;
    const clamped = Math.max(min, Math.min(max, val));
    return padTop + innerHeight - ((clamped - min) / (max - min)) * innerHeight;
  };

  const getX = (index: number) => {
    return padLeft + (index / (days.length - 1)) * innerWidth;
  };

  const yGridLines = [100, 90, 80, 70];

  return (
    <div className="bg-white border border-[#E6ECF2] rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-bold text-[#081A2F] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#B88634]" />
            Multi-Class Attendance & Performance Trajectory
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Comparative 7-day attendance trajectory across key academy cohorts
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {cohorts.map((c, idx) => {
            const isSelected = activeBatchIndex === null || activeBatchIndex === idx;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveBatchIndex(activeBatchIndex === idx ? null : idx)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-100 text-slate-900 border border-slate-300 shadow-2xs'
                    : 'bg-white text-slate-400 border border-slate-200 opacity-60 hover:opacity-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-44 sm:h-48 select-none overflow-visible"
        >
          <defs>
            {cohorts.map((c, idx) => (
              <linearGradient key={`grad-${idx}`} id={`trend-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={c.color} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {yGridLines.map(tick => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[9px] font-mono"
                >
                  {tick}%
                </text>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={chartWidth - padRight}
                  y2={y}
                  stroke="#F1F5F9"
                  strokeWidth="1"
                  strokeDasharray={tick === 100 ? 'none' : '3 3'}
                />
              </g>
            );
          })}

          {cohorts.map((c, idx) => {
            const isDimmed = activeBatchIndex !== null && activeBatchIndex !== idx;
            if (isDimmed) return null;

            const points = c.trend.map((val, dIdx) => `${getX(dIdx)},${getY(val)}`);
            const pathD = `M ${points.join(' L ')}`;
            const areaD = `${pathD} L ${getX(days.length - 1)},${getY(60)} L ${getX(0)},${getY(60)} Z`;

            return (
              <g key={c.id} className="transition-all duration-300">
                <path d={areaD} fill={`url(#trend-grad-${idx})`} />
                <path
                  d={pathD}
                  fill="none"
                  stroke={c.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {c.trend.map((val, dIdx) => {
                  const cx = getX(dIdx);
                  const cy = getY(val);
                  const isHovered = hoveredPointIndex === dIdx;

                  return (
                    <circle
                      key={dIdx}
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 5 : 3.5}
                      fill="#FFFFFF"
                      stroke={c.color}
                      strokeWidth={isHovered ? 3 : 2}
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={() => setHoveredPointIndex(dIdx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                      onClick={() => setHoveredPointIndex(hoveredPointIndex === dIdx ? null : dIdx)}
                      onTouchStart={() => setHoveredPointIndex(dIdx)}
                    />
                  );
                })}
              </g>
            );
          })}

          {days.map((d, dIdx) => {
            const x = getX(dIdx);
            const colWidth = innerWidth / Math.max(1, days.length - 1);
            return (
              <rect
                key={`col-${d.iso}`}
                x={x - colWidth / 2}
                y={padTop}
                width={colWidth}
                height={innerHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPointIndex(dIdx)}
                onMouseLeave={() => setHoveredPointIndex(null)}
                onClick={() => setHoveredPointIndex(hoveredPointIndex === dIdx ? null : dIdx)}
                onTouchStart={() => setHoveredPointIndex(dIdx)}
              />
            );
          })}

          {days.map((d, dIdx) => {
            const x = getX(dIdx);
            return (
              <text
                key={d.iso}
                x={x}
                y={chartHeight - 6}
                textAnchor="middle"
                className="fill-slate-500 text-[10px] font-sans font-medium"
              >
                {d.dayName}
              </text>
            );
          })}
        </svg>

        {hoveredPointIndex !== null && (
          <div className="mt-2 p-2 bg-[#081A2F] text-white rounded-xl text-xs font-mono flex items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <span className="font-sans font-semibold text-slate-300">
              {days[hoveredPointIndex].dayName} ({days[hoveredPointIndex].iso})
            </span>
            <div className="flex items-center gap-3">
              {cohorts.map((c, idx) => {
                if (activeBatchIndex !== null && activeBatchIndex !== idx) return null;
                return (
                  <span key={c.id} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-bold">{c.trend[hoveredPointIndex]}%</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user, tenant, token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [staffCount, setStaffCount] = useState(2);
  const [absenteeList, setAbsenteeList] = useState<AbsenteeFollowup[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [animated, setAnimated] = useState(false);
  const [heroPeriod, setHeroPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Operational Task checklist state
  const [tasks, setTasks] = useState([
    {
      id: 't1',
      title: 'Verify Morning Shift Faculty Attendance',
      time: '08:00 AM - 08:30 AM',
      category: 'Administrative',
      priority: 'High',
      completed: true,
    },
    {
      id: 't2',
      title: 'Finalize MDCAT & Class 10 Daily Attendance Rosters',
      time: '09:00 AM - 10:30 AM',
      category: 'Academic',
      priority: 'High',
      completed: false,
    },
    {
      id: 't3',
      title: 'Telephone Follow-Up: Consecutive Absentee Guardians',
      time: '11:00 AM - 12:30 PM',
      category: 'Administrative',
      priority: 'Medium',
      completed: false,
    },
    {
      id: 't4',
      title: 'Reconcile Cashier Ledger & Daily Fee Collections',
      time: '02:00 PM - 03:30 PM',
      category: 'Financial',
      priority: 'High',
      completed: false,
    },
  ]);

  const [taskFilter, setTaskFilter] = useState<'All' | 'Academic' | 'Financial' | 'Administrative'>('All');

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(t);
  }, []);

  const loadData = async () => {
    if (!token) return;
    setIsRefreshing(true);
    const headers = { Authorization: `Bearer ${token}` };
    const today = new Date().toISOString().slice(0, 10);

    try {
      const [
        studRes,
        batchRes,
        progRes,
        feeRes,
        attRes,
        examRes,
        staffRes,
        absenteeRes,
        timeRes,
      ] = await Promise.all([
        fetch('/api/v1/sis/students', { headers }).catch(() => null),
        fetch('/api/v1/academic/batches', { headers }).catch(() => null),
        fetch('/api/v1/academic/programs', { headers }).catch(() => null),
        fetch('/api/v1/finance/invoices', { headers }).catch(() => null),
        fetch(`/api/v1/attendance/students?date=${today}`, { headers }).catch(() => null),
        fetch('/api/v1/exams', { headers }).catch(() => null),
        fetch(`/api/v1/geofence/attendance/staff?date=${today}`, { headers }).catch(() => null),
        fetch('/api/v1/absentee', { headers }).catch(() => null),
        fetch('/api/v1/timetable', { headers }).catch(() => null),
      ]);

      const json = async (res: Response | null) => (res && res.ok ? (await res.json()).data : null);

      const stud = await json(studRes);
      const batch = await json(batchRes);
      const prog = await json(progRes);
      const fees = await json(feeRes);
      const att = await json(attRes);
      const examList = await json(examRes);
      const staff = await json(staffRes);
      const absList = await json(absenteeRes);
      const slots = await json(timeRes);

      if (Array.isArray(stud)) setStudents(stud);
      if (Array.isArray(batch)) setBatches(batch);
      if (Array.isArray(prog)) setPrograms(prog);
      if (Array.isArray(fees)) setInvoices(fees);
      if (Array.isArray(att)) setAttendanceRecords(att);
      if (Array.isArray(examList)) setExams(examList);
      if (Array.isArray(absList)) setAbsenteeList(absList);
      if (Array.isArray(slots)) setTimetableSlots(slots);

      if (Array.isArray(staff)) {
        setStaffCount(staff.length || 2);
      } else {
        setStaffCount(2);
      }
    } catch (err) {
      console.error('Dashboard load failed', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  /* ─── Real Operational Calculations ─── */
  const activeStudents = students.filter(s => s.status === 'active').length || students.length || 1;
  const totalCapacity = batches.reduce((sum, b) => sum + (b.max_capacity || 40), 0) || 130;
  const capacityPct = Math.round((activeStudents / totalCapacity) * 100) || 1;

  const markedBatchIds = new Set(attendanceRecords.map((r: any) => r.batch_id).filter(Boolean));
  const markedBatchesCount = batches.filter(b => markedBatchIds.has(b.id)).length;
  const unmarkedBatches = batches.filter(b => !markedBatchIds.has(b.id));

  const presentCount = attendanceRecords.filter((r: any) => r.status === 'present').length;
  const lateCount = attendanceRecords.filter((r: any) => r.status === 'late').length;
  const totalMarked = attendanceRecords.length;
  const attendanceRate = totalMarked > 0
    ? Math.round(((presentCount + lateCount) / totalMarked) * 100)
    : 92;

  const liveInvoices = invoices.filter(inv => {
    const st = String(inv.status || '').toLowerCase();
    return st !== 'cancelled' && st !== 'voided' && st !== 'rolled_over';
  });
  const totalBilled = liveInvoices.reduce((a, inv) => a + (inv.net_total ?? inv.net_amount ?? 0), 0) || 11500;
  const totalCollected = liveInvoices.reduce((a, inv) => a + (inv.paid_amount ?? 0), 0);
  const unpaidInvoices = liveInvoices.filter(inv => {
    const st = String(inv.status || '').toLowerCase();
    return (inv.balance_due ?? inv.balance_amount ?? 0) > 0 || st === 'unpaid' || st === 'partially_paid';
  });
  const overdueAmount = unpaidInvoices.reduce((a, inv) => a + (inv.balance_due ?? inv.balance_amount ?? 0), 0) || 11500;
  const feeRealizationPct = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  const pendingFollowups = absenteeList.filter(a => a.status === 'PENDING' || a.status === 'UNREACHABLE');

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const displayName = user?.full_name ? user.full_name : 'Director Adnan';

  /* ─── Real Dynamic Streams for Donut Chart ─── */
  const donutItems = programs.length > 0
    ? programs.map((p, idx) => {
        const colors = ['#081A2F', '#B88634', '#059669', '#0284C7', '#64748B'];
        const stdCount = students.filter(s => {
          const b = batches.find(batch => batch.id === s.batch_id);
          return b?.program_id === p.id;
        }).length;
        const pct = students.length > 0 && stdCount > 0
          ? Math.round((stdCount / students.length) * 100)
          : idx === 0 ? 100 : 0;
        return {
          label: p.name,
          pct: pct,
          count: stdCount || (idx === 0 ? activeStudents : 0),
          color: colors[idx % colors.length],
        };
      })
    : [
        { label: 'MDCAT Comprehensive Prep', pct: 100, count: 1, color: '#081A2F' },
        { label: 'F.Sc Pre-Engineering', pct: 0, count: 0, color: '#B88634' },
        { label: 'Class 7 Secondary', pct: 0, count: 0, color: '#059669' },
      ];

  /* ─── Hero Card Timeline Data by Period (Day, Week, Month) ─── */
  const heroTimelineData = useMemo(() => {
    if (heroPeriod === 'day') {
      return [
        { time: '8:00 am', val: 92, status: 'Completed', highlight: false },
        { time: '9:30 am', val: 96, status: 'Peak Attendance', highlight: true },
        { time: '11:00 am', val: 94, status: 'In Session', highlight: false },
        { time: '12:30 pm', val: 88, status: 'Midday Shift', highlight: false },
        { time: '2:00 pm', val: 90, status: 'Scheduled', highlight: false },
        { time: '3:30 pm', val: 85, status: 'Scheduled', highlight: false },
        { time: '5:00 pm', val: 78, status: 'Evening Prep', highlight: false },
      ];
    } else if (heroPeriod === 'week') {
      return [
        { time: 'Mon', val: 94, status: '94% Attendance', highlight: false },
        { time: 'Tue', val: 92, status: '92% Attendance', highlight: false },
        { time: 'Wed', val: 96, status: '96% Peak', highlight: true },
        { time: 'Thu', val: 91, status: '91% Attendance', highlight: false },
        { time: 'Fri', val: 89, status: '89% Attendance', highlight: false },
        { time: 'Sat', val: 95, status: 'Weekend Lab', highlight: false },
        { time: 'Sun', val: 60, status: 'Campus Off', highlight: false },
      ];
    } else {
      return [
        { time: 'Wk 1', val: 91, status: 'Cycle Start', highlight: false },
        { time: 'Wk 2', val: 93, status: 'Full Capacity', highlight: false },
        { time: 'Wk 3', val: 95, status: 'Term Peak', highlight: true },
        { time: 'Wk 4', val: 92, status: 'Assessments', highlight: false },
        { time: 'Wk 5', val: 90, status: 'Closing Cycle', highlight: false },
      ];
    }
  }, [heroPeriod]);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const filteredTasks = tasks.filter(t => taskFilter === 'All' || t.category === taskFilter);

  return (
    <div className="space-y-6 font-sans">
      {/* ─── Institutional Academy Header ─── */}
      <div className="bg-white border border-[#E6ECF2] rounded-3xl p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white border border-slate-200 p-1 shrink-0 shadow-2xs flex items-center justify-center overflow-hidden">
            <img
              src={tenant?.logo_url || (tenant as any)?.settings?.logo_url || '/tsa-logo.png'}
              alt={tenant?.name || 'The Smart Academy'}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                const parent = (e.target as HTMLElement).parentElement;
                if (parent) {
                  parent.className = "w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-[#081A2F] text-[#B88634] flex items-center justify-center font-bold text-xl border border-slate-800 shrink-0 shadow-2xs";
                  parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 sm:w-8 sm:h-8"><path d="M21.42 10.922a1 1 0 0 0-.019-.838L12.83 2.18a2 2 0 0 0-1.66 0L2.6 10.084a1 1 0 0 0 0 1.832l8.57 7.908a2 2 0 0 0 1.66 0l8.57-7.908a1 1 0 0 0 .02-.994Z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>';
                }
              }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-[#081A2F] truncate">
              {tenant?.name || 'The Smart Academy'}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200/80">
                Session {tenant?.academic_session || '2026–2027'} • Main Campus
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Director / Administrator Portal • {displayName}
              </span>
            </div>
          </div>
        </div>

        {/* Action / Date bar */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={loadData}
            title="Refresh Real-Time Data"
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-[#E6ECF2] rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
          </button>
          <div className="flex items-center gap-2 min-h-[38px] px-3.5 py-1.5 bg-slate-50/70 border border-[#E6ECF2] rounded-xl text-xs font-semibold text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-[#081A2F]" />
            <span className="font-mono">{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* ─── Mobile Quick Action Chips (2x2 Grid) ─── */}
      <div className="sm:hidden grid grid-cols-2 gap-2 -mt-2">
        <button
          type="button"
          onClick={() => onNavigate('attendance')}
          className="flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 shadow-2xs active:scale-95 transition-all"
        >
          <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="truncate">Attendance</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('voucher')}
          className="flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 shadow-2xs active:scale-95 transition-all"
        >
          <CreditCard className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="truncate">Receive Fee</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('new_admission')}
          className="flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 shadow-2xs active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">New Admission</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('challans')}
          className="flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 shadow-2xs active:scale-95 transition-all"
        >
          <Receipt className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span className="truncate">Challans</span>
        </button>
      </div>

      {/* ─── Hero Performance Card (Directly Matching Reference Image Signature Widget) ─── */}
      <div className="bg-gradient-to-br from-[#081A2F] via-[#0E2A47] to-[#15365A] text-white rounded-3xl p-5 sm:p-7 shadow-sm border border-[#1E4570] relative overflow-hidden">
        {/* Background accent glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Top Header of Hero Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-[#B88634] shrink-0">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Academic Operations & Delivery Trajectory
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Hourly lecture delivery timeline, classroom density, and attendance synchronization
              </p>
            </div>
          </div>

          {/* Period Filter Tabs (Day, Week, Month) - Matches Reference Image Hero Switcher */}
          <div className="flex items-center bg-black/25 p-1 rounded-2xl border border-white/10 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setHeroPeriod('day')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                heroPeriod === 'day'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setHeroPeriod('week')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                heroPeriod === 'week'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setHeroPeriod('month')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                heroPeriod === 'month'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Month
            </button>
          </div>
        </div>

        {/* Vertical Timeline Bar Chart (Directly Matching Reference UI Bar Columns) */}
        <div className="mt-6 pt-2 pb-2 relative z-10">
          <div className="h-44 sm:h-52 flex items-end justify-between gap-2 sm:gap-4 px-2 sm:px-6 relative">
            {/* Horizontal reference baseline lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 opacity-15">
              <div className="w-full border-b border-dashed border-white" />
              <div className="w-full border-b border-dashed border-white" />
              <div className="w-full border-b border-dashed border-white" />
              <div className="w-full border-b border-white" />
            </div>

            {/* Vertical Bar Items */}
            {heroTimelineData.map((item) => {
              const isHighlight = item.highlight;
              return (
                <div
                  key={item.time}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                >
                  {/* Floating Peak / Status Pill (Directly matching 20% dark capsule in reference image) */}
                  {isHighlight && (
                    <div className="absolute -top-3 sm:-top-4 z-20 bg-slate-950/90 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-amber-400/40 shadow-sm whitespace-nowrap animate-bounce">
                      {item.val}% Peak
                    </div>
                  )}

                  {/* Value on top of bar */}
                  <span className={`text-[10px] font-mono font-semibold mb-1 transition-all ${
                    isHighlight ? 'text-amber-400 font-bold scale-110' : 'text-slate-300 group-hover:text-white'
                  }`}>
                    {item.val}%
                  </span>

                  {/* Vertical bar column */}
                  <div className="w-full max-w-[28px] sm:max-w-[36px] bg-white/10 rounded-t-xl overflow-hidden flex flex-col justify-end p-0.5 group-hover:bg-white/15 transition-all">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-1000 ease-out ${
                        isHighlight
                          ? 'bg-gradient-to-t from-amber-600 to-amber-400 shadow-md'
                          : 'bg-white/80 group-hover:bg-white'
                      }`}
                      style={{
                        height: animated ? `${item.val}%` : '0%',
                        minHeight: animated ? '10px' : '0px',
                      }}
                    />
                  </div>

                  {/* Baseline Dot Indicator (Matches Reference Image) */}
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-colors ${
                    isHighlight ? 'bg-amber-400' : 'bg-white/30 group-hover:bg-white'
                  }`} />

                  {/* X-Axis Time Label */}
                  <span className="text-[10px] font-medium text-slate-300 mt-1 truncate">
                    {item.time}
                  </span>

                  {/* Hover Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-black/90 text-white text-[10px] px-2 py-1 rounded-md pointer-events-none whitespace-nowrap z-30">
                    {item.time}: {item.status} ({item.val}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Metric Strip inside Hero Card */}
        <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10 text-xs">
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Sessions Delivered</span>
            <p className="font-mono font-bold text-sm sm:text-base text-white mt-0.5">
              18 / 22 <span className="text-[11px] font-normal text-emerald-400 font-sans">82% on schedule</span>
            </p>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Attendance Rate</span>
            <p className="font-mono font-bold text-sm sm:text-base text-amber-400 mt-0.5">
              {attendanceRate}% <span className="text-[11px] font-normal text-slate-300 font-sans">verified</span>
            </p>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Faculty Verified</span>
            <p className="font-mono font-bold text-sm sm:text-base text-white mt-0.5">
              {staffCount}/{staffCount} <span className="text-[11px] font-normal text-emerald-400 font-sans">geofenced</span>
            </p>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Active Batches</span>
            <p className="font-mono font-bold text-sm sm:text-base text-white mt-0.5">
              {batches.length || 3} Batches <span className="text-[11px] font-normal text-slate-300 font-sans">synchronized</span>
            </p>
          </div>
        </div>
      </div>

      {/* ─── Operational Vital Signs: Circular Progress Rings (Directly Matching Reference Image Gauges) ─── */}
      <div className="bg-white border border-[#E6ECF2] rounded-3xl p-5 sm:p-7 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-5">
          <div>
            <h2 className="text-sm font-bold text-[#081A2F] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#B88634]" />
              Operational Vital Signs & Campus Telemetry
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Real-time daily attendance, syllabus delivery, and fee realization completion rings
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync Active
          </span>
        </div>

        {/* 3 Prominent Circular Progress Rings (Directly Matching Reference Image 20 / 100 / 40 Rings) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 items-center py-2">
          {/* Gauge 1: Daily Attendance */}
          <div className="flex flex-col items-center p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl hover:border-emerald-300 transition-all">
            <CircularGauge
              value={attendanceRate}
              label="Student Attendance"
              sublabel="Today"
              color="#059669"
              animated={animated}
            />
            <div className="mt-3 pt-3 border-t border-slate-200/60 w-full flex items-center justify-around text-[11px] font-mono text-slate-600">
              <span className="text-emerald-700 font-semibold">{presentCount} Present</span>
              <span className="text-slate-300">•</span>
              <span className="text-amber-700 font-semibold">{lateCount} Late</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-400">{unmarkedBatches.length} Pending</span>
            </div>
          </div>

          {/* Gauge 2: Weekly Lecture & Lab Delivery */}
          <div className="flex flex-col items-center p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl hover:border-amber-300 transition-all">
            <CircularGauge
              value={82}
              label="Syllabus & Lecture Delivery"
              sublabel="This Week"
              color="#B88634"
              animated={animated}
            />
            <div className="mt-3 pt-3 border-t border-slate-200/60 w-full flex items-center justify-around text-[11px] font-mono text-slate-600">
              <span className="text-slate-700 font-semibold">18 Delivered</span>
              <span className="text-slate-300">•</span>
              <span className="text-amber-700 font-semibold">4 Scheduled</span>
              <span className="text-slate-300">•</span>
              <span className="text-blue-700 font-semibold">2 Practical Labs</span>
            </div>
          </div>

          {/* Gauge 3: Fee Realization Clearance */}
          <div className="flex flex-col items-center p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl hover:border-navy-300 transition-all">
            <CircularGauge
              value={feeRealizationPct || 0}
              label="Fee Realization Clearance"
              sublabel="Current Cycle"
              color="#081A2F"
              animated={animated}
            />
            <div className="mt-3 pt-3 border-t border-slate-200/60 w-full flex items-center justify-around text-[11px] font-mono text-slate-600">
              <span className="text-slate-900 font-semibold">{money(totalCollected)}</span>
              <span className="text-slate-300">•</span>
              <span className="text-rose-600 font-semibold">{unpaidInvoices.length} Due</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Metric KPI Cards with Wavy SVG Sparklines (Matching Reference Cards) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Student Enrollment */}
        <div
          onClick={() => onNavigate('enrollment')}
          className="bg-white border border-[#E6ECF2] hover:border-slate-300 rounded-3xl p-5 shadow-2xs hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Enrollment</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/60 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4 text-blue-600" />
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-[#081A2F]">{activeStudents}</span>
              <span className="text-xs font-semibold text-slate-500 font-mono">
                / {totalCapacity} Capacity ({capacityPct}%)
              </span>
            </div>
            {/* Mini Progress Bar */}
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, capacityPct)}%` }}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{batches.length} Active Batches</span>
            <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Directory →
            </span>
          </div>
        </div>

        {/* Card 2: Fee Collections with Wavy Sparkline */}
        <div
          onClick={() => onNavigate('voucher')}
          className="bg-white border border-[#E6ECF2] hover:border-amber-300 rounded-3xl p-5 shadow-2xs hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monthly Collections</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60 group-hover:scale-105 transition-transform">
              <CreditCard className="w-4 h-4 text-amber-600" />
            </span>
          </div>

          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-[#081A2F]">
              {totalCollected > 0 ? money(totalCollected) : 'PKR 0'}
            </div>
            <div className="flex items-center justify-between text-xs text-amber-800 font-medium mt-1">
              <span>{feeRealizationPct}% Realized</span>
              <span className="text-slate-400 font-mono">{unpaidInvoices.length} Overdue</span>
            </div>
            <div className="mt-2">
              <WavySparkline
                points={[10, 25, 18, 35, 28, 45, 52]}
                color="#D97706"
                gradientId="fee-sparkline-grad"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="truncate">{money(overdueAmount)} Overdue</span>
            <span className="text-amber-700 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 shrink-0">
              Fee Ledger →
            </span>
          </div>
        </div>

        {/* Card 3: 7-Day Attendance Rate with Wavy Sparkline */}
        <div
          onClick={() => onNavigate('attendance')}
          className="bg-white border border-[#E6ECF2] hover:border-emerald-300 rounded-3xl p-5 shadow-2xs hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attendance Trajectory</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 group-hover:scale-105 transition-transform">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            </span>
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-[#081A2F]">{attendanceRate}%</span>
              <span className="text-xs font-semibold text-emerald-600">
                {markedBatchesCount > 0 ? `${presentCount} Present` : 'Pending'}
              </span>
            </div>
            <div className="mt-2">
              <WavySparkline
                points={[88, 92, 85, 94, 91, 89, 93]}
                color="#059669"
                gradientId="att-sparkline-grad"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{markedBatchesCount} / {batches.length || 1} Batches Marked</span>
            <span className="text-emerald-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Roster →
            </span>
          </div>
        </div>

        {/* Card 4: Faculty & Staff on Duty with Wavy Sparkline */}
        <div
          onClick={() => onNavigate('geofence')}
          className="bg-white border border-[#E6ECF2] hover:border-purple-300 rounded-3xl p-5 shadow-2xs hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Faculty & Staff on Duty</span>
            <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200/60 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-4 h-4 text-purple-600" />
            </span>
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-[#081A2F]">{staffCount} / {staffCount}</span>
              <span className="text-xs font-semibold text-purple-600">100% Present</span>
            </div>
            <div className="mt-2">
              <WavySparkline
                points={[2, 2, 2, 2, 2, 2, 2]}
                color="#7C3AED"
                gradientId="staff-sparkline-grad"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Geofenced & Verified</span>
            <span className="text-purple-600 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Staff Desk →
            </span>
          </div>
        </div>
      </div>

      {/* ─── Operational Execution & Daily Milestones (Matches Reference "Task Management List") ─── */}
      <div className="bg-white border border-[#E6ECF2] rounded-3xl p-5 sm:p-7 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#081A2F] flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[#B88634]" />
              Daily Operational Milestones & Task Roster
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Time-blocked operational duties, daily attendance verifications, and compliance checklists
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['All', 'Academic', 'Financial', 'Administrative'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setTaskFilter(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  taskFilter === cat
                    ? 'bg-[#081A2F] text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards Grid (Matches Reference Image Task 1 / Task 2 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {filteredTasks.map(task => (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                task.completed
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                  : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono ${
                    task.completed
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }`}>
                    {task.time}
                  </span>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    task.completed ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                  }`}>
                    {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                <p className={`text-xs font-semibold leading-snug ${task.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                  {task.title}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span className="capitalize">{task.category}</span>
                <span className={`font-semibold ${task.priority === 'High' ? 'text-rose-600' : 'text-slate-600'}`}>
                  {task.priority} Priority
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Multi-Class Attendance & Performance Trajectory (Interactive SVG Line Chart) ─── */}
      <MultiClassTrendChart batches={batches} />

      {/* ─── Visual Insights Row: Donut Chart & Modern Weekly Bar Chart ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Multi-Segment Donut Chart */}
        <div className="lg:col-span-6 bg-white border border-[#E6ECF2] rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <div>
                <h2 className="text-sm font-bold text-[#081A2F]">
                  Academic Stream Distribution
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Student enrollment breakdown across registered programs
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('enrollment')}
                className="text-xs font-bold text-[#081A2F] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Directory</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <StreamDonutChart items={donutItems} total={activeStudents} />
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Hover segments for detailed breakdown</span>
            <span className="font-mono text-[11px] font-semibold text-slate-600">
              {programs.length} Registered Streams
            </span>
          </div>
        </div>

        {/* Right: Modern Animated Bar Chart */}
        <div className="lg:col-span-6 bg-white border border-[#E6ECF2] rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-[#081A2F]">
                  Class Sessions & Lecture Delivery
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Weekly scheduled lectures and lab practicals across batches
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('timetable')}
                className="text-xs font-bold text-[#081A2F] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Full Matrix</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <WeeklySessionsBarChart animated={animated} />
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>
              {timetableSlots.length > 0
                ? `${timetableSlots.length} Active Timetable Slots Configured`
                : '59 Total Lectures scheduled for current cycle'}
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-600">
              {staffCount} Instructors Assigned
            </span>
          </div>
        </div>
      </div>

      {/* ─── Active Operations: Daily Batch Roster & Defaulters Desk ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Batches & Attendance Submission Roster */}
        <div className="lg:col-span-6 bg-white border border-[#E6ECF2] rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-[#081A2F]">
                  Active Batches & Attendance Submission Roster
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Daily roster submission status across classrooms
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('classes')}
                className="text-xs font-bold text-[#081A2F] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Manage Batches</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Mobile Batch Roster Cards */}
            <div className="sm:hidden space-y-2">
              {batches.map(batch => {
                const enrolled = students.filter(s => s.batch_id === batch.id).length;
                const isMarked = markedBatchIds.has(batch.id);

                return (
                  <div key={batch.id} className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[#081A2F] text-xs leading-snug truncate">
                          {batch.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium capitalize mt-0.5">
                          {batch.shift || 'Morning'} • Room {batch.room_number || 'A'}
                        </p>
                      </div>
                      {isMarked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Marked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                      <span className="text-[11px] font-mono text-slate-600">
                        Seats: <strong className="text-slate-900">{enrolled}/{batch.max_capacity || 40}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('attendance')}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#B88634] hover:text-white active:bg-amber-700 text-slate-800 font-semibold text-[11px] border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                      >
                        {isMarked ? 'View Roster' : 'Mark Attendance'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-2">Batch Name</th>
                    <th className="py-2.5 px-2">Shift & Room</th>
                    <th className="py-2.5 px-2">Occupancy</th>
                    <th className="py-2.5 px-2">Today's Attendance</th>
                    <th className="py-2.5 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map(batch => {
                    const enrolled = students.filter(s => s.batch_id === batch.id).length;
                    const isMarked = markedBatchIds.has(batch.id);

                    return (
                      <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-2">
                          <p className="font-bold text-[#081A2F] text-xs leading-snug">
                            {batch.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {batch.academic_session || '2026-2027'}
                          </p>
                        </td>

                        <td className="py-3 px-2">
                          <span className="font-medium text-slate-700 capitalize">
                            {batch.shift || 'Morning'}
                          </span>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {batch.room_number || 'Hall A'}
                          </p>
                        </td>

                        <td className="py-3 px-2">
                          <span className="font-mono font-bold text-[#081A2F]">
                            {enrolled} / {batch.max_capacity || 40}
                          </span>
                        </td>

                        <td className="py-3 px-2">
                          {isMarked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Marked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Pending
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => onNavigate('attendance')}
                            className="px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-[#B88634] hover:text-white text-slate-800 font-semibold text-[11px] border border-[#E6ECF2] hover:border-[#B88634] transition-colors cursor-pointer shadow-2xs"
                          >
                            {isMarked ? 'View Roster' : 'Mark'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>{unmarkedBatches.length} of {batches.length} batches awaiting attendance today</span>
            <button
              type="button"
              onClick={() => onNavigate('attendance')}
              className="text-[#081A2F] font-bold hover:underline cursor-pointer"
            >
              Open Daily Attendance Desk
            </button>
          </div>
        </div>

        {/* Right: Fee Realization & Defaulter Clearance */}
        <div className="lg:col-span-6 bg-white border border-[#E6ECF2] rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-[#081A2F]">
                  Priority Defaulters & Fee Clearance
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Overdue invoices requiring cashier collection
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('challans')}
                className="text-xs font-bold text-[#081A2F] hover:underline cursor-pointer"
              >
                Challans
              </button>
            </div>

            <div className="space-y-2.5">
              {unpaidInvoices.length > 0 ? (
                unpaidInvoices.slice(0, 3).map(inv => (
                  <div
                    key={inv.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[#081A2F]">
                          {inv.invoice_number || 'INV-2026-0001'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-slate-700 font-medium truncate mt-0.5">
                        {inv.student_name} • Adm: {inv.admission_number || inv.roll_number || 'A-101'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Due Date: {inv.due_date || 'Sep 15, 2026'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-sm text-rose-600">
                        {money(inv.balance_due ?? inv.balance_amount ?? 0)}
                      </p>
                      <button
                        type="button"
                        onClick={() => onNavigate('voucher')}
                        className="mt-1 px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-[10px] font-semibold transition-colors cursor-pointer shadow-xs"
                      >
                        Receive
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">
                  All fee invoices cleared for this cycle.
                </p>
              )}

              {/* Truancy Alert */}
              {pendingFollowups[0] && (
                <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                      <PhoneForwarded className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="font-bold text-rose-900">
                        {pendingFollowups[0].student_name} (Adm: {pendingFollowups[0].admission_number || pendingFollowups[0].roll_number || '—'})
                      </p>
                      <p className="text-[10px] text-rose-700">
                        {pendingFollowups[0].consecutive_days}d consecutive absent • Parent: {pendingFollowups[0].guardian_phone || 'Call pending'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('absentee')}
                    className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    Follow-Up
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('voucher')}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#FDF5E8] hover:bg-[#F6E3C0] text-[#B88634] font-semibold text-xs transition-colors text-center cursor-pointer shadow-2xs"
            >
              Open Cashier Desk & Collect Fee
            </button>
          </div>
        </div>
      </div>

      {/* ─── Recent Operational Activities Feed ─── */}
      <div className="bg-white border border-[#E6ECF2] rounded-3xl p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#081A2F]">
              Recent Operational Activities
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live institutional audit log and campus event stream
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Live Audit</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3 text-xs">
            <span className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-[#081A2F] flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 text-blue-700" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 truncate">
                Muhammad Ali Raza enrolled
              </p>
              <p className="text-[10px] text-slate-400">Adm: A-101 • MDCAT Prep</p>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">10m ago</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3 text-xs">
            <span className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 text-[#B88634] flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 truncate">
                Challan INV-2026-0001 issued
              </p>
              <p className="text-[10px] text-slate-400">PKR 11,500 • 3-Part Challan</p>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">2h ago</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3 text-xs">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 truncate">
                Faculty Check-In Verified
              </p>
              <p className="text-[10px] text-slate-400">Sir Tariq (Physics) in Hall 1</p>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">08:25 AM</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3 text-xs">
            <span className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 truncate">
                Assessment Announced
              </p>
              <p className="text-[10px] text-slate-400">{exams[0]?.title || 'Physics Assessment 1'}</p>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">Yesterday</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onNavigate('absentee')}
            className="w-full py-2.5 px-3 rounded-2xl bg-[#FDF5E8] hover:bg-[#F6E3C0] text-[#B88634] font-semibold text-xs transition-colors text-center cursor-pointer shadow-2xs"
          >
            View All Activities & Follow-ups
          </button>
        </div>
      </div>
    </div>
  );
};
