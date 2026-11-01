// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fillParts } from '../../site/parts/index';

/** Home's self-playing pictures and phone pictures on the product site. */
const home = () => fillParts(readFileSync(resolve(__dirname, '../../site/index.html'), 'utf8'));
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
