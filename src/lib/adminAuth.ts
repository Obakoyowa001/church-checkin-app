/**
 * Simple admin session helper. No user accounts, no database — just
 * one shared password (ADMIN_PASSWORD). On successful login we set a
 * cookie whose value is an HMAC of the password, keyed by
 * ADMIN_SESSION_SECRET. Middleware recomputes that same HMAC on every
 * request and compares it to the cookie, so rotating either env var
 * instantly invalidates every existing session.
 *
 * Deliberately dependency-free (Web Crypto only) so this file works
 * unmodified in both the Node runtime (API routes) and the Edge
 * runtime (middleware).
 */

export const ADMIN_SESSION_COOKIE = 'church_admin_session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return bufferToHex(signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyAdminPassword(candidate: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !candidate) return false;
  return timingSafeEqual(candidate, expected);
}

export async function computeAdminSessionToken(): Promise<string | null> {
  const password = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !sessionSecret) return null;
  return hmacSha256Hex(sessionSecret, `admin-session:${password}`);
}

export async function isValidAdminSessionCookie(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await computeAdminSessionToken();
  if (!expected) return false;
  return timingSafeEqual(cookieValue, expected);
}
