import type { TxLike } from '../db/db.js'

export type AttendanceCategory =
  | 'PRESENT'
  | 'ABSENT_UNEXCUSED'
  | 'ABSENT_EXCUSED'
  | 'LATE'
  | 'HALF_DAY'
  | 'SCHOOL_ACTIVITY'
  | 'SUSPENDED'

export type MarkInput = {
  sectionId: string
  day: string
  marks: Array<{ personId: string; category: AttendanceCategory }>
}

/**
 * AT2/AT4 — mark daily attendance for a section. The register "taken" event is
 * recorded separately from the per-student events. Throws on non-session days.
 */
export async function markDailyAttendance(tx: TxLike, input: MarkInput & { takenBy: string }): Promise<string> {
  // A section sits on a campus inside one tenant; the governing calendar is the
  // academic year that owns today's open enrollment window. Resolve it from the
  // academic_years date range (sections have no year_id — years do).
  const sec = await tx.query<{ year_id: string }>(
    `SELECT y.id AS year_id
     FROM sections s
     JOIN campuses c ON c.id = s.campus_id AND c.tenant_id = current_setting('app.current_tenant_id', true)::uuid
     JOIN academic_years y ON y.tenant_id = current_setting('app.current_tenant_id', true)::uuid
       AND $2 BETWEEN y.start_date AND y.end_date AND y.status <> 'CLOSED'
     WHERE s.id = $1`,
    [input.sectionId, input.day],
  )
  const cal = sec
  const yearRow = cal.rows[0]
  if (!yearRow) throw new Error('section not found or day outside any active academic year')
  const yearId = yearRow.year_id

  // AT4 — attendance cannot be marked on a non-membership day
  const dayRows = await tx.query<{ day_type: string }>(
    `SELECT day_type FROM calendar_days WHERE year_id = $1 AND day = $2`,
    [yearId, input.day],
  )
  const dayType = dayRows.rows[0]?.day_type ?? 'HOLIDAY'
  if (dayType !== 'IN_SESSION' && dayType !== 'HALF_DAY') {
    throw new Error(`attendance cannot be marked on a ${dayType} day`)
  }

  // record that the register was called (AT2)
  await tx.query(
    `INSERT INTO attendance_taken (tenant_id, section_id, day, taken_by)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3)
     ON CONFLICT (section_id, day) DO UPDATE SET taken_by = EXCLUDED.taken_by, taken_at = now()`,
    [input.sectionId, input.day, input.takenBy],
  )

  for (const m of input.marks) {
    // AT5 — the student must be enrolled (membership window) on this day
    const enrolled = await tx.query<{ id: string }>(
      `SELECT id FROM enrollments
       WHERE person_id = $1 AND entry_date <= $2 AND (exit_date IS NULL OR exit_date > $2)
         AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
      [m.personId, input.day],
    )
    if (enrolled.rows.length === 0) {
      throw new Error(`person ${m.personId} is not enrolled on ${input.day}`)
    }
    await tx.query(
      `INSERT INTO attendance_events (tenant_id, person_id, section_id, day, category, taken_by)
       VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5)
       ON CONFLICT (person_id, day, period) DO UPDATE SET category = EXCLUDED.category`,
      [m.personId, input.sectionId, input.day, m.category, input.takenBy],
    )
  }
  return input.day
}

/**
 * Attendance percentage with the correct denominator:
 * in-session calendar days ∩ enrollment window ∩ (roster window if section-scoped).
 */
export async function attendancePercentage(tx: TxLike, personId: string, from: string, to: string): Promise<{
  inSessionDays: number
  counted: number
  present: number
  percent: number
}> {
  const rows = await tx.query<{ in_session_days: string; present: string }>(
    `WITH membership AS (
       SELECT d.day::date AS day
       FROM calendar_days d
       JOIN enrollments e ON e.person_id = $1
         AND e.entry_date <= d.day AND (e.exit_date IS NULL OR e.exit_date > d.day)
         AND e.tenant_id = current_setting('app.current_tenant_id', true)::uuid
       WHERE d.tenant_id = current_setting('app.current_tenant_id', true)::uuid
         AND d.day_type IN ('IN_SESSION','HALF_DAY')
         AND d.day BETWEEN $2 AND $3
     ),
     counted AS (
       SELECT day FROM membership
       UNION
       SELECT day::date FROM attendance_events
       WHERE person_id = $1 AND day BETWEEN $2 AND $3
         AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
     ),
     present AS (
       SELECT day::date AS day FROM attendance_events
       WHERE person_id = $1 AND day BETWEEN $2 AND $3
         AND category IN ('PRESENT','LATE','SCHOOL_ACTIVITY','HALF_DAY')
         AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
     )
     SELECT (SELECT COUNT(*) FROM counted)::text AS in_session_days,
            (SELECT COUNT(*) FROM present)::text AS present`,
    [personId, from, to],
  )
  const r = rows.rows[0]!
  const counted = parseInt(r.in_session_days, 10)
  const present = parseInt(r.present, 10)
  const percent = counted === 0 ? 0 : Math.round((present / counted) * 1000) / 10
  return { inSessionDays: counted, counted, present, percent }
}

/** Roster with today's category for the fast-entry screen. */
export async function sectionRosterForDay(tx: TxLike, sectionId: string, day: string): Promise<
  Array<{ personId: string; personNo: string; name: string; category: string | null }>
> {
  const rows = await tx.query<{ id: string; person_no: string; legal_name: string; category: string | null }>(
    `SELECT p.id, p.person_no, i.legal_name, ae.category
     FROM section_rosters sr
     JOIN persons p ON p.id = sr.person_id
     JOIN identities i ON i.person_id = p.id AND i.valid_to IS NULL
     LEFT JOIN attendance_events ae
       ON ae.person_id = p.id AND ae.day = $2 AND ae.period = 0
       AND ae.tenant_id = current_setting('app.current_tenant_id', true)::uuid
     WHERE sr.section_id = $1
       AND sr.start_date <= $2 AND (sr.end_date IS NULL OR sr.end_date > $2)
       AND sr.tenant_id = current_setting('app.current_tenant_id', true)::uuid
     ORDER BY p.person_no`,
    [sectionId, day],
  )
  return rows.rows.map((r) => ({
    personId: r.id,
    personNo: r.person_no,
    name: r.legal_name,
    category: r.category,
  }))
}
