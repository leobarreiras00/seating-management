# Load Test Report: Seatly

*This report records the load test of Seatly under the usage expected for one large event. It was run against production (read-only) and against a local Docker environment limited to the Render Free resources.*

## 1. Document control

*Identification and traceability of this report.*

| Field | Value |
|---|---|
| Document ID | LOAD-RPT-001 |
| Project | Seatly (seating management for events) |
| Author | Leonardo Barreiras |
| Test period | 07/2026 to 10/2026 |
| Repository / commit | `leobarreiras00/seating-management`, branch `test/integration-security-performance`, commit `96e6fb4` |
| Scripts | `tests/performance/load.js`, `config.js`, `seed.mjs`, `seed-local.sql`, `docker-compose.perf.yml`, `run-local.sh` |
| Related reports | INT-RPT-001, SEC-RPT-001, STR-RPT-001 (Stress) |
| Language / format | EN-US, Confluence |

## 2. Objective and scope

*What the test had to demonstrate, and what it does not cover.*

**Objective.** Check that the Seatly API meets its response-time and error targets under the load of a single large event: about 20 door devices scanning guests, 3 managers using the back-office, and interactive logins.

**In scope**
- Read endpoints on production: dashboard, event list, seat list, audit trail, login.
- Check-in writes (seat status update) in the local Docker environment only.
- Resource usage (CPU, memory) of the API container.

**Out of scope**
- Load beyond the expected usage (see the Stress report).
- Write traffic against production, which is blocked by a guard in `config.js` for any `onrender.com` host.
- MQTT publishing (the broker is unreachable on purpose locally) and e-mail sending.
- Android client behaviour and network conditions of real venues.

## 3. Usage model and thresholds

*How the load was derived, and the pass criteria, defined before running the tests.*

| Scenario | Executor | Load | Behaviour |
|---|---|---|---|
| `staff` (door devices) | ramping VUs | 0 → 20 VUs in 1 min, 20 VUs for 5 min, 0 in 30 s | One request per cycle, think time 3–8 s; 10% of cycles are a full seat-list sync; the rest are `GET /api/Event/my-events` on production, or `PUT /api/Seat/{eventId}/update/{seatId}` locally (85% marked, 15% cleared) |
| `manager` | constant VUs | 3 VUs, 6.5 min | Dashboard, my events, seat list, audit trail, think time 10–20 s |
| `login` | constant arrival rate | 6 logins/min, 6.5 min | `POST /api/Auth/login`, measured separately because BCrypt is CPU bound |

**Rationale.** 20 devices with a mean cycle of about 5.5 s generate about 3.6 requests/s. For comparison, 1,000 guests arriving over 15 minutes is about 1.1 check-ins/s at peak, so the model is roughly 3 times the expected peak.

| Threshold | Limit |
|---|---|
| Failed requests | < 1% |
| Checks | > 99% |
| API response time (`kind:api`) | p95 < 800 ms, p99 < 2,000 ms |
| Login response time (`kind:login`) | p95 < 3,000 ms |

## 4. Environments

*Two environments with different purposes.*

| Item | Production run | Local Docker run |
|---|---|---|
| API | Render Free (0.1 CPU, 512 MB), `https://api-seatly.onrender.com` | Same image, `cpus: 0.1`, `mem_limit: 512m` |
| Database | Neon PostgreSQL | `postgres:16-alpine` container |
| Data | 3 events ("Perf Gala 1..3") with 1,000 fictitious guests each | Same seed (`seed.mjs`, `seed-local.sql`) |
| Traffic | Read-only | Reads and check-in writes (`WRITES=true`) |
| Purpose | Real behaviour of the deployed system | Deliberate worst case, with measurable resources |

Test data is fictitious. Credentials were passed through environment variables and are not stored in the repository or in this report.

## 5. Commands executed

*Reproducible commands, from the repository root unless stated.*

```bash
# Seed the test data (production, once)
node tests/performance/seed.mjs

# Production load test (read-only)
cd tests/performance
k6 run --summary-export=results/load-prod.json load.js

# Local Docker load test (compose up, wait, seed, capture CPU/memory, run k6, compose down)
./run-local.sh load

# Resource sampling (every 5 s) used by run-local.sh
./capture-docker-stats.sh   # writes results/<RUN_NAME>-stats.csv
```

## 6. Results: production (read-only)

*The deployed system under the expected event load.*

| Metric | Value |
|---|---|
| Requests | 1,586 (3.9 req/s) |
| Iterations | 1,353 |
| Peak VUs | 25 |
| Failed requests | 0% (0 of 1,586) |
| Checks | 100% (1,541 of 1,541 passed) |
| Warm-up (`/health`) | 147 ms |

| Group | Median | p95 | p99 | Max |
|---|---|---|---|---|
| API (`kind:api`) | 79.5 ms | 183 ms | 706 ms | 966 ms |
| Login (`kind:login`) | 1.19 s | 1.52 s | 2.48 s | n/a |
| All requests | 80.6 ms | 293 ms | 1.20 s | 2.78 s |

