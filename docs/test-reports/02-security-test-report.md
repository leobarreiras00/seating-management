# Security Test Report: Seatly

*This report records the security verification of the Seatly platform: the automated security suite, the OWASP ZAP baseline scans of production, and the findings they confirmed, with real figures from the runs.*

## 1. Document control

*Identification, authorship and traceability of this report.*

| Field | Value |
|---|---|
| Document ID | SEC-RPT-001 |
| Project | Seatly (seating management for events) |
| Author | Leonardo Barreiras |
| Test period | 07/2026 to 10/2026 |
| Repository / commit | `leobarreiras00/seating-management`, branch `test/integration-security-performance`, commit `9e00288` (suites), `96e6fb4` (ZAP runner and performance tooling) |
| Test suite ID prefixes | `SEC_AUTH`, `SEC_AUTHZ`, `SEC_INP`, `SEC_CFG` |
| Related reports | INT-RPT-001 (Integration), LOAD-RPT-001 (Load), STR-RPT-001 (Stress) |
| Language / format | EN-US, Confluence |

## 2. Objective and scope

*What was verified, against which risks, and what was deliberately left out.*

**Objective.** Check, with repeatable automated tests, that the Seatly API enforces authentication, authorization, input validation and safe configuration, and register every deviation as a traceable finding.

**In scope**
- Authentication: login, JWT validation, password handling, reset flow, throttling.
- Authorization: role checks (SuperAdmin, Gestor, Utilizador), object-level access (IDOR) across companies and events, privilege escalation through registration.
- Input handling: SQL injection, XSS payloads, encoding, malformed bodies, mass assignment, boundary values, file size and type limits.
- Configuration: CORS, Swagger exposure, error and data leakage, security headers.
- Passive scan (OWASP ZAP baseline) of the production API and the back-office.

**Out of scope**
- Active scanning and penetration testing of production.
- Android application and MQTT broker (HiveMQ Cloud) testing.
- Infrastructure and provider-level controls (Render, Vercel, Neon).
- Denial-of-service behaviour (covered in the Stress report).

## 3. Approach and test design

*How the tests are built, and how a failing test is interpreted.*

- Black-box tests through HTTP against the real application pipeline (`WebApplicationFactory<Program>`), so middleware, authorization, validation and serialization are exercised as in production.
- SQLite in-memory database with a deterministic seed (two companies, three roles, events and guests), BCrypt cost 4, fake MQTT and e-mail services.
- Every test asserts the **secure** behaviour. When the system does not yet behave securely, the test fails and is tagged `Status=KnownOpen` plus `Finding=S-xx`. Each failure is therefore a **confirmed finding**, not a test defect.
- CI excludes `KnownOpen` tests so the pipeline stays green and visible; the full run keeps them failing until each finding is fixed.

```csharp
[Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-22")]
public async Task SEC_CFG_30_Responses_CarryXContentTypeOptionsNosniff()
{
    var response = await _f.CreateApiClient().GetAsync("/health");
    Assert.True(response.Headers.TryGetValues("X-Content-Type-Options", out var v) && v.Contains("nosniff"));
}
```

## 4. Environment and commands executed

*Where and how the suite and the scans were run.*

| Item | Value |
|---|---|
| Runtime | .NET 10, xUnit 2.9.3, Microsoft.AspNetCore.Mvc.Testing 10.0.12 |
| Database | SQLite in-memory (EnsureCreated) |
| Coverage | coverlet.collector 6.0.4, ReportGenerator |
| Scanner | OWASP ZAP `ghcr.io/zaproxy/zaproxy:stable`, `zap-baseline.py` (passive) |
| Scan targets | `https://api-seatly.onrender.com`, `https://seatly-backoffice.vercel.app` |

```bash
# Full run (all suites, with coverage)
dotnet test backend/SeatingManagement.API.Tests -c Release \
  --settings backend/SeatingManagement.API.Tests/coverlet.runsettings \
  --collect:"XPlat Code Coverage"

# Security suite only
dotnet test backend/SeatingManagement.API.Tests -c Release --filter "Suite=Security"

# CI selection (known-open findings excluded)
dotnet test backend/SeatingManagement.API.Tests -c Release --filter "Status!=KnownOpen"

# OWASP ZAP passive baseline (production, read-only)
./tests/performance/zap.sh
```

