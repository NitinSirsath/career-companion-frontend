// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { AnyRouter } from '@tanstack/react-router';
import { hideLayer, settleEntrances, showSnapshot } from '../components/phone/pageMotion';
import { PhoneStackCore } from '../components/phone/usePhoneStack';
import { EDGE_PX, useSwipeBack, type SwipeTarget } from '../components/phone/useSwipeBack';
import { watchSystemBack } from '../lib/systemBack';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
/** Longer than any slide, shorter than the wait for a Back that never lands. */
const SLIDE_MS = 900;

/** A stand-in for the browser's history, with the two calls the stack makes. */
function fakeRouter(start: string) {
  const entries = [{ href: start, key: 'k0' }];
  let index = 0;
  let keys = 0;
  const history = {
    get location() {
      const { href, key } = entries[index];
      return { href, pathname: href.split('?')[0], state: { __TSR_index: index, __TSR_key: key } };
    },
    go: vi.fn(),
  };
  return {
    history,
    navigate: vi.fn(),
    push(href: string) {
      entries.splice(index + 1, entries.length, { href, key: `k${++keys}` });
      index += 1;
    },
    replace: (href: string) => void (entries[index] = { href, key: entries[index].key }),
    back: () => void (index -= 1),
  };
}

/** The stack with a page and its two layers, as the phone frame places them. */
function setUp(start = '/mails') {
  const router = fakeRouter(start);
  const core = new PhoneStackCore(router as unknown as AnyRouter, () => undefined);
  const [page, under, over] = [0, 1, 2].map(() => document.createElement('div'));
  document.body.append(under, page, over);
  under.hidden = over.hidden = true;
  core.setPage(page);
  core.setUnder(under);
  core.setOver(over);
  core.located();
  /** The address changes as the router changes it: a copy of the page first, then the new place. */
  const move = (change: () => void) => {
    core.beforeNavigate(true);
    change();
    core.located();
  };
  const atRest = () =>
    page.style.transform === '' && page.style.opacity === '' && under.hidden && over.hidden;
  return { router, core, page, under, over, move, atRest };
}

const frames = (ms = SLIDE_MS) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'performance', 'Date'],
  });
  // The first second after a load counts as "the browser drew it" (its clock starts at 0).
  vi.advanceTimersByTime(5000);
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the phone page comes to rest', () => {
  it('slides a new page in, and the page that left away', async () => {
    const { move, router, page, under, over, atRest } = setUp();
    move(() => router.push('/mails/abc'));
    expect(under.hidden).toBe(false);
    expect(page.style.transform).not.toBe('');
    await frames();
    expect(atRest()).toBe(true);
    move(() => router.back());
    expect(over.hidden).toBe(false);
    await frames();
    expect(atRest()).toBe(true);
  });

  it('stops a spring for good when the browser goes back under it', async () => {
    const { core, move, router, page, atRest } = setUp();
    move(() => router.push('/mails/abc'));
    await frames();
    expect(core.swipeStart()).toBe(true);
    core.swipeMove(0.7);
    core.swipeEnd(false, 0);
    await frames(48);
    expect(page.style.transform).not.toBe('');
    // The system's own back swipe lands while the page still springs back.
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    core.edgeTouch();
    move(() => router.back());
    expect(atRest()).toBe(true);
    const moved = vi.spyOn(page.style, 'transform', 'set');
    await frames();
    expect(moved).not.toHaveBeenCalled();
    expect(atRest()).toBe(true);
  });

  it('does not park the page off screen when Back is counted twice', async () => {
    const { core, move, router, page, atRest } = setUp();
    move(() => router.push('/mails/abc'));
    await frames();
    core.swipeStart();
    core.swipeMove(0.4);
    // Let go far enough: the app slides the page away, to go back when it is gone.
    core.swipeEnd(true, 0);
    await frames(48);
    // The browser went back by itself meanwhile: the list is the page shown now.
    move(() => router.back());
    await frames(3000);
    expect(atRest()).toBe(true);
    expect(page.style.transform).toBe('');
    expect(router.history.go).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('no longer follows a finger once the page changed under it', async () => {
    const { core, move, router, page, atRest } = setUp();
    move(() => router.push('/mails/abc'));
    await frames();
    core.swipeStart();
    core.swipeMove(0.6);
    move(() => router.back());
    await frames();
    core.swipeMove(0.3);
    core.swipeEnd(true, 0);
    await frames(3000);
    expect(page.style.transform).toBe('');
    expect(atRest()).toBe(true);
    expect(router.history.go).not.toHaveBeenCalled();
  });

  it('comes to rest when its own Back never lands, and Back works again', async () => {
    const { core, move, router, page, atRest } = setUp();
    move(() => router.push('/mails/abc'));
    await frames();
    core.back();
    await frames();
    expect(router.history.go).toHaveBeenCalledExactlyOnceWith(-1);
    // Slid away, waiting for the address to change. It never does.
    expect(page.style.transform).not.toBe('');
    await frames(2100);
    expect(atRest()).toBe(true);
    core.back();
    await frames();
    expect(router.history.go).toHaveBeenCalledTimes(2);
  });

  it('puts a parked page back when only the address changes', () => {
    const { move, router, page, under, atRest } = setUp('/mails');
    page.style.transform = 'translate3d(390px,0,0)';
    under.hidden = false;
    move(() => router.replace('/mails?request=open'));
    expect(atRest()).toBe(true);
  });

  it('lets a slide go on when only the address changes', async () => {
    const { move, router, page, atRest } = setUp();
    move(() => router.push('/mails/abc'));
    await frames(48);
    move(() => router.replace('/mails/abc?view=mail'));
    expect(page.style.transform).not.toBe('');
    await frames();
    expect(atRest()).toBe(true);
  });

  it('adds no slide of its own after the iPhone edge swipe', async () => {
    const { core, move, router, over, atRest } = setUp();
    move(() => router.push('/mails/abc'));
    await frames();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    core.edgeTouch();
    move(() => router.back());
    expect(over.hidden).toBe(true);
    expect(atRest()).toBe(true);
    // Later steps back, with no touch at the edge, slide as before.
    move(() => router.push('/mails/def'));
    await frames();
    move(() => router.back());
    expect(over.hidden).toBe(false);
  });
});

