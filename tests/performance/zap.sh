#!/usr/bin/env bash
# OWASP ZAP baseline = PASSIVE scan only (spider + passive rules, no attack payloads): safe for production.
#   ./zap.sh https://<api-host>            (production API, passive)
#   ./zap.sh https://<backoffice-host>     (production back-office, passive)
#   ./zap.sh http://host.docker.internal:8080   (local API)
set -euo pipefail
TARGET="${1:?usage: ./zap.sh <url>}"
NAME="${2:-zap-baseline}"
mkdir -p results && chmod 777 results
docker run --rm -v "$PWD/results:/zap/wrk:rw" -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t "$TARGET" -r "${NAME}.html" -J "${NAME}.json" -w "${NAME}.md" -I
