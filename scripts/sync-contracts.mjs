import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendContractsDir = path.resolve(__dirname, '../../career-companion-backend/src/contracts');
const frontendContractsDir = path.resolve(__dirname, '../src/contracts');

if (!fs.existsSync(backendContractsDir)) {
  console.log('Backend contracts directory not found. Skipping sync.');
  process.exit(0);
}

if (!fs.existsSync(frontendContractsDir)) {
  fs.mkdirSync(frontendContractsDir, { recursive: true });
}

const files = fs.readdirSync(backendContractsDir);
for (const file of files) {
  if (file.endsWith('.ts')) {
    fs.copyFileSync(
      path.join(backendContractsDir, file),
      path.join(frontendContractsDir, file)
    );
    console.log(`Synced ${file}`);
  }
}
console.log('Contracts synced successfully.');
