# Integration Test Report: Seatly

*Automated end-to-end verification of the Seatly API through the real ASP.NET Core request pipeline: routing, JWT authentication, role and object-level authorization, model binding, controllers, EF Core persistence and side effects (audit log, MQTT notifications, e-mails).*

| Field | Value |
|---|---|
| Report ID | INT-2026-10-05 |
| Date | October 5, 2026 |
| System under test | Seatly API (ASP.NET Core, .NET 10, EF Core 10) |
| Commit | `9e00288` (branch `test/integration-security-performance`) |
| Test framework | xUnit 2.9.3, `Microsoft.AspNetCore.Mvc.Testing` 10.0.12 |
| Test database | SQLite in memory (EF Core SQLite 10.0.12) |
| Executed on | MacBook Air (Apple M2, macOS), .NET 10 (`net10.0`) |
| Verdict | **PASSED: 102 of 102 integration cases, 0 failures** |

---

## 1. Objective and Scope

*What this report verifies, and what it deliberately does not.*

The integration suite verifies that the Seatly API behaves correctly when all its layers work together. Unit tests check isolated methods and load tests measure performance. These tests send real HTTP requests through the complete pipeline and check status codes, response bodies, database state, audit records and notifications.

**In scope**
- Authentication and account lifecycle (login, first-login reset, forgot/reset/change password, registration, deletion, avatar, contact form)
- Events: creation, update, deletion, user assignment, "my events" visibility
- Seats: reading, status changes, ticket validation, bulk update, walk-in, edit and delete of guests
- CSV import and clear (validation, replace/add modes, duplicates, size limit, 1,000-guest volume)
- Companies: creation, update, logo, deletion rules, managers/users/events listings, access removal
- Analytics dashboard, audit trail, health endpoint and system behavior

**Out of scope** (covered elsewhere)
- Security attack scenarios, payload fuzzing, IDOR matrices → *Security Test Report*
- Latency, throughput, saturation → *Load Test Report* and *Stress Test Report*
- Android app, back-office UI and the real HiveMQ, Brevo and Neon services (see Section 9)

---

## 2. Test Environment and Execution

*Tools, versions and the exact commands used, so the run can be reproduced.*

| Component | Technology | Version |
|---|---|---|
| Runtime | .NET | 10 (`net10.0`) |
| Test framework | xUnit + xunit.runner.visualstudio | 2.9.3 / 4.0.0 |
| Test host | `WebApplicationFactory<Program>` (Microsoft.AspNetCore.Mvc.Testing) | 10.0.12 |
| Database | SQLite in-memory (`Microsoft.EntityFrameworkCore.Sqlite`) | 10.0.12 |
| Password hashing in tests | BCrypt.Net-Next, work factor 4 (production: library default) | 4.2.0 |
| Coverage | coverlet.collector + ReportGenerator | 6.0.4 |
| Test SDK | Microsoft.NET.Test.Sdk | 18.10.1 |

**Commands executed** (from the repository root):

```bash
# Full run: unit + integration + security, with coverage
./tests/performance/run-backend-tests.sh

# Integration suite only, with its own coverage report
dotnet test backend/SeatingManagement.API.Tests/SeatingManagement.API.Tests.csproj -c Release \
  --filter "Suite=Integration" \
  --settings backend/SeatingManagement.API.Tests/coverlet.runsettings \
  --collect:"XPlat Code Coverage" --results-directory TestResults/integration

reportgenerator -reports:"TestResults/integration/**/coverage.cobertura.xml" \
  -targetdir:TestResults/integration-coverage -reporttypes:TextSummary \
  -assemblyfilters:"+SeatingManagement.API"
```

**Continuous integration** runs the same project on every push and pull request:

```bash
dotnet test backend/SeatingManagement.API.Tests/SeatingManagement.API.Tests.csproj \
  --no-build -c Release --filter "Status!=KnownOpen" --logger "trx;LogFileName=results.trx"
```

---

## 3. Test Architecture

*How the in-process test server is built, what is replaced by test doubles, and how tests stay independent.*

