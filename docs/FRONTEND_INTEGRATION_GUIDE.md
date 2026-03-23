# AutoServices Backend API - Frontend Integration Guide

Esta API REST está diseñada para ser completamente compatible con cualquier frontend moderno. A continuación encontrarás guías completas para integrar la API en diferentes tipos de aplicaciones frontend.

## 🚀 Características de la API

- **Autenticación JWT**: Tokens Bearer para acceso seguro
- **CORS habilitado**: Compatible con aplicaciones web desde cualquier origen
- **Respuestas JSON**: Formato estándar para fácil parsing
- **Control de acceso basado en roles**: 3 tipos de usuarios (technician, company, super_admin)
- **Paginación**: Soporte completo para listas grandes
- **Validación**: Esquemas Zod para datos consistentes
- **Documentación**: Swagger UI en `/docs`

## 📋 Endpoints Principales

### Autenticación (Públicos)
- `POST /api/auth/register` - Registro de usuarios
- `POST /api/auth/login` - Inicio de sesión

### Recursos Protegidos (Requieren JWT)
- `GET /api/users` - Lista de usuarios (super_admin)
- `POST /api/users` - Crear usuario (super_admin)
- `GET /api/companies` - Lista de compañías
- `POST /api/companies` - Crear compañía
- `GET /api/technicians` - Lista de técnicos
- `POST /api/technicians` - Crear técnico
- `GET /api/services` - Lista de servicios
- `POST /api/services` - Crear servicio
- `GET /api/appointments` - Lista de citas
- `POST /api/appointments` - Crear cita

## 🔧 Integración con Frontend

### 1. Configuración Básica

```javascript
// Configuración de la API
const API_BASE = 'http://localhost:3000'; // Cambiar en producción

// Función helper para requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Agregar token JWT si existe
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}
```

### 2. Autenticación

```javascript
// Login
async function login(email, password) {
  try {
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Guardar token
    localStorage.setItem('authToken', response.token);
    return response.user;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

// Logout
function logout() {
  localStorage.removeItem('authToken');
}
```

### 3. Manejo de Errores

```javascript
// La API retorna errores en formato JSON
{
  "error": "Descripción del error",
  "code": "ERROR_CODE" // opcional
}

// Ejemplo de manejo
try {
  const data = await apiRequest('/api/users');
  console.log('Datos:', data);
} catch (error) {
  if (error.message.includes('401')) {
    // Token expirado, redirigir a login
    logout();
    window.location.href = '/login';
  } else {
    // Mostrar error al usuario
    alert('Error: ' + error.message);
  }
}
```

### 4. Paginación

```javascript
// La API soporta paginación en todos los endpoints GET
// Parámetros: page, limit, sortBy, sortOrder

async function loadUsers(page = 1, limit = 10) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const response = await apiRequest(`/api/users?${params}`);

  return {
    data: response.data,
    total: response.total,
    page: response.page,
    totalPages: response.totalPages,
    hasNextPage: response.hasNextPage,
    hasPrevPage: response.hasPrevPage
  };
}

// Uso
const users = await loadUsers(1, 20);
console.log(`Página ${users.page} de ${users.totalPages}`);
```

## 🎯 Ejemplos por Framework

### React con Hooks

```jsx
import { useState, useEffect } from 'react';

function useAutoServicesAPI() {
  const [token, setToken] = useState(localStorage.getItem('authToken'));

  const apiRequest = async (endpoint, options = {}) => {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`http://localhost:3000${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    return data;
  };

  return {
    login: (credentials) => apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }).then(response => {
      setToken(response.token);
      localStorage.setItem('authToken', response.token);
      return response;
    }),

    getUsers: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiRequest(`/api/users?${query}`);
    },

    createUser: (userData) => apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),

    logout: () => {
      setToken(null);
      localStorage.removeItem('authToken');
    }
  };
}
```

### Vue.js con Composition API

```javascript
import { ref, computed } from 'vue';

