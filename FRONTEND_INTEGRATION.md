# 🚀 AutoServices Backend - Guía Completa para Frontend

## 📋 Índice
1. [Descripción General](#descripción-general)
2. [Autenticación](#autenticación)
3. [Modelos de Datos](#modelos-de-datos)
4. [Control de Acceso (Roles)](#control-de-acceso-roles)
5. [Endpoints por Recurso](#endpoints-por-recurso)
6. [Flujos de Usar](#flujos-de-uso)
7. [Ejemplos de Integración](#ejemplos-de-integración)

---

## 📱 Descripción General

### URL Base
```
http://localhost:3000
```

### Tecnología
- **Framework:** Hono 4.12.5
- **Runtime:** Bun 1.3.10 o Node.js
- **Base de Datos:** PostgreSQL (Supabase)
- **Autenticación:** JWT (HMAC-SHA256)

### Características
- ✅ Autenticación con JWT
- ✅ Control de acceso basado en roles (RBAC)
- ✅ CORS habilitado para desarrollo
- ✅ Validación de datos con Zod
- ✅ Paginación incluida
- ✅ Compresión de respuestas

---

## 🔐 Autenticación

### 1. Registro de Usuario

**Endpoint:** `POST /api/auth/register`

**No requiere autenticación**

**Request Body:**
```json
{
  "phone": "+1234567890",
  "password": "secure_password_8chars_min",
  "name": "John Doe",
  "type": "technician|company|super_admin",
  "email": "john@example.com"  // opcional
}
```

**Validaciones:**
- `phone`: 10-15 caracteres, formato internacional (+1234567890)
- `password`: mínimo 8 caracteres
- `name`: 2-100 caracteres
- `type`: uno de: `technician`, `company`, `super_admin`
- `email`: formato de email válido (opcional)

**Respuesta (201 Created):**
```json
{
  "user": {
    "id": 1,
    "phone": "+1234567890",
    "name": "John Doe",
    "type": "technician",
    "email": "john@example.com",
    "createdAt": "2026-03-07T10:30:00Z"
  }
}
```

**Errores:**
```json
{
  "error": "User already exists or invalid data"
}
```

---

### 2. Login

**Endpoint:** `POST /api/auth/login`

**No requiere autenticación**

**Request Body:**
```json
{
  "phone": "+1234567890",
  "password": "secure_password_8chars_min"
}
```

**Respuesta (200 OK):**
```json
{
  "user": {
    "id": 1,
    "phone": "+1234567890",
    "name": "John Doe",
    "type": "technician"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidHlwZSI6InRlY2huaWNpYW4iLCJwaG9uZSI6IisxMjM0NTY3ODkwIiwiaWF0IjoxNzQwMDAwMDAwLCJleHAiOjE3NDA2MDAwMDB9.signature"
}
```

**Errores:**
```json
{
  "error": "Invalid credentials"
}
```

---

### 3. Token JWT

**Estructura del JWT:**
```
Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "id": 1,
  "type": "technician|company|super_admin",
  "phone": "+1234567890",
  "iat": 1740000000,
  "exp": 1740600000
}

Signature: HMAC-SHA256
```

**Duración:** 7 días (604,800 segundos)

**Cómo usar el token:**
```javascript
// Guardar después del login
const { token } = loginResponse;
localStorage.setItem('authToken', token);

// Usar en requests
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

fetch('/api/appointments', { headers });
```

**Manejo de token expirado:**
```javascript
// Si recibe 401 Unauthorized
if (response.status === 401) {
  // Redirigir a login
  localStorage.removeItem('authToken');
  window.location.href = '/login';
}
```

---

## 📊 Modelos de Datos

### User (Usuario)
```typescript
{
  id: number,                    // Auto-generado
  type: string,                  // 'technician' | 'company' | 'super_admin'
  phone: string,                 // Formato: +1234567890
  name: string,                  // Nombre del usuario
  email?: string,                // Email (opcional)
  createdAt: ISO8601DateTime     // Fecha de creación
}
```

### Company (Empresa)
```typescript
{
  phone: string,                 // PK - Formato: +1234567890
  name: string,                  // Nombre de la empresa
  email?: string,                // Email de contacto
  address?: string,              // Dirección
  startHour?: string,            // Hora inicio (HH:MM)
  endHour?: string,              // Hora fin (HH:MM)
  createdAt: ISO8601DateTime     // Fecha de creación
}
```

### Technician (Técnico)
```typescript
{
  phone: string,                 // PK - Formato: +1234567890
  companyPhone: string,          // FK - Teléfono de empresa
  name: string,                  // Nombre completo
  email?: string,                // Email de contacto
  specialty?: string,            // Especialidad (HVAC, Plomería, etc.)
  available: boolean,            // Estados: true/false
  createdAt: ISO8601DateTime     // Fecha de creación
}
```

### Customer (Cliente)
```typescript
{
  phone: string,                 // PK - Formato: +1234567890
  name?: string,                 // Nombre del cliente
  email?: string,                // Email
  state?: string,                // Estado/Provincia
  city?: string,                 // Ciudad
  address?: string,              // Dirección
  createdAt: ISO8601DateTime     // Fecha de creación
}
```

### Service (Servicio)
```typescript
{
  id: number,                    // PK - Auto-generado
  companyPhone: string,          // FK - Teléfono de empresa
  name: string,                  // Nombre del servicio
  description?: string,          // Descripción detallada
  category?: string,             // Categoría (Eléctrico, Fontanería, etc.)
  estimatedDurationMinutes: number, // Duración en minutos (1-1440)
  active: boolean,               // Si está disponible
  createdAt: ISO8601DateTime     // Fecha de creación
}
```

### Appointment (Cita)
```typescript
{
  id: number,                    // PK - Auto-generado
  customerPhone?: string,        // FK - Teléfono del cliente
  companyPhone: string,          // FK - Teléfono de empresa
  technicianPhone?: string,      // FK - Teléfono del técnico
  serviceId: number,             // FK - ID del servicio
  appointmentDate: date,         // Fecha de la cita (YYYY-MM-DD)
  startTime?: string,            // Hora inicio (HH:MM:SS)
  status: string,                // 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  content?: string,              // Notas adicionales
  coordinates?: GeoJSON,         // Ubicación (lat, lon)
  createdAt: ISO8601DateTime     // Fecha de creación
}
```

### CoverageZone (Zona de Cobertura)
```typescript
{
  id: number,                    // PK - Auto-generado
  companyPhone: string,          // FK - Teléfono de empresa
  state: string,                 // Estado/Provincia
  city: string,                  // Ciudad
  zoneName?: string,             // Nombre de la zona
  postalCode?: string,           // Código postal
  coordinates?: GeoJSON,         // Límites de la zona (geopolígono)
  notes?: string,                // Notas adicionales
  createdAt: ISO8601DateTime     // Fecha de creación
}
```

---

## 👥 Control de Acceso (Roles)

### Tipos de Usuario
1. **technician** - Técnico de servicio
2. **company** - Empresa/Ger   ente de servicios
3. **super_admin** - Administrador del sistema

### Matriz de Permisos

| Recurso | GET | POST | PUT | DELETE | Notas |
|---------|-----|------|-----|--------|-------|
| **Auth** | 🟡 | 🟢 | ❌ | ❌ | Por todos (sin token) |
| **Appointments** | 🟡 | 🟡 | 🟡 | 🟡 | Técnicos ven sus citas, empresas las suyas, admins todas |
| **Companies** | 🟡 | 🔴 | 🟡 | 🟡 | Solo super_admin crea, empresa actualiza la suya |
| **Customers** | 🔴 | 🟡 | 🟡 | 🟡 | Técnicos no pueden acceder |
| **Services** | 🟢 | 🟡 | 🟡 | 🟡 | Todos leen, solo empresa crea sus servicios |
| **Technicians** | 🟡 | 🟡 | 🟡 | 🟡 | Empresa ve sus técnicos, admin todos |
| **CoverageZones** | 🟡 | 🟡 | 🟡 | 🟡 | Empresa ve sus zonas, admin todas |
| **Users** | 🔴 | 🔴 | 🔴 | 🔴 | Solo super_admin |

**Leyenda:**
- 🟢 Todos
- 🟡 Con restricciones (depende del rol)
- 🔴 Solo super_admin
- ❌ No disponible

---

## 🔄 Endpoints por Recurso

### Health Check (Sin Autenticación)
```
GET /health
```
Respuesta: `{ status: 'OK', timestamp: '...' }`

---

### Autenticación

#### Register
```
POST /api/auth/register
```

#### Login
```
POST /api/auth/login
```

---

### Appointments (Citas)

#### Listar Citas
```
GET /api/appointments
```

**Comportamiento por rol:**
- **technician**: Ve solo sus citas asignadas
- **company**: Ve citas de su empresa
- **super_admin**: Ve todas las citas

**Respuesta:**
```json
[
  {
    "id": 1,
    "customerPhone": "+1234567890",
    "companyPhone": "+1111111111",
    "technicianPhone": "+0987654321",
    "serviceId": 1,
    "appointmentDate": "2026-03-15",
    "startTime": "14:00:00",
    "status": "pending",
    "content": "Notas de la cita",
    "coordinates": { "lat": 40.7128, "lon": -74.0060 },
    "createdAt": "2026-03-07T10:30:00Z"
  }
]
```

#### Obtener Cita por ID
```
GET /api/appointments/:id
```

#### Crear Cita
```
POST /api/appointments
```

**Request:**
```json
{
  "customerPhone": "+1234567890",
  "companyPhone": "+1111111111",
  "technicianPhone": "+0987654321",
  "serviceId": 1,
  "appointmentDate": "2026-03-15",
  "startTime": "14:00:00",
  "status": "pending",
  "content": "Check AC unit"
}
```

**Restricción:** Solo company y super_admin

#### Actualizar Cita
```
PUT /api/appointments/:id
```

**Campos actualizables:**
- appointmentDate
- startTime
- status
- content
- technicianPhone

#### Eliminar Cita
```
DELETE /api/appointments/:id
```

---

### Companies (Empresas)

#### Listar Empresas
```
GET /api/companies
```

**Comportamiento:**
- **technician**: Error 403 (Unauthorized)
- **company**: Ve solo su empresa
- **super_admin**: Ve todas

#### Obtener Empresa por Teléfono
```
GET /api/companies/:phone
```

#### Crear Empresa
```
POST /api/companies
```

**Request:**
```json
{
  "phone": "+1234567890",
  "name": "ACME Services",
  "email": "contact@acme.com",
  "address": "123 Main St",
  "startHour": "08:00",
  "endHour": "17:00"
}
```

**Restricción:** Solo super_admin

#### Actualizar Empresa
```
PUT /api/companies/:phone
```

**Restricción:** Empresa actualiza su propia info, super_admin cualquiera

#### Eliminar Empresa
```
DELETE /api/companies/:phone
```

---

### Customers (Clientes)

#### Listar Clientes
```
GET /api/customers
```

**Restricción:** Técnicos no pueden ver

#### Obtener Cliente por Teléfono
```
GET /api/customers/:phone
```

#### Crear Cliente
```
POST /api/customers
```

**Request:**
```json
{
  "phone": "+1234567890",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "state": "New York",
  "city": "New York",
  "address": "456 Oak Ave"
}
```

#### Actualizar Cliente
```
PUT /api/customers/:phone
```

#### Eliminar Cliente
```
DELETE /api/customers/:phone
```

---

### Services (Servicios)

#### Listar Servicios
```
GET /api/services
```

**Respuesta:**
```json
[
  {
    "id": 1,
    "companyPhone": "+1234567890",
    "name": "Air Conditioning Repair",
    "description": "Full AC system maintenance and repair",
    "category": "HVAC",
    "estimatedDurationMinutes": 120,
    "active": true,
    "createdAt": "2026-03-01T08:00:00Z"
  }
]
```

#### Obtener Servicio por ID
```
GET /api/services/:id
```

#### Crear Servicio
```
POST /api/services
```

**Request:**
```json
{
  "companyPhone": "+1234567890",
  "name": "Plumbing Repair",
  "description": "Water pipe and fixture repairs",
  "category": "Plumbing",
  "estimatedDurationMinutes": 90
}
```

#### Actualizar Servicio
```
PUT /api/services/:id
```

#### Eliminar Servicio
```
DELETE /api/services/:id
```

---

### Technicians (Técnicos)

#### Listar Técnicos
```
GET /api/technicians
```

**Comportamiento:**
- **technician**: Ve solo su propio perfil
- **company**: Ve técnicos de su empresa
- **super_admin**: Ve todos

#### Obtener Técnico por Teléfono
```
GET /api/technicians/:phone
```

#### Crear Técnico
```
POST /api/technicians
```

**Request:**
```json
{
  "phone": "+0987654321",
  "companyPhone": "+1234567890",
  "name": "Jane Smith",
  "email": "jane@company.com",
  "specialty": "HVAC",
  "available": true
}
```

#### Actualizar Técnico
```
PUT /api/technicians/:phone
```

**Campos:**
- name
- email
- specialty
- available

#### Eliminar Técnico
```
DELETE /api/technicians/:phone
```

---

### Coverage Zones (Zonas de Cobertura)

#### Listar Zonas
```
GET /api/coverage-zones
```

#### Obtener Zona por ID
```
GET /api/coverage-zones/:id
```

#### Crear Zona
```
POST /api/coverage-zones
```

**Request:**
```json
{
  "companyPhone": "+1234567890",
  "state": "New York",
  "city": "New York",
  "zoneName": "Downtown Manhattan",
  "postalCode": "10001",
  "coordinates": {
    "type": "Polygon",
    "coordinates": [[[-74.0060, 40.7128], [-73.9900, 40.7200], ...]]
  },
  "notes": "Primary service area"
}
```

#### Actualizar Zona
```
PUT /api/coverage-zones/:id
```

#### Eliminar Zona
```
DELETE /api/coverage-zones/:id
```

---

### Users (Usuarios - Admin)

#### Listar Usuarios
```
GET /api/users
```

**Restricción:** Solo super_admin

#### Obtener Usuario por ID
```
GET /api/users/:id
```

#### Crear Usuario
```
POST /api/users
```

**Restricción:** Solo super_admin

#### Actualizar Usuario
```
PUT /api/users/:id
```

**Restricción:** Solo super_admin

#### Eliminar Usuario
```
DELETE /api/users/:id
```

**Restricción:** Solo super_admin

---

## 📱 Flujos de Uso

### 1. Flujo de Registro e Inicio de Sesión

```
Usuario nuevo
    ↓
POST /api/auth/register
    ↓
Credenciales guardadas (hash)
    ↓
Usuario inicia sesión
    ↓
POST /api/auth/login
    ↓
Recibe: { user, token }
    ↓
Guarda token en localStorage
    ↓
Usa token en Authorization header
```

### 2. Flujo de Crear Cita (por Empresa)

```
Empresa autenticada
    ↓
GET /api/customers (obtener clientes)
    ↓
GET /api/services (obtener servicios propios)
    ↓
GET /api/technicians (obtener técnicos disponibles)
    ↓
POST /api/appointments (crear cita)
    ↓
Cita creada con estado 'pending'
    ↓
PUT /api/appointments/:id (actualizar estado si es necesario)
```

### 3. Flujo de Técnico Viendo sus Citas

```
Técnico autenticado
    ↓
GET /api/appointments
    (Backend filtra: solo citas con technicianPhone = su teléfono)
    ↓
Muestra lista de citas asignadas
    ↓
GET /api/appointments/:id (ver detalles)
    ↓
Ver cliente, servicio, ubicación, horario
```

### 4. Flujo de Super Admin

```
Super Admin autenticado
    ↓
GET /api/companies (listar todas las empresas)
    ↓
POST /api/companies (crear nueva empresa)
    ↓
GET /api/users (listar usuarios)
    ↓
POST /api/users (crear usuario nuevo)
    ↓
Ver/Editar/Eliminar cualquier recurso
```

---

## 💻 Ejemplos de Integración

### JavaScript/TypeScript

```typescript
// Cliente API
class AutoServicesAPI {
  private baseUrl = 'http://localhost:3000';
  private token: string | null = null;

  async register(phone: string, password: string, name: string, type: 'technician' | 'company' | 'super_admin') {
    const response = await fetch(`${this.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password, name, type })
    });
    return response.json();
  }

  async login(phone: string, password: string) {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await response.json();
    if (data.token) {
      this.token = data.token;
      localStorage.setItem('authToken', data.token);
    }
    return data;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token || localStorage.getItem('authToken')}`
    };
  }

  async getAppointments() {
    const response = await fetch(`${this.baseUrl}/api/appointments`, {
      headers: this.getHeaders()
    });
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      throw new Error('Token expired');
    }
    return response.json();
  }

  async createAppointment(data: any) {
    const response = await fetch(`${this.baseUrl}/api/appointments`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async updateAppointment(id: number, data: any) {
    const response = await fetch(`${this.baseUrl}/api/appointments/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async deleteAppointment(id: number) {
    const response = await fetch(`${this.baseUrl}/api/appointments/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return response.json();
  }
}

// Uso
const api = new AutoServicesAPI();

// Registro
await api.register('+1234567890', 'password123', 'John', 'technician');

// Login
await api.login('+1234567890', 'password123');

// Get appointments
const appointments = await api.getAppointments();

// Create appointment
await api.createAppointment({
  customerPhone: '+9876543210',
  companyPhone: '+1111111111',
  serviceId: 1,
  appointmentDate: '2026-03-15',
  startTime: '14:00:00'
});
```

### React Hook

```typescript
// useAutoServices.ts
import { useState, useCallback } from 'react';

export const useAutoServices = () => {
  const [token, setToken] = useState(() => localStorage.getItem('authToken'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = 'http://localhost:3000';

  const getHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }), [token]);

  const login = async (phone: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setToken(data.token);
      localStorage.setItem('authToken', data.token);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getAppointments = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/appointments`, {
        headers: getHeaders()
      });
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        setToken(null);
        throw new Error('Session expired');
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
      throw err;
    }
  };

  return { login, getAppointments, token, loading, error };
};

// Componente
function AppointmentsList() {
  const { getAppointments } = useAutoServices();
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    getAppointments().then(setAppointments);
  }, []);

  return (
    <div>
      {appointments.map(apt => (
        <div key={apt.id}>
          <h3>{apt.status}</h3>
          <p>{apt.appointmentDate} - {apt.startTime}</p>
        </div>
      ))}
    </div>
  );
}
```

### Vue 3 Composable

```typescript
// useAutoServices.ts
import { ref, computed } from 'vue';

