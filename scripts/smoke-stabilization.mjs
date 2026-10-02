// Real-worker browser smoke (Sprint 5 S5-04, extended by Sprint 6 S6-05).
// SMOKE_INJECT=http-drain|worker-drain|scenario-failure skips the browser scenarios and verifies
// teardown instead: a hung HTTP handler or a worker that never finishes must quarantine the lane
// (no fixture deletion; reset that disposable lane afterwards), and a failed run must still drain
// and clean up safely.
//
// Runs the built UI against the real local API, PostgreSQL, pg-boss queue and the real Gmail and
// email workers. Only the external Google Gmail and Gemini boundaries are replaced in-process by
// deterministic fixture adapters; every other outbound request is blocked and fails the run.
// Requires an exclusive, empty, local `career_companion_*smoke_test` database (SMOKE_DATABASE_URL)
// with current migrations, a fresh backend `npm run build` and a fresh frontend `npm run build`.
//
//   SMOKE_DATABASE_URL=postgresql://...career_companion_x_smoke_test node scripts/smoke-stabilization.mjs
//   Optional: BACKEND_DIR (defaults to sibling career-companion-backend-main or career-companion-backend),
//             CHROME_BIN.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = [
  process.env.BACKEND_DIR,
  path.resolve(frontendDir, '../career-companion-backend-main'),
  path.resolve(frontendDir, '../career-companion-backend'),
].find((dir) => dir && fs.existsSync(path.join(dir, 'dist/index.js')));
if (!backendDir) throw new Error('Built backend not found; set BACKEND_DIR and run its npm run build');
const distDir = path.join(frontendDir, 'dist');
if (!fs.existsSync(path.join(distDir, 'index.html'))) throw new Error('Run frontend npm run build first');

// ── Exclusive smoke target, read before backend configuration ───────────────────────────────
const smokeUrl = process.env.SMOKE_DATABASE_URL;
if (!smokeUrl) throw new Error('Export SMOKE_DATABASE_URL for an exclusive smoke database');
if (!/^career_companion_[a-z0-9_]*smoke_test$/.test(decodeURIComponent(new URL(smokeUrl).pathname.slice(1))))
  throw new Error('SMOKE_DATABASE_URL must name a career_companion_*smoke_test database');
const requireBackend = createRequire(path.join(backendDir, 'package.json'));
requireBackend('dotenv').config({ path: path.join(backendDir, '.env.test'), override: true, quiet: true });
process.env.DATABASE_URL = smokeUrl;
process.env.TEST_DATABASE_URL = smokeUrl;
const { assertTestDatabase } = requireBackend('./dist/utils/testDatabase');
assertTestDatabase(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL);
Object.assign(process.env, {
  NODE_ENV: 'test', // disables automatic worker startup; workers are registered explicitly below
  ENABLE_DEV_AUTH: 'true',
  AI_USER_DAILY_CALL_LIMIT: '30', // small nonzero per-user safety limit through the real operation ledger
  DISCORD_WEBHOOK_URL: '', // real notification delivery disabled
  DISCORD_USER_ID: '',
});
if (!/^[0-9a-f]{64}$/i.test(process.env.AI_CREDENTIAL_ENCRYPTION_KEY ?? ''))
  throw new Error('.env.test needs a fixture AI_CREDENTIAL_ENCRYPTION_KEY');
if (!/^[0-9a-f]{64}$/i.test(process.env.GMAIL_TOKEN_ENCRYPTION_KEY ?? ''))
  throw new Error('.env.test needs a fixture GMAIL_TOKEN_ENCRYPTION_KEY');

// ── Outbound traffic guard (backend process) ─────────────────────────────────────────────────
const blocked = [];
const isLocal = (host) => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(String(host).replace(/:\d+$/, ''));
const hostOf = (input) => {
  try {
    if (typeof input === 'string' || input instanceof URL) return new URL(input).hostname;
    if (input?.url) return new URL(input.url).hostname;
    return input?.hostname ?? input?.host ?? 'localhost';
  } catch {
    return 'unknown';
  }
};
for (const mod of [http, https]) {
  for (const name of ['request', 'get']) {
    const original = mod[name];
    mod[name] = function guarded(input, ...rest) {
      const host = hostOf(input);
      if (!isLocal(host)) {
        blocked.push(host);
        throw new Error(`Blocked outbound request to ${host}`);
      }
      return original.call(this, input, ...rest);
    };
  }
}
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const host = hostOf(input);
  if (!isLocal(host)) {
    blocked.push(host);
    throw new Error(`Blocked outbound fetch to ${host}`);
  }
  return originalFetch(input, init);
};

// ── Deterministic external adapters (test process only; no production flag) ───────────────────
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const gmailState = {
  historyId: '1000',
  historyCalls: 0,
  listCalls: 0,
  getCalls: 0,
  failHistory: false,
  pendingHistory: [],
  messages: new Map(),
};
const providerError = (status) => Object.assign(new Error(`Fixture Gmail ${status}`), { response: { status } });
const fixtureMessage = (id, { subject, from, threadId, body }) => {
  gmailState.messages.set(id, { id, subject, from, threadId, body, internalDate: String(Date.now()) });
  gmailState.historyId = String(BigInt(gmailState.historyId) + 7n);
  gmailState.pendingHistory.push(id);
};
const fakeGmail = {
  users: {
    getProfile: async () => ({ data: { historyId: gmailState.historyId } }),
    messages: {
      list: async () => {
        gmailState.listCalls++;
        return { data: { messages: [...gmailState.messages.keys()].map((id) => ({ id })) } };
      },
      get: async ({ id, format }) => {
        gmailState.getCalls++;
        const m = gmailState.messages.get(id);
        if (!m) throw providerError(404);
        const headers = [
          { name: 'Subject', value: m.subject },
          { name: 'From', value: m.from },
          { name: 'Date', value: new Date(Number(m.internalDate)).toUTCString() },
        ];
        return {
          data: {
            id, threadId: m.threadId, labelIds: ['INBOX'], internalDate: m.internalDate,
            snippet: m.subject,
            payload: format === 'full'
              ? { mimeType: 'text/plain', headers, body: { data: Buffer.from(m.body).toString('base64') } }
              : { headers },
          },
        };
      },
    },
    history: {
      list: async ({ startHistoryId }) => {
        gmailState.historyCalls++;
        if (gmailState.failHistory) throw providerError(503);
        assert.equal(typeof startHistoryId, 'string');
        const ids = gmailState.pendingHistory.splice(0);
        return {
          data: {
            historyId: gmailState.historyId,
            history: ids.map((id) => ({ id: gmailState.historyId, messagesAdded: [{ message: { id } }] })),
          },
        };
      },
    },
  },
};
requireBackend('googleapis').google.gmail = () => fakeGmail;

const ai = { classification: 0, extraction: 0, refusals: 0, refuse: null, gates: new Map(), extractions: new Map() };
const { ProviderFailure } = requireBackend('./dist/services/ai/errors');
// Deterministic provider client installed at the backend's single provider seam.
const fakeProviderClient = {
  generateStructured: async ({ contract, input }) => {
    if (ai.refuse) { // a provider refusal or unknown outcome, as the real adapters report it
      ai.refusals++;
      throw new ProviderFailure(ai.refuse);
    }
    const usage = { inputTokens: 0, outputTokens: 0 };
    if (contract.schemaName === 'email_relevance') {
      ai.classification++;
      return { data: { decision: 'RELEVANT', category: 'INTERVIEW', confidence: 0.95, reasoning: 'fixture' }, usage };
    }
    ai.extraction++;
    const key = [...ai.extractions.keys()].find((marker) => input.includes(marker));
    if (!key) throw new Error('Unexpected fixture body');
    if (ai.gates.has(key)) await ai.gates.get(key).promise; // deterministic barrier per fixture
    return { data: ai.extractions.get(key), usage };
  },
  verifyModels: async () => ({ result: 'VERIFIED' }), // content-free key check on save
};
const extraction = (overrides) => ({
  companyName: null, jobTitle: null, recruiterName: null, recruiterEmail: null, interviewStage: null,
  interviewType: null, interviewDate: null, interviewTime: null, assessmentInfo: null, assessmentDeadline: null,
  offerInfo: null, rejectionInfo: null, actionRequired: null, requestedAction: null, actionDeadline: null,
  followUpRequired: null, followUpDate: null, extractionConfidence: 0.9, provenance: 'Fixture extraction',
  ...overrides,
});