```
Test method → HttpClient → Full ASP.NET Core pipeline → Controller → EF Core → SQLite (in memory)
                              (CORS, JWT, authorization, routing, model binding, filters: all real)
```

`SeatlyWebApplicationFactory` boots the real `Program` in a `Testing` environment. Only the system edges are replaced:

| Production dependency | Replaced by | Why / what is still verified |
|---|---|---|
| PostgreSQL (Neon) via Npgsql | SQLite in memory (`EnsureCreated`) | Isolated, fast, disposable. Queries and constraints still run through EF Core. |
| HiveMQ MQTT client (hosted service) | `FakeMqttService` | Tests assert **which** seat updates and commands the API publishes. |
| Brevo e-mail API | `FakeEmailService` | Tests assert recipients, tokens and temporary passwords that would be sent. |
| Migration and `DbInitializer` startup block | Skipped in `Testing` environment | The schema is created from the model; the seed is deterministic (below). |

**Deterministic seed** (re-created for every test class):

| Entity | Content |
|---|---|
| Companies | "Seatly Admin" (id 1), "Acme Test" (2), "Globex Test" (3) |
| Users | 1 SuperAdmin; Gestor + Utilizador for Acme; Gestor + Utilizador for Globex; 1 Utilizador flagged `MustChangePassword` |
| Events | Acme Gala (2 users assigned, 5 seats: Vazio/Marcado/Tratado mix), Acme Conference (Gestor only, 3 seats), Globex Summit (3 seats) |
| Audit log | 4 pre-existing entries |

**Isolation rules**
- Each test class has its own factory and therefore its own in-memory database.
- Tests that change data create their own event/user through helpers (`CreateEventAsync`, `CreateUserAsync`), so they do not depend on execution order.
- JWTs are obtained through the real `/api/Auth/login` endpoint, never fabricated, except in the Security suite.

**Naming and traits.** Test IDs follow `INT_<MODULE>_<NN>_<Subject>_<Condition>_<Expected>`. Every class carries `[Trait("Suite","Integration")]`, which allows `--filter "Suite=Integration"`.

---

## 4. Results Summary

*Outcome of the run and the evidence log.*

| Metric | Value |
|---|---|
| Integration test methods | 100 |
| Executed cases (2 methods are parameterized with 2 data rows each) | **102** |
| Passed | **102** |
| Failed / Skipped | 0 / 0 |
| Duration | 3 s |
| Line coverage (integration only) | 85.1% |
| Branch coverage (integration only) | 69.5% |

```text
Passed!  - Failed:     0, Passed:   102, Skipped:     0, Total:   102, Duration: 3 s - SeatingManagement.API.Tests.dll (net10.0)
```

Full-suite context (same commit, same day):

```text
All tests (unit + integration + security) : Total 233, Passed 208, Failed 25   <- the 25 are Security "KnownOpen" findings
CI selection (--filter "Status!=KnownOpen") : Passed!  - Failed: 0, Passed: 207, Skipped: 0, Total: 207, Duration: 3 s
```

| Suite | File | Cases | Passed |
|---|---|---|---|
| Authentication | `AuthIntegrationTests.cs` | 32 | 32 |
| Events | `EventIntegrationTests.cs` | 12 | 12 |
| Seats | `SeatIntegrationTests.cs` | 18 | 18 |
| CSV import/clear | `CsvIntegrationTests.cs` | 16 | 16 |
| Companies | `CompanyIntegrationTests.cs` | 10 | 10 |
| Analytics, Audit, System | `AnalyticsAuditSystemIntegrationTests.cs` | 14 | 14 |
| **Total** | | **102** | **102** |

---

## 5. Test Suites

*One table per module: scenario, endpoint, and the expected result that the test asserts. All rows passed.*

### 5.1 Authentication: `INT_AUTH` (32/32 ✅)