export function useAutoServicesAPI() {
  const token = ref(localStorage.getItem('authToken'));
  const baseURL = 'http://localhost:3000';

  const apiRequest = async (endpoint, options = {}) => {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (token.value) {
      config.headers.Authorization = `Bearer ${token.value}`;
    }

    const response = await fetch(`${baseURL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    return data;
  };

  return {
    isAuthenticated: computed(() => !!token.value),

    login: async (credentials) => {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });

      token.value = response.token;
      localStorage.setItem('authToken', response.token);
      return response;
    },

    getCompanies: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiRequest(`/api/companies?${query}`);
    },

    createCompany: (companyData) => apiRequest('/api/companies', {
      method: 'POST',
      body: JSON.stringify(companyData)
    }),

    logout: () => {
      token.value = null;
      localStorage.removeItem('authToken');
    }
  };
}
```

### Angular Service

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AutoServicesService {
  private baseURL = 'http://localhost:3000';
  private token: string | null = localStorage.getItem('authToken');

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (this.token) {
      headers = headers.set('Authorization', `Bearer ${this.token}`);
    }

    return headers;
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.baseURL}/api/auth/login`, credentials)
      .pipe(
        tap((response: any) => {
          this.token = response.token;
          localStorage.setItem('authToken', response.token);
        }),
        catchError(error => {
          return throwError(() => new Error(error.error?.error || 'Login failed'));
        })
      );
  }

  getUsers(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        httpParams = httpParams.set(key, params[key]);
      });
    }

    return this.http.get(`${this.baseURL}/api/users`, {
      headers: this.getHeaders(),
      params: httpParams
    }).pipe(
      catchError(error => {
        return throwError(() => new Error(error.error?.error || 'Failed to load users'));
      })
    );
  }

  createUser(userData: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/users`, userData, {
      headers: this.getHeaders()
    }).pipe(
      catchError(error => {
        return throwError(() => new Error(error.error?.error || 'Failed to create user'));
      })
    );
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('authToken');
  }
}
```

### Vanilla JavaScript / jQuery

```javascript
// Con jQuery
function apiRequest(endpoint, options = {}) {
  const config = {
    url: `http://localhost:3000${endpoint}`,
    contentType: 'application/json',
    ...options,
  };

  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`
    };
  }

  return $.ajax(config);
}

// Uso
$('#login-form').submit(async function(e) {
  e.preventDefault();

  try {
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      data: JSON.stringify({
        email: $('#email').val(),
        password: $('#password').val()
      })
    });

    localStorage.setItem('authToken', response.token);
    $('#message').text('Login exitoso!').removeClass('error').addClass('success');
  } catch (error) {
    $('#message').text('Error: ' + error.responseJSON?.error).removeClass('success').addClass('error');
  }
});
```

## 📱 Aplicaciones Móviles

### React Native

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class AutoServicesAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  async getToken() {
    return await AsyncStorage.getItem('authToken');
  }

  async setToken(token) {
    await AsyncStorage.setItem('authToken', token);
  }

  async apiRequest(endpoint, options = {}) {
    const token = await this.getToken();
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  async login(credentials) {
    const response = await this.apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    await this.setToken(response.token);
    return response;
  }

  async getServices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.apiRequest(`/api/services?${query}`);
  }
}

export default new AutoServicesAPI();
```

### Flutter

```dart
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class AutoServicesAPI {
  final String baseURL;
  final SharedPreferences _prefs;

  AutoServicesAPI(this.baseURL, this._prefs);

  Future<Map<String, String>> _getHeaders() async {
    final token = _prefs.getString('authToken');
    final headers = {'Content-Type': 'application/json'};

    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }

    return headers;
  }

  Future<dynamic> apiRequest(String endpoint, {Map<String, dynamic>? body, String method = 'GET'}) async {
    final url = Uri.parse('$baseURL$endpoint');
    final headers = await _getHeaders();

    http.Response response;

    switch (method) {
      case 'POST':
        response = await http.post(url, headers: headers, body: jsonEncode(body));
        break;
      case 'PUT':
        response = await http.put(url, headers: headers, body: jsonEncode(body));
        break;
      case 'DELETE':
        response = await http.delete(url, headers: headers);
        break;
      default:
        response = await http.get(url, headers: headers);
    }

    final data = jsonDecode(response.body);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    } else {
      throw Exception(data['error'] ?? 'Request failed');
    }
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await apiRequest('/api/auth/login', body: {
      'email': email,
      'password': password,
    }, method: 'POST');

    await _prefs.setString('authToken', response['token']);
    return response;
  }

  Future<List<dynamic>> getCompanies({int page = 1, int limit = 10}) async {
    final response = await apiRequest('/api/companies?page=$page&limit=$limit');
    return response['data'];
  }
}
```

## 🔒 Manejo de Tokens JWT

```javascript
// Verificar si el token está expirado
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    return true; // Si hay error, asumir expirado
  }
}

