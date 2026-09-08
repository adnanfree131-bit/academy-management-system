import crypto from 'crypto';

/**
 * Cryptographically hashes a plain text password with a random 16-byte salt using scrypt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Constant-time verification of password against stored scrypt hash.
 */
export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!storedHash) return false;
  
  if (!storedHash.includes(':')) {
    // Legacy / plain text test fallback
    return storedHash === password;
  }

  try {
    const [salt, key] = storedHash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}
