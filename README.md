# AutoServices Backend API

REST API para la plataforma de gestión de servicios técnicos en campo. Construida con **Bun + Hono + PostgreSQL (Supabase) + Drizzle ORM**.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | Bun v1.x |
| Framework HTTP | Hono v4 |
| Base de datos | PostgreSQL via Supabase |
| ORM | Drizzle ORM |
| Autenticación | JWT (jose, HS256) |
| Validación | Zod |
| WebSocket | ws |
| Push Notifications | web-push (VAPID) |
| Email | Resend |
| PDF | PDFKit |
| Logs | Winston |
| Rate limiting | In-memory / Redis |

---

## Inicio rápido

```bash
# 1. Instalar dependencias
bun install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Correr migraciones
bun run db:migrate

# 4. (Opcional) Cargar datos de prueba
bun run db:seed

# 5. Iniciar servidor de desarrollo
bun run dev
```

El servidor queda disponible en `http://localhost:3008`.
La documentación Swagger en `http://localhost:3008/api/v1/docs`.

---

## Variables de entorno

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Connection string de PostgreSQL |
| `JWT_SECRET` | ✅ | — | Secreto para firmar tokens JWT (mín. 64 chars) |
| `PORT` | | `3000` | Puerto HTTP del servidor |
| `WS_PORT` | | `3001` | Puerto del servidor WebSocket |
| `NODE_ENV` | | `development` | Entorno (`development` / `production`) |
| `JWT_EXPIRES_IN` | Prod | `7d` | Expiración del access token |
| `JWT_REFRESH_EXPIRES_IN` | Prod | `30d` | Expiración del refresh token |
| `CORS_ORIGINS` | | `http://localhost:3000,http://localhost:5173` | Orígenes permitidos (separados por coma) |
| `RATE_LIMIT_MAX` | | `100` | Máximo de requests por ventana de tiempo |
| `RATE_LIMIT_WINDOW_MS` | | `900000` | Ventana de rate limit en ms (15 min) |
| `TRUST_PROXY` | | `true` | Confiar en headers de proxy (Cloudflare/Nginx) |
| `REDIS_URL` | | — | URL de Redis (habilita rate limiting distribuido) |
| `RESEND_API_KEY` | | — | API key de Resend para envío de emails |
| `RESEND_FROM_EMAIL` | | `noreply@autoservices.com` | Dirección remitente de emails |
| `METRICS_API_KEY` | Prod | — | Protege el endpoint `GET /metrics` |
| `SHUTDOWN_USER` | | `admin_shutdown` | Usuario para el endpoint de apagado de emergencia |
| `SHUTDOWN_PASSWORD` | Prod | — | Contraseña para el endpoint de apagado |
| `VAPID_PUBLIC_KEY` | | — | Llave pública VAPID para push notifications |
| `VAPID_PRIVATE_KEY` | | — | Llave privada VAPID para push notifications |
| `VAPID_EMAIL` | | `mailto:noreply@autoservices.com` | Email VAPID para push notifications |

### Generar VAPID keys (push notifications)

```bash
bunx web-push generate-vapid-keys
```

