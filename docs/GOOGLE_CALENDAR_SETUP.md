# Configuración de Google Calendar — Service Account

Esta guía explica cómo conectar AutoServices con Google Calendar para que las citas se creen, actualicen y eliminen automáticamente en tu calendario.

---

## Cómo funciona

- Al **crear** una cita con fecha y hora → se crea un evento en Google Calendar
- Al **editar** una cita → se actualiza el evento existente
- Al **eliminar** una cita → se elimina el evento
- El link del evento queda guardado en el campo `content` de la cita
- Se envían invitaciones por email al cliente, técnico y empresa si tienen email registrado

---

## Requisitos previos

- Cuenta de Google (la del calendario donde quieres los eventos)
- Acceso a [Google Cloud Console](https://console.cloud.google.com)

---

## Paso 1 — Crear el proyecto en Google Cloud

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Haz clic en el selector de proyectos (arriba a la izquierda) → **"New Project"**
3. Nombre: `AutoServices` (o el que prefieras)
4. Haz clic en **"Create"**
5. Asegúrate de que el proyecto nuevo quede seleccionado

---

## Paso 2 — Habilitar la API de Google Calendar

1. En el menú izquierdo ve a **APIs & Services → Library**
2. Busca **"Google Calendar API"**
3. Haz clic en el resultado → **"Enable"**

---

## Paso 3 — Crear la Service Account

1. Ve a **APIs & Services → Credentials**
2. Haz clic en **"+ Create Credentials" → "Service Account"**
3. Rellena los campos:
   - **Service account name:** `autoservices-calendar`
   - **Service account ID:** se llena solo
4. Haz clic en **"Create and Continue"**
5. En "Grant this service account access to project" → déjalo vacío → **"Continue"**
6. En "Grant users access to this service account" → déjalo vacío → **"Done"**

---

## Paso 4 — Descargar la clave JSON

1. En la lista de Service Accounts, haz clic en el email de la cuenta recién creada
   (algo como `autoservices-calendar@tu-proyecto.iam.gserviceaccount.com`)
2. Ve a la pestaña **"Keys"**
3. Haz clic en **"Add Key" → "Create new key"**
4. Selecciona **JSON** → **"Create"**
5. Se descarga automáticamente un archivo `.json` — guárdalo en un lugar seguro

El archivo tiene esta estructura:
```json
{
  "type": "service_account",
  "project_id": "tu-proyecto",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "autoservices-calendar@tu-proyecto.iam.gserviceaccount.com",
  ...
}
```

---

## Paso 5 — Compartir el calendario con la Service Account

1. Ve a [calendar.google.com](https://calendar.google.com)
2. En la barra izquierda, busca el calendario donde quieres los eventos
3. Haz clic en los **tres puntos** al lado del calendario → **"Settings and sharing"**
4. Baja hasta la sección **"Share with specific people or groups"**
5. Haz clic en **"+ Add people and groups"**
6. Ingresa el `client_email` del archivo JSON (ej. `autoservices-calendar@tu-proyecto.iam.gserviceaccount.com`)
7. En permisos selecciona **"Make changes to events"**
8. Haz clic en **"Send"**

> Sin este paso el backend no podrá crear eventos — obtendrás un error 403.

---

## Paso 6 — Configurar las variables de entorno

Abre el archivo `.env` del backend y agrega:

```env
# Google Calendar (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=autoservices-calendar@tu-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=tu@gmail.com
GOOGLE_CALENDAR_TIMEZONE=America/Mexico_City
```

**Dónde encontrar cada valor en el JSON descargado:**

| Variable | Campo en el JSON |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` |
| `GOOGLE_PRIVATE_KEY` | `private_key` |
| `GOOGLE_CALENDAR_ID` | Email de tu cuenta de Google (no está en el JSON) |
| `GOOGLE_CALENDAR_TIMEZONE` | Tu zona horaria local |

> **Importante:** El `GOOGLE_PRIVATE_KEY` debe ir entre comillas dobles en el `.env` para preservar los saltos de línea (`\n`).

**Zonas horarias comunes:**
- México: `America/Mexico_City`
- Colombia: `America/Bogota`
- Argentina: `America/Argentina/Buenos_Aires`
- Perú: `America/Lima`
- Chile: `America/Santiago`

---

## Paso 7 — Reiniciar el backend

```bash
bun run dev
```

---

## Verificación

Crea una cita con fecha, hora y email de cliente desde la app. Deberías ver:
- El evento aparecer en tu Google Calendar
- Un email de invitación llegar al cliente y técnico (si tienen email registrado)
- El link del evento guardado en el campo `content` de la cita

---

## Desactivar la integración

Si quieres desactivar temporalmente sin borrar las credenciales, deja `GOOGLE_SERVICE_ACCOUNT_EMAIL` vacío:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=
```

El backend seguirá funcionando normalmente, solo omitirá la sincronización con el calendario.
