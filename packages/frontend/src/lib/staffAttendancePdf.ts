import { PDFPage, rgb } from 'pdf-lib';
import {
  AcademyLetterhead,
  createOfficialDocument,
  downloadPdfBytes,
  PdfTableColumn
} from './officialDocumentPdf';
import {
  DailyStaffRosterEntry,
  StaffMonthlyAttendanceSummary,
  StaffAttendanceAuditLog
} from '@apex/shared-types';

export { downloadPdfBytes };

/**
 * Opens a PDF document directly in a new browser tab for preview, print, or saving.
 */
export function previewPdfBytes(bytes: Uint8Array, title?: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // Popup blocked: fallback to direct download
    const a = document.createElement('a');
    a.href = url;
    a.download = title || 'Attendance_Report.pdf';
    a.click();
  }
}
const MARGIN = 42;
const NAVY = rgb(0.06, 0.09, 0.16);
const SLATE = rgb(0.35, 0.39, 0.45);
const RULE = rgb(0.86, 0.88, 0.91);
const INK = rgb(0.07, 0.09, 0.15);
const EMERALD = rgb(0.02, 0.55, 0.35);
const AMBER = rgb(0.85, 0.45, 0.05);
const CRIMSON = rgb(0.85, 0.15, 0.15);
const LIGHT_BG = rgb(0.96, 0.97, 0.98);

/**
 * Downloads a structured CSV file
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map(r => r.map(escapeCell).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generates Official Daily Staff Attendance Muster Roll PDF
 */
