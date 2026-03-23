# 🔧 Código Fuente (Source Code)

Esta carpeta contiene todo el código fuente del backend de AutoServices.

## 📁 Estructura del Proyecto

```
src/
├── config/           # Configuración de la aplicación
├── controllers/      # Controladores de la API (lógica de negocio)
├── db/              # Configuración y esquemas de base de datos
├── middleware/      # Middlewares personalizados
├── routes/          # Definición de rutas de la API
├── services/        # Servicios de negocio
├── utils/           # Utilidades y helpers
├── validation/      # Esquemas de validación con Zod
└── seed.ts          # Datos de prueba (seed)
```

## 📋 Descripción de Carpetas

### [config/](config/)
Configuración centralizada de la aplicación:
- Variables de entorno
- Configuración de base de datos
- Configuración de logging
- Configuración de seguridad

### [controllers/](controllers/)
Controladores que manejan las peticiones HTTP:
- Lógica de negocio por entidad
- Manejo de respuestas HTTP
- Control de acceso basado en roles
- Validación de datos de entrada

### [db/](db/)
Todo lo relacionado con la base de datos:
- Esquemas de tablas (Drizzle ORM)
- Conexión a PostgreSQL
- Migraciones de base de datos
- Consultas y operaciones CRUD

### [middleware/](middleware/)
Middlewares personalizados para Hono:
- Autenticación JWT
- Validación de requests
- Rate limiting
- Logging de requests
- CORS
- Seguridad

### [routes/](routes/)
Definición de endpoints de la API:
- Rutas públicas (autenticación)
- Rutas protegidas con middleware
- Documentación OpenAPI/Swagger
- Validación de parámetros

### [services/](services/)
Capa de servicios de negocio:
- Lógica de dominio
- Operaciones complejas
- Integración con externos
- Reglas de negocio

### [utils/](utils/)
Utilidades y helpers:
- Paginación
- Logging con Winston
- Helpers de fechas
- Funciones comunes

### [validation/](validation/)
Esquemas de validación con Zod:
- Validación de requests
- Validación de responses
- Esquemas por entidad
- Reglas de validación

## 🚀 Punto de Entrada

El archivo principal es `../index.ts` en la raíz del proyecto, que:
- Configura el servidor Hono
- Monta todos los middlewares
- Define las rutas principales
- Inicia el servidor

## 🔄 Flujo de una Request

1. **Request** → `routes/` (definición de endpoint)
2. **Validación** → `middleware/` + `validation/`
3. **Controlador** → `controllers/` (lógica de negocio)
4. **Servicio** → `services/` (operaciones de negocio)
5. **Base de datos** → `db/` (consultas con Drizzle)
6. **Response** ← Respuesta formateada

## 🧪 Testing

Los tests están en la carpeta `../tests/` y cubren:
- Endpoints de la API
- Validaciones
- Servicios
- Utilidades

## 🔗 Enlaces Rápidos

- [🏠 Volver al README principal](../README.md)
- [🧪 Tests](../tests/)
- [📚 Documentación](../docs/)