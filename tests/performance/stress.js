// Seatly stress test: push past the expected load to find the breaking point and check recovery.
// Aggressive think time (0.3-0.5 s). Metrics are tagged per stage so each step can be reported separately.
import { sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { setupData, call, pick, WRITES, BASE, IS_PROD } from './config.js';

const STAGES = [
  { name: 's1', duration: 30, target: 10, purpose: 'Baseline' },
  { name: 's2', duration: 60, target: 25, purpose: 'Expected peak' },
  { name: 's3', duration: 60, target: 50, purpose: 'Stress begins' },
  { name: 's4', duration: 60, target: 100, purpose: 'High stress' },
  { name: 's5', duration: 60, target: 150, purpose: 'Heavy overload' },
  { name: 's6', duration: 60, target: 200, purpose: 'Breaking point' },
  { name: 's7', duration: 120, target: 10, purpose: 'Ramp-down 200 to 10' },
  { name: 's8', duration: 300, target: 10, purpose: 'Recovery (steady 10 VUs)' },
];
const BOUNDS = STAGES.reduce((acc, s) => { acc.push((acc.length ? acc[acc.length - 1] : 0) + s.duration); return acc; }, []);

// The "always true" thresholds only force k6 to keep a sub-metric per stage so handleSummary can report it.
const thresholds = {
  http_req_failed: ['rate<0.5'],
  'http_req_duration{kind:api}': ['p(95)<5000'],
};
for (const s of STAGES) {
  thresholds[`http_req_failed{stage:${s.name}}`] = ['rate<=1'];
  thresholds[`http_req_duration{stage:${s.name},kind:api}`] = ['p(95)>=0'];
}

export const options = {
  setupTimeout: '180s',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    stress: {
      executor: 'ramping-vus', startVUs: 0, gracefulRampDown: '10s',
      stages: STAGES.map((s) => ({ duration: `${s.duration}s`, target: s.target })),
    },
  },
  thresholds,
};

export function setup() {
  const d = setupData();
  d.t0 = Date.now();   // stage clock starts when the ramp starts, not when setup() starts
  return d;
}

function stageNow(d) {
  const t = (Date.now() - d.t0) / 1000;
  const i = BOUNDS.findIndex((b) => t < b);
  return STAGES[i === -1 ? STAGES.length - 1 : i].name;
}

export default function (d) {
  const tags = { stage: stageNow(d) };
  const r = Math.random();
  if (WRITES && r < 0.4) {
    call('PUT', `/api/Seat/${d.eventId}/update/${pick(d.seatIds)}`, d.user, { status: Math.random() < 0.85 ? 1 : 0 },
      '/api/Seat/{eventId}/update/{seatId}', tags);
  } else if (r < 0.7) {
    call('GET', '/api/Event/my-events', d.user, null, undefined, tags);
  } else if (r < 0.85) {
    call('GET', `/api/Seat/${d.eventId}`, d.user, null, '/api/Seat/{eventId}', tags);
  } else if (r < 0.95) {
    call('GET', '/api/Analytics/dashboard', d.gestor, null, undefined, tags);
  } else {
    call('GET', `/api/Audit/event/${d.eventId}?page=1&pageSize=50`, d.gestor, null, '/api/Audit/event/{eventId}', tags);
  }
  sleep(0.3 + Math.random() * 0.2);
}

function stageTable(data) {
  const rows = ['stage | VUs | purpose | requests | failed % | median ms | p95 ms | p99 ms | max ms'];
  for (const s of STAGES) {
    const dur = data.metrics[`http_req_duration{stage:${s.name},kind:api}`];
    const fail = data.metrics[`http_req_failed{stage:${s.name}}`];
    const v = dur ? dur.values : {};
    const f = (x) => (x === undefined ? 'n/a' : Math.round(x));
    rows.push([s.name, s.target, s.purpose, fail ? fail.values.passes + fail.values.fails : 0,
      fail ? (fail.values.rate * 100).toFixed(2) : 'n/a', f(v.med), f(v['p(95)']), f(v['p(99)']), f(v.max)].join(' | '));
  }
  return rows.join('\n');
}

export function handleSummary(data) {
  const name = __ENV.RUN_NAME || 'stress';
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: false }) +
      `\nPer-stage results\n${stageTable(data)}\nTarget: ${BASE} (${IS_PROD ? 'production' : 'local'}), writes: ${WRITES}\n`,
    [`results/${name}.json`]: JSON.stringify(data, null, 2),
    [`results/${name}-stages.txt`]: stageTable(data) + '\n',
  };
}
