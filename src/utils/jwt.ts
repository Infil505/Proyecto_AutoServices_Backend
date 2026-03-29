import { sign, verify } from 'hono/jwt';

export async function createJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  return sign(payload, secret, 'HS256');
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    return await verify(token, secret, 'HS256') as Record<string, unknown>;
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