Credentials for the test accounts were supplied through environment variables and are not stored in the repository or in this report.

## 5. Results summary

*Headline numbers for the security suite and the full test project.*

| Metric | Value |
|---|---|
| Security test cases | 117 |
| Passed (secure behaviour confirmed) | 92 |
| Failed = confirmed findings (`KnownOpen`) | 25 |
| Full project run (14 unit + 102 integration + 117 security) | 233 tests: 208 passed, 25 failed |
| CI selection (`Status!=KnownOpen`) | 207 / 207 passed, 3 s |
| ZAP, production API | 0 High, 0 Medium, 3 Low, 2 Informational |
| ZAP, back-office | 0 High, 3 Medium, 5 Low, 5 Informational |

```text
Failed!  - Failed:    25, Passed:   208, Skipped:     0, Total:   233, Duration: 3 s - SeatingManagement.API.Tests.dll (net10.0)
Passed!  - Failed:     0, Passed:   207, Skipped:     0, Total:   207, Duration: 3 s - SeatingManagement.API.Tests.dll (net10.0)
```

| Category | Cases | Passed | Failed (findings) |
|---|---|---|---|
| Authentication (`SEC_AUTH`) | 25 | 18 | 7 |
| Authorization (`SEC_AUTHZ`) | 20 | 15 | 5 |
| Configuration (`SEC_CFG`) | 24 | 20 | 4 |
| Input validation (`SEC_INP`) | 48 | 39 | 9 |
| **Total** | **117** | **92** | **25** |

## 6. Detailed results

*What each group verified. Cases that passed are summarized by behaviour; failed cases are listed individually in section 7.*

### 6.1 Authentication (SEC_AUTH)

*Credential handling, token validation and account lifecycle.*

| IDs | Behaviour verified | Result |
|---|---|---|
| SEC_AUTH_01–14 | Anonymous callers are rejected on every protected endpoint; malformed `Authorization` headers, tokens signed with another key, unsigned (`alg=none`), expired, not-yet-valid, wrong issuer or audience, and tampered-payload tokens are all rejected with 401; login with a wrong password and with an unknown user are indistinguishable, as are forgot-password with a known and an unknown e-mail and first-login reset with an unknown user or wrong temporary password; reset tokens are long and unique; responses never expose credential material; error responses leak no stack traces or provider details | 18 passed (14 test methods, 4 additional data rows) |
| SEC_AUTH_20–26 | Secure behaviour not yet implemented (see section 7) | 7 failed |

### 6.2 Authorization (SEC_AUTHZ)

*Role enforcement and object-level access control.*

- **Endpoint matrix.** 36 protected endpoints were probed without a token (all 401) and with tokens of the wrong role.
- **Object-level access.** A Gestor of one company cannot read or modify another company's events, seats, guests, analytics or audit logs; a Utilizador cannot access events they were not assigned to (`EventAccessService`).
- **Result.** 15 passed. Five cases failed because role restrictions are missing on specific endpoints (S-19) and on registration (S-20).

### 6.3 Input validation and injection (SEC_INP)

*Hostile and boundary input.*

| IDs | Behaviour verified | Result |
|---|---|---|
| SEC_INP_01–05 | SQL injection payloads in login, search and CSV fields do not alter queries or leak data | passed |
| SEC_INP_10–12 | XSS payloads are stored and returned inertly with `application/json`; content-type enforcement | passed |
| SEC_INP_20–22 | Unicode, long and encoded input handled | passed |
| SEC_INP_30–36 | Malformed JSON, wrong types, missing fields return 4xx, never 500 | passed |
| SEC_INP_40–41 | Mass assignment (role, company, id) ignored | passed |
| SEC_INP_50 | Unsupported HTTP methods rejected | passed |
| SEC_INP_69 | Malformed CSV does not leak exception details | passed (not a finding) |
| SEC_INP_60–68 | Boundary and size validation missing (see section 7) | 9 failed |

