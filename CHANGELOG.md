# Changelog

Todos los cambios notables de AutoServices Backend están documentados aquí.

Formato basado en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versionado siguiendo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.3.0] — 2026-04-17

### Security — Auditoría y hardening completo

**Crítico**
- `passwordHash` eliminado de todas las respuestas de `UserService` (safe select + destructuring en `create`/`update`/`authenticate`)
- Corregido IDOR en `PUT /api/v1/appointments/:id` y `DELETE`: ahora verifica que la cita pertenezca a la empresa del usuario autenticado antes de permitir la modificación
- WebSocket ahora verifica la blacklist de sesiones revocadas y rechaza tokens de tipo `refresh`

**Alto**
- Añadido lockout de cuenta: 5 intentos fallidos de login por teléfono → bloqueo de 15 minutos (`src/utils/loginLimiter.ts`)
- Rate limiter protegido contra IP spoofing: nueva variable `TRUST_PROXY` — los headers `X-Forwarded-For` / `CF-Connecting-IP` solo se confían cuando el flag está activado
- WebSocket: `companyPhone` incluido en `ClientInfo` para que admins secundarios de empresa reciban eventos correctamente
- WebSocket: en producción requiere header `Origin` válido (previene conexiones desde orígenes no permitidos)

**Medio / Bajo**
- `parseIntParam()` en todos los controllers con parámetros numéricos (previene queries con `NaN`)
- Paths de log sanitizados contra `\r\n\t` (previene log injection)
- Variables `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` y `METRICS_API_KEY` ahora requeridas en `NODE_ENV=production`
- Import sin usar (`relations`) eliminado de `schema.ts`

---

## [1.2.0] — 2026-04-16

### Added
- **Sesiones persistidas en base de datos** — nueva tabla `sessions` con `jti`, `tokenType`, `expiresAt`, `revokedAt`; el logout sobrevive reinicios del servidor
- **`SessionService`** (`src/services/sessionService.ts`) — `save`, `revoke`, `isRevoked`, `getActiveByUser`
- **Relación empresa-usuario explícita** — columna `companyPhone` FK en tabla `users`; super_admin puede crear múltiples administradores por empresa
- **Endpoint `POST /api/v1/companies/:phone/admin`** — permite al super_admin asignar administradores adicionales a empresas existentes
- **`companyPhone` en JWT para usuarios `company`** — todos los roles que gestionan recursos de empresa ahora reciben `companyPhone` en su token, no solo los técnicos

### Changed
- `tokenBlacklist.ts` reemplazado por delegación a `SessionService` (las funciones ahora son `async`)
- `jwtMiddleware` en `index.ts` actualizado a `await isBlacklisted()`
- `UserService.authenticate` guarda las dos sesiones (access + refresh) en DB al hacer login
- `authController` — `/refresh` verifica blacklist del refresh token y guarda la nueva sesión access en DB
- Todos los controllers actualizados a `payload.companyPhone ?? payload.phone` para guards de empresa (compatibilidad con admins secundarios)
- `companyService.register` establece `companyPhone` al crear el usuario del registro de empresa

### Fixed
- Migración `0003_little_wendigo.sql` reescrita para omitir el rename de `tasks` ya realizado en la DB y solo aplicar los cambios incremetales reales

---

## [1.1.0] — 2026-04-15

### Added
- **Generación de PDF** para citas completadas (`estatusTecnico = true` y `estatusAdministrador = true`)
- **Envío automático de email** con PDF adjunto al cliente cuando ambos estatus son `true` (Resend + EventEmitter)
- `PdfService` (`src/services/pdfService.ts`) con `pdfkit`
- `EmailService` (`src/services/emailService.ts`) con listener sobre `appointment:both_completed`
- Endpoints `PATCH /appointments/:id/status/tecnico` y `PATCH /appointments/:id/status/administrador` con RBAC aislado
- Endpoint `GET /appointments/:id/pdf` — descarga el PDF directamente
- **WebSocket mejorado**: heartbeat server-side (ping/pong), autenticación con timeout de 5s, validación de origen
- Endpoint `POST /api/v1/auth/refresh` para renovar access token sin volver a loguearse
- Estadísticas por empresa: `GET /api/v1/stats`
- Panel admin: `GET /api/v1/admin/metrics`, `/admin/growth`, `/admin/activity`
- Métricas internas en `GET /metrics` protegidas por `X-Metrics-Key`
- Endpoint de shutdown de emergencia `POST /health/shutdown` con rate limiting y timing-safe comparison
- Endpoint público `GET /api/v1/public/stats`

### Changed
- `AppointmentService` emite `appointment:both_completed` cuando ambos estatus cambian a `true`
- Schema `appointments` ampliado con `estatusTecnico` y `estatusAdministrador` (boolean nullable)

---

## [1.0.0] — 2024-12-31

### Added
- API REST completa con Hono framework + Bun runtime
- Autenticación JWT (HS256 via `jose`) con roles `super_admin`, `company`, `technician`
- Refresh tokens con expiración independiente
- Logout con revocación de JTI (en memoria — mejorado en v1.2.0)
- RBAC en todos los endpoints protegidos
- 12 tablas en PostgreSQL gestionadas con Drizzle ORM y migraciones versionadas
- Validación con Zod en capa de middleware
- Paginación en todos los listados
- CORS, rate limiting (Redis/in-memory), logging con Winston
- Documentación OpenAPI 3.0 con Swagger UI en `/api/v1/docs`
- Registro de empresa (`POST /auth/register/company`) — transacción atómica empresa + usuario
- CRUD completo: usuarios, empresas, técnicos, clientes, servicios, citas, especialidades, zonas de cobertura
- Tablas junction: `service_specialties`, `technician_specialties`, `technician_coverage_zones`
- WebSocket en puerto 3001 para eventos de citas en tiempo real
- Seed de datos de prueba (`bun run db:seed`)

---

## Tipos de cambio

| Etiqueta | Significado |
|----------|-------------|
| `Added` | Nueva funcionalidad |
| `Changed` | Cambio en funcionalidad existente |
| `Deprecated` | Marcado para eliminación futura |
| `Removed` | Eliminado |
| `Fixed` | Corrección de bug |
| `Security` | Cambio relacionado con seguridad |