export async function generateDailyMusterRollPdf(
  academy: AcademyLetterhead,
  date: string,
  entries: DailyStaffRosterEntry[],
  stats: {
    total: number;
    present: number;
    late: number;
    half_day: number;
    leave: number;
    absent: number;
  }
): Promise<Uint8Array> {
  const { doc, font, fontBold, addPage, width, height } = await createOfficialDocument(
    'Daily Staff Attendance Report',
    academy
  );

  let page = addPage();
  let y = height - 90;

  // Header Context & Date Strip
  page.drawText(`DAILY STAFF ATTENDANCE  ·  DATE: ${date}`, {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: NAVY
  });

  const formattedPrintTime = new Date().toLocaleString('en-GB');
  page.drawText(`Generated: ${formattedPrintTime}`, {
    x: width - MARGIN - 140,
    y,
    size: 8,
    font,
    color: SLATE
  });

  y -= 24;

  // Key Metrics Strip (6 boxes)
  const boxWidth = (width - MARGIN * 2 - 25) / 6;
  const metrics = [
    { label: 'Total Roster', val: stats.total, color: NAVY },
    { label: 'Present', val: stats.present, color: EMERALD },
    { label: 'Late Arrival', val: stats.late, color: AMBER },
    { label: 'Half Day', val: stats.half_day, color: AMBER },
    { label: 'On Leave', val: stats.leave, color: SLATE },
    { label: 'Absent', val: stats.absent, color: CRIMSON },
  ];

  metrics.forEach((m, idx) => {
    const bx = MARGIN + idx * (boxWidth + 5);
    page.drawRectangle({
      x: bx,
      y: y - 28,
      width: boxWidth,
      height: 28,
      color: LIGHT_BG,
      borderColor: RULE,
      borderWidth: 0.5
    });
    page.drawText(m.label.toUpperCase(), {
      x: bx + 5,
      y: y - 10,
      size: 6,
      font: fontBold,
      color: SLATE
    });
    page.drawText(String(m.val), {
      x: bx + 5,
      y: y - 23,
      size: 11,
      font: fontBold,
      color: m.color
    });
  });

  y -= 44;

  // Table Columns (Total width = 511.28 pt)
  const columns: PdfTableColumn[] = [
    { key: 'sr', label: '#', width: 22 },
    { key: 'emp_code', label: 'Code', width: 52 },
    { key: 'staff_name', label: 'Staff Member Name', width: 115 },
    { key: 'dept', label: 'Department', width: 68 },
    { key: 'in_time', label: 'In', width: 42 },
    { key: 'out_time', label: 'Out', width: 42 },
    { key: 'duration', label: 'Hours', width: 42 },
    { key: 'status', label: 'Status', width: 55 },
    { key: 'mode', label: 'Verification', width: 73 },
  ];

  // Helper to draw table header
  const drawTableHeader = (p: PDFPage, atY: number) => {
    const totalW = columns.reduce((acc, c) => acc + c.width, 0);
    p.drawRectangle({
      x: MARGIN,
      y: atY - 3,
      width: totalW,
      height: 15,
      color: rgb(0.92, 0.94, 0.97)
    });
    let cx = MARGIN;
    for (const col of columns) {
      p.drawText(col.label.toUpperCase(), {
        x: cx + 3,
        y: atY + 1,
        size: 6.5,
        font: fontBold,
        color: NAVY
      });
      cx += col.width;
    }
    return atY - 15;
  };

  y = drawTableHeader(page, y);

  const formatTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  const formatHours = (mins?: number | null) => {
    if (!mins || mins <= 0) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'on_time': return 'PRESENT';
      case 'late': return 'LATE';
      case 'half_day': return 'HALF DAY';
      case 'on_leave': return 'LEAVE';
      case 'absent': return 'ABSENT';
      default: return 'NOT MARKED';
    }
  };

  const formatMode = (entry: DailyStaffRosterEntry) => {
    if (entry.status === 'absent' || entry.status === 'not_marked') return '—';
    if (entry.verification_mode === 'geofence') return 'GPS Geofence';
    if (entry.verification_mode === 'official_duty') return 'Official Duty';
    if (entry.verification_mode === 'manual_regularization') return 'Regularized';
    return entry.is_geofence_verified ? 'GPS Geofence' : 'Manual';
  };

  let rowIndex = 1;
  for (const entry of entries) {
    if (y < 85) {
      page = addPage();
      y = height - 80;
      y = drawTableHeader(page, y);
    }

    const rowData: Record<string, string> = {
      sr: String(rowIndex++),
      emp_code: entry.employee_code || '—',
      staff_name: entry.staff_name.slice(0, 24),
      dept: (entry.department || 'General').slice(0, 14),
      in_time: formatTime(entry.clock_in_time),
      out_time: formatTime(entry.clock_out_time),
      duration: formatHours(entry.work_duration_minutes),
      status: formatStatus(entry.status),
      mode: formatMode(entry),
    };

    const totalW = columns.reduce((acc, c) => acc + c.width, 0);
    page.drawLine({
      start: { x: MARGIN, y: y + 9 },
      end: { x: MARGIN + totalW, y: y + 9 },
      thickness: 0.3,
      color: RULE
    });

    let cx = MARGIN;
    for (const col of columns) {
      const text = rowData[col.key] || '—';
      let textColor = INK;
      if (col.key === 'status') {
        if (text === 'PRESENT') textColor = EMERALD;
        else if (text === 'LATE' || text === 'HALF DAY') textColor = AMBER;
        else if (text === 'ABSENT') textColor = CRIMSON;
      }
      page.drawText(text, {
        x: cx + 3,
        y: y,
        size: 7,
        font: col.key === 'status' || col.key === 'emp_code' ? fontBold : font,
        color: textColor
      });
      cx += col.width;
    }

    y -= 14;
  }

  // Institutional Sign-off Block on Final Page
  if (y < 80) {
    page = addPage();
    y = height - 80;
  } else {
    y = Math.min(y - 20, 85);
  }

  const signColWidth = (width - MARGIN * 2) / 3;
  // Prepared By
  page.drawLine({
    start: { x: MARGIN, y: y + 20 },
    end: { x: MARGIN + signColWidth - 20, y: y + 20 },
    thickness: 0.6,
    color: SLATE
  });
  page.drawText('PREPARED BY (ATTENDANCE OFFICER)', {
    x: MARGIN,
    y: y + 10,
    size: 6.5,
    font: fontBold,
    color: SLATE
  });

  // Verified By
  page.drawLine({
    start: { x: MARGIN + signColWidth, y: y + 20 },
    end: { x: MARGIN + signColWidth * 2 - 20, y: y + 20 },
    thickness: 0.6,
    color: SLATE
  });
  page.drawText('VERIFIED BY (ACCOUNTS / HR)', {
    x: MARGIN + signColWidth,
    y: y + 10,
    size: 6.5,
    font: fontBold,
    color: SLATE
  });

  // Approved By
  page.drawLine({
    start: { x: MARGIN + signColWidth * 2, y: y + 20 },
    end: { x: MARGIN + signColWidth * 3, y: y + 20 },
    thickness: 0.6,
    color: SLATE
  });
  page.drawText('AUTHORIZED PRINCIPAL / DIRECTOR', {
    x: MARGIN + signColWidth * 2,
    y: y + 10,
    size: 6.5,
    font: fontBold,
    color: SLATE
  });

  return doc.save();
}

