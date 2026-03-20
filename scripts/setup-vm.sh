#!/usr/bin/env bash
# setup-vm.sh — Impacto platform VM bootstrap
# Run as: sudo bash setup-vm.sh
# Tested on: Ubuntu 22.04 LTS ARM64 (Oracle Cloud Ampere A1)
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR="/opt/impacto"

echo "==> Updating system packages"
apt-get update -qq && apt-get upgrade -y -qq

echo "==> Installing system dependencies"
apt-get install -y -qq \
  curl git nginx certbot python3-certbot-nginx \
  python3.11 python3.11-venv python3-pip \
  build-essential

echo "==> Installing Node.js 20 (via NodeSource)"
if ! command -v node &>/dev/null || [[ "$(node --version | cut -d. -f1)" != "v20" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
node --version

echo "==> Installing PM2 globally"
npm install -g pm2 --quiet
pm2 --version

echo "==> Creating app directory"
mkdir -p "$APP_DIR"/{frontend,backend,scripts}
chown -R ubuntu:ubuntu "$APP_DIR"

echo "==> Configuring Nginx"
if [ -n "$DOMAIN" ]; then
  sed "s/<domain>/$DOMAIN/g" "$APP_DIR/nginx/impacto.conf" \
    > /etc/nginx/sites-available/impacto
  ln -sf /etc/nginx/sites-available/impacto /etc/nginx/sites-enabled/impacto
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  echo "==> Obtaining Let's Encrypt certificate for $DOMAIN"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    --email admin@"$DOMAIN" --redirect
else
  echo "WARNING: No domain provided — skipping Nginx SSL setup."
  echo "Run: sudo bash setup-vm.sh your.domain.com"
fi

echo "==> Setup complete"
echo "Next steps:"
echo "  1. Clone the repo into $APP_DIR"
echo "  2. Install frontend deps: cd $APP_DIR/frontend && npm install && npm run build"
echo "  3. Install backend deps: cd $APP_DIR/backend && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt"
echo "  4. Create .env files from .env.example in frontend/ and backend/"
echo "  5. Start services: pm2 start ecosystem.config.js"
