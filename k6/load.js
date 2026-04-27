/**
 * Load test — realistic multi-scenario traffic.
 *
 * Three concurrent scenarios:
 *
 *   health_probe  — Constant 2 VUs hitting /health the whole time.
 *                   Simulates an uptime monitor; p95 must stay < 50ms.
 *
 *   company_reads — Ramp 0→20 VUs over 1 min, hold 3 min, ramp down 1 min.
 *                   Each iteration: GET stats → GET appointments (cached) →
 *                   occasionally GET customers / technicians.
 *                   Models a company dashboard with ~20 concurrent users.
 *
 *   auth_flow     — Constant arrival rate of 2 new logins/sec for 3 min.
 *                   Simulates session refresh bursts (browser reload).
 *                   Token is NOT reused between iterations.
 *
 * Run:
 *   k6 run k6/load.js \
 *     -e K6_BASE_URL=http://localhost:3000 \
 *     -e K6_COMPANY_PHONE=+521234567890 \
 *     -e K6_COMPANY_PASS=mypassword
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { BASE_URL, login, authHeaders, sharedSetup, commonThresholds } from './helpers.js';

export const options = {
  scenarios: {
    health_probe: {
      executor: 'constant-vus',
      vus: 2,
      duration: '5m',
      tags: { scenario: 'health_probe' },
      exec: 'healthProbe',
    },
    company_reads: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '3m', target: 20 },
        { duration: '1m', target: 0  },
      ],
      tags: { scenario: 'company_reads' },
      exec: 'companyReads',
    },
    auth_flow: {
      executor: 'constant-arrival-rate',
      rate: 2,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 10,
      maxVUs: 30,
      startTime: '1m',        // start after health_probe is warmed up
      tags: { scenario: 'auth_flow' },
      exec: 'authFlow',
    },
  },
  thresholds: {
    ...commonThresholds,
    'http_req_duration{scenario:auth_flow}': ['p(95)<600'],
  },
};

export function setup() {
  return sharedSetup();
}

// ── Scenario: health probe ────────────────────────────────────────────────────
export function healthProbe() {
  const res = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
  check(res, { 'health 200': (r) => r.status === 200 });
  sleep(1);
}

// ── Scenario: company dashboard reads ────────────────────────────────────────
export function companyReads(data) {
  const token = data.companyToken;
  if (!token) { sleep(2); return; }
  const hdrs = authHeaders(token);

  // Stats (should be served from 60s in-memory cache after first hit)
  {
    const res = http.get(`${BASE_URL}/api/v1/stats`, { ...hdrs, tags: { endpoint: 'stats' } });
    check(res, { 'stats 200': (r) => r.status === 200 });
  }

  // Appointments page (cached)
  {
    const page = randomIntBetween(1, 3);
    const res = http.get(
      `${BASE_URL}/api/v1/appointments?page=${page}&limit=20`,
      { ...hdrs, tags: { endpoint: 'appointments' } },
    );
    check(res, { 'appointments 200': (r) => r.status === 200 });
  }

  // ~30 % of iterations also fetch customers or technicians
  if (Math.random() < 0.3) {
    const endpoint = Math.random() < 0.5 ? 'customers' : 'technicians';
    const res = http.get(
      `${BASE_URL}/api/v1/${endpoint}?page=1&limit=20`,
      { ...hdrs, tags: { endpoint } },
    );
    check(res, { [`${endpoint} 200`]: (r) => r.status === 200 });
  }

  sleep(randomIntBetween(1, 3));
}

// ── Scenario: fresh login per iteration ──────────────────────────────────────
export function authFlow() {
  const phone = __ENV.K6_COMPANY_PHONE || '';
  const pass  = __ENV.K6_COMPANY_PASS  || '';
  if (!phone || !pass) { sleep(1); return; }

  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ phone, password: pass }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } },
  );
  check(res, {
    'login 200': (r) => r.status === 200,
    'login returns token': (r) => {
      try { return typeof JSON.parse(r.body).token === 'string'; } catch { return false; }
    },
  });
  // no sleep — constant-arrival-rate controls the pacing
}
