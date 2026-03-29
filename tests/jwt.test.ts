import { describe, expect, it } from 'bun:test';
import { createJWT, parseExpiresIn, verifyJWT } from '../src/utils/jwt';

const SECRET = 'test-secret-key';

describe('createJWT / verifyJWT', () => {
  it('round-trip: payload is recovered after verify', () => {
    const payload = { id: 1, type: 'company', phone: '+1234567890' };
    const token = createJWT({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
    const result = verifyJWT(token, SECRET);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
    expect(result!.type).toBe('company');
    expect(result!.phone).toBe('+1234567890');
  });

  it('rejects a token with wrong signature', () => {
    const token = createJWT({ id: 1, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(verifyJWT(tampered, SECRET)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = createJWT({ id: 1, exp: Math.floor(Date.now() / 1000) - 1 }, SECRET);
    expect(verifyJWT(token, SECRET)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = createJWT({ id: 1, exp: Math.floor(Date.now() / 1000) + 3600 }, 'other-secret');
    expect(verifyJWT(token, SECRET)).toBeNull();
  });

  it('rejects a malformed token (wrong number of parts)', () => {
    expect(verifyJWT('not.a.valid.jwt.token', SECRET)).toBeNull();
    expect(verifyJWT('onlyone', SECRET)).toBeNull();
  });
});

describe('parseExpiresIn', () => {
  it('parses days', () => expect(parseExpiresIn('7d')).toBe(604800));
  it('parses hours', () => expect(parseExpiresIn('24h')).toBe(86400));
  it('parses minutes', () => expect(parseExpiresIn('30m')).toBe(1800));
  it('parses raw seconds', () => expect(parseExpiresIn('3600')).toBe(3600));
  it('defaults to 86400 for invalid input', () => expect(parseExpiresIn('xyz')).toBe(86400));
});
