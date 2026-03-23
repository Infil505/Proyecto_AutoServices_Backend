# 💡 Ejemplos de Integración

Esta carpeta contiene ejemplos prácticos de cómo integrar y consumir la API de AutoServices Backend.

## 📁 Estructura

### [frontend/](frontend/)
Ejemplos completos para integrar la API con aplicaciones frontend.

#### Archivos Disponibles:
- **[frontend-api-client.js](frontend/frontend-api-client.js)** - Cliente JavaScript completo para consumir la API
- **[react-hooks.js](frontend/react-hooks.js)** - Hooks personalizados para React
- **[react-example.jsx](frontend/react-example.jsx)** - Componente React completo con autenticación y CRUD
- **[frontend-demo.html](frontend/frontend-demo.html)** - Demo interactiva en HTML/JavaScript puro

## 🚀 Inicio Rápido

### Usar el Cliente JavaScript
```javascript
import AutoServicesAPI from './examples/frontend/frontend-api-client.js';

const api = new AutoServicesAPI();

// Login
const user = await api.login({ email, password });

// Obtener datos
const companies = await api.getCompanies();
```

### Usar Hooks de React
```jsx
import { useAuth, useAutoServicesAPI } from './examples/frontend/react-hooks.js';

function MyComponent() {
  const { user, login } = useAuth();
  const api = useAutoServicesAPI();

  // Tu código aquí
}
```

### Demo Interactiva
1. Abre `examples/frontend/frontend-demo.html` en tu navegador
2. Regístrate o inicia sesión
3. Prueba todas las funcionalidades CRUD

## 🎯 Frameworks Soportados

- ✅ **React** (con hooks personalizados)
- ✅ **Vue.js** (Composition API)
- ✅ **Angular** (services)
- ✅ **Vanilla JavaScript**
- ✅ **React Native** (móvil)
- ✅ **Flutter** (móvil)

## 📚 Más Ejemplos

Para más ejemplos detallados por framework, consulta:
- [📖 Guía de Integración Frontend](../docs/FRONTEND_INTEGRATION_GUIDE.md)

## 🔗 Enlaces Rápidos

- [🏠 Volver al README principal](../README.md)
- [📚 Documentación](../docs/)
- [🛠️ Herramientas](../tools/)