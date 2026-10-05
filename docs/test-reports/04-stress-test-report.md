# Stress Test Report: Seatly

*This report records how Seatly behaves beyond its expected load: where response times degrade, whether errors appear, and whether the system recovers. It was run against production (read-only) and a local Docker environment limited to the Render Free resources.*

## 1. Document control

*Identification and traceability of this report.*

| Field | Value |
|---|---|
| Document ID | STR-RPT-001 |
| Project | Seatly (seating management for events) |
| Author | Leonardo Barreiras |
| Test period | 07/2026 to 10/2026 |
| Repository / commit | `leobarreiras00/seating-management`, branch `test/integration-security-performance`, commit `96e6fb4` |
| Scripts | `tests/performance/stress.js`, `config.js`, `seed.mjs`, `docker-compose.perf.yml`, `run-local.sh`, `capture-docker-stats.sh` |
| Related reports | INT-RPT-001, SEC-RPT-001, LOAD-RPT-001 |
| Language / format | EN-US, Confluence |

## 2. Objective and scope

*What the test had to find out.*

**Objective.** Find the load at which Seatly degrades and breaks, observe how it fails (slow responses, errors, timeouts), and verify whether it recovers once the load drops.

**In scope**
- Ramp from 10 up to 200 concurrent virtual users (VUs), then back to 10, then a steady recovery period.
- Production (read-only) and local Docker (reads and check-in writes).
- Per-stage latency, error rate, throughput, and API container CPU and memory.

**Out of scope**
- Soak (long-duration) testing and spike testing.
- Write traffic against production.
- Failure injection (database or broker outages).
- Distributed load from several machines.

## 3. Test design

*Stages, think time and criteria, defined before running.*

Each VU repeats a request cycle with a think time of 0.3–0.5 s (much more aggressive than a real device, which waits 3–8 s). The mix is the same as in the load test. Each stage is tagged so results can be read per stage.

| Stage | VUs | Duration | Purpose |
|---|---|---|---|
| s1 | 10 | 30 s | Baseline |
| s2 | 25 | 60 s | Expected peak |
| s3 | 50 | 60 s | Stress begins |
| s4 | 100 | 60 s | High stress |
| s5 | 150 | 60 s | Heavy overload |
| s6 | 200 | 60 s | Breaking point |
| s7 | 200 → 10 | 120 s | Ramp-down |
| s8 | 10 | 300 s | Recovery (steady) |

**Reference criteria** (borrowed from the load test, applied per stage): API p95 < 800 ms and failed requests < 1%. The *degradation point* is the first stage that exceeds the latency threshold; the *breaking point* is the first stage with errors; *recovery* means s8 returns to the s1 baseline.

## 4. Environments and commands

*Same environments as the load test.*

| Item | Production | Local Docker |
|---|---|---|
| API | Render Free (0.1 CPU, 512 MB) | Same image, `cpus: 0.1`, `mem_limit: 512m` |
| Database | Neon PostgreSQL | `postgres:16-alpine` |
| Data | 3 events, 1,000 fictitious guests each | Same seed |
| Traffic | Read-only | Reads and writes (`WRITES=true`) |

```bash
cd tests/performance

# Production stress test (read-only)
k6 run --summary-export=results/stress-prod.json stress.js

# Local Docker stress test (up, wait, seed, capture CPU/memory, run k6, down)
./run-local.sh stress
```

The script writes the per-stage table to `results/<name>-stages.txt`; CPU and memory samples (every 5 s) go to `results/stress-local-stats.csv`. Test credentials were supplied through environment variables and are not stored anywhere in the repository or this report.

## 5. Results: production

*The deployed system under up to 200 concurrent users.*

| Metric | Value |
|---|---|
| Requests | 32,190 (56.2 req/s average) |
| Peak VUs | 200 |
| Failed requests | 0% (0 of 32,190) |
| Checks | 100% (32,185 of 32,185) |
| Overall latency | median 558 ms, p95 2.31 s, p99 3.74 s, max 6.16 s |

