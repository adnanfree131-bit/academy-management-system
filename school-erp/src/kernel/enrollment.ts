import type { TxLike } from '../db/db.js'

export type AdmitInput = {
  personId: string
  campusId: string
  gradeId: string
  yearId: string
  calendarId?: string
  entryDate: string
  entryType?: 'NEW' | 'RE_ENTRY' | 'TRANSFER_IN' | 'PROMOTED' | 'RETAINED'
  sectionId?: string
}

export async function admitStudent(tx: TxLike, input: AdmitInput): Promise<string> {
  const rows = await tx.query<{ id: string }>(
    `INSERT INTO enrollments
       (tenant_id, person_id, campus_id, grade_id, year_id, calendar_id, entry_date, entry_type)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.personId,
      input.campusId,
      input.gradeId,
      input.yearId,
      input.calendarId ?? null,
      input.entryDate,
      input.entryType ?? 'NEW',
    ],
  )
  const enrollmentId = rows.rows[0]!.id
  if (input.sectionId) {
    await roster(tx, { enrollmentPersonId: input.personId, sectionId: input.sectionId, startDate: input.entryDate })
  }
  return enrollmentId
}

export type ExitInput = {
  personId: string
  exitDate: string
  exitType: 'TRANSFERRED_OUT' | 'GRADUATED' | 'WITHDRAWN' | 'DECEASED' | 'NO_SHOW'
  notes?: string
}

/**
 * Exit an open enrollment. E4 (no-show) uses exitType NO_SHOW — the row is
 * never deleted. E6: exam attempts and results remain; nothing here touches them.
 */
export async function exitStudent(tx: TxLike, input: ExitInput): Promise<void> {
  const res = await tx.query<{ id: string }>(
    `UPDATE enrollments SET exit_date = $2, exit_type = $3
     WHERE person_id = $1 AND exit_date IS NULL
       AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
     RETURNING id`,
    [input.personId, input.exitDate, input.exitType],
  )
  if (res.rows.length === 0) throw new Error('no open enrollment')
  // close section rosters on the same date
  await tx.query(
    `UPDATE section_rosters SET end_date = $2
     WHERE person_id = $1 AND end_date IS NULL
       AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    [input.personId, input.exitDate],
  )
}

export type RosterInput = {
  enrollmentPersonId: string
  sectionId: string
  startDate: string
}

/**
 * E1 — mid-year section transfer: end the old roster, start a new one.
 * School enrollment is untouched; attendance history stays put.
 */
export async function roster(tx: TxLike, input: RosterInput): Promise<void> {
  await tx.query(
    `UPDATE section_rosters SET end_date = $2
     WHERE person_id = $1 AND end_date IS NULL
       AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    [input.enrollmentPersonId, input.startDate],
  )
  await tx.query(
    `INSERT INTO section_rosters (tenant_id, section_id, person_id, start_date)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3)`,
    [input.sectionId, input.enrollmentPersonId, input.startDate],
  )
}

/**
 * E2 — mid-year grade change (promote/retain after year start):
 * close-and-open a new enrollment; no date overlap (DB index enforces),
 * roster re-started in the new grade's section.
 */
export async function changeGradeMidYear(
  tx: TxLike,
  input: { personId: string; cutDate: string; newGradeId: string; newSectionId?: string; repeat?: boolean },
): Promise<string> {
  const cur = await tx.query<{
    campus_id: string
    year_id: string
    calendar_id: string | null
    exit_date: string | null
  }>(
    `SELECT campus_id, year_id, calendar_id, exit_date FROM enrollments
     WHERE person_id = $1 AND exit_date IS NULL
       AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    [input.personId],
  )
  const open = cur.rows[0]
  if (!open) throw new Error('no open enrollment')
  const exitDate = input.cutDate
  const res = await tx.query<{ id: string }>(
    `UPDATE enrollments SET exit_date = $2, exit_type = $3
     WHERE person_id = $1 AND exit_date IS NULL
       AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
     RETURNING id`,
    [input.personId, exitDate, input.repeat ? 'RETAINED' : 'PROMOTED'],
  )
  if (res.rows.length === 0) throw new Error('failed to close enrollment')
  // re-roster into new section on the cut date
  if (input.newSectionId) {
    await tx.query(
      `UPDATE section_rosters SET end_date = $2
       WHERE person_id = $1 AND end_date IS NULL
         AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
      [input.personId, exitDate],
    )
  }
  const inserted = await tx.query<{ id: string }>(
    `INSERT INTO enrollments
       (tenant_id, person_id, campus_id, grade_id, year_id, calendar_id, entry_date, entry_type, repeat_grade)
     VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.personId,
      open.campus_id,
      input.newGradeId,
      open.year_id,
      open.calendar_id,
      exitDate,
      input.repeat ? 'RETAINED' : 'PROMOTED',
      input.repeat ?? false,
    ],
  )
  if (input.newSectionId) {
    await tx.query(
      `INSERT INTO section_rosters (tenant_id, section_id, person_id, start_date)
       VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3)`,
      [input.newSectionId, input.personId, exitDate],
    )
  }
  return inserted.rows[0]!.id
}

/** E8 — re-admission of an ex-student: same person, NEW enrollment row. */
export async function reAdmit(tx: TxLike, input: Omit<AdmitInput, 'entryType'>): Promise<string> {
  return admitStudent(tx, { ...input, entryType: 'RE_ENTRY' })
}

export type OpenEnrollment = {
  id: string
  person_id: string
  campus_id: string
  grade_id: string
  year_id: string
  entry_date: string
}

export async function openEnrollmentOf(tx: TxLike, personId: string): Promise<OpenEnrollment | null> {
  const rows = await tx.query<OpenEnrollment>(
    `SELECT id, person_id, campus_id, grade_id, year_id, entry_date FROM enrollments
     WHERE person_id = $1 AND exit_date IS NULL
       AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    [personId],
  )
  return rows.rows[0] ?? null
}
