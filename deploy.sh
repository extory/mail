#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="mail"

cd "$APP_DIR"

echo "=== Mail Service Deploy ==="
echo "Directory: $APP_DIR"

# 1. Pull latest
echo "[1/4] Pulling latest code..."
git pull origin main

# 2. Install deps
echo "[2/4] Installing dependencies..."
npm ci --production=false

# 3. Build
echo "[3/4] Building..."
npm run build

# 4. Ensure data & logs dirs
mkdir -p "$APP_DIR/logs" "$APP_DIR/data"
if [ -f "$APP_DIR/data/mail.db" ]; then
  echo "    Database exists ($(du -h "$APP_DIR/data/mail.db" | cut -f1))"
else
  echo "    No database yet - will be created on first request"
fi

# 5. Restart with pm2
echo "[4/4] Restarting service..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME"
else
  pm2 start ecosystem.config.js
fi

pm2 save

echo ""
echo "=== Done! ==="
echo "Running at http://localhost:3100"
echo ""
echo "Useful commands:"
echo "  pm2 status        - check all services"
echo "  pm2 logs mail     - view logs"
echo "  pm2 restart mail  - restart"
echo "  pm2 stop mail     - stop"
