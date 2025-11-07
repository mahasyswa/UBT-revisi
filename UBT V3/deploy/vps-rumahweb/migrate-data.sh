#!/bin/bash

# ============================================
# MIGRATE DATA FROM OLD VPS
# ============================================
# Script ini akan:
# - Backup database dari VPS lama
# - Transfer ke VPS baru
# - Restore database
# ============================================

set -e

OLD_VPS_IP="203.83.46.48"
OLD_VPS_PORT="7399"
OLD_VPS_USER="root"
OLD_DB_PATH="/opt/ubt/data/database.db"

NEW_DB_PATH="/opt/ubt/data/database.db"

echo "=========================================="
echo "📦 MIGRATING DATA FROM OLD VPS"
echo "=========================================="
echo ""
echo "Old VPS: $OLD_VPS_USER@$OLD_VPS_IP:$OLD_VPS_PORT"
echo "Database: $OLD_DB_PATH"
echo ""

# Create backup directory
BACKUP_DIR="/tmp/ubt-migration-$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Download database from old VPS
echo "📥 Downloading database from old VPS..."
scp -P $OLD_VPS_PORT $OLD_VPS_USER@$OLD_VPS_IP:$OLD_DB_PATH $BACKUP_DIR/database.db

# Stop application
echo "⏸️  Stopping application..."
pm2 stop ubt-app || true

# Backup current database if exists
if [ -f "$NEW_DB_PATH" ]; then
    echo "💾 Backing up current database..."
    cp $NEW_DB_PATH $NEW_DB_PATH.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy downloaded database
echo "📋 Restoring database..."
cp $BACKUP_DIR/database.db $NEW_DB_PATH
chown root:root $NEW_DB_PATH
chmod 644 $NEW_DB_PATH

# Start application
echo "▶️  Starting application..."
pm2 start ubt-app

echo ""
echo "=========================================="
echo "✅ DATA MIGRATION COMPLETE!"
echo "=========================================="
echo ""
echo "Database restored from:"
echo "  $BACKUP_DIR/database.db"
echo ""
echo "Application restarted:"
pm2 status ubt-app
echo ""
echo "Backup location: $BACKUP_DIR"
echo ""