/**
 * Generates Official Monthly Staff Attendance & Payroll Register PDF
 */
export async function generateMonthlyRegisterPdf(
  academy: AcademyLetterhead,
  monthStr: string,
  records: StaffMonthlyAttendanceSummary[]
): Promise<Uint8Array> {
  const { doc, font, fontBold, addPage, width, height } = await createOfficialDocument(
    'Monthly Staff Attendance Summary',
    academy
  );

  let page = addPage();
  let y = height - 90;

  page.drawText(`MONTHLY STAFF ATTENDANCE  ·  MONTH: ${monthStr}`, {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: NAVY
  });

  const totalHeadcount = records.length;
  const workingDays = records[0]?.total_working_days || 26;
  page.drawText(`Staff Headcount: ${totalHeadcount}  |  Official Working Days: ${workingDays}`, {
    x: MARGIN,
    y: y - 14,
    size: 8,
    font,
    color: SLATE
  });

  y -= 34;

  const columns: PdfTableColumn[] = [
    { key: 'sr', label: '#', width: 22 },
    { key: 'emp_code', label: 'Code', width: 50 },
    { key: 'staff_name', label: 'Staff Member Name', width: 110 },
    { key: 'dept', label: 'Department', width: 65 },
    { key: 'work_days', label: 'Days', width: 32 },
    { key: 'present', label: 'Pres', width: 32 },
    { key: 'late', label: 'Late', width: 32 },
    { key: 'half_day', label: 'HD', width: 30 },
    { key: 'leaves', label: 'Leave', width: 32 },
    { key: 'absent', label: 'Abs', width: 32 },
    { key: 'hours', label: 'Hours', width: 40 },
    { key: 'punctuality', label: 'Score', width: 32 },
  ];

  const drawTableHeader = (p: PDFPage, atY: number) => {
    const totalW = columns.reduce((acc, c) => acc + c.width, 0);
    p.drawRectangle({
      x: MARGIN,
      y: atY - 3,
      width: totalW,
      height: 15,
      color: rgb(0.92, 0.94, 0.97)
    });
    let cx = MARGIN;
    for (const col of columns) {
      p.drawText(col.label.toUpperCase(), {
        x: cx + 3,
        y: atY + 1,
        size: 6.5,
        font: fontBold,
        color: NAVY
      });
      cx += col.width;
    }
    return atY - 15;
  };

  y = drawTableHeader(page, y);

  let rowIndex = 1;
  for (const r of records) {
    if (y < 85) {
      page = addPage();
      y = height - 80;
      y = drawTableHeader(page, y);
    }

    const totalHours = Math.round((r.total_work_minutes || 0) / 60);
    const score = r.attendance_percentage !== undefined 
      ? `${r.attendance_percentage}%` 
      : `${Math.round(((r.present_days + r.late_days + r.half_days * 0.5) / Math.max(1, r.total_working_days)) * 100)}%`;

    const rowData: Record<string, string> = {
      sr: String(rowIndex++),
      emp_code: r.employee_code || '—',
      staff_name: r.staff_name.slice(0, 24),
      dept: (r.department || 'General').slice(0, 14),
      work_days: String(r.total_working_days),
      present: String(r.present_days),
      late: String(r.late_days),
      half_day: String(r.half_days),
      leaves: String(r.leave_days),
      absent: String(r.absent_days),
      hours: `${totalHours}h`,
      punctuality: score,
    };

    const totalW = columns.reduce((acc, c) => acc + c.width, 0);
    page.drawLine({
      start: { x: MARGIN, y: y + 9 },
      end: { x: MARGIN + totalW, y: y + 9 },
      thickness: 0.3,
      color: RULE
    });

    let cx = MARGIN;
    for (const col of columns) {
      const text = rowData[col.key] || '—';
      page.drawText(text, {
        x: cx + 3,
        y: y,
        size: 7,
        font: col.key === 'staff_name' || col.key === 'punctuality' ? fontBold : font,
        color: INK
      });
      cx += col.width;
    }

    y -= 14;
  }

  // Institutional Sign-off
  if (y < 80) {
    page = addPage();
    y = height - 80;
  } else {
    y = Math.min(y - 20, 85);
  }

  const signColWidth = (width - MARGIN * 2) / 3;
  page.drawLine({
    start: { x: MARGIN, y: y + 20 },
    end: { x: MARGIN + signColWidth - 20, y: y + 20 },
    thickness: 0.6,
    color: SLATE
  });
  page.drawText('PREPARED BY (HR / ATTENDANCE)', {
    x: MARGIN,
    y: y + 10,
    size: 6.5,
    font: fontBold,
    color: SLATE
  });

  page.drawLine({
    start: { x: MARGIN + signColWidth, y: y + 20 },
    end: { x: MARGIN + signColWidth * 2 - 20, y: y + 20 },
    thickness: 0.6,
    color: SLATE
  });
  page.drawText('CHIEF FINANCIAL OFFICER / ACCOUNTS', {
    x: MARGIN + signColWidth,
    y: y + 10,
    size: 6.5,
    font: fontBold,
    color: SLATE
  });

  page.drawLine({
    start: { x: MARGIN + signColWidth * 2, y: y + 20 },
    end: { x: MARGIN + signColWidth * 3, y: y + 20 },
    thickness: 0.6,
    color: SLATE
  });
  page.drawText('APPROVED BY PRINCIPAL / DIRECTOR', {
    x: MARGIN + signColWidth * 2,
    y: y + 10,
    size: 6.5,
    font: fontBold,
    color: SLATE
  });

  return doc.save();
}

