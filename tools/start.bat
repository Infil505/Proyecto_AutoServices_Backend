@echo off
echo Iniciando AutoServices Backend...
echo.

echo Verificando que todo este configurado...
if not exist "node_modules" (
    echo ❌ Dependencias no instaladas. Ejecuta setup.bat primero.
    pause
    exit /b 1
)

if not exist ".env" (
    echo ❌ Archivo .env no encontrado. Configuralo primero.
    pause
    exit /b 1
)

echo ✅ Configuracion verificada
echo.

echo Iniciando servidor en modo desarrollo...
echo API disponible en: http://localhost:3000
echo Documentacion: http://localhost:3000/docs
echo Presiona Ctrl+C para detener
echo.

bun run dev