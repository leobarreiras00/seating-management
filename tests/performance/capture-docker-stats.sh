#!/usr/bin/env bash
# Samples CPU and memory of the limited API container every 5 s into results/docker-stats.csv. Stop with Ctrl+C.
mkdir -p results
OUT="results/${RUN_NAME:-docker}-stats.csv"
echo "time,cpu_percent,mem_usage,mem_percent" > "$OUT"
while true; do
  docker stats --no-stream --format '{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}}' seatly-perf-api | sed "s/^/$(date +%H:%M:%S),/" >> "$OUT"
  sleep 5
done
