// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RELEASES, anchor } from '../../site/parts/changelog';
import { fillParts } from '../../site/parts/index';

/** The product site's six pages, as the build writes them (shared parts filled in). */
const PAGES = {
  home: 'index.html',
  automation: 'automation/index.html',
  pricing: 'pricing/index.html',
  privacy: 'privacy/index.html',
  changelog: 'changelog/index.html',
  about: 'about/index.html',
};
type Page = keyof typeof PAGES;
const html = (page: Page) =>
  fillParts(readFileSync(resolve(__dirname, '../../site', PAGES[page]), 'utf8'));
const doc = (page: Page) => new DOMParser().parseFromString(html(page), 'text/html');
const SIGN_IN = 'https://app.northlist.site/login';

describe('the product site pages', () => {
  it.each(Object.keys(PAGES) as Page[])(
    '%s has its words in its HTML, with nothing left to fill',
    (page) => {
      const d = doc(page);
      expect(d.querySelectorAll('h1')).toHaveLength(1);
      expect(d.title).toMatch(/NorthList/);
      expect(d.querySelector('meta[name="description"]')?.getAttribute('content')).toBeTruthy();
      expect(d.querySelector('.hdr')).not.toBeNull();
      expect(d.querySelector('.ftr')).not.toBeNull();
      expect(
        d.querySelector(
          'i[data-icon], i[data-mark], [data-site-header], [data-site-footer], p[data-lead]',
        ),
      ).toBeNull();
      for (const hook of ['data-promises', 'data-flow', 'data-changelog'])
        d.querySelectorAll(`[${hook}]`).forEach((el) => expect(el.innerHTML).not.toBe(''));
      expect(d.querySelector('script[type="module"]')?.getAttribute('src')).toBe('/main.ts');
    },
  );

  it.each(Object.keys(PAGES) as Page[])(
    '%s links to its neighbours, sign-in and the policy',
    (page) => {
      const d = doc(page);
      const hrefs = [...d.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '');
      for (const href of [
        '/',
        '/#features',
        '/automation',
        '/privacy/',
        '/pricing',
        '/changelog',
        '/about',
        '/privacy.html',
      ])
        expect(hrefs).toContain(href);
      expect(hrefs.filter((h) => h.endsWith('.html') && h !== '/privacy.html')).toEqual([]);
      // Render serves privacy.html at /privacy, so the Privacy page is always linked with the slash.
      expect(hrefs.filter((h) => /^\/privacy(#|$)/.test(h))).toEqual([]);
      const start = [...d.querySelectorAll('a')].filter((a) =>
        /^(Sign in|Start free)/.test(a.textContent ?? ''),
      );
      expect(start.length).toBeGreaterThanOrEqual(4);
      for (const a of start) expect(a.getAttribute('href')).toBe(SIGN_IN);
      expect(d.querySelector('.ftr a[href="mailto:nitinsirsath8855@gmail.com"]')?.textContent).toBe(
        'Contact',
      );
    },
  );

  it('marks the open page in the header', () => {
    expect(doc('pricing').querySelector('.nav [aria-current="page"]')?.textContent).toBe('Pricing');
    expect(doc('automation').querySelector('.nav [aria-current="page"]')?.textContent).toBe(
      'Automation',
    );
    expect(doc('home').querySelector('.nav [aria-current="page"]')).toBeNull();
  });
});

describe('the Automation page', () => {
  const REPO = 'https://github.com/NitinSirsath/job-application-automation';

  it('is linked from Home, and both its Start buttons open the automation on GitHub', () => {
    expect(doc('home').querySelector('#automation a[href="/automation"]')).not.toBeNull();
    const start = [...doc('automation').querySelectorAll('a')].filter((a) =>
      a.textContent?.startsWith('Start on GitHub'),
    );
    expect(start).toHaveLength(2);
    for (const a of start) expect(a.getAttribute('href')).toBe(REPO);
  });

  it('says how far it is tested, and makes no claims about speed or results', () => {
    const text = doc('automation').body.textContent ?? '';
    expect(text).toContain('In beta. Tried so far on LinkedIn Easy Apply, Naukri and Indeed.');
    expect(text).not.toMatch(
      /\b(fast|faster|quickly|instantly|in minutes|success rate|guarantee)/i,
    );
  });

  it("says what NorthList keeps from the automation in the privacy policy's words", () => {
    const page = doc('automation').body.textContent ?? '';
    const policy = readFileSync(resolve(__dirname, '../../site/public/privacy.html'), 'utf8');
    for (const words of ['whether it skipped the job or left it for you', 'first 12 characters']) {
      expect(page).toContain(words);
      expect(policy).toContain(words);
    }
  });
});

describe('the data wording', () => {
  it('is the same, word for word, on Home, Privacy and About', () => {
    const parts = (page: Page) => {
      const d = doc(page);
      return { promises: d.querySelector('.promises')?.textContent, lead: d.body.textContent };
    };
    const home = parts('home');
    expect(home.promises).toContain('Never the text of your mails');
    for (const page of ['privacy', 'about'] as Page[])
      expect(parts(page).promises).toBe(home.promises);
    const lead = 'It reads the text of job mails only.';
    expect(parts('home').lead).toContain(lead);
    expect(parts('privacy').lead).toContain(lead);
  });

  it.each(Object.keys(PAGES) as Page[])('%s never says that NorthList stores nothing', (page) => {
    // The AI service keeps nothing; NorthList itself keeps some things, and says which.
    expect(doc(page).body.textContent).not.toMatch(
      /NorthList (stores|keeps|saves) nothing|nothing (is )?stored/i,
    );
  });
});

describe('the changelog', () => {
  it('lists the releases newest first, each with its date as its anchor', () => {
    const dates = RELEASES.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    const ids = [...doc('changelog').querySelectorAll('article.entry')].map((a) => a.id);
    expect(ids).toEqual(dates.map(anchor));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('oct-31');
  });

  it('is where Home\'s "New" note leads', () => {
    expect(doc('home').querySelector('.announce')?.getAttribute('href')).toBe(
      `/changelog#${anchor(RELEASES[0].date)}`,
    );
  });
});

describe('the theme switch and the phone menu', () => {
  beforeAll(async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
    }));
    const page = doc('pricing');
    document.body.innerHTML = page.body.innerHTML;
    delete document.documentElement.dataset.theme;
    await import('../../site/main');
  });
  afterEach(() => localStorage.clear());

  it('starts light, switches to dark and back, and remembers the choice', () => {
    expect(document.documentElement.dataset.theme).toBeUndefined();
    const dark = document.querySelector<HTMLElement>('.ftr [data-theme-set="dark"]')!;
    dark.click();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('northlist-site-theme')).toBe('dark');
    expect(dark.getAttribute('aria-pressed')).toBe('true');
    document.querySelector<HTMLElement>('.ftr [data-theme-set="light"]')!.click();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('opens the phone menu, and closes it on a link tap', () => {
    const btn = document.querySelector<HTMLElement>('.menu-btn')!;
    btn.click();
    expect(document.getElementById('site-sheet')?.classList.contains('open')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    document.querySelector<HTMLElement>('#site-sheet a.row')!.click();
    expect(document.getElementById('site-sheet')?.classList.contains('open')).toBe(false);
    expect(btn.getAttribute('aria-label')).toBe('Open menu');
  });
});
