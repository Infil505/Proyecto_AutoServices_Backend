# 🤝 Guía de Contribución

¡Gracias por tu interés en contribuir al proyecto AutoServices Backend! Esta guía te ayudará a entender cómo contribuir de manera efectiva.

## 📋 Tabla de Contenidos

- [🚀 Inicio Rápido](#-inicio-rápido)
- [🐛 Reportar Bugs](#-reportar-bugs)
- [💡 Sugerir Features](#-sugerir-features)
- [🛠️ Desarrollo](#️-desarrollo)
- [📝 Estándares de Código](#-estándares-de-código)
- [🧪 Testing](#-testing)
- [📄 Pull Requests](#-pull-requests)
- [🎯 Tipos de Contribuciones](#-tipos-de-contribuciones)

## 🚀 Inicio Rápido

1. **Fork** el repositorio
2. **Clona** tu fork:
   ```bash
   git clone https://github.com/tu-usuario/Proyecto_AutoServices_Backend.git
   cd Proyecto_AutoServices_Backend
   ```
3. **Instala dependencias**:
   ```bash
   bun install
   ```
4. **Configura el entorno**:
   ```bash
   cp .env.example .env
   # Edita .env con tus credenciales
   ```
5. **Configura la base de datos**:
   ```bash
   bun run db:migrate
   bun run db:seed
   ```
6. **Inicia el desarrollo**:
   ```bash
   bun run dev
   ```

## 🐛 Reportar Bugs

### Antes de Reportar
- 🔍 **Busca issues existentes** para evitar duplicados
- 📋 **Revisa la documentación** en `docs/`
- 🧪 **Verifica** que el bug existe en la versión más reciente

### Cómo Reportar un Bug

1. **Usa la plantilla de bug** en [GitHub Issues](https://github.com/Infil505/Proyecto_AutoServices_Backend/issues/new?template=bug_report.md)
2. **Proporciona información detallada**:
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Screenshots si aplica
   - Información del entorno (OS, Node version, etc.)

### Plantilla de Bug Report
```markdown
**Descripción del Bug**
[Descripción clara y concisa]

**Pasos para Reproducir**
1. Ir a '...'
2. Hacer click en '....'
3. Ver error

**Comportamiento Esperado**
[Qué debería pasar]

**Comportamiento Actual**
[Qué pasa en realidad]

**Capturas de Pantalla**
[Si aplica]

**Entorno**
- OS: [ej: Windows 10]
- Bun Version: [ej: 1.0.0]
- PostgreSQL Version: [ej: 15.0]
```

## 💡 Sugerir Features

### Antes de Sugerir
- 🔍 **Busca features existentes** en issues
- 📋 **Revisa la roadmap** del proyecto
- 💭 **Discute ideas** en [GitHub Discussions](https://github.com/Infil505/Proyecto_AutoServices_Backend/discussions)

### Cómo Sugerir una Feature

1. **Usa la plantilla de feature** en [GitHub Issues](https://github.com/Infil505/Proyecto_AutoServices_Backend/issues/new?template=feature_request.md)
2. **Describe claramente**:
   - El problema que resuelve
   - La solución propuesta
   - Alternativas consideradas

### Plantilla de Feature Request
```markdown
**¿Es tu solicitud de feature relacionada con un problema?**
[Descripción del problema]

**Solución Deseada**
[Descripción de la solución]

**Alternativas Consideradas**
[Otras soluciones que consideraste]

**Contexto Adicional**
[Cualquier otro contexto]
```

## 🛠️ Desarrollo

### Configuración del Entorno de Desarrollo

1. **Requisitos**:
   - Bun >= 1.0.0
   - PostgreSQL >= 13
   - Git

2. **Herramientas Recomendadas**:
   - VS Code
   - Extensiones: TypeScript, ESLint, Prettier

3. **Flujo de Trabajo**:
   ```bash
   # Crear rama para tu feature
   git checkout -b feature/nombre-del-feature

   # Hacer cambios
   # ...

   # Ejecutar tests
   bun run test

   # Verificar linting
   bun run lint

   # Commit cambios
   git commit -m "feat: descripción del cambio"

   # Push a tu fork
   git push origin feature/nombre-del-feature
   ```

## 📝 Estándares de Código

### TypeScript
- ✅ **Tipos estrictos** - No usar `any`
- ✅ **Interfaces** para objetos complejos
- ✅ **Enums** para valores constantes
- ✅ **Generic types** cuando aplique

### Estilo de Código
- ✅ **ESLint** configurado - Ejecutar `bun run lint`
- ✅ **Prettier** para formato
- ✅ **Nombres descriptivos** en inglés
- ✅ **Comentarios** para lógica compleja

### Convenciones de Commit
Usamos [Conventional Commits](https://conventionalcommits.org/):

```bash
# Tipos permitidos
feat: nueva funcionalidad
fix: corrección de bug
docs: cambios en documentación
style: cambios de estilo (formato, etc.)
refactor: refactorización de código
test: agregar o modificar tests
chore: cambios en herramientas, configuración

# Ejemplos
git commit -m "feat: add user authentication endpoint"
git commit -m "fix: resolve CORS issue in production"
git commit -m "docs: update API documentation"
```

## 🧪 Testing

### Tipos de Tests
- **Unit Tests**: Funciones individuales
- **Integration Tests**: Endpoints de API
- **E2E Tests**: Flujos completos

### Ejecutar Tests
```bash
# Todos los tests
bun run test

# Tests con coverage
bun run test --coverage

# Tests en modo watch
bun run test:watch
```

### Escribir Tests
```typescript
import { describe, it, expect } from 'vitest';

describe('User Service', () => {
  it('should create a new user', async () => {
    // Arrange
    const userData = { name: 'John', email: 'john@example.com' };

    // Act
    const user = await createUser(userData);

    // Assert
    expect(user).toHaveProperty('id');
    expect(user.name).toBe('John');
  });
});
```

## 📄 Pull Requests

### Antes de Crear un PR
- ✅ **Tests pasan** - `bun run test`
- ✅ **Linting pasa** - `bun run lint`
- ✅ **Tipos verificados** - `bun run type-check`
- ✅ **Documentación actualizada**
- ✅ **Commits siguiendo conventional commits**

### Proceso de PR
1. **Crear PR** desde tu fork
2. **Rellenar template** del PR
3. **Esperar review** del equipo
4. **Hacer cambios** si es necesario
5. **Merge** cuando sea aprobado

### Template de PR
```markdown
## Descripción
[Descripción clara de los cambios]

## Tipo de Cambio
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Tests agregados/modificados
- [ ] Documentación actualizada
- [ ] Linting pasa
- [ ] Tipos verificados
```

## 🎯 Tipos de Contribuciones

### 💻 Código
- Nuevas funcionalidades
- Corrección de bugs
- Refactorización
- Optimización de performance

### 📚 Documentación
- Guías de instalación
- Documentación de API
- Tutoriales
- Traducciones

### 🧪 Testing
- Nuevos tests
- Mejora de cobertura
- Tests de integración

### 🛠️ Herramientas
- Scripts de automatización
- Configuración de CI/CD
- Herramientas de desarrollo

### 🎨 UI/UX (Frontend)
- Mejoras en ejemplos
- Nuevos demos
- Componentes reutilizables

## 📞 Comunicación

- **🐛 Bugs**: [GitHub Issues](https://github.com/Infil505/Proyecto_AutoServices_Backend/issues)
- **💡 Ideas**: [GitHub Discussions](https://github.com/Infil505/Proyecto_AutoServices_Backend/discussions)
- **💬 Chat**: [Discord/Slack del proyecto]