**Observation (SEC_INP_10).** The API returns `<` and `>` unescaped inside JSON strings. This is normal for JSON and safe with `application/json` plus output encoding in the clients, but it depends on the missing `X-Content-Type-Options: nosniff` (finding S-22).

### 6.4 Configuration (SEC_CFG)

*CORS, documentation exposure, leakage and headers.*

- **CORS (SEC_CFG_01–05).** The back-office origins and localhost are allowed; look-alike origins (`…vercel.app.evil.com`, `evilseatly-backoffice.vercel.app`, `localhost.evil.com`) receive no CORS header; credentials are never combined with a wildcard.
- **Documentation (SEC_CFG_10).** `/swagger` and `/openapi` return 404 outside Development.
- **Leakage (SEC_CFG_20–22).** Error bodies contain no stack traces, Npgsql or connection-string markers and no `X-Powered-By`; login and user-list responses contain no password hash or reset token.
- **Failures.** Missing headers (S-22) and a CORS crash on unusual `Origin` values (S-24).

## 7. Findings confirmed by the tests

*Each failed test is a confirmed deviation from secure behaviour. Severity is my assessment given Seatly's context (small events, JWT bearer auth, no payments).*

| Finding | Test IDs | Description | Evidence | Severity |
|---|---|---|---|---|
| S-11 | SEC_AUTH_20, 21 | No throttling or lockout on login; contact form not rate-limited | `Filter not matched in collection` (no 429 observed) | Medium |
| S-12 | SEC_AUTH_22 | 6-character passwords accepted | `Assert.Equal() Failure: Values differ` | Medium |
| S-13 | SEC_AUTH_23, 24 | Token lifetime is 24.0 h; token of a deleted user is still accepted | `Token lifetime is 24,0 hours` | Medium |
| S-17 | SEC_AUTH_25 | Password-reset token stored in plain text in the database | `Assert.NotEqual() Failure: Strings are equal` | Medium |
| S-18 | SEC_AUTH_26 | Temporary password has only 6 random characters | Test failure on minimum length | Medium |
| S-19 | SEC_AUTHZ_20–23 | A Utilizador can create events, wipe a guest list, import a CSV that replaces it, and read the audit trail | `Assert.Equal() Failure` (expected 403) | High |
| S-20 | SEC_AUTHZ_24 | Registration accepts any role value | Expected rejection, received success | High |
| S-21 | SEC_INP_60–68 | Missing validation: seat status 99 accepted; audit `pageSize` 1,000,000 echoed; negative page accepted; 3 MB avatar and non-image avatar (`javascript:…`) accepted; 1,000-character guest name; end before start; start year 2206; empty event name | e.g. `pageSize echoed as 1000000`, `-> 200` | Medium |
| S-22 | SEC_CFG_30, 31 | No `X-Content-Type-Options` and no `X-Frame-Options` or CSP | `Assert.True() Failure` | Low |
| S-24 | SEC_CFG_32, 33 | `Origin: null` or a malformed `Origin` makes the CORS policy throw (`new Uri(origin)`), returning 500 | `-> 500` | Low |

Notes:
- S-19 and S-20 are the most relevant: they are authorization gaps reachable by any authenticated user, and S-20 may allow privilege escalation if registration is reachable by a low-privilege account. Both should be fixed first.
- S-24 yields a 500 but no data leak; it is a robustness and information-quality issue.

## 8. OWASP ZAP baseline (passive)

*Scan of the deployed system with no attack traffic, run against production.*

```bash
export ZAP_TARGET=https://api-seatly.onrender.com
./tests/performance/zap.sh
# reports: tests/performance/results/zap-api.{md,json,html} and zap-backoffice.{md,json,html}
```

**API (`api-seatly.onrender.com`).** 0 High, 0 Medium, 3 Low, 2 Informational. Only two endpoints were reachable without authentication, so coverage is limited by design.

| Alert | Risk | Instances |
|---|---|---|
| Strict-Transport-Security header not set | Low | 3 |
| X-Content-Type-Options header missing | Low | 1 |
| Cross-Origin-Resource-Policy header missing or invalid | Low | 1 |
| Re-examine Cache-control directives | Informational | 1 |
| Storable and cacheable content | Informational | 1 |

