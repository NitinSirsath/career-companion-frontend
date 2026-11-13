import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { useRouterState } from '@tanstack/react-router';
import { homeTab, rootTab } from '../../lib/phoneStack';
import { useBreadcrumbSlot } from '../layout/breadcrumbSlot';
import { OfflineLine } from '../layout/OfflinePage';
import { SHADE_CLASS } from './pageMotion';
import { PhoneNavContext, type PhoneFrame } from './phoneNav';
import { PhoneTopBar } from './PhoneTopBar';
import { TabBar } from './TabBar';
import { usePageScroll } from './usePageScroll';
import { usePhoneStack, type PhoneStackCore, type PhoneView } from './usePhoneStack';
import { useSwipeBack } from './useSwipeBack';

/** Before the stack has read the first address: what the address alone says. */
function useFirstView(): PhoneView {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const root = rootTab(path);
  return { tab: root ?? homeTab(path), depth: root ? 1 : 2, isRoot: !!root };
}

/** The live page: the top bar, the page that scrolls, and the tab bar or the page's action bar. */
function LivePage({
  nav,
  core,
  children,
}: {
  nav: PhoneFrame;
  core: PhoneStackCore;
  children: ReactNode;
}) {
  const { isRoot, setBarTarget, titleWords, swipe } = nav;
  const { scroller, edge, topBar, shown } = usePageScroll(titleWords);
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
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[calc(env(safe-area-inset-top)+64px)] bg-linear-to-b from-background/90 from-30% to-transparent opacity-0 backdrop-blur-[8px] [mask-image:linear-gradient(to_bottom,#000_50%,transparent)]"
      />
      <PhoneTopBar ref={topBar} nav={nav} shown={shown} />
      <div
        ref={scroller}
        data-phone-scroller=""
        className="absolute inset-0 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pt-[calc(env(safe-area-inset-top)+52px)] pb-[calc(env(safe-area-inset-bottom)+112px)] [scrollbar-width:none]"
      >
        <OfflineLine />
        <main>{children}</main>
      </div>
      {isRoot ? <TabBar nav={nav} /> : <div ref={setBarTarget} className="contents" />}
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

/** The frame's state and parts, for the pages and the bars. */
function usePhoneFrame(view: PhoneView | null, core: PhoneStackCore): PhoneFrame {
  const first = useFirstView();
  const actionsPlace = useBreadcrumbSlot()?.setActionsTarget;
  const [titleWords, setBigTitle] = useState<string | null>(null);
  const [barTarget, setBarTarget] = useState<HTMLElement | null>(null);
  const shown = view ?? first;
  return useMemo(
    () => ({
      ...shown,
      back: core.back,
      openTab: core.openTab,
      barTarget,
      setBarTarget,
      setBigTitle,
      titleWords,
      actionsPlace,
      swipe: core,
    }),
    [shown, core, barTarget, titleWords, actionsPlace],
  );
}

/**
 * The signed-in app on phones (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`): one page at a
 * time with frosted buttons over it and a big title, a floating tab bar on each tab's first page,
 * pages that slide in and swipe back, and a page that shrinks a little behind an open sheet.
 */
export function PhoneShell({ children }: { children: ReactNode }) {
  const { view, core } = usePhoneStack();
  const nav = usePhoneFrame(view, core);
  usePressedLook();
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
        </Drawer.Indent>
      </Drawer.Provider>
    </PhoneNavContext.Provider>
  );
}
