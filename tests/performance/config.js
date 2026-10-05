// Shared helpers for the Seatly k6 scenarios. No credentials live here: everything comes from environment variables.
import http from 'k6/http';
import { check, fail } from 'k6';
import exec from 'k6/execution';

export const BASE = (__ENV.SEATLY_API || '').replace(/\/$/, '');
export const WRITES = __ENV.WRITES === 'true';          // check-in writes: LOCAL DOCKER ONLY
export const IS_PROD = /onrender\.com/i.test(BASE);

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function guard() {
  if (!BASE) fail('SEATLY_API is not set (e.g. export SEATLY_API=http://localhost:8080)');
  if (IS_PROD && WRITES) fail('Refusing to run write scenarios against production (WRITES=true)');
  for (const v of ['GESTOR_EMAIL', 'GESTOR_PASS', 'USER_EMAIL', 'USER_PASS']) {
    if (!__ENV[v]) fail(`${v} is not set`);
  }
}

export function login(email, password) {
  const res = http.post(`${BASE}/api/Auth/login`, JSON.stringify({ email, password }), {
    headers: JSON_HEADERS,
    tags: { name: 'POST /api/Auth/login', kind: 'login' },
  });
  return res;
}

function tokenOf(email, password) {
  const res = login(email, password);
  if (res.status !== 200) fail(`Login failed for the configured account (HTTP ${res.status})`);
  return res.json('token');
}

/** Runs once: warms the API up, logs in once per role and discovers the seeded events and seats. */
export function setupData() {
  guard();

  const warm = http.get(`${BASE}/health`, { timeout: '120s', tags: { name: 'GET /health (warm-up)', kind: 'warmup' } });
  console.log(`Warm-up /health: HTTP ${warm.status} in ${Math.round(warm.timings.duration)} ms (cold start if > 5000 ms)`);

  const gestor = tokenOf(__ENV.GESTOR_EMAIL, __ENV.GESTOR_PASS);
  const user = tokenOf(__ENV.USER_EMAIL, __ENV.USER_PASS);

  const events = http.get(`${BASE}/api/Event/my-events`, { headers: auth(user) }).json()
    .filter((e) => String(e.name).startsWith('Perf'));
  if (events.length === 0) fail('No "Perf ..." events found for the User account. Run seed.mjs first.');

  const eventId = events[0].id;
  const seats = http.get(`${BASE}/api/Seat/${eventId}`, { headers: auth(user) }).json();
  console.log(`Using ${events.length} event(s); event ${eventId} has ${seats.length} seats.`);

  return { gestor, user, eventIds: events.map((e) => e.id), seatIds: seats.map((s) => s.id), eventId };
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

/** One API call with consistent tags and a status check. */
export function call(method, path, token, body, name, extraTags = {}) {
  const params = {
    headers: body ? { ...auth(token), ...JSON_HEADERS } : auth(token),
    tags: { name: `${method} ${name || path}`, kind: 'api', ...extraTags },
  };
  const res = method === 'GET' ? http.get(`${BASE}${path}`, params)
    : http.request(method, `${BASE}${path}`, body ? JSON.stringify(body) : null, params);
  check(res, { [`${method} ${name || path}: 200`]: (r) => r.status === 200 });
  return res;
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function elapsedSeconds() {
  return exec.instance.currentTestRunDuration / 1000;
}
