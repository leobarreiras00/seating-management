-- Local Docker only. Creates the test company and the three accounts with the SAME credentials you export in your shell.
-- Usage (from tests/performance):
--   docker compose -f docker-compose.perf.yml exec -T db psql -U seatly -d seatly_perf \
--     -v ON_ERROR_STOP=1 -v company="Acme Group Test" \
--     -v sa_email="$SUPERADMIN_EMAIL" -v sa_pass="$SUPERADMIN_PASS" \
--     -v g_email="$GESTOR_EMAIL" -v g_pass="$GESTOR_PASS" \
--     -v u_email="$USER_EMAIL" -v u_pass="$USER_PASS" -f - < seed-local.sql
-- No password is stored in this file: psql receives them as variables and hashes them with bcrypt (cost 11, like the API).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "Companies" ("Name", "LogoUrl")
SELECT :'company', '' WHERE NOT EXISTS (SELECT 1 FROM "Companies" WHERE "Name" = :'company');

INSERT INTO "Users" ("UserGuid", "Email", "Username", "PasswordHash", "Role", "AvatarUrl", "MustChangePassword", "CompanyId")
SELECT gen_random_uuid(), :'sa_email', 'Perf SuperAdmin', crypt(:'sa_pass', gen_salt('bf', 11)), 'SuperAdmin', '', false,
       (SELECT "Id" FROM "Companies" WHERE "Name" = 'Seatly Admin' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM "Users" WHERE "Email" = :'sa_email')
  AND EXISTS (SELECT 1 FROM "Companies" WHERE "Name" = 'Seatly Admin');

INSERT INTO "Users" ("UserGuid", "Email", "Username", "PasswordHash", "Role", "AvatarUrl", "MustChangePassword", "CompanyId")
SELECT gen_random_uuid(), :'g_email', 'Perf Gestor', crypt(:'g_pass', gen_salt('bf', 11)), 'Gestor', '', false,
       (SELECT "Id" FROM "Companies" WHERE "Name" = :'company')
WHERE NOT EXISTS (SELECT 1 FROM "Users" WHERE "Email" = :'g_email');

INSERT INTO "Users" ("UserGuid", "Email", "Username", "PasswordHash", "Role", "AvatarUrl", "MustChangePassword", "CompanyId")
SELECT gen_random_uuid(), :'u_email', 'Perf User', crypt(:'u_pass', gen_salt('bf', 11)), 'Utilizador', '', false,
       (SELECT "Id" FROM "Companies" WHERE "Name" = :'company')
WHERE NOT EXISTS (SELECT 1 FROM "Users" WHERE "Email" = :'u_email');

SELECT "Email", "Role", "CompanyId" FROM "Users" ORDER BY "Id";