| Stage | VUs | Requests | Failed | Median | p95 | p99 | Max |
|---|---|---|---|---|---|---|---|
| s1 Baseline | 10 | 225 | 0% | 92 ms | 160 ms | 193 ms | 274 ms |
| s2 Expected peak | 25 | 1,939 | 0% | 102 ms | 176 ms | 245 ms | 440 ms |
| s3 Stress begins | 50 | 3,991 | 0% | 133 ms | 252 ms | 328 ms | 517 ms |
| s4 High stress | 100 | 5,538 | 0% | 326 ms | 909 ms | 1.34 s | 3.33 s |
| s5 Heavy overload | 150 | 4,789 | 0% | 1.04 s | 2.16 s | 2.96 s | 6.12 s |
| s6 Breaking point | 200 | 4,625 | 0% | 1.70 s | 3.56 s | 4.62 s | 6.16 s |
| s7 Ramp-down | 200 → 10 | 8,629 | 0% | 984 ms | 2.49 s | 4.09 s | 5.29 s |
| s8 Recovery | 10 | 2,449 | 0% | 97 ms | 162 ms | 199 ms | 453 ms |

**Throughput per stage** (requests divided by stage duration):

| Stage | s1 | s2 | s3 | s4 | s5 | s6 | s7 | s8 |
|---|---|---|---|---|---|---|---|---|
| Requests/s | 7.5 | 32 | 67 | 92 | 80 | 77 | 72 | 8.2 |

**Reading the results**
- Up to 50 VUs, latency is nearly flat (p95 252 ms) and throughput scales with load.
- At 100 VUs the p95 first crosses the 800 ms reference (909 ms): this is the degradation point. Throughput peaks at about 92 req/s and then plateaus (80, 77 req/s) while latency keeps growing: the API is saturated, and extra users only add queueing time.
- No request failed at any stage, even at 200 VUs and 6 s worst-case latency. The system degrades by getting slower, not by erroring.
- Recovery is immediate: after the ramp-down, s8 (steady 10 VUs, 5 minutes) returns to median 97 ms and p95 162 ms, matching the s1 baseline (92 ms / 160 ms).

An earlier production run without the recovery stage (29,133 requests, 0% failed) gave the same p95 pattern per stage (183, 192, 285 ms at 10–50 VUs, then 1.13 s, 2.20 s, 3.66 s), so the result is reproducible.

## 6. Results: local Docker (0.1 CPU, 512 MB)

*A deliberately constrained worst case. This is the corrected run (stage clock fixed, 5-minute recovery stage); data from the earlier local run is superseded and not used.*

| Metric | Value |
|---|---|
| Requests | 1,058 (1.28 req/s) |
| Failed requests | 56.7% (600 of 1,058) |
| Overall latency | median 60.0 s, p95 81.0 s, max 81.0 s |
| Successful responses only | median 5.34 s, p95 14.9 s, max 50.0 s |

| Stage | VUs | Requests | Failed | Median | p95 | p99 | Max |
|---|---|---|---|---|---|---|---|
| s1 Baseline | 10 | 64 | 0% | 1.31 s | 6.57 s | 9.82 s | 9.95 s |
| s2 Expected peak | 25 | 216 | 0% | 4.23 s | 10.95 s | 12.42 s | 14.75 s |
| s3 Stress begins | 50 | 207 | 18.8% | 9.70 s | 59.7 s | 60.0 s | 60.0 s |
| s4 High stress | 100 | 114 | 97.4% | 60.0 s | 81.0 s | 81.0 s | 81.0 s |
| s5 Heavy overload | 150 | 97 | 100% | 81.0 s | 81.0 s | 81.0 s | 81.0 s |
| s6 Breaking point | 200 | 173 | 100% | 60.0 s | 60.0 s | 60.0 s | 60.0 s |
| s7 Ramp-down | 200 → 10 | 133 | 100% | 60.0 s | 60.0 s | 60.0 s | 60.0 s |
| s8 Recovery | 10 | 49 | 95.9% | 60.0 s | 60.0 s | 60.0 s | 60.0 s |

```text
http_reqs......................: 1058    1.275522/s
http_req_failed................: 56.71%  600 failed / 458 ok
vus_max........................: 200
thresholds on metrics 'http_req_duration{kind:api}, http_req_failed' have been crossed
```

**Resource usage** (130 samples, 15:22–15:35): CPU average 10.1%, max 34.0%; memory average 140 MiB, max 182.5 MiB of 512 MiB. The CPU is pinned at the 0.1 CPU limit and memory stays below 36%.

