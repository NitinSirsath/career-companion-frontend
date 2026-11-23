import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  answersBlock,
  jobsOf,
  newAnswer,
  numberUnit,
  readRun,
  storageKey,
  type Waiting,
} from '../../site/apply/run/data';
import { northlistCard, questions, report } from '../../site/apply/run/views';

/** "Today's run" of NorthList Apply, northlist.site/apply/run (owner, 23 Nov 2026). */
const site = (name: string) => readFileSync(resolve(__dirname, '../../site', name), 'utf8');
const link = (facts: object) => `#${JSON.stringify(facts)}`;

const NIGHT: Waiting = {
  id: 'w1',
  company: 'Nova Retail',
  title: 'Frontend Engineer',
  site: 'LinkedIn',
  question: 'Are you willing to work night shifts?',
  kind: 'yesno',
};
const WHY: Waiting = {
  id: 'w2',
  company: 'Vesta',
  title: 'UI Engineer',
  site: 'Naukri',
  question: 'Why do you want to join Vesta?',
  kind: 'text',
  draft: 'I build React products.',
};

describe('the facts in the link', () => {
  it('reads the facts the AI writes, with the sites in the user’s words', () => {
    const run = readRun(
      link({
        mode: 'report',
        date: '2026-11-23',
        firstName: 'Rahul',
        plan: [{ site: 'linkedin', planned: 6, applied: 3 }],
        applied: [{ company: 'Delta', title: 'FE', site: 'naukri', time: '09:41:10' }],
        waiting: [{ ...NIGHT, site: 'linkedin' }],
        stops: [{ site: 'indeed', message: 'Too many requests' }],
        passedOver: 12,
        northlist: { connected: true, sent: 1 },
      }),
    );
    expect(run?.plan[0]).toEqual({ site: 'LinkedIn', planned: 6, applied: 3 });
    expect(run?.applied[0]).toMatchObject({ site: 'Naukri', time: '09:41' });
    expect(run?.waiting[0].site).toBe('LinkedIn');
    expect(run?.stops[0].site).toBe('Indeed');
    expect(run?.northlist).toEqual({ connected: true, sent: 1 });
  });

  it('works when the AI leaves lists out, as it does with nothing to say', () => {
    const run = readRun(link({ mode: 'questions', firstName: 'Rahul', waiting: [NIGHT] }));
    expect(run).toMatchObject({ mode: 'questions', applied: [], skipped: [], plan: [], stops: [] });
    expect(run?.passedOver).toBe(0);
    expect(run?.northlist).toEqual({ connected: false, sent: 0 });
  });

  it('reads a link the browser encoded, and nothing from a link without facts', () => {
    expect(
      readRun(`#${encodeURIComponent(JSON.stringify({ waiting: [NIGHT] }))}`)?.waiting,
    ).toHaveLength(1);
    expect(readRun('')).toBeNull();
    expect(readRun('#hello')).toBeNull();
    expect(readRun('#{broken')).toBeNull();
  });

  it('asks a list question without options as a written one', () => {
    const run = readRun(
      link({
        waiting: [
          { ...NIGHT, kind: 'choice' },
          { ...NIGHT, id: 'w9', kind: 'odd' },
        ],
      }),
    );
    expect(run?.waiting.map((w) => w.kind)).toEqual(['text', 'text']);
  });
});

describe('the questions', () => {
  it('start empty, except written ones, which start from the AI’s draft for this employer only', () => {
    expect(newAnswer(NIGHT)).toEqual({ value: '', every: true });
    expect(newAnswer(WHY)).toEqual({ value: 'I build React products.', every: false });
  });

  it('group by job, so one card holds all of a job’s questions', () => {
    const rust = { ...NIGHT, id: 'w3', question: 'Years of Rust?' };
    expect(jobsOf([NIGHT, WHY, rust]).map((j) => j.map((w) => w.id))).toEqual([
      ['w1', 'w3'],
      ['w2'],
    ]);
  });

  it('give years, months and days a stepper, and other numbers a box', () => {
    expect(numberUnit('How many years of experience do you have with Rust?')).toBe('Years');
    expect(numberUnit('Notice period in days?')).toBe('Days');
    expect(numberUnit('Expected salary?')).toBeNull();
  });

  it('show buttons, pills, a stepper and the draft, never a blank form', () => {
    const choice: Waiting = { ...NIGHT, id: 'w4', kind: 'choice', options: ['Referral', 'Other'] };
    const years: Waiting = { ...NIGHT, id: 'w5', kind: 'number', question: 'Years of Rust?' };
    const run = readRun(link({ waiting: [NIGHT, WHY, choice, years] }))!;
    const html = questions(
      run,
      Object.fromEntries(run.waiting.map((w) => [w.id, newAnswer(w)])),
      0,
    );
    expect(html).toContain('value="Yes"');
    expect(html).toContain('value="Referral"');
    expect(html).toContain('class="stepper"');
    expect(html).toContain('I build React products.');
    expect(html).toContain('Only Vesta');
    expect(html).toContain('0 of 4 answered');
  });
});

