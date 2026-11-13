import { describe, expect, it } from 'vitest';
import {
  homeTab,
  nextStacks,
  rootTab,
  startStacks,
  type PhoneIntent,
  type PhoneLocation,
  type PhoneStacks,
} from '../lib/phoneStack';
import { NAV_SPRING, springSettled, stepSpring } from '../lib/spring';

const at = (key: string, index: number, href: string): PhoneLocation => ({
  key,
  index,
  href,
  path: href.split('?')[0],
});

/** Runs addresses through the rules in order and returns the last state and every move. */
function run(start: PhoneLocation, ...steps: [PhoneLocation, PhoneIntent?][]) {
  let state: PhoneStacks = startStacks(start);
  let previous = start.index;
  const moves: string[] = [];
  for (const [location, intent] of steps) {
    const next = nextStacks(state, location, previous, intent ?? null);
    state = next.state;
    moves.push(next.move);
    previous = location.index;
  }
  return { state, moves, pages: (tab = state.tab) => state.stacks[tab].map((e) => e.path) };
}

describe('phone tabs and pages', () => {
  it('knows each tab by its first page, and every other page by its path', () => {
    expect(rootTab('/mails/')).toBe('mails');
    expect(rootTab('/mails/abc')).toBeNull();
    expect(homeTab('/mails/abc')).toBe('mails');
    expect(homeTab('/applications/7')).toBe('applications');
    expect(homeTab('/gmail')).toBe('settings');
    expect(homeTab('/sandbox/compose')).toBe('settings');
    expect(homeTab('/')).toBe('dashboard');
  });

  it('opens a page on top of the list, and Back takes it off again', () => {
    const { moves, pages } = run(
      at('a', 0, '/mails'),
      [at('b', 1, '/mails/abc')],
      [at('a', 0, '/mails')],
    );
    expect(moves).toEqual(['push', 'pop']);
    expect(pages()).toEqual(['/mails']);
  });

  it('puts the first page under a page that was opened directly', () => {
    const { state, pages } = run(at('a', 0, '/mails/abc'));
    expect(state.tab).toBe('mails');
    expect(pages()).toEqual(['/mails', '/mails/abc']);
  });

  it('keeps each tab where it was when another tab comes up', () => {
    const { state, moves, pages } = run(
      at('a', 0, '/mails'),
      [at('b', 1, '/mails/abc')],
      [at('c', 2, '/applications'), { kind: 'tab', tab: 'applications' }],
      [at('d', 3, '/applications/7')],
      [at('e', 4, '/mails/abc'), { kind: 'tab', tab: 'mails' }],
    );
    expect(moves).toEqual(['push', 'tab', 'push', 'tab']);
    expect(state.tab).toBe('mails');
    expect(pages()).toEqual(['/mails', '/mails/abc']);
    expect(pages('applications')).toEqual(['/applications', '/applications/7']);
  });

  it("pops to the page under it with the app's own Back, also by a replaced address", () => {
    const { moves, pages } = run(
      at('a', 0, '/mails'),
      [at('b', 1, '/mails/abc')],
      [at('c', 2, '/applications/7')],
      [at('d', 2, '/mails/abc'), { kind: 'pop', to: 1 }],
    );
    expect(moves).toEqual(['push', 'push', 'pop']);
    expect(pages()).toEqual(['/mails', '/mails/abc']);
  });

  it("follows the browser's back into another tab's pages", () => {
    const { state, moves, pages } = run(
      at('a', 0, '/mails'),
      [at('b', 1, '/mails/abc')],
      [at('c', 2, '/applications'), { kind: 'tab', tab: 'applications' }],
      [at('b', 1, '/mails/abc')],
    );
    expect(moves).toEqual(['push', 'tab', 'tab']);
    expect(state.tab).toBe('mails');
    expect(pages()).toEqual(['/mails', '/mails/abc']);
  });

  it('stays put when only the address changes, and brings a tab up from a link to it', () => {
    const { state, moves, pages } = run(
      at('a', 0, '/dashboard'),
      [at('a2', 0, '/dashboard?period=7')],
      [at('b', 1, '/mails?request=open')],
    );
    expect(moves).toEqual(['stay', 'tab']);
    expect(state.tab).toBe('mails');
    expect(pages()).toEqual(['/mails']);
    expect(state.stacks.mails[0].href).toBe('/mails?request=open');
  });

  it('replaces the page in place on a redirect', () => {
    const { moves, pages } = run(at('a', 0, '/mails'), [at('b', 0, '/mails/xyz')]);
    expect(moves).toEqual(['stay']);
    expect(pages()).toEqual(['/mails/xyz']);
  });
});

describe('springs', () => {
  it('settles at the target without overshoot when fully damped', () => {
    let [x, v] = [0, 0];
    let most = 0;
    for (let frame = 0; frame < 120 && !springSettled(x, v, 1); frame += 1) {
      [x, v] = stepSpring([x, v], 1, 1 / 60, NAV_SPRING);
      most = Math.max(most, x);
    }
    expect(springSettled(x, v, 1)).toBe(true);
    expect(most).toBeLessThan(1.001);
  });
});