| ID | Scenario | Endpoint | Expected |
|---|---|---|---|
| 01 | Valid credentials | `POST /api/Auth/login` | 200 + token, role, company |
| 02 | Wrong password | `POST /api/Auth/login` | 401 |
| 03 | Unknown user | `POST /api/Auth/login` | 401 |
| 04 | Invalid e-mail format (2 data rows) | `POST /api/Auth/login` | 400 |
| 05 | Empty body | `POST /api/Auth/login` | 400 |
| 06 | User still has a temporary password | `POST /api/Auth/login` | 403 + reset-required flag |
| 07 | First-login reset, valid temporary password | `POST /api/Auth/first-login-reset` | 200 + token, flag cleared |
| 08 | First-login reset, wrong temporary password | `POST /api/Auth/first-login-reset` | 401 |
| 09 | First-login reset already completed | `POST /api/Auth/first-login-reset` | 400 |
| 10 | New password too short | `POST /api/Auth/first-login-reset` | 400 |
| 11 | Forgot password, existing user | `POST /api/Auth/forgot-password` | 200 + e-mail with 1-hour token |
| 12 | Forgot password, unknown e-mail | `POST /api/Auth/forgot-password` | 200, same message, nothing sent |
| 13 | Reset with valid token; token is single-use | `POST /api/Auth/reset-password` | 200, then 400 on reuse |
| 14 | Reset with invalid token | `POST /api/Auth/reset-password` | 400 |
| 15 | Reset with expired token | `POST /api/Auth/reset-password` | 400 |
| 16 | Change password, wrong old password | `PUT /api/Auth/change-password` | 400 |
| 17 | Change password, correct old password | `PUT /api/Auth/change-password` | 200 + audit entry |
| 18 | Change password, anonymous | `PUT /api/Auth/change-password` | 401 |
| 19 | Gestor registers user in own company; full onboarding flow works | `POST /api/Auth/register` | 200 → e-mail → first login |
| 20 | Duplicate e-mail | `POST /api/Auth/register` | 409 |
| 21 | Non-existent company | `POST /api/Auth/register` | 400 |
| 22 | Caller is a Utilizador | `POST /api/Auth/register` | 403 |
| 23 | Contact form, valid message | `POST /api/Auth/contact` | 200 + e-mail to support |
| 24 | Contact form, missing field (2 data rows) | `POST /api/Auth/contact` | 400 |
| 25 | Contact message over 2,000 characters | `POST /api/Auth/contact` | 400 |
| 26 | SuperAdmin sees everyone; Gestor sees own company without SuperAdmins | `GET /api/Auth/users` | 200, scoped list |
| 27 | Utilizador / anonymous | `GET /api/Auth/users` | 403 / 401 |
| 28 | Gestor deletes own-company user; audited; login blocked afterwards | `DELETE /api/Auth/user/{id}` | 200, then 401 on login |
| 29 | Delete user of another company or a SuperAdmin | `DELETE /api/Auth/user/{id}` | 404 |
| 30 | Avatar update: own account / another user | `PUT /api/Auth/user/{id}/avatar` | 200 / 404 |

### 5.2 Events: `INT_EVT` (12/12 ✅)

| ID | Scenario | Endpoint | Expected |
|---|---|---|---|
| 01 | Gestor creates event; belongs to Gestor's company and is assigned to creator | `POST /api/Event` | 200 |
| 02 | SuperAdmin creates event; belongs to "Seatly Admin" | `POST /api/Event` | 200 |
| 03 | Anonymous | `POST /api/Event` | 401 |
| 04 | Only events assigned to the caller are listed | `GET /api/Event/my-events` | 200, filtered |
| 05 | Gestor updates own-company event; clients notified over MQTT | `PUT /api/Event/{id}` | 200 |
| 06 | Update event of another company / unknown event | `PUT /api/Event/{id}` | 403 |
| 07 | Update as Utilizador | `PUT /api/Event/{id}` | 403 |
| 08 | Gestor assigns same-company user; user gains access to the event's seats | `POST /api/Event/{id}/assign-user` | 200 (access 403 → 200) |
| 09 | Duplicate assignment | `POST /api/Event/{id}/assign-user` | 400 |
| 10 | Cross-company or unknown target user | `POST /api/Event/{id}/assign-user` | 400 / 403 / 404 |
| 11 | SuperAdmin deletes event and its seats | `DELETE /api/Event/{id}` | 200 |
| 12 | Gestor deletes / unknown event | `DELETE /api/Event/{id}` | 403 / 404 |

