import { useLayoutEffect, useRef, useState } from 'react';
import {
  FileTextIcon,
  LayoutGridIcon,
  MailIcon,
  SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { PHONE_TABS, TAB_ROOT, type PhoneTab } from '../../lib/phoneStack';
import { animateSpring, SNAP_SPRING } from '../../lib/spring';
import { cn } from '../../lib/utils';
import type { PhoneNav } from './phoneNav';
import { DashboardFilled, FileFilled, MailFilled, SettingsFilled } from './tabIcons';

const TABS: Record<PhoneTab, { label: string; Icon: LucideIcon; On: typeof MailFilled }> = {
  dashboard: { label: 'Dashboard', Icon: LayoutGridIcon, On: DashboardFilled },
  mails: { label: 'Mails', Icon: MailIcon, On: MailFilled },
  applications: { label: 'Applications', Icon: FileTextIcon, On: FileFilled },
  settings: { label: 'Settings', Icon: SettingsIcon, On: SettingsFilled },
};

/** The soft highlight follows the chosen tab with a spring. */
function usePill(index: number) {
  const pill = useRef<HTMLSpanElement>(null);
  const shown = useRef(index);
  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = index;
    const element = pill.current;
    if (!element || from === index) return;
    void animateSpring({ from, to: index }, SNAP_SPRING, (x) => {
      element.style.transform = `translateX(${x * 100}%)`;
    });
  }, [index]);
  return pill;
}

/**
 * The floating glass tab bar on phones (owner, 13 Nov 2026): Dashboard, Mails, Applications and
 * Settings. Line icons when off, filled and blue when on. Tapping the open tab goes back to its
 * first page, then to the top.
 */
export function TabBar({ nav }: { nav: PhoneNav }) {
  const index = PHONE_TABS.indexOf(nav.tab);
  const pill = usePill(index);
  const [bounce, setBounce] = useState<{ tab: PhoneTab; n: number } | null>(null);
  return (
    <nav
      aria-label="Main"
      className="glass absolute inset-x-[18px] bottom-[max(calc(env(safe-area-inset-bottom)-12px),10px)] z-20 grid h-[62px] grid-cols-4 rounded-full p-1"
    >
      <span
        ref={pill}
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc((100%-8px)/4)] rounded-full bg-[var(--glass-pill)]"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {PHONE_TABS.map((tab) => {
        const { label, Icon, On } = TABS[tab];
        const on = tab === nav.tab;
        return (
          <a
            key={tab}
            href={TAB_ROOT[tab]}
            aria-current={on ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              setBounce((last) => ({ tab, n: (last?.n ?? 0) + 1 }));
              nav.openTab(tab);
            }}
            className={cn(
              'relative z-10 flex flex-col items-center justify-center gap-px rounded-full text-[10.5px] leading-[13px] font-semibold transition-colors duration-300 select-none active:bg-[var(--glass-pill)] active:duration-0',
              on ? 'text-link' : 'text-text-primary',
            )}
          >
            <span
              key={bounce?.tab === tab ? bounce.n : 0}
              className={cn('flex', bounce?.tab === tab && 'motion-safe:animate-tab-bounce')}
            >
              {on ? <On size={26} /> : <Icon size={26} aria-hidden="true" />}
            </span>
            {label}
          </a>
        );
      })}
    </nav>
  );
}
