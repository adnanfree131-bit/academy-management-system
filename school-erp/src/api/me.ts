import type { FastifyInstance } from 'fastify'
import { getDb, withTenant } from '../db/db.js'
import { verifySession } from '../auth/service.js'

export async function registerMetaRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/me', async (req, reply) => {
    const db = await getDb()
    const session = verifySession(db, req.headers.authorization as string | undefined)
    if (!session) return reply.code(401).send({ error: 'unauthorized' })
    return reply.send(session)
  })

  app.get('/api/years', async (req, reply) => {
    const db = await getDb()
    const session = verifySession(db, req.headers.authorization as string | undefined)
    if (!session) return reply.code(401).send({ error: 'unauthorized' })
    return withTenant(db, session.tenantId, async (tx) => {
      const rows = await tx.query(
        `SELECT id, name, start_date::text, end_date::text, status FROM academic_years
         WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
         ORDER BY start_date`)
      return rows.rows
    })
  })

  // onboarding metadata for the admin UI (campus/year/grades/sections of this tenant)
  app.get('/api/meta', async (req, reply) => {
    const db = await getDb()
    const session = verifySession(db, req.headers.authorization as string | undefined)
    if (!session) return reply.code(401).send({ error: 'unauthorized' })
    return withTenant(db, session.tenantId, async (tx) => {
      const campus = await tx.query<{ id: string }>(
        `SELECT id FROM campuses WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid LIMIT 1`)
      const year = await tx.query<{ id: string }>(
        `SELECT id FROM academic_years WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid AND status = 'ACTIVE' LIMIT 1`)
      const grades = await tx.query<{ id: string; name: string }>(
        `SELECT id, name FROM grades WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid ORDER BY rank`)
      const sections = await tx.query<{ id: string; grade_id: string; name: string }>(
        `SELECT id, grade_id, name FROM sections WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid ORDER BY name`)
      const feeHeads = await tx.query<{ id: string; name: string; priority: number }>(
        `SELECT id, name, priority FROM fee_heads WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid ORDER BY priority`)
      return {
        campusId: campus.rows[0]?.id ?? null,
        yearId: year.rows[0]?.id ?? null,
        grades: Object.fromEntries(grades.rows.map((g) => [g.name, g.id])),
        sections: Object.fromEntries(
          grades.rows.map((g) => [
            g.name,
            sections.rows.filter((s) => s.grade_id === g.id).map((s) => s.id),
          ]),
        ),
        feeHeads: feeHeads.rows,
      }
    })
  })
}