**Back-office (`seatly-backoffice.vercel.app`).** 0 High, 3 Medium, 5 Low, 5 Informational, over 22 endpoints.

| Alert | Risk | Instances |
|---|---|---|
| Content Security Policy (CSP) header not set | Medium | Systemic |
| Cross-domain misconfiguration | Medium | Systemic |
| Missing anti-clickjacking header | Medium | 4 |
| Big redirect detected | Low | 1 |
| COEP / COOP header missing or invalid | Low | 4 each |
| Permissions Policy header not set | Low | Systemic |
| X-Content-Type-Options header missing | Low | Systemic |
| Modern web application, cache-control, retrieved from cache, storable (cacheable and non-cacheable) | Informational | 5 alert types |

**Interpretation.** The scan confirms S-22 independently of the test suite (missing nosniff and framing protection). The back-office Medium alerts are all header and policy hardening items (CSP, anti-clickjacking, and a CORS-style misconfiguration that ZAP raises on static assets); none is an exploitable vulnerability by itself. Cross-domain misconfiguration should be verified manually against the Vercel response headers before it is classified as a defect. A correction to my earlier working notes: the back-office result is 3 Medium, not 0, as shown in `zap-backoffice.md`.

## 9. Code coverage contribution

*How much of the backend the tests exercise, security tests included.*

| Run | Lines | Branches | Methods |
|---|---|---|---|
| Full suite (unit + integration + security) | 86.2% (1025/1189) | 73.9% (318/430) | 85.1% (69/81) |
| Integration only | 85.1% (1013/1189) | 69.5% (299/430) | n/a |

The security suite adds about 1.1 points of line coverage and 4.4 points of branch coverage over integration alone, mostly validation and rejection paths. `DbInitializer`, `EmailService` and `MqttService` have 0% coverage because they depend on external infrastructure and are replaced by fakes in tests.

## 10. Limitations

*What these results do and do not prove.*

- Tests run on SQLite, not PostgreSQL; database-specific behaviour (collation, case sensitivity, locking) is not covered.
- ZAP was passive only and unauthenticated; authenticated and active scanning were not performed against production.
- No manual penetration test and no dependency vulnerability audit are included in this report.
- Rate limiting and token lifetime are verified at application level; protections at the Render or Vercel edge are not assessed.
- The Android application and the MQTT channel are untested for security.
- An absence of failed tests is evidence, not proof, of absence of vulnerabilities.

## 11. Risks and recommendations

*Proposed remediation order, based on impact and effort.*

| Priority | Action | Findings |
|---|---|---|
| 1 | Add role checks to event creation, guest-list wipe, CSV import and audit read; validate the role on registration against the allowed set | S-19, S-20 |
| 2 | Add request validation (status enum, page and page-size caps, name length, date sanity, avatar size and MIME type) | S-21 |
| 3 | Add login and contact-form rate limiting; raise password policy to at least 8 characters | S-11, S-12 |
| 4 | Shorten token lifetime and validate that the user still exists on each request; hash reset tokens; generate longer temporary passwords | S-13, S-17, S-18 |
| 5 | Add security headers (nosniff, framing protection, HSTS, CSP for the back-office); guard `new Uri(origin)` with `Uri.TryCreate` | S-22, S-24 |

As each fix lands, remove the `Status=KnownOpen` trait from its test so CI starts enforcing it; the aim is a full run with 0 failed tests before the final delivery on 23/10.

## 12. Conclusion

*Overall assessment.*

The core security design holds: 92 of 117 security cases pass, including token tampering, cross-company access (IDOR), SQL injection, CORS look-alike origins and information leakage, and both ZAP scans report no High alerts. The 25 failures are 10 distinct findings (S-11, S-12, S-13, S-17, S-18, S-19, S-20, S-21, S-22, S-24). The two role-authorization gaps (S-19, S-20) are the ones to close before release. The suite is repeatable, runs in about 3 seconds, and keeps each open finding visible until it is fixed.
