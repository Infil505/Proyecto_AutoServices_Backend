# Stress Tests — AutoServices

## Instalación de k6

**Windows (PowerShell):**
```powershell
winget install k6 --source winget
```

**Linux (servidor de producción):**
```bash
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

---

## Cómo correr los tests

Desde la raíz del backend (`Proyecto_AutoServices_Backend/`):

```bash
# 1. Smoke — 1 usuario, 1 minuto. Solo verifica que todo responde.
k6 run --env SCENARIO=smoke \
       --env ADMIN_PHONE=+521234567890 \
       --env ADMIN_PASSWORD=tupassword \
       --env COMPANY_PHONE=+529876543210 \
       --env COMPANY_PASSWORD=tupassword \
       tests/stress/stress-test.js

# 2. Load — sube a 50 usuarios en 5 minutos. Carga normal de producción.
k6 run --env SCENARIO=load ...

# 3. Stress — sube hasta 200 usuarios. Encuentra el punto de quiebre.
k6 run --env SCENARIO=stress ...

# 4. Spike — golpe repentino de 100 usuarios.
k6 run --env SCENARIO=spike ...

# Contra servidor de producción:
k6 run --env BASE_URL=https://api.tudominio.com \
       --env SCENARIO=load \
       ...
```

---

## Qué mide cada escenario

| Escenario | VUs máx | Duración | Objetivo |
|-----------|---------|----------|----------|
| smoke     | 1       | 1 min    | Todo funciona |
| load      | 50      | 5 min    | p95 < 2s, errores < 1% |
| stress    | 200     | 9 min    | Encontrar límite |
| spike     | 100     | ~4 min   | Recuperación tras pico |

---

## Estimación para 1 vCPU / 512 MB RAM

| Capa | Cuello de botella | Estimación |
|------|-------------------|------------|
| Bun + Hono | CPU (1 vCPU) | ~2,000-5,000 req/s simples |
| Cache en memoria | RAM (512MB) | Bun usa ~80-120MB; cache ~20MB → holgado |
| Pool Supabase | 20 conexiones | ~60-80 usuarios simultáneos antes de espera |
| Supabase free tier | Latencia red (~300ms) | Factor limitante principal |

**Conclusión práctica:** Con el cache actual, el sistema aguantará bien **50-80 usuarios simultáneos** antes de que Supabase sea el cuello de botella. Con Supabase Pro (más conexiones + menor latencia), puede escalar a 200+.

---

## Métricas clave a observar

```
http_req_duration   → tiempo de respuesta (objetivo: p95 < 2s)
error_rate          → % de errores       (objetivo: < 1%)
stats_duration      → tiempo de /stats   (debe ser < 500ms con cache)
dashboard_load      → carga completa     (objetivo: < 3s)
cache_hit_rate      → % respuestas < 50ms (más alto = mejor)
db_errors           → errores 500 (indica pool agotado o DB caída)
```

---

## Señales de que alcanzaste el límite

- `error_rate` sube sobre 1%
- `http_req_duration p95` cruza los 2 segundos
- `db_errors` empieza a contar
- En los logs del backend: `request timed out` o errores de pool

Cuando veas eso, anota cuántos VUs había en ese momento — ese es tu límite real.
