import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getDb, withTenant, asAdmin, type TxLike } from '../db/db.js'
import { requestOtp, verifyOtpAndSignIn, verifySession, type Session } from '../auth/service.js'
import { createStudent, linkGuardian, currentIdentity } from '../kernel/people.js'
import { admitStudent, exitStudent, roster, changeGradeMidYear, reAdmit } from '../kernel/enrollment.js'
import { markDailyAttendance, attendancePercentage, sectionRosterForDay } from '../kernel/attendance.js'
import {
  createFeeHead, postInvoice, openCharges, planAllocation, collectPayment,
  bounceReceipt, laterInvoicesFullyPaid, issueCreditNote, openCashSession, closeCashSession, studentBalance,
} from '../kernel/finance.js'
import { setPromotionDecision, executeRollover } from '../kernel/rollover.js'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

async function requireSession(req: { headers: Record<string, string | string[] | undefined> }): Promise<Session> {
  const db = await getDb()
  const session = verifySession(db, req.headers.authorization as string | undefined)
  if (!session) throw Object.assign(new Error('unauthorized'), { statusCode: 401 })
  return session
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // ---------------- auth ----------------
  app.post('/api/auth/otp', async (req, reply) => {
    const body = z.object({ email: z.string().email() }).parse(req.body)
    const db = await getDb()
    const out = await requestOtp(db, body.email)
    return reply.send(out)
  })

  app.post('/api/auth/verify', async (req, reply) => {
    const body = z.object({ email: z.string().email(), code: z.string().length(6), tenantId: z.string().uuid().optional() }).parse(req.body)
    const db = await getDb()
    const result = await verifyOtpAndSignIn(db, body.email, body.code, body.tenantId)
    if (result.status !== 'ok') return reply.code(400).send(result)
    return reply.send(result)
  })

  // ---------------- tenant onboarding wizard ----------------
  app.post('/api/onboard', async (req, reply) => {
    const body = z.object({
      tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
      tenantName: z.string().min(2),
      countryCode: z.string().length(2).optional(),
      timezone: z.string().optional(),
      adminEmail: z.string().email(),
      adminName: z.string().min(2),
      campusName: z.string().min(1),
      yearName: z.string().min(4),
      yearStart: dateStr,
      yearEnd: dateStr,
      grades: z.array(z.object({ name: z.string().min(1), rank: z.number().int() })).min(1),
      sectionsPerGrade: z.number().int().min(1).max(10).default(1),
      sessionDays: z.array(dateStr).default([]), // explicit in-session days; weekdays auto-derived otherwise
      weekdaySessions: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
    }).parse(req.body)

    const db = await getDb()
    const out = await asAdmin(db, async (tx) => {
      const tenantRows = await tx.query<{ id: string }>(
        `INSERT INTO tenants (slug, name, country_code, timezone) VALUES ($1, $2, $3, $4) RETURNING id`,
        [body.tenantSlug, body.tenantName, body.countryCode ?? 'XX', body.timezone ?? 'UTC'],
      )
      const tenantId = tenantRows.rows[0]!.id

      // admin user (upsert by email)
      let userId: string
      const existing = await tx.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [body.adminEmail.toLowerCase()])
      if (existing.rows.length > 0) {
        userId = existing.rows[0]!.id
      } else {
        const u = await tx.query<{ id: string }>('INSERT INTO users (email, full_name) VALUES ($1, $2) RETURNING id', [
          body.adminEmail.toLowerCase(),
          body.adminName,
        ])
        userId = u.rows[0]!.id
      }
      await tx.query(`INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'ADMIN') ON CONFLICT DO NOTHING`, [tenantId, userId])

      const campusRows = await tx.query<{ id: string }>(
        `INSERT INTO campuses (tenant_id, name) VALUES ($1, $2) RETURNING id`, [tenantId, body.campusName],
      )
      const campusId = campusRows.rows[0]!.id
      const yearRows = await tx.query<{ id: string }>(
        `INSERT INTO academic_years (tenant_id, name, start_date, end_date, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING id`,
        [tenantId, body.yearName, body.yearStart, body.yearEnd],
      )
      const yearId = yearRows.rows[0]!.id

      // calendar: mark configured weekdays in-session within the year
      const start = new Date(body.yearStart)
      const end = new Date(body.yearEnd)
      const weekdaySet = new Set(body.weekdaySessions)
      const batch: Array<[string, string]> = []
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10)
        const dow = d.getUTCDay()
        batch.push([iso, weekdaySet.has(dow) ? 'IN_SESSION' : 'WEEKEND'])
      }
      for (const [day, dayType] of batch) {
        if (body.sessionDays.includes(day)) continue // explicit overrides applied after
      }
      const explicit = new Map(body.sessionDays.map((d) => [d, 'IN_SESSION' as const]))
      for (const [day] of batch) {
        const t = explicit.get(day)
        await tx.query(
          `INSERT INTO calendar_days (tenant_id, year_id, day, day_type) VALUES ($1, $2, $3, $4)
           ON CONFLICT (year_id, day) DO UPDATE SET day_type = EXCLUDED.day_type`,
          [tenantId, yearId, day, t ?? batch.find((b) => b[0] === day)![1]],
        )
      }
      for (const [day] of batch) {
        if (body.sessionDays.includes(day)) {
          await tx.query(
            `INSERT INTO calendar_days (tenant_id, year_id, day, day_type) VALUES ($1, $2, $3, 'IN_SESSION')
             ON CONFLICT (year_id, day) DO UPDATE SET day_type = 'IN_SESSION'`,
            [tenantId, yearId, day],
          )
        }
      }

      const gradeIds: Record<string, string> = {}
      for (const g of body.grades) {
        const gr = await tx.query<{ id: string }>(
          `INSERT INTO grades (tenant_id, name, rank) VALUES ($1, $2, $3) RETURNING id`, [tenantId, g.name, g.rank],
        )
        gradeIds[g.name] = gr.rows[0]!.id
      }
      const sectionIds: Record<string, string[]> = {}
      for (const g of body.grades) {
        sectionIds[g.name] = []
        for (let s = 0; s < body.sectionsPerGrade; s++) {
          const sec = await tx.query<{ id: string }>(
            `INSERT INTO sections (tenant_id, campus_id, grade_id, name)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [tenantId, campusId, gradeIds[g.name]!, String.fromCharCode(65 + s)],
          )
          sectionIds[g.name]!.push(sec.rows[0]!.id)
        }
      }
      // default fee heads with F1 priority order
      for (const [name, priority] of [['Tuition', 10], ['Transport', 20], ['Exam', 30], ['Misc', 90]] as const) {
        await tx.query(`INSERT INTO fee_heads (tenant_id, name, priority) VALUES ($1, $2, $3)`, [tenantId, name, priority])
      }
      await tx.query(`INSERT INTO tenant_serials (tenant_id) VALUES ($1)`, [tenantId])
      return { tenantId, yearId, campusId, gradeIds, sectionIds }
    })
    return reply.send(out)
  })

  // ---------------- admissions & students ----------------
  const admitSchema = z.object({
    legalName: z.string().min(2),
    preferredName: z.string().optional(),
    dateOfBirth: dateStr.optional(),
    gender: z.string().optional(),
    campusId: z.string().uuid(),
    gradeId: z.string().uuid(),
    yearId: z.string().uuid(),
    entryDate: dateStr,
    sectionId: z.string().uuid().optional(),
    guardians: z.array(z.object({
      legalName: z.string().min(2),
      relationLabel: z.string().optional(),
      canPay: z.boolean().optional(),
      canPickup: z.boolean().optional(),
      financiallyResponsible: z.boolean().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    })).default([]),
  })

  app.post('/api/students/admit', async (req, reply) => {
    const session = await requireSession(req)
    const body = admitSchema.parse(req.body)
    const db = await getDb()
    // Tenant-scoped work runs under RLS. Guardian USER provisioning is a
    // platform-level operation (users are cross-tenant) → asAdmin afterwards.
    const out = await withTenant(db, session.tenantId, async (tx) => {
      const personId = await createStudent(tx, body)
      const enrollmentId = await admitStudent(tx, { ...body, personId })
      const guardianLinks: Array<{ guardianId: string; email: string; name: string }> = []
      for (const g of body.guardians) {
        const gid = await linkGuardian(tx, personId, g)
        if (g.email) guardianLinks.push({ guardianId: gid, email: g.email.toLowerCase(), name: g.legalName })
      }
      return { personId, enrollmentId, guardianLinks }
    })
    if (out.guardianLinks.length > 0) {
      await asAdmin(db, async (tx) => {
        for (const gl of out.guardianLinks) {
          const u = await tx.query<{ id: string }>(
            `INSERT INTO users (email, full_name) VALUES ($1, $2)
             ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id`,
            [gl.email, gl.name],
          )
          await tx.query(
            `INSERT INTO memberships (tenant_id, user_id, role, person_id)
             VALUES ($1, $2, 'GUARDIAN', $3)
             ON CONFLICT (tenant_id, user_id) DO UPDATE SET person_id = EXCLUDED.person_id`,
            [session.tenantId, u.rows[0]!.id, gl.guardianId],
          )
        }
      })
    }
    return reply.send({ personId: out.personId, enrollmentId: out.enrollmentId })
  })

  app.get('/api/students', async (req) => {
    const session = await requireSession(req)
    const db = await getDb()
    return withTenant(db, session.tenantId, async (tx) => {
      const rows = await tx.query(
        `SELECT p.id, p.person_no, i.legal_name, i.preferred_name,
                e.entry_date, e.exit_date, e.exit_type, g.name AS grade, s.name AS section
         FROM persons p
         JOIN identities i ON i.person_id = p.id AND i.valid_to IS NULL
         LEFT JOIN enrollments e ON e.person_id = p.id AND e.exit_date IS NULL
         LEFT JOIN grades g ON g.id = e.grade_id
         LEFT JOIN section_rosters sr ON sr.person_id = p.id AND sr.end_date IS NULL
         LEFT JOIN sections s ON s.id = sr.section_id
         WHERE p.is_student
         ORDER BY p.person_no`,
      )
      return rows.rows
    })
  })

  app.get('/api/students/:id', async (req) => {
    const session = await requireSession(req)
    const { id } = req.params as { id: string }
    const db = await getDb()
    return withTenant(db, session.tenantId, async (tx) => {
      const identity = await currentIdentity(tx, id)
      const balance = await studentBalance(tx, id)
      const attendance = await attendancePercentage(
        tx, id,
        new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10),
      )
      const guardians = await tx.query(
        `SELECT i.legal_name, r.relation_label, r.can_view, r.can_pay, r.can_pickup, r.is_financially_responsible
         FROM relationships r JOIN identities i ON i.person_id = r.from_person_id AND i.valid_to IS NULL
         WHERE r.to_person_id = $1 AND r.valid_to IS NULL`,
        [id],
      )
      return { identity, balance, attendance, guardians: guardians.rows }
    })
  })

  // ---------------- enrollment operations ----------------
  app.post('/api/enrollments/transfer-section', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({ personId: z.string().uuid(), sectionId: z.string().uuid(), effectiveDate: dateStr }).parse(req.body)
    const db = await getDb()
    await withTenant(db, session.tenantId, async (tx) =>
      roster(tx, { enrollmentPersonId: body.personId, sectionId: body.sectionId, startDate: body.effectiveDate }))
    return reply.send({ ok: true })
  })

  app.post('/api/enrollments/exit', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({
      personId: z.string().uuid(),
      exitDate: dateStr,
      exitType: z.enum(['TRANSFERRED_OUT', 'GRADUATED', 'WITHDRAWN', 'DECEASED', 'NO_SHOW']),
    }).parse(req.body)
    const db = await getDb()
    await withTenant(db, session.tenantId, async (tx) => exitStudent(tx, body))
    return reply.send({ ok: true })
  })

  app.post('/api/enrollments/change-grade', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({
      personId: z.string().uuid(),
      cutDate: dateStr,
      newGradeId: z.string().uuid(),
      newSectionId: z.string().uuid().optional(),
      repeat: z.boolean().optional(),
    }).parse(req.body)
    const db = await getDb()
    const id = await withTenant(db, session.tenantId, async (tx) => changeGradeMidYear(tx, body))
    return reply.send({ enrollmentId: id })
  })

  app.post('/api/enrollments/readmit', async (req, reply) => {
    const session = await requireSession(req)
    const body = admitSchema.omit({ guardians: true, legalName: true, preferredName: true, dateOfBirth: true, gender: true })
      .extend({ personId: z.string().uuid() }).parse(req.body)
    const db = await getDb()
    const id = await withTenant(db, session.tenantId, async (tx) => reAdmit(tx, body))
    return reply.send({ enrollmentId: id })
  })

  // ---------------- attendance ----------------
  app.post('/api/attendance/mark', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({
      sectionId: z.string().uuid(),
      day: dateStr,
      marks: z.array(z.object({
        personId: z.string().uuid(),
        category: z.enum(['PRESENT', 'ABSENT_UNEXCUSED', 'ABSENT_EXCUSED', 'LATE', 'HALF_DAY', 'SCHOOL_ACTIVITY', 'SUSPENDED']),
      })).min(1),
    }).parse(req.body)
    const db = await getDb()
    await withTenant(db, session.tenantId, async (tx) => markDailyAttendance(tx, { ...body, takenBy: session.userId }))
    return reply.send({ ok: true })
  })

  app.get('/api/attendance/roster/:sectionId', async (req) => {
    const session = await requireSession(req)
    const { sectionId } = req.params as { sectionId: string }
    const q = req.query as { day?: string }
    const day = q.day ?? new Date().toISOString().slice(0, 10)
    const db = await getDb()
    return withTenant(db, session.tenantId, async (tx) => sectionRosterForDay(tx, sectionId, day))
  })

  // ---------------- finance desk ----------------
  app.post('/api/finance/fee-heads', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({ name: z.string().min(1), priority: z.number().int().optional() }).parse(req.body)
    const db = await getDb()
    const id = await withTenant(db, session.tenantId, async (tx) => createFeeHead(tx, body))
    return reply.send({ id })
  })

  app.post('/api/finance/invoices', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({
      personId: z.string().uuid(),
      billingPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      lines: z.array(z.object({ feeHeadId: z.string().uuid(), amount: z.number().positive(), description: z.string().optional() })).min(1),
    }).parse(req.body)
    const db = await getDb()
    const id = await withTenant(db, session.tenantId, async (tx) => postInvoice(tx, body))
    return reply.send({ id })
  })

  app.get('/api/finance/charges/:personId', async (req) => {
    const session = await requireSession(req)
    const { personId } = req.params as { personId: string }
    const db = await getDb()
    return withTenant(db, session.tenantId, async (tx) => {
      const charges = await openCharges(tx, personId)
      return { charges, samplePlan: planAllocation(charges, charges.reduce((s, c) => s + c.due, 0)) }
    })
  })

  app.post('/api/finance/cash-session/open', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({ openingFloat: z.number().nonnegative().default(0) }).parse(req.body)
    const db = await getDb()
    const id = await withTenant(db, session.tenantId, async (tx) => openCashSession(tx, session.userId, body.openingFloat))
    return reply.send({ id })
  })

  app.post('/api/finance/cash-session/close', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({ sessionId: z.string().uuid(), countedTotal: z.number().nonnegative(), varianceReason: z.string().default('') }).parse(req.body)
    const db = await getDb()
    const out = await withTenant(db, session.tenantId, async (tx) => closeCashSession(tx, body.sessionId, body.countedTotal, body.varianceReason))
    return reply.send(out)
  })

  app.post('/api/finance/collect', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({
      personId: z.string().uuid(),
      amount: z.number().positive(),
      method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'GATEWAY']),
      reference: z.string().optional(),
      notes: z.string().optional(),
      override: z.array(z.object({ invoiceLineId: z.string().uuid(), amount: z.number().positive() })).nullable().optional(),
      cashSessionId: z.string().uuid().nullable().optional(),
    }).parse(req.body)
    const db = await getDb()
    const out = await withTenant(db, session.tenantId, async (tx) =>
      collectPayment(tx, { ...body, collectedBy: session.userId, override: body.override ?? null, cashSessionId: body.cashSessionId ?? null }))
    return reply.send(out)
  })

  app.post('/api/finance/bounce', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({ receiptId: z.string().uuid(), reason: z.string().min(3) }).parse(req.body)
    const db = await getDb()
    await withTenant(db, session.tenantId, async (tx) => bounceReceipt(tx, { ...body, byUserId: session.userId }))
    return reply.send({ ok: true })
  })

  app.post('/api/finance/credit-note', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({
      personId: z.string().uuid(), amount: z.number().positive(), reason: z.string().min(3), invoiceId: z.string().uuid().optional(),
    }).parse(req.body)
    const db = await getDb()
    const out = await withTenant(db, session.tenantId, async (tx) => issueCreditNote(tx, { ...body, byUserId: session.userId }))
    return reply.send(out)
  })

  app.post('/api/finance/receipt-cancellation-check', async (req) => {
    const session = await requireSession(req)
    const body = z.object({ receiptId: z.string().uuid() }).parse(req.body)
    const db = await getDb()
    return withTenant(db, session.tenantId, async (tx) => {
      const r = await tx.query<{ person_id: string; received_at: string }>(
        'SELECT person_id, received_at FROM receipts WHERE id = $1', [body.receiptId])
      const receipt = r.rows[0]
      if (!receipt) throw Object.assign(new Error('receipt not found'), { statusCode: 404 })
      const blockers = await laterInvoicesFullyPaid(tx, receipt.person_id, receipt.received_at)
      return { cancellable: blockers.length === 0, blockers }
    })
  })

  app.get('/api/finance/balance/:personId', async (req) => {
    const session = await requireSession(req)
    const { personId } = req.params as { personId: string }
    const db = await getDb()
    return withTenant(db, session.tenantId, async (tx) => studentBalance(tx, personId))
  })

  // ---------------- rollover ----------------
  app.post('/api/rollover/decision', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({
      personId: z.string().uuid(),
      action: z.enum(['PROMOTE', 'RETAIN', 'GRADUATE', 'DO_NOT_ENROLL']),
      nextGradeId: z.string().uuid().nullable().optional(),
    }).parse(req.body)
    const db = await getDb()
    await withTenant(db, session.tenantId, async (tx) => setPromotionDecision(tx, body.personId, body.action, body.nextGradeId ?? null))
    return reply.send({ ok: true })
  })

  app.post('/api/rollover/execute', async (req, reply) => {
    const session = await requireSession(req)
    const body = z.object({
      fromYearId: z.string().uuid(), toYearId: z.string().uuid(), toYearStartDate: dateStr,
    }).parse(req.body)
    const db = await getDb()
    const summary = await withTenant(db, session.tenantId, async (tx) => executeRollover(tx, { ...body, executedBy: session.userId }))
    return reply.send(summary)
  })

  // ---------------- parent portal (read-only) ----------------
  app.get('/api/portal/my-children', async (req) => {
    const session = await requireSession(req)
    if (session.role !== 'GUARDIAN' && session.role !== 'ADMIN') {
      throw Object.assign(new Error('forbidden'), { statusCode: 403 })
    }
    const db = await getDb()
    return withTenant(db, session.tenantId, async (tx) => {
      if (session.role === 'ADMIN') {
        const rows = await tx.query(
          `SELECT p.id, p.person_no, i.legal_name FROM persons p
           JOIN identities i ON i.person_id = p.id AND i.valid_to IS NULL
           WHERE p.is_student ORDER BY p.person_no LIMIT 50`)
        return rows.rows
      }
      const rows = await tx.query(
        `SELECT p.id, p.person_no, i.legal_name
         FROM memberships m
         JOIN relationships r ON r.from_person_id = m.person_id AND r.valid_to IS NULL
         JOIN persons p ON p.id = r.to_person_id
         JOIN identities i ON i.person_id = p.id AND i.valid_to IS NULL
         WHERE m.user_id = $1 AND m.tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
        [session.userId])
      return rows.rows
    })
  })

  app.get('/api/portal/child/:id', async (req) => {
    const session = await requireSession(req)
    const { id } = req.params as { id: string }
    const db = await getDb()
    return withTenant(db, session.tenantId, async (tx) => {
      if (session.role === 'GUARDIAN') {
        const allowed = await tx.query<{ id: string }>(
          `SELECT 1 AS id FROM memberships m
           JOIN relationships r ON r.from_person_id = m.person_id AND r.valid_to IS NULL
           WHERE m.user_id = $1 AND r.to_person_id = $2
             AND m.tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
          [session.userId, id])
        if (allowed.rows.length === 0) throw Object.assign(new Error('forbidden'), { statusCode: 403 })
      }
      const attendance = await attendancePercentage(
        tx, id,
        new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10),
      )
      const balance = await studentBalance(tx, id)
      const recent = await tx.query(
        `SELECT day, category FROM attendance_events WHERE person_id = $1
           AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
         ORDER BY day DESC LIMIT 10`, [id])
      return { attendance, balance, recentAttendance: recent.rows }
    })
  })
}

/** Sequential statements inside the caller's withTenant transaction.
 *  (PGlite is single-connection; withTenant already wraps BEGIN/COMMIT —
 *  this helper exists to make nesting explicit and future-proof.) */
async function txTransaction<T>(tx: TxLike, fn: (t: TxLike) => Promise<T>): Promise<T> {
  return fn(tx)
}
