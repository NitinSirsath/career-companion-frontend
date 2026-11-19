import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { useRouterState } from '@tanstack/react-router';
import { homeTab, rootTab } from '../../lib/phoneStack';
import { useBreadcrumbSlot } from '../layout/breadcrumbSlot';
import { InstallCard } from '../InstallCard';
import { OfflineLine } from '../layout/OfflinePage';
import { OwnerMessages } from '../messages/OwnerMessages';
import { Spinner } from '../ui/spinner';
import { useFingerMenus } from '../ui/useFingerMenus';
import { useRefresh } from '../ui/useRefresh';
import { cn } from '../../lib/utils';
import { BarHost } from './BarHost';
import { SHADE_CLASS } from './pageMotion';
import { PhoneNavContext, type BarMode, type PhoneFrame } from './phoneNav';
import { PhoneTopBar } from './PhoneTopBar';
import { usePageScroll } from './usePageScroll';
import { usePhoneStack, type PhoneStackCore, type PhoneView } from './usePhoneStack';
import { usePullToRefresh } from './usePullToRefresh';
import { useSwipeBack } from './useSwipeBack';

/** Before the stack has read the first address: what the address alone says. */
function useFirstView(): PhoneView {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const root = rootTab(path);
  return { tab: root ?? homeTab(path), depth: root ? 1 : 2, isRoot: !!root };
}

/** The page's own scroll: the big title, the blurred edges, and pull to refresh. */
function useLiveScroll(nav: PhoneFrame) {
  const { setScroller, edge, topBar, shown } = usePageScroll(nav.titleWords, nav.isRoot);
  const { refresh } = useRefresh(nav.pullAlso ?? undefined);
  const { setScroller: setPullScroller, setContent, setSpinner } = usePullToRefresh(refresh);
  const placeScroller = useCallback(
    (element: HTMLDivElement | null) => {
      setScroller(element);
      setPullScroller(element);
    },
    [setScroller, setPullScroller],
  );
  return { edge, topBar, shown, placeScroller, setContent, setSpinner };
}

/**
 * The live page: the top bar, the page that scrolls under it and under the bar at the bottom,
 * with blurred edges at both ends (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/`). On a tab's
 * first page the big title sits in the same row as the top buttons.
 */
function LivePage({
  nav,
  core,
  children,
}: {
  nav: PhoneFrame;
  core: PhoneStackCore;
  children: ReactNode;
}) {
  const { isRoot, swipe, setTitleTarget } = nav;
  const { edge, topBar, shown, placeScroller, setContent, setSpinner } = useLiveScroll(nav);
  const swipeOn = useSwipeBack(swipe);
  const place = useCallback(
    (element: HTMLDivElement | null) => {
      core.setPage(element);
      swipeOn(element);
    },
    [core, swipeOn],
  );
  return (
    <div ref={place} data-phone-page="" className="absolute inset-0 overflow-hidden bg-background">
      <div
        ref={edge}
        aria-hidden="true"
        className="edge-top absolute inset-x-0 top-0 z-10 h-[calc(env(safe-area-inset-top)+66px)] opacity-0"
      />
      <div
        aria-hidden="true"
        className="edge-bottom absolute inset-x-0 bottom-0 z-10 h-[calc(env(safe-area-inset-bottom)+96px)]"
      />
      <PhoneTopBar ref={topBar} nav={nav} shown={shown} />
      <div
        ref={setSpinner}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 z-0 flex justify-center opacity-0',
          isRoot
            ? 'top-[calc(env(safe-area-inset-top)+4px)]'
            : 'top-[calc(env(safe-area-inset-top)+52px)]',
        )}
      >
        <Spinner className="size-5 text-text-tertiary" />
      </div>
      <div
        ref={placeScroller}
        data-phone-scroller=""
        className={cn(
          'absolute inset-0 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-[calc(env(safe-area-inset-bottom)+112px)] [scrollbar-width:none]',
          isRoot
            ? 'pt-[calc(env(safe-area-inset-top)+4px)]'
            : 'pt-[calc(env(safe-area-inset-top)+52px)]',
        )}
      >
        <div ref={setContent}>
          {isRoot && <div ref={setTitleTarget} />}
          <OfflineLine />
          <OwnerMessages />
          <main>{children}</main>
        </div>
      </div>
      <div data-phone-shade="" aria-hidden="true" className={SHADE_CLASS} />
    </div>
  );
}

