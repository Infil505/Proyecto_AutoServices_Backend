# AutoServices Backend API

> Backend API completo para el sistema de automatización de servicios de atención al cliente

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-000?logo=bun&logoColor=white)](https://bun.sh/)
[![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)

Una API REST completa construida con tecnologías modernas, diseñada para ser escalable, segura y fácil de integrar con cualquier frontend.

## Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Inicio Rápido](#inicio-rápido)
- [API Endpoints](#api-endpoints)
- [Sistema de Roles](#sistema-de-roles)
- [Desarrollo](#desarrollo)
- [Testing](#testing)
- [Documentación](#documentación)
- [Integración Frontend](#integración-frontend)
- [Despliegue](#despliegue)
- [Contribución](#contribución)

## Características

- **Autenticación JWT** con refresh tokens
- **Control de Acceso Basado en Roles** (Super Admin, Company, Technician)
- **Base de Datos PostgreSQL** con Drizzle ORM
- **Validación Robusta** con Zod schemas
- **Documentación Automática** con OpenAPI/Swagger
- **Seguridad Avanzada** (CORS, Rate Limiting, Helmet)
- **Logging Estructurado** con Winston
- **Paginación** en todos los endpoints
- **Tests Completos** con Vitest
- **CI/CD** con GitHub Actions
- **Frontend Integration** con ejemplos para múltiples frameworks

## Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  AutoServices   │    │   Database      │
│   (React/Vue/   │◄──►│     API         │◄──►│  PostgreSQL     │
│    Angular)     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   External      │
                       │   Services      │
                       └─────────────────┘
```

### Tecnologías Principales

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [Hono](https://hono.dev/)
- **ORM**: [Drizzle](https://orm.drizzle.team/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Auth**: JWT con [@hono/jwt](https://github.com/honojs/jwt)
- **Validation**: [Zod](https://zod.dev/)
- **Testing**: [Vitest](https://vitest.dev/)

## Estructura del Proyecto

```
autoservices-backend/
├── docs/                      # Documentación
│   ├── FRONTEND_INTEGRATION_GUIDE.md
│   ├── POSTGRESQL_SETUP.md
│   └── README.md
├── examples/                  # Ejemplos de integración
│   └── frontend/
│       ├── frontend-api-client.js
│       ├── frontend-demo.html
│       ├── react-hooks.js
│       └── react-example.jsx
├── src/                       # Código fuente
│   ├── config/                # Configuración
│   ├── controllers/           # Controladores API
│   ├── db/                    # Base de datos
│   ├── middleware/            # Middlewares
│   ├── routes/                # Definición de rutas
│   ├── services/              # Servicios de negocio
│   ├── utils/                 # Utilidades
│   ├── validation/            # Esquemas de validación
│   └── seed.ts                # Datos de prueba
├── tests/                     # Tests
├── tools/                     # Herramientas de desarrollo
│   ├── setup.bat              # Setup automático
│   ├── start.bat              # Inicio rápido
│   ├── backup.sh              # Backup BD
│   └── restore.sh             # Restore BD
├── .github/                   # CI/CD
├── .env.example               # Variables de entorno
├── index.ts                   # Punto de entrada
├── package.json               # Dependencias
└── README.md                  # Este archivo
```

## Inicio Rápido

### Opción Express (Recomendada)

1. **Instala Bun**:
   ```bash
   # Windows (PowerShell como administrador)
   powershell -Command "irm bun.sh/install.ps1 | iex"
   ```

2. **Setup automático**:
   ```bash
   # Ejecuta el setup completo
   tools/setup.bat
   ```

3. **Inicia el servidor**:
   ```bash
   # Inicio rápido
   tools/start.bat
   ```

### Opción Manual

1. **Instalar dependencias**:
   ```bash
   bun install
   ```

2. **Configurar entorno**:
   ```bash
   cp .env.example .env
   # Edita .env con tus credenciales
   ```

3. **Configurar base de datos**:
   ```bash
   # Ver guía completa en docs/POSTGRESQL_SETUP.md
   bun run db:migrate
   bun run db:seed  # Opcional: datos de prueba
   ```

4. **Iniciar desarrollo**:
   ```bash
   bun run dev
   ```

### Verificar Instalación

- **API**: `http://localhost:3000`
- **Documentación**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/health`

## API Endpoints

### Públicos (Sin Autenticación)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Registro de usuarios |
| `POST` | `/api/auth/login` | Inicio de sesión |
| `GET` | `/health` | Health check |

### Protegidos (Requieren JWT)

#### Usuarios
| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/users` | Listar usuarios | super_admin |
| `GET` | `/api/users/:id` | Obtener usuario | Según rol |
| `POST` | `/api/users` | Crear usuario | super_admin |
| `PUT` | `/api/users/:id` | Actualizar usuario | Según rol |
| `DELETE` | `/api/users/:id` | Eliminar usuario | Según rol |

#### Compañías
| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/companies` | Listar compañías | company, super_admin |
| `GET` | `/api/companies/:phone` | Obtener compañía | Según rol |
| `POST` | `/api/companies` | Crear compañía | super_admin |
| `PUT` | `/api/companies/:phone` | Actualizar compañía | Según rol |
| `DELETE` | `/api/companies/:phone` | Eliminar compañía | Según rol |

#### Técnicos
| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/technicians` | Listar técnicos | company, super_admin |
| `GET` | `/api/technicians/:phone` | Obtener técnico | Según rol |
| `POST` | `/api/technicians` | Crear técnico | company, super_admin |
| `PUT` | `/api/technicians/:phone` | Actualizar técnico | Según rol |
| `DELETE` | `/api/technicians/:phone` | Eliminar técnico | Según rol |

#### Clientes, Servicios, Citas, Zonas
*Endpoints similares con control de acceso basado en roles*

## Sistema de Roles

### Super Admin
- **Control total** del sistema
- Gestiona **todas las compañías, técnicos y usuarios**
- Acceso completo a **todas las operaciones CRUD**

### Company (Compañía)
- Gestiona **su propia compañía**
- Administra **sus técnicos, servicios y citas**
- Acceso limitado a **recursos asociados**

### Technician (Técnico)
- Acceso a **sus propios datos**
- Ve **citas asignadas y servicios de su compañía**
- Modifica **solo sus propios datos**

## Desarrollo

### Comandos Disponibles

```bash
# Desarrollo
bun run dev              # Servidor de desarrollo
bun run build           # Build de producción
bun run start           # Servidor de producción

# Base de datos
bun run db:generate     # Generar migraciones
bun run db:migrate      # Ejecutar migraciones
bun run db:push         # Push schema a BD
bun run db:seed         # Ejecutar seeder

# Calidad de código
bun run lint            # Ejecutar ESLint
bun run lint:fix        # Corregir ESLint
bun run type-check      # Verificar tipos TypeScript

# Testing
bun run test            # Ejecutar tests
bun run test:watch      # Tests en modo watch
```

### Configuración de Desarrollo

1. **Editor**: VS Code recomendado
2. **Extensiones**:
   - TypeScript and JavaScript Language Features
   - ESLint
   - Prettier
   - Thunder Client (para testing de API)

## Testing

```bash
# Ejecutar todos los tests
bun run test

# Tests con coverage
bun run test --coverage

# Tests en modo watch
bun run test:watch
```

### Estructura de Tests
- **Unit Tests**: Funciones individuales
- **Integration Tests**: Endpoints de API
- **E2E Tests**: Flujos completos

## Documentación

### Guías Disponibles

- **[Guía de Integración Frontend](docs/FRONTEND_INTEGRATION_GUIDE.md)**
  - Ejemplos para React, Vue.js, Angular
  - Cliente JavaScript completo
  - Manejo de autenticación

- **[Configuración PostgreSQL](docs/POSTGRESQL_SETUP.md)**
  - Instalación y configuración
  - Uso con Supabase
  - Solución de problemas

### Documentación API

- **Swagger UI**: `http://localhost:3000/docs`
- **OpenAPI Spec**: `http://localhost:3000/docs/json`
- **Health Check**: `GET /health`

## Integración Frontend

### Ejemplos Disponibles

La carpeta [`examples/frontend/`](examples/frontend/) contiene:

- **`frontend-api-client.js`** - Cliente JavaScript completo
- **`react-hooks.js`** - Hooks personalizados para React
- **`react-example.jsx`** - Componente React con autenticación
- **`frontend-demo.html`** - Demo interactiva en HTML/JS

### Inicio Rápido con Frontend

```javascript
import AutoServicesAPI from './examples/frontend/frontend-api-client.js';

const api = new AutoServicesAPI();

// Login
const user = await api.login({ email, password });

// Obtener datos
const companies = await api.getCompanies();
```

### Frameworks Soportados

- React (Hooks personalizados)
- Vue.js (Composition API)
- Angular (Services)
- Vanilla JavaScript
- React Native
- Flutter

## Despliegue

### Producción

1. **Variables de entorno**:
   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://...
   JWT_SECRET=tu_clave_segura
   ```

2. **Build y start**:
   ```bash
   bun run build
   bun run start
   ```

### Docker (Opcional)

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
EXPOSE 3000
CMD ["bun", "run", "start"]
```

### Servicios en la Nube

- **Database**: Supabase, Neon, Railway
- **Hosting**: Railway, Render, Fly.io
- **CI/CD**: GitHub Actions, Vercel

## Contribución

1. **Fork** el proyecto
2. **Crea** una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. **Push** a la rama (`git push origin feature/AmazingFeature`)
5. **Abre** un Pull Request

### Estándares de Código

- **TypeScript** estricto
- **ESLint** configurado
- **Prettier** para formato
- **Tests** obligatorios
- **Documentación** actualizada

**[Guía completa de contribución](CONTRIBUTING.md)**

## Changelog

**[Ver todas las versiones](CHANGELOG.md)**

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Soporte

- **Email**: [tu-email@ejemplo.com]
- **Issues**: [GitHub Issues](https://github.com/Infil505/Proyecto_AutoServices_Backend/issues)
- **Discusiones**: [GitHub Discussions](https://github.com/Infil505/Proyecto_AutoServices_Backend/discussions)

---

<div align="center">

**Si te gusta este proyecto, dale una estrella en GitHub!**

[Inicio Rápido](#inicio-rápido) • [Documentación](docs/) • [Ejemplos](examples/) • [Herramientas](tools/)

</div>


