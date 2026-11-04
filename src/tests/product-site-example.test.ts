// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SampleApp as SampleAppType } from '../../site/example/app';

/** The live example on the product site's Home: made-up mails, nothing leaves the page. */
let SampleApp: typeof SampleAppType;

beforeAll(async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
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
  ({ SampleApp } = await import('../../site/example/app'));
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function start(opts: ConstructorParameters<typeof SampleAppType>[1] = {}, width = 0) {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width });
  document.body.appendChild(root);
  return { root, app: new SampleApp(root, opts) };
}
const click = (root: HTMLElement, selector: string) =>
  root.querySelector<HTMLElement>(selector)!.click();

describe('the live example', () => {
  it('opens a mail, lets the AI write the reply, sends it, and closes the step', async () => {
    const { root, app } = start({ phone: true });
    click(root, '[data-open="brightwave"]');
    expect(root.querySelector('.sa-h1')?.textContent).toBe(
      'Interview invitation: Frontend Engineer',
    );
    click(root, '[data-act="reply"]');
    click(root, '[data-ai="write"]');
    expect(root.querySelector('.sa-writing')?.textContent).toContain('Writing your reply');
    await vi.advanceTimersByTimeAsync(4000);
    const ta = root.querySelector<HTMLTextAreaElement>('.sa-ta')!;
    expect(ta.value).toContain('Tuesday, November 4 at 11:00 AM works well for me.');
    expect(root.querySelector<HTMLButtonElement>('[data-act="send"]')!.disabled).toBe(false);

    click(root, '[data-act="send"]');
    await vi.advanceTimersByTimeAsync(700);
    expect(app.mail('brightwave')?.state).toBe('REPLIED');
    expect(root.querySelector('.toast')?.textContent).toContain('Sent from your Gmail');
    await vi.advanceTimersByTimeAsync(1900);
    expect(app.mail('brightwave')?.state).toBe('DONE');
    expect(root.querySelector('.sa-closed')?.textContent).toContain('Your reply answered it');
  });

  it('finds a new mail on the first sync, hides what the AI found until it has read it, and nothing the second time', async () => {
    const { root, app } = start({ phone: true });
    click(root, '[data-act="sync"]');
    expect(root.querySelector('.sa-pbar')?.textContent).toContain('Checking Gmail');
    await vi.advanceTimersByTimeAsync(1200);
    expect(app.s.mails[0].id).toBe('fernhill');
    expect(root.querySelector('[data-open="fernhill"] .tg')?.classList.contains('sa-wait')).toBe(
      true,
    );
    expect(root.querySelector('[data-open="fernhill"] .stp')?.textContent).toBe(
      'AI is reading this mail',
    );
    await vi.advanceTimersByTimeAsync(1800);
    expect(root.querySelector('[data-open="fernhill"] .stp')?.textContent).toBe(
      'Suggest a time for a call',
    );
    expect(app.s.apps.find((a) => a.co === 'Fernhill')?.status).toBe('RECRUITER_CONTACT');

    click(root, '[data-act="sync"]');
    await vi.advanceTimersByTimeAsync(1200);
    expect(app.s.mails.filter((m) => m.id === 'fernhill')).toHaveLength(1);
    expect(root.querySelector('.toast')?.textContent).toContain('No new job mails');
  });

  it('plays by itself, but a swipe is not a use and a tap is', async () => {
    const { root, app } = start({ phone: true, autoplay: 'sync' });
    root.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    root.dispatchEvent(new Event('pointercancel', { bubbles: true }));
    expect(app.touched).toBe(false);
    expect(root.classList.contains('used')).toBe(false);
    app.play();
    await vi.advanceTimersByTimeAsync(1400 + 1200);
    expect(app.s.mails[0].id).toBe('fernhill');

    app.reset();
    root.click();
    expect(app.touched).toBe(true);
    expect(root.classList.contains('used')).toBe(true);
    app.play();
    await vi.advanceTimersByTimeAsync(3000);
    expect(app.s.mails[0].id).toBe('brightwave');
  });

  it('goes back to the start on replay: the first page, the list at its top, a swipe scrolls the page again', async () => {
    const { root, app } = start({ phone: true, view: 'dashboard' });
    click(root, '[data-go="mails"]');
    expect(root.classList.contains('used')).toBe(true);
    app.reset();
    expect(root.classList.contains('used')).toBe(false);
    expect(app.s.view).toBe('dashboard');
    expect(root.querySelector('.sa-ptabs .on')?.textContent).toBe('Dashboard');
    expect(app.s.mails).toHaveLength(5);
  });

  it('answers a tap on a settings item with a note', () => {
    const { root } = start({}, 1120);
    expect(root.querySelector('.sa-grid')).not.toBeNull();
    click(root, '[data-soon]');
    expect(root.querySelector('.toast')?.textContent).toContain(
      'Settings are in the real app, not in this example',
    );
  });

  it('uses the phone layout below 620 px of its own width, and the laptop layout above', () => {
    expect(start({}, 400).root.querySelector('.sa-p')).not.toBeNull();
    expect(start({}, 800).root.classList.contains('mid')).toBe(true);
    expect(start({}, 1120).root.querySelector('.sa-side')).not.toBeNull();
  });

  it('draws the Mails list as the app does: the summary line, one list, and the Needs action filter', () => {
    const { root } = start({}, 1120);
    expect(root.querySelector('.sa-sub')?.textContent).toBe(
      '3 mails need you. Everything else is up to date.',
    );
    expect(root.querySelector('.sa-th')).toBeNull();
    expect(root.querySelectorAll('.sa-list [data-open]')).toHaveLength(5);
    expect(root.querySelector('[data-open="orbitly"] .sa-step')?.textContent).toBe(
      'Nothing needed',
    );
    click(root, '[data-act="needs"]');
    expect(root.querySelectorAll('.sa-list [data-open]')).toHaveLength(3);
    expect(root.querySelector('[data-act="needs"]')?.getAttribute('aria-pressed')).toBe('true');
    click(root, '[data-act="needs"]');
    expect(root.querySelectorAll('.sa-list [data-open]')).toHaveLength(5);
  });

  it('gives each sender the colour the app gives them, and New only on phones', async () => {
    const { tone } = await import('../../site/example/pieces');
    const { avatarTone } = await import('../lib/avatarTone');
    for (const name of [
      'Priya Nair',
      'Kestrel Hiring',
      'Daniel Ortiz',
      'HR Team',
      'Orbitly Careers',
    ])
      expect(avatarTone(name)).toContain(`--avatar-${tone(name).slice(1)})`);
    const { root } = start({ phone: true });
    click(root, '[data-act="new"]');
    expect(
      [...root.querySelectorAll('[data-open]')].map((el) => el.getAttribute('data-open')),
    ).toEqual(['brightwave', 'kestrel']);
  });

  it('asks the server for nothing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { root } = start({ phone: true });
    click(root, '[data-act="sync"]');
    click(root, '[data-open="kestrel"]');
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
