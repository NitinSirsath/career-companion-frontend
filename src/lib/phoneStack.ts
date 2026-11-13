/**
 * The phone's pages as an iPhone app keeps them (owner, 13 Nov 2026, approved mock
 * `IOS-LOOK-mock/`): four tabs, each with its own stack of open pages. A page opened from a page
 * slides in on top of it, in the same tab; Back takes it off again. Switching tabs keeps every
 * tab's pages where they were. The browser's history stays the one source of where the app is:
 * these rules only read each new address and say how it moved.
 */
export type PhoneTab = 'dashboard' | 'mails' | 'applications' | 'settings';

export const PHONE_TABS: readonly PhoneTab[] = ['dashboard', 'mails', 'applications', 'settings'];

/** The first page of each tab. */
export const TAB_ROOT: Record<PhoneTab, string> = {
  dashboard: '/dashboard',
  mails: '/mails',
  applications: '/applications',
  settings: '/settings',
};

/** "/mails/" and "/mails" are one page. */
export const trimPath = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/** The tab whose first page this is, or null for any other page. */
export function rootTab(path: string): PhoneTab | null {
  const trimmed = trimPath(path);
  return PHONE_TABS.find((tab) => TAB_ROOT[tab] === trimmed) ?? null;
}

/** The tab a page opens in when nothing else says, such as after a reload: by its path. */
export function homeTab(path: string): PhoneTab {
  const first = trimPath(path).split('/')[1] ?? '';
  if (first === 'mails' || first === 'applications') return first;
  if (first === '' || first === 'dashboard' || first === 'agenda') return 'dashboard';
  return 'settings';
}

/** Where the app is: a history entry's key and place, and its address. */
export interface PhoneLocation {
  key: string;
  index: number;
  href: string;
  path: string;
}

export interface StackEntry {
  /** Stays the same while the page is the same page, even when its address changes. */
  id: string;
  href: string;
  path: string;
  /** The history entry; null for a first page the app put under a page opened directly. */
  key: string | null;
  index: number | null;
}

export interface PhoneStacks {
  tab: PhoneTab;
  stacks: Record<PhoneTab, StackEntry[]>;
}

/** What the app itself asked for just before the address changed. */
export type PhoneIntent = { kind: 'tab'; tab: PhoneTab } | { kind: 'pop'; to: number } | null;

/** How the screen moved: a page slid in, slid away, another tab came up, or it stayed. */
export type PhoneMove = 'push' | 'pop' | 'tab' | 'stay';

const synthRoot = (tab: PhoneTab): StackEntry => ({
  id: `root:${tab}`,
  href: TAB_ROOT[tab],
  path: TAB_ROOT[tab],
  key: null,
  index: null,
});

const fromLocation = (at: PhoneLocation, id = at.key): StackEntry => ({
  id,
  href: at.href,
  path: trimPath(at.path),
  key: at.key,
  index: at.index,
});

/** A tab's pages when a page is opened directly: its tab's first page under it. */
function landing(at: PhoneLocation): { tab: PhoneTab; stack: StackEntry[] } {
  const root = rootTab(at.path);
  if (root) return { tab: root, stack: [fromLocation(at)] };
  const tab = homeTab(at.path);
  return { tab, stack: [synthRoot(tab), fromLocation(at)] };
}

export function startStacks(at: PhoneLocation): PhoneStacks {
  const { tab, stack } = landing(at);
  const stacks = Object.fromEntries(PHONE_TABS.map((t) => [t, [synthRoot(t)]])) as Record<
    PhoneTab,
    StackEntry[]
  >;
  return { tab, stacks: { ...stacks, [tab]: stack } };
}

const withStack = (state: PhoneStacks, tab: PhoneTab, stack: StackEntry[]): PhoneStacks => ({
  tab,
  stacks: { ...state.stacks, [tab]: stack },
});

/** The same page again, at its new address. */
const refresh = (entry: StackEntry, at: PhoneLocation): StackEntry => fromLocation(at, entry.id);

/** Where in a stack this location is: by its history entry, else by its address. */
function findIn(stack: StackEntry[], at: PhoneLocation): number {
  const byKey = stack.findIndex((entry) => entry.key === at.key);
  if (byKey >= 0) return byKey;
  return stack.findIndex((entry) => entry.href === at.href);
}

function goTab(state: PhoneStacks, tab: PhoneTab, at: PhoneLocation) {
  const stack = state.stacks[tab];
  const top = stack[stack.length - 1];
  // The tab's page is shown again as it was; a tab opened at another page starts over there.
  const next =
    trimPath(at.path) === top.path ? [...stack.slice(0, -1), refresh(top, at)] : landing(at).stack;
  return { state: withStack(state, tab, next), move: 'tab' as const };
}

function goBack(state: PhoneStacks, at: PhoneLocation): { state: PhoneStacks; move: PhoneMove } {
  const stack = state.stacks[state.tab];
  const here = findIn(stack.slice(0, -1), at);
  if (here >= 0)
    return {
      state: withStack(state, state.tab, [...stack.slice(0, here), refresh(stack[here], at)]),
      move: 'pop',
    };
  // Back into another tab's pages, as Android's back does after a tab switch.
  for (const tab of PHONE_TABS) {
    const other = state.stacks[tab];
    const found = tab === state.tab ? -1 : findIn(other, at);
    if (found >= 0)
      return {
        state: withStack(state, tab, [...other.slice(0, found), refresh(other[found], at)]),
        move: 'tab',
      };
  }
  const { tab, stack: fresh } = landing(at);
  return { state: withStack(state, tab, fresh), move: tab === state.tab ? 'stay' : 'tab' };
}

/**
 * The stacks after the address changed to `at`. `previous` is the history place before it;
 * `intent` what the app asked for (a tab tap or its own Back), if anything.
 */
export function nextStacks(
  state: PhoneStacks,
  at: PhoneLocation,
  previous: number,
  intent: PhoneIntent,
): { state: PhoneStacks; move: PhoneMove } {
  const stack = state.stacks[state.tab];
  const top = stack[stack.length - 1];
  const path = trimPath(at.path);
  if (intent?.kind === 'tab') return goTab(state, intent.tab, at);
  if (intent?.kind === 'pop' && intent.to < stack.length - 1)
    return {
      state: withStack(state, state.tab, [
        ...stack.slice(0, intent.to),
        refresh(stack[intent.to], at),
      ]),
      move: 'pop',
    };
  // Same page, new address: a filter, a page of a list, a redirect to itself.
  if (path === top.path)
    return {
      state: withStack(state, state.tab, [...stack.slice(0, -1), refresh(top, at)]),
      move: 'stay',
    };
  if (at.index < previous) return goBack(state, at);
  const root = rootTab(path);
  // A link to a tab's first page brings that tab up with only that page.
  if (root)
    return {
      state: withStack(state, root, [refresh(state.stacks[root][0], at)]),
      move: root === state.tab ? 'pop' : 'tab',
    };
  // Replaced in place (a redirect), or a new page on top of this one.
  if (at.index === previous)
    return {
      state: withStack(state, state.tab, [...stack.slice(0, -1), fromLocation(at)]),
      move: 'stay',
    };
  return { state: withStack(state, state.tab, [...stack, fromLocation(at)]), move: 'push' };
}
