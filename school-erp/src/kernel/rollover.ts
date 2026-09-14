import type { TxLike } from '../db/db.js'

export type RolloverAction = 'PROMOTE' | 'RETAIN' | 'GRADUATE' | 'DO_NOT_ENROLL'

/** Record the promotion decision for one student's open enrollment (Y1). */
export async function setPromotionDecision(
  tx: TxLike,
  personId: string,
  action: RolloverAction,
  nextGradeId: string | null,
): Promise<void> {
  if (action === 'PROMOTE' && !nextGradeId) throw new Error('PROMOTE requires a next grade')
  const res = await tx.query<{ id: string }>(
    `UPDATE enrollments
     SET next_year_action = $2, next_year_grade_id = $3
     WHERE person_id = $1 AND exit_date IS NULL
       AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
     RETURNING id`,
    [personId, action, nextGradeId],
  )
  if (res.rows.length === 0) throw new Error('no open enrollment')
}

export type RolloverSummary = {
  promoted: number
  retained: number
  graduated: number
  notEnrolled: number
  skippedNoDecision: number
  errors: string[]
}

/**
 * Execute rollover for every currently-enrolled student, driven ONLY by the
 * decision flags. Creates next-year enrollments (entry_type PROMOTED/RETAINED/
 * new-year) and exits this year's rows on the year end date. Idempotent per
 * (person, to_year): a person with an enrollment already in to_year is skipped.
 */
export async function executeRollover(
  tx: TxLike,
  input: { fromYearId: string; toYearId: string; toYearStartDate: string; executedBy: string },
): Promise<RolloverSummary> {
  const summary: RolloverSummary = { promoted: 0, retained: 0, graduated: 0, notEnrolled: 0, skippedNoDecision: 0, errors: [] }

  const rows = await tx.query<{
    id: string
    person_id: string
    campus_id: string
    grade_id: string
    calendar_id: string | null
    next_year_action: RolloverAction | null
    next_year_grade_id: string | null
  }>(
    `SELECT id, person_id, campus_id, grade_id, calendar_id, next_year_action, next_year_grade_id
     FROM enrollments
     WHERE year_id = $1 AND exit_date IS NULL
       AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
     ORDER BY person_id`,
    [input.fromYearId],
  )

  const yearEnd = await tx.query<{ end_date: string }>('SELECT end_date FROM academic_years WHERE id = $1', [input.fromYearId])
  const exitDate = yearEnd.rows[0]!.end_date

  for (const e of rows.rows) {
    try {
      // idempotency: skip if already enrolled in target year
      const existing = await tx.query<{ id: string }>(
        `SELECT id FROM enrollments WHERE person_id = $1 AND year_id = $2
           AND tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
        [e.person_id, input.toYearId],
      )
      if (existing.rows.length > 0) {
        continue
      }
      switch (e.next_year_action) {
        case 'PROMOTE': {
          await tx.query(`UPDATE enrollments SET exit_date = $2, exit_type = 'PROMOTED' WHERE id = $1`, [e.id, exitDate])
          await tx.query(
            `INSERT INTO enrollments (tenant_id, person_id, campus_id, grade_id, year_id, calendar_id, entry_date, entry_type)
             VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6, 'PROMOTED')`,
            [e.person_id, e.campus_id, e.next_year_grade_id, input.toYearId, e.calendar_id, input.toYearStartDate],
          )
          summary.promoted++
          break
        }
        case 'RETAIN': {
          await tx.query(`UPDATE enrollments SET exit_date = $2, exit_type = 'RETAINED' WHERE id = $1`, [e.id, exitDate])
          await tx.query(
            `INSERT INTO enrollments (tenant_id, person_id, campus_id, grade_id, year_id, calendar_id, entry_date, entry_type, repeat_grade)
             VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, $5, $6, 'RETAINED', true)`,
            [e.person_id, e.campus_id, e.grade_id, input.toYearId, e.calendar_id, input.toYearStartDate],
          )
          summary.retained++
          break
        }
        case 'GRADUATE': {
          await tx.query(`UPDATE enrollments SET exit_date = $2, exit_type = 'GRADUATED' WHERE id = $1`, [e.id, exitDate])
          summary.graduated++
          break
        }
        case 'DO_NOT_ENROLL': {
          await tx.query(`UPDATE enrollments SET exit_date = $2, exit_type = 'WITHDRAWN' WHERE id = $1`, [e.id, exitDate])
          summary.notEnrolled++
          break
        }
        default:
          summary.skippedNoDecision++
      }
    } catch (err) {
      summary.errors.push(`person ${e.person_id}: ${(err as Error).message}`)
    }
  }
  await tx.query(`INSERT INTO promotion_runs (tenant_id, from_year_id, to_year_id, executed_by, summary)
                  VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4)`, [
    input.fromYearId,
    input.toYearId,
    input.executedBy,
    JSON.stringify(summary),
  ])
  return summary
}
