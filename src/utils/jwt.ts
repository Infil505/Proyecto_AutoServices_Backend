import { createHmac, timingSafeEqual } from 'crypto';

export async function createJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig    = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Record<string, unknown>;
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
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
