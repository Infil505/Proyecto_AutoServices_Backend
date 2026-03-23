# 🛠️ Herramientas de Desarrollo

Esta carpeta contiene scripts y herramientas para facilitar el desarrollo y mantenimiento del proyecto.

## 📋 Scripts Disponibles

### Scripts de Configuración
- **[setup.bat](setup.bat)** - Configuración automática completa del proyecto
- **[start.bat](start.bat)** - Inicio rápido del servidor de desarrollo

### Scripts de Base de Datos
- **[backup.sh](backup.sh)** - Script para crear respaldos de la base de datos
- **[restore.sh](restore.sh)** - Script para restaurar respaldos de la base de datos

## 🚀 Uso Rápido

### Configuración Inicial
```bash
# Ejecutar configuración completa
./setup.bat
```

### Inicio del Servidor
```bash
# Iniciar servidor de desarrollo
./start.bat
```

### Respaldos de Base de Datos
```bash
# Crear respaldo
./backup.sh

# Restaurar respaldo
./restore.sh backup_file.sql
```

## 📁 Estructura

```
tools/
├── setup.bat          # Configuración automática
├── start.bat          # Inicio del servidor
├── backup.sh          # Respaldo de BD
└── restore.sh         # Restauración de BD
```

## 🔗 Enlaces Rápidos

- [🏠 Volver al README principal](../README.md)
- [📚 Documentación](../docs/)
- [🧪 Tests](../tests/)