**Reading the results**
- Latency is already above the reference at the baseline (p95 6.6 s at 10 VUs), and errors start at 50 VUs (18.8%). From 100 VUs almost every request times out at the 60 s client limit.
- The system did **not** recover within the 5-minute s8 stage (95.9% failures at 10 VUs). The server keeps working through the backlog of requests whose clients already gave up, and with 0.1 CPU the backlog takes longer to clear than the stage lasted.
- The cause is CPU starvation (CPU at the limit, memory free), the same bottleneck seen in the load test. The environment is a conservative worst case: the same API in production sustained 200 VUs with no errors.

## 7. Comparison of the two environments

*Same code and data, very different outcomes.*

| Aspect | Production (Render Free) | Local Docker (0.1 CPU) |
|---|---|---|
| Latency at 10 VUs (p95) | 160 ms | 6.57 s |
| Latency at 25 VUs, expected peak (p95) | 176 ms | 10.95 s |
| First stage over 800 ms p95 | s4 (100 VUs) | s1 (10 VUs) |
| First stage with errors | none | s3 (50 VUs) |
| Errors overall | 0% | 56.7% |
| Recovery at 10 VUs | Immediate (p95 162 ms) | Not within 5 minutes |
| Peak throughput | about 92 req/s | about 3.4 req/s (s2) |

The large gap shows that a hard 0.1 CPU container limit is much harsher than Render Free behaves in practice, so the production run is the realistic figure and the local run is the safety margin. The local run also includes writes, which cost more than the production read-only mix.

## 8. Analysis

1. **Capacity margin.** The expected peak is 20 devices (about 3.6 req/s). Production sustained about 92 req/s, roughly 25 times that, before saturating, and kept answering without errors up to 200 VUs.
2. **Failure mode.** Production fails "soft": queueing makes responses slower (p95 3.6 s at 200 VUs) but nothing is dropped. For the door devices this means a slow scan, not a failed one, which is the safer failure mode for event check-in.
3. **Bottleneck.** The API is CPU-bound (see CPU pinned at about 10% of the host in the local run); memory is not a constraint. The most CPU-expensive operation is login (BCrypt).
4. **Recovery.** Production recovers as soon as the load drops. A constrained instance can stay degraded for minutes after an overload because of the backlog, so any restart or rate-limiting that sheds load early would help (see S-11 in SEC-RPT-001).

## 9. Limitations

- Production traffic was read-only; write-heavy overload was measured only locally.
- Think time (0.3–0.5 s) is far shorter than real devices; VU counts are therefore not equal to real devices (200 VUs here are far more than 200 real users).
- Load was generated from one machine and one network location.
- Only one production stress run with a recovery stage and one corrected local run were executed; local results show high run-to-run variance.
- The test ran against shared free-tier infrastructure (Render, Neon), whose resources can change without notice; the results describe the state at test time.
- Cold starts, failure injection and long-running (soak) behaviour were not tested.

## 10. Risks and recommendations

| Priority | Recommendation |
|---|---|
| 1 | Document the measured capacity: comfortable up to 50 VUs, degraded above 100 VUs, no errors up to 200 VUs (production, read-only) |
| 2 | Add rate limiting on login and the contact form, so a burst cannot take the CPU away from check-in traffic (S-11) |
| 3 | For events expected to exceed 100 simultaneous active clients, move to a paid API instance with more CPU |
| 4 | Add client-side timeouts and retry with back-off in the Android app, so a slow server does not create a retry storm |
| 5 | Repeat the stress test with a write mix on a staging copy of the production stack before relying on write capacity |

## 11. Conclusion

*Overall assessment.*

In production, Seatly handled up to 200 concurrent virtual users with 0% failed requests out of 32,190, degraded gracefully from 100 VUs (p95 909 ms, throughput plateauing at about 92 req/s) and returned to its baseline (p95 162 ms) as soon as the load fell. That is about 25 times the expected event peak. In the deliberately constrained local environment (0.1 CPU) the system saturates at about 25–50 VUs and does not recover within 5 minutes, which identifies CPU as the limiting resource and defines the lower bound of the safety margin.