### 5.3 Seats: `INT_SEAT` (18/18 ✅)

| ID | Scenario | Endpoint | Expected |
|---|---|---|---|
| 01 | Assigned user lists seats of the event | `GET /api/Seat/{eventId}` | 200, all seats |
| 02 | User not assigned to the event | `GET /api/Seat/{eventId}` | 403 |
| 03 | Gestor sees any event of own company; SuperAdmin any; Gestor not other company | `GET /api/Seat/{eventId}` | 200 / 200 / 403 |
| 04 | List all seats: SuperAdmin only | `GET /api/Seat` | 200 / 403 |
| 05 | Valid status change persists, increments `Version`, publishes MQTT update | `PUT /api/Seat/{id}` | 200 |
| 06 | Back to Vazio clears `MarkedAt` | `PUT /api/Seat/{id}` | 200 |
| 07 | Invalid status / unknown seat / foreign seat | `PUT /api/Seat/{id}` | 400 / 404 / 404 |
| 08 | Single-seat update audits only when the status really changes | `PUT /api/Seat/{eventId}/update/{seatId}` | 200 |
| 09 | Seat belongs to another event | `PUT /api/Seat/{eventId}/update/{seatId}` | 404 |
| 10 | Ticket validation marks seat, audits, publishes | `POST /api/Seat/validate-ticket` | 200 |
| 11 | Ticket already used | `POST /api/Seat/validate-ticket` | 400 |
| 12 | Unknown ticket / forbidden event | `POST /api/Seat/validate-ticket` | 404 / 403 |
| 13 | Bulk update changes every seat, writes one audit entry | `PUT /api/Seat/{eventId}/bulk-status` | 200 |
| 14 | Bulk update with invalid status | `PUT /api/Seat/{eventId}/bulk-status` | 400 |
| 15 | Walk-in creates a pending seat with trimmed number and audit | `POST /api/Seat/event/{eventId}/walkin` | 200 |
| 16 | Edit guest; audit stores before/after diff | `PUT /api/Seat/{id}/edit` | 200 |
| 17 | Edit / delete a foreign or unknown seat | `PUT /api/Seat/{id}/edit`, `DELETE /api/Seat/{id}` | 404 |
| 18 | Delete guest removes the seat and audits | `DELETE /api/Seat/{id}` | 200 |

### 5.4 CSV Import and Clear: `INT_CSV` (16/16 ✅)

| ID | Scenario | Endpoint | Expected |
|---|---|---|---|
| 01 | Valid file creates seats, audits, notifies clients | `POST /api/SeatCsv/import/{eventId}` | 200 |
| 02 | Replace mode removes previous seats | same | 200, old seats gone |
| 03 | Add mode keeps previous seats | same (`mode=add`) | 200, old + new |
| 04 | Duplicate seat numbers collapse to one | same | 200 |
| 05 | Duplicate keeps the already validated seat (highest status) | same | 200 |
| 06 | Missing table or seat → error with line numbers | same | 400 |
| 07 | Entire column empty → consolidated error | same | 400 |
| 08 | Comma-separated file → hint about the `;` separator | same | 400 |
| 09 | Unsupported extension / empty file | same | 400 |
| 10 | File larger than 5 MB | same | 400 |
| 11 | No file part | same | 400 |
| 12 | Event the caller cannot access | same | 403 |
| 13 | Accented names preserved as UTF-8 | same | 200 |
| 14 | **1,000 guests** imported and all persisted | same | 200, 1,000 rows |
| 15 | Clear removes all seats of the event and audits | `POST /api/SeatCsv/clear/{eventId}` | 200 |
| 16 | Clear on a foreign event keeps data | `POST /api/SeatCsv/clear/{eventId}` | 403 |

### 5.5 Companies: `INT_COMP` (10/10 ✅)

