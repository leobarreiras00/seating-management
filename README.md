# Seatly

Event seating management system: ASP.NET Core API, Next.js backoffice and a native Android app.

## Repository layout

- `backend/`: .NET API and its tests
- `backoffice/`: Next.js administration site
- `frontend/SeatingManagementApp/`: Android app
- `infrastructure/`: early local setup (not used in production)
- `.github/`: CI workflows, CodeQL and Dependabot configuration

## CI/CD

GitHub Actions runs the CI quality gate on every push to `develop` and on every pull request into `main` or `develop`.
Merging into `main` deploys automatically to Render (API) and Vercel (backoffice).
