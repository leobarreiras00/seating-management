# Seatly test assets

| Path | Purpose |
|---|---|
| `backend/SeatingManagement.API.Tests/Integration` | INT-* tests: full ASP.NET Core pipeline with SQLite in memory |
| `backend/SeatingManagement.API.Tests/Security` | SEC-* tests (authentication, authorization, input, configuration) |
| `tests/performance/load.js`, `stress.js` | k6 load and stress scenarios |
| `tests/performance/seed.mjs`, `seed-local.sql` | fictitious data (1000 guests per event) |
| `tests/performance/docker-compose.perf.yml` | local API limited to 0.1 CPU / 512 MB (same as Render Free) |
| `tests/performance/zap.sh` | OWASP ZAP baseline (passive) |
| `tests/performance/run-backend-tests.sh` | xUnit with coverage |

Tests tagged `Status=KnownOpen` assert the secure behaviour that is not implemented yet. They fail on purpose; each failure is a
confirmed finding. CI runs `--filter "Status!=KnownOpen"`.

Credentials are never stored in the repository: scripts read `SEATLY_API`, `SUPERADMIN_EMAIL/PASS`, `GESTOR_EMAIL/PASS`,
`USER_EMAIL/PASS` from the environment.
