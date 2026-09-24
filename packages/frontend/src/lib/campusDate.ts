import { DayOfWeek } from '@apex/shared-types';

export type { DayOfWeek };

/**
 * Returns YYYY-MM-DD for the campus calendar in the specified timezone.
 * Defaults to 'Asia/Karachi'.
 */
export function campusToday(
  timeZoneOrNow: string | Date | number = 'Asia/Karachi',
  nowOrTimeZone?: string | Date | number
): string {
  let timeZone = 'Asia/Karachi';
  let date = new Date();

  const isDateLike = (val: unknown): val is Date | number =>
    val instanceof Date || typeof val === 'number';

  const isIsoOrDateString = (val: unknown): val is string =>
    typeof val === 'string' && (val.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(val));

  if (isDateLike(timeZoneOrNow)) {
    date = new Date(timeZoneOrNow);
    if (typeof nowOrTimeZone === 'string') {
      timeZone = nowOrTimeZone;
    }
  } else if (isIsoOrDateString(timeZoneOrNow)) {
    date = new Date(timeZoneOrNow);
    if (typeof nowOrTimeZone === 'string') {
      timeZone = nowOrTimeZone;
    }
  } else if (typeof timeZoneOrNow === 'string') {
    timeZone = timeZoneOrNow;
    if (nowOrTimeZone) {
      date = new Date(nowOrTimeZone);
    }
  } else if (nowOrTimeZone) {
    date = new Date(nowOrTimeZone);
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns monday … sunday for a given date in the campus timezone.
 * Does not parse date-only strings as UTC to prevent weekday shifts.
 */
export function campusDayOfWeek(date: string, timeZone: string = 'Asia/Karachi'): DayOfWeek {
  if (!date) return 'monday';
  let d: Date;
  const trimmed = date.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    d = new Date(`${trimmed}T12:00:00Z`);
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return 'monday';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
  });
  return formatter.format(d).toLowerCase() as DayOfWeek;
}

/**
 * Converts ISO timestamp to minutes from midnight in the timezone.
 * Matches existing logic in evaluateHead in packages/backend/src/services/store.ts.
 */
export function campusMinutes(iso: string, timeZone: string = 'Asia/Karachi'): number {
  if (!iso) return 0;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 0;
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.format(d).split(':').map(Number);
    const h = parts[0] === 24 ? 0 : (parts[0] || 0);
    const m = parts[1] || 0;
    return h * 60 + m;
  } catch {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? 0 : (d.getHours() * 60 + d.getMinutes());
  }
}

/**
 * Parses "HH:MM" (e.g. "08:30" or "9:00") into minutes from midnight.
 * Returns null if format is invalid.
 */
export function parseTimeToMinutes(t?: string | null): number | null {
  if (!t || typeof t !== 'string' || !t.includes(':')) return null;
  const parts = t.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Normalizes "H:MM" or "HH:MM" to zero-padded "HH:MM" (e.g. "9:00" -> "09:00").
 */
export function normalizeTimeString(t: string): string {
  if (!t || typeof t !== 'string' || !t.includes(':')) return t;
  const [h, m] = t.trim().split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

/**
 * Returns count of working days (all days excluding Sundays) for a given month (YYYY-MM).
 */
export function getSundayExcludedWorkingDays(monthStr: string, timeZone: string = 'Asia/Karachi'): number {
  if (!monthStr || !monthStr.includes('-')) return 26;
  const parts = monthStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return 26;
  const totalDays = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (campusDayOfWeek(dStr, timeZone) !== 'sunday') {
      count++;
    }
  }
  return count;
}

/**
 * Formats an ISO timestamp or time string into campus clock time (e.g. "08:15 AM" or "08:15").
 * Defaults to 'Asia/Karachi'.
 */
export function formatCampusTime(
  iso?: string | null,
  timeZone: string = 'Asia/Karachi',
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
): string {
  if (!iso || typeof iso !== 'string') return '';
  const trimmed = iso.trim();
  if (!trimmed) return '';
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const parts = trimmed.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  try {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], {
      ...options,
      timeZone,
    });
  } catch {
    return '';
  }
}

