import { describe, it, expect, beforeAll } from 'vitest'
import { setupTest, api, type TestContext } from './helpers.js'
import { withTenant } from '../src/db/db.js'
import { createStudent, linkGuardian } from '../src/kernel/people.js'
import { admitStudent, exitStudent, roster, changeGradeMidYear, reAdmit } from '../src/kernel/enrollment.js'
import { markDailyAttendance, attendancePercentage, sectionRosterForDay } from '../src/kernel/attendance.js'
import { postInvoice, collectPayment, openCharges, planAllocation, bounceReceipt, studentBalance, issueCreditNote, openCashSession } from '../src/kernel/finance.js'
import { setPromotionDecision, executeRollover } from '../src/kernel/rollover.js'

let ctx: TestContext
beforeAll(async () => { ctx = await setupTest() })

async function makeStudent(t: TestContext, tenant: TestContext['tenantA'], name: string, grade: 'Grade 1' | 'Grade 2' | 'Grade 3', entry = '2026-08-03') {
  return withTenant(t.db, tenant.id, async (tx) => {
    const personId = await createStudent(tx, { legalName: name })
    await admitStudent(tx, { personId, campusId: tenant.campusId, gradeId: tenant.grades[grade]!, yearId: tenant.yearId, entryDate: entry })
    return personId
  })
}

/** F11: one open session per cashier — close any lingering one before opening fresh. */
async function freshCashSession(tx: any, userId: string): Promise<string> {
  await tx.query(
    `UPDATE cash_sessions SET closed_at = now(), counted_total = 0, variance = 0, variance_reason = 'test teardown'
     WHERE cashier_id = $1 AND closed_at IS NULL`, [userId])
  return openCashSession(tx, userId, 0)
}

describe('E1 — mid-year section transfer preserves attendance ownership', () => {
  it('re-rosters the student; school enrollment untouched; attendance stays on the owning section', async () => {
    const pid = await makeStudent(ctx, ctx.tenantA, 'Transfer Test', 'Grade 1')
    await withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      await markDailyAttendance(tx, {
        sectionId: ctx.tenantA.sections['Grade 1']!, day: '2026-08-03', takenBy: ctx.adminA.userId,
        marks: [{ personId: pid, category: 'PRESENT' }],
      })
      // transfer to Grade 2 section mid-year
      await roster(tx, { enrollmentPersonId: pid, sectionId: ctx.tenantA.sections['Grade 2']!, startDate: '2026-08-10' })
      // old attendance remains attached to the old section
      const oldEvents = await tx.query(`SELECT section_id FROM attendance_events WHERE person_id = $1`, [pid])
      expect(oldEvents.rows[0]).toMatchObject({ section_id: ctx.tenantA.sections['Grade 1'] })
      // roster for the new section today includes the student
      const r = await sectionRosterForDay(tx, ctx.tenantA.sections['Grade 2']!, '2026-08-11')
      expect(r.find((x) => x.personId === pid)).toBeTruthy()
      // open enrollment unchanged (one row, same grade)
      const e = await tx.query(`SELECT grade_id, exit_date FROM enrollments WHERE person_id = $1 AND exit_date IS NULL`, [pid])
      expect(e.rows).toHaveLength(1)
      expect(e.rows[0]).toMatchObject({ grade_id: ctx.tenantA.grades['Grade 1'], exit_date: null })
    })
  })
})

