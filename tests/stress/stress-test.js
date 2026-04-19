/**
 * AutoServices — k6 Stress Test
 *
 * Simula el comportamiento real de usuarios en el sistema:
 * super_admin cargando el dashboard, company viendo sus stats,
 * técnico consultando sus citas.
 *
 * Instalación k6:
 *   Windows:  winget install k6 --source winget
 *   Linux:    sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
 *               --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69 && \
 *             echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
 *               sudo tee /etc/apt/sources.list.d/k6.list && \
 *             sudo apt-get update && sudo apt-get install k6
 *
 * Uso:
 *   k6 run tests/stress/stress-test.js                     # test completo
 *   k6 run --env SCENARIO=smoke   tests/stress/stress-test.js
 *   k6 run --env SCENARIO=load    tests/stress/stress-test.js
 *   k6 run --env SCENARIO=stress  tests/stress/stress-test.js
 *   k6 run --env SCENARIO=spike   tests/stress/stress-test.js
 *
 * Variables de entorno opcionales:
 *   BASE_URL          URL del backend  (default: http://localhost:3008)
 *   ADMIN_PHONE       Teléfono super_admin
 *   ADMIN_PASSWORD    Contraseña super_admin
 *   COMPANY_PHONE     Teléfono company
 *   COMPANY_PASSWORD  Contraseña company
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// ── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3008'

const CREDENTIALS = {
  admin:      { phone: __ENV.ADMIN_PHONE      || '+0000000000', password: __ENV.ADMIN_PASSWORD      || 'password123' },
  company:    { phone: __ENV.COMPANY_PHONE    || '+1234567890', password: __ENV.COMPANY_PASSWORD    || 'password123' },
  technician: { phone: __ENV.TECH_PHONE       || '+1122334455', password: __ENV.TECH_PASSWORD       || 'password123' },
}

// ── Métricas personalizadas ───────────────────────────────────────────────────

const errorRate      = new Rate('error_rate')
const loginDuration  = new Trend('login_duration',   true)
const statsDuration  = new Trend('stats_duration',   true)
const dashboardLoad  = new Trend('dashboard_load',   true)  // carga completa del dashboard
const cacheHitRate   = new Rate('cache_hit_rate')           // respuestas < 50ms = probablemente cache
const dbErrors       = new Counter('db_errors')

// ── Escenarios ────────────────────────────────────────────────────────────────

const SCENARIOS = {
  // 1. Smoke — 1 usuario, 1 minuto. Verifica que todo funciona.
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
  },

  // 2. Load — rampa gradual hasta 50 usuarios (lo que entraría en producción real).
  //    Objetivo: todos los requests < 2s, error rate < 1%.
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m',  target: 10  }, // calentamiento
      { duration: '3m',  target: 50  }, // carga normal
      { duration: '1m',  target: 0   }, // enfriamiento
    ],
  },

  // 3. Stress — empuja hasta el límite. Encuentra el punto de quiebre.
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m',  target: 50  },
      { duration: '2m',  target: 100 },
      { duration: '2m',  target: 150 },
      { duration: '2m',  target: 200 },
      { duration: '1m',  target: 0   },
    ],
  },

  // 4. Spike — golpe repentino de usuarios (e.g., campaña de marketing).
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 5   }, // base
      { duration: '10s', target: 100 }, // spike súbito
      { duration: '2m',  target: 100 }, // mantiene presión
      { duration: '10s', target: 5   }, // baja rápido
      { duration: '30s', target: 0   },
    ],
  },
}

const scenarioName = __ENV.SCENARIO || 'load'

export const options = {
  scenarios: {
    [scenarioName]: SCENARIOS[scenarioName] || SCENARIOS.load,
  },
  thresholds: {
    // SLOs: el 95% de los requests deben completarse en < 2s
    http_req_duration:    ['p(95)<2000', 'p(99)<4000'],
    // Menos del 1% de errores
    error_rate:           ['rate<0.01'],
    // Login usa bcrypt-12 (~200-400ms CPU) + latencia Supabase; ocurre 1 vez por sesión
    login_duration:       ['p(95)<5000'],
    // Stats con cache deben ser muy rápidos
    stats_duration:       ['p(95)<1000'],
    // Dashboard completo < 3s
    dashboard_load:       ['p(95)<3000'],
  },
}

// ── Login y cache de tokens ───────────────────────────────────────────────────

// En producción cada VU es un usuario diferente. Aquí rotamos entre los
// usuarios configurados para no crear sesiones duplicadas innecesarias.
let _adminToken    = null
let _companyToken  = null

function login(phone, password) {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ phone, password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
  )
  loginDuration.add(res.timings.duration)

  const ok = check(res, {
    'login 200':    (r) => r.status === 200,
    'tiene token':  (r) => {
      try { return !!JSON.parse(r.body).token } catch { return false }
    },
  })

  errorRate.add(!ok)
  if (!ok) return null

  try { return JSON.parse(res.body).token } catch { return null }
}

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function checkAndRecord(res, checks, metricTrend) {
  if (metricTrend) metricTrend.add(res.timings.duration)
  cacheHitRate.add(res.timings.duration < 50)   // respuesta < 50ms = cache hit

  const ok = check(res, checks)
  errorRate.add(!ok)

  if (res.status === 500) dbErrors.add(1)
  return ok
}

// ── Escenario: super_admin ────────────────────────────────────────────────────

function runAdminScenario(token) {
  const h = authHeaders(token)
  const start = Date.now()

  group('admin — dashboard load', () => {
    // El frontend carga estos 5 endpoints en paralelo al abrir el dashboard
    const responses = http.batch([
      ['GET', `${BASE_URL}/api/v1/stats`,          null, { ...h, tags: { name: 'stats' } }],
      ['GET', `${BASE_URL}/api/v1/admin/metrics`,  null, { ...h, tags: { name: 'metrics' } }],
      ['GET', `${BASE_URL}/api/v1/admin/growth`,   null, { ...h, tags: { name: 'growth' } }],
      ['GET', `${BASE_URL}/api/v1/admin/activity`, null, { ...h, tags: { name: 'activity' } }],
      ['GET', `${BASE_URL}/api/v1/companies?page=1&limit=10`, null, { ...h, tags: { name: 'companies' } }],
    ])

    statsDuration.add(responses[0].timings.duration)

    checkAndRecord(responses[0], { 'stats 200':    (r) => r.status === 200 }, null)
    checkAndRecord(responses[1], { 'metrics 200':  (r) => r.status === 200 }, null)
    checkAndRecord(responses[2], { 'growth 200':   (r) => r.status === 200 }, null)
    checkAndRecord(responses[3], { 'activity 200': (r) => r.status === 200 }, null)
    checkAndRecord(responses[4], { 'companies 200':(r) => r.status === 200 }, null)
  })

  dashboardLoad.add(Date.now() - start)

  sleep(Math.random() * 3 + 1) // 1-4s — tiempo que el usuario pasa viendo el dashboard
}

// ── Escenario: company ────────────────────────────────────────────────────────

function runCompanyScenario(token) {
  const h = authHeaders(token)
  const start = Date.now()

  group('company — dashboard load', () => {
    const responses = http.batch([
      ['GET', `${BASE_URL}/api/v1/stats`,                      null, { ...h, tags: { name: 'stats' } }],
      ['GET', `${BASE_URL}/api/v1/appointments?page=1&limit=5`,null, { ...h, tags: { name: 'appointments' } }],
      ['GET', `${BASE_URL}/api/v1/technicians?page=1&limit=10`,null, { ...h, tags: { name: 'technicians' } }],
    ])

    statsDuration.add(responses[0].timings.duration)

    checkAndRecord(responses[0], { 'stats 200':       (r) => r.status === 200 }, null)
    checkAndRecord(responses[1], { 'appointments 200':(r) => r.status === 200 }, null)
    checkAndRecord(responses[2], { 'technicians 200': (r) => r.status === 200 }, null)
  })

  dashboardLoad.add(Date.now() - start)

  group('company — lista de citas', () => {
    sleep(Math.random() * 2 + 1)
    const res = http.get(
      `${BASE_URL}/api/v1/appointments?page=1&limit=20`,
      { ...authHeaders(token), tags: { name: 'appointments-list' } },
    )
    checkAndRecord(res, { 'appointments-list 200': (r) => r.status === 200 }, null)
  })

  sleep(Math.random() * 2 + 1)
}

// ── Función principal (VU) ────────────────────────────────────────────────────

function runTechnicianScenario(token) {
  const h = authHeaders(token)
  const start = Date.now()

  group('technician — dashboard load', () => {
    const responses = http.batch([
      ['GET', `${BASE_URL}/api/v1/stats`,                       null, { ...h, tags: { name: 'stats' } }],
      ['GET', `${BASE_URL}/api/v1/appointments?page=1&limit=20`,null, { ...h, tags: { name: 'appointments' } }],
    ])
    statsDuration.add(responses[0].timings.duration)
    checkAndRecord(responses[0], { 'stats 200':       (r) => r.status === 200 }, null)
    checkAndRecord(responses[1], { 'appointments 200':(r) => r.status === 200 }, null)
  })

  dashboardLoad.add(Date.now() - start)
  sleep(Math.random() * 3 + 1)
}

// Los tokens se obtienen UNA VEZ en setup() y se pasan a cada VU.
// Esto simula correctamente el uso real: el usuario inicia sesión una vez
// y reutiliza el token durante toda su sesión (horas).
export default function (data) {
  const roll = Math.random()

  if (roll < 0.25) {
    runAdminScenario(data.adminToken)
  } else if (roll < 0.85) {
    runCompanyScenario(data.companyToken)
  } else {
    runTechnicianScenario(data.techToken)
  }
}

// ── Setup: login único — los tokens se reutilizan en todos los VUs ────────────
//
// En producción los tokens duran 7 días. Aquí hacemos login UNA vez antes de
// que empiece la carga y pasamos los tokens a cada iteración.
// Esto evita martillar el endpoint de login (que tiene rate-limit estricto
// por diseño anti-brute-force) y refleja el uso real.

export function setup() {
  const res = http.get(`${BASE_URL}/health`)
  if (res.status !== 200) {
    throw new Error(`El backend no responde en ${BASE_URL} — status ${res.status}`)
  }
  console.log(`✓ Backend en línea: ${BASE_URL}`)

  const adminToken = login(CREDENTIALS.admin.phone, CREDENTIALS.admin.password)
  if (!adminToken) throw new Error('Login super_admin falló — verifica ADMIN_PHONE y ADMIN_PASSWORD')

  const companyToken = login(CREDENTIALS.company.phone, CREDENTIALS.company.password)
  if (!companyToken) throw new Error('Login company falló — verifica COMPANY_PHONE y COMPANY_PASSWORD')

  const techToken = login(CREDENTIALS.technician.phone, CREDENTIALS.technician.password)
  if (!techToken) throw new Error('Login técnico falló — verifica TECH_PHONE y TECH_PASSWORD')

  console.log(`✓ Tokens obtenidos — admin: ${adminToken.slice(0,20)}...`)
  return { adminToken, companyToken, techToken }
}
