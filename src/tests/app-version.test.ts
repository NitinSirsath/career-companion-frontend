/// <reference types="node" />

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { filesIn, fingerprint, writeVersion, type NamedFile } from '../../scripts/app-version';

const built: NamedFile[] = [
  ['index.html', '<script src="/assets/index-a1.js"></script>'],
  ['assets/index-a1.js', 'console.log("app")'],
  ['public/sw.js', new TextEncoder().encode('self.skipWaiting()')],
];
let folder: string | undefined;
afterEach(() => folder && fs.rmSync(folder, { recursive: true, force: true }));

describe("the app's version", () => {
  it('is the same for the same files, in any order', () => {
    const version = fingerprint(built);
    expect(version).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprint([...built].reverse())).toBe(version);
  });

  it('changes when a file changes, is renamed, added or removed', () => {
    const version = fingerprint(built);
    const [page, script, worker] = built;
    expect(fingerprint([page, ['assets/index-a1.js', 'console.log("app!")'], worker])).not.toBe(
      version,
    );
    expect(fingerprint([page, ['assets/index-b2.js', script[1]], worker])).not.toBe(version);
    expect(fingerprint([...built, ['public/icon.png', 'png']])).not.toBe(version);
    expect(fingerprint([page, script])).not.toBe(version);
  });

  it('lists every file of a folder by its path from that folder', () => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'app-version-'));
    fs.mkdirSync(path.join(folder, 'icons'));
    fs.writeFileSync(path.join(folder, 'sw.js'), '');
    fs.writeFileSync(path.join(folder, 'icons', 'a.png'), '');
    expect(filesIn(folder).sort()).toEqual([path.join('icons', 'a.png'), 'sw.js']);
  });

  it("is written into the app's page, which has a place for it", () => {
    const page = fs.readFileSync(path.resolve(import.meta.dirname, '../../index.html'), 'utf8');
    expect(page).toContain('<meta name="app-version" content="dev" />');
    expect(writeVersion(page, 'd470b8a61ed98b37')).toContain(
      '<meta name="app-version" content="d470b8a61ed98b37" />',
    );
    expect(() => writeVersion('<html></html>', 'abc')).toThrow(/app-version/);
  });
});
