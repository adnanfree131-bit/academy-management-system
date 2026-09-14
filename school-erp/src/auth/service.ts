import type { Db, TxLike } from '../db/db.js'
import { asAdmin } from '../db/db.js'
import { generateOtp, hashOtp, signToken, verifyToken } from './crypto.js'

export type Session = {
  userId: string
  email: string
  tenantId: string
  role: 'ADMIN' | 'STAFF' | 'GUARDIAN' | 'SUPERADMIN'
}

const OTP_TTL_MINUTES = 10

/** Issue an OTP for an email. In dev the code is returned; production sends by email. */
export async function requestOtp(db: Db, email: string): Promise<{ sent: true; devCode?: string }> {
  const code = generateOtp()
  const hash = hashOtp(code, email)
  await asAdmin(db, async (tx) => {
    await tx.query('INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1, $2, now() + interval \'10 minutes\')', [
      email.toLowerCase(),
      hash,
    ])
  })
  return { sent: true, devCode: code }
}

export type AuthResult =
  | { status: 'ok'; token: string; session: Session; memberships: MembershipInfo[] }
  | { status: 'bad_code' }
  | { status: 'no_membership' }

export type MembershipInfo = { tenantId: string; tenantName: string; role: Session['role'] }

/** Verify OTP and mint a tenant-scoped token for the given (or first) membership. */
export async function verifyOtpAndSignIn(
  db: Db,
  email: string,
  code: string,
  tenantId?: string,
): Promise<AuthResult> {
  const emailNorm = email.toLowerCase()
  const ok = await asAdmin(db, async (tx) => {
    const rows = await tx.query<{
      id: string
      code_hash: string
      expires_at: string
      attempts: number
      consumed_at: string | null
    }>(
      `SELECT id, code_hash, expires_at, attempts, consumed_at FROM otp_codes
       WHERE email = $1 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [emailNorm],
    )
    const otp = rows.rows[0]
    if (!otp) return false
    if (otp.attempts >= 4) {
      await tx.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [otp.id])
      return false
    }
    if (hashOtp(code, emailNorm) !== otp.code_hash) {
      await tx.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id])
      return false
    }
    await tx.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [otp.id])
    return true
  })
  if (!ok) return { status: 'bad_code' }

  const memberships = await listMemberships(db, emailNorm)
  if (memberships.length === 0) return { status: 'no_membership' }

  let chosen = memberships[0]!
  if (tenantId) {
    const match = memberships.find((m) => m.tenantId === tenantId)
    if (!match) return { status: 'no_membership' }
    chosen = match
  }
  const session: Session = {
    userId: await getUserId(db, emailNorm),
    email: emailNorm,
    tenantId: chosen.tenantId,
    role: chosen.role,
  }
  const token = signToken({ sub: session.userId, email: session.email, tenant_id: session.tenantId, role: session.role })
  return { status: 'ok', token, session, memberships }
}

async function getUserId(db: Db, email: string): Promise<string> {
  const rows = await db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
  return rows.rows[0]!.id
}

export async function listMemberships(db: Db, email: string): Promise<MembershipInfo[]> {
  const rows = await db.query<{ tenant_id: string; tenant_name: string; role: Session['role'] }>(
    `SELECT m.tenant_id, t.name AS tenant_name, m.role
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     JOIN tenants t ON t.id = m.tenant_id
     WHERE u.email = $1
     ORDER BY t.name`,
    [email],
  )
  return rows.rows.map((r) => ({ tenantId: r.tenant_id, tenantName: r.tenant_name, role: r.role }))
}

export function verifySession(db: Db, authHeader: string | undefined): Session | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const payload = verifyToken<{ sub: string; email: string; tenant_id: string; role: Session['role'] }>(
    authHeader.slice('Bearer '.length),
  )
  if (!payload) return null
  return {
    userId: payload.sub,
    email: payload.email,
    tenantId: payload.tenant_id,
    role: payload.role,
  }
}
