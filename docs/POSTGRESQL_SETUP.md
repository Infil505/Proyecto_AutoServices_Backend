# Guía de Configuración de PostgreSQL para AutoServices Backend

## 📋 Requisitos Previos

Antes de ejecutar el proyecto, necesitas tener PostgreSQL instalado y configurado.

## 🛠️ Instalación de PostgreSQL

### Opción 1: PostgreSQL Nativo (Recomendado)

1. **Descarga PostgreSQL**:
   - Visita: https://www.postgresql.org/download/windows/
   - Descarga la versión más reciente
   - Instala con las opciones por defecto

2. **Durante la instalación**:
   - Establece una contraseña para el usuario `postgres`
   - Recuerda el puerto (por defecto: 5432)
   - Instala pgAdmin si lo deseas (herramienta gráfica)

### Opción 2: Usar Supabase (Más fácil para desarrollo)

Si prefieres usar Supabase (recomendado para desarrollo rápido):

1. **Crear cuenta en Supabase**:
   - Visita: https://supabase.com
   - Crea una cuenta gratuita

2. **Crear un nuevo proyecto**:
   - Haz clic en "New Project"
   - Elige un nombre (ej: "autoservices-dev")
   - Establece una contraseña segura
   - Selecciona la región más cercana

3. **Obtener las credenciales**:
   - Ve a Settings → Database
   - Copia la "Connection string" (debe incluir la contraseña)

## ⚙️ Configuración del Archivo .env

### Para PostgreSQL Local

Edita el archivo `.env` con tus credenciales locales:

```bash
# Base de datos local
DATABASE_URL=postgresql://postgres:TU_CONTRASEÑA_AQUI@localhost:5432/autoservices_db

# JWT Secret (genera uno seguro)
JWT_SECRET=tu_clave_jwt_muy_segura_de_al_menos_32_caracteres
```

### Para Supabase

Edita el archivo `.env` con tus credenciales de Supabase:

```bash
# Supabase Database Connection
DATABASE_URL=postgresql://postgres:[TU_CONTRASEÑA]@[TU_HOST]:5432/postgres

# JWT Secret (genera uno seguro)
JWT_SECRET=tu_clave_jwt_muy_segura_de_al_menos_32_caracteres
```

## 🗄️ Crear la Base de Datos

### Para PostgreSQL Local

1. **Abrir pgAdmin** (viene con PostgreSQL) o **psql**:

2. **Conectar como superusuario**:
   ```sql
   -- Crear la base de datos
   CREATE DATABASE autoservices_db;

   -- Crear usuario (opcional, pero recomendado)
   CREATE USER autoservices_user WITH PASSWORD 'tu_password_seguro';

   -- Dar permisos
   GRANT ALL PRIVILEGES ON DATABASE autoservices_db TO autoservices_user;
   ```

3. **Verificar conexión**:
   ```bash
   # Probar conexión
   psql -h localhost -U postgres -d autoservices_db
   ```

### Para Supabase

La base de datos ya está creada automáticamente. Solo necesitas configurar el `DATABASE_URL` en el archivo `.env`.

## 🔧 Comandos Útiles de PostgreSQL

### Ver todas las bases de datos
```sql
\l
```

### Conectar a una base de datos
```sql
\c nombre_base_datos
```

### Ver todas las tablas
```sql
\dt
```

### Ver estructura de una tabla
```sql
\d nombre_tabla
```

### Ejecutar comandos desde archivo
```bash
psql -h localhost -U postgres -d autoservices_db -f archivo.sql
```

## 🚀 Probar la Configuración

Una vez configurado todo, ejecuta:

```bash
# Ejecutar migraciones
bun run db:migrate

# Si funciona sin errores, la configuración es correcta
```

## 🔍 Solución de Problemas

### Error: "password authentication failed"
- Verifica que la contraseña en `DATABASE_URL` sea correcta
- Asegúrate de que PostgreSQL esté ejecutándose

### Error: "could not connect to server"
- Verifica que PostgreSQL esté ejecutándose
- Comprueba que el puerto (5432) no esté bloqueado
- Para Supabase, verifica que la URL sea correcta

### Error: "database does not exist"
- Crea la base de datos como se indica arriba
- Para Supabase, la base de datos `postgres` ya existe por defecto

### Error: "permission denied"
- Asegúrate de que el usuario tenga permisos en la base de datos
- Para Supabase, usa las credenciales del proyecto

## 📊 Verificar Estado

Para verificar que todo funciona:

1. **Health Check**: `GET http://localhost:3000/health`
2. **Swagger Docs**: `http://localhost:3000/docs`
3. **Test de autenticación**: Regístrate y haz login

¡Tu base de datos está lista para AutoServices Backend!