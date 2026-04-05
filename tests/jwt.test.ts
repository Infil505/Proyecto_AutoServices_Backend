import { describe, expect, it } from 'bun:test';
import { createJWT, parseExpiresIn, verifyJWT } from '../src/utils/jwt';

const SECRET = 'test-secret-key';
const now = () => Math.floor(Date.now() / 1000);

// ─── Core sign / verify ────────────────────────────────────────────────────────

describe('createJWT / verifyJWT — round-trip', () => {
  it('recupera el payload completo tras verificar', async () => {
    const payload = { id: 1, type: 'company', phone: '+1234567890' };
    const token = await createJWT({ ...payload, exp: now() + 3600 }, SECRET);
    const result = await verifyJWT(token, SECRET);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
    expect(result!.type).toBe('company');
    expect(result!.phone).toBe('+1234567890');
  });

  it('preserva todos los campos del payload de producción (con companyPhone)', async () => {
    const payload = {
      id: 42,
      type: 'technician',
      phone: '+1122334455',
      companyPhone: '+1234567890',
      iat: now(),
      exp: now() + 86400,
    };
    const token = await createJWT(payload, SECRET);
    const result = await verifyJWT(token, SECRET);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(42);
    expect(result!.type).toBe('technician');
    expect(result!.phone).toBe('+1122334455');
    expect(result!.companyPhone).toBe('+1234567890');
    expect(typeof result!.iat).toBe('number');
    expect(typeof result!.exp).toBe('number');
  });

  it('el token producido es un JWT estándar (3 partes separadas por punto)', async () => {
    const token = await createJWT({ id: 1, exp: now() + 3600 }, SECRET);
    expect(token.split('.').length).toBe(3);
  });

  it('el header del token declara HS256', async () => {
    const token = await createJWT({ id: 1, exp: now() + 3600 }, SECRET);
    const header = JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString());
    expect(header.alg).toBe('HS256');
    expect(header.typ).toBe('JWT');
  });
});

// ─── Seguridad ─────────────────────────────────────────────────────────────────

describe('createJWT / verifyJWT — rechazo de tokens inválidos', () => {
  it('rechaza firma manipulada', async () => {
    const token = await createJWT({ id: 1, exp: now() + 3600 }, SECRET);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(await verifyJWT(tampered, SECRET)).toBeNull();
  });

  it('rechaza token expirado', async () => {
    const token = await createJWT({ id: 1, exp: now() - 1 }, SECRET);
    expect(await verifyJWT(token, SECRET)).toBeNull();
  });

  it('rechaza token firmado con secret distinto', async () => {
    const token = await createJWT({ id: 1, exp: now() + 3600 }, 'otro-secret');
    expect(await verifyJWT(token, SECRET)).toBeNull();
  });

  it('rechaza token malformado (partes incorrectas)', async () => {
    expect(await verifyJWT('no.valido.jwt.extra', SECRET)).toBeNull();
    expect(await verifyJWT('solouno', SECRET)).toBeNull();
  });

  it('rechaza string vacío', async () => {
    expect(await verifyJWT('', SECRET)).toBeNull();
  });

  it('dos tokens con distintos payloads no son intercambiables', async () => {
    const t1 = await createJWT({ id: 1, type: 'company',     exp: now() + 3600 }, SECRET);
    const t2 = await createJWT({ id: 2, type: 'super_admin', exp: now() + 3600 }, SECRET);
    const r1 = await verifyJWT(t1, SECRET);
    const r2 = await verifyJWT(t2, SECRET);
    expect(r1!.id).toBe(1);
    expect(r2!.id).toBe(2);
    expect(t1).not.toBe(t2);
  });
});

// ─── Extracción del Bearer token (lógica del middleware) ───────────────────────

describe('extracción del token desde Authorization header', () => {
  const extractToken = (header: string) =>
    header.startsWith('Bearer ') ? header.substring(7) : null;

  it('extrae correctamente el token del header', () => {
    const token = 'eyJhbGci.eyJpZCI6.abc123';
    expect(extractToken(`Bearer ${token}`)).toBe(token);
  });

  it('retorna null si falta el prefijo Bearer', () => {
    expect(extractToken('eyJhbGci.eyJpZCI6.abc123')).toBeNull();
  });

  it('retorna null si el prefijo es en minúsculas', () => {
    expect(extractToken('bearer eyJhbGci.eyJpZCI6.abc123')).toBeNull();
  });

  it('token extraído del header verifica correctamente', async () => {
    const payload = { id: 1, type: 'super_admin', phone: '+0000000000', exp: now() + 86400 };
    const original = await createJWT(payload, SECRET);
    const header = `Bearer ${original}`;
    const extracted = extractToken(header)!;
    const result = await verifyJWT(extracted, SECRET);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('super_admin');
  });
});

// ─── parseExpiresIn ────────────────────────────────────────────────────────────

describe('parseExpiresIn', () => {
  it('parsea días',    () => expect(parseExpiresIn('7d')).toBe(604800));
  it('parsea horas',  () => expect(parseExpiresIn('24h')).toBe(86400));
  it('parsea minutos',() => expect(parseExpiresIn('30m')).toBe(1800));
  it('parsea segundos crudos', () => expect(parseExpiresIn('3600')).toBe(3600));
  it('devuelve 86400 para input inválido', () => expect(parseExpiresIn('xyz')).toBe(86400));
});
