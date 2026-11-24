import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  capOf,
  estimate,
  firstNumber,
  floorOf,
  groupsFor,
  planBlock,
  planText,
  readCounts,
  readFacts,
  roughTime,
  startPicks,
} from '../../site/apply/plan/data';
import { fillParts } from '../../site/parts/index';

/** "What should I apply to today?" of NorthList Apply, northlist.site/apply/plan (owner, 25 Nov 2026). */
const site = (name: string) => readFileSync(resolve(__dirname, '../../site', name), 'utf8');
const link = (facts: object | string) =>
  `#${typeof facts === 'string' ? facts : JSON.stringify(facts)}`;

describe('the facts in the link', () => {
  it('reads the last plan, today’s counts and lower limits, as text or as numbers', () => {
    const facts = readFacts(
      link({
        last: 'linkedin 10, Naukri 2, workday: 1',
        today: { linkedin: 4 },
        limits: 'linkedin 15',
        careerPages: false,
        hours: 3,
      }),
    );
    expect(facts).toEqual({
      last: { linkedin: 10, naukri: 2, workday: 1 },
      today: { linkedin: 4 },
      limits: { linkedin: 15 },
      careerPages: false,
      hours: 3,
    });
  });

  it('ignores what it cannot read, and never breaks the page', () => {
    expect(readCounts('linkedin ten, myspace 3, , indeed 5')).toEqual({ indeed: 5 });
    expect(readFacts('#{not json')).toEqual({
      last: {},
      today: {},
      limits: {},
      careerPages: true,
      hours: 4,
    });
    expect(readFacts('')).toMatchObject({ last: {}, hours: 4 });
    expect(readFacts(link({ hours: 99 })).hours).toBe(4);
  });

  it('reads a link the browser encoded', () => {
    const encoded = `#${encodeURIComponent(JSON.stringify({ last: 'linkedin 10' }))}`;
    expect(readFacts(encoded).last).toEqual({ linkedin: 10 });
  });

  it('leaves out career pages when profile.md has no addresses', () => {
    const keys = (careerPages: boolean) =>
      groupsFor(readFacts(link({ careerPages }))).flatMap((g) => g.items.map((i) => i.key));
    expect(keys(true)).toContain('company_direct');
    expect(keys(false)).not.toContain('company_direct');
    expect(keys(false)).toContain('discovery');
  });
});

describe('the limits', () => {
  const facts = readFacts(link({ limits: 'linkedin 15' }));
  it('never goes above a site’s daily maximum or a lower limit', () => {
    expect(capOf('naukri', {}, facts)).toBe(25);
    expect(capOf('workday', {}, facts)).toBe(5);
    expect(capOf('linkedin', {}, facts)).toBe(15);
  });
  it('lets career pages and web search share 10, and all sites 50', () => {
    expect(capOf('discovery', { company_direct: 6 }, facts)).toBe(4);
    expect(capOf('company_direct', { company_direct: 6 }, facts)).toBe(10);
    expect(capOf('indeed', { linkedin: 15, naukri: 25 }, facts)).toBe(10);
  });
  it('never lowers a site below what was already sent today', () => {
    const today = readFacts(link({ last: 'linkedin 10', today: 'linkedin 4' }));
    expect(floorOf('linkedin', today)).toBe(4);
    expect(floorOf('naukri', today)).toBe(1);
  });
});

describe('where the page starts', () => {
  it('starts from the last plan, kept inside today’s limits', () => {
    const facts = readFacts(
      link({ last: 'linkedin 30, workday 9, naukri 2', limits: 'linkedin 15' }),
    );
    expect(startPicks(facts)).toEqual({ linkedin: 15, workday: 5, naukri: 2 });
  });
  it('keeps a site with jobs sent today, even when it was not in the last plan', () => {
    const facts = readFacts(link({ last: 'naukri 2', today: 'linkedin 3' }));
    expect(startPicks(facts)).toEqual({ naukri: 2, linkedin: 3 });
  });
  it('starts empty on the first run', () => {
    expect(startPicks(readFacts(''))).toEqual({});
  });
  it('gives a newly picked site its last number, else 10 for quick apply and 2 for company sites', () => {
    const facts = readFacts(link({ last: 'indeed 7' }));
    expect(firstNumber('indeed', {}, facts)).toBe(7);
    expect(firstNumber('naukri', {}, facts)).toBe(10);
    expect(firstNumber('workday', {}, facts)).toBe(2);
    expect(firstNumber('discovery', { company_direct: 10 }, facts)).toBe(0);
  });
});

describe('the plan the AI reads back', () => {
  it('writes the plan in the page’s order with the plan item names of the chat', () => {
    const picks = { workday: 2, linkedin: 10, the_reliable_jobs: 1 };
    expect(planText(picks)).toBe('linkedin 10, workday 2, the_reliable_jobs 1');
    expect(planBlock(picks)).toBe(
      'BEGIN NORTHLIST PLAN\nlinkedin 10, workday 2, the_reliable_jobs 1\nEND NORTHLIST PLAN',
    );
  });
  it('guesses the time of what is left, and says when it is longer than the session', () => {
    const facts = readFacts(link({ today: 'linkedin 4', hours: 1 }));
    expect(estimate({ linkedin: 10, workday: 3 }, facts)).toEqual({
      jobs: 13,
      left: 9,
      minutes: 48,
      tooLong: false,
    });
    expect(estimate({ linkedin: 20 }, facts).tooLong).toBe(true);
    expect(roughTime(48)).toBe('50 min');
    expect(roughTime(72)).toBe('1 h 10 min');
    expect(roughTime(1)).toBe('5 min');
    expect(roughTime(120)).toBe('2 h');
  });
});

describe('the pages', () => {
  it('builds the plan page with the site and keeps it out of search', () => {
    expect(site('../vite.site.config.ts')).toContain("'apply/plan/index'");
    const html = site('apply/plan/index.html');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('/apply/plan/plan.ts');
  });

  it('shows the NorthList logo, not a letter, on every NorthList Apply page', () => {
    for (const page of [
      'apply/setup/index.html',
      'apply/run/index.html',
      'apply/plan/index.html',
    ]) {
      const html = fillParts(site(page));
      expect(html, page).not.toContain('logo-mark');
      expect(html, page).toMatch(
        /<a class="logo" href="\/"><span class="wm"[^>]*aria-label="NorthList"/,
      );
      expect(html, page).toContain('<span class="logo-app">Apply</span>');
      expect(html, page).toContain('/styles/apply-logo.css');
    }
  });
});
