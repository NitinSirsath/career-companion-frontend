// Uses the two sibling repositories and an explicitly isolated local test database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const backend = path.join(root, 'career-companion-backend');
const requireBackend = createRequire(path.join(backend, 'package.json'));
requireBackend('dotenv').config({ path: path.join(backend, '.env.test'), override: true });
const { assertTestDatabase } = requireBackend('./dist/utils/testDatabase');
assertTestDatabase(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL);
process.env.NODE_ENV = 'test';
process.env.ENABLE_DEV_AUTH = 'true';
process.env.AI_DAILY_CALL_LIMIT = '0';
process.env.DISCORD_WEBHOOK_URL = '';
const { app } = requireBackend('./dist/index');
const { prisma } = requireBackend('./dist/db/prisma');
const { stopQueue } = requireBackend('./dist/services/queue');
const express = requireBackend('express');
app.use(express.static(path.join(root, 'career-companion-frontend/dist')));
app.use((_req, res) => res.sendFile(path.join(root, 'career-companion-frontend/dist/index.html')));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
let user;
const errors = [];
try {
  user = await prisma.user.create({ data: { email: `smoke-${Date.now()}@audit.test`, name: 'Audit Fixture' } });
  const apps = [];
  for (let i = 0; i < 26; i++) apps.push(await prisma.application.create({ data: {
    userId: user.id, companyName: `Audit Company ${String(i).padStart(2, '0')}`, createdAt: new Date(Date.now() - i * 1000),
  } }));
  const oldest = apps[25];
  await prisma.applicationEvent.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ applicationId: oldest.id, type: 'NOTE_ADDED', description: `Audit event ${i}`, createdAt: new Date(Date.now() + i * 1000) })) });
  await prisma.action.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ applicationId: oldest.id, type: 'ACTION_REQUIRED', description: `Audit task ${i}` })) });
  await prisma.gmailConnection.create({ data: { userId: user.id, gmailEmail: user.email, status: 'CONNECTED', accessToken: 'fixture-never-sent-to-google' } });
  await prisma.email.createMany({ data: Array.from({ length: 26 }, (_, i) => ({ userId: user.id, gmailMessageId: `smoke-${i}`, subject: `Audit email ${i}`, processingState: 'COMPLETED', relevanceState: 'IRRELEVANT', receivedAt: new Date(Date.now() - i * 1000) })) });
  browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (!request.url().startsWith(origin) && !request.url().startsWith('data:')) return request.abort();
    request.continue({ headers: { ...request.headers(), 'X-Development-User': user.email } });
  });
  const text = async () => page.$eval('body', node => node.innerText);
  async function hasText(value) { await page.waitForFunction(value => document.body.innerText.includes(value), {}, value); }
  async function clickButton(name, index = 0) {
    const buttons = await page.$$('button');
    const matches = [];
    for (const button of buttons) if ((await button.evaluate(node => node.textContent.trim())) === name) matches.push(button);
    assert(matches[index], `Missing button ${name}`); await matches[index].click();
  }
  await page.goto(`${origin}/applications`); await hasText('Audit Company 00');
  assert(!(await text()).includes('Audit Company 25'));
  await clickButton('Next'); await hasText('Audit Company 25');
  await page.goto(`${origin}/applications/${oldest.id}`); await hasText('Audit Company 25'); await hasText('Audit event 0');
  assert(!(await text()).includes('Audit event 24'));
  await clickButton('Next', 1); await hasText('Audit event 24');
  const actionResponse = page.waitForResponse(response => response.url().includes('/api/actions/') && response.request().method() === 'PATCH');
  await clickButton('Complete');
  assert.equal((await actionResponse).status(), 200);
  assert.equal(await prisma.action.count({ where: { applicationId: oldest.id, status: 'COMPLETED' } }), 1);
  await clickButton('Next', 0); await hasText('COMPLETED');
  await page.goto(`${origin}/gmail`); await hasText('Audit email 0');
  assert.equal(await page.$$eval('tbody tr', rows => rows.length), 20);
  await clickButton('Next'); await hasText('Audit email 25');
  assert.equal(await page.$$eval('tbody tr', rows => rows.length), 6);
  await clickButton('Sync Now'); await hasText('Syncing...');
  // The API enqueues a real job; no workers/external providers run in this smoke test.
  const queued = await prisma.gmailConnection.findUniqueOrThrow({ where: { userId: user.id } });
  assert.equal(queued.syncStatus, 'SYNCING');
  await prisma.gmailConnection.update({ where: { userId: user.id }, data: { syncStatus: 'IDLE', syncClaim: null, syncLeaseUntil: null, lastSyncedAt: new Date() } });
  await hasText('Last synced'); await hasText('Sync Now');
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${origin}/applications/${oldest.id}`); await hasText('Audit Company 25');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Mobile layout overflows');
  assert.deepEqual(errors, []);
  console.log('PASS: built UI + real API/PostgreSQL; list pagination, direct detail, timeline pagination, action mutation, queued sync polling, mobile layout; external requests blocked.');
} finally {
  if (browser) await browser.close();
  if (user) {
    await prisma.$executeRaw`DELETE FROM pgboss.job WHERE data->>'userId' = ${user.id}`;
    await prisma.user.delete({ where: { id: user.id } });
  }
  await stopQueue();
  await prisma.$disconnect();
  await new Promise(resolve => server.close(resolve));
}
process.exit(0);
