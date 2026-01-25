#!/bin/bash

# Quick benchmark script for CodeClass API
# Usage: ./scripts/benchmark.sh [endpoint]

ENDPOINT=${1:-/api/v1/health}
BASE_URL=${MONITOR_URL:-http://localhost:4000}
FULL_URL="${BASE_URL}${ENDPOINT}"

echo "=== CodeClass API Benchmark ==="
echo "Endpoint: $FULL_URL"
echo ""

# Check if autocannon is installed
if ! command -v autocannon &> /dev/null; then
  echo "⚠️  autocannon not found. Installing..."
  npm install -g autocannon
fi

echo "Running benchmark..."
echo ""

autocannon \
  --connections 10 \
  --pipelining 1 \
  --duration 30 \
  --method GET \
  "$FULL_URL"

echo ""
echo "✅ Benchmark complete!"

