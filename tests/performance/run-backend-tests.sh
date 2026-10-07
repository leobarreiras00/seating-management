#!/usr/bin/env bash
# Runs the whole xUnit suite (unit + integration + security) with code coverage and writes a human-readable report.
# Run from the repository root:  ./tests/performance/run-backend-tests.sh
set -uo pipefail
PROJ=backend/SeatingManagement.API.Tests/SeatingManagement.API.Tests.csproj
SETTINGS=backend/SeatingManagement.API.Tests/coverlet.runsettings
OUT=TestResults
rm -rf "$OUT" && mkdir -p "$OUT"

dotnet restore "$PROJ" || exit 1
dotnet build "$PROJ" -c Release --no-restore || exit 1

echo "== Run 1/2: everything (unit + integration + security, with coverage) =="
dotnet test "$PROJ" -c Release --no-build --settings "$SETTINGS" --collect:"XPlat Code Coverage" \
  --results-directory "$OUT/all" --logger "trx;LogFileName=all.trx" 2>&1 | tee "$OUT/all.log"

echo "== Run 2/2: CI selection (same filter as the pipeline; must be 100% green) =="
dotnet test "$PROJ" -c Release --no-build --filter "Status!=KnownOpen" --logger "trx;LogFileName=ci.trx" \
  --results-directory "$OUT/ci" 2>&1 | tee "$OUT/ci.log"

dotnet tool update --global dotnet-reportgenerator-globaltool >/dev/null 2>&1 || dotnet tool install --global dotnet-reportgenerator-globaltool
export PATH="$PATH:$HOME/.dotnet/tools"
reportgenerator -reports:"$OUT/all/**/coverage.cobertura.xml" -targetdir:"$OUT/coverage" \
  -reporttypes:"TextSummary;Html" -assemblyfilters:"+SeatingManagement.API" >/dev/null
echo; echo "== Coverage =="; cat "$OUT/coverage/Summary.txt"

echo; echo "== Failed tests (run 1) =="; grep -E "^\s+Failed " "$OUT/all.log" | sed 's/ \[.*//' | sort || true
echo; echo "Done. Send back: $OUT/all.log, $OUT/ci.log and $OUT/coverage/Summary.txt"