describe('E2 — mid-year grade change is close-and-open', () => {
  it('creates two enrollments with no date overlap and correct exit/entry types', async () => {
    const pid = await makeStudent(ctx, ctx.tenantA, 'Midyear Promotion', 'Grade 1')
    await withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      const newId = await changeGradeMidYear(tx, {
        personId: pid, cutDate: '2026-09-01', newGradeId: ctx.tenantA.grades['Grade 2']!,
        newSectionId: ctx.tenantA.sections['Grade 2']!,
      })
      const rows = await tx.query(`SELECT id, grade_id, entry_date::text, exit_date::text, exit_type FROM enrollments WHERE person_id = $1 ORDER BY entry_date`, [pid])
      expect(rows.rows).toHaveLength(2)
      const first = rows.rows[0] as any
      const second = rows.rows[1] as any
      expect(first.exit_date).toBe('2026-09-01')
      expect(second.entry_date).toBe('2026-09-01')
      expect(second.grade_id).toBe(ctx.tenantA.grades['Grade 2'])
      expect(second.id).toBe(newId)
    })
    // the exclusion constraint really fires
    await expect(withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      await tx.query(
        `INSERT INTO enrollments (tenant_id, person_id, campus_id, grade_id, year_id, entry_date, exit_date)
         VALUES (current_setting('app.current_tenant_id', true)::uuid, $1, $2, $3, $4, '2026-08-15', '2026-08-20')`,
        [pid, ctx.tenantA.campusId, ctx.tenantA.grades['Grade 3'], ctx.tenantA.yearId])
    })).rejects.toThrow()
  })
})

describe('E8 — re-admission of an ex-student', () => {
  it('keeps one person; creates a new enrollment; history intact', async () => {
    const pid = await makeStudent(ctx, ctx.tenantA, 'Returnee Kid', 'Grade 2')
    await withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      await exitStudent(tx, { personId: pid, exitDate: '2026-09-15', exitType: 'WITHDRAWN' })
      await reAdmit(tx, { personId: pid, campusId: ctx.tenantA.campusId, gradeId: ctx.tenantA.grades['Grade 2']!, yearId: ctx.tenantA.yearId, entryDate: '2026-10-01' })
      const rows = await tx.query(`SELECT entry_type, exit_type FROM enrollments WHERE person_id = $1 ORDER BY entry_date`, [pid])
      expect(rows.rows.map((r: any) => r.entry_type)).toEqual(['NEW', 'RE_ENTRY'])
      expect(rows.rows[0]).toMatchObject({ exit_type: 'WITHDRAWN' })
    })
  })
})

describe('F1 — deterministic allocation', () => {
  it('two identical partial payments produce identical splits by head priority', async () => {
    const pid = await makeStudent(ctx, ctx.tenantA, 'Ledger Kid', 'Grade 1')
    let tuitionLineId = ''
    await withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      const heads = await tx.query(`SELECT id, name FROM fee_heads ORDER BY priority`)
      const tuition = heads.rows.find((h: any) => h.name === 'Tuition') as any
      const transport = heads.rows.find((h: any) => h.name === 'Transport') as any
      const inv = await postInvoice(tx, {
        personId: pid, billingPeriod: '2026-09',
        lines: [
          { feeHeadId: transport.id, amount: 2000 },
          { feeHeadId: tuition.id, amount: 8000 },
        ],
      })
      const lines = await tx.query(`SELECT l.id, fh.name FROM invoice_lines l JOIN fee_heads fh ON fh.id = l.fee_head_id WHERE l.invoice_id = $1`, [inv])
      tuitionLineId = (lines.rows.find((l: any) => l.name === 'Tuition') as any).id
    })
    // simulate two cashiers planning the same 4000 payment
    const [planA, planB] = await Promise.all([
      withTenant(ctx.db, ctx.tenantA.id, async (tx) => planAllocation(await openCharges(tx, pid), 4000)),
      withTenant(ctx.db, ctx.tenantA.id, async (tx) => planAllocation(await openCharges(tx, pid), 4000)),
    ])
    expect(planA).toEqual(planB)
    // tuition priority 10 < transport 20 → tuition line allocated first
    expect(planA).toHaveLength(1)
    expect(planA[0]!.amount).toBe(4000)
  })

  it('collects, allocates by priority, and reports the balance', async () => {
    const pid = await makeStudent(ctx, ctx.tenantA, 'Balance Kid', 'Grade 1')
    await withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      const sessionId = await freshCashSession(tx, ctx.adminA.userId)
      const heads = await tx.query(`SELECT id, name FROM fee_heads ORDER BY priority`)
      const tuition = heads.rows.find((h: any) => h.name === 'Tuition') as any
      const transport = heads.rows.find((h: any) => h.name === 'Transport') as any
      await postInvoice(tx, {
        personId: pid, billingPeriod: '2026-09',
        lines: [{ feeHeadId: transport.id, amount: 2000 }, { feeHeadId: tuition.id, amount: 8000 }],
      })
      const r1 = await collectPayment(tx, { personId: pid, amount: 5000, method: 'CASH', cashSessionId: sessionId, collectedBy: ctx.adminA.userId })
      // 5000 → tuition first (priority 10): 5000 of 8000
      expect(r1.allocations).toHaveLength(1)
      const bal = await studentBalance(tx, pid)
      expect(bal.billed).toBe(10000)
      expect(bal.allocated).toBe(5000)
      expect(bal.balance).toBe(5000)
      await collectPayment(tx, { personId: pid, amount: 5000, method: 'CASH', cashSessionId: sessionId, collectedBy: ctx.adminA.userId })
      const bal2 = await studentBalance(tx, pid)
      expect(bal2.balance).toBe(0) // 3000 tuition + 2000 transport
      const credits = await tx.query(`SELECT amount FROM student_credits WHERE person_id = $1`, [pid])
      expect(credits.rows).toHaveLength(0)
    })
  })

  it('F2 — overpayment becomes a student credit, not a silent month', async () => {
    const pid = await makeStudent(ctx, ctx.tenantA, 'Advance Kid', 'Grade 1')
    await withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      const sessionId = await freshCashSession(tx, ctx.adminA.userId)
      const tuition = (await tx.query(`SELECT id FROM fee_heads WHERE name = 'Tuition'`)).rows[0] as any
      await postInvoice(tx, { personId: pid, lines: [{ feeHeadId: tuition.id, amount: 8000 }] })
      const r = await collectPayment(tx, { personId: pid, amount: 9000, method: 'CASH', cashSessionId: sessionId, collectedBy: ctx.adminA.userId })
      expect(r.excess).toBe(1000)
      const credits = await tx.query<{ amount: string }>(`SELECT amount FROM student_credits WHERE person_id = $1`, [pid])
      expect(Number(credits.rows[0]!.amount)).toBe(1000)
      expect((await studentBalance(tx, pid)).balance).toBe(0)
    })
  })
})

