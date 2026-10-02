// Copies the backend-authored shared Zod contracts into src/contracts.
// The backend is BACKEND_DIR, else the sibling career-companion-backend-main, else
// career-companion-backend. A missing backend is a failure, never a silent skip.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env.BACKEND_DIR,
  path.resolve(__dirname, '../../career-companion-backend-main'),
  path.resolve(__dirname, '../../career-companion-backend'),
].filter(Boolean);
const backendDir = candidates.find((dir) => fs.existsSync(path.join(dir, 'src/contracts')));
if (!backendDir) {
  console.error(`Backend contracts not found. Checked: ${candidates.join(', ')}. Set BACKEND_DIR.`);
  process.exit(1);
}
const backendContractsDir = path.join(backendDir, 'src/contracts');
const frontendContractsDir = path.resolve(__dirname, '../src/contracts');
fs.mkdirSync(frontendContractsDir, { recursive: true });

let changed = 0;
for (const file of fs.readdirSync(backendContractsDir).filter((f) => f.endsWith('.ts'))) {
  const source = fs.readFileSync(path.join(backendContractsDir, file));
  const target = path.join(frontendContractsDir, file);
  const same = fs.existsSync(target) && fs.readFileSync(target).equals(source);
  if (!same) {
    fs.writeFileSync(target, source);
    changed++;
  }
  console.log(`${same ? 'Unchanged' : 'Synced'} ${file}`);
}
console.log(`Contracts synced from ${backendContractsDir} (${changed} file(s) changed).`);