export const useAutoServices = () => {
  const token = ref(localStorage.getItem('authToken'));
  const baseUrl = 'http://localhost:3000';

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token.value}`
  });

  const login = async (phone: string, password: string) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await response.json();
    if (data.token) {
      token.value = data.token;
      localStorage.setItem('authToken', data.token);
    }
    return data;
  };

  const getAppointments = async () => {
    const response = await fetch(`${baseUrl}/api/appointments`, {
      headers: getHeaders()
    });
    return response.json();
  };

  return { login, getAppointments, token };
};
```

---

## 🎯 Checklist para Frontend

- [ ] Crear página de Login
- [ ] Crear página de Registro
- [ ] Guardar/recuperar token del localStorage
- [ ] Implementar middleware de autenticación
- [ ] Mostrar dashboard según rol (technician/company/super_admin)
- [ ] Dashboard Technician: Ver mis citas
- [ ] Dashboard Company: Crear/editar/eliminar citas y servicios
- [ ] Dashboard Admin: Gestionar usuarios, empresas, zonas
- [ ] Manejar errores de authenticación (401)
- [ ] Refrescar token antes de expirar
- [ ] Formularios de validación (Zod/Yup)
- [ ] Paginación en listas
- [ ] Filtros de búsqueda
- [ ] Notificaciones en tiempo real (opcional - WebSocket)
- [ ] Mapas de zonas de cobertura (opcional - Mapbox/Leaflet)

---

## 🚨 Manejo de Errores

### Errores Comunes

| Código | Significado | Acción |
|--------|------------|--------|
| 400 | Bad Request | Validar datos enviados |
| 401 | Unauthorized | Token expirado/inválido - redirigir login |
| 403 | Forbidden | Permisos insuficientes para el rol |
| 404 | Not Found | Recurso no existe |
| 500 | Server Error | Error del servidor - reintentar después |

### Patrón de Manejo

```typescript
try {
  const response = await fetch(url, options);
  
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    window.location.href = '/login';
    return;
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Unknown error');
  }
  
  return response.json();
} catch (error) {
  console.error('API Error:', error);
  showErrorMessage(error.message);
}
```

---

## 📞 Contacto

**Documentación API:** http://localhost:3000/docs
**Health Check:** http://localhost:3000/health

Para más preguntas, consultar los endpoints en el navegador en http://localhost:3000/docs
