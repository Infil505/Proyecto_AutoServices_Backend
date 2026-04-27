/**
 * Smoke test — 1 VU, 30 s.
 *
 * Validates that every key endpoint is reachable and returns the expected
 * HTTP status code. Fails fast on the first broken contract so CI can catch
 * regressions before running heavier suites.
 *
 * Run:
 *   k6 run k6/smoke.js \
 *     -e K6_BASE_URL=http://localhost:3000 \
 *     -e K6_COMPANY_PHONE=+521234567890 \
 *     -e K6_COMPANY_PASS=mypassword
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, login, authHeaders, commonThresholds } from './helpers.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    ...commonThresholds,
    http_req_failed: ['rate<0.001'],  // zero real errors in smoke (0 < 0 is false, use 0.001)
  },
};

// login once; token is reused for the whole 30s run
let _token = null;

export function setup() {
  const phone = __ENV.K6_COMPANY_PHONE || '';
  const pass  = __ENV.K6_COMPANY_PASS  || '';
  if (!phone || !pass) {
    console.warn('K6_COMPANY_PHONE / K6_COMPANY_PASS not set — auth checks will be skipped');
    return { token: null };
  }
  const token = login(phone, pass);
  return { token };
}

export default function (data) {
  _token = data.token;

  // ── 1. Health ────────────────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
    check(res, {
      'health 200': (r) => r.status === 200,
      'health has status OK': (r) => {
        try { return JSON.parse(r.body).status === 'OK'; } catch { return false; }
      },
    });
  }

  // ── 2. Auth — protected route without token ───────────────────────────
  // 401 is intentional here; mark it as expected so http_req_failed stays 0.
  {
    const res = http.get(`${BASE_URL}/api/v1/appointments`, {
      tags: { endpoint: 'appointments' },
      responseCallback: http.expectedStatuses(401),
    });
    check(res, { 'no-token 401': (r) => r.status === 401 });
  }

  if (!_token) { sleep(1); return; }
  const hdrs = authHeaders(_token);

  // ── 3. Stats ──────────────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/v1/stats`, { ...hdrs, tags: { endpoint: 'stats' } });
    check(res, { 'stats 200': (r) => r.status === 200 });
  }

  // ── 4. Appointments list ──────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/v1/appointments?page=1&limit=20`, { ...hdrs, tags: { endpoint: 'appointments' } });
    check(res, {
      'appointments 200': (r) => r.status === 200,
      'appointments has data': (r) => {
        try { return Array.isArray(JSON.parse(r.body).data); } catch { return false; }
      },
    });
  }

  // ── 5. Customers list ─────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/v1/customers?page=1&limit=20`, { ...hdrs, tags: { endpoint: 'customers' } });
    check(res, { 'customers 200': (r) => r.status === 200 });
  }

  // ── 6. Technicians list ───────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/v1/technicians?page=1&limit=20`, { ...hdrs, tags: { endpoint: 'technicians' } });
    check(res, { 'technicians 200': (r) => r.status === 200 });
  }

  // ── 7. Coverage zones ─────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/v1/coverage-zones?page=1&limit=20`, { ...hdrs, tags: { endpoint: 'coverage-zones' } });
    check(res, { 'zones 200': (r) => r.status === 200 });
  }

  // ── 8. Services list ──────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/v1/services?page=1&limit=20`, { ...hdrs, tags: { endpoint: 'services' } });
    check(res, { 'services 200': (r) => r.status === 200 });
  }

  sleep(1);
}
