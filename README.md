# AutoServices Backend API

> Backend REST + WebSocket para el sistema de gestión de citas y servicios técnicos

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-000?logo=bun&logoColor=white)](https://bun.sh/)
[![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)

---

## Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Inicio Rápido](#inicio-rápido)
- [Variables de Entorno](#variables-de-entorno)
- [API Endpoints](#api-endpoints)
- [Sistema de Roles](#sistema-de-roles)
- [WebSocket](#websocket)
- [Seguridad](#seguridad)
- [Desarrollo](#desarrollo)
- [Despliegue](#despliegue)
- [Documentación](#documentación)

---

## Características

| Categoría | Detalle |
|-----------|---------|
| **Auth** | JWT (HS256) + Refresh tokens + Logout persistido en DB + Lockout por intentos fallidos |
| **RBAC** | 3 roles: `super_admin`, `company`, `technician` con guards en cada endpoint |
| **Base de datos** | PostgreSQL + Drizzle ORM + migraciones versionadas |
| **Validación** | Zod schemas en capa de validación; `parseIntParam` contra NaN en rutas |
| **Tiempo real** | WebSocket en puerto 3001 con autenticación JWT y filtrado por rol |
| **Email** | PDF de comprobante enviado automáticamente al cliente al completar cita (Resend) |
| **Rate limiting** | 100 req/15min global; 20 req/15min en `/auth`; Redis o in-memory |
| **Métricas** | `GET /metrics` con clave de API; panel en `/api/v1/admin/metrics` |
| **Documentación** | Swagger UI en `/api/v1/docs` |
| **Seguridad** | CORS configurado, log injection sanitizado, IDOR protegido, `passwordHash` nunca expuesto |

---

## Arquitectura

```
Cliente (HTTP/WS)
       │
       ▼
┌─────────────────────────────────────────┐
│  index.ts  — Hono app (puerto 3000)     │
│  CORS → Rate limiter → JWT middleware   │
│  → Routes → Controllers → Services     │
└───────────────────┬─────────────────────┘
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
   ┌─────────────┐     ┌──────────────────┐
   │  PostgreSQL │     │  WebSocket :3001 │
   │  (Drizzle)  │     │  (appointments)  │
   └─────────────┘     └──────────────────┘
```

**Flujo de una petición protegida:**
```
Request → CORS → Rate Limit → JWT verify + blacklist check (DB) → Zod validate → Controller → Service → DB
```

---

## Estructura del Proyecto

```
Proyecto_AutoServices_Backend/
├── src/
│   ├── config/           # Configuración centralizada (config/index.ts)
│   ├── controllers/      # Handlers HTTP — uno por entidad
│   ├── db/
│   │   ├── index.ts      # Instancia Drizzle
│   │   └── schema.ts     # Definición de las 12 tablas
│   ├── docs/
│   │   └── openapi.ts    # Especificación OpenAPI 3.0 (sirve el Swagger UI)
│   ├── middleware/
│   │   ├── metrics.ts    # Colector de métricas + endpoint /metrics
│   │   └── validation.ts # Rate limiter (Redis/in-memory)
│   ├── routes/           # Definición de rutas (públicas vs protegidas)
│   ├── services/         # Lógica de negocio + EventEmitter pub/sub
│   ├── utils/
│   │   ├── errors.ts     # Catálogo centralizado de errores HTTP
│   │   ├── jwt.ts        # createJWT / verifyJWT (jose HS256)
│   │   ├── loginLimiter.ts # Lockout por intentos fallidos (5 intentos → 15 min)
│   │   ├── params.ts     # parseIntParam — valida IDs numéricos en rutas
│   │   ├── tokenBlacklist.ts # isBlacklisted / blacklistToken (delega a SessionService)
│   │   ├── dbErrors.ts   # Mapeo de errores PostgreSQL → HTTP
│   │   ├── logger.ts     # Winston logger
│   │   └── pagination.ts # parsePagination / createPaginatedResponse
│   ├── validation/
│   │   └── schemas.ts    # Todos los schemas Zod
│   └── ws/
│       └── appointmentWebsocket.ts  # WebSocket con auth JWT y filtrado por rol
├── drizzle/              # Migraciones SQL generadas por Drizzle Kit
├── docs/                 # Guías adicionales (PostgreSQL, integración frontend)
├── index.ts              # Punto de entrada — monta la app Hono
├── .env.example          # Plantilla de variables de entorno (sin credenciales reales)
├── drizzle.config.ts     # Configuración de Drizzle Kit
└── package.json
```

---

## Inicio Rápido

### 1. Instalar Bun

```bash
# Windows (PowerShell como administrador)
powershell -Command "irm bun.sh/install.ps1 | iex"

# macOS / Linux
curl -fsSL https://bun.sh/install | bash
```

### 2. Instalar dependencias

```bash
bun install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Edita .env con tu DATABASE_URL y JWT_SECRET
```

### 4. Ejecutar migraciones

```bash
bun run db:migrate
```

### 5. (Opcional) Cargar datos de prueba

```bash
bun run db:seed
```

### 6. Iniciar el servidor

```bash
bun run dev
```

### Verificar

| Recurso | URL |
|---------|-----|
| API | `http://localhost:3000` |
| Swagger UI | `http://localhost:3000/api/v1/docs` |
| Health check | `http://localhost:3000/health` |
| WebSocket | `ws://localhost:3001` |

---

## Variables de Entorno

| Variable | Requerida | Descripción | Ejemplo |
|----------|-----------|-------------|---------|
| `DATABASE_URL` | ✅ | Cadena de conexión PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | ✅ | Secreto HS256 (mín. 64 chars) | `openssl rand -hex 64` |
| `PORT` | — | Puerto HTTP (default `3000`) | `3000` |
| `WS_PORT` | — | Puerto WebSocket (default `3001`) | `3001` |
| `JWT_EXPIRES_IN` | ✅ prod | Expiración access token | `7d` |
| `JWT_REFRESH_EXPIRES_IN` | ✅ prod | Expiración refresh token | `30d` |
| `METRICS_API_KEY` | ✅ prod | Protege `GET /metrics` | `openssl rand -hex 32` |
| `SHUTDOWN_PASSWORD` | ✅ prod | Protege `POST /health/shutdown` | string fuerte |
| `TRUST_PROXY` | — | `true` si hay proxy delante (Nginx/Cloudflare) | `false` |
| `CORS_ORIGINS` | — | Orígenes permitidos (coma-separados) | `https://app.com` |
| `REDIS_URL` | — | Rate limiting distribuido | `redis://localhost:6379` |
| `RESEND_API_KEY` | — | Envío de emails (PDF de citas) | `re_xxx` |
| `RESEND_FROM_EMAIL` | — | Dirección remitente | `noreply@tudominio.com` |
| `BCRYPT_ROUNDS` | — | Rondas bcrypt (default `12`) | `12` |
| `LOG_LEVEL` | — | Nivel de log Winston | `info` |

---

## API Endpoints

**Base path:** `/api/v1`

### Públicos (sin autenticación)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/register/company` | Registro de empresa + usuario admin en una transacción |
| `POST` | `/auth/login` | Login → devuelve `token` y `refreshToken` |
| `POST` | `/auth/refresh` | Renueva el access token usando un refresh token válido |
| `GET` | `/public/stats` | Contadores públicos de la plataforma |
| `GET` | `/health` | Estado del servidor |

### Auth (protegidos)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| `POST` | `/auth/logout` | Todos | Revoca el access token (y refresh si se envía) |
| `POST` | `/auth/register/admin` | `super_admin` | Crea un nuevo super_admin |

### Usuarios

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| `GET` | `/users` | `super_admin` → todos; otros → solo el propio | Lista usuarios (sin `passwordHash`) |
| `GET` | `/users/:id` | Según rol | Obtener usuario |
| `POST` | `/users` | `super_admin` | Crear usuario |
| `PUT` | `/users/:id` | Según rol | Actualizar usuario |
| `DELETE` | `/users/:id` | Según rol | Eliminar usuario |

### Empresas

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| `GET` | `/companies` | `super_admin` → todas; `company` → la propia | Lista empresas |
| `GET` | `/companies/:phone` | `super_admin`, `company` propia | Obtener empresa |
| `POST` | `/companies` | `super_admin` | Crear empresa (sin usuario admin) |
| `PUT` | `/companies/:phone` | `super_admin`, `company` propia | Actualizar empresa |
| `DELETE` | `/companies/:phone` | `super_admin`, `company` propia | Eliminar empresa |
| `POST` | `/companies/:phone/admin` | `super_admin` | Crear admin adicional para una empresa existente |

### Técnicos

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| `GET` | `/technicians` | `super_admin` → todos; `company` → los propios; `technician` → el propio | Lista técnicos |
| `GET` | `/technicians/:phone` | Según rol | Obtener técnico |
| `GET` | `/technicians/:phone/availability` | Según rol | Disponibilidad del técnico en fecha |
| `POST` | `/technicians` | `company`, `super_admin` | Crear técnico + usuario |
| `PUT` | `/technicians/:phone` | Según rol | Actualizar técnico |
| `DELETE` | `/technicians/:phone` | Según rol | Eliminar técnico |

### Citas

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| `GET` | `/appointments` | Filtrado por rol | Lista citas |
| `GET` | `/appointments/:id` | Según rol y propiedad | Obtener cita completa |
| `POST` | `/appointments` | `company`, `super_admin` | Crear cita |
| `PUT` | `/appointments/:id` | `company` propia, `super_admin` | Actualizar cita |
| `DELETE` | `/appointments/:id` | `company` propia, `super_admin` | Eliminar cita |
| `PATCH` | `/appointments/:id/status/tecnico` | `technician` asignado | Marcar trabajo realizado |
| `PATCH` | `/appointments/:id/status/administrador` | `company` propietaria | Confirmar completado |
| `GET` | `/appointments/:id/pdf` | `company` propia, `technician` asignado | Descargar PDF (requiere ambos estatus en `true`) |

### Servicios, Clientes, Especialidades, Zonas de Cobertura

Siguen el mismo patrón CRUD con control de acceso por rol. Ver Swagger en `/api/v1/docs`.

### Admin (`super_admin` exclusivo)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/admin/metrics` | Métricas del servidor (uptime, memoria, latencia DB) |
| `GET` | `/admin/growth` | Crecimiento mensual (últimos 6 meses) |
| `GET` | `/admin/activity` | Últimos 10 eventos de la plataforma |

---

## Sistema de Roles

### `super_admin`
- Acceso completo a todos los recursos
- Crear/eliminar empresas, técnicos, usuarios y super_admins
- Crear administradores adicionales para empresas existentes
- Ver métricas y actividad global

### `company`
- Gestiona **su propia empresa** (identificada por `companyPhone` en el JWT)
- CRUD de técnicos, servicios, citas y zonas de cobertura propias
- Confirma completado de citas (`estatusAdministrador`)
- Puede haber múltiples usuarios `company` por empresa (creados por `super_admin`)

### `technician`
- Ve solo sus propias citas y datos
- Marca su trabajo como realizado (`estatusTecnico`)
- El `companyPhone` del JWT lo vincula a su empresa

---

## WebSocket

**URL:** `ws://localhost:3001`

### Flujo de conexión

```
1. El servidor envía: { "type": "auth_required" }
2. El cliente envía:  { "type": "auth", "token": "<access_jwt>" }
3. El servidor verifica: tokenType === 'access', jti no revocado, firma válida
4. Si OK, el servidor envía: { "type": "ws_connected", ... }
```

### Eventos recibidos

| Evento | Datos | Visible para |
|--------|-------|-------------|
| `appointment:created` | `{ type, appointment }` | `super_admin`; `company` propia; `technician` asignado |
| `appointment:updated` | idem | idem |
| `appointment:deleted` | idem | idem |
| `appointment:assigned` | idem | idem |

### Heartbeat

El servidor hace ping cada 30s. Clientes sin respuesta pong son desconectados.

---

## Seguridad

### Implementado

| Mecanismo | Descripción |
|-----------|-------------|
| **JWT HS256** | Tokens firmados con `jose`; payload incluye `jti` único para revocación individual |
| **Sesiones en DB** | Tabla `sessions` — el logout persiste entre reinicios del servidor |
| **Lockout por cuenta** | 5 intentos fallidos de login por teléfono → bloqueo de 15 minutos |
| **RBAC** | Cada endpoint verifica rol y propiedad del recurso |
| **IDOR protection** | Company solo puede modificar/eliminar sus propias citas |
| **Sin passwordHash en responses** | `passwordHash` excluido a nivel de query en todos los métodos de `UserService` |
| **Rate limiting** | 100 req/15min global; 20 req/15min en rutas de auth |
| **CORS** | Solo orígenes en `CORS_ORIGINS` |
| **Log sanitization** | `\r\n\t` eliminados del path antes de escribir en logs |
| **parseInt seguro** | `parseIntParam()` en todos los controllers con parámetros numéricos |
| **WebSocket auth** | Solo tokens `access` válidos y no revocados; origen validado en producción |

### Variables de entorno sensibles — nunca en el repositorio

Agrega al `.gitignore`:
```
.env
.env.local
.env.production
```

---

## Desarrollo

### Comandos

```bash
bun run dev          # Servidor con hot-reload
bun run type-check   # TypeScript strict
bun run lint         # ESLint
bun run lint:fix     # Auto-fix ESLint
bun run test         # Vitest
bun run test:watch   # Watch mode
bun run test --coverage

# Base de datos
bun run db:generate  # Genera migración desde cambios en schema.ts
bun run db:migrate   # Aplica migraciones pendientes
bun run db:push      # Push directo (dev only — no genera migración)
bun run db:seed      # Carga datos de prueba
```

### Agregar un nuevo endpoint

1. Definir schema Zod en `src/validation/schemas.ts`
2. Crear o actualizar el servicio en `src/services/`
3. Agregar handler en el controller correspondiente (`src/controllers/`)
4. Registrar la ruta en `src/routes/` y aplicar JWT middleware en `index.ts` si es protegida
5. Documentar en `src/docs/openapi.ts`

### Agregar una columna al schema

```bash
# 1. Editar src/db/schema.ts
# 2. Generar migración
bun run db:generate
# 3. Revisar el SQL generado en drizzle/
# 4. Aplicar
bun run db:migrate
```

---

## Despliegue

### Variables mínimas de producción

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=<64+ chars aleatorios>
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
METRICS_API_KEY=<aleatorio>
SHUTDOWN_PASSWORD=<aleatorio>
TRUST_PROXY=true
CORS_ORIGINS=https://tuapp.com
```

### Build y start

```bash
bun run build
bun run start
```

### Docker

```dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production
COPY . .
EXPOSE 3000 3001
CMD ["bun", "run", "start"]
```

### Plataformas recomendadas

| Servicio | Uso |
|----------|-----|
| Supabase / Neon / Railway | Base de datos PostgreSQL |
| Railway / Render / Fly.io | Hosting del backend |
| Upstash | Redis serverless para rate limiting |
| Resend | Envío de emails transaccionales |

---

## Documentación

| Recurso | URL / Archivo |
|---------|---------------|
| Swagger UI (interactivo) | `http://localhost:3000/api/v1/docs` |
| Configuración de PostgreSQL | `docs/POSTGRESQL_SETUP.md` |
| Integración Frontend | `docs/FRONTEND_INTEGRATION_GUIDE.md` |
| Changelog | `CHANGELOG.md` |
| Guía de contribución | `CONTRIBUTING.md` |

---

## Changelog

Ver [CHANGELOG.md](CHANGELOG.md) para el historial completo de versiones.

---

## Licencia

MIT — ver archivo `LICENSE`.
