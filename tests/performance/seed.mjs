#!/usr/bin/env node
// Seeds fictitious test data through the public API (works for production and local Docker).
// Needs Node 18+. Credentials come from the environment: SEATLY_API, GESTOR_EMAIL, GESTOR_PASS, USER_EMAIL.
//   node seed.mjs                -> creates 3 events "Perf Gala 1..3" with 1000 guests each and assigns the User account
//   node seed.mjs --csv-only     -> only writes data/guests-1000.csv
import { mkdirSync, writeFileSync } from 'node:fs';

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diogo', 'Eva', 'Filipe', 'Graça', 'Hugo', 'Inês', 'João', 'Luísa', 'Miguel', 'Nuno', 'Olga', 'Paulo', 'Rita', 'Sofia', 'Tiago', 'Vera', 'Xavier'];
const LAST = ['Almeida', 'Barros', 'Costa', 'Duarte', 'Esteves', 'Faria', 'Gomes', 'Henriques', 'Lopes', 'Machado', 'Neves', 'Oliveira', 'Pires', 'Queirós', 'Ramos', 'Silva', 'Teixeira', 'Vaz'];
const CATEGORIES = ['VIP', 'Standard', 'Standard', 'Standard', 'Staff'];

export function buildCsv(n = 1000, seatsPerTable = 10) {
  const lines = ['mesa;lugar;categoria;nome'];
  for (let i = 0; i < n; i++) {
    const table = Math.floor(i / seatsPerTable) + 1;
    const seat = (i % seatsPerTable) + 1;
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]} ${i + 1}`;
    lines.push(`${table};${seat};${CATEGORIES[i % CATEGORIES.length]};${name}`);
  }
  return lines.join('\n') + '\n';
}

if (process.argv.includes('--csv-only')) {
  mkdirSync('data', { recursive: true });
  writeFileSync('data/guests-1000.csv', buildCsv());
  console.log('Wrote data/guests-1000.csv');
  process.exit(0);
}

const need = (k) => { if (!process.env[k]) { console.error(`Missing environment variable ${k}`); process.exit(1); } return process.env[k]; };
const BASE = need('SEATLY_API').replace(/\/$/, '');
const GESTOR_EMAIL = need('GESTOR_EMAIL'), GESTOR_PASS = need('GESTOR_PASS'), USER_EMAIL = need('USER_EMAIL');
const EVENTS = Number(process.env.PERF_EVENTS || 3);
const GUESTS = Number(process.env.PERF_GUESTS || 1000);

async function api(path, { method = 'GET', token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: form ?? (json ? JSON.stringify(json) : undefined) });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

console.log(`Warming up ${BASE} ...`);
await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(120000) });

const { token } = await api('/api/Auth/login', { method: 'POST', json: { email: GESTOR_EMAIL, password: process.env.GESTOR_PASS } });
const existing = await api('/api/Event/my-events', { token });
const users = await api('/api/Auth/users', { token });
const user = users.find((u) => u.email.toLowerCase() === USER_EMAIL.toLowerCase());
if (!user) { console.error('The User account was not found in the Gestor company.'); process.exit(1); }

const csv = buildCsv(GUESTS);
const start = new Date(Date.now() + 86400000).toISOString();
const end = new Date(Date.now() + 2 * 86400000).toISOString();

for (let i = 1; i <= EVENTS; i++) {
  const name = `Perf Gala ${i}`;
  let id = existing.find((e) => e.name === name)?.id;
  if (!id) {
    ({ eventId: id } = await api('/api/Event', { method: 'POST', token, json: { name, startDate: start, endDate: end } }));
    console.log(`Created ${name} (id ${id})`);
  } else {
    console.log(`Reusing ${name} (id ${id})`);
  }
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'guests.csv');
  await api(`/api/SeatCsv/import/${id}?mode=replace`, { method: 'POST', token, form });
  console.log(`  imported ${GUESTS} guests`);
  try { await api(`/api/Event/${id}/assign-user`, { method: 'POST', token, json: { userId: user.id } }); console.log('  assigned User'); }
  catch (e) { console.log(`  assign skipped: ${e.message.slice(0, 80)}`); }
}
console.log('Done.');