// Refresh token (si implementas refresh tokens)
async function refreshToken() {
  try {
    const response = await apiRequest('/api/auth/refresh', {
      method: 'POST',
    });

    localStorage.setItem('authToken', response.token);
    return response.token;
  } catch (error) {
    logout();
    throw error;
  }
}

// Interceptor para renovar tokens automáticamente
async function apiRequestWithTokenRefresh(endpoint, options = {}) {
  let token = localStorage.getItem('authToken');

  if (token && isTokenExpired(token)) {
    token = await refreshToken();
  }

  return apiRequest(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
```

## 🚀 Despliegue en Producción

### Configuración CORS

Para producción, configura CORS específicamente:

```javascript
// En src/index.ts
app.use('*', cors({
  origin: [
    'https://tu-dominio.com',
    'https://www.tu-dominio.com',
    'http://localhost:3000' // Para desarrollo
  ],
  credentials: true
}));
```

### Variables de Entorno

```bash
# .env.production
NODE_ENV=production
JWT_SECRET=tu_jwt_secret_seguro
DATABASE_URL=postgresql://user:pass@host:5432/db
API_BASE_URL=https://api.tu-dominio.com
```

### HTTPS

Asegúrate de que tu API esté servida sobre HTTPS en producción para seguridad JWT.

## 📚 Documentación Adicional

- **Swagger UI**: Visita `/docs` para documentación interactiva
- **Esquemas Zod**: Revisa `src/validation/schemas.ts` para estructuras de datos
- **Tests**: Mira `tests/` para ejemplos de uso de la API
- **Health Check**: `GET /health` para verificar estado de la API

## 🆘 Solución de Problemas

### Error 401 Unauthorized
- Verifica que el token JWT sea válido y no haya expirado
- Asegúrate de incluir `Authorization: Bearer <token>` en headers

### Error 403 Forbidden
- Verifica los permisos del usuario según su rol
- Algunos endpoints requieren rol `super_admin`

### Error 422 Unprocessable Entity
- Los datos enviados no pasan validación
- Revisa los esquemas en `src/validation/schemas.ts`

### CORS Errors
- Verifica configuración CORS en el servidor
- Para desarrollo, CORS está habilitado para todos los orígenes

## 📚 Recursos Adicionales

### 💡 Ejemplos Completos
- **[Cliente API JavaScript](../examples/frontend/frontend-api-client.js)** - Cliente completo listo para usar
- **[Hooks React](../examples/frontend/react-hooks.js)** - Hooks personalizados para React
- **[Ejemplo React](../examples/frontend/react-example.jsx)** - Componente React con autenticación
- **[Demo Interactiva](../examples/frontend/frontend-demo.html)** - Demo funcional en HTML/JS puro

### 🔧 Herramientas de Desarrollo
- **[Scripts de Setup](../tools/setup.bat)** - Configuración automática del proyecto
- **[Scripts de Inicio](../tools/start.bat)** - Inicio rápido del servidor

### 📖 Más Documentación
- **[README Principal](../README.md)** - Información general del proyecto
- **[Configuración PostgreSQL](POSTGRESQL_SETUP.md)** - Guía completa de base de datos

¡La API está lista para ser integrada en cualquier aplicación frontend!