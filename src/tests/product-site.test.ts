// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RELEASES, anchor } from '../../site/parts/changelog';
import { PROMISES } from '../../site/parts/data';
import { fillParts } from '../../site/parts/index';

/** The product site's eight pages, as the build writes them (shared parts filled in). */
const PAGES = {
  home: 'index.html',
  mobile: 'mobile/index.html',
  automation: 'automation/index.html',
  posts: 'posts/index.html',
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
        '/mobile',
        '/automation',
        '/posts',
        '/privacy/',
        '/pricing',
        '/changelog',
        '/about',
        '/privacy.html',
      ])
        expect(hrefs).toContain(href);
      expect(hrefs.filter((h) => h.endsWith('.html') && h !== '/privacy.html')).toEqual([]);
      // The Privacy page is linked as it is served, with the slash (`/privacy` only redirects there).
      expect(hrefs.filter((h) => /^\/privacy(#|$)/.test(h))).toEqual([]);
      const start = [...d.querySelectorAll('a')].filter((a) =>
        /^(Sign in|Start free)/.test(a.textContent ?? ''),
      );
      expect(start.length).toBeGreaterThanOrEqual(4);
      for (const a of start) expect(a.getAttribute('href')).toBe(SIGN_IN);
      expect(d.querySelector('.ftr a[href="mailto:northlist.site@gmail.com"]')?.textContent).toBe(
        'Contact',
      );
      expect(d.querySelector('.ftr a[href="https://x.com/northlistsite"]')?.textContent).toBe('X');
      expect(
        d.querySelector('.ftr a[href="https://www.linkedin.com/company/145492514/"]')?.textContent,
      ).toBe('LinkedIn');
    },
  );

  it('marks the open page in the header', () => {
    expect(doc('pricing').querySelector('.nav [aria-current="page"]')?.textContent).toBe('Pricing');
    expect(doc('automation').querySelector('.nav [aria-current="page"]')?.textContent).toBe(
      'NorthList Apply',
    );
    expect(doc('mobile').querySelector('.nav [aria-current="page"]')?.textContent).toBe('Mobile');
    expect(doc('home').querySelector('.nav [aria-current="page"]')).toBeNull();
  });

  it('shows five links in the header; Privacy, Changelog and About sit in the footer and the phone menu', () => {
    const d = doc('pricing');
    expect([...d.querySelectorAll('.nav a')].map((a) => a.textContent)).toEqual([
      'Features',
      'Mobile',
      'NorthList Apply',
      'NorthList Posts',
      'Pricing',
    ]);
    const menu = [...d.querySelectorAll('#site-sheet a.row')].map((a) => a.textContent?.trim());
    for (const label of ['Privacy', 'Changelog', 'About']) expect(menu).toContain(label);
  });
});

describe('the NorthList Posts page', () => {
  const KIT = 'https://github.com/NitinSirsath/northlist-posts-kit';

  it('is in the header and footer, and marks itself as the current page', () => {
    const d = doc('posts');
    expect(d.querySelector('.nav [aria-current="page"]')?.textContent).toBe('NorthList Posts');
    expect(d.querySelector('.ftr a[href="/posts"]')?.textContent).toBe('NorthList Posts');
  });

  it('says the app is private for now, so both main buttons ask for access by mail', () => {
    const d = doc('posts');
    expect(d.body.textContent).toContain('Private for now');
    const ask = [...d.querySelectorAll('a')].filter((a) => a.textContent === 'Ask for access');
    expect(ask).toHaveLength(2);
    for (const a of ask)
      expect(a.getAttribute('href')).toBe(
        'mailto:northlist.site@gmail.com?subject=NorthList%20Posts',
      );
    const kit = [...d.querySelectorAll('a')].filter((a) =>
      a.textContent?.startsWith('Read the kit'),
    );
    expect(kit).toHaveLength(2);
    for (const a of kit) expect(a.getAttribute('href')).toBe(KIT);
  });

  it('says the app has no AI of its own and never posts by itself', () => {
    const text = doc('posts').body.textContent ?? '';
    expect(text).toContain('NorthList Posts has no AI of its own.');
    expect(text).toContain('Nothing goes out');
    expect(text).toContain('you can still undo it for ten seconds');
  });
});

