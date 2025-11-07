#!/usr/bin/env bash
set -euo pipefail

# Start the UBT app using pm2 (assumes app is at /opt/ubt)
APP_DIR="/opt/ubt"

cd "$APP_DIR"
pm2 start server.js --name ubt --cwd "$APP_DIR" --time || pm2 restart ubt
pm2 save

echo "UBT app started via pm2. To view logs: pm2 logs ubt"
