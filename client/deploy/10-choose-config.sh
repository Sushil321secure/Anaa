#!/bin/sh
# Runs before nginx's own template step. HTTPS if a certificate for DOMAIN exists, plain HTTP otherwise,
# so the stack always starts (and the certificate can be issued while it runs).
set -e
mkdir -p /etc/nginx/templates
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  echo "choose-config: certificate found for ${DOMAIN}, serving HTTPS"
  cp /etc/nginx/available/https.conf.template /etc/nginx/templates/default.conf.template
else
  echo "choose-config: no certificate for ${DOMAIN}, serving plain HTTP"
  cp /etc/nginx/available/http.conf.template /etc/nginx/templates/default.conf.template
fi
