#!/bin/bash

# Database backup script for AutoServices
# Usage: ./backup.sh [environment]

ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/autoservices_${ENVIRONMENT}_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Database connection details (load from environment or use defaults)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-autoservices_db}
DB_USER=${DB_USER:-autoservices}
DB_PASSWORD=${DB_PASSWORD:-password}

# Export password for pg_dump
export PGPASSWORD="$DB_PASSWORD"

echo "Starting database backup..."
echo "Environment: $ENVIRONMENT"
echo "Backup file: $BACKUP_FILE"

# Create backup
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --verbose \
  > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "✅ Backup completed successfully"
    echo "📁 Backup saved to: $BACKUP_FILE"

    # Compress the backup
    gzip "$BACKUP_FILE"
    echo "🗜️  Backup compressed to: ${BACKUP_FILE}.gz"

    # Clean up old backups (keep last 30 days)
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
    echo "🧹 Cleaned up old backups (older than 30 days)"

    # Show backup size
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
    echo "📊 Backup size: $BACKUP_SIZE"

else
    echo "❌ Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Unset password
unset PGPASSWORD

echo "🎉 Backup process completed!"