import { createHmac, timingSafeEqual, randomInt, createHash } from 'node:crypto'

/**
 * Minimal dependency-free HS256 JWT + OTP helpers.
 * (No JSON web library available offline; ~40 lines of stdlib crypto
 * is the honest alternative for a v1 wedge.)
 */

const SECRET = process.env.SCHOOL_ERP_JWT_SECRET ?? 'dev-only-secret-change-me'

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export function signToken(payload: Record<string, unknown>, ttlSeconds = 60 * 60 * 12): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  )
  const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts as [string, string, string]
  const expected = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload as T
  } catch {
    return null
  }
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function hashOtp(code: string, email: string): string {
  return createHash('sha256').update(`${email.toLowerCase()}:${code}:${SECRET}`).digest('hex')
}
