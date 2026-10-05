// Seatly load test: expected usage of one large event.
//   staff   - 20 door devices ramping up to 20 VUs (scan / sync cycle)
//   manager - 3 back-office users (dashboard, events, seat grid, audit trail)
//   login   - 6 interactive logins per minute (bcrypt is CPU bound, so it is measured on its own)
// Production: read-only (WRITES unset). Local Docker: WRITES=true adds check-in writes.
import { sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { setupData, call, login, pick, WRITES, BASE, IS_PROD } from './config.js';

export const options = {
  setupTimeout: '180s',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    staff: {
      executor: 'ramping-vus', exec: 'staff', startVUs: 0,
      stages: [{ duration: '1m', target: 20 }, { duration: '5m', target: 20 }, { duration: '30s', target: 0 }],
    },
    manager: { executor: 'constant-vus', exec: 'manager', vus: 3, duration: '6m30s' },
    login: {
      executor: 'constant-arrival-rate', exec: 'loginFlow', rate: 6, timeUnit: '1m',
      duration: '6m30s', preAllocatedVUs: 2, maxVUs: 5,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{kind:api}': ['p(95)<800', 'p(99)<2000'],
    'http_req_duration{kind:login}': ['p(95)<3000'],
  },
};

export function setup() { return setupData(); }

export function staff(d) {
  // Every 10th cycle is a full seat-list synchronisation (what a device does when it (re)connects).
  if (Math.random() < 0.1) {
    call('GET', `/api/Seat/${d.eventId}`, d.user, null, '/api/Seat/{eventId}');
  } else if (WRITES) {
    const seatId = pick(d.seatIds);
    const status = Math.random() < 0.85 ? 1 : 0;
    call('PUT', `/api/Seat/${d.eventId}/update/${seatId}`, d.user, { status }, '/api/Seat/{eventId}/update/{seatId}');
  } else {
    call('GET', '/api/Event/my-events', d.user);
  }
  sleep(3 + Math.random() * 5);
}

export function manager(d) {
  call('GET', '/api/Analytics/dashboard', d.gestor);
  call('GET', '/api/Event/my-events', d.gestor);
  call('GET', `/api/Seat/${d.eventId}`, d.gestor, null, '/api/Seat/{eventId}');
  call('GET', `/api/Audit/event/${d.eventId}?page=1&pageSize=50`, d.gestor, null, '/api/Audit/event/{eventId}');
  sleep(10 + Math.random() * 10);
}

export function loginFlow() {
  const res = login(__ENV.USER_EMAIL, __ENV.USER_PASS);
  if (res.status !== 200) console.warn(`login returned ${res.status}`);
}

export function handleSummary(data) {
  const name = __ENV.RUN_NAME || 'load';
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: false }) +
      `\nTarget: ${BASE} (${IS_PROD ? 'production' : 'local'}), writes: ${WRITES}\n`,
    [`results/${name}.json`]: JSON.stringify(data, null, 2),
  };
}
