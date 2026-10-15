/// <reference types="node" />

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';

// The script finds the frontend folder from its own place, so each test runs a copy of it in a
// temporary frontend next to a temporary backend. The real src/contracts is never touched.
const script = path.resolve(import.meta.dirname, '../../scripts/sync-contracts.mjs');
let root: string;
const backend = (file = '') => path.join(root, 'backend/src/contracts', file);
const frontend = (file = '') => path.join(root, 'frontend/src/contracts', file);

function sync() {
  return spawnSync(process.execPath, [path.join(root, 'frontend/scripts/sync-contracts.mjs')], {
    env: { ...process.env, BACKEND_DIR: path.join(root, 'backend') },
    encoding: 'utf8',
  });
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-contracts-'));
  fs.mkdirSync(path.join(root, 'frontend/scripts'), { recursive: true });
  fs.copyFileSync(script, path.join(root, 'frontend/scripts/sync-contracts.mjs'));
  fs.mkdirSync(backend(), { recursive: true });
  fs.mkdirSync(frontend(), { recursive: true });
  fs.writeFileSync(frontend('a.ts'), 'export const a = 0;\n');
  fs.writeFileSync(frontend('stale.ts'), 'export const stale = 0;\n');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

it('copies the backend files and removes a frontend file the backend no longer has', () => {
  fs.writeFileSync(backend('a.ts'), 'export const a = 1;\n');
  const result = sync();
  expect(result.status).toBe(0);
  expect(fs.readdirSync(frontend())).toEqual(['a.ts']);
  expect(fs.readFileSync(frontend('a.ts'), 'utf8')).toBe('export const a = 1;\n');
  expect(result.stdout).toContain('Synced a.ts');
  expect(result.stdout).toContain('Removed stale.ts');
  expect(result.stdout).toContain('(2 file(s) changed)');
  expect(sync().stdout).toContain('(0 file(s) changed)');
});

it('changes nothing and fails when the backend folder has no contract files', () => {
  const result = sync();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Nothing was changed');
  expect(fs.readdirSync(frontend()).sort()).toEqual(['a.ts', 'stale.ts']);
});