// ── Backend in this process ───────────────────────────────────────────────────────────────────
const { app } = requireBackend('./dist/index');
const { prisma } = requireBackend('./dist/db/prisma');
const { getQueue, stopQueue } = requireBackend('./dist/services/queue');
const { startGmailSyncWorker } = requireBackend('./dist/jobs/gmailSyncJob');
const { startEmailProcessingWorker, EMAIL_PROCESSING_JOB } = requireBackend('./dist/jobs/emailProcessingJob');
const { encryptToken } = requireBackend('./dist/utils/gmailTokenEncryption');
const { sealApiKey } = requireBackend('./dist/services/ai/credentials');
requireBackend('./dist/services/ai/providers').createProviderClient = () => fakeProviderClient;
const express = requireBackend('express');
const { Client } = requireBackend('pg');
const mcpSdk = requireBackend('@modelcontextprotocol/client'); // official SDK client (backend devDependency)
const mcpFixture = JSON.parse(fs.readFileSync(path.join(frontendDir, 'scripts/fixtures/mcp-daily-applications.json'), 'utf8'));
const mcpDailyFile = fs.readFileSync(path.join(frontendDir, 'scripts/fixtures/mcp-daily-applications.md'), 'utf8');

// Exclusive lane: advisory lock plus empty fixture state, checked before any write.
const lock = new Client({ connectionString: smokeUrl });
await lock.connect();
const [{ locked }] = (await lock.query('SELECT pg_try_advisory_lock(810462) AS locked')).rows;
if (!locked) throw new Error('Smoke database is in use by another run');
const [{ users: existingUsers, budgets: existingBudgets, queue }] = await prisma.$queryRaw`
  SELECT (SELECT count(*) FROM users)::int AS users,
         (SELECT count(*) FROM ai_usage_days)::int + (SELECT count(*) FROM ai_configurations)::int AS budgets,
         to_regclass('pgboss.job') IS NOT NULL AS queue`;
const existingJobs = queue ? (await prisma.$queryRaw`SELECT count(*)::int AS n FROM pgboss.job`)[0].n : 0;
if (existingUsers || existingBudgets || existingJobs) {
  await lock.end();
  throw new Error('Smoke database is not empty; refusing to share it with fixture workers');
}

const inject = process.env.SMOKE_INJECT ?? '';
if (inject && !['http-drain', 'worker-drain', 'scenario-failure'].includes(inject))
  throw new Error(`Unknown SMOKE_INJECT mode: ${inject}`);