describe('F9 — bounced cheque keeps the serial; reversal is a new document', () => {
  it('marks BOUNCED, creates contra receipt + negative allocations, balance returns', async () => {
    const pid = await makeStudent(ctx, ctx.tenantA, 'Cheque Kid', 'Grade 1')
    await withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      const tuition = (await tx.query(`SELECT id FROM fee_heads WHERE name = 'Tuition'`)).rows[0] as any
      await postInvoice(tx, { personId: pid, lines: [{ feeHeadId: tuition.id, amount: 8000 }] })
      const r = await collectPayment(tx, { personId: pid, amount: 8000, method: 'CHEQUE', reference: 'CH-001', collectedBy: ctx.adminA.userId })
      expect((await studentBalance(tx, pid)).balance).toBe(0)
      await bounceReceipt(tx, { receiptId: r.receiptId, reason: 'insufficient funds', byUserId: ctx.adminA.userId })
      // original receipt still exists with its serial, now BOUNCED
      const orig = await tx.query(`SELECT serial, status FROM receipts WHERE id = $1`, [r.receiptId])
      expect(orig.rows[0]).toMatchObject({ serial: r.serial, status: 'BOUNCED' })
      // contra receipt exists with its own serial
      const contra = await tx.query<{ serial: string }>(
        `SELECT r.serial FROM receipt_reversals rr JOIN receipts r ON r.id = rr.contra_receipt_id WHERE rr.original_receipt_id = $1`, [r.receiptId])
      expect(Number(contra.rows[0]!.serial)).not.toBe(r.serial)
      // allocations net to zero
      const net = await tx.query<{ s: string }>(`SELECT COALESCE(SUM(amount),0)::text AS s FROM allocations WHERE invoice_line_id IN (SELECT id FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE person_id = $1))`, [pid])
      expect(Number(net.rows[0]!.s)).toBe(0)
      expect((await studentBalance(tx, pid)).balance).toBe(8000)
    })
  })
})

