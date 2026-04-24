# API Endpoints — AutoServices Backend

Base URL: `http://localhost:3008/api/v1`

Header requerido en rutas protegidas:
```
Authorization: Bearer <access_token>
```

Todas las respuestas de lista siguen el formato:
```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 10, "total": 42, "totalPages": 5, "hasNext": true, "hasPrev": false }
}
```

**Roles:** `super_admin` | `company` | `technician`

---

## AUTH

### POST `/auth/register/company` — Público

Crea una empresa y su administrador en una transacción. El `admin.phone` es el teléfono del usuario, distinto al de la empresa.

El administrador se crea **sin contraseña**. Si se incluye `admin.email`, se envía automáticamente un correo de invitación para que el usuario configure su contraseña.

```json
{
  "company": {
    "phone": "+50612345678",
    "name": "AutoServicios Norte",
    "email": "contacto@empresa.com",
    "address": "Av. Principal 456",
    "startHour": "08:00",
    "endHour": "18:00"
  },
  "admin": {
    "phone": "+50687654321",
    "name": "Juan Pérez",
    "email": "juan@empresa.com"
  }
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `company.phone` | string (+E.164, 10–15 chars) | Sí |
| `company.name` | string (2–100) | Sí |
| `company.email` | string (email) | No |
| `company.address` | string (máx 500) | No |
| `company.startHour` | string (`HH:MM`) | No |
| `company.endHour` | string (`HH:MM`) | No |
| `admin.phone` | string (+E.164, 10–15 chars) | Sí |
| `admin.name` | string (2–100) | Sí |
| `admin.email` | string (email) | No — si se provee, se envía el correo de invitación |

**Respuesta 201:** `{ company, setupToken }`

`setupToken` es el token de configuración de contraseña (24h de validez). Úsalo directamente si el admin no tiene email, o guárdalo para mostrar un enlace de invitación manual.

---

### POST `/auth/register/admin` — Requiere `super_admin`

Crea un usuario administrador de empresa existente. Se crea **sin contraseña** — se envía invitación por email si se incluye `email`.

```json
{
  "phone": "+50611112222",
  "name": "María López",
  "email": "maria@empresa.com",
  "companyPhone": "+50612345678"
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `phone` | string (+E.164, 10–15 chars) | Sí |
| `name` | string (2–100) | Sí |
| `email` | string (email) | No — si se provee, se envía el correo de invitación |
| `companyPhone` | string (10–15 chars) | Sí — debe existir en companies |

**Respuesta 201:** `{ user, setupToken }`

---

### POST `/auth/login` — Público

```json
{ "phone": "+50612345678", "password": "password123" }
```

**Respuesta 200:** `{ user, token }` + cookie httpOnly `refreshToken`

**Respuesta 403** si la cuenta fue creada pero aún no ha configurado su contraseña (`ACCOUNT_NOT_ACTIVATED`).

Bloqueo: 5 intentos fallidos por teléfono → 429 por 15 minutos.

---

### POST `/auth/refresh` — Público (cookie)

Sin body. Usa la cookie `refreshToken` automáticamente.

**Respuesta 200:** `{ token }`

---

### POST `/auth/setup-password` — Público

Configura la contraseña por primera vez usando el token de invitación recibido por email (o devuelto en la creación).

```json
{ "token": "<setupToken>", "password": "nuevaContraseña123" }
```

| Campo | Tipo | Requerido |
|---|---|---|
| `token` | string | Sí — JWT de invitación (24h de validez) |
| `password` | string (8–128) | Sí |

**Respuesta 200:** `{ message: "Password set successfully" }`

**Respuesta 400** si el token es inválido o expiró.

**Respuesta 409** si la contraseña ya fue configurada previamente (token ya usado).

#### Flujo de invitación completo

1. Se crea el usuario (admin o técnico) → el backend devuelve `setupToken` en la respuesta.
2. Si el usuario tiene email, el backend **envía automáticamente** un correo con el enlace:
   ```
   {APP_URL}/set-password?token=<setupToken>
   ```
3. El frontend debe tener una página en la ruta `/set-password` que:
   - Lea el query param `token` de la URL
   - Muestre un formulario de nueva contraseña
   - Al enviar, llame a `POST /auth/setup-password` con `{ token, password }`
4. Tras configurar la contraseña, el usuario puede hacer login normalmente con `POST /auth/login`.

#### Variable de entorno requerida

```env
APP_URL=https://tu-frontend.com
```

En desarrollo el fallback es el primer origen en `CORS_ORIGINS` (`http://localhost:3000`).

Si el usuario **no tiene email**, el `setupToken` viene en la respuesta de creación para que el administrador pueda construir el enlace manualmente:
```
{APP_URL}/set-password?token=<setupToken>
```

---

### POST `/auth/logout` — Requiere JWT

Sin body. Revoca el access token del header y el refresh de la cookie.

**Respuesta 200:** `{ message: "Logged out successfully" }`

---

## COMPANIES

### GET `/companies` — Requiere JWT (`company` | `super_admin`)

- `company`: devuelve solo su propia empresa
- `super_admin`: devuelve todas (paginado)

Query params: `?page=1&limit=10`

---

### GET `/companies/:phone` — Requiere JWT (`company` | `super_admin`)

`company` solo puede ver su propia empresa.

---

### POST `/companies` — Requiere `super_admin`

Crea solo el registro de empresa (sin usuario). Para empresa + admin usar `/auth/register/company`.

```json
{
  "phone": "+50612345678",
  "name": "AutoServicios Norte",
  "email": "contacto@empresa.com",
  "address": "Av. Principal 456",
  "startHour": "08:00",
  "endHour": "18:00"
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `phone` | string (+E.164, 10–15) | Sí |
| `name` | string (2–100) | Sí |
| `email` | string (email) | No |
| `address` | string (máx 500) | No |
| `startHour` | string (`HH:MM`) | No |
| `endHour` | string (`HH:MM`) | No |

**Respuesta 201:** company

---

### PUT `/companies/:phone` — Requiere JWT (`company` | `super_admin`)

Todos los campos opcionales. `company` solo puede editar su propia empresa.

```json
{ "name": "Nuevo nombre", "address": "Nueva dirección" }
```

---

### DELETE `/companies/:phone` — Requiere JWT (`company` | `super_admin`)

**Respuesta 200:** `{ message: "Deleted" }`

---

### POST `/companies/:phone/admin` — Requiere `super_admin`

Agrega un administrador a una empresa existente. El `phone` de la empresa va en la URL. El admin se crea **sin contraseña** — si se incluye `email`, se envía invitación.

```
POST /companies/+50612345678/admin
```

```json
{
  "phone": "+50633334444",
  "name": "Carlos Ruiz",
  "email": "carlos@empresa.com"
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `phone` | string (+E.164, 10–15) | Sí |
| `name` | string (2–100) | Sí |
| `email` | string (email) | No — si se provee, se envía el correo de invitación |

**Respuesta 201:** `{ user, setupToken }`

---

## TECHNICIANS

### GET `/technicians` — Requiere JWT

- `technician`: devuelve solo su propio registro
- `company`: devuelve técnicos de su empresa
- `super_admin`: devuelve todos

Query params: `?page=1&limit=10`

---

### GET `/technicians/:phone` — Requiere JWT

`technician` solo puede ver su propio registro.

---

### GET `/technicians/:phone/availability` — Requiere JWT

Slots ocupados para una fecha.

Query params: `?date=2026-05-15`

**Respuesta:** `{ technicianPhone, available, date, occupiedSlots: [{ appointmentId, startTime, status }] }`

---

### POST `/technicians` — Requiere `company` o `super_admin`

El técnico se crea **sin contraseña**. Si se incluye `email`, se envía un correo de invitación.

```json
{
  "phone": "+50655556666",
  "name": "Luis Torres",
  "email": "luis@empresa.com",
  "companyPhone": "+50612345678",
  "available": true
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `phone` | string (+E.164, 10–15) | Sí |
| `name` | string (2–100) | Sí |
| `email` | string (email) | No — si se provee, se envía el correo de invitación |
| `companyPhone` | string (10–15) | Solo para `super_admin`. Para `company` se toma del JWT |
| `available` | boolean | No (default: `true`) |

Crea el registro en `technicians` y en `users` en una transacción.

**Respuesta 201:** `{ technician, setupToken }`

---

### PUT `/technicians/:phone` — Requiere JWT

Todos los campos opcionales. `company` solo puede editar técnicos de su empresa. Si se envía `available: false` y el técnico tiene citas activas devuelve 409.

`companyPhone` en el body es **ignorado** para roles `company` y `technician` — solo `super_admin` puede reasignar un técnico a otra empresa.

**Respuesta 404** si el teléfono no existe.

```json
{ "name": "Nuevo nombre", "available": false }
```

---

### DELETE `/technicians/:phone` — Requiere JWT

`technician` solo puede eliminar su propio registro.

---

## APPOINTMENTS

### GET `/appointments` — Requiere JWT

- `technician`: sus citas asignadas
- `company`: citas de su empresa
- `super_admin`: todas

Query params: `?page=1&limit=10`

Incluye objetos `customer`, `technician`, `service` anidados.

---

### GET `/appointments/:id` — Requiere JWT

---

### POST `/appointments` — Requiere `company` o `super_admin`

```json
{
  "customerPhone": "+50677778888",
  "technicianPhone": "+50655556666",
  "serviceId": 1,
  "appointmentDate": "2026-05-20",
  "startTime": "10:00",
  "status": "pending",
  "description": "Revisión de frenos",
  "coordinates": { "lat": 9.9281, "lng": -84.0907 }
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `customerPhone` | string (10–15) | No |
| `technicianPhone` | string (10–15) | No |
| `serviceId` | integer | No |
| `appointmentDate` | string (`YYYY-MM-DD`) | No |
| `startTime` | string (`HH:MM`) | No |
| `status` | string | No (default: `pending`) |
| `description` | string (máx 2000) | No — notas libres de la cita |
| `coordinates` | `{ lat: number, lng: number }` | No |
| `companyPhone` | string (10–15) | Solo `super_admin` — obligatorio |

> **Nota sobre `companyPhone`:** Para rol `company` se toma automáticamente del JWT y no debe enviarse en el body. Para `super_admin` es obligatorio — sin él el servidor devuelve `400 companyPhone is required`.

> **Nota sobre `content`:** Este campo **no debe enviarse en el body**. Es gestionado internamente por el backend para almacenar el link del evento de Google Calendar una vez que se sincroniza.

`status` válidos: `pending` | `scheduled` | `confirmed` | `in_progress` | `completed` | `cancelled`

**Respuesta 201:** appointment

#### Comportamiento automático tras la creación

El backend ejecuta en background (no bloquea la respuesta):

1. **Google Calendar** — Crea un evento con el título, descripción, fecha, hora y duración del servicio. El link del evento queda guardado en `appointment.content` y el ID del evento en `appointment.metadata.calendarEventId`.

2. **Emails con ICS** — Envía un email de confirmación con el archivo `.ics` adjunto (para agregar al calendario) a:
   - Cliente (`customer.email`)
   - Técnico (`technician.email`)
   - Empresa (`company.email`)

   Requiere dominio verificado en Resend. En modo testing (dominio `onboarding@resend.dev`) solo entrega al email registrado en la cuenta de Resend.

---

### PUT `/appointments/:id` — Requiere `company` o `super_admin`

Todos los campos opcionales. `company` solo puede editar citas de su empresa.

Actualiza el evento de Google Calendar automáticamente si cambia fecha, hora o descripción.

> `content` y `metadata` no deben enviarse en el body — son campos internos del sync de Calendar.

---

### DELETE `/appointments/:id` — Requiere `company` o `super_admin`

Elimina el evento de Google Calendar asociado (si existe). **Respuesta 200:** `{ message: "Deleted" }`

---

### PATCH `/appointments/:id/status/tecnico` — Requiere `technician`

Solo el técnico asignado puede marcar.

```json
{ "estatusTecnico": true }
```

---

### PATCH `/appointments/:id/status/administrador` — Requiere `company`

Solo el administrador de la empresa dueña puede aprobar.

```json
{ "estatusAdministrador": true }
```

---

### GET `/appointments/:id/pdf` — Requiere JWT

Requiere que `estatusTecnico = true` Y `estatusAdministrador = true`. Devuelve PDF binario.

---

## CUSTOMERS

### GET `/customers` — Requiere `company` o `super_admin`

Query params: `?page=1&limit=10`

---

### GET `/customers/:phone` — Requiere `company` o `super_admin`

---

### POST `/customers` — Requiere `company` o `super_admin`

```json
{
  "phone": "+50677778888",
  "name": "Carlos Gómez",
  "email": "carlos@gmail.com",
  "state": "San José",
  "city": "Escazú",
  "address": "Calle 10 #20",
  "content": "Cliente frecuente"
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `phone` | string (+E.164, 10–15) | Sí |
| `name` | string (2–100) | No |
| `email` | string (email) | No |
| `state` | string (máx 50) | No |
| `city` | string (máx 100) | No |
| `address` | string (máx 500) | No |
| `content` | string (máx 2000) | No |

**Respuesta 201:** customer

---

### PUT `/customers/:phone` — Requiere `company` o `super_admin`

Todos los campos opcionales. **Respuesta 404** si el teléfono no existe.

---

### DELETE `/customers/:phone` — Requiere `company` o `super_admin`

---

## SERVICES

### GET `/services` — Requiere JWT

- `technician`: servicios de su empresa
- `company`: servicios de su empresa
- `super_admin`: todos

Query params: `?page=1&limit=10`

---

### GET `/services/:id` — Requiere JWT

---

### POST `/services` — Requiere `company` o `super_admin`

```json
{
  "name": "Cambio de aceite",
  "description": "Servicio completo de cambio de aceite",
  "category": "Maintenance",
  "estimatedDurationMinutes": 60,
  "active": true
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `name` | string (2–100) | Sí |
| `description` | string (máx 1000) | No |
| `category` | string (máx 50) | No |
| `estimatedDurationMinutes` | integer (1–1440) | Sí |
| `active` | boolean | No (default: `true`) |
| `companyPhone` | string | Solo para `super_admin`. Para `company` se toma del JWT |

**Respuesta 201:** service

---

### PUT `/services/:id` — Requiere `company` o `super_admin`

Todos los campos opcionales. `company` solo puede editar servicios de su empresa.

`companyPhone` en el body es **ignorado** para rol `company` — solo `super_admin` puede reasignar un servicio a otra empresa.

**Respuesta 404** si el id no existe.

---

### DELETE `/services/:id` — Requiere `company` o `super_admin`

---

## SPECIALTIES

### GET `/specialties` — Requiere JWT

Query params: `?page=1&limit=10`

---

### GET `/specialties/:id` — Requiere JWT

---

### POST `/specialties` — Requiere `super_admin`

```json
{ "name": "Mecánica general", "description": "Reparación y mantenimiento general", "active": true }
```

| Campo | Tipo | Requerido |
|---|---|---|
| `name` | string (2–100, único) | Sí |
| `description` | string (máx 500) | No |
| `active` | boolean | No (default: `true`) |

**Respuesta 201:** specialty

---

### PUT `/specialties/:id` — Requiere `super_admin`

---

### DELETE `/specialties/:id` — Requiere `super_admin`

---

## COVERAGE ZONES

### GET `/coverage-zones` — Requiere JWT

---

### GET `/coverage-zones/:id` — Requiere JWT

---

### POST `/coverage-zones` — Requiere JWT

```json
{
  "companyPhone": "+50612345678",
  "state": "San José",
  "city": "Escazú",
  "zoneName": "Zona Norte",
  "postalCode": "10201",
  "notes": "Cobertura en colonias del norte"
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `companyPhone` | string (10–15) | Solo para `super_admin`. Para `company` se toma del JWT |
| `state` | string (2–50) | Sí |
| `city` | string (2–100) | Sí |
| `zoneName` | string (máx 100) | No |
| `postalCode` | string (máx 20) | No |
| `notes` | string (máx 500) | No |

---

### PUT `/coverage-zones/:id` — Requiere `company` o `super_admin`

Todos los campos opcionales. `company` solo puede editar zonas de su empresa.

`companyPhone` en el body es **ignorado** para rol `company` — solo `super_admin` puede reasignar una zona a otra empresa.

**Respuesta 404** si el id no existe.

---

### DELETE `/coverage-zones/:id` — Requiere `company` o `super_admin`

---

## RELATIONS

### POST `/service-specialties` — Requiere JWT

```json
{ "serviceId": 1, "specialtyId": 2 }
```

### DELETE `/service-specialties` — Requiere JWT

Query: `?serviceId=1&specialtyId=2`

---

### POST `/technician-specialties` — Requiere JWT

```json
{ "technicianPhone": "+50655556666", "specialtyId": 2 }
```

### DELETE `/technician-specialties` — Requiere JWT

Query: `?technicianPhone=%2B50655556666&specialtyId=2`

---

### POST `/technician-coverage-zones` — Requiere JWT

```json
{ "technicianPhone": "+50655556666", "coverageZoneId": 1 }
```

### DELETE `/technician-coverage-zones` — Requiere JWT

Query: `?technicianPhone=%2B50655556666&zoneId=1`

---

## USERS

### GET `/users` — Requiere JWT

`super_admin`: todos los usuarios. Otros roles: solo su propio registro.

---

### GET `/users/:id` — Requiere JWT

---

### POST `/users` — Requiere `super_admin`

Crea usuario directamente. Para técnicos usar `/technicians`; para admins de empresa usar `/companies/:phone/admin`.

```json
{
  "phone": "+50699990000",
  "name": "Ana Ruiz",
  "email": "ana@empresa.com",
  "password": "password123",
  "type": "company",
  "companyPhone": "+50612345678"
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `phone` | string (+E.164, 10–15) | Sí |
| `name` | string (2–100) | Sí |
| `email` | string (email) | No |
| `password` | string (8–128) | Sí |
| `type` | `super_admin` \| `company` \| `technician` | Sí |
| `companyPhone` | string (10–15) | Sí para `company` y `technician` |

---

### PUT `/users/:id` — Requiere JWT

`technician` y `company` solo pueden editar su propio usuario. Todos los campos son opcionales — no es necesario enviar `type` ni `companyPhone` para actualizaciones parciales (name, email, password).

---

### DELETE `/users/:id` — Requiere JWT

---

## PUSH SUBSCRIPTIONS

### POST `/push-subscriptions` — Requiere JWT

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/XXXXXX",
  "keys": { "p256dh": "B...", "auth": "A..." }
}
```

---

## STATS

### GET `/stats` — Requiere JWT

Respuesta varía según rol:
- `super_admin`: totales globales (empresas, técnicos, citas, clientes)
- `company`: totales de su empresa
- `technician`: sus propias estadísticas

---

## ADMIN (solo `super_admin`)

### GET `/admin/metrics` — Uptime, memoria, latencia DB

### GET `/admin/growth` — Crecimiento mensual (últimos 6 meses)

### GET `/admin/activity` — Últimos 10 eventos del sistema

---

## PUBLIC (sin autenticación)

### GET `/public/stats`

**Respuesta:** `{ companies, appointments, technicians, services }`

---

## SYSTEM

### GET `/health` — Público

Estado del servidor.

### POST `/health/shutdown` — Sin JWT

Apagado de emergencia. Credenciales en `.env`.

```json
{ "user": "admin", "password": "tu_shutdown_password" }
```

---

## Resumen de reglas por rol

| Acción | `super_admin` | `company` | `technician` |
|---|---|---|---|
| Crear empresa | `/companies` o `/auth/register/company` | — | — |
| Crear admin de empresa | `/companies/:phone/admin` o `/auth/register/admin` | — | — |
| Crear técnico | Sí (con `companyPhone`) | Sí (companyPhone del JWT) | — |
| Crear cita | Sí (con `companyPhone`) | Sí (companyPhone del JWT) | — |
| Crear servicio | Sí (con `companyPhone`) | Sí (companyPhone del JWT) | — |
| Crear cliente | Sí | Sí | — |
| Ver técnicos | Todos | Solo los suyos | Solo a sí mismo |
| Ver citas | Todas | Solo las de su empresa | Solo las asignadas |
| Marcar cita completada | — | — | `PATCH .../status/tecnico` |
| Aprobar cita | — | `PATCH .../status/administrador` | — |

## Notas sobre `companyPhone`

Para rol `company`, el `companyPhone` **nunca se manda en el body** — se toma automáticamente del JWT. Solo `super_admin` debe incluirlo explícitamente:

**En POST (creación):**
- `POST /technicians`
- `POST /appointments`
- `POST /services`
- `POST /coverage-zones`
- `POST /companies/:phone/admin`

**En PUT (actualización):**
- Si se incluye `companyPhone` en el body para rol `company`, el servidor lo **ignora** — no puede reasignar recursos a otra empresa.
- Solo `super_admin` puede cambiar `companyPhone` en un PUT para reasignar un recurso entre empresas.

Esta regla aplica a: `PUT /technicians/:phone`, `PUT /services/:id`, `PUT /coverage-zones/:id`.