const HTTP_DRAIN_MS = inject === 'http-drain' ? 3_000 : 20_000;
const WORKER_DRAIN_MS = inject === 'worker-drain' ? 5_000 : 30_000;
// Browser asset hosts the built UI is known to request (web fonts). They are aborted, never
// loaded; any other non-local browser request fails the run.
const EXPECTED_BROWSER_ASSET_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Harness-only teardown probe route (never part of the production app): in-flight HTTP writes.
const probe = { writes: [], release: deferred() };
app.post('/__smoke/slow-write/:id', async (req, res) => {
  const write = { startedAt: Date.now(), finishedAt: 0 };
  probe.writes.push(write);
  await probe.release.promise;
  await sleep(Number(req.query.extraMs ?? 0)); // the browser-originated write finishes last
  if (inject === 'http-drain') await new Promise(() => undefined); // never finishes
  await prisma.application.update({ where: { id: req.params.id }, data: { location: 'Written during drain' } });
  write.finishedAt = Date.now();
  res.json({ ok: true });
});
app.use(express.static(distDir));
app.use((_req, res) => res.sendFile(path.join(distDir, 'index.html')));
// Track handler completion, not socket lifetime: a request stays in flight until its handler
// ends the response, even if the client (for example the closed browser) already disconnected.
const inFlight = new Set();
const server = http.createServer((req, res) => {
  inFlight.add(res);
  const end = res.end;
  res.end = function trackedEnd(...args) {
    inFlight.delete(res);
    return end.apply(this, args);
  };
  app(req, res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const owners = [];
const errors = [];
const browserBlocked = new Set();
const unexpectedBrowserHosts = new Set();
let browser;
let passed = false;
let drainProbe = null; // { emailGmailId, applicationId }

// Teardown order (Sprint 6 S6-05 / runbook §7): stop browser activity, HTTP intake and worker
// fetch; drain in-flight HTTP and worker handlers (fixture adapters and outbound blocking stay
// active); only then delete fixtures while the database is still available; close remaining
// resources and release the lane last. A failed drain skips destructive cleanup (quarantine).
async function teardown() {
  const report = { httpDrained: false, workersDrained: false, cleaned: false, cleanupStartedAt: 0, probe: null, residual: null };
  if (browser) await browser.close().catch(() => undefined);
  const httpClosed = new Promise((resolve) => server.close(resolve)); // stop accepting connections
  server.closeIdleConnections();
  const boss = await getQueue();
  const offWork = Promise.all( // stop worker fetch; resolves once active handlers return
    ['gmail-sync-job', EMAIL_PROCESSING_JOB, 'discord-notification-job'].map((q) => boss.offWork(q, { wait: true })),
  );
  probe.release.resolve(); // let controlled barriers finish so handlers can become quiescent
  for (const [marker, gate] of ai.gates)
    if (!(inject === 'worker-drain' && marker === 'MARKER-DRAIN')) gate.resolve();
  const deadline = Date.now() + HTTP_DRAIN_MS;
  while (inFlight.size && Date.now() < deadline) await sleep(50);
  report.httpDrained = inFlight.size === 0;
  report.workersDrained = await Promise.race([
    offWork.then(() => boss.getWipData().every((w) => w.count === 0)),
    sleep(WORKER_DRAIN_MS).then(() => false),
  ]);
  if (report.httpDrained && report.workersDrained) {
    report.cleanupStartedAt = Date.now();
    if (drainProbe) {
      const drained = await prisma.email.findFirst({ where: { gmailMessageId: drainProbe.emailGmailId } });
      report.probe = {
        httpWrites: probe.writes.length,
        httpWritesFinishedBeforeCleanup: probe.writes.length === drainProbe.expectedWrites &&
          probe.writes.every((w) => w.finishedAt > 0 && w.finishedAt <= report.cleanupStartedAt),
        activeWorkerFinishedBeforeCleanup: drained?.processingState === 'COMPLETED',
      };
    }
    const users = owners.map((o) => o.id);
    const actionIds = (await prisma.action.findMany({ where: { application: { userId: { in: users } } }, select: { id: true } })).map((a) => a.id);
    await prisma.$executeRaw`DELETE FROM pgboss.job WHERE data->>'userId' = ANY(${users}) OR data->>'actionId' = ANY(${actionIds})`;
    await prisma.user.deleteMany({ where: { id: { in: users } } }); // AI configurations and usage cascade
    report.cleaned = true;
    // The lane is exclusive and started empty, so anything left is residue.
    report.residual = (await prisma.$queryRaw`
      SELECT (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM pgboss.job)::int AS jobs,
             (SELECT count(*) FROM ai_usage_days)::int + (SELECT count(*) FROM ai_configurations)::int AS budgets,
             (SELECT count(*) FROM integration_tokens)::int + (SELECT count(*) FROM external_submissions)::int AS mcp`)[0];
  } else {
    // Quarantine: no deletion. Outbound blocking and the lane lock stay in place until this
    // process exits, because a stuck handler may still run.
    server.closeAllConnections();
    console.error(JSON.stringify({ event: 'smoke_lane_quarantined', httpDrained: report.httpDrained, workersDrained: report.workersDrained, inFlight: inFlight.size }));
    return report;
  }
  await stopQueue().catch(() => undefined);
  server.closeIdleConnections();
  await httpClosed;
  await prisma.$disconnect();
  globalThis.fetch = originalFetch;
  await lock.query('SELECT pg_advisory_unlock(810462)').catch(() => undefined);
  await lock.end();
  return report;
}

const devHeaders = (email) => ({ 'X-Development-User': email, 'Content-Type': 'application/json' });

/**
 * Starts in-flight HTTP writes (from Node and, when a page is open, from the browser) and leaves a
 * real email worker blocked inside a fixture call, so teardown must drain both kinds of handler.
 */
async function startDrainProbe(user, applicationId, page) {
  fixtureMessage('smoke-drain', {
    subject: 'Drain probe', from: 'probe@delayed.example', threadId: 'smoke-thread-drain',
    body: 'MARKER-DRAIN fixture body',
  });
  ai.extractions.set('MARKER-DRAIN', extraction({ companyName: 'Nobody Co' }));
  ai.gates.set('MARKER-DRAIN', deferred());
  const extractionsBefore = ai.extraction;
  const sync = await fetch(`${origin}/api/gmail/sync`, { method: 'POST', headers: devHeaders(user.email) });
  assert.equal(sync.status, 202);
  const end = Date.now() + 60_000;
  while (ai.extraction === extractionsBefore && Date.now() < end) await sleep(100);
  assert(ai.extraction > extractionsBefore, 'probe worker never became active');
  void fetch(`${origin}/__smoke/slow-write/${applicationId}`, { method: 'POST' }).catch(() => undefined);
  if (page) // closing the browser drops this socket while its handler is still running
    await page.evaluate((id) => { void fetch(`/__smoke/slow-write/${id}?extraMs=1500`, { method: 'POST' }).catch(() => undefined); }, applicationId);
  const expectedWrites = page ? 2 : 1;
  while (probe.writes.length < expectedWrites) await sleep(20);
  drainProbe = { emailGmailId: 'smoke-drain', applicationId, expectedWrites };
}

async function seed() {
  const user = await prisma.user.create({ data: { email: `smoke-${Date.now()}@audit.test`, name: 'Audit Fixture' } });
  const other = await prisma.user.create({ data: { email: `smoke-other-${Date.now()}@audit.test`, name: 'Other Owner' } });
  owners.push(user, other);
  // Each user's own AI setup (ADR-0001): a sealed fixture key that the fake provider client never sends.
  for (const owner of [user, other])
    await prisma.aIConfiguration.create({ data: {
      userId: owner.id, provider: 'gemini', encryptedApiKey: sealApiKey(owner.id, 'fixture-ai-key-never-sent'),
      consentDisclosure: 'gemini-draft-2026-10', consentedAt: new Date(),
    } });
  const foreign = await prisma.application.create({ data: { userId: other.id, companyName: 'Foreign Owner Co' } });
  const apps = [];
  for (let i = 0; i < 26; i++)
    apps.push(await prisma.application.create({ data: {
      userId: user.id, companyName: i === 25 ? 'Delayed Co' : `Audit Company ${String(i).padStart(2, '0')}`,
      jobTitle: i === 25 ? 'Platform Engineer' : null, createdAt: new Date(Date.now() - i * 1000),
    } }));
  // Canonical-read fixtures (newest, first page): user over AI, and true unknown.
  const override = await prisma.application.create({ data: { userId: user.id, companyName: 'Override Co', aiStatus: 'INTERVIEW', userStatus: 'OFFER', userStatusSetAt: new Date('2026-09-01T00:00:00Z'), createdAt: new Date(Date.now() + 2000) } });
  const unknown = await prisma.application.create({ data: { userId: user.id, companyName: 'Unknown Co', createdAt: new Date(Date.now() + 1000) } });
  const target = apps[25]; // older than the first list page
  const paged = apps[24];
  await prisma.applicationEvent.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ applicationId: paged.id, type: 'NOTE_ADDED', description: `Audit event ${i}`, createdAt: new Date(Date.now() + i * 1000) })) });
  await prisma.action.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ applicationId: paged.id, type: 'ACTION_REQUIRED', description: `Audit task ${i}` })) });
  await prisma.gmailConnection.create({ data: {
    userId: user.id, gmailEmail: user.email, status: 'CONNECTED',
    accessToken: encryptToken('fixture-access-token'), refreshToken: encryptToken('fixture-refresh-token'),
    lastHistoryId: gmailState.historyId, lastSyncedAt: new Date(), syncLookbackDays: 1, lastSyncedLookbackDays: 1,
  } });
  await prisma.email.createMany({ data: Array.from({ length: 26 }, (_, i) => ({ userId: user.id, gmailMessageId: `smoke-${i}`, subject: `Audit email ${i}`, processingState: 'COMPLETED', relevanceState: 'IRRELEVANT', receivedAt: new Date(Date.now() - i * 1000) })) });
  return { user, foreign, target, paged, override, unknown };
}

