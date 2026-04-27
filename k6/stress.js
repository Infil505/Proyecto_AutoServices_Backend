/**
 * Stress test — find the system's breaking point.
 *
 * Ramps VUs aggressively through four stages, then holds at peak before
 * ramping back down. The test intentionally pushes past sustainable load
 * to observe how the server degrades:
 *
 *   Stage 1 (2 min)  →  30 VUs   — moderate load, cache warming
 *   Stage 2 (2 min)  →  60 VUs   — approaching pool saturation (~67 req/s)
 *   Stage 3 (2 min)  → 100 VUs   — overload zone; expect 503s from MAX_IN_FLIGHT
 *   Stage 4 (1 min)  → 150 VUs   — spike; measures queue rejection rate
 *   Stage 5 (2 min)  →   0 VUs   — recovery check
 *
 * Expected outcomes (dev environment, MAX_IN_FLIGHT=200):
 *   - Stages 1-2: error rate near 0%, p95 < 500ms
 *   - Stage 3+:   error rate rises, 503s appear — this is BY DESIGN
 *   - Stage 5:    error rate drops back to 0% within the ramp-down window
 *
 * Thresholds are intentionally relaxed (p99 < 5s, errors < 10%) so the test
 * completes and produces a full profile rather than aborting early.
 *
 * Run:
 *   k6 run k6/stress.js \
 *     -e K6_BASE_URL=http://localhost:3000 \
 *     -e K6_COMPANY_PHONE=+521234567890 \
 *     -e K6_COMPANY_PASS=mypassword
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { BASE_URL, sharedSetup, authHeaders } from './helpers.js';

// Custom metrics to track overload behavior
const overloadErrors   = new Counter('overload_503');
const appointmentTrend = new Trend('appointment_duration', true);
const statsTrend       = new Trend('stats_duration', true);
const errorRate        = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '2m', target: 30  },
    { duration: '2m', target: 60  },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 150 },
    { duration: '2m', target: 0   },
  ],
  // Relaxed thresholds — stress tests are allowed to saturate the server.
  // The goal is profiling, not pass/fail.
  thresholds: {
    http_req_failed:  ['rate<0.10'],       // < 10% total errors
    http_req_duration:['p(99)<5000'],      // p99 under 5s
    error_rate:       ['rate<0.10'],
    overload_503:     ['count<500'],       // arbitrary cap on logged 503s
  },
};

export function setup() {
  return sharedSetup();
}

export default function (data) {
  const token = data.companyToken;
  if (!token) { sleep(1); return; }
  const hdrs = authHeaders(token);

  // Stats — should be cached; a spike here reveals cache contention
  {
    const res = http.get(
      `${BASE_URL}/api/v1/stats`,
      { ...hdrs, tags: { endpoint: 'stats' } },
    );
    const ok = check(res, { 'stats 2xx': (r) => r.status >= 200 && r.status < 300 });
    errorRate.add(!ok);
    if (res.status === 503) overloadErrors.add(1);
    statsTrend.add(res.timings.duration);
  }

  // Appointments — paginated read, hits cache after first miss per page
  {
    const page = randomIntBetween(1, 5);
    const res = http.get(
      `${BASE_URL}/api/v1/appointments?page=${page}&limit=20`,
      { ...hdrs, tags: { endpoint: 'appointments' } },
    );
    const ok = check(res, { 'appts 2xx': (r) => r.status >= 200 && r.status < 300 });
    errorRate.add(!ok);
    if (res.status === 503) overloadErrors.add(1);
    appointmentTrend.add(res.timings.duration);
  }

  // ~20 % of iterations hit a less-cached endpoint to simulate mixed traffic
  if (Math.random() < 0.2) {
    const ep = ['customers', 'technicians', 'services'][randomIntBetween(0, 2)];
    const res = http.get(
      `${BASE_URL}/api/v1/${ep}?page=1&limit=20`,
      { ...hdrs, tags: { endpoint: ep } },
    );
    const ok = check(res, { [`${ep} 2xx`]: (r) => r.status >= 200 && r.status < 300 });
    errorRate.add(!ok);
    if (res.status === 503) overloadErrors.add(1);
  }

  sleep(randomIntBetween(0, 1));
}
