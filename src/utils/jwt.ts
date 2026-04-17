import { randomUUID } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

const encode = (secret: string) => new TextEncoder().encode(secret);

export async function createJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  // Always inject a unique JTI so the token can be individually revoked.
  const withJti = { jti: randomUUID(), ...payload };
  return new SignJWT(withJti)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(encode(secret));
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, encode(secret));
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseExpiresIn(val: string): number {
  if (val.endsWith('d')) return parseInt(val) * 86400;
  if (val.endsWith('h')) return parseInt(val) * 3600;
  if (val.endsWith('m')) return parseInt(val) * 60;
  return parseInt(val) || 86400;
}
