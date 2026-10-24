// One-time rename for the frontend (owner, 24 Oct 2026): every text people read says NorthList instead of
// Career Companion. Run from the repository root by the temporary workflow, then Prettier and the contract copy.
// The automation profile line stays as it is, because the automation reads that exact line.
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const OLD = 'Career Companion';
const NEW = 'NorthList';
const KEEP = '- Career Companion server:';

function rewrite(file, change) {
  const before = fs.readFileSync(file, 'utf8');
  const after = change(before);
  if (after !== before) fs.writeFileSync(file, after);
}

const files = execSync(`git grep -l '${OLD}' -- src index.html ':!src/contracts'`, { encoding: 'utf8' })
  .trim()
  .split('\n');
for (const file of files)
  rewrite(file, (text) =>
    text
      .split(KEEP)
      .map((part) => part.split(OLD).join(NEW))
      .join(KEEP),
  );

rewrite('README.md', (text) =>
  text
    .replace('This is the frontend repository for Career Companion.', 'FORMERLY_LINE')
    .split(OLD)
    .join(NEW)
    .replace('FORMERLY_LINE', 'This is the frontend repository for NorthList (formerly Career Companion).'),
);
rewrite('AGENTS.md', (text) =>
  text.replace(
    'This repository contains the Career Companion React/TypeScript frontend.',
    'This repository contains the NorthList React/TypeScript frontend (formerly Career Companion).',
  ),
);
