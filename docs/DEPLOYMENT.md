# Procedimiento de despliegue — AutoServices Backend

## Checklist pre-deploy (producción)

### Variables de entorno obligatorias

```bash
# Generar JWT_SECRET (mínimo 64 chars)
openssl rand -hex 64

# Generar SHUTDOWN_PASSWORD
openssl rand -base64 32

# Generar METRICS_API_KEY
openssl rand -hex 32
```

Verificar que todas estas variables estén seteadas antes de iniciar:

```
DATABASE_URL=postgresql://...
JWT_SECRET=<64+ chars>
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
SHUTDOWN_PASSWORD=<random>
METRICS_API_KEY=<random>
CORS_ORIGINS=https://tu-dominio.com
NODE_ENV=production
TRUST_PROXY=true          # solo si hay Cloudflare/Nginx delante
REDIS_URL=redis://...     # opcional, mejora rate limiting distribuido
```

> La app falla en arranque (`process.exit(1)`) si `DATABASE_URL` o `JWT_SECRET` no están definidas,
> o si alguna variable requerida en producción está ausente.

---

## Requisitos de infraestructura

### Dominio

El frontend y el backend **deben compartir el mismo eTLD+1** para que el refresh token cookie funcione con `SameSite=Strict`.

| Correcto | Incorrecto |
|----------|-----------|
| `app.autoservices.com` (front) + `api.autoservices.com` (back) | `autoservices.vercel.app` (front) + `autoservices-api.railway.app` (back) |
| `autoservices.com` (front) + `api.autoservices.com` (back) | Cualquier combinación de dominios distintos |

Si frontend y backend quedan en dominios distintos, cambiar la cookie a `SameSite=None; Secure` y configurar CORS con el dominio exacto.

### HTTPS obligatorio

La cookie de refresh usa `Secure` en production — no funciona sobre HTTP.

### Proxy reverso (Nginx / Cloudflare)

Si hay proxy:
1. Setear `TRUST_PROXY=true`
2. Asegurarse de que el proxy **sobrescriba** los headers `CF-Connecting-IP` / `X-Forwarded-For` — si los clientes pueden setear estos headers directamente, pueden falsificar su IP y eludir el rate limiting

### WebSocket

El servidor WebSocket corre en `WS_PORT` (default: 3001). En producción, proxiar a través del proxy reverso en vez de exponer el puerto directamente.

Ejemplo Nginx:
```nginx
location /ws {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

---

## Procedimiento de deploy

```bash
# 1. Verificar variables de entorno
bun run type-check

# 2. Ejecutar migraciones (nunca db:push en producción)
bun run db:migrate

# 3. Iniciar en modo producción
NODE_ENV=production bun run index.ts
```

> Usar `db:migrate` en producción, no `db:push`. `db:push` ignora el journal de migraciones.

---

## Procedimiento de shutdown de emergencia

El endpoint `POST /health/shutdown` permite apagar el proceso en producción sin acceso SSH.

```bash
curl -X POST https://api.tu-dominio.com/health/shutdown \
  -H "Content-Type: application/json" \
  -d '{"user":"admin_shutdown","password":"<SHUTDOWN_PASSWORD>"}'
```

- Rate limitado: 5 intentos por IP cada 15 minutos
- Comparación de contraseña en tiempo constante (timing-safe)
- Cada intento queda logueado con IP y timestamp

---

## Rotación de secretos

### JWT_SECRET

Al cambiar `JWT_SECRET` **todos los tokens existentes se invalidan** (firmas dejan de verificar). Hacerlo en mantenimiento programado o con aviso a usuarios.

1. Generar nuevo secret: `openssl rand -hex 64`
2. Actualizar variable de entorno
3. Reiniciar proceso
4. Los usuarios deberán hacer login nuevamente

### Database password

1. Cambiar en Supabase/PostgreSQL
2. Actualizar `DATABASE_URL`
3. Reiniciar proceso (reconecta automáticamente en arranque)

### Refresh tokens activos

Para invalidar **todos** los refresh tokens sin cambiar el JWT_SECRET:
```sql
UPDATE sessions SET revoked_at = NOW() WHERE token_type = 'refresh' AND revoked_at IS NULL;
```

---

## Monitoreo

```bash
# Health check (sin autenticación)
GET /health

# Métricas (requiere METRICS_API_KEY en header X-API-Key)
GET /metrics

# Logs en ./logs/ (formato Winston JSON en producción)
```

---

## Checklist post-deploy

- [ ] `GET /health` responde `{ status: "OK" }`
- [ ] Login devuelve `{ user, token }` y setea cookie `refreshToken`
- [ ] Refresh funciona sin `refreshToken` en body (solo cookie)
- [ ] Logout borra la cookie
- [ ] Headers de seguridad presentes: `X-Content-Type-Options`, `X-Frame-Options`
- [ ] Rate limiting activo (verificar con 101 requests seguidas)
- [ ] Logs no exponen stack traces en respuestas al cliente
- [ ] `NODE_ENV=production` confirmado en logs de arranque
