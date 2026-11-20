// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fillParts } from '../../site/parts/index';

/** The moving pictures on the product site: Home's film and story, the phone pictures, and NorthList Apply's run. */
const page = (file: string) =>
  fillParts(readFileSync(resolve(__dirname, '../../site', file), 'utf8'));
const home = () => page('index.html');
const css = (name: string) => readFileSync(resolve(__dirname, '../../site/styles', name), 'utf8');

/** Every picture "comes into view" at once. */
class SeenAtOnce {
  constructor(
    private readonly cb: (entries: { isIntersecting: boolean }[], observer: SeenAtOnce) => void,
  ) {}
  observe() {
    this.cb([{ isIntersecting: true }], this);
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

  it("wrap the Mobile page's working examples in a phone with status bar, camera and home bar", async () => {
    vi.resetModules();
    stubBrowser();
    document.body.innerHTML = new DOMParser().parseFromString(
      page('mobile/index.html'),
      'text/html',
    ).body.innerHTML;
    const { startExamples } = await import('../../site/example/index');
    startExamples();
    const phones = document.querySelectorAll('.device');
    expect(phones).toHaveLength(2);
    for (const dev of phones) {
      expect(dev.querySelector('.dv-status .dv-time')?.textContent).toBe('9:41');
      expect(dev.querySelector('.dv-cut')).not.toBeNull();
      expect(dev.querySelector('.dv-home')).not.toBeNull();
      expect(dev.querySelector('.dv-app [data-sample]')).not.toBeNull();
    }
    expect(document.documentElement.dataset.device).toBe('iphone');
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
  const tab = (name: string) =>
    $<HTMLButtonElement>(`[role="tablist"] [role="tab"][data-app="${name}"]`);

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
    expect($('[data-newrow] .st span').textContent).toBe('No reply yet');
    expect($('[data-run="note"]').classList.contains('on')).toBe(true);
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
    expect($('[data-note="cx"]').hidden).toBe(false);
    expect($('[data-note="ag"]').hidden).toBe(true);
    expect($('[data-note="cx"]').textContent).toContain(
      'Connecting NorthList from Codex is not tested yet.',
    );
    expect(shown()).toBe(0);
    tab('cx').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect($('.run .aw').dataset.app).toBe('cc');
    expect($('.run [data-run="title"]').textContent).toBe('Claude');
    expect($('[data-note="cc"]').hidden).toBe(false);
    expect($('[data-note="cc"]').textContent).toContain(
      'It uses its own browser. Chrome is only the backup.',
    );
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
    expect(css('apply-page.css')).toContain('.ap-row.pending { visibility: hidden; }');
    const run = css('apply-run.css');
    expect(run).toContain('.run .aw {');
    const rules = run.replace(/\/\*[\s\S]*?\*\//g, '').match(/^[^@\s}][^{]*\{/gm) ?? [];
    for (const rule of rules) expect(rule).toMatch(/^(\.run[ -]|\.run\.|@keyframes)/);
    expect(css('apply.css')).toContain("@import './apply-run.css';");
  });
});

describe("Home's hero film", () => {
  const played = new Map<Element, { currentTime: number; pause: () => void }>();
  async function loadFilm({ reduceMotion = false, search = '', cores = 8 } = {}) {
    vi.resetModules();
    stubBrowser(reduceMotion);
    vi.stubGlobal('navigator', { ...navigator, hardwareConcurrency: cores });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    // jsdom has no Web Animations: each element gets one stand-in animation, so a test can see it start again.
    played.clear();
    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value(this: Element) {
        if (!played.has(this)) played.set(this, { currentTime: 0, pause: () => undefined });
        return [played.get(this)];
      },
    });
    window.history.replaceState(null, '', `/${search}`);
    document.body.innerHTML = new DOMParser().parseFromString(home(), 'text/html').body.innerHTML;
    const { startFilm } = await import('../../site/home/film');
    startFilm();
  }
  const hero = () => $('[data-film-hero]');
  const scenes = () => [...document.querySelectorAll<HTMLElement>('.hf-scene')];
  const onScene = () => $('.hf-scene[data-on]')?.dataset.shot;
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  });

  it('draws four scenes: the first at once, the others later, each one copy under a blur veil', async () => {
    await loadFilm();
    expect(scenes().map((s) => s.dataset.shot)).toEqual(['mails', 'mail', 'apps', 'dash']);
    expect(scenes()[0].querySelector('.hf-copy .hf-plane .hf-board')).not.toBeNull();
    expect(scenes()[0].querySelector(':scope > .hf-veil')).not.toBeNull();
    expect(
      scenes()
        .slice(1)
        .every((s) => s.childElementCount === 0),
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(1200);
    expect(scenes().every((s) => s.childElementCount === 2)).toBe(true);
    expect($('.hf-stage').inert).toBe(true);
  });

  it('starts once the page has settled, then cuts every 4 s and loops after 16 s', async () => {
    await loadFilm();
    expect(hero().hasAttribute('data-ready')).toBe(false);
    await vi.advanceTimersByTimeAsync(1700);
    expect(hero().hasAttribute('data-ready')).toBe(true);
    expect(onScene()).toBe('mails');
    await vi.advanceTimersByTimeAsync(4000);
    expect(onScene()).toBe('mail');
    await vi.advanceTimersByTimeAsync(8000);
    expect(onScene()).toBe('dash');
    await vi.advanceTimersByTimeAsync(4000);
    expect(onScene()).toBe('mails');
  });

  it('plays each shot from its start on every loop, and a pause keeps its place', async () => {
    await loadFilm();
    await vi.advanceTimersByTimeAsync(1700);
    const first = scenes()[0];
    first.getAnimations()[0].currentTime = 4000; // the shot has played to its end
    await vi.advanceTimersByTimeAsync(16000);
    expect(onScene()).toBe('mails');
    expect(first.getAnimations()[0].currentTime).toBe(0);
    first.getAnimations()[0].currentTime = 1200;
    const btn = $<HTMLButtonElement>('[data-film-toggle]');
    btn.click();
    btn.click();
    expect(first.getAnimations()[0].currentTime).toBe(1200);
  });

  it('pauses with its button, and holds the scene it was on', async () => {
    await loadFilm();
    await vi.advanceTimersByTimeAsync(1700);
    const btn = $<HTMLButtonElement>('[data-film-toggle]');
    btn.click();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Play the hero animation');
    expect(hero().hasAttribute('data-paused')).toBe(true);
    await vi.advanceTimersByTimeAsync(9000);
    expect(onScene()).toBe('mails');
    btn.click();
    expect(hero().hasAttribute('data-paused')).toBe(false);
  });

  it('holds one moment still with ?t=, and its end with less motion', async () => {
    await loadFilm({ search: '?t=9' });
    expect(onScene()).toBe('apps');
    expect(hero().hasAttribute('data-still')).toBe(true);
    await loadFilm({ reduceMotion: true });
    expect(onScene()).toBe('dash');
    expect(hero().hasAttribute('data-still')).toBe(true);
  });

  it('drops the blur on weak devices', async () => {
    await loadFilm({ cores: 4 });
    expect(hero().hasAttribute('data-lite')).toBe(true);
    await loadFilm({ cores: 8 });
    expect(hero().hasAttribute('data-lite')).toBe(false);
    expect(css('home-film.css')).toContain('.hf-hero[data-lite] .hf-veil { display: none; }');
  });

  it('never draws the scenes that are off screen, and moves only transform and opacity in its camera', () => {
    const film = css('home-film.css');
    expect(film).toContain(
      '.hf-scene:not([data-on]) { visibility: hidden; content-visibility: hidden; }',
    );
    expect(film).not.toMatch(/@property/);
    expect(film).toMatch(/@keyframes hf-crane \{ from \{ transform: rotateX/);
  });
});

describe('"One mail, start to finish" on Home', () => {
  async function loadStory(reduceMotion = false) {
    vi.resetModules();
    stubBrowser(reduceMotion);
    document.body.innerHTML = new DOMParser().parseFromString(home(), 'text/html').body.innerHTML;
    const { startStory } = await import('../../site/home/story');
    startStory();
  }

  it('plays once when it comes into view, and again on replay', async () => {
    await loadStory();
    const stage = $('[data-story]');
    expect(stage.classList.contains('play')).toBe(true);
    stage.classList.remove('play');
    $('[data-story-replay]').click();
    expect(stage.classList.contains('play')).toBe(true);
  });

  it('shows its end at once when the visitor asks for less motion', async () => {
    await loadStory(true);
    expect($('[data-story]').classList.contains('end')).toBe(true);
    expect($('[data-story]').classList.contains('play')).toBe(false);
  });
});
