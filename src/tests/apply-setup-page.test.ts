import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  answers,
  applyResume,
  badDates,
  newState,
  parseDate,
  readFacts,
  settleExpected,
  totalYearsCount,
  words,
  type Resume,
} from '../../site/apply/setup/data';

/** The NorthList Apply setup page, northlist.site/apply/setup (owner, 23 Nov 2026). */
const site = (name: string) => readFileSync(resolve(__dirname, '../../site', name), 'utf8');
const TODAY = new Date(2026, 10, 23);
const facts = (extra: Partial<Resume> = {}): Resume => ({
  firstName: 'Rahul',
  lastName: 'Verma',
  email: 'rahul.verma@example.com',
  city: 'Pune',
  country: 'India',
  currentTitle: 'Frontend Engineer',
  employers: [
    { company: 'Brightwave Tech', title: 'Frontend Engineer', start: '2022-04', end: 'Present' },
    { company: 'Kestrel Systems', title: 'Software Developer', start: '2020-07', end: '2022-03' },
  ],
  education: [
    { degree: 'B.E.', field: 'Computer Engineering', institution: 'Pune University', year: 2020 },
  ],
  skillYears: { React: 5, TypeScript: 4 },
  checkedTitles: ['Frontend Engineer'],
  checkedLocations: ['Pune', 'Remote'],
  ...extra,
});

describe('the resume facts in the link', () => {
  it('reads plain or encoded JSON after "#", and nothing else', () => {
    expect(readFacts('#{"firstName":"Seán","lastName":"O\'Brien"}')?.lastName).toBe("O'Brien");
    expect(readFacts(`#${encodeURIComponent('{"firstName":"A & B"}')}`)?.firstName).toBe('A & B');
    expect(readFacts('#step-2')).toBeNull();
    expect(readFacts('#{broken')).toBeNull();
  });

  it('turns short country names into the full names the page lists', () => {
    const S = newState();
    applyResume(S, facts({ country: 'USA', workAuth: [{ country: 'UK', value: 'need' }] }), TODAY);
    expect(S.resume?.country).toBe('United States');
    expect(S.countries).toEqual([
      { name: 'United States', value: 'yes' },
      { name: 'United Kingdom', value: 'need' },
    ]);
  });

  it('picks what the resume states and marks it, and guesses nothing else', () => {
    const S = newState();
    applyResume(
      S,
      facts({
        noticeDays: 30,
        currentSalary: 1200000,
        expectedSalary: 1600000,
        workModes: ['remote'],
        relocate: true,
      }),
      TODAY,
    );
    expect([S.notice, S.current, S.expected, S.expectedOther, S.modes, S.relocate]).toEqual([
      '30',
      '1200000',
      'other',
      '1600000',
      ['remote'],
      true,
    ]);
    expect(S.from).toEqual({
      notice: true,
      current: true,
      expected: true,
      modes: true,
      relocate: true,
    });

    const plain = newState();
    applyResume(plain, facts(), TODAY);
    expect([plain.notice, plain.current, plain.from]).toEqual(['', '', {}]);
    expect(plain.locations).toEqual(['Pune']); // "Remote" is a way of working, not a city
  });

  it('starts a year-only job in January, and asks the user to check a missing start', () => {
    expect(parseDate('2023')).toEqual({ y: 2023, m: 0 });
    expect(parseDate('Mar 2021')).toEqual({ y: 2021, m: 2 });
    expect(parseDate('Present')).toBeNull();
    const S = newState();
    applyResume(
      S,
      facts({ employers: [{ company: 'Pocketline', title: 'Android Developer', end: 'Present' }] }),
      TODAY,
    );
    expect(S.jobs[0]).toMatchObject({ start: { y: 2026, m: 0 }, check: true });
    expect(S.editJobs).toBe(true);
  });
});

describe('the answers', () => {
  it('counts overlapping jobs once and leaves out a career break', () => {
    const S = newState();
    applyResume(
      S,
      facts({
        employers: [
          { company: 'Harbor', title: 'PM', start: '2021-09', end: 'Present' },
          { company: 'Lotus', title: 'Consultant', start: '2019-03', end: '2020-02' },
          { company: 'Meridian', title: 'Associate', start: '2016-01', end: '2019-06' },
        ],
      }),
      TODAY,
    );
    expect(totalYearsCount(S.jobs, TODAY)).toBe(9);
    expect(badDates(S.jobs)).toBe(false);
    S.jobs[1].end = { y: 2018, m: 0 };
    expect(badDates(S.jobs)).toBe(true);
  });

  it('writes money in lakh and crore for rupees', () => {
    expect(words(1200000, 'INR', 'annual')).toBe('₹12 lakh a year');
    expect(words(25000000, 'INR', 'annual', true)).toBe('₹2.5 crore');
    expect(words(135000, 'USD', 'annual')).toBe('$135,000 a year');
  });

  it('turns "Prefer not to say" into None and never a raise', () => {
    const S = newState();
    applyResume(S, facts({ noticeDays: 30 }), TODAY);
    S.currentNone = true;
    settleExpected(S);
    expect(S.expected).toBe('none');
    const block = answers(S);
    expect(block).toContain('- **Current Compensation Amount:** None');
    expect(block).toContain('- **Expected Compensation Amount:** None');
  });

  it('gives the AI one block with the exact labels of profile.md and form_answers.md', () => {
    const S = newState();
    applyResume(S, facts({ noticeDays: 30, currentSalary: 1200000 }), TODAY);
    settleExpected(S);
    const block = answers(S);
    expect(block.startsWith('BEGIN NORTHLIST ANSWERS')).toBe(true);
    expect(block.trim().endsWith('END NORTHLIST ANSWERS')).toBe(true);
    for (const line of [
      '- **Notice Period (Days):** 30',
      '- **Current Compensation Amount:** 1200000',
      '- **Expected Compensation Amount:** 1560000',
      '- **Locations:** Pune; Remote',
      '- **Companies to Skip:** Brightwave Tech',
      '### Country 1',
      '- **Sponsorship required now or in the future:** No',
      '- **Years of experience per skill:** React: 5, TypeScript: 4',
      '- **Start Date:** 2022-04',
      '- **End Date:** Present',
      '- **Graduation Year:** 2020',
    ])
      expect(block).toContain(line);
  });
});

describe('the page', () => {
  const html = site('apply/setup/index.html');
  const code = ['data.ts', 'views.ts', 'stage.ts', 'setup.ts']
    .map((f) => site(`apply/setup/${f}`))
    .join('\n');

  it('is built with the site, kept out of search, and dark unless the user picks light', () => {
    expect(readFileSync(resolve(__dirname, '../../vite.site.config.ts'), 'utf8')).toContain(
      "'apply/setup/index'",
    );
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('id="theme"');
  });

  it('sends nothing anywhere: no server calls, no tracking', () => {
    expect(code).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|navigator\.sendBeacon/);
    expect(html).not.toMatch(/<script[^>]+src="https?:/);
  });

  it('shows the AI the dropped file and its state in plain text and the title', () => {
    expect(code).toContain('RESUME FILE: ${esc(file.name)} | ${file.size} bytes');
    expect(code).toContain("'Resume added · NorthList Apply setup'");
    expect(code).toContain("'Done · NorthList Apply setup'");
  });

  it('connects NorthList on its Setup tab, with the film on Home and the phone app on Mobile', () => {
    expect(code).toContain("'https://app.northlist.site/automation?tab=setup'");
    expect(code).toContain("'https://northlist.site/'");
    expect(code).toContain("'https://northlist.site/mobile'");
  });
});
