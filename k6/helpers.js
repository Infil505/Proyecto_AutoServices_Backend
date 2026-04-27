import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';

const COMPANY_PHONE = __ENV.K6_COMPANY_PHONE || '';
const COMPANY_PASS  = __ENV.K6_COMPANY_PASS  || '';
const TECH_PHONE    = __ENV.K6_TECH_PHONE    || '';
const TECH_PASS     = __ENV.K6_TECH_PASS     || '';

/** Login and return the access token, or null on failure. */
export function login(phone, password) {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ phone, password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } },
  );
  const ok = check(res, { 'login 200': (r) => r.status === 200 });
  if (!ok) return null;
  try {
    return JSON.parse(res.body).token;
  } catch {
    return null;
  }
}

/** Return headers object for an authenticated request. */
export function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

/**
 * Run setup() once before the test: log in with company and technician
 * credentials and return both tokens so VUs can reuse them.
 */
export function sharedSetup() {
  const companyToken    = COMPANY_PHONE ? login(COMPANY_PHONE, COMPANY_PASS) : null;
  const technicianToken = TECH_PHONE    ? login(TECH_PHONE,    TECH_PASS)    : null;
  if (!companyToken && !technicianToken) {
    console.warn(
      'No credentials provided. Set K6_COMPANY_PHONE/K6_COMPANY_PASS (and optionally K6_TECH_PHONE/K6_TECH_PASS).',
    );
  }
  return { companyToken, technicianToken };
}

/** Standard thresholds used across all test files. */
export const commonThresholds = {
  http_req_failed:                                 ['rate<0.01'],
  http_req_duration:                               ['p(95)<1000', 'p(99)<2000'],
  'http_req_duration{endpoint:health}':            ['p(95)<50'],
  'http_req_duration{endpoint:stats}':             ['p(95)<300'],
  'http_req_duration{endpoint:appointments}':      ['p(95)<800'],
  'http_req_duration{endpoint:customers}':         ['p(95)<800'],
  'http_req_duration{endpoint:technicians}':       ['p(95)<800'],
};