describe('the answers the AI reads back', () => {
  it('are records in the format of AGENTS.md section 7, under the right heading', () => {
    const block = answersBlock([NIGHT, WHY], {
      w1: { value: 'No', every: true },
      w2: { value: 'I like design-led teams.\\nIn Pune.', every: false },
    });
    expect(block).toBe(
      [
        'BEGIN NORTHLIST ANSWERS',
        '',
        '## form_answers.md: Learned Answers',
        '- Context: Employer=Any; Country=Any; Role=Any; Portal/ATS=Any',
        '- Exact question: Are you willing to work night shifts?',
        '- Answer: No',
        '- Reuse scope: broader context explicitly approved by the user',
        '',
        '## form_answers.md: Contextual Answers',
        '- Context: Employer=Vesta; Country=Any; Role=UI Engineer; Portal/ATS=Naukri',
        '- Exact question: Why do you want to join Vesta?',
        '- Answer: I like design-led teams. In Pune.',
        '- Reuse scope: exact context only',
        '',
        '## Apply again',
        '- Nova Retail · Frontend Engineer · LinkedIn',
        '- Vesta · UI Engineer · Naukri',
        '',
        'END NORTHLIST ANSWERS',
      ].join('\\n'),
    );
  });

  it('leave out questions the user skipped, and their jobs', () => {
    const block = answersBlock([NIGHT, WHY], {
      w1: { value: 'Yes', every: true },
      w2: { value: '  ', every: false },
    });
    expect(block).not.toContain('Vesta');
    expect(block).toContain('- Nova Retail · Frontend Engineer · LinkedIn');
  });

  it('are kept per run and per question set', () => {
    const a = readRun(link({ date: '2026-11-23', waiting: [NIGHT] }))!;
    const b = readRun(link({ date: '2026-11-23', waiting: [WHY] }))!;
    expect(storageKey(a)).not.toBe(storageKey(b));
  });
});

describe('the report and NorthList', () => {
  const run = readRun(
    link({
      date: '2026-11-23',
      plan: [{ site: 'linkedin', planned: 4, applied: 6 }],
      applied: Array.from({ length: 7 }, (_, i) => ({
        company: `Co ${i}`,
        title: 'FE',
        site: 'linkedin',
        time: '10:00',
      })),
      skipped: [{ company: 'Sola', title: 'UI', reason: 'Needs 8+ years' }],
    }),
  )!;

  it('shows the count, the bars (never past full), five jobs and the skip reasons', () => {
    const html = report(run);
    expect(html).toContain('data-count="7"');
    expect(html).toContain('width:100%');
    expect(html).toContain('Show all 7');
    expect(html).toContain('Needs 8+ years');
  });

  it('offers Connect when NorthList is not connected, and Open with the count when it is', () => {
    expect(northlistCard(run)).toContain('Connect NorthList');
    expect(northlistCard(run)).toContain('https://app.northlist.site/automation?tab=setup');
    const on = { ...run, northlist: { connected: true, sent: 7 } };
    expect(northlistCard(on)).toContain('7 of 7 sent to NorthList');
    expect(northlistCard(on)).toContain('Open NorthList');
  });

  it('escapes what the AI wrote', () => {
    const bad = readRun(link({ skipped: [{ company: '<img src=x>', title: 'a', reason: 'b' }] }))!;
    expect(report(bad)).not.toContain('<img src=x>');
  });
});

describe('the page', () => {
  it('is built for the site, not indexed, and loads its script from the site root', () => {
    const html = site('apply/run/index.html');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('src="/apply/run/run.ts"');
    expect(readFileSync(resolve(__dirname, '../../vite.site.config.ts'), 'utf8')).toContain(
      "'apply/run/index'",
    );
  });

  it('says Done in the tab title once saved, which the AI watches for', () => {
    expect(site('apply/run/run.ts')).toContain("'Done · Today’s run · NorthList Apply'");
  });
});
