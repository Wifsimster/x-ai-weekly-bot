#!/bin/sh
# deploy.sh — Restricted deploy script for X AI Weekly Bot
# This script is called by GitHub Actions via the self-hosted runner.
# It pulls the latest Docker image and restarts the service.

set -eu

COMPOSE_DIR="${X_AI_WEEKLY_BOT_COMPOSE_DIR:-/opt/docker/x-ai-weekly-bot}"

echo "[deploy] Pulling latest image..."
docker compose -f "$COMPOSE_DIR/compose.yml" pull x-ai-weekly-bot

echo "[deploy] Restarting service..."
docker compose -f "$COMPOSE_DIR/compose.yml" up -d x-ai-weekly-bot

echo "[deploy] Cleaning up old images..."
docker image prune -f

echo "[deploy] Done."
