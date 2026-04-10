#!/bin/bash
set -e

# ============================================
# Mail Service - Server Setup Script
# Run once on a fresh server (Ubuntu/Debian)
# ============================================

APP_DIR="$HOME/mail"
DOMAIN="mail.extory.co"

echo "=== Mail Service Server Setup ==="
echo ""

# ------------------------------------------
# 1. System packages
# ------------------------------------------
echo "[1/6] Installing system packages..."
sudo apt update -qq
sudo apt install -y -qq nginx certbot python3-certbot-nginx curl git

# ------------------------------------------
# 2. Node.js (v22 LTS via NodeSource)
# ------------------------------------------
if ! command -v node &> /dev/null; then
  echo "[2/6] Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y -qq nodejs
else
  echo "[2/6] Node.js already installed: $(node -v)"
fi

# ------------------------------------------
# 3. pm2
# ------------------------------------------
if ! command -v pm2 &> /dev/null; then
  echo "[3/6] Installing pm2..."
  sudo npm install -g pm2
  pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash
else
  echo "[3/6] pm2 already installed"
fi

# ------------------------------------------
# 4. Clone & setup app
# ------------------------------------------
echo "[4/6] Setting up application..."
if [ ! -d "$APP_DIR" ]; then
  git clone git@github.com:extory/mail.git "$APP_DIR"
fi

cd "$APP_DIR"
mkdir -p data logs

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo ""
  echo "  ⚠  Edit $APP_DIR/.env.local with your API keys!"
  echo ""
fi

npm ci --production=false
npm run build

# ------------------------------------------
# 5. Nginx
# ------------------------------------------
echo "[5/6] Configuring Nginx..."
sudo cp "$APP_DIR/infra/nginx/$DOMAIN.conf" "/etc/nginx/sites-available/$DOMAIN"
sudo ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"

# Temporarily comment out SSL lines for initial certbot run
sudo sed -i 's/listen 443/#listen 443/' "/etc/nginx/sites-enabled/$DOMAIN"
sudo sed -i 's/ssl_/#ssl_/' "/etc/nginx/sites-enabled/$DOMAIN"
sudo nginx -t && sudo systemctl reload nginx

# ------------------------------------------
# 6. SSL Certificate
# ------------------------------------------
echo "[6/6] Obtaining SSL certificate..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@extory.co --redirect

# Restore full config with SSL
sudo cp "$APP_DIR/infra/nginx/$DOMAIN.conf" "/etc/nginx/sites-available/$DOMAIN"
sudo nginx -t && sudo systemctl reload nginx

# ------------------------------------------
# Start app
# ------------------------------------------
echo ""
echo "Starting application..."
cd "$APP_DIR"
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "============================================"
echo "  Setup complete!"
echo ""
echo "  URL: https://$DOMAIN"
echo "  App: pm2 status / pm2 logs mail"
echo ""
echo "  Don't forget:"
echo "  1. Edit $APP_DIR/.env.local with API keys"
echo "  2. DNS: A record for $DOMAIN → server IP"
echo "  3. Resend: verify extory.co domain"
echo "============================================"