async function runBrowserScenarios({ user, foreign, target, paged, override }) {
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const hooks = { dropPatch: false, holdPatch: null, holdDetailGet: null, failDetailGets: false, corruptDetail: false, corruptCreate: false };
  const counts = { patch: 0, createPost: 0 };
  // Performs the browser's request from the harness so the server really commits it.
  const forward = async (request) => fetch(request.url(), {
    method: request.method(), headers: devHeaders(user.email), body: request.postData(),
  });
  async function openPage() {
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 900 });
    p.on('pageerror', (error) => errors.push(error.message));
    await p.setRequestInterception(true);
    p.on('request', async (request) => {
      const url = request.url();
      if (!url.startsWith(origin) && !url.startsWith('data:')) {
        const host = new URL(url).hostname;
        (EXPECTED_BROWSER_ASSET_HOSTS.has(host) ? browserBlocked : unexpectedBrowserHosts).add(host); // aborted, never reached
        return request.abort();
      }
      const headers = { ...request.headers(), 'X-Development-User': user.email };
      const method = request.method();
      const pathname = new URL(url).pathname;
      const settle = (fn) => fn().catch(() => undefined); // the page may have cancelled it meanwhile
      try {
        if (method === 'PATCH' && /^\/api\/applications\/[^/]+\/status$/.test(pathname)) {
          counts.patch++;
          if (hooks.dropPatch) { // commit on the server, then lose the response
            if (hooks.dropPatch === 'fail-reads') hooks.failDetailGets = true; // reconciliation fails too
            hooks.dropPatch = false;
            await forward(request);
            return settle(() => request.abort('failed'));
          }
          if (hooks.holdPatch) {
            const hold = hooks.holdPatch;
            hooks.holdPatch = null;
            hold.started.resolve();
            await hold.release.promise;
          }
        }
        if (method === 'GET' && /^\/api\/applications\/[0-9a-f-]{36}$/.test(pathname)) {
          if (hooks.failDetailGets) return settle(() => request.abort('failed'));
          if (hooks.corruptDetail) {
            const body = await (await forward(request)).json();
            delete body.userStatusRevision;
            return settle(() => request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }));
          }
          if (hooks.holdDetailGet) {
            const hold = hooks.holdDetailGet;
            hooks.holdDetailGet = null;
            hold.started.resolve();
            await hold.release.promise;
          }
        }
        if (method === 'POST' && pathname === '/api/applications') {
          counts.createPost++;
          if (hooks.corruptCreate) { // commit on the server, then return a malformed 201
            hooks.corruptCreate = false;
            const committed = await forward(request);
            assert.equal(committed.status, 201);
            return settle(() => request.respond({ status: 201, contentType: 'application/json', body: '{}' }));
          }
        }
        await settle(() => request.continue({ headers }));
      } catch (err) {
        errors.push(`interception: ${err.message}`);
      }
    });
    return p;
  }
  const hold = () => ({ started: deferred(), release: deferred() });
  const page = await openPage();
  const text = (p = page) => p.$eval('body', (node) => node.innerText);
  const hasText = (value, p = page, timeout = 30_000) => p.waitForFunction((v) => document.body.innerText.includes(v), { timeout }, value);
  const lacksText = (value, p = page, timeout = 30_000) => p.waitForFunction((v) => !document.body.innerText.includes(v), { timeout }, value);
  async function click(selector, name, index = 0, p = page) {
    const handles = await p.$$(selector);
    const matches = [];
    for (const h of handles) if ((await h.evaluate((n) => n.textContent.trim())) === name) matches.push(h);
    assert(matches[index], `Missing ${selector} ${name}`);
    await matches[index].click();
  }
  const clickButton = (name, index = 0, p = page) => click('button', name, index, p);
  const nav = (name) => click('aside a', name);
  const spaNavigate = (to, p = page) => p.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, to);
  // TanStack Query refetches stale queries on window visibilitychange (background refresh).
  const backgroundRefetch = (p = page) => p.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  const selectStatus = (value, p = page) => p.select('form[aria-label="Edit application status"] select', value);
  const waitFor = async (check, label, timeout = 60_000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await check()) return;
      await sleep(200);
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  const connection = () => prisma.gmailConnection.findUniqueOrThrow({ where: { userId: user.id } });
  const syncIdleAfter = (since) => waitFor(async () => {
    const c = await connection();
    return c.syncStatus === 'IDLE' && c.lastSyncedAt > since;
  }, 'sync completion');
  const targetRow = () => prisma.application.findUniqueOrThrow({ where: { id: target.id } });
  const scenario = (name) => console.log(`… ${name}`);

  // ── Sprint 5 inherited scenarios ────────────────────────────────────────────────────────────
  scenario('S5 pagination, direct detail, action persistence and ownership');
  await page.goto(`${origin}/applications`); await hasText('Audit Company 00');
  assert(!(await text()).includes('Delayed Co'));
  assert(!(await text()).includes('Foreign Owner Co'));
  await clickButton('Next'); await hasText('Delayed Co');
  await page.goto(`${origin}/applications/${paged.id}`); await hasText('Audit Company 24'); await hasText('Audit event 0');
  assert(!(await text()).includes('Audit event 24'));
  await clickButton('Next', 1); await hasText('Audit event 24'); // >20 history across capped pages
  await hasText('Source email unavailable');
  const actionResponse = page.waitForResponse((r) => r.url().includes('/api/actions/') && r.request().method() === 'PATCH');
  await clickButton('Complete');
  assert.equal((await actionResponse).status(), 200);
  assert.equal(await prisma.action.count({ where: { applicationId: paged.id, status: 'COMPLETED' } }), 1);
  await clickButton('Next', 0); await hasText('COMPLETED');
  const foreignStatus = await page.evaluate(async (id) => (await fetch(`/api/applications/${id}`)).status, foreign.id);
  assert.equal(foreignStatus, 404, 'foreign application must be unavailable');

  scenario('S5 real sync → real workers → delayed processing refreshes a mounted detail across navigation');
  fixtureMessage('smoke-new-1', {
    subject: 'Interview invitation — Delayed Co', from: 'recruiter@delayed.example', threadId: 'smoke-thread-1',
    body: 'MARKER-DELAYED Please confirm an interview slot for Platform Engineer.',
  });
  ai.extractions.set('MARKER-DELAYED', extraction({
    companyName: 'Delayed Co', jobTitle: 'Platform Engineer', interviewStage: 'First round',
    actionRequired: true, requestedAction: 'Confirm interview slot',
  }));
  ai.gates.set('MARKER-DELAYED', deferred());
  await page.goto(`${origin}/gmail`); await hasText('Audit email 0');
  assert.equal(await page.$$eval('tbody tr', (rows) => rows.length), 20);
  await clickButton('Next'); await hasText('Audit email 25');
  assert.equal(await page.$$eval('tbody tr', (rows) => rows.length), 6);
  const firstSync = (await connection()).lastSyncedAt;
  const syncResponse = page.waitForResponse((r) => r.url().endsWith('/api/gmail/sync'));
  await clickButton('Sync Now');
  assert.equal((await syncResponse).status(), 202);
  await syncIdleAfter(firstSync);
  assert(gmailState.historyCalls >= 1, 'incremental history.list was not used');
  assert.equal(gmailState.listCalls, 0, 'unexpected reconciliation scan');
  await waitFor(() => ai.extraction === 1, 'worker reaching extraction');
  await nav('Applications'); await hasText('Audit Company 00');
  await clickButton('Next'); await hasText('Delayed Co');
  await page.click(`a[href="/applications/${target.id}"]`);
  await hasText('No events yet');
  ai.gates.get('MARKER-DELAYED').resolve(); // processing finishes only after the detail is mounted
  await hasText('Email Processed', page, 60_000);
  await hasText('Confirm interview slot');
  const processed = await prisma.email.findFirstOrThrow({ where: { userId: user.id, gmailMessageId: 'smoke-new-1' } });
  assert.equal(processed.processingState, 'COMPLETED');
  assert.equal(processed.applicationId, target.id);
  assert.equal((await targetRow()).aiStatus, 'INTERVIEW');
  assert.deepEqual([ai.classification, ai.extraction], [1, 1]);

  scenario('S5 repeat sync keeps one row and reuses completed AI work');
  gmailState.pendingHistory.push('smoke-new-1'); // provider repeats the same reference
  await nav('Gmail Sync'); await hasText('Sync Now');
  const secondSync = (await connection()).lastSyncedAt;
  await clickButton('Sync Now');
  await syncIdleAfter(secondSync);
  await sleep(3000); // allow any (unexpected) replay job to run
  assert.equal(await prisma.email.count({ where: { userId: user.id, gmailMessageId: 'smoke-new-1' } }), 1);
  assert.deepEqual([ai.classification, ai.extraction], [1, 1]);
  assert.equal(await prisma.applicationEvent.count({ where: { emailId: processed.id } }), 1);
  assert.equal(await prisma.action.count({ where: { emailId: processed.id } }), 1);

  scenario('S5 provider failure is visible and manual sync recovers');
  gmailState.failHistory = true;
  await clickButton('Sync Now');
  await hasText('Sync could not finish');
  gmailState.failHistory = false;
  const failedAt = (await connection()).lastSyncedAt;
  await clickButton('Sync Now');
  await syncIdleAfter(failedAt);
  await lacksText('Sync could not finish');

  // ── Sprint 6 scenarios ──────────────────────────────────────────────────────────────────────
  scenario('S6 canonical reads: list and detail agree on user-over-AI and true unknown');
  await page.goto(`${origin}/applications`); await hasText('Override Co');
  const cardText = async (name) => page.$$eval('a[href^="/applications/"]', (cards, name) =>
    cards.map((c) => c.innerText).find((t) => t.includes(name)) ?? '', name);
  const overrideCard = await cardText('Override Co');
  assert(overrideCard.includes('Offer') && overrideCard.includes('Set by you') && overrideCard.includes('AI suggests Interview'), overrideCard);
  const unknownCard = await cardText('Unknown Co');
  assert(unknownCard.includes('Status unknown') && !unknownCard.includes('Applied'), unknownCard);
  await page.click(`a[href="/applications/${override.id}"]`);
  await hasText('Set by you'); await hasText('AI suggests Interview'); await hasText('confirmed');

  // Drain earlier fixture work so the manual interval is measured in isolation.
  const activeJobs = async () => (await prisma.$queryRaw`SELECT count(*)::int AS n FROM pgboss.job
    WHERE name IN ('gmail-sync-job', 'email-processing-job') AND state IN ('created', 'active')
    AND data->>'userId' = ${user.id}`)[0].n;
  // A delayed retry of the earlier failed sync job may remain in 'retry'; it holds an obsolete
  // claim and makes no provider call or write, which the equality checks below would expose.
  await waitFor(async () => (await activeJobs()) === 0, 'fixture queue drain');
  const effects = async () => ({
    jobs: (await prisma.$queryRaw`SELECT count(*)::int AS n FROM pgboss.job`)[0].n,
    operations: await prisma.aIOperation.findMany({ select: { id: true, status: true, attempts: true }, orderBy: { id: 'asc' } }),
    usage: await prisma.aIUsageDay.findMany({ orderBy: [{ userId: 'asc' }, { day: 'asc' }] }),
    events: await prisma.applicationEvent.count(),
    actions: await prisma.action.findMany({ select: { id: true, status: true }, orderBy: { id: 'asc' } }),
    providerCalls: [ai.classification, ai.extraction, gmailState.historyCalls, gmailState.listCalls, gmailState.getCalls],
    aiStatus: (await targetRow()).aiStatus,
  });

  scenario('S6 manual set by keyboard; zero provider/job/ledger/event/action side effects');
  const beforeManual = await effects();
  await page.goto(`${origin}/applications/${target.id}`); await hasText('Inferred by AI');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Change status').focus());
  await page.keyboard.press('Enter');
  await page.waitForSelector('form[aria-label="Edit application status"] select');
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'SELECT', 'focus moves into the editor');
  await selectStatus('OFFER');
  await page.keyboard.press('Tab'); // focus Save
  assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), 'Save');
  const manualAck = page.waitForResponse((r) => r.url().endsWith('/status') && r.request().method() === 'PATCH');
  await page.keyboard.press('Enter');
  assert.equal((await manualAck).status(), 200);
  await hasText('Set by you');
  await waitFor(async () => page.evaluate(() => document.activeElement?.textContent.trim() === 'Change status'), 'focus return');
  let row = await targetRow();
  assert.deepEqual([row.userStatus, row.userStatusRevision, row.aiStatus], ['OFFER', 1, 'INTERVIEW']);
  const confirmedAt = row.userStatusSetAt;
  assert(confirmedAt);
  await sleep(1500); // any (unexpected) job would have been created by now
  assert.deepEqual(await effects(), beforeManual, 'manual correction caused side effects');
  await nav('Applications'); await hasText('Audit Company 00');
  await clickButton('Next'); await hasText('Delayed Co');
  const delayedCard = await cardText('Delayed Co');
  assert(delayedCard.includes('Offer') && delayedCard.includes('Set by you'), delayedCard);

  scenario('S6 later AI processing changes AI state only');
  fixtureMessage('smoke-new-2', {
    subject: 'Update — Delayed Co', from: 'recruiter@delayed.example', threadId: 'smoke-thread-2',
    body: 'MARKER-REJECT We will not move forward with Platform Engineer.',
  });
  ai.extractions.set('MARKER-REJECT', extraction({ companyName: 'Delayed Co', jobTitle: 'Platform Engineer', rejectionInfo: 'Not moving forward' }));
  await nav('Gmail Sync'); await hasText('Sync Now');
  const thirdSync = (await connection()).lastSyncedAt;
  await clickButton('Sync Now');
  await syncIdleAfter(thirdSync);
  await spaNavigate(`/applications/${target.id}`);
  await hasText('AI suggests Rejected', page, 60_000); // bounded shell refresh, no reload
  row = await targetRow();
  assert.deepEqual([row.aiStatus, row.userStatus, row.userStatusRevision], ['REJECTED', 'OFFER', 1]);
  assert.equal(row.userStatusSetAt.getTime(), confirmedAt.getTime());
  await hasText('AI status: Interview → Rejected');
  await hasText('Email date');
  await hasText('Recorded');

  scenario('S6 competing editors: background refetch never rebases a frozen draft');
  await clickButton('Change status');
  await selectStatus('CLOSED');
  const second = await openPage();
  await second.goto(`${origin}/applications/${target.id}`); await hasText('Set by you', second);
  await clickButton('Change status', 0, second);
  await selectStatus('ASSESSMENT', second);
  await clickButton('Save', 0, second);
  await hasText('Status saved.', second);
  await second.close();
  assert.equal((await targetRow()).userStatusRevision, 2);
  await backgroundRefetch();
  await hasText('changed after you started editing');
  assert.equal(await page.$eval('form[aria-label="Edit application status"] select', (s) => s.value), 'CLOSED');
  const staleSave = page.waitForResponse((r) => r.url().endsWith('/status') && r.request().method() === 'PATCH');
  await clickButton('Save');
  assert.equal((await staleSave).status(), 409);
  await hasText('changed elsewhere');
  assert.equal(await page.$eval('form[aria-label="Edit application status"] select', (s) => s.value), 'CLOSED');
  await clickButton('Use current version');
  await clickButton('Save');
  await hasText('Status saved.');
  row = await targetRow();
  assert.deepEqual([row.userStatus, row.userStatusRevision], ['CLOSED', 3]);

  scenario('S6 explicit clear reveals the persisted AI state without AI work');
  const beforeClear = await effects();
  await clickButton('Change status');
  await selectStatus('__clear__');
  await clickButton('Save');
  await hasText('Inferred by AI');
  row = await targetRow();
  assert.deepEqual([row.userStatus, row.userStatusSetAt, row.userStatusRevision, row.aiStatus], [null, null, 4, 'REJECTED']);
  assert.deepEqual(await effects(), beforeClear);

  scenario('S6 a delayed pre-save read cannot repaint older state');
  const heldRead = hold();
  hooks.holdDetailGet = heldRead;
  await backgroundRefetch();
  await heldRead.started.promise;
  await clickButton('Change status');
  await selectStatus('INTERVIEW');
  await clickButton('Save');
  await hasText('Status saved.');
  heldRead.release.resolve();
  await sleep(1500);
  await hasText('Set by you');
  assert.equal((await targetRow()).userStatusRevision, 5);

  scenario('S6 uncertain save: response lost after commit is reconciled by reading, never resent');
  let patches = counts.patch;
  hooks.dropPatch = true;
  await clickButton('Change status');
  await selectStatus('OFFER');
  await clickButton('Save');
  await hasText("couldn't confirm whether your change was saved");
  assert.equal(counts.patch, patches + 1);
  row = await targetRow();
  assert.deepEqual([row.userStatus, row.userStatusRevision], ['OFFER', 6]);
  await clickButton('Use current version');
  await clickButton('Cancel');

  scenario('S6 failed reconciliation keeps the draft and blocks saving');
  patches = counts.patch;
  hooks.dropPatch = 'fail-reads';
  await clickButton('Change status');
  await selectStatus('APPLIED');
  await clickButton('Save');
  await hasText('Save outcome unknown');
  assert.equal(await page.$$eval('form[aria-label="Edit application status"] button[type="submit"]', (b) => b[0].disabled), true);
  hooks.failDetailGets = false;
  await clickButton('Retry loading status');
  await hasText("couldn't confirm whether your change was saved");
  assert.equal(counts.patch, patches + 1);
  assert.equal((await targetRow()).userStatusRevision, 7);
  await clickButton('Cancel');

  scenario('S6 invalid contract blocks editing; valid null stays valid');
  hooks.corruptDetail = true;
  await page.goto(`${origin}/applications/${target.id}`);
  await hasText('Failed to load application data');
  assert(!(await text()).includes('Change status'));
  hooks.corruptDetail = false;
  await clickButton('Retry');
  await hasText('Change status');
  await page.goto(`${origin}/applications/${paged.id}`); await hasText('No status yet'); await hasText('Status unknown');

  scenario('S6 navigation while a save is pending keeps the result on its application');
  await page.goto(`${origin}/applications/${target.id}`); await hasText('Change status');
  const heldPatch = hold();
  hooks.holdPatch = heldPatch;
  await clickButton('Change status');
  await selectStatus('CLOSED');
  await clickButton('Save');
  await heldPatch.started.promise;
  await spaNavigate(`/applications/${paged.id}`);
  await hasText('Audit Company 24');
  heldPatch.release.resolve();
  await waitFor(async () => (await targetRow()).userStatusRevision === 8, 'held PATCH commit');
  await sleep(500);
  assert((await text()).includes('No status yet'), 'result leaked into another application');
  await spaNavigate(`/applications/${target.id}`);
  await hasText('Closed');

  scenario('S6 uncertain creation: committed POST with malformed 201 is never replayed');
  await page.goto(`${origin}/applications`); await hasText('Add Application');
  await clickButton('Add Application');
  await page.type('#companyName', 'Smoke Uncertain Co');
  hooks.corruptCreate = true;
  const posts = counts.createPost;
  await clickButton('Save');
  await hasText('Creation outcome unknown');
  await hasText('Create anyway');
  assert.equal(await page.$eval('#companyName', (i) => i.value), 'Smoke Uncertain Co');
  assert.equal(counts.createPost, posts + 1);
  assert.equal(await prisma.application.count({ where: { userId: user.id, companyName: 'Smoke Uncertain Co' } }), 1);
  await clickButton('Review applications');
  await hasText('Smoke Uncertain Co');
  assert.equal(counts.createPost, posts + 1);

  scenario('S6-03 delivery evidence from the installed queue');
  const boss = await getQueue();
  const registration = boss.getWipData().find((w) => w.name === EMAIL_PROCESSING_JOB);
  assert.equal(registration?.options?.batchSize, 1);
  const outcomes = await prisma.$queryRaw`SELECT state, count(*)::int AS n FROM pgboss.job
    WHERE name = 'email-processing-job' AND data->>'userId' = ${user.id} GROUP BY state`;
  assert(outcomes.every((o) => o.state === 'completed'), JSON.stringify(outcomes));
  const pending = await prisma.email.count({ where: { userId: user.id, processingState: { not: 'COMPLETED' } } });
  assert.equal(pending, 0, 'every delivered fixture email has a recorded outcome');
  console.log(JSON.stringify({ event: 'smoke_delivery_evidence', pgBoss: JSON.parse(fs.readFileSync(path.join(backendDir, 'node_modules/pg-boss/package.json'), 'utf8')).version, batchSize: 1, outcomes }));

  // ── BYO AI scenarios (ADR-0001) ─────────────────────────────────────────────────────────────
  const FIXTURE_KEY = 'fixture-ai-key-never-sent';
  const AI_SMOKE_KEY = 'AIza-smoke-SENTINEL-key-0001';
  const fixtureEmail = (id) => prisma.email.findFirst({ where: { userId: user.id, gmailMessageId: id } });
  // A delivery that only waited for AI is withdrawn (cancelled) so the email can be re-offered at once.
  const jobDone = (emailId) => waitFor(async () => (await prisma.$queryRaw`SELECT 1 FROM pgboss.job
    WHERE name = 'email-processing-job' AND data->>'emailId' = ${emailId} AND state IN ('completed', 'cancelled')`).length > 0, 'email job outcome');
  const syncNow = async () => {
    const since = (await connection()).lastSyncedAt;
    const accepted = await page.evaluate(async () => (await fetch('/api/gmail/sync', { method: 'POST' })).status);
    assert.equal(accepted, 202);
    await syncIdleAfter(since);
  };
  const clearCooldown = () => prisma.aIConfiguration.update({ where: { userId: user.id }, data: { cooldownUntil: new Date(Date.now() - 1000) } });
  // Opt-in visual evidence: SMOKE_SCREENSHOTS=<dir> saves the new AI screens for review.
  const shot = async (name) => {
    if (!process.env.SMOKE_SCREENSHOTS) return;
    fs.mkdirSync(process.env.SMOKE_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.SMOKE_SCREENSHOTS, `${name}.png`), fullPage: true });
  };
  const browserKeeps = (p = page) => p.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href);

  scenario('BYO AI: the AI provider page shows the user’s own setup, never the key');
  await nav('AI Provider'); await hasText('Saved (hidden)'); await hasText('Google Gemini');
  assert(!(await text()).includes(FIXTURE_KEY), 'the saved key must never be shown');
  await shot('ai-status-ready');

  scenario('BYO AI: a rate-limited provider pauses this user; mail waits as PENDING and resumes on sync');
  fixtureMessage('smoke-ai-limited', { subject: 'Limited Co recruiter note', from: 'talent@limited.example', threadId: 'smoke-thread-limited', body: 'MARKER-LIMITED Are you open to a chat?' });
  ai.extractions.set('MARKER-LIMITED', extraction({ companyName: 'Limited Co' }));
  ai.refuse = 'RATE_LIMITED';
  await syncNow();
  await waitFor(async () => (await prisma.aIOperation.findFirst({ where: { email: { userId: user.id, gmailMessageId: 'smoke-ai-limited' }, errorCode: 'RATE_LIMITED' } })) !== null, 'refused claim released');
  const limited = await fixtureEmail('smoke-ai-limited');
  await jobDone(limited.id);
  assert.equal((await fixtureEmail('smoke-ai-limited')).processingState, 'PENDING', 'refused mail waits, not FAILED');
  assert.equal((await prisma.aIOperation.findFirstOrThrow({ where: { emailId: limited.id } })).attempts, 0, 'a refusal uses no attempt');
  assert((await prisma.aIConfiguration.findUniqueOrThrow({ where: { userId: user.id } })).cooldownUntil > new Date(), 'per-user cooldown set');
  await page.goto(`${origin}/gmail`); await hasText('is limiting requests'); await hasText('Waiting for AI');
  await shot('gmail-waiting-for-ai');
  ai.refuse = null;
  await clearCooldown(); // as if the cooldown had passed
  await syncNow();
  await waitFor(async () => (await fixtureEmail('smoke-ai-limited')).processingState === 'COMPLETED', 'resumed processing');
  assert.equal((await prisma.aIOperation.findFirstOrThrow({ where: { emailId: limited.id, operation: 'classification' } })).attempts, 1);

  scenario('BYO AI: without AI set up, new mail waits; saving a key in the form resumes it');
  assert.equal(await page.evaluate(async () => (await fetch('/api/ai/settings', { method: 'DELETE' })).status), 200);
  fixtureMessage('smoke-ai-unset', { subject: 'Unset Co interview', from: 'hr@unset.example', threadId: 'smoke-thread-unset', body: 'MARKER-UNSET Interview on Monday' });
  ai.extractions.set('MARKER-UNSET', extraction({ companyName: 'Unset Co' }));
  const callsWithoutAI = ai.classification + ai.refusals;
  await syncNow();
  await waitFor(async () => !!(await fixtureEmail('smoke-ai-unset')), 'ingested');
  await jobDone((await fixtureEmail('smoke-ai-unset')).id);
  assert.equal((await fixtureEmail('smoke-ai-unset')).processingState, 'PENDING');
  assert.equal(ai.classification + ai.refusals, callsWithoutAI, 'no provider call without the user’s own AI');
  await nav('Dashboard'); await hasText('AI is not set up');
  await shot('dashboard-ai-not-set-up');
  await nav('AI Provider'); await hasText('Set up Google Gemini');
  await shot('ai-choose-provider');
  await clickButton('Set up Google Gemini');
  await shot('ai-setup-form');
  await page.type('#ai-api-key', AI_SMOKE_KEY);
  await page.click('#ai-consent');
  const saveResponse = page.waitForResponse((r) => r.url().endsWith('/api/ai/settings') && r.request().method() === 'PUT');
  await clickButton('Save and verify');
  assert.equal((await saveResponse).status(), 200);
  await hasText('Connected. Waiting emails are being processed');
  assert.equal(await page.$eval('#ai-api-key', (input) => input.value).catch(() => ''), '', 'key field cleared');
  assert(!(await text()).includes(AI_SMOKE_KEY) && !(await browserKeeps()).includes(AI_SMOKE_KEY), 'key kept in the browser');
  const saved = await prisma.aIConfiguration.findUniqueOrThrow({ where: { userId: user.id } });
  assert(saved.encryptedApiKey.startsWith('v1:') && !saved.encryptedApiKey.includes(AI_SMOKE_KEY));
  await waitFor(async () => (await fixtureEmail('smoke-ai-unset')).processingState === 'COMPLETED', 'waiting mail resumed after setup');

  scenario('BYO AI: an uncertain outcome is held; "Retry anyway" sends exactly one approved attempt');
  fixtureMessage('smoke-ai-unknown', { subject: 'Uncertain Co update', from: 'hr@uncertain.example', threadId: 'smoke-thread-unknown', body: 'MARKER-UNKNOWN Next steps' });
  ai.extractions.set('MARKER-UNKNOWN', extraction({ companyName: 'Uncertain Co' }));
  ai.refuse = 'OUTCOME_UNKNOWN';
  await syncNow();
  await waitFor(async () => (await fixtureEmail('smoke-ai-unknown'))?.processingState === 'FAILED', 'held as failed');
  const uncertain = await fixtureEmail('smoke-ai-unknown');
  assert.equal((await prisma.aIOperation.findFirstOrThrow({ where: { emailId: uncertain.id } })).status, 'UNKNOWN');
  ai.refuse = null;
  await clearCooldown();
  await page.goto(`${origin}/gmail`); await hasText('Uncertain Co update');
  const triggerHandle = await page.evaluateHandle(() =>
    [...document.querySelectorAll('tbody tr')].find((row) => row.textContent.includes('Uncertain Co update')).querySelector('.cursor-help'));
  await triggerHandle.hover();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Manual Retry')));
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Manual Retry')).click());
  await hasText('Retry with a possible extra charge?');
  await shot('retry-anyway-dialog');
  const approval = page.waitForRequest((r) => r.url().endsWith(`/api/emails/${uncertain.id}/retry`) && (r.postData() ?? '').includes('acceptPossibleDuplicateCharge'));
  await clickButton('Retry anyway');
  await approval;
  await waitFor(async () => (await fixtureEmail('smoke-ai-unknown')).processingState === 'COMPLETED', 'approved retry processed');
  assert.deepEqual(
    await prisma.aIOperation.findFirstOrThrow({ where: { emailId: uncertain.id, operation: 'classification' }, select: { status: true, attempts: true, approvedRetries: true } }),
    { status: 'COMPLETED', attempts: 2, approvedRetries: 1 },
  );

  // ── MCP feature scenarios (ADR-0002, MCP-09 part A) ──────────────────────────────────────────
  // The official SDK client stands in for the agent: it sends the fixture daily file's applied
  // entries, twice. That skipped entries are never sent is agent behaviour (checked in part B).
  const applied = mcpFixture.entries.filter((e) => e.status === 'applied');
  for (const entry of mcpFixture.entries) assert(mcpDailyFile.includes(`### ${entry.heading}`), `daily file lacks ${entry.heading}`);
  const mcpConnect = async (bearer, mode) => {
    const client = new mcpSdk.Client({ name: 'smoke-agent', version: '1.0.0' }, { versionNegotiation: { mode } });
    await client.connect(new mcpSdk.StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${bearer}` } },
    }));
    return client;
  };
  const submissionsOf = () => prisma.externalSubmission.findMany({ where: { userId: user.id }, orderBy: { sourceRecordRef: 'asc' } });

  scenario('MCP: create a token on the Automation page by keyboard; shown once, never kept in the browser');
  for (const seedApp of mcpFixture.seedApplications) await prisma.application.create({ data: { userId: user.id, ...seedApp } });
  await nav('Automation'); await hasText('Create a token');
  await page.focus('#token-name');
  await page.keyboard.type('Smoke laptop');
  await page.keyboard.press('Tab'); // expiry
  await page.keyboard.press('Tab'); // Create token
  assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), 'Create token');
  await page.keyboard.press('Enter');
  await hasText('Copy your new token');
  const mcpToken = await page.$eval('#new-token', (input) => input.value);
  assert.match(mcpToken, /^ccmcp_[A-Za-z0-9_-]{43}$/);
  await shot('automation-token-created');
  await clickButton('Done, I saved it');
  await lacksText('Copy your new token');
  assert(!(await text()).includes(mcpToken) && !(await browserKeeps()).includes(mcpToken), 'token kept in the browser');
  await hasText(mcpToken.slice(0, 12)); // display prefix only
  const tokenRow = await prisma.integrationToken.findFirstOrThrow({ where: { userId: user.id } });
  assert(!JSON.stringify(tokenRow).includes(mcpToken.slice(12)), 'plaintext stored');

  scenario('MCP: the SDK client sends the applied entries twice (2025 and 2026-07-28 eras); no duplicates');
  const legacyClient = await mcpConnect(mcpToken, 'legacy');
  const { tools } = await legacyClient.listTools();
  assert.deepEqual(tools.map((t) => t.name), ['record_application_submission']);
  const firstPass = [];
  for (const entry of applied) {
    const result = await legacyClient.callTool({ name: 'record_application_submission', arguments: entry.arguments });
    assert(!result.isError, JSON.stringify(result));
    assert.equal(result.structuredContent.result, entry.expected, entry.heading);
    firstPass.push(result.structuredContent.recordId);
  }
  await legacyClient.close();
  const modernClient = await mcpConnect(mcpToken, 'auto');
  assert.equal(modernClient.getNegotiatedProtocolVersion(), '2026-07-28');
  for (const [i, entry] of applied.entries()) {
    const replay = await modernClient.callTool({ name: 'record_application_submission', arguments: entry.arguments });
    assert.deepEqual(replay.structuredContent, { result: 'already_recorded', recordId: firstPass[i] });
  }
  const leak = await modernClient.callTool({ name: 'record_application_submission', arguments: { ...applied[0].arguments, sourceRecordRef: '2026-10-01/11:00:00', submittedAnswers: 'FIXTURE-SECRET-ANSWER' } });
  assert.equal(leak.isError, true);
  assert.deepEqual(JSON.parse(leak.content[0].text), { code: 'invalid_input', fields: ['submittedAnswers'], retry: 'Do not retry until the entry is fixed.' });
  await modernClient.close();
  const submissions = await submissionsOf();
  assert.deepEqual(submissions.map((r) => [r.sourceRecordRef, r.matchState, r.resolvedBy]), [
    ['2026-10-01/09:15:00', 'CREATED', 'AUTOMATIC'],
    ['2026-10-01/09:32:10', 'LINKED', 'AUTOMATIC'],
    ['2026-10-01/10:05:45', 'NEEDS_REVIEW', null],
  ]);
  assert(!JSON.stringify(submissions).includes('FIXTURE-SECRET-ANSWER'), 'answers must never be stored');
  assert.equal(submissions[0].jobUrl, 'https://careers.fabrikam.example/jobs/123');
  const fabrikam = await prisma.application.findUniqueOrThrow({ where: { id: submissions[0].applicationId } });
  assert.deepEqual([fabrikam.companyName, fabrikam.jobTitle, fabrikam.aiStatus, fabrikam.userStatus, fabrikam.appliedAt.toISOString()],
    ['Fabrikam', 'Backend Engineer', null, null, '2026-10-01T03:45:00.000Z']);
  assert.equal(await prisma.application.count({ where: { userId: user.id, companyName: 'Fabrikam' } }), 1);
  assert.equal(await prisma.applicationEvent.count({ where: { type: 'AUTOMATION_SUBMITTED', application: { userId: user.id } } }), 2);

  scenario('MCP: list and timeline show the automation submission distinctly');
  await nav('Applications'); await hasText('Fabrikam');
  const fabrikamCard = await cardText('Fabrikam');
  assert(fabrikamCard.includes('Applied · via automation') && fabrikamCard.includes('Submitted via automation'), fabrikamCard);
  await page.click(`a[href="/applications/${fabrikam.id}"]`);
  await hasText('Reported by your automation');
  await hasText('Thank you for applying to Fabrikam.');
  assert(!(await text()).includes('Source email unavailable') && !(await text()).includes('AI interpretation'), 'automation event mislabelled');
  await shot('automation-timeline');

  scenario('MCP: the review panel resolves the uncertain submission by keyboard, also usable on a narrow screen');
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${origin}/`); await hasText('Automation submissions to review');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'review panel overflows on mobile');
  await shot('dashboard-submission-review-mobile');
  await page.setViewport({ width: 1280, height: 900 });
  const contoso = await prisma.application.findFirstOrThrow({ where: { userId: user.id, companyName: 'Contoso' } });
  const pendingId = submissions[2].id;
  await page.focus(`#link-${pendingId}`);
  await page.select(`#link-${pendingId}`, contoso.id);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), 'Link');
  const resolveAck = page.waitForResponse((r) => r.url().endsWith(`/api/submissions/${pendingId}/resolve`));
  await page.keyboard.press('Enter');
  assert.equal((await resolveAck).status(), 200);
  await lacksText('Automation submissions to review');
  const resolved = await prisma.externalSubmission.findUniqueOrThrow({ where: { id: pendingId } });
  assert.deepEqual([resolved.matchState, resolved.resolvedBy, resolved.applicationId], ['LINKED', 'USER', contoso.id]);

  scenario('MCP: a later Gmail email matches the created application through the real workers');
  fixtureMessage('smoke-mcp-fabrikam', { subject: 'Fabrikam — next steps', from: 'talent@fabrikam.example', threadId: 'smoke-thread-fabrikam', body: 'MARKER-FABRIKAM Please book an interview for Backend Engineer.' });
  ai.extractions.set('MARKER-FABRIKAM', extraction({ companyName: 'Fabrikam', jobTitle: 'Backend Engineer', interviewStage: 'First round' }));
  await syncNow();
  await waitFor(async () => (await fixtureEmail('smoke-mcp-fabrikam'))?.processingState === 'COMPLETED', 'Fabrikam email processed');
  const fabrikamEmail = await fixtureEmail('smoke-mcp-fabrikam');
  assert.deepEqual([fabrikamEmail.applicationId, fabrikamEmail.matchState], [fabrikam.id, 'MATCHED']);
  await page.goto(`${origin}/applications/${fabrikam.id}`);
  await hasText('Email Processed'); await hasText('Submitted via automation');
  await hasText('Inferred by AI'); // a later AI status takes over the automation badge
  assert(!(await text()).includes('Applied · via automation'));

  scenario('MCP: revoking the token on the page stops the client at once');
  await nav('Automation'); await hasText('Smoke laptop');
  await clickButton('Revoke');
  await clickButton('Revoke now');
  await hasText('Revoked');
  await assert.rejects(mcpConnect(mcpToken, 'legacy'), 'a revoked token must be refused');
  assert.equal((await submissionsOf()).length, 3, 'no duplicates after replays');

  scenario('narrow viewport, editor included');
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${origin}/applications/${target.id}`); await hasText('Delayed Co');
  await clickButton('Change status');
  await page.waitForSelector('form[aria-label="Edit application status"] select');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Mobile layout overflows');
  await clickButton('Cancel');
  await page.goto(`${origin}/automation`); await hasText('Create a token');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Automation page overflows on mobile');
  return page;
}

try {
  const fixtures = await seed();
  await startGmailSyncWorker();
  await startEmailProcessingWorker();
  let page = inject ? null : await runBrowserScenarios(fixtures);
  if (inject === 'scenario-failure') {
    // A failed run can still have browser activity in flight: open a page for the browser probe.
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith(origin) ? r.continue() : r.abort()));
    await page.goto(`${origin}/login`);
  }
  await startDrainProbe(fixtures.user, fixtures.target.id, page);
  if (inject === 'scenario-failure') throw new Error('injected scenario failure');
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, [], 'unexpected backend outbound traffic');
  assert.deepEqual([...unexpectedBrowserHosts], [], 'unexpected browser outbound traffic');
  console.log(`Browser asset requests aborted (expected hosts): ${[...browserBlocked].join(', ') || 'none'}`);
  passed = true;
} catch (err) {
  console.error(inject === 'scenario-failure' ? 'Injected failure:' : 'FAIL:', err?.message ?? err);
  if (!inject) console.error(err?.stack);
} finally {
  const report = await teardown();
  console.log(JSON.stringify({ event: 'smoke_teardown', inject: inject || null, ...report }));
  const residueFree = report.residual && Object.values(report.residual).every((n) => n === 0);
  const drainedInOrder = report.probe?.httpWritesFinishedBeforeCleanup && report.probe?.activeWorkerFinishedBeforeCleanup;
  let ok;
  if (inject === 'http-drain' || inject === 'worker-drain') {
    const { PrismaClient } = requireBackend('@prisma/client');
    const check = new PrismaClient();
    const retained = await check.user.count().finally(() => check.$disconnect());
    const failedSide = inject === 'http-drain' ? !report.httpDrained : !report.workersDrained;
    ok = !report.cleaned && failedSide && retained > 0;
    console.log(ok
      ? `PASS: injected ${inject} failure quarantined the lane (no fixture deletion; ${retained} fixture users retained; outbound blocking and lane lock held until exit). Reset this disposable lane before reuse.`
      : `FAIL: injected ${inject} failure was not quarantined`);
  } else if (inject === 'scenario-failure') {
    ok = !passed && report.cleaned && drainedInOrder && residueFree;
    console.log(ok
      ? 'PASS: after an injected scenario failure, teardown drained the in-flight HTTP write and active worker before cleanup and left no residue.'
      : `FAIL: failed-run teardown was not safe ${JSON.stringify(report)}`);
  } else {
    ok = passed && report.cleaned && drainedInOrder && residueFree;
    if (ok) console.log(`PASS: real API/PostgreSQL/pg-boss with real Gmail and email workers (fixture Gmail/Gemini adapters, AI calls ${ai.classification + ai.extraction}); Sprint 5 scenarios plus BYO AI (own setup, rate-limit wait/resume, setup through the form, Retry anyway) plus MCP (token by keyboard, SDK client replay in both eras, no duplicates, review by keyboard, Gmail match after automation, revoke) plus Sprint 6 canonical reads, keyboard correction, zero-side-effect manual interval, AI-after-correction, competing editors (409), clear, delayed read, uncertain/failed-reconciliation save, invalid contract, navigation, uncertain creation, delivery evidence, mobile; drained browser- and Node-originated in-flight writes and an active worker before cleanup; residue 0; outbound blocked.`);
    else if (passed) console.error('FAIL: teardown ordering/cleanup was not proven', JSON.stringify(report));
  }
  process.exit(ok ? 0 : 1);
}
