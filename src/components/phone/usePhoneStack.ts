import { useEffect, useLayoutEffect, useState } from 'react';
import {
  defaultStringifySearch,
  useRouter,
  useRouterState,
  type AnyRouter,
} from '@tanstack/react-router';
import {
  nextStacks,
  rootTab,
  startStacks,
  TAB_ROOT,
  type PhoneIntent,
  type PhoneLocation,
  type PhoneMove,
  type PhoneStacks,
  type PhoneTab,
  type StackEntry,
} from '../../lib/phoneStack';
import { animateSpring, NAV_SPRING } from '../../lib/spring';
import { rememberedSearch } from '../layout/navItems';
import {
  clearFrame,
  hideLayer,
  scrollerOf,
  showSnapshot,
  slideFrame,
  takeSnapshot,
  type PageSnapshot,
} from './pageMotion';

/** What the frame shows for where the app is. */
export interface PhoneView {
  tab: PhoneTab;
  depth: number;
  isRoot: boolean;
}

/** An intent older than this was for a navigation that never came. */
const INTENT_MS = 2000;

/** Safari already drew its own back swipe for this history step: the app then adds none. */
let browserDrewBack = 0;
const noteBrowserBack = (event: PopStateEvent) => {
  if (event.hasUAVisualTransition) browserDrewBack = performance.now();
};

/** One page's look and scroll, kept while it is under another page or in another tab. */
class PageMemory {
  snapshots = new Map<string, PageSnapshot>();
  scrolls = new Map<string, number>();
  keep(id: string, snapshot: PageSnapshot | null, withLook: boolean) {
    if (!snapshot) return;
    this.scrolls.set(id, snapshot.scrollTop);
    if (withLook) this.snapshots.set(id, snapshot);
  }
  scrollOf(id: string) {
    return this.scrolls.get(id) ?? 0;
  }
  /** Forgets pages that are in no tab any more. */
  prune(state: PhoneStacks) {
    const open = new Set(Object.values(state.stacks).flatMap((stack) => stack.map((e) => e.id)));
    for (const map of [this.snapshots, this.scrolls])
      for (const id of [...map.keys()]) if (!open.has(id)) map.delete(id);
  }
}

function restoreScroll(page: HTMLElement | null, top: number) {
  const scroller = page && scrollerOf(page);
  if (!scroller) return;
  scroller.scrollTop = top;
  // A list that draws a moment later still lands where it was.
  if (top > 0) requestAnimationFrame(() => (scroller.scrollTop = top));
}

const topOf = (state: PhoneStacks, tab = state.tab) =>
  state.stacks[tab][state.stacks[tab].length - 1];

/** Where to go to show this page of a tab again; a list's first page keeps its last filters. */
function hrefOf(entry: StackEntry, tab: PhoneTab) {
  if (entry.key !== null) return entry.href;
  const root = TAB_ROOT[tab];
  const search = root === '/mails' || root === '/applications' ? rememberedSearch(root) : {};
  return root + defaultStringifySearch(search ?? {});
}

/**
 * Keeps each tab's pages, reads every address change as a push, a pop or a tab switch, and draws
 * the slide for it (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`). The browser's history
 * stays the source of where the app is; this only remembers how each tab looked.
 */
export class PhoneStackCore {
  private stacks: PhoneStacks | null = null;
  private memory = new PageMemory();
  private pending: PageSnapshot | null = null;
  private intent: { value: PhoneIntent; at: number } | null = null;
  private previousIndex = 0;
  private busy = false;
  private ownPop = false;
  private swipeAt = 1;
  /** The live page, and the layers for the still copies under it and over it. */
  private layers: {
    page: HTMLElement | null;
    under: HTMLElement | null;
    over: HTMLElement | null;
  } = { page: null, under: null, over: null };

  constructor(
    private router: AnyRouter,
    private onView: (view: PhoneView) => void,
  ) {}

  setPage = (element: HTMLElement | null) => void (this.layers.page = element);
  setUnder = (element: HTMLElement | null) => void (this.layers.under = element);
  setOver = (element: HTMLElement | null) => void (this.layers.over = element);

  private where(): PhoneLocation {
    const { state, href, pathname } = this.router.history.location;
    const index =
      typeof state.__TSR_index === 'number' ? state.__TSR_index : this.previousIndex + 1;
    return { key: state.__TSR_key ?? state.key ?? href, index, href, path: pathname };
  }

  private get stack() {
    return this.stacks ? this.stacks.stacks[this.stacks.tab] : [];
  }

  /** Just before the address changes: the page as it looks now. */
  beforeNavigate(pathChanged: boolean) {
    const page = this.layers.page;
    this.pending = page && pathChanged ? takeSnapshot(page) : null;
  }

  /** The new page is in place: read how the app moved, and draw it. */
  located() {
    const at = this.where();
    const asked = this.intent && performance.now() - this.intent.at < INTENT_MS;
    let next = startStacks(at);
    if (this.stacks) {
      const result = nextStacks(
        this.stacks,
        at,
        this.previousIndex,
        asked ? this.intent!.value : null,
      );
      next = result.state;
      this.draw(result.move, topOf(this.stacks), next);
    }
    this.intent = null;
    this.ownPop = false;
    this.pending = null;
    this.previousIndex = at.index;
    this.stacks = next;
    this.memory.prune(next);
    const depth = next.stacks[next.tab].length;
    this.onView({ tab: next.tab, depth, isRoot: rootTab(at.path) !== null });
  }