/** iPhones show a pressed look (`:active`) only once the page listens to touches. */
function usePressedLook() {
  useEffect(() => {
    const touch = () => undefined;
    document.addEventListener('touchstart', touch, { passive: true });
    return () => document.removeEventListener('touchstart', touch);
  }, []);
}

/** A layer for the still copy of a page: under the live one, or over it while it slides away. */
function CopyLayer({
  place,
  over = false,
}: {
  place: (element: HTMLDivElement | null) => void;
  over?: boolean;
}) {
  return (
    <div
      ref={place}
      hidden
      inert
      aria-hidden="true"
      className={over ? 'pointer-events-none absolute inset-0 z-40' : 'absolute inset-0'}
    />
  );
}

/** Search on the tab bar: the page's own search, else Mails, which opens its search on arrival. */
function useSearchCircle(openTab: (tab: 'mails') => void) {
  const [open, setOpen] = useState<(() => void) | null>(null);
  const [wanted, setWanted] = useState(false);
  const setSearch = useCallback((next: (() => void) | null) => setOpen(() => next), []);
  if (open && wanted) {
    setWanted(false);
    queueMicrotask(open);
  }
  const onSearch = useCallback(() => {
    if (open) return open();
    setWanted(true);
    openTab('mails');
  }, [open, openTab]);
  return { setSearch, onSearch };
}

/** The frame's state and parts, for the pages and the bars. */
function usePhoneFrame(view: PhoneView | null, core: PhoneStackCore) {
  const first = useFirstView();
  const actionsPlace = useBreadcrumbSlot()?.setActionsTarget;
  const [titleWords, setBigTitle] = useState<string | null>(null);
  const [barTarget, setBarTarget] = useState<HTMLElement | null>(null);
  const [titleTarget, setTitleTarget] = useState<HTMLElement | null>(null);
  const [pullAlso, setPullAlsoState] = useState<(() => unknown) | null>(null);
  const setPullAlso = useCallback(
    (also: (() => unknown) | null) => setPullAlsoState(() => also),
    [],
  );
  const { setSearch, onSearch } = useSearchCircle(core.openTab);
  const shown = view ?? first;
  const nav = useMemo<PhoneFrame>(
    () => ({
      ...shown,
      back: core.back,
      openTab: core.openTab,
      barTarget,
      setBarTarget,
      titleTarget,
      setTitleTarget,
      setBigTitle,
      setSearch,
      setPullAlso,
      pullAlso,
      titleWords,
      actionsPlace,
      swipe: core,
    }),
    [
      shown,
      core,
      barTarget,
      titleTarget,
      titleWords,
      actionsPlace,
      setSearch,
      setPullAlso,
      pullAlso,
    ],
  );
  return { nav, onSearch };
}

/** What the bottom bar becomes while a page slides back, before the address changes. */
function useBarHint(core: PhoneStackCore, view: PhoneView | null) {
  const [hint, setHint] = useState<BarMode | null>(null);
  const [seen, setSeen] = useState(view);
  if (seen !== view) {
    setSeen(view);
    setHint(null);
  }
  useEffect(() => core.onBarHint(setHint), [core]);
  return hint;
}

/**
 * The signed-in app on phones (owner, 13 Nov 2026; Linear iOS look 18 Nov 2026, mock
 * `PHONE-LINEAR-mock/`): one page at a time with glass buttons floating over it and a big title,
 * one glass bar at the bottom that is the tab bar on a tab's first page and the page's bottom bar
 * on a detail page, pages that slide in and swipe back, tabs that cross-fade, and a page that is
 * pushed back behind a tall sheet.
 */
export function PhoneShell({ children }: { children: ReactNode }) {
  const { view, core } = usePhoneStack();
  const { nav, onSearch } = usePhoneFrame(view, core);
  const hint = useBarHint(core, view);
  usePressedLook();
  useFingerMenus();
  return (
    <PhoneNavContext.Provider value={nav}>
      <Drawer.Provider>
        <Drawer.IndentBackground className="fixed inset-0 bg-black" />
        <Drawer.Indent className="phone-stage phone-type fixed inset-0 overflow-hidden bg-background font-sans text-text-primary [-webkit-tap-highlight-color:transparent] [&_a]:[-webkit-touch-callout:none]">
          <CopyLayer place={core.setUnder} />
          <LivePage nav={nav} core={core}>
            {children}
          </LivePage>
          <CopyLayer place={core.setOver} over />
          <BarHost nav={nav} hint={hint} onSearch={onSearch} />
          <InstallCard phone />
        </Drawer.Indent>
      </Drawer.Provider>
    </PhoneNavContext.Provider>
  );
}
