#!/bin/bash

# Simple monitoring script for CodeClass server
# Usage: ./scripts/monitor.sh [interval_seconds]

INTERVAL=${1:-2}
BASE_URL=${MONITOR_URL:-http://localhost:4000}

echo "=== CodeClass Server Monitoring ==="
echo "Monitoring: $BASE_URL"
echo "Interval: ${INTERVAL}s"
echo "Press Ctrl+C to stop"
echo ""

while true; do
  clear
  echo "=== CodeClass Monitoring Dashboard ==="
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  
  # Memory metrics
  echo "📊 Memory Usage:"
  MEMORY=$(curl -s "${BASE_URL}/api/v1/monitoring/memory" 2>/dev/null)
  if [ $? -eq 0 ]; then
    echo "$MEMORY" | jq -r '.memory | "  RSS: \(.rss)MB | Heap: \(.heapUsed)MB / \(.heapTotal)MB | Free: \(.heapTotal - .heapUsed | .)MB"' 2>/dev/null || echo "  Error parsing memory data"
  else
    echo "  ❌ Server not responding"
  fi
  
  echo ""
  
  # CPU metrics
  echo "⚡ CPU Usage:"
  CPU=$(curl -s "${BASE_URL}/api/v1/monitoring/cpu" 2>/dev/null)
  if [ $? -eq 0 ]; then
    echo "$CPU" | jq -r '.cpu | "  User: \(.user)μs | System: \(.system)μs | Est: \(.estimatedPercent)%"' 2>/dev/null || echo "  Error parsing CPU data"
  else
    echo "  ❌ Server not responding"
  fi
  
  echo ""
  
  # System info
  echo "ℹ️  System Info:"
  SYSTEM=$(curl -s "${BASE_URL}/api/v1/monitoring/system" 2>/dev/null)
  if [ $? -eq 0 ]; then
    echo "$SYSTEM" | jq -r '.metrics.process | "  Uptime: \(.uptime | . / 60 | floor)min | PID: \(.pid) | Node: \(.nodeVersion)"' 2>/dev/null || echo "  Error parsing system data"
  else
    echo "  ❌ Server not responding"
  fi
  
  echo ""
  echo "Refreshing in ${INTERVAL}s... (Ctrl+C to stop)"
  
  sleep $INTERVAL
done

