#!/bin/sh
set -e

echo "Starting X AI Weekly Bot..."

exec node dist/scheduler.js
