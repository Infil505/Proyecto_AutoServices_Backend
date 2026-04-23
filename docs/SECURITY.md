# Seguridad — AutoServices Backend

## Arquitectura de autenticación

### Flujo completo

```
[Cliente]                          [Backend]
   │                                   │
   ├─ POST /auth/login ──────────────► │
   │   { phone, password }             │  1. Verifica bcrypt (12 rounds)
   │                                   │  2. Genera access JWT (HS256, 7d)
   │                                   │  3. Genera refresh JWT (HS256, 30d)
   │                                   │  4. Persiste ambos JTI en tabla sessions
   │ ◄── { user, token } ─────────────┤  5. Devuelve access en body
   │     Set-Cookie: refreshToken      │     refresh como httpOnly cookie
   │     (HttpOnly; SameSite=Strict)   │
   │                                   │
   ├─ Requests autenticados ─────────► │  Authorization: Bearer <access>
   │                                   │  1. Verifica firma HS256
   │                                   │  2. Chequea blacklist (tabla sessions)
   │                                   │  3. Rate limit por usuario (300 req/15min)
   │                                   │
   ├─ POST /auth/refresh ────────────► │  Cookie refreshToken (automático)
   │   (credentials: include)          │  1. Verifica JWT refresh desde cookie
   │                                   │  2. Chequea blacklist
   │                                   │  3. Genera nuevo access token
   │ ◄── { token } ───────────────────┤
   │                                   │
   ├─ POST /auth/logout ─────────────► │  Authorization: Bearer <access>
   │   (credentials: include)          │  Cookie refreshToken (automático)
   │                                   │  1. Blacklistea access JTI
   │                                   │  2. Blacklistea refresh JTI desde cookie
   │ ◄── { message: "Logged out" } ───┤  3. Borra cookie (Set-Cookie: expires=past)
```

---

## Tokens

| Propiedad | Access Token | Refresh Token |
|-----------|-------------|---------------|
| Almacenamiento | `localStorage` (frontend) | `httpOnly cookie` |
| Visible desde JS | Sí | No |
| Expiración default | 7 días | 30 días |
| Algoritmo | HS256 | HS256 |
| Revocación | Blacklist por JTI en DB | Blacklist por JTI en DB |
| Transmisión | `Authorization: Bearer` header | Cookie automático |

### Por qué httpOnly cookie para el refresh token

El refresh token tiene vida larga (30 días). Si se guarda en `localStorage`, un ataque XSS puede robarlo y mantener acceso indefinido. Con `httpOnly`, el JS del browser no puede leerlo — solo el browser lo envía automáticamente al backend.

El access token (7 días) sí vive en `localStorage`/memoria porque necesita adjuntarse manualmente al header `Authorization`.

### Cookie del refresh token

```
Set-Cookie: refreshToken=<jwt>; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=<segundos>; Secure (solo en production)
```

- `HttpOnly`: inaccesible desde JavaScript
- `SameSite=Strict`: no se envía en requests cross-site (CSRF mitigation)
- `Path=/api/v1/auth`: la cookie solo se manda a endpoints de auth, no a toda la API
- `Secure`: solo en production (HTTPS); en development se omite para poder usar HTTP

**Requisito de despliegue**: frontend y backend deben compartir el mismo eTLD+1 (mismo dominio o subdominios del mismo dominio) para que `SameSite=Strict` funcione.

---

## RBAC (Control de acceso basado en roles)

| Rol | Alcance |
|-----|---------|
| `super_admin` | Acceso total al sistema; crea empresas y admins |
| `company` | Gestiona su propia empresa, técnicos, servicios y turnos; `companyPhone` en JWT identifica la empresa |
| `technician` | Solo ve sus propios datos y turnos asignados |

El JWT siempre incluye `companyPhone` para roles `company` y `technician`. Los controllers usan `payload.companyPhone ?? payload.phone` para verificar ownership antes de devolver o modificar datos (protección contra IDOR).

---

## Rate limiting

| Capa | Límite | Ventana | Alcance |
|------|--------|---------|---------|
| Global (IP) | 100 req (prod) / 100k (dev) | 15 min | Por IP |
| Auth endpoints | 20 req (prod) / 500 (dev) | 15 min | Por IP |
| Autenticado (user) | 300 req (prod) / 100k (dev) | 15 min | Por teléfono |
| Login brute-force | 5 intentos | 15 min | Por teléfono |

**Backend**: Redis cuando está disponible (`REDIS_URL`), in-memory como fallback.

**TRUST_PROXY**: por defecto `false`. Activar solo con `TRUST_PROXY=true` cuando haya un proxy confiable (Cloudflare, Nginx) que setee los headers de IP. Sin proxy, habilitarlo permite a clientes falsificar su IP y eludir el rate limit.

---

## Headers de seguridad

El backend agrega automáticamente via `hono/secure-headers`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security` (en production)
- `X-XSS-Protection: 1; mode=block`

El frontend (Next.js) agrega vía `next.config.mjs`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` (restrictivo, ajustar según necesidad)

---

## Variables de entorno críticas

| Variable | Entornos requeridos | Descripción |
|----------|--------------------|-|
| `JWT_SECRET` | dev, prod | Mínimo 64 caracteres aleatorios. La app falla en arranque si no está definida. |
| `DATABASE_URL` | dev, prod | PostgreSQL connection string |
| `SHUTDOWN_PASSWORD` | prod | Protege `POST /health/shutdown` |
| `METRICS_API_KEY` | prod | Protege `GET /metrics` |
| `TRUST_PROXY` | prod (si hay proxy) | Activar solo cuando el proxy esté confirmado |
| `CORS_ORIGINS` | prod | Lista explícita de orígenes del frontend |

Para generar un JWT_SECRET seguro:
```bash
openssl rand -hex 64
```

---

## Datos sensibles — qué nunca se expone

- `passwordHash`: excluido a nivel de query en `UserService.safeSelect`
- Stack traces: solo en logs del servidor, nunca en respuestas al cliente
- Tokens en respuestas: el refresh token ya no aparece en el body del login/refresh

---

## Validación de inputs

- Todos los bodies de request pasan por schemas Zod (`src/validation/schemas.ts`)
- Parámetros enteros de ruta validados con `parseIntParam()` (previene queries con NaN)
- Paths de log saneados contra `\r\n\t` (log injection)
- ORM con queries parametrizadas (Drizzle) — sin SQL injection posible

---

## CSRF

No se requieren tokens CSRF. La arquitectura ya es inmune:
1. Las requests autenticadas usan `Authorization: Bearer <token>` — los ataques CSRF no pueden setear headers customizados
2. El refresh token viaja como cookie `SameSite=Strict` — no se envía en requests cross-site