describe('a step back the browser drew itself', () => {
  const flagged = (drew: boolean) =>
    Object.assign(new Event('popstate'), { hasUAVisualTransition: drew });

  it('adds no slide of its own, and slides again for a plain step back', async () => {
    const { move, router, over, atRest } = setUp();
    watchSystemBack();
    move(() => router.push('/mails/abc'));
    await frames();
    window.dispatchEvent(flagged(true));
    move(() => router.back());
    expect(over.hidden).toBe(true);
    expect(atRest()).toBe(true);
    move(() => router.push('/mails/def'));
    await frames(2000);
    window.dispatchEvent(flagged(false));
    move(() => router.back());
    expect(over.hidden).toBe(false);
  });

  it('is noted before the router hears of the step, so the note is there when the page is drawn', () => {
    // Listeners on the window run in the order they were added: the watch must come first.
    const main = readFileSync(resolve(__dirname, '../main.tsx'), 'utf8');
    expect(main.indexOf('watchSystemBack();')).toBeGreaterThan(0);
    expect(main.indexOf('watchSystemBack();')).toBeLessThan(main.indexOf('createRouter('));
  });
});

describe('the page layers', () => {
  const animation = (extra: object = {}) => ({
    cancel: vi.fn(),
    finish: vi.fn(),
    effect: { getComputedTiming: () => ({ endTime: 320 }) },
    ...extra,
  });

  it('takes a finished tab fade off a layer, so the next copy there is seen', () => {
    const layer = document.createElement('div');
    const fade = animation();
    layer.getAnimations = () => [fade as unknown as Animation];
    hideLayer(layer);
    expect(fade.cancel).toHaveBeenCalledTimes(1);
    showSnapshot(layer, undefined);
    expect(fade.cancel).toHaveBeenCalledTimes(2);
    expect(layer.hidden).toBe(false);
  });

  it('leaves no layer faded out after a slide with less motion', () => {
    const layer = document.createElement('div');
    layer.style.opacity = '0';
    hideLayer(layer);
    expect(layer.style.opacity).toBe('');
  });

  it('puts what rises in at its end after Back, and leaves endless loaders alone', () => {
    const page = document.createElement('div');
    const rise = animation({ animationName: 'page-in' });
    const loader = animation({
      animationName: 'shimmer',
      effect: { getComputedTiming: () => ({ endTime: Infinity }) },
    });
    const press = animation();
    page.getAnimations = () => [rise, loader, press] as unknown as Animation[];
    settleEntrances(page);
    expect(rise.finish).toHaveBeenCalledTimes(1);
    expect(loader.finish).not.toHaveBeenCalled();
    expect(press.finish).not.toHaveBeenCalled();
  });
});

describe('swipe back and the left edge', () => {
  let target: { [K in keyof Required<SwipeTarget>]: ReturnType<typeof vi.fn> };

  function Page() {
    const place = useSwipeBack(target as unknown as SwipeTarget);
    return <div ref={place} data-testid="page" />;
  }
  const drag = (page: HTMLElement, fromX: number, id = 1, isPrimary = true) => {
    fireEvent.pointerDown(page, { clientX: fromX, clientY: 300, pointerId: id, isPrimary });
    fireEvent.pointerMove(window, { clientX: fromX + 30, clientY: 300, pointerId: id });
    fireEvent.pointerMove(window, { clientX: fromX + 90, clientY: 300, pointerId: id });
  };

  beforeEach(() => {
    target = {
      swipeStart: vi.fn(() => true),
      swipeMove: vi.fn(),
      swipeEnd: vi.fn(),
      edgeTouch: vi.fn(),
    };
  });

  it('leaves a touch at the left edge to the system', () => {
    const page = render(<Page />).getByTestId('page');
    drag(page, EDGE_PX - 1);
    fireEvent.pointerUp(window, { clientX: 300, pointerId: 1 });
    expect(target.edgeTouch).toHaveBeenCalledTimes(1);
    expect(target.swipeStart).not.toHaveBeenCalled();
    expect(target.swipeEnd).not.toHaveBeenCalled();
  });

  it('still swipes back from anywhere beside the edge', () => {
    const page = render(<Page />).getByTestId('page');
    drag(page, EDGE_PX);
    expect(target.swipeStart).toHaveBeenCalledTimes(1);
    expect(target.swipeMove).toHaveBeenCalled();
    expect(target.edgeTouch).not.toHaveBeenCalled();
    // A second finger beside the first starts nothing of its own.
    drag(page, 200, 2, false);
    expect(target.swipeStart).toHaveBeenCalledTimes(1);
  });

  it('ends a drag whose finger never lifted when the next finger comes down', () => {
    const page = render(<Page />).getByTestId('page');
    drag(page, 120);
    // The system took the touch: no "up" and no "cancel" ever came.
    drag(page, 150, 2);
    expect(target.swipeEnd).toHaveBeenCalledExactlyOnceWith(false, expect.any(Number));
    expect(target.swipeStart).toHaveBeenCalledTimes(2);
  });
});
