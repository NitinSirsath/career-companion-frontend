// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fillParts } from '../../site/parts/index';

/** The self-playing pictures (Home and Automation) and phone pictures on the product site. */
const page = (file: string) =>
  fillParts(readFileSync(resolve(__dirname, '../../site', file), 'utf8'));
const home = () => page('index.html');
const css = (name: string) => readFileSync(resolve(__dirname, '../../site/styles', name), 'utf8');

/** Every picture "comes into view" at once. */
class SeenAtOnce {
  constructor(private readonly cb: (entries: { isIntersecting: boolean }[]) => void) {}
  observe() {
    this.cb([{ isIntersecting: true }]);
  }
  disconnect() {}
  unobserve() {}
}

function stubBrowser(reduceMotion = false) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduceMotion && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('IntersectionObserver', SeenAtOnce);
}

async function load(reduceMotion = false) {
  vi.resetModules();
  stubBrowser(reduceMotion);
  document.body.innerHTML = new DOMParser().parseFromString(home(), 'text/html').body.innerHTML;
  const examples = await import('../../site/example/index');
  const pictures = await import('../../site/runtime/pictures');
  examples.startExamples();
  pictures.startPictures();
  return examples;
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('the phone pictures', () => {
  it('show a Pixel 11 Pro to Android visitors and an iPhone 18 to everyone else', async () => {
    const { deviceFor } = await import('../../site/example/frames');
    expect(deviceFor('Mozilla/5.0 (Linux; Android 16; Pixel 11 Pro) Chrome/141.0 Mobile')).toBe(
      'pixel',
    );
    expect(deviceFor('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) Safari/604.1')).toBe(
      'iphone',
    );
    expect(deviceFor('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15')).toBe(
      'iphone',
    );
    // ?device=pixel or ?device=iphone picks one, whatever the browser.
    expect(deviceFor('Mozilla/5.0 (Macintosh)', '?device=pixel')).toBe('pixel');
    expect(deviceFor('Mozilla/5.0 (Linux; Android 16)', '?device=iphone')).toBe('iphone');
    expect(deviceFor('Mozilla/5.0 (Linux; Android 16)', '?device=nokia')).toBe('pixel');
  });

  it('wrap the hero example and the phone section in a phone with status bar, camera and home bar', async () => {
    await load();
    const phones = document.querySelectorAll('.device');
    expect(phones).toHaveLength(2);
    for (const dev of phones) {
      expect(dev.querySelector('.dv-status .dv-time')?.textContent).toBe('9:41');
      expect(dev.querySelector('.dv-cut')).not.toBeNull();
      expect(dev.querySelector('.dv-home')).not.toBeNull();
      expect(dev.querySelector('.dv-app [data-sample]')).not.toBeNull();
    }
    expect($('.hero-shot .device').classList.contains('phone-only')).toBe(true);
    expect($('.phone-shot .dv-app > .alert')).not.toBeNull();
    expect(document.documentElement.dataset.device).toBe('iphone');
    expect($('.phone-shot .device').querySelectorAll('.dv-btn')).toHaveLength(5);
  });

  it('give the Pixel its own buttons', async () => {
    stubBrowser();
    const { buildFrames } = await import('../../site/example/frames');
    document.body.innerHTML = '<div data-frame><p>app</p></div>';
    buildFrames('pixel');
    expect(document.documentElement.dataset.device).toBe('pixel');
    expect(document.querySelectorAll('.dv-btn.r')).toHaveLength(2);
    expect(document.querySelectorAll('.dv-btn.l')).toHaveLength(0);
    expect($('.dv-app p').textContent).toBe('app');
  });
});

describe('the alert in "On your phone, like an app"', () => {
  it('slides in, then opens the mail by itself', async () => {
    const { examples } = await load();
    const phone = examples.get($('.phone-shot [data-sample]'))!;
    expect(phone.s.view).toBe('dashboard');
    await vi.advanceTimersByTimeAsync(900);
    expect($('[data-alert]').classList.contains('show')).toBe(true);
    await vi.advanceTimersByTimeAsync(2200 + 280);
    expect(phone.s.view).toBe('mail');
    expect(phone.s.mailId).toBe('brightwave');
    expect($('[data-alert]').classList.contains('show')).toBe(false);
  });

  it('opens the mail at once on a tap, and moves focus to its title', async () => {
    const { examples } = await load();
    await vi.advanceTimersByTimeAsync(900);
    $('[data-alert]').click();
    const phoneEl = $('.phone-shot [data-sample]');
    expect(examples.get(phoneEl)!.s.mailId).toBe('brightwave');
    expect(phoneEl.classList.contains('used')).toBe(true);
    expect(document.activeElement?.textContent).toBe('Interview invitation: Frontend Engineer');
  });

  it('gets out of the way when the visitor uses the phone, and plays again on replay', async () => {
    const { examples } = await load();
    const phoneEl = $('.phone-shot [data-sample]');
    await vi.advanceTimersByTimeAsync(900);
    phoneEl.querySelector<HTMLElement>('[data-go="mails"]')!.click();
    expect($('[data-alert]').classList.contains('show')).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    expect(examples.get(phoneEl)!.s.view).toBe('mails');

    $('[data-replay="phone"]').click();
    expect(examples.get(phoneEl)!.s.view).toBe('dashboard');
    expect(phoneEl.classList.contains('used')).toBe(false);
    await vi.advanceTimersByTimeAsync(900 + 2200 + 280);
    expect(examples.get(phoneEl)!.s.view).toBe('mail');
  });
});

describe('the self-playing pictures', () => {
  it('light the four steps of an ask one after another, then rest with all done', async () => {
    await load();
    const steps = [...document.querySelectorAll('.life-step')];
    expect(steps[0].classList.contains('on')).toBe(true);
    await vi.advanceTimersByTimeAsync(1400);
    expect(steps[1].classList.contains('on')).toBe(true);
    expect(steps[0].classList.contains('done')).toBe(true);
    await vi.advanceTimersByTimeAsync(1400 * 2 + 700);
    expect(steps.every((st) => st.classList.contains('done') && !st.classList.contains('on'))).toBe(
      true,
    );
    expect($('.life-bar span').style.width).toBe('100%');
    $('[data-replay="life"]').click();
    expect(steps[0].classList.contains('on')).toBe(true);
  });

  it('move the application from Recruiter contact to Interview as the new mail arrives', async () => {
    await load();
    expect($('[data-apptag]').textContent).toBe('Recruiter contact');
    expect($('[data-newrow]').classList.contains('pending')).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect($('[data-newrow]').classList.contains('arrive')).toBe(true);
    await vi.advanceTimersByTimeAsync(900);
    expect($('[data-apptag]').textContent).toBe('Interview');
    expect($('[data-step="rc"]').className).toBe('done');
    expect($('[data-step="iv"]').className).toBe('now');
  });

  it('let the AI write the reply draft, then turn Send reply on', async () => {
    await load();
    const send = $<HTMLButtonElement>('[data-send]');
    expect(send.disabled).toBe(true);
    expect(send.getAttribute('aria-hidden')).toBe('true');
    await vi.advanceTimersByTimeAsync(500);
    expect($('.rbox .ed').textContent).toBe('Writing your reply from the whole conversation');
    await vi.advanceTimersByTimeAsync(1600 + 22 * 120);
    expect($('.rbox .ed').textContent).toContain('I look forward to meeting the team.');
    expect(send.disabled).toBe(false);
  });

  it('show their end state at once, with no replay buttons, when the visitor asks for less motion', async () => {
    await load(true);
    expect(
      [...document.querySelectorAll('.life-step')].every((st) => st.classList.contains('done')),
    ).toBe(true);
    expect($('[data-apptag]').textContent).toBe('Interview');
    expect($('.rbox .ed').textContent).toContain('Best regards');
    expect(css('sections.css')).toContain('html.no-motion .replay { display: none; }');
  });

  it('keep their size while they play (rewound parts are hidden, not removed)', () => {
    const cards = css('home.css');
    expect(cards).toContain('.history li.pending { visibility: hidden; }');
    expect(cards).toContain('.track .later .d { visibility: hidden; }');
  });
});

describe('the run on the Automation page', () => {
  async function loadRun(reduceMotion = false) {
    vi.resetModules();
    stubBrowser(reduceMotion);
    document.body.innerHTML = new DOMParser().parseFromString(
      page('automation/index.html'),
      'text/html',
    ).body.innerHTML;
    const pictures = await import('../../site/runtime/pictures');
    pictures.startPictures();
  }
  const steps = () => [...document.querySelectorAll('.run .log [data-at]')];
  const shown = () => steps().filter((st) => !st.classList.contains('pending')).length;
  const onPage = () => $('.run [data-pg].on')?.dataset.pg;
  const typed = () => [...document.querySelectorAll('.run .fld .v')].map((v) => v.textContent);
  const tab = (name: string) => $<HTMLButtonElement>(`.run [role="tab"][data-app="${name}"]`);

  it("shows the AI app's steps one by one, each working step as grey shimmer first", async () => {
    await loadRun();
    expect(shown()).toBe(0);
    expect($('[data-newrow]').classList.contains('pending')).toBe(true);
    expect($('.run .jobchip').textContent).toBe('Job 2 of 10');
    await vi.advanceTimersByTimeAsync(400);
    const opening = steps()[0];
    expect(opening.classList.contains('working')).toBe(true);
    expect(opening.querySelector('.wk.shimmer')?.textContent).toBe('Opening the next job');
    await vi.advanceTimersByTimeAsync(900);
    expect(opening.classList.contains('working')).toBe(false);
    expect(shown()).toBe(2);
  });

  it('drives the browser: job page, the form filled in field by field, then the sent page', async () => {
    await loadRun();
    expect(onPage()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onPage()).toBe('job');
    expect($('.run [data-run="page"]').classList.contains('driving')).toBe(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(onPage()).toBe('form');
    expect(typed()).toEqual(['', '', '', '']);
    await vi.advanceTimersByTimeAsync(700);
    expect(typed()[0]).toBe('+91 98450 12345');
    await vi.advanceTimersByTimeAsync(1600);
    expect(typed()).toEqual(['+91 98450 12345', '5', '30 days', 'resume.pdf']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onPage()).toBe('sent');
    expect($('.run [data-pg="sent"]').textContent).toContain(
      'Your application was sent to Brightwave',
    );
  });

  it('then adds the job to the top of Submitted with a notice, and replays', async () => {
    await loadRun();
    await vi.advanceTimersByTimeAsync(6800);
    expect($('[data-newrow]').classList.contains('pending')).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    expect($('[data-newrow]').classList.contains('arrive')).toBe(true);
    expect($('[data-newrow] .tag').textContent).toBe('No reply yet');
    expect($('.run [data-run="note"]').classList.contains('on')).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(shown()).toBe(steps().length);
    expect($('.run .jobchip').textContent).toBe('Next job in 2 min');
    $('[data-replay="run"]').click();
    expect(shown()).toBe(0);
    expect($('[data-newrow]').classList.contains('pending')).toBe(true);
  });

  it('switches to another AI app: its look, its words and how-to line, and plays again', async () => {
    await loadRun();
    await vi.advanceTimersByTimeAsync(9000);
    tab('cx').click();
    expect($('.run .aw').dataset.app).toBe('cx');
    expect(tab('cx').getAttribute('aria-selected')).toBe('true');
    expect(tab('ag').getAttribute('aria-selected')).toBe('false');
    expect($('.run [data-run="title"]').textContent).toBe('Codex');
    expect($('.run [data-run="ph"]').textContent).toBe('Ask Codex anything');
    expect($('.run [data-run="drive"]').textContent).toBe('Codex is using this page');
    expect($('.run [data-note="cx"]').hidden).toBe(false);
    expect($('.run [data-note="ag"]').hidden).toBe(true);
    expect($('.run [data-note="cx"]').textContent).toContain(
      'Connecting NorthList from Codex is not tested yet.',
    );
    expect(shown()).toBe(0);
    tab('cx').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect($('.run .aw').dataset.app).toBe('cc');
    expect($('.run [data-run="title"]').textContent).toBe('Claude');
    expect(document.activeElement).toBe(tab('cc'));
    expect(tab('cc').tabIndex).toBe(0);
    expect(tab('cx').tabIndex).toBe(-1);
  });

  it('shows its end state at once when the visitor asks for less motion, and the switcher still works', async () => {
    await loadRun(true);
    expect(shown()).toBe(steps().length);
    expect(document.querySelector('.run .pending, .run .working, .run .driving')).toBeNull();
    expect(onPage()).toBe('sent');
    expect(typed()).toEqual(['+91 98450 12345', '5', '30 days', 'resume.pdf']);
    tab('cc').click();
    expect($('.run .aw').dataset.app).toBe('cc');
    expect(shown()).toBe(steps().length);
    expect(onPage()).toBe('sent');
  });

  it('keeps its size while it plays, and its styles stay inside the picture', () => {
    const run = css('automation.css');
    expect(run).toContain('.run-tr.pending { visibility: hidden; }');
    expect(run).toContain('.run .aw {');
    const rules = run.replace(/\/\*[\s\S]*?\*\//g, '').match(/^[^@\s}][^{]*\{/gm) ?? [];
    for (const rule of rules) expect(rule).toMatch(/^(\.run[ -]|\.run\.|@keyframes)/);
    expect(css('site.css')).toContain("@import './automation.css';");
  });
});

describe("Home's intro and the hero build-in", () => {
  async function loadIntro() {
    vi.resetModules();
    stubBrowser();
    // A real browser tells the observer after the current script, so the hold comes first.
    vi.stubGlobal(
      'IntersectionObserver',
      class extends SeenAtOnce {
        observe() {
          queueMicrotask(() => super.observe());
        }
      },
    );
    document.documentElement.className = 'intro';
    document.body.innerHTML = new DOMParser().parseFromString(home(), 'text/html').body.innerHTML;
    const examples = await import('../../site/example/index');
    const motion = await import('../../site/runtime/motion');
    examples.startExamples();
    return { examples, motion };
  }
  afterEach(() => (document.documentElement.className = ''));
  const heroEl = () => $('.hero-shot [data-sample]');

  it('holds the hero app empty during the intro, builds it 1.3 s in, then syncs', async () => {
    const { examples, motion } = await loadIntro();
    const app = examples.examples.get(heroEl())!;
    expect(heroEl().classList.contains('sa-build')).toBe(true);
    motion.startIntro();
    await vi.advanceTimersByTimeAsync(300 + 20);
    expect(document.documentElement.classList.contains('intro-go')).toBe(true);
    expect(heroEl().classList.contains('sa-build-go')).toBe(false);
    await vi.advanceTimersByTimeAsync(1300);
    expect(heroEl().classList.contains('sa-build-go')).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(heroEl().classList.contains('sa-build')).toBe(false);
    expect(document.documentElement.classList.contains('intro')).toBe(false); // cleaned up after 2.3 s
    expect(app.s.syncing).toBe(false);
    await vi.advanceTimersByTimeAsync(900);
    expect(app.s.syncing).toBe(true);
  });

  it('shows everything at once when the visitor scrolls during the intro', async () => {
    const { motion } = await loadIntro();
    motion.startIntro();
    await vi.advanceTimersByTimeAsync(320);
    dispatchEvent(new Event('scroll'));
    await vi.advanceTimersByTimeAsync(0);
    expect(document.documentElement.classList.contains('intro')).toBe(false);
    expect(heroEl().classList.contains('sa-build-go')).toBe(true);
  });

  it('builds again on replay, then syncs again', async () => {
    const { examples } = await loadIntro();
    const app = examples.examples.get(heroEl())!;
    $('[data-replay="hero"]').click();
    expect(heroEl().classList.contains('sa-build-go')).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(heroEl().classList.contains('sa-build')).toBe(false);
    await vi.advanceTimersByTimeAsync(900);
    expect(app.s.syncing).toBe(true);
  });

  it('keeps the build-in parts in place: only opacity and transform move', () => {
    const motion = css('states.css');
    expect(motion).toContain(
      '@keyframes sa-part-in { from { opacity: 0; transform: translateY(8px); } }',
    );
    expect(motion).toContain(
      'html.intro.intro-go .hero :is(.hl, .lead, .ctas, .hero-shot) { animation-play-state: running; }',
    );
  });
});
