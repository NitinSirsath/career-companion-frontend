// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SampleApp as SampleAppType } from '../../site/example/app';

/** The live example in the Mobile page's phones: made-up mails, nothing leaves the page. */
let SampleApp: typeof SampleAppType;

beforeAll(async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
  }));
  ({ SampleApp } = await import('../../site/example/app'));
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function start(opts: ConstructorParameters<typeof SampleAppType>[1] = {}) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return { root, app: new SampleApp(root, opts) };
}
const click = (root: HTMLElement, selector: string) =>
  root.querySelector<HTMLElement>(selector)!.click();

describe('the live example', () => {
  it('opens a mail, lets the AI write the reply, sends it, and closes the step', async () => {
    const { root, app } = start();
    click(root, '[data-open="brightwave"]');
    expect(root.querySelector('.sa-big')?.textContent).toBe(
      'Interview invitation: Frontend Engineer',
    );
    click(root, '[data-act="reply"]');
    expect(root.querySelector('.sa-sheet.large')?.getAttribute('aria-label')).toBe('Reply');
    click(root, '[data-ai="write"]');
    expect(root.querySelector('.sa-writing')?.textContent).toContain('AI is writing your reply');
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
    expect(root.querySelector('.sa-stepc.done')).not.toBeNull();
    click(root, '[data-act="step"]');
    expect(root.querySelector('.sa-sheet .sa-note')?.textContent).toContain(
      'Your reply answered it',
    );
    expect(root.querySelector('.sa-sheet [data-act="reopen"]')).not.toBeNull();
  });

  it('puts a closed step back with Reopen, and Done closes a step done outside mail', () => {
    const { root, app } = start();
    click(root, '[data-open="kestrel"]');
    click(root, '[data-act="did"]');
    expect(app.mail('kestrel')?.state).toBe('DONE');
    expect(root.querySelector('.toast')?.textContent).toContain('Done: Finish the coding test');
    click(root, '[data-act="reopen"]');
    expect(app.mail('kestrel')?.state).toBe('OPEN');
    expect(app.s.apps.find((a) => a.mail === 'kestrel')?.todo).toBe('Finish the coding test');
    expect(root.querySelector('.toast')?.textContent).toContain('Reopened: Finish the coding test');
  });

  it('shows key dates and the application behind ⓘ, in a sheet', () => {
    const { root } = start();
    click(root, '[data-open="brightwave"]');
    click(root, '[data-act="info"]');
    expect(root.querySelector('.sa-sheet')?.getAttribute('aria-label')).toBe('About this job mail');
    expect(root.querySelector('.sa-dl dd')?.textContent).toBe('Mon, Nov 3');
    click(root, '.sa-scrim');
    expect(root.querySelector('.sa-sheet')).toBeNull();
  });

  it('finds a new mail on the first sync, hides what the AI found until it has read it, and nothing the second time', async () => {
    const { root, app } = start();
    click(root, '[data-act="sync"]');
    expect(root.querySelector('.sa-status')?.textContent).toBe('Syncing…');
    await vi.advanceTimersByTimeAsync(1200);
    expect(app.s.mails[0].id).toBe('fernhill');
    expect(root.querySelector('[data-open="fernhill"] .tg')?.classList.contains('sa-wait')).toBe(
      true,
    );
    expect(root.querySelector('[data-open="fernhill"] .st')?.textContent).toBe(
      'AI is reading this mail',
    );
    expect(root.querySelector('.sa-status')?.textContent).toContain('Reading your new mails');
    await vi.advanceTimersByTimeAsync(1800);
    expect(root.querySelector('[data-open="fernhill"] .st')?.textContent).toBe(
      'Suggest a time for a call',
    );
    expect(app.s.apps.find((a) => a.co === 'Fernhill')?.status).toBe('RECRUITER_CONTACT');

    click(root, '[data-act="sync"]');
    await vi.advanceTimersByTimeAsync(1200);
    expect(app.s.mails.filter((m) => m.id === 'fernhill')).toHaveLength(1);
    expect(root.querySelector('.toast')?.textContent).toContain('No new job mails');
  });

  it('takes a swipe as a page scroll and a tap as a use', () => {
    const { root, app } = start();
    root.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    root.dispatchEvent(new Event('pointercancel', { bubbles: true }));
    expect(app.touched).toBe(false);
    expect(root.classList.contains('used')).toBe(false);
    root.click();
    expect(app.touched).toBe(true);
    expect(root.classList.contains('used')).toBe(true);
  });

  it('goes back to the start on replay: the first page, the list at its top, a swipe scrolls the page again', async () => {
    const { root, app } = start({ view: 'dashboard' });
    click(root, '[data-go="mails"]');
    expect(root.classList.contains('used')).toBe(true);
    app.reset();
    expect(root.classList.contains('used')).toBe(false);
    expect(app.s.view).toBe('dashboard');
    expect(root.querySelector('.sa-tabbar .on')?.textContent).toBe('Dashboard');
    expect(app.s.mails).toHaveLength(5);
  });

  it('answers a tap on a part that is only in the real app with a note', () => {
    const { root } = start();
    click(root, '[aria-label="Search"]');
    expect(root.querySelector('.toast')?.textContent).toContain(
      'Search is in the real app, not in this example',
    );
  });

  it("draws the laptop Mails list for the hero's film as the app does: the summary line and one list", async () => {
    const { laptop } = await import('../../site/example/laptop');
    const { startState } = await import('../../site/example/data');
    const root = document.createElement('div');
    root.innerHTML = laptop(startState('mails'), null);
    expect(root.querySelector('.sa-sub')?.textContent).toBe(
      '3 mails need you. Everything else is up to date.',
    );
    expect(root.querySelector('.sa-th')).toBeNull();
    expect(root.querySelectorAll('.sa-list [data-open]')).toHaveLength(5);
    expect(root.querySelector('[data-open="orbitly"] .sa-step')?.textContent).toBe(
      'Nothing needed',
    );
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
    const { root } = start();
    click(root, '[data-menu="filters"]');
    click(root, '.sa-menu [data-act="new"]');
    expect(root.querySelector('.sa-menu')).toBeNull();
    expect(
      [...root.querySelectorAll('[data-open]')].map((el) => el.getAttribute('data-open')),
    ).toEqual(['brightwave', 'kestrel']);
    expect(root.querySelector('.sa-fpill')?.textContent).toBe('New only');
    // A tap outside an open menu only closes it.
    click(root, '[data-menu="filters"]');
    click(root, '.sa-big');
    expect(root.querySelector('.sa-menu')).toBeNull();
    expect(root.querySelectorAll('[data-open]')).toHaveLength(2);
  });

  it('asks the server for nothing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { root } = start();
    click(root, '[data-act="sync"]');
    click(root, '[data-open="kestrel"]');
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