describe('the Automation page', () => {
  const REPO = 'https://github.com/NitinSirsath/northlist-apply';

  it('is linked from Home, and both its Start buttons open the automation on GitHub', () => {
    expect(doc('home').querySelector('.hf-hero a[href="/automation"]')?.textContent).toContain(
      'NorthList Apply',
    );
    expect(doc('home').querySelector('.n4-link[href="/automation"]')).not.toBeNull();
    const start = [...doc('automation').querySelectorAll('a')].filter((a) =>
      a.textContent?.startsWith('Start on GitHub'),
    );
    expect(start).toHaveLength(2);
    for (const a of start) expect(a.getAttribute('href')).toBe(REPO);
  });

  it('names the automation, and says the NorthList app never applies to jobs itself', () => {
    const text = doc('automation').body.textContent ?? '';
    expect(text).toContain('NorthList Apply is a free job automation');
    expect(text).toContain('The NorthList app never applies to jobs itself.');
  });

  it("says to sign in to the job sites in the AI app's own browser before a run", () => {
    const steps = [...doc('automation').querySelectorAll('#setup-title ~ ol li')].map(
      (li) => li.textContent ?? '',
    );
    expect(steps[steps.length - 1]).toContain(
      "sign in to them once in your AI app's own browser: it opens them for you.",
    );
  });

  it('shows a run in Antigravity, Claude Code or Codex, named in words only (no logos)', () => {
    const page = doc('automation');
    expect(page.body.textContent).toContain('like Antigravity, Claude Code or Codex.');
    const tabs = [...page.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) =>
      t.textContent?.trim(),
    );
    expect(tabs).toEqual(['Antigravity', 'Claude Code', 'Codex']);
    expect(page.querySelectorAll('.run img, .run picture, .run image')).toHaveLength(0);
    expect(page.body.textContent).toContain('It asked for your OK on the first job');
    expect(page.body.textContent).toContain('It shows you the first application of each run');
  });

  it('says how far it is tested, and makes no claims about speed or results', () => {
    const text = doc('automation').body.textContent ?? '';
    // Names in words only, never logos.
    expect(text).toContain(
      'Tested on LinkedIn, Naukri, Indeed, Wellfound, Instahyre, Workday, Greenhouse, Lever and Ashby.',
    );
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
  const words = (t: string | null | undefined) =>
    (t ?? '').replace(/\u2019/g, "'").replace(/\s+/g, ' ');

  it('shows the four promises: word for word on Privacy and About, by their titles on Home', () => {
    for (const page of ['privacy', 'about'] as Page[]) {
      const text = words(doc(page).body.textContent);
      for (const [, title, body] of PROMISES) {
        expect(text).toContain(title);
        expect(text).toContain(words(body));
      }
    }
    const home = words(doc('home').querySelector('.n4-promises')?.textContent);
    for (const [, title] of PROMISES) expect(home).toContain(title);
    const links = [...doc('home').querySelectorAll('main a[href="/privacy/"]')];
    expect(links.map((a) => a.textContent?.trim())).toContain('How your mail is handled');
    expect(words(doc('privacy').body.textContent)).toContain(
      'It reads the text of job mails only.',
    );
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
    const ids = [...doc('changelog').querySelectorAll('article.pr-ent')].map((a) => a.id);
    expect(ids).toEqual(dates.map(anchor));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('nov-4');
  });
});

describe("Home's hero", () => {
  it('has the words alone at the bottom left, one action, and a film of the app behind them', () => {
    const hero = doc('home').querySelector('.hf-hero')!;
    expect(hero.querySelector('h1')?.textContent).toBe('Your job search,sorted from your Gmail.');
    expect(hero.querySelectorAll('.btn')).toHaveLength(1);
    expect(hero.querySelector('.btn')?.textContent).toBe('Start free');
    const stage = hero.querySelector('.hf-stage')!;
    expect(stage.getAttribute('aria-hidden')).toBe('true');
    expect(stage.innerHTML).toBe(''); // drawn by site/home/film.ts
    expect(hero.querySelector('[data-film-toggle]')?.getAttribute('aria-label')).toBe(
      'Pause the hero animation',
    );
    expect(html('home')).toContain('<script type="module" src="/home/home.ts"></script>');
  });

  it('keeps the working example of the app, under "Try it yourself"', () => {
    const tryIt = doc('home').querySelector('#try')!;
    expect(tryIt.querySelector('h2')?.textContent).toBe('Try it yourself.');
    expect(tryIt.querySelector('.sa-fit[data-fit-phone] [data-sample="mails"]')).not.toBeNull();
    expect(tryIt.textContent).toContain('Nothing you do here leaves this page.');
  });

  it('no longer hides the page for an intro on load', () => {
    for (const page of Object.keys(PAGES) as Page[])
      expect(html(page)).not.toContain("classList.add('intro')");
  });
});

describe('the Mobile page', () => {
  it('has a film of the phone app behind its words, and a code that opens the app', () => {
    const d = doc('mobile');
    expect(d.querySelector('[data-film-hero] .mb-stage')?.getAttribute('aria-hidden')).toBe('true');
    expect(d.querySelector('#install')).not.toBeNull();
    expect(d.body.innerHTML).toContain('app.northlist.site');
    expect(html('mobile')).toContain('<script type="module" src="./mobile.ts"></script>');
  });

  it('says it installs from the browser, with no app store', () => {
    const text = doc('mobile').body.textContent ?? '';
    expect(text).toMatch(/Add to Home Screen/);
    expect(text).not.toMatch(/App Store|Google Play|Play Store/);
  });
});

describe('the glass header', () => {
  const chrome = readFileSync(resolve(__dirname, '../../site/styles/chrome.css'), 'utf8');

  it('is see-through with a blur, and solid when the menu is open, without blur or when asked', () => {
    expect(chrome).toContain('background: color-mix(in srgb, var(--bg) 78%, transparent);');
    expect(chrome).toContain('.hdr:has(+ .sheet.open) { background: var(--bg); }');
    expect(chrome).toContain('@supports not ((backdrop-filter: blur(1px))');
    expect(chrome).toContain('@media (prefers-reduced-transparency: reduce)');
  });

  it('writes the blur only as plain backdrop-filter, which the build keeps and prefixes for Safari', () => {
    // With both written, the build's CSS minifier keeps only -webkit-backdrop-filter, and Chrome shows no blur.
    for (const file of ['chrome.css', 'pages.css']) {
      const css = readFileSync(resolve(__dirname, '../../site/styles', file), 'utf8');
      expect(css.replace(/@supports[^{]*/g, '')).not.toMatch(/-webkit-backdrop-filter:/);
    }
  });
});

describe("the site's own controls", () => {
  const css = (file: string) => readFileSync(resolve(__dirname, '../../site/styles', file), 'utf8');

  it('are round like the app: buttons, icon buttons, menu links, replay buttons and tags', () => {
    expect(css('base.css')).toMatch(/\.btn \{[^}]*border-radius: 999px;/);
    expect(css('base.css')).toMatch(/\.icon-btn \{[^}]*border-radius: 50%;/);
    expect(css('chrome.css')).toMatch(/\.nav a \{[^}]*border-radius: 999px;/);
    expect(css('sections.css')).toMatch(/\.replay \{[^}]*border-radius: 50%;/);
    expect(css('states.css')).toMatch(/\.tag \{[^}]*border-radius: 999px;/);
    const notFound = readFileSync(resolve(__dirname, '../../site/public/404.html'), 'utf8');
    expect(notFound).toMatch(/\.button \{[^}]*border-radius: 999px;/);
    for (const file of ['base.css', 'chrome.css', 'sections.css', 'states.css'])
      expect(css(file)).not.toContain('border-radius: 0;');
  });

  it('have one light action and no blue: the light pill, and the app pictures in grey', () => {
    expect(css('base.css')).toContain('--btn: #e6e6e6;');
    expect(css('base.css')).toMatch(
      /\.btn-primary \{ background: var\(--btn, var\(--blue\)\); color: var\(--btn-text, #fff\); \}/,
    );
    expect(css('no-blue.css')).toContain('--tag-blue-bg: #1c1c1f;');
    expect(css('app.css').trim().split('\n').pop()).toBe("@import './no-blue.css';");
  });
});

describe('dark only, and the phone menu', () => {
  beforeAll(async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
    }));
    const page = doc('pricing');
    document.body.innerHTML = page.body.innerHTML;
    await import('../../site/main');
  });
  afterEach(() => localStorage.clear());

  it.each(Object.keys(PAGES) as Page[])(
    '%s is dark, with no theme switch and nothing kept',
    (page) => {
      expect(html(page)).toMatch(/<html lang="en" data-theme="dark">/);
      expect(doc(page).querySelector('[data-theme-set], .seg')).toBeNull();
      expect(html(page)).not.toContain('localStorage');
    },
  );

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