| ID | Scenario | Endpoint | Expected |
|---|---|---|---|
| 01 | SuperAdmin creates company; appears in list; back-office notified | `POST /api/Company`, `GET /api/Company` | 200 |
| 02 | Empty name / non-SuperAdmin | `POST /api/Company` | 400 / 403 |
| 03 | Update persists and notifies company users | `PUT /api/Company/{id}` | 200 / 404 |
| 04 | Logo stored; empty or unknown rejected | `PUT /api/Company/{id}/logo` | 200 / 400 / 404 |
| 05 | Delete blocked when it has users or is the caller's own; allowed when empty | `DELETE /api/Company/{id}` | 400 / 200 / 404 |
| 06 | Caller's own company | `GET /api/Company/my-company` | 200 |
| 07 | Managers and users listed per company by role | `GET /api/Company/{id}/managers`, `/users` | 200 |
| 08 | Company events report total and treated seats | `GET /api/Company/{id}/events` | 200 |
| 09 | Create event for a company: SuperAdmin only | `POST /api/Company/{id}/events` | 200 / 403 / 404 |
| 10 | Remove access revokes the user's access to the event | `DELETE /api/Company/{id}/events/{eventId}/assign/{userId}` | 200, then 403 |

### 5.6 Analytics, Audit and System: `INT_ANA`, `INT_AUD`, `INT_SYS` (14/14 ✅)

| ID | Scenario | Endpoint | Expected |
|---|---|---|---|
| ANA-01 | Gestor sees only own-company data | `GET /api/Analytics/dashboard` | 200 |
| ANA-02 | Utilizador sees only assigned events | same | 200 |
| ANA-03 | SuperAdmin sees everything | same | 200 |
| ANA-04 | Timeline and progress figures are consistent | same | 200 |
| ANA-05 | Anonymous | same | 401 |
| AUD-01 | Events overview is scoped and counts logs | `GET /api/Audit/events-overview` | 200 |
| AUD-02 | Utilizador / anonymous | same | 403 / 401 |
| AUD-03 | Logs are paged, newest first | `GET /api/Audit/event/{id}` | 200 |
| AUD-04 | Event of another company | `GET /api/Audit/event/{id}` | 403 |
| SYS-01 | Health check answers GET and HEAD | `/health` | 200 |
| SYS-02 | Root returns the "online" message | `GET /` | 200 |
| SYS-03 | Unknown route | `GET /api/DoesNotExist` | 404 |
| SYS-04 | Swagger not exposed outside Development | `GET /swagger/...` | 404 |
| SYS-05 | E-mail templates HTML-encode user-supplied text | (template unit within pipeline) | encoded output |

---

## 6. Baseline Unit Tests

*Tests that existed before this effort and run in the same project.*

| File | Cases | Result |
|---|---|---|
| `AuthDtoValidationTests.cs` | DTO validation rules | ✅ |
| `PasswordHashingTests.cs` | bcrypt hashing and verification | ✅ |
| **Total** | **14** | **14/14 ✅** |

They are not part of the 102 integration cases but are included in the 233-test full run and in the coverage of the full suite.

---

## 7. Code Coverage

*How much of the API code the integration suite executes, and why some classes show 0%.*

Measured with coverlet (Cobertura) and summarized with ReportGenerator. EF Core migrations (generated code) are excluded in `coverlet.runsettings`.

| Metric | Integration only | Full suite (233 tests) |
|---|---|---|
| Line coverage | **85.1%** (1,013 / 1,189) | 86.2% (1,025 / 1,189) |
| Branch coverage | **69.5%** (299 / 430) | 73.9% (318 / 430) |
| Method coverage | 85.1% (69 / 81) | 85.1% (69 / 81) |

| Class | Integration only | Full suite |
|---|---|---|
| AnalyticsController | 98% | 98% |
| AuditController | 100% | 100% |
| AuthController | 98.4% | 99.4% |
| CompanyController | 92.6% | 92.6% |
| EventController | 100% | 100% |
| SeatController | 100% | 100% |
| SeatCsvController | 95.3% | 97.9% |
| AppDbContext | 100% | 100% |
| EventAccessService | 90.9% | 90.9% |
| EmailTemplates | 100% | 100% |
| Program (startup) | 58.4% | 65.1% |
| **DbInitializer** | **0%** | 0% |
| **EmailService** | **0%** | 0% |
| **MqttService** | **0%** | 0% |

