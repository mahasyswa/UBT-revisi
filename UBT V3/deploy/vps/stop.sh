#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/ubt"

cd "$APP_DIR"
pm2 stop ubt || true
pm2 delete ubt || true
pm2 save

echo "UBT app stopped and removed from pm2." 