/**
 * Generates Staff Attendance Audit & Regularization Log PDF
 */
export async function generateAttendanceAuditLogPdf(
  academy: AcademyLetterhead,
  dateScope: string,
  logs: StaffAttendanceAuditLog[]
): Promise<Uint8Array> {
  const { doc, font, fontBold, addPage, height } = await createOfficialDocument(
    'Staff Attendance Audit Log',
    academy
  );

  let page = addPage();
  let y = height - 90;

  page.drawText(`STAFF ATTENDANCE AUDIT LOG  ·  PERIOD: ${dateScope}`, {
    x: MARGIN,
    y,
    size: 10,
    font: fontBold,
    color: NAVY
  });

  page.drawText(`Total Administrative Modifications Recorded: ${logs.length}`, {
    x: MARGIN,
    y: y - 13,
    size: 8,
    font,
    color: SLATE
  });

  y -= 30;

  const columns: PdfTableColumn[] = [
    { key: 'sr', label: '#', width: 22 },
    { key: 'created_at', label: 'Action Timestamp', width: 88 },
    { key: 'staff_name', label: 'Staff Member', width: 100 },
    { key: 'target_date', label: 'Roster Date', width: 55 },
    { key: 'change', label: 'Status Transition', width: 85 },
    { key: 'reason', label: 'Institutional Reason Head', width: 100 },
    { key: 'by', label: 'Adjusted By', width: 60 },
  ];

  const drawTableHeader = (p: PDFPage, atY: number) => {
    const totalW = columns.reduce((acc, c) => acc + c.width, 0);
    p.drawRectangle({
      x: MARGIN,
      y: atY - 3,
      width: totalW,
      height: 15,
      color: rgb(0.92, 0.94, 0.97)
    });
    let cx = MARGIN;
    for (const col of columns) {
      p.drawText(col.label.toUpperCase(), {
        x: cx + 3,
        y: atY + 1,
        size: 6.5,
        font: fontBold,
        color: NAVY
      });
      cx += col.width;
    }
    return atY - 15;
  };

  y = drawTableHeader(page, y);

  let rowIndex = 1;
  for (const log of logs) {
    if (y < 85) {
      page = addPage();
      y = height - 80;
      y = drawTableHeader(page, y);
    }

    const fmtTimestamp = new Date(log.created_at).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const prev = log.previous_status ? log.previous_status.toUpperCase() : 'NONE';
    const next = log.new_status ? log.new_status.toUpperCase() : 'MODIFIED';
    const transition = `${prev} -> ${next}`;

    const rowData: Record<string, string> = {
      sr: String(rowIndex++),
      created_at: fmtTimestamp,
      staff_name: log.staff_name.slice(0, 22),
      target_date: log.date,
      change: transition,
      reason: (log.reason_head || 'Administrative').slice(0, 24),
      by: (log.adjusted_by || 'Admin').slice(0, 16),
    };

    const totalW = columns.reduce((acc, c) => acc + c.width, 0);
    page.drawLine({
      start: { x: MARGIN, y: y + 9 },
      end: { x: MARGIN + totalW, y: y + 9 },
      thickness: 0.3,
      color: RULE
    });

    let cx = MARGIN;
    for (const col of columns) {
      const text = rowData[col.key] || '—';
      page.drawText(text, {
        x: cx + 3,
        y: y,
        size: 6.5,
        font: col.key === 'staff_name' || col.key === 'change' ? fontBold : font,
        color: INK
      });
      cx += col.width;
    }

    y -= 14;
  }

  return doc.save();
}

