#!/bin/bash

# Database restore script for AutoServices
# Usage: ./restore.sh <backup_file.sql.gz> [environment]

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup_file.sql.gz> [environment]"
    echo "Example: $0 ./backups/autoservices_production_20231201_120000.sql.gz staging"
    exit 1
fi

BACKUP_FILE="$1"
ENVIRONMENT=${2:-development}

# Database connection details (load from environment or use defaults)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-autoservices_db}
DB_USER=${DB_USER:-autoservices}
DB_PASSWORD=${DB_PASSWORD:-password}

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Check if file is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "📦 Decompressing backup file..."
    gunzip -c "$BACKUP_FILE" > "${BACKUP_FILE%.gz}"
    BACKUP_FILE="${BACKUP_FILE%.gz}"
fi

echo "🔄 Starting database restore..."
echo "Environment: $ENVIRONMENT"
echo "Backup file: $BACKUP_FILE"
echo "Target database: $DB_NAME"

# Confirm restore action
read -p "⚠️  This will REPLACE the current database. Are you sure? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Restore cancelled by user"
    exit 1
fi

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

# Terminate active connections to the database (except current)
echo "🔌 Terminating active connections..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
" 2>/dev/null || true

# Drop and recreate database
echo "🗑️  Dropping existing database..."
dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --if-exists "$DB_NAME" 2>/dev/null || true

echo "🆕 Creating new database..."
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"

# Restore from backup
echo "📥 Restoring from backup..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"

# Check if restore was successful
if [ $? -eq 0 ]; then
    echo "✅ Database restore completed successfully"

    # Run migrations to ensure schema is up to date
    echo "🔄 Running database migrations..."
    if command -v bun &> /dev/null; then
        bun run db:migrate
    elif command -v npm &> /dev/null; then
        npm run db:migrate
    else
        echo "⚠️  Could not run migrations - bun/npm not found"
    fi

    # Clean up decompressed file if it was compressed
    if [[ "$1" == *.gz ]]; then
        rm -f "$BACKUP_FILE"
        echo "🧹 Cleaned up temporary decompressed file"
    fi

else
    echo "❌ Database restore failed!"
    exit 1
fi

# Unset password
unset PGPASSWORD

echo "🎉 Restore process completed!"