/**
 * The app's version: a fingerprint of the files a build writes (the page, its scripts and styles)
 * and of everything in `public/`. It changes only when one of them does, so a merge that touches
 * only the product site or the tests leaves every open and installed app alone, and their saved
 * offline copies stay. `vite.config.ts` works it out for each build; the page carries it in
 * `<meta name="app-version">` (`src/lib/appVersion.ts`) and `version.json` says which is live.
 */
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import path from 'node:path';

/** A file by its name, with what is in it. */
export type NamedFile = [name: string, content: string | Uint8Array];

/** The fingerprint of a set of files: the same files give the same version, in any order. */
export function fingerprint(files: Iterable<NamedFile>): string {
  const print = createHash('sha256');
  const sorted = [...files].sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [name, content] of sorted) print.update(`${name}\n`).update(content).update('\n');
  return print.digest('hex').slice(0, 16);
}

/** Every file in a folder, by its path from that folder. */
export function filesIn(dir: string, from = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(file, from) : [path.relative(from, file)];
  });
}

const VERSION_PLACE = /(<meta name="app-version" content=")[^"]*(")/;

/** Writes the version into the page; a page with no place for it stops the build. */
export function writeVersion(html: string, version: string): string {
  if (!VERSION_PLACE.test(html))
    throw new Error('index.html has no <meta name="app-version" content="…"> for the version');
  return html.replace(VERSION_PLACE, `$1${version}$2`);
}
