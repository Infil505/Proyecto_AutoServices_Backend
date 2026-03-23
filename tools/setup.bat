@echo off
echo ========================================
echo   AutoServices Backend - Setup Script
echo ========================================
echo.

echo Paso 1: Verificando instalacion de Bun...
bun --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Bun no esta instalado.
    echo.
    echo Por favor instala Bun primero:
    echo 1. Visita: https://bun.sh
    echo 2. Descarga e instala Bun
    echo 3. Reinicia la terminal
    echo 4. Vuelve a ejecutar este script
    echo.
    pause
    exit /b 1
) else (
    echo ✅ Bun esta instalado
)

echo.
echo Paso 2: Instalando dependencias...
bun install
if %errorlevel% neq 0 (
    echo ❌ Error instalando dependencias
    pause
    exit /b 1
) else (
    echo ✅ Dependencias instaladas
)

echo.
echo Paso 3: Verificando configuracion de base de datos...
if not exist ".env" (
    echo ❌ Archivo .env no encontrado
    echo.
    echo Copia .env.example a .env y configura tus credenciales:
    echo DATABASE_URL=postgresql://usuario:password@localhost:5432/autoservices_db
    echo JWT_SECRET=tu_clave_secreta_jwt
    echo.
    pause
    exit /b 1
) else (
    echo ✅ Archivo .env encontrado
)

echo.
echo Paso 4: Ejecutando migraciones de base de datos...
bun run db:migrate
if %errorlevel% neq 0 (
    echo ❌ Error en migraciones
    echo.
    echo Asegurate de que:
    echo - La base de datos PostgreSQL esta corriendo
    echo - Las credenciales en .env son correctas
    echo - La base de datos existe
    echo.
    pause
    exit /b 1
) else (
    echo ✅ Migraciones completadas
)

echo.
echo Paso 5: Ejecutando seeder (datos de prueba)...
bun run db:seed
if %errorlevel% neq 0 (
    echo ❌ Error en seeder (puede ser normal si ya hay datos)
) else (
    echo ✅ Seeder completado
)

echo.
echo ========================================
echo   ✅ SETUP COMPLETADO
echo ========================================
echo.
echo Para iniciar el servidor en modo desarrollo:
echo   bun run dev
echo.
echo Para ejecutar tests:
echo   bun run test
echo.
echo API disponible en: http://localhost:3000
echo Documentacion: http://localhost:3000/docs
echo.
pause