```text
Line coverage: 85.1%   Covered lines: 1013   Coverable lines: 1189
Branch coverage: 69.5% (299 of 430)
Method coverage: 85.1% (69 of 81)
```

**Reading the numbers.** All seven controllers and the authorization service are between 91% and 100%. The three classes at 0% are the system edges that the suite replaces on purpose:

- `EmailService` talks to the real Brevo API and is substituted by `FakeEmailService`.
- `MqttService` connects to the real HiveMQ broker and is substituted by `FakeMqttService`.
- `DbInitializer` and the migration block run only outside the `Testing` environment. They execute on every real deployment and are observable in the production start-up log, but not in this suite.

Together they account for most of the 176 uncovered lines. `Program` is lower because the migration and Swagger branches are not executed in `Testing`.

---

## 8. Findings and Observations

*What the suite established about the system.*

1. **No functional defect was found.** All 102 cases pass against the code at commit `9e00288`.
2. **Authorization is consistent at the object level.** Every endpoint that takes an event or seat identifier returns 403/404 for resources outside the caller's company or assignment (INT_EVT_06/10/12, INT_SEAT_02/07/17, INT_CSV_12/16, INT_AUD_04). The deeper attack matrix is in the Security Test Report.
3. **Side effects are verified, not assumed.** Audit entries (including before/after diffs and single-entry bulk logging), MQTT publications and e-mails are asserted through the test doubles.
4. **Volume check.** A 1,000-guest CSV (the size used in the load tests) imports and persists completely within the 3-second suite run (INT_CSV_14).
5. **Behaviors worth noting.** Password reset tokens are valid for one hour and single-use; "forgot password" responds identically for known and unknown e-mails (no account enumeration at this layer).

---

## 9. Limitations and Threats to Validity

*What this suite cannot prove.*

| Limitation | Impact | Mitigation |
|---|---|---|
| SQLite instead of PostgreSQL | Provider-specific behavior (collations and case sensitivity, `timestamptz`, concurrency/locking, real migrations) is not exercised | Production runs the same EF Core model; a Testcontainers-based Postgres run is a recommended addition |
| `EnsureCreated` instead of migrations | Migration scripts are not tested | Migrations are applied and observed on every Render deployment |
| MQTT and e-mail are test doubles | Real broker/Brevo connectivity, TLS, credentials and quota behavior are untested | Operational checks (UptimeRobot, deployment logs); load tests against production |
| bcrypt work factor 4 in fixtures | Login timing differs from production | Login latency is measured separately in the Load and Stress reports |
| In-process server, no network | No TLS, reverse proxy, CORS from real origins or cold starts | CORS rules are covered in the Security suite; cold start observed in the load tests |
| Single-user sequential requests | Concurrent seat updates (optimistic `Version` conflicts) are not tested | Recommended future test; the stress test exercises concurrent writes only locally |
| Test data fixed and small | Edge cases in very large or very dirty data sets may be missed | CSV volume (1,000 rows) and error cases are covered |

---

## 10. Conclusion and Recommendations

*Outcome and follow-up actions.*

The Seatly API passes all 102 integration cases. The pipeline works end-to-end for every module, and the behaviors that matter operationally are verified: access scoping, audit trail, real-time notifications, e-mail flows and CSV import. Controller and authorization code is covered between 91% and 100%.

| Priority | Recommendation | Rationale |
|---|---|---|
| Medium | Add unit tests for `DbInitializer` (SQLite) and `EmailService` (stubbed `HttpMessageHandler`) | Removes two of the three 0% classes without touching external services |
| Medium | Add a PostgreSQL (Testcontainers) job to CI, running the same suite | Closes the largest validity gap (provider differences) |
| Low | Add a concurrent-update test for seat `Version` | Documents behavior under simultaneous check-ins |
| Low | Add requirement IDs to test traits for automatic traceability | Makes coverage by requirement reportable |

**Evidence location.** Source: `backend/SeatingManagement.API.Tests/Integration/`. Commit `9e00288`. CI step "Backend (.NET)" in `.github/workflows/ci.yml`.