/**
 * Generates Department-Level Staff Attendance & Punctuality Summary PDF
 */
export async function generateDepartmentAttendanceSummaryPdf(
  academy: AcademyLetterhead,
  month: string,
  departmentSummaries: {
    department: string;
    staff_count: number;
    total_working_days: number;
    present_days: number;
    late_days: number;
    half_days: number;
    leave_days: number;
    absent_days: number;
    avg_attendance_pct: number;
  }[]
): Promise<Uint8Array> {
  const { doc, font, fontBold, addPage, height } = await createOfficialDocument(
    'Department Attendance & Punctuality Summary',
    academy
  );

  let page = addPage();
  let y = height - 90;

  page.drawText(`DEPARTMENT ATTENDANCE SUMMARY  ·  REPORTING MONTH: ${month}`, {
    x: MARGIN,
    y,
    size: 10,
    font: fontBold,
    color: NAVY
  });

  const totalDepts = departmentSummaries.length;
  const totalStaff = departmentSummaries.reduce((a, b) => a + b.staff_count, 0);
  const overallPct = totalDepts > 0
    ? Math.round(departmentSummaries.reduce((a, b) => a + b.avg_attendance_pct, 0) / totalDepts)
    : 0;

  page.drawText(`Departments: ${totalDepts}   |   Total Headcount: ${totalStaff}   |   Academy Attendance Average: ${overallPct}%`, {
    x: MARGIN,
    y: y - 13,
    size: 8,
    font,
    color: SLATE
  });

  y -= 30;

  const columns: PdfTableColumn[] = [
    { key: 'sr', label: '#', width: 22 },
    { key: 'department', label: 'Department', width: 120 },
    { key: 'staff_count', label: 'Staff', width: 40 },
    { key: 'present_days', label: 'Present', width: 50 },
    { key: 'late_days', label: 'Late', width: 45 },
    { key: 'half_days', label: 'Half Day', width: 45 },
    { key: 'leave_days', label: 'Leaves', width: 45 },
    { key: 'absent_days', label: 'Absent', width: 45 },
    { key: 'avg_pct', label: 'Avg Attn %', width: 60, align: 'right' }
  ];

  const totalW = columns.reduce((acc, c) => acc + c.width, 0);
  page.drawRectangle({
    x: MARGIN,
    y: y - 3,
    width: totalW,
    height: 15,
    color: rgb(0.92, 0.94, 0.97)
  });

  let cx = MARGIN;
  for (const col of columns) {
    page.drawText(col.label.toUpperCase(), {
      x: cx + 3,
      y: y + 1,
      size: 6.5,
      font: fontBold,
      color: NAVY
    });
    cx += col.width;
  }
  y -= 15;

  let rowIndex = 1;
  for (const row of departmentSummaries) {
    if (y < 85) {
      page = addPage();
      y = height - 80;
    }

    page.drawLine({
      start: { x: MARGIN, y: y + 9 },
      end: { x: MARGIN + totalW, y: y + 9 },
      thickness: 0.3,
      color: RULE
    });

    const rowData: Record<string, string> = {
      sr: String(rowIndex++),
      department: row.department,
      staff_count: String(row.staff_count),
      present_days: String(row.present_days),
      late_days: String(row.late_days),
      half_days: String(row.half_days),
      leave_days: String(row.leave_days),
      absent_days: String(row.absent_days),
      avg_pct: `${row.avg_attendance_pct}%`
    };

    let colX = MARGIN;
    for (const col of columns) {
      const text = rowData[col.key] || '—';
      page.drawText(text, {
        x: colX + 3,
        y,
        size: 7,
        font: col.key === 'department' || col.key === 'avg_pct' ? fontBold : font,
        color: col.key === 'avg_pct' && row.avg_attendance_pct < 75 ? CRIMSON : INK
      });
      colX += col.width;
    }

    y -= 14;
  }

  return doc.save();
}

/**
 * Generates Attendance Defaulters & Chronic Lates Disciplinary Report PDF
 */
