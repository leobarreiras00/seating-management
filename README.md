# Seatly

Event seating management system. An ASP.NET Core API, a Next.js backoffice for administrators and organizers, and a native Android app for on-site check-in, kept in sync in real time over MQTT.

> **Status:** version 1.0, closed on 23/10/2026 as the internship project of Leonardo Barreiras (Instituto Politécnico de Setúbal / 4ITFUTURE).
> **License:** all rights reserved. No license is granted for reuse or redistribution.

## Live environments

| Component | URL |
| --- | --- |
| API | https://api-seatly.onrender.com |
| Backoffice | https://seatly-backoffice.vercel.app |

Both run on free tiers. The API sleeps after inactivity, so the first request can take around a minute.

## Repository layout

| Path | Contents |
| --- | --- |
| `backend/` | .NET 10 API (`SeatingManagement.API`) and its xUnit tests (`SeatingManagement.API.Tests`) |
| `backoffice/` | Next.js 16 / React 19 / Tailwind 4 administration site |
| `frontend/SeatingManagementApp/` | Android app (Kotlin, Jetpack Compose, Hilt, Room, Retrofit) |
| `docs/` | Project documentation (sprint reports, metrics, DevOps and closure reports) |
| `.github/` | CI workflows, CodeQL and Dependabot configuration |
| `.env.example` | Reference for every configuration value used by the three components |

## Architecture at a glance

- **API:** ASP.NET Core (.NET 10), EF Core 10 with Npgsql, JWT authentication, role-based access scoped per event, e-mail through Brevo.
- **Database:** PostgreSQL (Neon). Migrations are applied automatically on API start-up.
- **Real time:** HiveMQ Cloud (MQTT). Backoffice and Android publish and subscribe to seat updates.
- **Backoffice:** Next.js on Vercel. **API:** Docker image on Render (Frankfurt).

## Running locally

### Prerequisites

.NET SDK 10, Node.js 20+, Android Studio (JDK 11+), and a PostgreSQL database (a free Neon project works).

### 1. API

```bash
cd backend/SeatingManagement.API
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<connection string>"
dotnet user-secrets set "Jwt:Key" "<random string, 32+ characters>"
dotnet user-secrets set "EmailSettings:BrevoApiKey" "<brevo key>"   # optional locally
dotnet run
```

In the `Development` environment Swagger is available at `/swagger`. The database schema is created on first start.

### 2. Backoffice

```bash
cd backoffice
cp ../.env.example .env.local   # keep only the NEXT_PUBLIC_* lines and fill them in
npm install
npm run dev                     # http://localhost:3000
```

The API allows CORS from `localhost`, the production backoffice and its Vercel previews.

### 3. Android app

1. Open `frontend/SeatingManagementApp` in Android Studio.
2. Add to `local.properties` (git-ignored):
   ```properties
   mqtt.username=<hivemq-username>
   mqtt.password=<hivemq-password>
   ```
3. Run on a device or emulator (minSdk 26), or build from the terminal:
   ```bash
   ./gradlew assembleDebug
   ```

The API base URL is currently set in the source (`di/AppModule.kt` and `network/SeatingApiService.kt`). Change it there to point the app at another API.

The release APK is signed with a private keystore that is **not** in this repository.

### Tests

```bash
dotnet test backend/SeatingManagement.sln
```

## Configuration

All configuration keys are listed in [`.env.example`](.env.example). Secrets are never committed. In production they are set in Render (API) and Vercel (backoffice).

## CI/CD

GitHub Actions runs the CI quality gate on every push to `develop` and on every pull request into `main` or `develop`: change detection, Gitleaks secret scan, backend build and tests, Docker build, backoffice build and Android build. CodeQL and Dependabot run alongside.

Merging into `main` deploys automatically to Render (API) and Vercel (backoffice). `main` is protected by a branch ruleset.

## Known constraints

- Free tiers (Render, Neon, HiveMQ) have cold starts, resource caps and no availability guarantee.
- The HiveMQ Cloud Serverless Free plan retires on 31/12/2026; the real-time channel needs a new broker after that date.
- Open security findings and residual risks are documented in the Closure Report in `docs/`.

## Contact

Leonardo Barreiras, Instituto Politécnico de Setúbal.