Copiar `Public Key` a `VAPID_PUBLIC_KEY` en el backend **y** a `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en el frontend.

---

## Arquitectura

```
index.ts                      ← Entry point: app Hono, middleware chain, WS server
  │
  ├── Middleware (en orden de ejecución)
  │     ├── CORS
  │     ├── Rate limiter  (100 req / 15 min por IP)
  │     ├── Auth rate limiter  (20 req / 15 min — solo /auth/*)
  │     ├── JWT verification + blacklist check  (rutas protegidas)
  │     └── Request logging + métricas
  │
  ├── src/routes/             ← Thin re-exports de controllers
  ├── src/controllers/        ← Handlers HTTP (Hono routers), uno por entidad
  ├── src/services/           ← Lógica de negocio, EventEmitter pub/sub
  ├── src/db/
  │     ├── schema.ts         ← 12 tablas Drizzle con índices
  │     └── index.ts          ← Conexión postgres.js (pool max 10)
  ├── src/ws/
  │     └── appointmentWebsocket.ts  ← WS server (WS_PORT)
  ├── src/services/
  │     ├── pushService.ts    ← Web Push (VAPID), suscripciones en memoria
  │     └── emailService.ts   ← Envío de PDF al completar cita
  ├── src/middleware/
  │     ├── validation.ts     ← Rate limiter
  │     └── metrics.ts        ← Contadores de requests y tiempos de respuesta
  └── src/utils/
        ├── cache.ts          ← Caché TTL en memoria (stats/admin)
        ├── jwt.ts            ← Sign / verify JWT
        ├── tokenBlacklist.ts ← Revocación de tokens en DB
        └── loginLimiter.ts   ← Bloqueo por 5 intentos fallidos
```

### Flujo de una request protegida

```
Request → CORS → Rate limit → JWT verify → Blacklist check → Controller → Service → DB
```

---

## Base de datos

### Tablas y columnas

#### `companies`
| Columna | Tipo | Descripción |
|---|---|---|
| `phone` | text PK | Teléfono (identificador único) |
| `name` | text NOT NULL | Nombre de la empresa |
| `email` | text | Email de contacto |
| `address` | text | Dirección |
| `startHour` | time | Hora de apertura |
| `endHours` | time | Hora de cierre |
| `created_at` | timestamp TZ | Fecha de registro |

#### `technicians`
| Columna | Tipo | Descripción |
|---|---|---|
| `phone` | text PK | Teléfono |
| `company_phone` | text FK→companies | Empresa a la que pertenece |
| `name` | text NOT NULL | Nombre completo |
| `email` | text | Email |
| `available` | boolean | Disponibilidad actual (default: true) |
| `created_at` | timestamp TZ | — |

#### `customers`
| Columna | Tipo | Descripción |
|---|---|---|
| `phone` | text PK | Teléfono |
| `name` | text | Nombre |
| `email` | text | Email |
| `state` | text | Estado/Provincia |
| `city` | text | Ciudad |
| `address` | text | Dirección |
| `content` | text | Notas adicionales |
| `created_at` | timestamp TZ | — |

#### `services`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigserial PK | — |
| `company_phone` | text FK→companies | Empresa dueña del servicio |
| `name` | text NOT NULL | Nombre del servicio |
| `description` | text | Descripción |
| `category` | text | Categoría (HVAC, Plomería, etc.) |
| `estimated_duration_minutes` | integer NOT NULL | Duración estimada |
| `active` | boolean | Activo/inactivo (default: true) |
| `created_at` | timestamp TZ | — |

#### `appointments`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigserial PK | — |
| `company_phone` | text FK→companies NOT NULL | Empresa |
| `customer_phone` | text FK→customers | Cliente |
| `technician_phone` | text FK→technicians | Técnico asignado |
| `service_id` | bigint FK→services | Servicio |
| `appointmentDate` | date | Fecha de la cita |
| `start_time` | time | Hora de inicio |
| `status` | text | `pending` \| `scheduled` \| `confirmed` \| `in_progress` \| `completed` \| `cancelled` |
| `estatus_tecnico` | boolean | El técnico marcó la cita como completada |
| `estatus_administrador` | boolean | El admin aprobó la cita |
| `content` | text | Notas de la cita |
| `coordinates` | jsonb | `{ lat, lng }` ubicación |
| `created_at` | timestamp TZ | — |

> Cuando `estatus_tecnico = true` **y** `estatus_administrador = true`, el `status` pasa automáticamente a `completed` (en una sola query SQL con `CASE`) y se envía un PDF al cliente por email.

#### `coverage_zones`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigserial PK | — |
| `company_phone` | text FK→companies NOT NULL | Empresa |
| `state` | text NOT NULL | Estado |
| `city` | text NOT NULL | Ciudad |
| `zone_name` | text | Nombre de zona |
| `postal_code` | text | Código postal |
| `coordinates` | jsonb | GeoJSON de la zona |
| `notes` | text | Notas |

#### Tablas de catálogo y relación

| Tabla | Llave primaria | Descripción |
|---|---|---|
| `specialties` | `id` (bigserial) | Catálogo de especialidades técnicas |
| `service_specialties` | `(service_id, specialty_id)` | Especialidades requeridas por servicio |
| `technician_specialties` | `(technician_phone, specialty_id)` | Especialidades que tiene un técnico |
| `technician_coverage_zones` | `(technician_phone, coverage_zone_id)` | Zonas que cubre un técnico |

#### Tablas de autenticación

| Tabla | Descripción |
|---|---|
| `users` | Credenciales. `type`: `super_admin` \| `company` \| `technician`. `passwordHash` nunca es devuelto por la API. |
| `sessions` | JTIs de tokens activos/revocados. `revokedAt != null` = token en blacklist. Persiste entre reinicios. |

---

### Índices

| Índice | Tabla | Columna | Propósito |
|---|---|---|---|
| `idx_appointments_company_phone` | appointments | company_phone | Listado y conteo por empresa |
| `idx_appointments_technician_phone` | appointments | technician_phone | Queries del técnico |
| `idx_appointments_status` | appointments | status | Filtros por estado |
| `idx_appointments_created_at` | appointments | created_at | Gráfico de crecimiento |
| `idx_companies_created_at` | companies | created_at | Gráfico de crecimiento |
| `idx_technicians_company_phone` | technicians | company_phone | Conteo de técnicos por empresa |
| `idx_technicians_available` | technicians | available | Conteo de técnicos disponibles |
| `idx_services_company_phone` | services | company_phone | Servicios por empresa |
| `idx_services_active` | services | active | Conteo de servicios activos |
| `idx_coverage_zones_company_phone` | coverage_zones | company_phone | Zonas por empresa |

#### Aplicar índices manualmente en Supabase

Si `bun run db:migrate` falla por el connection pooler, ejecutar en el **SQL Editor del Dashboard de Supabase**:

```sql
CREATE INDEX IF NOT EXISTS "idx_appointments_company_phone"    ON "appointments"   USING btree ("company_phone");
CREATE INDEX IF NOT EXISTS "idx_appointments_technician_phone" ON "appointments"   USING btree ("technician_phone");
CREATE INDEX IF NOT EXISTS "idx_appointments_status"           ON "appointments"   USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_appointments_created_at"       ON "appointments"   USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "idx_companies_created_at"          ON "companies"      USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "idx_coverage_zones_company_phone"  ON "coverage_zones" USING btree ("company_phone");
CREATE INDEX IF NOT EXISTS "idx_services_company_phone"        ON "services"       USING btree ("company_phone");
CREATE INDEX IF NOT EXISTS "idx_services_active"               ON "services"       USING btree ("active");
CREATE INDEX IF NOT EXISTS "idx_technicians_company_phone"     ON "technicians"    USING btree ("company_phone");
CREATE INDEX IF NOT EXISTS "idx_technicians_available"         ON "technicians"    USING btree ("available");
```

---

## Autenticación y autorización

### Roles

| Rol | Descripción | Alcance |
|---|---|---|
| `super_admin` | Administrador de plataforma | Acceso total |
| `company` | Administrador de empresa | Solo su empresa, sus técnicos, servicios y citas |
| `technician` | Técnico de campo | Solo sus citas asignadas y su perfil |

### JWT

- **Access token:** expira en `JWT_EXPIRES_IN` (default `7d`)
- **Refresh token:** expira en `JWT_REFRESH_EXPIRES_IN` (default `30d`)
- **Payload:** `{ id, type, phone, companyPhone?, jti, tokenType, iat, exp }`
- La revocación persiste en la tabla `sessions` — sobrevive reinicios del servidor

### Flujo de autenticación

```
1. POST /api/v1/auth/login
   → Verifica credenciales bcrypt (12 rounds)
   → Bloquea 15 min tras 5 intentos fallidos por teléfono
   → Devuelve { user, token, refreshToken }

2. POST /api/v1/auth/refresh
   → Recibe { refreshToken }
   → Verifica firma y que no esté revocado
   → Devuelve nuevo { token }

3. POST /api/v1/auth/logout  (requiere JWT)
   → Revoca access token (lo agrega a blacklist en DB)
   → Revoca refresh token si se envía en el body
```

### Rutas públicas (sin JWT)

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/register/company`
- `GET  /api/v1/public/stats`
- `GET  /health`
- `GET  /api/v1/docs`

---

## Referencia de API

Base URL: `http://localhost:3008/api/v1`

---

### Autenticación

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/register/company` | No | Registrar nueva empresa + usuario admin |
| POST | `/auth/login` | No | Login |
| POST | `/auth/refresh` | No | Obtener nuevo access token |
| POST | `/auth/logout` | Sí | Revocar tokens |
| POST | `/auth/register/admin` | super_admin | Crear nuevo super_admin |

#### POST /auth/register/company
```json
{
  "phone": "+523312345678",
  "name": "Mi Empresa SA",
  "password": "secret123",
  "email": "empresa@mail.com",
  "address": "Av. Principal 123",
  "startHour": "08:00",
  "endHour": "18:00"
}
```

#### POST /auth/login
```json
{ "phone": "+523312345678", "password": "secret123" }
```
Respuesta: `{ "user": { id, type, phone, name, email }, "token": "...", "refreshToken": "..." }`

---

### Citas

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/appointments` | Todos | Listar citas (filtradas por rol automáticamente) |
| GET | `/appointments/:id` | Todos | Detalle de cita con cliente, técnico y servicio |
| POST | `/appointments` | company, super_admin | Crear cita |
| PUT | `/appointments/:id` | company, super_admin | Actualizar cita |
| DELETE | `/appointments/:id` | company, super_admin | Eliminar cita |
| PATCH | `/appointments/:id/status/tecnico` | technician | Marcar cita completada (técnico) |
| PATCH | `/appointments/:id/status/administrador` | company, super_admin | Aprobar cita (admin) |
| GET | `/appointments/:id/pdf` | Todos | Descargar PDF de resumen de cita |

**Query params de paginación:** `page` (default 1), `limit` (default 10, máx 100)

#### POST /appointments
```json
{
  "companyPhone": "+523312345678",
  "customerPhone": "+521234567890",
  "technicianPhone": "+529876543210",
  "serviceId": 1,
  "appointmentDate": "2025-06-15",
  "startTime": "10:00",
  "status": "pending",
  "content": "Revisión de AC unidad central"
}
```

#### PATCH /appointments/:id/status/tecnico
```json
{ "estatusTecnico": true }
```

#### PATCH /appointments/:id/status/administrador
```json
{ "estatusAdministrador": true }
```

> Cuando ambos flags son `true`, el sistema realiza en una sola query SQL:
> 1. Actualiza `status` → `completed`
> 2. Emite evento `appointment:both_completed`
> 3. El `EmailService` genera el PDF y lo envía al cliente (Resend)

---

### Técnicos

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/technicians` | Todos | Listar técnicos |
| GET | `/technicians/:phone` | Todos | Detalle de técnico |
| POST | `/technicians` | company, super_admin | Crear técnico (también crea usuario en `users`) |
| PUT | `/technicians/:phone` | company, super_admin | Actualizar técnico (incluye `available`) |
| DELETE | `/technicians/:phone` | company, super_admin | Eliminar técnico |
| GET | `/technicians/:phone/availability` | Todos | Disponibilidad con slots horarios |

#### POST /technicians
```json
{
  "phone": "+521234567890",
  "name": "Juan Pérez",
  "email": "juan@empresa.com",
  "password": "secret123",
  "available": true
}
```

#### PUT /technicians/:phone — cambiar disponibilidad
```json
{ "available": false }
```

---

### Servicios

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/services` | Listar servicios |
| GET | `/services/:id` | Detalle |
| POST | `/services` | Crear servicio |
| PUT | `/services/:id` | Actualizar |
| DELETE | `/services/:id` | Eliminar |

#### POST /services
```json
{
  "companyPhone": "+523312345678",
  "name": "Instalación de Minisplit",
  "description": "Instalación completa de sistema de aire acondicionado",
  "category": "HVAC",
  "estimatedDurationMinutes": 180
}
```

---

### Clientes

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/customers` | company, super_admin | Listar clientes |
| GET | `/customers/:phone` | company, super_admin | Detalle |
| POST | `/customers` | company, super_admin | Crear cliente |
| PUT | `/customers/:phone` | company, super_admin | Actualizar |
| DELETE | `/customers/:phone` | company, super_admin | Eliminar |

---

### Empresas

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/companies` | super_admin | Listar todas las empresas |
| GET | `/companies/:phone` | company, super_admin | Detalle |
| POST | `/companies` | super_admin | Crear empresa |
| PUT | `/companies/:phone` | company, super_admin | Actualizar |
| DELETE | `/companies/:phone` | super_admin | Eliminar |
| POST | `/companies/:phone/admin` | super_admin | Crear usuario admin adicional para la empresa |

---

### Zonas de cobertura

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/coverage-zones` | Listar zonas |
| GET | `/coverage-zones/:id` | Detalle |
| POST | `/coverage-zones` | Crear zona |
| PUT | `/coverage-zones/:id` | Actualizar |
| DELETE | `/coverage-zones/:id` | Eliminar |

#### POST /coverage-zones
```json
{
  "companyPhone": "+523312345678",
  "state": "Jalisco",
  "city": "Guadalajara",
  "zoneName": "Zona Centro",
  "postalCode": "44100",
  "notes": "Incluye colonias del centro histórico"
}
```

---

### Especialidades

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/specialties` | Listar especialidades |
| GET | `/specialties/:id` | Detalle |
| POST | `/specialties` | Crear especialidad |
| PUT | `/specialties/:id` | Actualizar |
| DELETE | `/specialties/:id` | Eliminar |

---

### Relaciones (junction tables)

| Método | Ruta | Descripción |
|---|---|---|
| GET / POST / DELETE | `/service-specialties` | Especialidades por servicio |
| GET / POST / DELETE | `/technician-specialties` | Especialidades por técnico |
| GET / POST / DELETE | `/technician-coverage-zones` | Zonas de cobertura por técnico |

---

### Estadísticas

| Método | Ruta | Auth | Caché | Descripción |
|---|---|---|---|---|
| GET | `/stats` | Sí | 15s | Conteos según rol del usuario |
| GET | `/public/stats` | No | No | Totales globales de la plataforma |

#### GET /stats — respuesta por rol

**super_admin:**
```json
{ "companies": 10, "appointments": 240, "technicians": 45, "customers": 180, "services": 32 }
```

**company:**
```json
{
  "appointments": 24,
  "completedAppointments": 18,
  "technicians": 5,
  "activeTechnicians": 3,
  "services": 8,
  "activeServices": 7,
  "zones": 4
}
```

**technician:**
```json
{ "appointments": 12 }
```

---

### Admin (solo super_admin)

| Método | Ruta | Caché | Descripción |
|---|---|---|---|
| GET | `/admin/metrics` | No | Salud del sistema: uptime, memoria, latencia DB, requests |
| GET | `/admin/growth` | 60s | Crecimiento mensual de empresas y citas (últimos 6 meses) |
| GET | `/admin/activity` | 30s | Últimas 10 actividades de la plataforma |

---

### Push Notifications

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/push-subscriptions` | Registrar suscripción push del browser |
| DELETE | `/push-subscriptions` | Eliminar suscripción push |

#### POST /push-subscriptions
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BNcR...",
    "auth": "tBHI..."
  }
}
```

---

### Usuarios (solo super_admin)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/users` | Listar usuarios |
| GET | `/users/:id` | Detalle |
| POST | `/users` | Crear usuario |
| PUT | `/users/:id` | Actualizar |
| DELETE | `/users/:id` | Eliminar |

---

### Sistema

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | No | `{ status: "OK", timestamp }` |
| GET | `/metrics` | API Key header | Métricas de performance |
| POST | `/health/shutdown` | Credenciales propias | Apagado de emergencia (rate limited: 5 intentos / 15 min por IP) |

---

## WebSocket

**Endpoint:** `ws://localhost:3001`

### Protocolo de conexión

```
1. Cliente conecta al WS
2. Servidor envía:    { "type": "auth_required" }
3. Cliente responde:  { "type": "auth", "token": "<access_jwt>" }
4. Servidor confirma: { "type": "ws_connected", "message": "...", "timestamp": "..." }
```

Si no se autentica en **5 segundos**, la conexión se cierra automáticamente.

### Eventos emitidos al cliente

| Evento | Descripción |
|---|---|
| `appointment:created` | Se creó una nueva cita |
| `appointment:updated` | Se actualizó una cita |
| `appointment:deleted` | Se eliminó una cita |
| `appointment:assigned` | Se asignó o reasignó un técnico |

Cada evento tiene el formato: `{ "type": "<evento>", "appointment": { ...datosCompletos } }`

### Filtrado por rol

| Rol | Recibe |
|---|---|
| `super_admin` | Todos los eventos de la plataforma |
| `company` | Solo eventos de su empresa (`companyPhone`) |
| `technician` | Solo eventos de sus citas asignadas (`technicianPhone`) |

### Keepalive

| Actor | Acción | Intervalo |
|---|---|---|
| Servidor | Envía `ping` WebSocket nativo | Cada 30s — desconecta si no hay `pong` |
| Cliente | Envía `{ "type": "ping" }` | Recomendado cada 25s |

---

## Push Notifications (Web Push API)

Sistema de notificaciones push basado en el estándar **Web Push / VAPID**. Funciona incluso con el browser cerrado porque las entrega el servicio push del SO (FCM, APNs, etc.).

### Configuración inicial

```bash
# 1. Generar VAPID keys
bunx web-push generate-vapid-keys

# 2. Backend .env
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_EMAIL=mailto:admin@tudominio.com

# 3. Frontend .env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<misma public key>
```

### Comportamiento

- Las suscripciones se almacenan **en memoria** (se pierden al reiniciar — para persistencia se requeriría tabla en DB)
- El filtrado de a quién se envía el push es idéntico al del WebSocket (por rol y `companyPhone`)
- Si un endpoint devuelve HTTP 410 o 404, la suscripción se elimina automáticamente
- Si VAPID keys no están configuradas, el sistema arranca sin push (log de advertencia)

---

## Caché en memoria

Para reducir la carga de queries repetidas a la DB remota (Supabase):

| Endpoint | TTL | Invalidación automática |
|---|---|---|
| `GET /stats` | **15 segundos** | Sí — al crear, actualizar o eliminar citas |
| `GET /admin/growth` | **60 segundos** | No — expiración natural |
| `GET /admin/activity` | **30 segundos** | No — expiración natural |

Implementación: `src/utils/cache.ts` — Map en memoria con timestamp de expiración.

---

## Rate limiting

| Contexto | Límite | Ventana | Scope |
|---|---|---|---|
| Global | 100 requests | 15 minutos | Por IP |
| Endpoints `/auth/*` | 20 requests | 15 minutos | Por IP |
| Intentos de login fallidos | 5 intentos | 15 minutos | Por teléfono |

En producción con múltiples instancias, configurar `REDIS_URL` para sincronizar el rate limiter entre procesos.

---

## Comandos

```bash
bun run dev           # Servidor de desarrollo (hot reload)
bun run start         # Producción (NODE_ENV=production)
bun run build         # Compilar a dist/index.js
bun run type-check    # Verificación de tipos TypeScript (sin emitir)
bun run lint          # Análisis estático ESLint
bun run lint:fix      # ESLint con corrección automática
bun run test          # Tests unitarios e integración
bun run test:watch    # Tests en modo watch
bun run db:generate   # Generar archivo de migración desde cambios en schema.ts
bun run db:migrate    # Aplicar migraciones pendientes
bun run db:push       # Aplicar schema directamente a DB (solo dev, sin journal)
bun run db:seed       # Cargar datos de prueba
```

---

## Notas de producción

- Usar el **Session Pooler** de Supabase (puerto 5432) para la app. Si usas el **Transaction Pooler** (6543), agregar `prepare: false` en `src/db/index.ts`.
- El archivo `.env` debe estar en `.gitignore`. Rotar todas las credenciales si alguna vez fue expuesto en el repositorio.
- `passwordHash` nunca aparece en ninguna respuesta de la API (excluido a nivel de query).
- El endpoint `GET /metrics` requiere el header `x-api-key: <METRICS_API_KEY>` en producción.
- Los logs de path sanitizan caracteres `\r\n\t` para evitar log injection.