export async function generateDefaultersReportPdf(
  academy: AcademyLetterhead,
  month: string,
  defaulters: {
    employee_code: string;
    staff_name: string;
    department: string;
    designation: string;
    total_working_days: number;
    present_days: number;
    late_days: number;
    absent_days: number;
    attendance_pct: number;
    reason_flag: string;
  }[]
): Promise<Uint8Array> {
  const { doc, font, fontBold, addPage, height } = await createOfficialDocument(
    'Staff Attendance Defaulters & Chronic Lates Report',
    academy
  );

  let page = addPage();
  let y = height - 90;

  page.drawText(`STAFF ATTENDANCE DEFAULTERS REPORT  ·  PERIOD: ${month}`, {
    x: MARGIN,
    y,
    size: 10,
    font: fontBold,
    color: NAVY
  });

  page.drawText(`Showing ${defaulters.length} staff member(s) with short attendance (< 75%), excessive lates (>= 3), or unexcused absences.`, {
    x: MARGIN,
    y: y - 13,
    size: 8,
    font,
    color: SLATE
  });

  y -= 30;

  const columns: PdfTableColumn[] = [
    { key: 'sr', label: '#', width: 20 },
    { key: 'code', label: 'Code', width: 45 },
    { key: 'name', label: 'Staff Member', width: 110 },
    { key: 'dept', label: 'Department', width: 75 },
    { key: 'working', label: 'Days', width: 35 },
    { key: 'present', label: 'Pres', width: 35 },
    { key: 'lates', label: 'Late', width: 35 },
    { key: 'absents', label: 'Abs', width: 35 },
    { key: 'pct', label: 'Attn %', width: 45 },
    { key: 'reason', label: 'Flag / Action', width: 75 }
  ];

  const totalW = columns.reduce((acc, c) => acc + c.width, 0);
  page.drawRectangle({
    x: MARGIN,
    y: y - 3,
    width: totalW,
    height: 15,
    color: rgb(0.98, 0.92, 0.92)
  });

  let cx = MARGIN;
  for (const col of columns) {
    page.drawText(col.label.toUpperCase(), {
      x: cx + 3,
      y: y + 1,
      size: 6.5,
      font: fontBold,
      color: NAVY
    });
    cx += col.width;
  }
  y -= 15;

  let rowIndex = 1;
  for (const row of defaulters) {
    if (y < 85) {
      page = addPage();
      y = height - 80;
    }

    page.drawLine({
      start: { x: MARGIN, y: y + 9 },
      end: { x: MARGIN + totalW, y: y + 9 },
      thickness: 0.3,
      color: RULE
    });

    const rowData: Record<string, string> = {
      sr: String(rowIndex++),
      code: row.employee_code,
      name: row.staff_name.slice(0, 22),
      dept: row.department.slice(0, 15),
      working: String(row.total_working_days),
      present: String(row.present_days),
      lates: String(row.late_days),
      absents: String(row.absent_days),
      pct: `${row.attendance_pct}%`,
      reason: row.reason_flag.slice(0, 18)
    };

    let colX = MARGIN;
    for (const col of columns) {
      const text = rowData[col.key] || '—';
      page.drawText(text, {
        x: colX + 3,
        y,
        size: 7,
        font: col.key === 'name' || col.key === 'pct' ? fontBold : font,
        color: col.key === 'pct' ? CRIMSON : INK
      });
      colX += col.width;
    }

    y -= 14;
  }

  return doc.save();
}

/**
 * Generates Individual Staff Member Attendance Transcript Card PDF
 */
