import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DONE,
  STEPS,
  answers,
  applyResume,
  badDates,
  birthDate,
  digits,
  grouped,
  newState,
  parseDate,
  readFacts,
  settleExpected,
  totalYears,
  totalYearsCount,
  words,
  type Resume,
} from '../../site/apply/setup/data';

/** The NorthList Apply setup page, northlist.site/apply/setup (owner, 23 Nov 2026; clean look, 24 Nov). */
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

describe('what is picked from the start', () => {
  it('picks every way of working, every suggested city and "open to moving"', () => {
    const S = newState();
    expect([S.modes, S.relocate]).toEqual([['remote', 'hybrid', 'onsite'], true]);
    applyResume(
      S,
      facts({ suggestedLocations: ['Pune', 'Mumbai', 'Bengaluru'], checkedLocations: ['Pune'] }),
      TODAY,
    );
    expect(S.locations).toEqual(['Pune', 'Mumbai', 'Bengaluru']);
    expect(answers(S)).toContain('- **Willing to Relocate:** Yes');
  });

  it('still lets the resume win when it states the way of working or moving', () => {
    const S = newState();
    applyResume(S, facts({ workModes: ['hybrid'], relocate: false }), TODAY);
    expect([S.modes, S.relocate]).toEqual([['hybrid'], false]);
  });
});

describe('the details company sites ask', () => {
  it('has its own step before Jobs, nine steps in all', () => {
    expect(STEPS.indexOf('Details')).toBe(6);
    expect(DONE).toBe(9);
  });

  it('writes None for everything the user skipped, and never a guess', () => {
    const S = newState();
    applyResume(S, facts({ noticeDays: 30 }), TODAY);
    const block = answers(S);
    for (const line of [
      '- **LinkedIn Profile URL:** None',
      '- **Date of Birth:** None',
      '- **Gender:** None',
      '- **Nationality:** Indian',
      '- **Postal Code:** None',
      '- **Marks or CGPA (highest degree):** None',
      '- **Ever convicted of a crime:** None',
      '- **Bound by a non-compete agreement:** None',
    ])
      expect(block).toContain(line);
  });

  it('takes links and details the resume states, and what the user answers', () => {
    const S = newState();
    applyResume(
      S,
      facts({
        linkedinUrl: 'https://www.linkedin.com/in/rahul-verma',
        githubUrl: 'https://github.com/rahulv',
        dateOfBirth: '1998-04-07',
        gender: 'Man',
        postalCode: '411001',
      }),
      TODAY,
    );
    expect(S.dob).toEqual({ y: '1998', m: '4', d: '7' });
    Object.assign(S, { convicted: 'No', compete: 'No', marks: '8.4 CGPA' });
    const block = answers(S);
    for (const line of [
      '- **LinkedIn Profile URL:** https://www.linkedin.com/in/rahul-verma',
      '- **GitHub Profile URL:** https://github.com/rahulv',
      '- **Personal Portfolio URL:** None',
      '- **Date of Birth:** 1998-04-07',
      '- **Gender:** Man',
      '- **Postal Code:** 411001',
      '- **Marks or CGPA (highest degree):** 8.4 CGPA',
      '- **Ever convicted of a crime:** No',
    ])
      expect(block).toContain(line);
    expect(birthDate({ d: '7', m: '', y: '1998' })).toBe('None'); // a half-picked date is not a date
  });
});

describe('skill years', () => {
  it('rounds a half year the AI wrote to whole years, so the page never shows a blank', () => {
    const S = newState();
    applyResume(S, facts({ skillYears: { 'Node.js': 3.5, Java: 1.9, Go: 40 } }), TODAY);
    expect(S.skills).toEqual({ 'Node.js': 4, Java: 2, Go: 15 });
    expect(answers(S)).toContain(
      '- **Years of experience per skill:** Node.js: 4, Java: 2, Go: 15+',
    );
  });
});

describe('money', () => {
  it('takes digits only and shows them grouped', () => {
    expect(digits('sfdd18sf00,0x00')).toBe('1800000');
    expect(grouped('1800000', 'INR')).toBe('18,00,000');
    expect(grouped('135000', 'USD')).toBe('135,000');
    expect(grouped('abc', 'INR')).toBe('');
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
    expect(totalYearsCount(S.jobs, TODAY)).toBe(9.3);
    expect(badDates(S.jobs)).toBe(false);
    S.jobs[1].end = { y: 2018, m: 0 };
    expect(badDates(S.jobs)).toBe(true);
  });

  it('keeps half years: 18 months is 1.5, never rounded down to 1', () => {
    const S = newState();
    applyResume(
      S,
      facts({
        employers: [{ company: 'Nova', title: 'Developer', start: '2025-05', end: 'Present' }],
      }),
      TODAY,
    );
    expect(totalYearsCount(S.jobs, TODAY)).toBe(1.5);
    expect(totalYears(S.jobs, TODAY)).toBe('1.5 years');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
    try {
      expect(answers(S)).toContain('- **Total Years of Experience:** 1.5');
    } finally {
      vi.useRealTimers();
    }
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
  const code = ['data.ts', 'views.ts', 'northlist.ts', 'setup.ts']
    .map((f) => site(`apply/setup/${f}`))
    .join('\n');

  it('is built with the site, kept out of search, and light unless the user picks dark', () => {
    expect(readFileSync(resolve(__dirname, '../../vite.site.config.ts'), 'utf8')).toContain(
      "'apply/setup/index'",
    );
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('<html lang="en" data-theme="light">');
    expect(html).toContain("localStorage.getItem('nl-apply-theme') === 'dark'");
    expect(html).toContain('id="theme"');
  });

  it('is one column with its own styles, and leaves the run page its own', () => {
    expect(html).toContain('/styles/apply-onboard.css');
    expect(html).not.toContain('apply-setup.css');
    expect(html).not.toContain('class="stage"');
    expect(site('apply/run/index.html')).toContain('/styles/apply-setup.css');
  });

  it('tells the AI which step the page is on, and has no Enter hint', () => {
    expect(code).toContain('`Step ${S.step + 1} of ${DONE} · ${STEPS[S.step]}`');
    expect(code).not.toMatch(/Press <b>Enter<\/b>|Enter to continue/);
  });

  it('draws NorthList with its own logo, and the phone as an iPhone lock screen', () => {
    const logo = readFileSync(resolve(__dirname, '../components/layout/Logo.tsx'), 'utf8');
    const small = /const SMALL =\s*'([^']+)'/.exec(logo)?.[1] ?? 'no mark found';
    expect(code).toContain(small); // the same mark as the app, never a look-alike
    expect(code).toContain('aria-label="NorthList"');
    for (const part of ['ph-cut', 'ph-status', 'ph-widgets', 'ph-keys', 'ph-home', 'ph-btn'])
      expect(code).toContain(`class="${part}`);
    // The phone's parts carry their own prefix: a part named "btn" or "status" would pick up the page's styles
    const drawing = /const phone = `([\s\S]*?)`/.exec(site('apply/setup/northlist.ts'))?.[1] ?? '';
    const classes = [...drawing.matchAll(/class="([^"]+)"/g)].map((c) => c[1].split(' ')[0]);
    expect(classes.length).toBeGreaterThan(12);
    expect(classes.filter((c) => !/^(ph-|w-|nl-)/.test(c))).toEqual([]);
  });

  it('shows NorthList as a working picture: sites to pick, jobs to open, a phone alert', () => {
    for (const hook of ['data-nl-tab', 'data-nl-row', 'data-nl-open', 'Your AI is applying now'])
      expect(code).toContain(hook);
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