  private draw(move: PhoneMove, before: StackEntry, next: PhoneStacks) {
    const look = this.pending;
    const page = this.layers.page;
    if (move === 'push') {
      this.memory.keep(before.id, look, true);
      restoreScroll(page, 0);
      return this.slideIn(look);
    }
    if (move === 'tab') this.memory.keep(before.id, look, false);
    if (move === 'pop' || move === 'tab') restoreScroll(page, this.memory.scrollOf(topOf(next).id));
    if (move !== 'pop') return;
    const browserDrew = performance.now() - browserDrewBack < 1000;
    if (this.ownPop || browserDrew) this.finish();
    else this.slideAway(look);
  }

  finish = () => {
    const { page, under, over } = this.layers;
    if (page) clearFrame(page);
    if (under) hideLayer(under);
    if (over) hideLayer(over);
    this.busy = false;
  };

  /** A new page slides in over the copy of the one it covers. */
  private slideIn(from: PageSnapshot | null) {
    const { page, under } = this.layers;
    if (!page || !under || !from) return;
    this.busy = true;
    showSnapshot(under, from);
    slideFrame(under, page, 0);
    void animateSpring({ from: 0, to: 1 }, NAV_SPRING, (p) => slideFrame(under, page, p)).then(
      this.finish,
    );
  }

  /** The browser went back: the copy of the page that left slides away over the live one. */
  private slideAway(leaving: PageSnapshot | null) {
    const { page, over } = this.layers;
    if (!page || !over || !leaving) return;
    this.busy = true;
    showSnapshot(over, leaving);
    slideFrame(page, over, 1);
    void animateSpring({ from: 1, to: 0 }, NAV_SPRING, (p) => slideFrame(page, over, p)).then(
      this.finish,
    );
  }

  /** Shows page `to` of this tab again: through history when it is right there, else in place. */
  private goBackTo(to: number) {
    const target = this.stack[to];
    if (!target || !this.stacks) return this.finish();
    const here = this.where().index;
    this.intent = { value: { kind: 'pop', to }, at: performance.now() };
    this.ownPop = true;
    if (target.index !== null && target.key !== null && target.index < here)
      this.router.history.go(target.index - here);
    else void this.router.navigate({ href: hrefOf(target, this.stacks.tab), replace: true });
    // A navigation that never lands must not leave the page slid away.
    window.setTimeout(() => {
      if (this.busy && this.ownPop) this.finish();
    }, INTENT_MS);
  }

  /** The top page slides away (from where a finger left it), then the address goes back. */
  private popTo(to: number, from = 1, velocity = 0) {
    const { page, under } = this.layers;
    const target = this.stack[to];
    if (!page || !under || !target) return;
    this.busy = true;
    showSnapshot(under, this.memory.snapshots.get(target.id));
    void animateSpring({ from, to: 0, velocity }, NAV_SPRING, (p) =>
      slideFrame(under, page, p),
    ).then(() => this.goBackTo(to));
  }

  back = () => {
    if (!this.busy && this.stack.length > 1) this.popTo(this.stack.length - 2);
  };

  /** Another tab; the open tab again goes back to its first page, then to the top. */
  openTab = (tab: PhoneTab) => {
    const state = this.stacks;
    if (!state || this.busy) return;
    if (tab === state.tab && this.stack.length > 1) return this.popTo(0);
    if (tab === state.tab) {
      const page = this.layers.page;
      return page && scrollerOf(page)?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    this.intent = { value: { kind: 'tab', tab }, at: performance.now() };
    void this.router.navigate({ href: hrefOf(topOf(state, tab), tab) });
  };

  /** A finger starts to drag the page to the right: the page under it shows. */
  swipeStart = () => {
    const { page, under } = this.layers;
    if (this.busy || this.stack.length < 2 || !page || !under) return false;
    this.busy = true;
    this.swipeAt = 1;
    showSnapshot(under, this.memory.snapshots.get(this.stack[this.stack.length - 2].id));
    return true;
  };

  swipeMove = (p: number) => {
    const { page, under } = this.layers;
    this.swipeAt = p;
    if (page && under) slideFrame(under, page, p);
  };

  /** Let go: far or fast enough goes back, else the page springs back into place. */
  swipeEnd = (go: boolean, velocity: number) => {
    const { page, under } = this.layers;
    if (!page || !under) return this.finish();
    if (go) return this.popTo(this.stack.length - 2, this.swipeAt, velocity);
    void animateSpring({ from: this.swipeAt, to: 1, velocity }, NAV_SPRING, (p) =>
      slideFrame(under, page, p),
    ).then(this.finish);
  };
}

/** The stack for the phone frame, wired to the router. */
export function usePhoneStack() {
  const router = useRouter();
  const [view, setView] = useState<PhoneView | null>(null);
  const [core] = useState(() => new PhoneStackCore(router, setView));
  useEffect(
    () => router.subscribe('onBeforeNavigate', (event) => core.beforeNavigate(event.pathChanged)),
    [router, core],
  );
  useEffect(() => {
    window.addEventListener('popstate', noteBrowserBack, { capture: true });
    return () => window.removeEventListener('popstate', noteBrowserBack, { capture: true });
  }, []);
  const leaf = useRouterState({
    select: (state) => {
      const match = state.matches[state.matches.length - 1];
      return match ? `${match.id}?${JSON.stringify(match.search)}` : '';
    },
  });
  useLayoutEffect(() => core.located(), [leaf, core]);
  return { view, core };
}