export async function generateIndividualStaffCardPdf(
  academy: AcademyLetterhead,
  staff: {
    employee_code: string;
    full_name: string;
    department: string;
    designation: string;
  },
  month: string,
  records: {
    date: string;
    clock_in_time?: string | null;
    clock_out_time?: string | null;
    work_duration_minutes?: number | null;
    status: string;
    head_name?: string | null;
    verification_mode?: string | null;
    notes?: string | null;
  }[]
): Promise<Uint8Array> {
  const { doc, font, fontBold, addPage, height } = await createOfficialDocument(
    'Staff Member Attendance Transcript Card',
    academy
  );

  let page = addPage();
  let y = height - 90;

  page.drawText(`STAFF ATTENDANCE TRANSCRIPT CARD  ·  PERIOD: ${month}`, {
    x: MARGIN,
    y,
    size: 10,
    font: fontBold,
    color: NAVY
  });

  y -= 25;

  // Staff Particulars Box
  page.drawRectangle({
    x: MARGIN,
    y: y - 25,
    width: 510,
    height: 35,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: RULE,
    borderWidth: 0.8
  });

  page.drawText(`EMPLOYEE: ${staff.full_name} (${staff.employee_code})`, {
    x: MARGIN + 10,
    y: y - 5,
    size: 8.5,
    font: fontBold,
    color: NAVY
  });

  page.drawText(`DEPARTMENT: ${staff.department}   |   DESIGNATION: ${staff.designation}   |   RECORDS: ${records.length}`, {
    x: MARGIN + 10,
    y: y - 18,
    size: 7.5,
    font,
    color: SLATE
  });

  y -= 45;

  const columns: PdfTableColumn[] = [
    { key: 'sr', label: '#', width: 22 },
    { key: 'date', label: 'Date', width: 65 },
    { key: 'in', label: 'Clock In', width: 60 },
    { key: 'out', label: 'Clock Out', width: 60 },
    { key: 'dur', label: 'Duty Duration', width: 70 },
    { key: 'head', label: 'Head / Status', width: 95 },
    { key: 'mode', label: 'Verification', width: 65 },
    { key: 'notes', label: 'Remarks', width: 73 }
  ];

  const totalW = columns.reduce((acc, c) => acc + c.width, 0);
  page.drawRectangle({
    x: MARGIN,
    y: y - 3,
    width: totalW,
    height: 15,
    color: rgb(0.92, 0.94, 0.97)
  });

  let cx = MARGIN;
  for (const col of columns) {
    page.drawText(col.label.toUpperCase(), {
      x: cx + 3,
      y: y + 1,
      size: 6.5,
      font: fontBold,
      color: NAVY
    });
    cx += col.width;
  }
  y -= 15;

  const formatMins = (m?: number | null) => {
    if (!m) return '—';
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}h ${min > 0 ? `${min}m` : ''}`.trim();
  };

  const formatIso = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  let rowIndex = 1;
  for (const rec of records) {
    if (y < 85) {
      page = addPage();
      y = height - 80;
    }

    page.drawLine({
      start: { x: MARGIN, y: y + 9 },
      end: { x: MARGIN + totalW, y: y + 9 },
      thickness: 0.3,
      color: RULE
    });

    const rowData: Record<string, string> = {
      sr: String(rowIndex++),
      date: rec.date,
      in: formatIso(rec.clock_in_time),
      out: formatIso(rec.clock_out_time),
      dur: formatMins(rec.work_duration_minutes),
      head: (rec.head_name || rec.status.toUpperCase()).slice(0, 18),
      mode: (rec.verification_mode || 'Manual').slice(0, 14),
      notes: (rec.notes || '—').slice(0, 18)
    };

    let colX = MARGIN;
    for (const col of columns) {
      const text = rowData[col.key] || '—';
      page.drawText(text, {
        x: colX + 3,
        y,
        size: 7,
        font: col.key === 'date' || col.key === 'head' ? fontBold : font,
        color: INK
      });
      colX += col.width;
    }

    y -= 14;
  }

  // Signatures block at bottom
  if (y < 70) {
    page = addPage();
    y = height - 80;
  }
  y -= 25;
  const signW = 160;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + signW, y }, thickness: 0.6, color: SLATE });
  page.drawText('EMPLOYEE SIGNATURE', { x: MARGIN, y: y - 10, size: 7, font: fontBold, color: SLATE });

  page.drawLine({ start: { x: MARGIN + signW + 20, y }, end: { x: MARGIN + signW * 2 + 20, y }, thickness: 0.6, color: SLATE });
  page.drawText('HEAD OF DEPARTMENT', { x: MARGIN + signW + 20, y: y - 10, size: 7, font: fontBold, color: SLATE });

  page.drawLine({ start: { x: MARGIN + signW * 2 + 40, y }, end: { x: MARGIN + signW * 3 + 30, y }, thickness: 0.6, color: SLATE });
  page.drawText('PRINCIPAL / DIRECTOR', { x: MARGIN + signW * 2 + 40, y: y - 10, size: 7, font: fontBold, color: SLATE });

  return doc.save();
}

/**
 * Generates Official Daily Attendance Exceptions Roster PDF
 */
export async function generateDailyExceptionsPdf(
  academy: AcademyLetterhead,
  date: string,
  exceptions: DailyStaffRosterEntry[],
  deptFilter?: string,
  typeFilter?: string
): Promise<Uint8Array> {
  const { doc, font, fontBold, addPage, width, height } = await createOfficialDocument(
    'Staff Attendance Exceptions Report',
    academy
  );

  let page = addPage();
  let y = height - 90;

  page.drawText(`DAILY ATTENDANCE EXCEPTIONS ROSTER  ·  DATE: ${date}`, {
    x: MARGIN,
    y,
    size: 10.5,
    font: fontBold,
    color: NAVY
  });

  const formattedPrintTime = new Date().toLocaleString('en-GB');
  page.drawText(`Generated: ${formattedPrintTime}`, {
    x: width - MARGIN - 140,
    y,
    size: 8,
    font,
    color: SLATE
  });

  y -= 20;

  const filterDesc = `Department: ${deptFilter || 'All'}   |   Category: ${typeFilter || 'All Exceptions'}   |   Total Exceptions: ${exceptions.length}`;
  page.drawText(filterDesc, {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: SLATE
  });

  y -= 25;

  const columns: PdfTableColumn[] = [
    { key: 'sr', label: '#', width: 22 },
    { key: 'emp_code', label: 'Code', width: 55 },
    { key: 'staff_name', label: 'Staff Member Name', width: 125 },
    { key: 'dept', label: 'Department', width: 75 },
    { key: 'status', label: 'Exception Status', width: 70 },
    { key: 'arrival', label: 'Arrival', width: 50 },
    { key: 'notes', label: 'Administrative Notes', width: 114 },
  ];

  const drawTableHeader = (p: PDFPage, atY: number) => {
    const totalW = columns.reduce((acc, c) => acc + c.width, 0);
    p.drawRectangle({
      x: MARGIN,
      y: atY - 3,
      width: totalW,
      height: 15,
      color: rgb(0.92, 0.94, 0.97)
    });
    let cx = MARGIN;
    for (const col of columns) {
      p.drawText(col.label.toUpperCase(), {
        x: cx + 3,
        y: atY + 1,
        size: 6.5,
        font: fontBold,
        color: NAVY
      });
      cx += col.width;
    }
    return atY - 15;
  };

  y = drawTableHeader(page, y);

  const formatIso = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  let rowIndex = 1;
  for (const entry of exceptions) {
    if (y < 85) {
      page = addPage();
      y = height - 80;
      y = drawTableHeader(page, y);
    }

    const rowData: Record<string, string> = {
      sr: String(rowIndex++),
      emp_code: entry.employee_code || '—',
      staff_name: entry.staff_name.slice(0, 24),
      dept: (entry.department || 'General').slice(0, 15),
      status: entry.status.toUpperCase(),
      arrival: formatIso(entry.clock_in_time),
      notes: (entry.admin_adjustment_notes || entry.head_name || '—').slice(0, 25),
    };

    const totalW = columns.reduce((acc, c) => acc + c.width, 0);
    page.drawLine({
      start: { x: MARGIN, y: y + 9 },
      end: { x: MARGIN + totalW, y: y + 9 },
      thickness: 0.3,
      color: RULE
    });

    let cx = MARGIN;
    for (const col of columns) {
      const text = rowData[col.key] || '—';
      let textColor = INK;
      if (col.key === 'status') {
        if (text === 'LATE' || text === 'HALF DAY') textColor = AMBER;
        else if (text === 'ABSENT') textColor = CRIMSON;
        else if (text === 'ON_LEAVE' || text === 'LEAVE') textColor = SLATE;
      }
      page.drawText(text, {
        x: cx + 3,
        y,
        size: 7,
        font: col.key === 'status' || col.key === 'emp_code' ? fontBold : font,
        color: textColor
      });
      cx += col.width;
    }

    y -= 14;
  }

  if (y < 70) {
    page = addPage();
    y = height - 80;
  }
  y -= 25;
  const signW = 160;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + signW, y }, thickness: 0.6, color: SLATE });
  page.drawText('CHECKED BY (ATTENDANCE OFFICER)', { x: MARGIN, y: y - 10, size: 7, font: fontBold, color: SLATE });

  page.drawLine({ start: { x: MARGIN + signW + 20, y }, end: { x: MARGIN + signW * 2 + 20, y }, thickness: 0.6, color: SLATE });
  page.drawText('HR / ACCOUNTS REVIEW', { x: MARGIN + signW + 20, y: y - 10, size: 7, font: fontBold, color: SLATE });

  page.drawLine({ start: { x: MARGIN + signW * 2 + 40, y }, end: { x: MARGIN + signW * 3 + 30, y }, thickness: 0.6, color: SLATE });
  page.drawText('PRINCIPAL APPROVAL', { x: MARGIN + signW * 2 + 40, y: y - 10, size: 7, font: fontBold, color: SLATE });

  return doc.save();
}


