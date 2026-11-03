import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_DATA_SENT_SUMMARY } from '../contracts/aiCatalog';
import { FREE_AI_FACTS } from '../lib/freeAI';

/** The privacy policy on the product site, and what the app shows before AI consent. */
const policy = readFileSync(resolve(__dirname, '../../site/public/privacy.html'), 'utf8');
const yourData = readFileSync(resolve(__dirname, '../../site/privacy/index.html'), 'utf8');
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

describe('what NorthList keeps from the automation', () => {
  it('is named in full on the privacy policy and the Your data page', () => {
    for (const page of [policy, yourData]) {
      expect(page).toContain(
        'where the job was found, the link and address of the page where it applied',
      );
      expect(page).toContain(
        'whether it skipped the job or left it for you, why (up to 1,000 characters)',
      );
      expect(page).toContain('their first 12 characters, so you can tell them apart');
      expect(page).toContain('Revoke an automation token');
      expect(page).toContain('what your automation reported for it');
      expect(page).toContain("can't be deleted one by one. They stay until you delete everything.");
      expect(page).not.toContain('Automation tokens are stored only as a fingerprint');
      expect(page).not.toContain('Remove an automation token');
    }
  });
});

describe('the Dashboard', () => {
  it('sends nothing to the AI, and the daily count of mails checked is named on both pages', () => {
    for (const page of [policy, yourData]) {
      expect(page).not.toMatch(/Dashboard tip|tip on your Dashboard/);
      expect(page).toMatch(/how many inbox mails/i);
    }
    expect(policy).toContain('only the number, no mail details, until you delete your account');
    expect(yourData).toContain(
      'only the number, no mail details. Kept until you delete your account',
    );
  });
});