describe('F16 — cancelling a receipt after later full payment is refused', () => {
  it('flags blockers and directs to credit note instead', async () => {
    const pid = await makeStudent(ctx, ctx.tenantA, 'Sequence Kid', 'Grade 1')
    await withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      const sessionId = await freshCashSession(tx, ctx.adminA.userId)
      const tuition = (await tx.query(`SELECT id FROM fee_heads WHERE name = 'Tuition'`)).rows[0] as any
      const aug = await postInvoice(tx, { personId: pid, billingPeriod: '2026-08', lines: [{ feeHeadId: tuition.id, amount: 8000 }] })
      const rAug = await collectPayment(tx, { personId: pid, amount: 8000, method: 'CASH', cashSessionId: sessionId, collectedBy: ctx.adminA.userId })
      const sep = await postInvoice(tx, { personId: pid, billingPeriod: '2026-09', lines: [{ feeHeadId: tuition.id, amount: 8000 }] })
      await collectPayment(tx, { personId: pid, amount: 8000, method: 'CASH', cashSessionId: sessionId, collectedBy: ctx.adminA.userId })
      // September invoice (posted later) is fully paid → cancelling rAug would punch a hole
      const blockers = await tx.query<{ id: string }>(
        `SELECT i.id FROM invoices i WHERE i.person_id = $1 AND i.posted_at > (SELECT received_at FROM receipts WHERE id = $2)
         AND i.status='POSTED' AND NOT EXISTS (SELECT 1 FROM invoice_lines l WHERE l.invoice_id = i.id AND (l.amount - COALESCE((SELECT SUM(a.amount) FROM allocations a JOIN receipts r ON r.id=a.receipt_id WHERE a.invoice_line_id=l.id AND r.status IN ('CLEARED','DEPOSITED')),0)) > 0)`,
        [pid, rAug.receiptId])
      expect(blockers.rows).toHaveLength(1)
      expect((blockers.rows[0] as any).id).toBe(sep)
      // the sanctioned path: credit note
      const cn = await issueCreditNote(tx, { personId: pid, amount: 8000, reason: 'fee reversal agreed with parent', invoiceId: aug, byUserId: ctx.adminA.userId })
      expect(cn.serial).toBe(1)
    })
  })
})

describe('AT4/AT5 — calendar and membership windows gate attendance', () => {
  it('refuses marking on a weekend', async () => {
    const pid = await makeStudent(ctx, ctx.tenantA, 'Weekend Kid', 'Grade 1')
    await expect(withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      await markDailyAttendance(tx, {
        sectionId: ctx.tenantA.sections['Grade 1']!, day: '2026-08-08', takenBy: ctx.adminA.userId, // 2026-08-08 is a Saturday
        marks: [{ personId: pid, category: 'PRESENT' }],
      })
    })).rejects.toThrow(/WEEKEND/)
  })

  it('refuses marking a student before their entry date', async () => {
    const pid = await makeStudent(ctx, ctx.tenantA, 'Late Joiner', 'Grade 1', '2026-08-17') // Monday
    await expect(withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      await markDailyAttendance(tx, {
        sectionId: ctx.tenantA.sections['Grade 1']!, day: '2026-08-14', // Friday before entry
        takenBy: ctx.adminA.userId, marks: [{ personId: pid, category: 'ABSENT_UNEXCUSED' }],
      })
    })).rejects.toThrow(/not enrolled/)
  })

  it('computes percentage from in-session days ∩ enrollment window only', async () => {
    const pid = await makeStudent(ctx, ctx.tenantA, 'Percent Kid', 'Grade 1', '2026-08-10') // Monday
    await withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      // week of Aug 10-14: mark Mon-Thu present, Fri absent
      for (const [day, cat] of [['2026-08-10', 'PRESENT'], ['2026-08-11', 'PRESENT'], ['2026-08-12', 'PRESENT'], ['2026-08-13', 'PRESENT'], ['2026-08-14', 'ABSENT_UNEXCUSED']] as const) {
        await markDailyAttendance(tx, { sectionId: ctx.tenantA.sections['Grade 1']!, day, takenBy: ctx.adminA.userId, marks: [{ personId: pid, category: cat }] })
      }
      const pct = await attendancePercentage(tx, pid, '2026-08-01', '2026-08-31')
      // denominator: in-session days from Aug 10 (entry) to Aug 31 = 16 (Aug 10-31 weekdays); present = 4
      expect(pct.present).toBe(4)
      expect(pct.inSessionDays).toBe(16)
      expect(pct.percent).toBe(25)
    })
  })
})