| Threshold | Limit | Result | Status |
|---|---|---|---|
| Failed requests | < 1% | 0% | Pass |
| Checks | > 99% | 100% | Pass |
| API p95 | < 800 ms | 183 ms | Pass |
| API p99 | < 2,000 ms | 706 ms | Pass |
| Login p95 | < 3,000 ms | 1.52 s | Pass |

```text
checks.........................: 100.00% 1541 out of 1541
http_req_failed................: 0.00%   0 out of 1586
http_reqs......................: 1586    3.907/s
http_req_duration..............: med=80.6ms p(95)=293ms p(99)=1.2s max=2.78s
```

An earlier production run (1,570 requests) gave API p95 207 ms and login p95 1.56 s, so the result is consistent between runs. The "all requests" figures are higher than the API figures because they include the login requests, which are CPU-heavy by design (BCrypt).

## 7. Results: local Docker (0.1 CPU, 512 MB)

*A deliberately constrained environment with writes enabled; it shows where the limits are, not how production behaves.*

| Metric | Run 1 | Run 2 |
|---|---|---|
| Requests | 837 | 366 |
| Failed requests | 0% | 12.8% (47 of 366) |
| Checks | 100% | 93.2% |
| Median (all) | 4.4 s | 17.8 s |
| p95 (all) | 15.6 s | 60.0 s (k6 timeout) |
| Max | 45.2 s | 60.0 s |
| API p95 / login p95 | 11.2 s / 41.8 s | see note |
| Thresholds | API p95, API p99 and login p95 failed | All five failed |

**Resource usage** (5-second samples):

| Run | Samples | CPU average | CPU max | Memory average | Memory max |
|---|---|---|---|---|---|
| Run 1 | 69 | 10.2% | 12.6% | 127 MiB | 132 MiB |
| Run 2 | 73 | 10.1% | 13.3% | 136 MiB | 146 MiB |

```text
time,cpu_percent,mem_usage,mem_percent
14:33:25,10.57%,129.6MiB / 512MiB,25.31%
```

**Interpretation**
- CPU stays pinned at about 10% of the host, which is the 0.1 CPU limit, while memory uses only 25–30% of 512 MiB. The API is therefore CPU-bound, not memory-bound.
- Run-to-run variance is very high at this limit (837 requests with no errors versus 366 requests with 12.8% errors). Requests that exceed the 60 s k6 timeout are abandoned by the client, but the server keeps processing the backlog, which makes the next seconds worse.
- The same API and data on Render Free respond in a median of 80 ms, so the local environment is a conservative worst case and should not be read as a production forecast.

## 8. Analysis

*What the two environments say together.*

1. On production, the expected load of one large event (about 3 times the estimated peak) is handled with 0% errors and response times well inside the thresholds.
2. Login is the slowest operation (median 1.19 s) because of BCrypt. It stays inside its threshold at 6 logins/min, and it is the first operation to degrade under CPU starvation (41.8 s in run 1 locally).
3. With only 0.1 CPU the system has no headroom when CPU is the constraint, which is why the local results degrade sharply and unpredictably. Production on Render Free benefits from burst capacity that a hard container limit does not reproduce.

## 9. Limitations

*What these results do not prove.*

- Production traffic was read-only; check-in writes were measured only locally, so write latency on Neon is not measured.
- The usage model is an estimate (20 devices, 3 managers), not measured data from a real event.
- Render Free can sleep after inactivity; the run began with a warm-up (`/health`, 147 ms), so cold-start time is not part of these figures. UptimeRobot keeps the service warm in normal operation.
- The test client runs on a single machine and network; latency from real venue networks (mobile data, Wi-Fi) is not included.
- Local results are highly variable; two runs are not enough for statistical conclusions about that environment.
- The Neon free-tier compute and Render resources can change without notice.

## 10. Risks and recommendations

| Priority | Recommendation |
|---|---|
| 1 | Before a large event, wake the service and run a short smoke test (`/health` plus one login) to avoid cold-start surprises |
| 2 | Keep the login rate low in operation; consider longer token lifetimes only together with revocation (see SEC-RPT-001, S-13) |
| 3 | If events grow beyond about 20 devices, move the API to a paid instance with at least 0.5 CPU; BCrypt cost 11 is the main CPU consumer |
| 4 | Repeat the write scenario against a staging copy of the production stack before the final release |

## 11. Conclusion

*Overall assessment.*

Under the modelled load of a large event, production meets every threshold: 0% failed requests, 100% checks, API p95 183 ms (limit 800 ms) and p99 706 ms (limit 2,000 ms), and login p95 1.52 s (limit 3 s). The local run at 0.1 CPU shows the system is CPU-bound and degrades sharply and unpredictably when resources are that low, which defines the margin and motivates the stress test. The capacity limit of the production system is explored in the Stress Test Report.
