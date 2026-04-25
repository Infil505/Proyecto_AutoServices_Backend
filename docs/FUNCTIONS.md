# AutoServices — Documentación de Funciones

> Documentación función por función del backend. Cada sección cubre un controller o servicio con sus responsabilidades, lógica interna, reglas de acceso y comportamiento especial.

---

## Tabla de contenidos

1. [Autenticación (`authController`)](#1-autenticación-authcontroller)
2. [Empresas (`companyController`)](#2-empresas-companycontroller)
3. [Técnicos (`technicianController`)](#3-técnicos-techniciancontroller)
4. [Citas (`appointmentController`)](#4-citas-appointmentcontroller)
5. [Clientes (`customerController`)](#5-clientes-customercontroller)
6. [Servicios (`serviceController`)](#6-servicios-servicecontroller)
7. [Especialidades (`specialtyController`)](#7-especialidades-specialtycontroller)
8. [Zonas de cobertura (`coverageZoneController`)](#8-zonas-de-cobertura-coveragezonecontroller)
9. [Relaciones: Servicio–Especialidad (`serviceSpecialtyController`)](#9-relaciones-servicioespecia lidad-servicespecialtycontroller)
10. [Relaciones: Técnico–Especialidad (`technicianSpecialtyController`)](#10-relaciones-técnicoespecia lidad-technicianspecialtycontroller)
11. [Relaciones: Técnico–Zona (`technicianCoverageZoneController`)](#11-relaciones-técnicozona-technic iancoveragezonecontroller)
12. [Usuarios (`userController`)](#12-usuarios-usercontroller)
13. [Notificaciones Push (`pushController`)](#13-notificaciones-push-pushcontroller)
14. [Estadísticas (`statsController`)](#14-estadísticas-statscontroller)
15. [Admin (`adminController`)](#15-admin-admincontroller)
16. [Rutas públicas (`publicRoutes`)](#16-rutas-públicas-publicroutes)
17. [Servicios de negocio](#17-servicios-de-negocio)
18. [Utilidades](#18-utilidades)

---

## 1. Autenticación (`authController`)

**Archivo:** `src/controllers/authController.ts`
**Base:** `POST /api/v1/auth/*`

### `setRefreshCookie(c, token)` _(helper interno)_

Establece la cookie `refreshToken` como httpOnly en el contexto Hono.

| Propiedad | Valor |
|---|---|
| `httpOnly` | `true` — no accesible desde JavaScript del navegador |
| `sameSite` | `Strict` |
| `path` | `/api/v1/auth` — la cookie solo se envía a rutas de auth |
| `maxAge` | Calculado desde `JWT_REFRESH_EXPIRES_IN` (default 30d) |
| `secure` | `true` solo en producción |

---

### `POST /register/company` — Público

**Lógica:**
1. Valida el body con `companyRegisterSchema` (Zod).
2. Llama a `CompanyService.register()` que crea la empresa y su admin en una transacción atómica.
3. Devuelve `{ company, setupToken }` con status 201.
4. Si el admin tiene email, `CompanyService.register` envía automáticamente el correo de invitación.

**Errores posibles:**
- `400` — JSON inválido o validación fallida.
- `409` — Teléfono de empresa o admin ya registrado (DB unique violation).

---

### `POST /register/admin` — Solo `super_admin`

**Lógica:**
1. Verifica que el caller sea `super_admin`.
2. Valida con `adminRegisterSchema`.
3. Verifica que la empresa (`companyPhone`) exista en DB.
4. Crea el usuario con `UserService.create()` sin contraseña (`passwordHash: null`).
5. Genera `setupToken` (JWT tipo `setup`, 24h) con `UserService.generateSetupToken()`.
6. Si se proveyó `email`, dispara `sendInviteEmail` como fire-and-forget (`.catch(logger.warn)` — no bloquea).
7. Devuelve `{ user, setupToken }` con status 201.

---

### `POST /login` — Público

**Lógica:**
1. Valida con `loginSchema`.
2. Consulta el rate limiter por teléfono (`checkLoginAllowed`) — bloquea tras 5 intentos fallidos por 15 min.
3. Llama a `UserService.authenticate(phone, password)`:
   - Devuelve `'not_activated'` si el usuario no tiene contraseña configurada → **403**.
   - Devuelve `null` si las credenciales son incorrectas → registra intento fallido → **401**.
4. En caso exitoso: resetea el contador de intentos.
5. Llama a `setRefreshCookie` para fijar la cookie httpOnly.
6. Devuelve `{ user, token }` con status 200.

---

### `POST /refresh` — Público (cookie)

**Lógica:**
1. Lee la cookie `refreshToken` — si no existe devuelve **400**.
2. Verifica el JWT y comprueba que `tokenType === 'refresh'`.
3. Verifica que el JTI no esté en la blacklist (token revocado).
4. Genera un nuevo access token con nuevo JTI y nuevos tiempos de expiración.
5. Guarda la nueva sesión con `SessionService.save`.
6. Devuelve `{ token }`.

**Nota:** No rota el refresh token — el mismo refresh sigue siendo válido hasta su expiración.

---

### `POST /logout` — Requiere JWT

**Lógica:**
1. Lee el JTI del access token del contexto y lo añade a la blacklist (`blacklistToken`).
2. Lee la cookie `refreshToken` (o el body como fallback).
3. Si existe y es un JWT válido de tipo `refresh`, añade su JTI a la blacklist también.
4. Borra la cookie con `deleteCookie`.
5. Devuelve `{ message: 'Logged out successfully' }`.

**Nota:** Los tokens revocados son rechazados por el middleware JWT antes de llegar a cualquier controller.

---

### `POST /setup-password` — Público

**Lógica:**
1. Valida con `setupPasswordSchema` — requiere `{ token, password }`.
2. Verifica el JWT del `token`:
   - Debe ser un JWT válido.
   - `tokenType` debe ser `'setup'`.
   - Debe contener `userId` (número).
3. Comprueba que el usuario exista con `UserService.getById`.
4. Comprueba si ya tiene contraseña con `UserService.hasPassword` — si ya tiene, devuelve **409** (token ya usado).
5. Actualiza la contraseña con `UserService.update` (el service hace el bcrypt hash).
6. Devuelve `{ message: 'Password set successfully' }`.

---

## 2. Empresas (`companyController`)

**Archivo:** `src/controllers/companyController.ts`
**Base:** `/api/v1/companies`
**Cache:** TTL 30s — clave `companies:list:{page}:{limit}` — invalidado en toda mutación.

---

### `GET /companies` — `company` | `super_admin`

| Rol | Comportamiento |
|---|---|
| `technician` | **403** — no tiene acceso a empresas |
| `company` | Devuelve solo su propia empresa (wrapeada en respuesta paginada con total=1) |
| `super_admin` | Lista todas las empresas con paginación; usa cache 30s |

---

### `GET /companies/:phone` — `company` | `super_admin`

**Lógica:**
1. `technician` → **403**.
2. Busca la empresa por `phone`.
3. `company` solo puede ver su propia empresa: compara `phone` de la URL con `companyPhone` del JWT → **403** si no coincide.

---

### `POST /companies` — Solo `super_admin`

**Lógica:**
1. Solo `super_admin` puede crear empresas directamente (sin admin). Para empresa+admin usar `POST /auth/register/company`.
2. Valida con `companySchema`.
3. Crea con `CompanyService.create`.
4. Invalida cache de empresas.
5. Devuelve la empresa con status 201.

---

### `PUT /companies/:phone` — `company` | `super_admin`

**Lógica:**
1. `technician` → **403**.
2. `company` solo puede editar su propia empresa — compara `phone` de URL con JWT → **403**.
3. Valida con `companySchema.partial()` (todos los campos opcionales).
4. Actualiza y devuelve la empresa.
5. Invalida cache.

---

### `DELETE /companies/:phone` — `company` | `super_admin`

**Lógica:**
1. `technician` → **403**.
2. `company` solo puede eliminar su propia empresa.
3. Devuelve `{ message: 'Deleted' }`.

---

### `POST /companies/:phone/admin` — Solo `super_admin`

**Lógica:**
1. Verifica que la empresa destino exista.
2. Valida con `companyAdminSchema`.
3. Crea el usuario con `UserService.create` sin contraseña.
4. Genera `setupToken`.
5. Si tiene `email`, dispara `sendInviteEmail` como fire-and-forget.
6. Devuelve `{ user, setupToken }` con status 201.

---

## 3. Técnicos (`technicianController`)

**Archivo:** `src/controllers/technicianController.ts`
**Base:** `/api/v1/technicians`
**Cache:** TTL 30s — claves por compañía y por técnico — invalidado en toda mutación.

---

### `GET /technicians` — Todos los roles

| Rol | Cache key | Datos |
|---|---|---|
| `technician` | `technicians:tech:{phone}` | Solo su propio registro |
| `company` | `technicians:co:{cp}:{page}:{limit}` | Técnicos de su empresa |
| `super_admin` | `technicians:admin:{page}:{limit}` | Todos los técnicos |

---

### `GET /technicians/:phone/availability` — Todos los roles

**Lógica:**
1. `technician` solo puede consultar su propia disponibilidad.
2. `company` solo puede consultar técnicos de su empresa.
3. Obtiene el registro del técnico (sirve también como verificación de existencia y permisos).
4. Si se provee `?date=YYYY-MM-DD`: busca citas activas del técnico para esa fecha y cachea el resultado 60s.
5. Devuelve `{ technicianPhone, available, date, occupiedSlots: [{ appointmentId, startTime, status }] }`.

---

### `GET /technicians/:phone` — Todos los roles

**Lógica:**
- `technician` solo puede ver su propio registro.
- `company` solo puede ver técnicos de su empresa.

---

### `POST /technicians` — `company` | `super_admin`

**Lógica:**
1. Valida con `technicianSchema`.
2. Determina `companyPhone`: del JWT para `company`, del body para `super_admin`.
3. Verifica que el técnico no exista ya en DB (previene conflicto en transacción).
4. Llama a `TechnicianService.register` que crea el técnico y su usuario en transacción atómica.
5. Invalida cache de técnicos.
6. Devuelve `{ technician, setupToken }`.

---

### `PUT /technicians/:phone` — Todos los roles

**Lógica:**
1. `technician` solo puede editar su propio registro.
2. `company` solo puede editar técnicos de su empresa.
3. Si se intenta poner `available: false`: verifica que el técnico no tenga citas activas (`pending`, `confirmed`, `in_progress`) → **409** si tiene.
4. Para `company` y `technician`: **strip de `companyPhone`** del body — no pueden reasignar técnicos a otra empresa.
5. Solo `super_admin` puede cambiar `companyPhone`.
6. Devuelve **404** si el teléfono no existe.

---

### `DELETE /technicians/:phone` — Todos los roles

- `technician` solo puede eliminar su propio registro.
- `company` solo puede eliminar técnicos de su empresa.

---

## 4. Citas (`appointmentController`)

**Archivo:** `src/controllers/appointmentController.ts`
**Base:** `/api/v1/appointments`
**Cache:** TTL 5s — claves por compañía/técnico — invalidado inmediatamente en toda mutación.

---

### `syncCalendarAsync(id, appointment, mode)` _(helper interno, fire-and-forget)_

Sincroniza con Google Calendar en background sin bloquear la respuesta HTTP.

**Flujo:**
1. Si no hay `appointmentDate` o `startTime`, sale sin hacer nada.
2. Obtiene los datos completos de la cita con `AppointmentService.getFullById`.
3. En modo `'update'`: actualiza el evento Calendar existente (usa `metadata.calendarEventId`).
4. En modo `'create'`: crea un nuevo evento Calendar.
5. Si Calendar respondió correctamente: actualiza `appointment.content` (link del evento) y `appointment.metadata.calendarEventId`.
6. Solo en modo `'create'`: llama a `EmailService.sendAppointmentCreatedEmails` para enviar invitaciones con `.ics` al cliente, técnico y empresa.

---

### `buildCalendarInput(full)` _(helper interno)_

Construye el objeto `CalendarEventInput` a partir de los datos completos de la cita.

- **Título:** `"Cita - {nombreCliente} | {nombreTécnico}"`
- **Descripción:** descripción de la cita + nombre del servicio + técnico + tel cliente + empresa
- **Duración:** `service.estimatedDurationMinutes` o 60 min por defecto
- **Asistentes:** emails de cliente, técnico y empresa (los que existan)
- **Ubicación:** `"lat,lng"` si hay coordenadas

---

### `invalidateAppointmentsCache(companyPhone?)` _(exportada)_

Borra del cache in-memory todos los registros de citas.
- Con `companyPhone`: solo las claves de esa empresa (`appointments:co:{cp}:*`).
- Sin argumento: todas las claves con prefijo `appointments:`.

---

### `GET /appointments` — Todos los roles

| Rol | Cache key | Datos |
|---|---|---|
| `technician` | `appointments:tech:{phone}:{page}:{limit}` | Sus citas con detalles (cliente, técnico, servicio) |
| `company` | `appointments:co:{cp}:{page}:{limit}` | Citas de su empresa con detalles |
| `super_admin` | `appointments:admin:{page}:{limit}` | Todas con detalles |

Las listas incluyen objetos anidados `customer`, `technician`, `service`.

---

### `GET /appointments/:id` — Todos los roles

**Lógica:**
1. Obtiene datos completos (`getFullById`).
2. `technician` solo puede ver citas donde es el técnico asignado.
3. `company` solo puede ver citas de su empresa.
4. Devuelve el appointment con datos anidados.

---

### `POST /appointments` — `company` | `super_admin`

**Lógica:**
1. Valida con `appointmentSchema`.
2. `companyPhone` se toma del JWT para `company`; `super_admin` debe incluirlo en body.
3. Crea la cita con `AppointmentService.create`.
4. Invalida cache de citas.
5. Dispara `syncCalendarAsync` en background (mode `'create'`).
6. Devuelve la cita con status 201.

**Campos internos que NO deben enviarse:** `content`, `metadata` — son manejados por la sincronización de Calendar.

---

### `PUT /appointments/:id` — `company` | `super_admin`

**Lógica:**
1. `company` solo puede editar citas de su empresa — hace SELECT previo para verificar (se reutiliza en el service para evitar doble query).
2. Valida con `appointmentSchema.partial()`.
3. Actualiza con `AppointmentService.update`.
4. Invalida cache.
5. Dispara `syncCalendarAsync` en background (mode `'update'`).

---

### `DELETE /appointments/:id` — `company` | `super_admin`

**Lógica:**
1. `company` solo puede eliminar citas de su empresa.
2. Extrae `calendarEventId` del `metadata` de la cita antes de borrarla.
3. Elimina la cita.
4. Invalida cache.
5. Si había evento Calendar, llama `CalendarService.deleteEvent` en background.

---

### `PATCH /appointments/:id/status/tecnico` — Solo `technician`

**Lógica:**
1. Verifica que el técnico autenticado sea el asignado a esa cita.
2. Valida body: `{ estatusTecnico: boolean }`.
3. Actualiza con `AppointmentService.updateTechnicianStatus`.

**Nota:** El trigger de email de comprobante PDF ocurre cuando AMBOS estatus son `true`. Esto lo maneja `EmailService.startEmailListener()` que escucha eventos de `AppointmentService.events`.

---

### `PATCH /appointments/:id/status/administrador` — Solo `company`

**Lógica:**
1. Verifica que la empresa del caller sea la dueña de la cita.
2. Valida body: `{ estatusAdministrador: boolean }`.
3. Actualiza con `AppointmentService.updateAdminStatus`.

---

### `GET /appointments/:id/pdf` — Todos los roles

**Lógica:**
1. Verifica permisos por rol.
2. Verifica que `estatusTecnico === true` Y `estatusAdministrador === true` → **422** si no.
3. Genera el PDF con `PdfService.generateAppointmentPdf`.
4. Devuelve response binaria con headers `Content-Type: application/pdf` y `Content-Disposition: attachment`.

---

## 5. Clientes (`customerController`)

**Archivo:** `src/controllers/customerController.ts`
**Base:** `/api/v1/customers`
**Cache:** TTL 30s — clave `customers:{page}:{limit}` — invalidado en toda mutación.

| Función | Rol requerido | Notas |
|---|---|---|
| `GET /customers` | `company`, `super_admin` | `technician` → 403 |
| `GET /customers/:phone` | `company`, `super_admin` | `technician` → 403 |
| `POST /customers` | `company`, `super_admin` | Valida con `customerSchema` |
| `PUT /customers/:phone` | `company`, `super_admin` | Partial update; 404 si no existe |
| `DELETE /customers/:phone` | `company`, `super_admin` | — |

---

## 6. Servicios (`serviceController`)

**Archivo:** `src/controllers/serviceController.ts`
**Base:** `/api/v1/services`
**Cache:** TTL 30s — claves por compañía y admin — invalidado en toda mutación.

### `GET /services`

| Rol | Cache key | Datos |
|---|---|---|
| `technician` | `services:co:{companyPhone}:{page}:{limit}` | Servicios de su empresa (usa `companyPhone` del JWT) |
| `company` | `services:co:{cp}:{page}:{limit}` | Servicios de su empresa |
| `super_admin` | `services:admin:{page}:{limit}` | Todos |

### `GET /services/:id`

- `company` solo puede ver servicios de su empresa.
- `technician` solo puede ver servicios de su empresa (`companyPhone` del JWT).

### `POST /services`

- `technician` → **403**.
- `companyPhone` del JWT para `company`; del body para `super_admin`.
- Invalida todo el cache de servicios al crear.

### `PUT /services/:id`

- `technician` → **403**.
- `company` solo puede editar servicios de su empresa.
- **Strip de `companyPhone`** para roles no-admin — no pueden reasignar servicios.

### `DELETE /services/:id`

- `technician` → **403**.
- `company` solo puede eliminar servicios de su empresa.

---

## 7. Especialidades (`specialtyController`)

**Archivo:** `src/controllers/specialtyController.ts`
**Base:** `/api/v1/specialties`
**Cache:** TTL 30s — invalidado en toda mutación.

Las especialidades son un catálogo global (no pertenecen a una empresa).

| Función | Rol requerido | Notas |
|---|---|---|
| `GET /specialties` | Cualquier rol autenticado | Cache 30s |
| `GET /specialties/:id` | Cualquier rol autenticado | — |
| `POST /specialties` | Solo `super_admin` | `name` debe ser único en DB |
| `PUT /specialties/:id` | Solo `super_admin` | Partial update; 404 si no existe |
| `DELETE /specialties/:id` | Solo `super_admin` | Verifica existencia antes de borrar |

---

## 8. Zonas de cobertura (`coverageZoneController`)

**Archivo:** `src/controllers/coverageZoneController.ts`
**Base:** `/api/v1/coverage-zones`
**Cache:** TTL 30s — claves por rol — invalidado en toda mutación.

### `GET /coverage-zones`

| Rol | Datos |
|---|---|
| `technician` | Llama a `TechnicianCoverageZoneService.getZonesByTechnician` — obtiene solo sus zonas asignadas |
| `company` | Zonas de su empresa |
| `super_admin` | Todas |

### `GET /coverage-zones/:id`

- `company` solo puede ver zonas de su empresa.
- `technician` solo puede ver zonas donde está asignado (verifica con `TechnicianCoverageZoneService.getAssignment`).

### `POST /coverage-zones`

- `technician` → **403**.
- `companyPhone` del JWT para `company`.

### `PUT /coverage-zones/:id`

- `technician` → **403**.
- `company` solo puede editar zonas de su empresa.
- **Strip de `companyPhone`** para rol `company`.

### `DELETE /coverage-zones/:id`

- `technician` → **403**.
- `company` solo puede eliminar zonas de su empresa.

---

## 9. Relaciones: Servicio–Especialidad (`serviceSpecialtyController`)

**Archivo:** `src/controllers/serviceSpecialtyController.ts`
**Base:** `/api/v1/service-specialties`

| Función | Descripción |
|---|---|
| `GET /` | Lista todas las relaciones (paginado) |
| `GET /service/:serviceId` | Especialidades de un servicio específico |
| `GET /specialty/:specialtyId` | Servicios que tienen una especialidad específica |
| `POST /` | Crea relación `{ serviceId, specialtyId }` — solo `company` o `super_admin` |
| `DELETE /?serviceId=&specialtyId=` | Elimina la relación — solo `company` o `super_admin` |

---

## 10. Relaciones: Técnico–Especialidad (`technicianSpecialtyController`)

**Archivo:** `src/controllers/technicianSpecialtyController.ts`
**Base:** `/api/v1/technician-specialties`

| Función | Descripción |
|---|---|
| `GET /` | Lista todas las relaciones |
| `GET /technician/:phone` | Especialidades de un técnico. `technician` solo ve las suyas; `company` solo ve técnicos de su empresa |
| `GET /specialty/:specialtyId` | Técnicos con una especialidad específica |
| `POST /` | `{ technicianPhone, specialtyId }` — `company` verifica que el técnico sea de su empresa |
| `DELETE /?technicianPhone=&specialtyId=` | `company` verifica que el técnico sea de su empresa |

---

## 11. Relaciones: Técnico–Zona (`technicianCoverageZoneController`)

**Archivo:** `src/controllers/technicianCoverageZoneController.ts`
**Base:** `/api/v1/technician-coverage-zones`

| Función | Descripción |
|---|---|
| `GET /` | Lista asignaciones según rol (`technician` → las suyas, `company` → las de su empresa, `super_admin` → todas) |
| `GET /technician/:phone` | Zonas asignadas a un técnico (datos completos de zona) |
| `GET /zone/:id` | Técnicos asignados a una zona (datos completos de técnico). `technician` → **403** |
| `POST /` | `{ technicianPhone, coverageZoneId }`. `company` verifica que técnico Y zona sean suyos. Devuelve **409** si ya existe la asignación |
| `DELETE /?technicianPhone=&zoneId=` | Elimina asignación. `company` verifica propiedad del técnico. **404** si no existe la asignación |

---

## 12. Usuarios (`userController`)

**Archivo:** `src/controllers/userController.ts`
**Base:** `/api/v1/users`

> Para crear técnicos usar `POST /technicians`. Para admins de empresa usar `POST /companies/:phone/admin`. `POST /users` es solo para `super_admin` en casos especiales.

### `GET /users`

- `technician` y `company`: devuelven solo su propio registro (por `phone` del JWT).
- `super_admin`: devuelve todos los usuarios. Sin paginación — retorna array directo.

### `GET /users/:id`

- `technician` solo puede ver su propio usuario y solo si el tipo es `technician`.
- `company` solo puede ver el usuario con su mismo `phone`.

### `POST /users` — Solo `super_admin`

**Lógica:**
1. Valida con `userSchema` (incluye `password` requerida).
2. Si se provee `companyPhone`, verifica que la empresa exista.
3. La contraseña se hashea en `UserService.create`.
4. `passwordHash` nunca se devuelve en respuestas — se omite con `safeSelect`.

### `PUT /users/:id`

**Lógica:**
1. Verifica existencia del usuario antes de parsear body.
2. `technician` solo puede editar su propio usuario de tipo `technician`.
3. `company` solo puede editar el usuario con su mismo `phone`.
4. Valida con `userUpdateSchema` (todos los campos opcionales: `name`, `email`, `password`).
5. Si se incluye `password`, el service genera el nuevo hash.

### `DELETE /users/:id`

- Mismas reglas de propiedad que PUT.

---

## 13. Notificaciones Push (`pushController`)

**Archivo:** `src/controllers/pushController.ts`
**Base:** `/api/v1/push-subscriptions`

### `POST /push-subscriptions` — Requiere JWT

**Lógica:**
1. Verifica que VAPID esté configurado (`PushService.isEnabled()`) → **503** si no.
2. Valida que el body tenga `endpoint`, `keys.p256dh` y `keys.auth`.
3. Guarda la suscripción en memoria con `PushService.saveSubscription` junto con `userPhone`, `userType` y `companyPhone`.
4. Devuelve `{ message: 'Subscription saved' }` con status 201.

**Limitación:** Las suscripciones se almacenan en RAM — se pierden si el servidor se reinicia.

### `DELETE /push-subscriptions` — Requiere JWT

- Elimina la suscripción identificada por `endpoint` del body.

---

## 14. Estadísticas (`statsController`)

**Archivo:** `src/controllers/statsController.ts`
**Base:** `/api/v1/stats`
**Cache:** TTL 30s — invalidado automáticamente por eventos de `AppointmentService.events`.

### Invalidación automática

El controller escucha los eventos del servicio de citas:

```
AppointmentService.events.on('appointment:created', invalidateStatsCache)
AppointmentService.events.on('appointment:updated', invalidateStatsCache)
AppointmentService.events.on('appointment:deleted', invalidateStatsCache)
```

### `GET /stats`

Cada rol ejecuta **una única query CTE** en lugar de N queries paralelas:

| Rol | Cache key | Métricas devueltas |
|---|---|---|
| `super_admin` | `stats:super_admin` | `companies`, `appointments`, `technicians`, `customers`, `services` |
| `company` | `stats:company:{cp}` | `appointments`, `completedAppointments`, `technicians`, `activeTechnicians`, `services`, `activeServices`, `zones` |
| `technician` | `stats:technician:{phone}` | `appointments` (solo las asignadas) |

---

## 15. Admin (`adminController`)

**Archivo:** `src/controllers/adminController.ts`
**Base:** `/api/v1/admin`

Todas las rutas verifican `super_admin` via middleware `router.use('*', ...)`.

### `GET /admin/metrics` — Cache 10s

**Devuelve:**
- `uptime` — milisegundos desde arranque.
- `memory` — `{ used, total, percent }` del heap de Node/Bun.
- `responseTime` — `{ avg, min, max }` calculado por el middleware de métricas.
- `requests` — `{ total, errors }`.
- `database.latencyMs` — tiempo de un `SELECT 1` al momento de la request.
- **503** si la DB no responde.

### `GET /admin/growth` — Cache 60s

**Lógica:**
1. Construye array de los últimos 6 meses como strings `YYYY-MM`.
2. Dos queries paralelas: `companies` y `appointments` agrupados por mes con `DATE_TRUNC`.
3. Mapea los resultados a los 6 labels — meses sin datos quedan en `0`.

**Respuesta:** `[{ month: "2026-03", companies: 2, appointments: 15 }, ...]`

### `GET /admin/activity` — Cache 30s

**Lógica:**
1. Dos queries paralelas: últimas 5 empresas y últimas 5 citas (por `created_at desc`).
2. Combina en un array de eventos tipados (`company_joined` | `appointment_created`).
3. Ordena por fecha desc y toma los 10 más recientes.

**Respuesta:** `[{ type, message, phone, createdAt }, ...]`

---

## 16. Rutas públicas (`publicRoutes`)

**Archivo:** `src/routes/publicRoutes.ts`
**Base:** `/api/v1/public`
**Sin autenticación.**

### `GET /public/stats`

Ejecuta 4 queries `countAll` en paralelo (`Promise.all`):
- `CompanyService.countAll()`
- `AppointmentService.countAll()`
- `TechnicianService.countAll()`
- `ServiceService.countAll()`

Usado por la landing page para mostrar números reales de la plataforma.

---

## 17. Servicios de negocio

### `UserService` (`src/services/userService.ts`)

| Método | Descripción |
|---|---|
| `getAll()` | Todos los usuarios sin `passwordHash` |
| `getById(id)` | Usuario por ID, sin `passwordHash` |
| `getByPhone(phone)` | Usuario por teléfono, sin `passwordHash` |
| `create(data)` | Crea usuario; si `passwordHash` tiene valor, lo hashea con bcrypt (`BCRYPT_ROUNDS`) |
| `update(id, data)` | Actualiza; rehashea si se incluye `passwordHash` |
| `delete(id)` | Elimina usuario |
| `hasPassword(id)` | Devuelve `true` si el usuario tiene contraseña configurada |
| `generateSetupToken(userId)` | JWT `{ userId, tokenType: 'setup', exp: +24h }` para flujo de invitación |
| `authenticate(phone, password)` | Verifica credenciales. Devuelve `'not_activated'`, `null` o `{ user, token, refreshToken }`. Para `technician` hace JOIN extra para obtener `companyPhone` |

---

### `AppointmentService` (`src/services/appointmentService.ts`)

| Método | Descripción |
|---|---|
| `events` | `EventEmitter` — emite `appointment:created`, `appointment:updated`, `appointment:deleted` |
| `getAll(page?)` | Citas planas |
| `countAll()` | Total de citas |
| `getByTechnician(phone, page?)` | Citas de un técnico |
| `countByTechnician(phone)` | Total por técnico |
| `getByCompany(phone, page?)` | Citas de una empresa |
| `countByCompany(phone)` | Total por empresa |
| `countCompletedByCompany(phone)` | Total completadas por empresa |
| `getAllWithDetails(page?)` | Citas con JOIN a `customers`, `technicians`, `services` |
| `getByCompanyWithDetails(phone, page?)` | JOIN filtrado por empresa |
| `getByTechnicianWithDetails(phone, page?)` | JOIN filtrado por técnico |
| `countActiveByTechnician(phone)` | Citas con status `pending/confirmed/in_progress` |
| `getByTechnicianAndDate(phone, date)` | Citas de un técnico para una fecha específica |
| `getById(id)` | Cita plana por ID |
| `getFullById(id)` | Cita + `customer`, `technician`, `service`, `company` |
| `create(data)` | Crea cita + emite `appointment:created` |
| `update(id, data, existing?)` | Actualiza + emite `appointment:updated` |
| `delete(id, existing?)` | Elimina + emite `appointment:deleted` |
| `updateTechnicianStatus(id, value)` | Actualiza `estatusTecnico` + emite evento |
| `updateAdminStatus(id, value)` | Actualiza `estatusAdministrador` + emite evento |

---

### `CalendarService` (`src/services/calendarService.ts`)

| Método | Descripción |
|---|---|
| `createEvent(input)` | Crea evento en Google Calendar. Devuelve `{ eventId, htmlLink }` o `null` si falla |
| `updateEvent(eventId, input)` | Actualiza evento existente. Devuelve `{ eventId, htmlLink }` o `null` |
| `deleteEvent(eventId)` | Elimina evento. Silencia errores de "evento no encontrado" |

Usa Google Service Account (`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`). El `calendarId` objetivo es `GOOGLE_CALENDAR_ID` (default: `primary`).

---

### `EmailService` (`src/services/emailService.ts`)

| Método | Descripción |
|---|---|
| `startEmailListener()` | Se registra en `AppointmentService.events` — cuando ambos estatus son `true`, genera PDF y envía email con adjunto al cliente |
| `sendAppointmentCreatedEmails(full, calendarLink?)` | Envía email de confirmación con `.ics` adjunto al cliente, técnico y empresa |

Los envíos de email son fire-and-forget fuera del path HTTP crítico.

---

### `PushService` (`src/services/pushService.ts`)

| Método | Descripción |
|---|---|
| `init()` | Configura `web-push` con las VAPID keys de env. Sin keys → push deshabilitado |
| `isEnabled()` | Devuelve `true` si VAPID está configurado |
| `saveSubscription({ subscription, userPhone, userType, companyPhone })` | Guarda suscripción en Map en memoria |
| `removeSubscription(endpoint)` | Elimina suscripción por endpoint |
| `attachToEvents(emitter)` | Escucha eventos de `AppointmentService.events` y envía notificaciones push a suscriptores relevantes |

---

### `PdfService` (`src/services/pdfService.ts`)

| Método | Descripción |
|---|---|
| `generateAppointmentPdf(fullData)` | Genera un PDF con PDFKit con datos de la cita (cliente, técnico, servicio, fecha, descripción). Devuelve `Buffer` |

---

## 18. Utilidades

### `cache.ts`

```ts
cacheGet<T>(key)           // Devuelve el valor o undefined si expiró
cacheSet<T>(key, value, ttlMs)  // Guarda con TTL; limpieza automática cada 60s
cacheDeletePrefix(prefix)  // Borra todas las claves que empiezan con prefix
```

Store: `Map<string, { value, expiresAt }>`. Sin dependencias externas (no Redis). La limpieza de expirados se ejecuta lazy en cada `cacheSet`.

---

### `tokenBlacklist.ts`

```ts
blacklistToken(jti)     // Marca el JTI como revocado (cache in-memory 5 min)
isBlacklisted(jti)      // Verifica si el JTI está revocado
```

El TTL de 5 min cubre el caso de uso normal (access tokens de 7d son revocados al hacer logout). Cuando el token expire de forma natural, el JTI ya no necesita estar en la blacklist.

---

### `dbErrors.ts`

```ts
handleDbError(err)  // Mapea códigos PostgreSQL a respuestas HTTP estructuradas
```

| Código PG | HTTP | Mensaje |
|---|---|---|
| `23505` | 409 | Unique violation |
| `23503` | 409 | Foreign key violation |
| `25P02` | 409 | Transaction aborted |
| Otros | Re-throw | Manejado por `app.onError` → 500 |

La función extrae el código PG desde `err.code`, `err.cause.code` o `err.original.code` para compatibilidad con diferentes wrappers de error.

---

### `loginLimiter.ts`

```ts
checkLoginAllowed(phone)       // Devuelve { allowed: boolean }
recordFailedAttempt(phone)     // Incrementa contador de intentos fallidos
resetLoginAttempts(phone)      // Resetea contador tras login exitoso
```

Umbral: 5 intentos fallidos por teléfono → bloqueado 15 minutos. Store in-memory (Map).

---

### `pagination.ts`

```ts
parsePagination(c)           // Lee ?page y ?limit del query string; defaults page=1, limit=10
createPaginatedResponse(data, total, opts)  // Construye { data, pagination: { page, limit, total, totalPages, hasNext, hasPrev } }
```

---

### `jwt.ts`

```ts
createJWT(payload, secret)   // Firma HMAC-SHA256 con jose; devuelve string JWT
verifyJWT(token, secret)     // Verifica y devuelve payload o null
parseExpiresIn(str)          // Convierte "7d", "30d", "1h" a segundos
```

---

### `errors.ts`

Objeto centralizado de respuestas de error predefinidas:

| Clave | Status | Mensaje |
|---|---|---|
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 403 | Forbidden |
| `FORBIDDEN` | 403 | Forbidden |
| `INVALID_JSON` | 400 | Invalid JSON body |
| `INVALID_TOKEN` | 401 | Invalid or expired token |
| `TOKEN_REVOKED` | 401 | Token has been revoked |
| `MISSING_AUTH_HEADER` | 401 | Missing Authorization header |
| `INVALID_CREDENTIALS` | 401 | Invalid phone or password |
| `ACCOUNT_NOT_ACTIVATED` | 403 | Account not activated |
| `LOGIN_TOO_MANY_ATTEMPTS` | 429 | Too many login attempts |
| `TOO_MANY_REQUESTS` | 429 | Too many requests |
| `SETUP_TOKEN_INVALID` | 400 | Invalid or expired setup token |
| `SETUP_TOKEN_ALREADY_USED` | 409 | Password already set |
| `REFRESH_TOKEN_REQUIRED` | 400 | Refresh token required |
| `INVALID_REFRESH_TOKEN` | 401 | Invalid refresh token |
| `APPOINTMENT_PDF_BOTH_STATUSES` | 422 | PDF requires both statuses = true |
| `TECHNICIAN_HAS_ACTIVE_APPOINTMENTS` | 409 | Technician has active appointments |
| `ZONE_ASSIGNMENT_EXISTS` | 409 | Assignment already exists |
| `DB_UNIQUE_VIOLATION` | 409 | Resource already exists |

---

### `logger.ts`

Winston logger con niveles: `error`, `warn`, `http`, `info`.
- En producción: nivel `info` mínimo, sin stack traces en logs.
- En desarrollo: nivel `http` — loguea cada request con método, path, status y ms.
- Los archivos de log se guardan en `logs/`.

---

### `params.ts`

```ts
parseIntParam(str)  // Convierte string a entero positivo; devuelve null si inválido
```

---

### `ics.ts`

```ts
generateICS(appointment, service?)  // Genera string ICS (iCalendar) para adjuntar en emails de confirmación
```

Incluye `DTSTART`, `DTEND`, `SUMMARY`, `DESCRIPTION` y `UID`.

---

## Middleware (`index.ts`)

### Orden de ejecución de middleware (top → bottom)

1. **Overload protection** — 503 si >50 requests en vuelo (prod) / >200 (dev). `/health` y `/metrics` exentos.
2. **Request logging** — `logger.http` con método, path, status, duración.
3. **Metrics** — `metricsMiddleware()` — acumula datos para `/metrics`.
4. **Body limit** — rechaza payloads >1MB.
5. **Security headers** — `hono/secure-headers`.
6. **CORS** — `credentials: true` para la cookie cross-origin.
7. **Rate limit global** — 100 req/15min por IP (prod). `/health` exento.
8. **Rate limit auth** — 20 req/15min por IP en rutas `/api/v1/auth*` (prod).
9. **JWT middleware** — verifica Bearer token + blacklist + rate limit per-user para rutas protegidas.

### `jwtMiddleware(secret)`

1. Lee el header `Authorization: Bearer <token>`.
2. Verifica el JWT con `verifyJWT`.
3. Rechaza tokens de tipo `refresh` (solo access tokens pasan).
4. Comprueba blacklist JTI.
5. Aplica rate limit per-user (300 req/15min en prod).
6. Setea `c.set("user", payload)` para que los controllers lean el usuario del contexto.

### `POST /health/shutdown`

Endpoint de apagado de emergencia sin JWT.
- Rate limited: 5 intentos por IP por 15 min.
- Credenciales comparadas con `timingSafeEqual` (previene timing attacks).
- Si credenciales correctas: `setTimeout(() => process.exit(0), 300ms)` — da tiempo a responder antes de morir.
- Audita IP, timestamp y resultado en `console.warn`.