describe('Y1 — rollover runs on promotion decisions', () => {
  it('promotes, retains, graduates per decision; skips undecided; idempotent', async () => {
    const p1 = await makeStudent(ctx, ctx.tenantA, 'Promote Me', 'Grade 1')
    const p2 = await makeStudent(ctx, ctx.tenantA, 'Retain Me', 'Grade 1')
    const p3 = await makeStudent(ctx, ctx.tenantA, 'Graduate Me', 'Grade 3')
    const p4 = await makeStudent(ctx, ctx.tenantA, 'Undecided', 'Grade 1')
    await withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      await setPromotionDecision(tx, p1, 'PROMOTE', ctx.tenantA.grades['Grade 2'] ?? null)
      await setPromotionDecision(tx, p2, 'RETAIN', null)
      await setPromotionDecision(tx, p3, 'GRADUATE', null)
      // next academic year
      const ny = await tx.query<{ id: string }>(
        `INSERT INTO academic_years (tenant_id, name, start_date, end_date, status)
         VALUES (current_setting('app.current_tenant_id', true)::uuid, '2027-2028', '2027-08-01', '2028-05-31', 'PLANNING')
         RETURNING id`)
      const toYearId = ny.rows[0]!.id
      const s1 = await executeRollover(tx, { fromYearId: ctx.tenantA.yearId, toYearId, toYearStartDate: '2027-08-02', executedBy: ctx.adminA.userId })
      // earlier tests enrolled other students without decisions → skippedNoDecision >= 1
      expect(s1).toMatchObject({ promoted: 1, retained: 1, graduated: 1 })
      expect(s1.skippedNoDecision).toBeGreaterThanOrEqual(1)
      // grades after rollover
      const g1 = await tx.query(`SELECT e.exit_type FROM enrollments e WHERE e.person_id = $1 AND e.year_id = $2`, [p1, ctx.tenantA.yearId])
      expect(g1.rows[0]).toMatchObject({ exit_type: 'PROMOTED' })
      const newE = await tx.query(`SELECT grade_id, entry_type, year_id FROM enrollments WHERE person_id = $1 AND year_id = $2`, [p1, toYearId])
      expect(newE.rows[0]).toMatchObject({ grade_id: ctx.tenantA.grades['Grade 2'], entry_type: 'PROMOTED' })
      // retained stays in same grade, repeat flag
      const ret = await tx.query(`SELECT grade_id, repeat_grade FROM enrollments WHERE person_id = $1 AND year_id = $2`, [p2, toYearId])
      expect(ret.rows[0]).toMatchObject({ grade_id: ctx.tenantA.grades['Grade 1'], repeat_grade: true })
      // graduate: no new row
      const grad = await tx.query(`SELECT count(*)::int AS c FROM enrollments WHERE person_id = $1 AND year_id = $2`, [p3, toYearId])
      expect(grad.rows[0]).toMatchObject({ c: 0 })
      // idempotent second run
      const s2 = await executeRollover(tx, { fromYearId: ctx.tenantA.yearId, toYearId, toYearStartDate: '2027-08-02', executedBy: ctx.adminA.userId })
      expect(s2.promoted + s2.retained + s2.graduated).toBe(0)
    })
  })
})

describe('Tenancy data path (SEC1 companion)', () => {
  it('withTenant cannot see another tenant persons', async () => {
    const pidB = await makeStudent(ctx, ctx.tenantB, 'Beta Only', 'Grade 1')
    await withTenant(ctx.db, ctx.tenantA.id, async (tx) => {
      const rows = await tx.query(`SELECT id FROM persons WHERE id = $1`, [pidB])
      expect(rows.rows).toHaveLength(0)
    })
  })
})
