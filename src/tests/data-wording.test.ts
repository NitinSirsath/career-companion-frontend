import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_DATA_SENT_SUMMARY } from '../contracts/aiCatalog';
import { FREE_AI_FACTS } from '../lib/freeAI';

/** The privacy policy on the product site, and what the app shows before AI consent. */
const policy = readFileSync(resolve(__dirname, '../../site/public/privacy.html'), 'utf8');
const freeAIText = FREE_AI_FACTS.find((fact) => fact.term === 'What is sent')!.text;

describe('what a reply draft sends', () => {
  it('is named in full in the privacy policy and in both texts shown before AI consent', () => {
    const draft = 'any hint you type or reply choice you click, and your first name';
    for (const text of [policy, AI_DATA_SENT_SUMMARY, freeAIText]) expect(text).toContain(draft);
    expect(policy).toContain(
      'Your first name also goes to the AI when you ask it to write a reply, so the draft can end with your name.',
    );
  });
});

describe('the connected Gmail address', () => {
  it('is named in the privacy policy, also that it stays after a disconnect', () => {
    expect(policy).toContain('NorthList also keeps the address of the Gmail account you connect');
    expect(policy).toContain('It keeps the address after you disconnect too');
  });
});
