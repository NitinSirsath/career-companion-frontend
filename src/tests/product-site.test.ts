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
    expect(doc('about').querySelector('.nav [aria-current="page"]')?.textContent).toBe('About');
    expect(doc('pricing').querySelector('.nav [aria-current="page"]')).toBeNull();
    expect(doc('automation').querySelector('.nav [aria-current="page"]')?.textContent).toBe(
      'NorthList Apply',
    );
    expect(doc('mobile').querySelector('.nav [aria-current="page"]')?.textContent).toBe('Mobile');
    expect(doc('home').querySelector('.nav [aria-current="page"]')?.textContent).toBe('Home');
  });

  it('shows five links in the header; Privacy, Pricing and Changelog sit in the footer and the phone menu', () => {
    const d = doc('pricing');
    expect([...d.querySelectorAll('.nav a')].map((a) => a.textContent)).toEqual([
      'Home',
      'Mobile',
      'NorthList Apply',
      'NorthList Posts',
      'About',
    ]);
    const menu = [...d.querySelectorAll('#site-sheet a.row')].map((a) => a.textContent?.trim());
    for (const label of ['Privacy', 'Pricing', 'Changelog', 'About']) expect(menu).toContain(label);
    expect(new Set(menu).size).toBe(menu.length);
  });
});

describe('the NorthList Posts page', () => {
  const KIT = 'https://github.com/NitinSirsath/northlist-posts-kit';

  it('is in the header and footer, and marks itself as the current page', () => {
    const d = doc('posts');
    expect(d.querySelector('.nav [aria-current="page"]')?.textContent).toBe('NorthList Posts');
    expect(d.querySelector('.ftr a[href="/posts"]')?.textContent).toBe('NorthList Posts');
  });

  it('opens the app from both main buttons, and still asks for access by mail while it is private', () => {
    const d = doc('posts');
    expect(d.body.textContent).toContain('Private for now');
    const open = [...d.querySelectorAll('a')].filter(
      (a) => a.textContent === 'Open NorthList Posts',
    );
    expect(open).toHaveLength(2);
    for (const a of open) {
      expect(a.getAttribute('href')).toBe('https://posts.northlist.site');
    }
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
    const steps = [...doc('automation').querySelectorAll('#setup ol > li')].map(
      (li) => li.textContent ?? '',
    );
    expect(steps[steps.length - 1]).toContain(
      "sign in to them once in your AI app's own browser: it opens them for you.",
    );
  });

  it('sets up in four steps: get the apps, an AI plan, connect NorthList, type start', () => {
    const page = doc('automation');
    const steps = [...page.querySelectorAll('#setup ol > li')];
    expect(
      steps.map((li) => li.querySelector('.lg-cap b')?.textContent?.replace(/^\d/, '')),
    ).toEqual([
      'Download Antigravity and NorthList Apply',
      'No paid AI app? Get Google AI Plus',
      'Connect NorthList',
      'Type start',
    ]);
    const links = (li: Element) => [...li.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links(steps[0])).toEqual([
      'https://antigravity.google/download',
      'https://github.com/NitinSirsath/northlist-apply',
    ]);
    expect(links(steps[1])).toEqual(['https://one.google.com/intl/en_in/about/google-ai-plans/']);
    expect(links(steps[2])).toEqual(['https://app.northlist.site/automation?tab=setup']);
    // Owner decision 22 Nov 2026: recommend Google AI Plus (₹399 a month in India), which works with Antigravity.
    expect(steps[1].textContent).toContain(
      'We recommend Google AI Plus, ₹399 a month. It works with Antigravity',
    );
    expect(steps[1].querySelector('.apx-plan .r')?.textContent).toContain('Google AI Plus');
    expect(page.body.textContent).not.toContain('AI Pro');
    expect(steps[3].querySelector('code')?.textContent).toBe('start');
  });

  it('shows a run in Antigravity, Claude Code or Codex, named in words only (no logos)', () => {
    const page = doc('automation');
    expect(page.body.textContent).toContain(
      'like Antigravity (our pick, free with a Google account), Claude Code or Codex.',
    );
    const tabs = [...page.querySelectorAll('[role="tablist"] [role="tab"]')];
    expect(tabs.map((t) => t.firstChild?.textContent?.trim())).toEqual([
      'Antigravity',
      'Claude Code',
      'Codex',
    ]);
    expect(page.querySelectorAll('.run img, .run picture, .run image')).toHaveLength(0);
    expect(page.body.textContent).toContain('After you reply ready, it applies on its own.');
    expect(page.body.textContent).toContain('it applies one job at a time, with no OK needed');
    expect(page.body.textContent).not.toMatch(/your OK|you said ok/i);
  });

  it('marks Antigravity as recommended: first, picked, and said in words (no chip)', () => {
    const page = doc('automation');
    const [first, ...rest] = [...page.querySelectorAll('[role="tablist"] [role="tab"]')];
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(first.querySelector('.ap-rec')?.textContent).toBe('Recommended');
    for (const tab of rest) expect(tab.querySelector('.ap-rec')).toBeNull();
    expect(page.querySelector('[data-note="ag"]')?.textContent).toContain('Recommended.');
    expect(page.querySelector('#setup ol > li .apx-get .r.on')?.textContent).toContain(
      'AntigravityRecommended',
    );
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

  it('says portal passwords are sent and encrypted, and job-site passwords never', () => {
    const page = doc('automation').body.textContent ?? '';
    const privacy = doc('privacy').body.textContent ?? '';
    const policy = readFileSync(resolve(__dirname, '../../site/public/privacy.html'), 'utf8');
    expect(page).toContain('The password is stored encrypted and shown only when you tap Show.');
    expect(page).not.toMatch(/Never asked for\s*Your passwords,/);
    for (const text of [page, privacy, policy])
      expect(text).toContain('other job sites you sign in to yourself');
    for (const text of [privacy, policy]) expect(text).toMatch(/encrypted with their own key/i);
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
    expect(hero.querySelector('h1')?.textContent).toBe('Your job search, sorted from your Gmail.');
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

  it('shows the Mails page as a still picture, not a working copy of the app', () => {
    const home = doc('home');
    const section = home.querySelector('#app')!;
    expect(section.querySelector('h2')?.textContent).toBe('Every job mail,in one list.');
    // In front the Mails page; behind it the app's sidebar, showing on the left only.
    expect(section.querySelector('.ha-front .ha-head b')?.textContent).toBe('Mails');
    expect(section.querySelectorAll('.ha-front .ha-row')).toHaveLength(5);
    expect(section.querySelector('.ha-back .ha-nav.on')?.textContent).toBe('Mails');
    expect(section.querySelector('figcaption b')?.textContent).toBe(
      'The Mails page, with made-up mails',
    );
    // Nothing on Home is a working example any more, so the example's code never loads there.
    expect(home.querySelector('[data-sample], .sa-fit, [data-replay="hero"]')).toBeNull();
    expect(home.querySelector('#try')).toBeNull();
  });

  it('puts a real iPhone frame in the Mobile link, with a still mail list inside', () => {
    const cell = doc('home').querySelector('.hm-links a[href="/mobile"]')!;
    const phone = cell.querySelector('.hm-pic [data-frame]')!;
    expect(phone).not.toBeNull(); // framed by site/example/frames.ts, from site/home/home.ts
    expect(phone.querySelector('.hm-app .h')?.textContent).toBe('Job mails');
    expect(phone.querySelectorAll('.hm-app .r')).toHaveLength(4);
    expect(cell.querySelector('.pill')).toBeNull(); // status rings, no status chips
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
