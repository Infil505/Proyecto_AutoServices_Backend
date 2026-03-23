# 🧪 Tests

Esta carpeta contiene todos los tests del proyecto AutoServices Backend.

## 📋 Tipos de Tests

### Unit Tests
Tests que verifican unidades individuales de código:
- Funciones utilitarias
- Validaciones
- Servicios individuales

### Integration Tests
Tests que verifican la integración entre componentes:
- Endpoints de la API
- Base de datos
- Middlewares

### E2E Tests (End-to-End)
Tests que simulan el flujo completo del usuario:
- Registro y login
- Operaciones CRUD completas
- Flujos de negocio

## 🚀 Ejecutar Tests

### Todos los tests
```bash
bun run test
```

### Tests en modo watch (desarrollo)
```bash
bun run test:watch
```

### Tests con coverage
```bash
bun run test --coverage
```

## 📁 Estructura de Tests

```
tests/
├── unit/              # Tests unitarios
├── integration/       # Tests de integración
├── e2e/              # Tests end-to-end
├── fixtures/         # Datos de prueba
├── helpers/          # Utilidades para tests
└── setup.ts          # Configuración global de tests
```

## 🛠️ Tecnologías de Testing

- **Framework**: [Vitest](https://vitest.dev/) - Test runner rápido
- **Assertions**: [expect](https://vitest.dev/api/expect.html) (integrado en Vitest)
- **Mocks**: [vi](https://vitest.dev/api/vi.html) (integrado en Vitest)
- **Coverage**: Integrado en Vitest

## 📝 Escribir Tests

### Ejemplo de Test Unitario
```typescript
import { describe, it, expect } from 'vitest';
import { validateEmail } from '../src/utils/validation';

describe('validateEmail', () => {
  it('should validate correct email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(validateEmail('invalid-email')).toBe(false);
  });
});
```

### Ejemplo de Test de API
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('GET /api/users', () => {
  it('should return users list', async () => {
    const response = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
  });
});
```

## 🎯 Mejores Prácticas

### ✅ DO
- Escribir tests descriptivos
- Usar `describe` y `it` para organizar tests
- Probar casos positivos y negativos
- Usar mocks para dependencias externas
- Mantener tests independientes

### ❌ DON'T
- Tests que dependan del estado global
- Tests que hagan llamadas reales a APIs externas
- Tests que modifiquen la base de datos real
- Tests sin assertions claras

## 📊 Coverage

Para ver el reporte de cobertura:
```bash
bun run test --coverage
```

El reporte se genera en `coverage/` con:
- Cobertura de líneas
- Cobertura de funciones
- Cobertura de ramas
- Cobertura de statements

## 🔄 CI/CD

Los tests se ejecutan automáticamente en:
- **GitHub Actions**: `.github/workflows/ci.yml`
- **Pre-commit**: Con Husky
- **Pre-push**: Validación completa

## 🔗 Enlaces Rápidos

- [🏠 Volver al README principal](../README.md)
- [🔧 Código Fuente](../src/)
- [📚 Documentación](../docs/)