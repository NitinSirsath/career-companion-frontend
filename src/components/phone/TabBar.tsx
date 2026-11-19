import { useLayoutEffect, useRef } from 'react';
import {
  FileTextIcon,
  LayoutGridIcon,
  MailIcon,
  SearchIcon,
  SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { useDashboard } from '../../api/dashboard';
import { DEFAULT_PERIOD } from '../../lib/dashboard';
import { PHONE_TABS, TAB_ROOT, type PhoneTab } from '../../lib/phoneStack';
import { animateSpring, prefersReducedMotion, spring } from '../../lib/spring';
import { cn } from '../../lib/utils';
import { PRESS } from './GlassButton';
import type { PhoneNav } from './phoneNav';

/** Icon-only tabs; the words stay for screen readers. */
const TABS: Record<PhoneTab, { label: string; Icon: LucideIcon }> = {
  dashboard: { label: 'Today', Icon: LayoutGridIcon },
  mails: { label: 'Mails', Icon: MailIcon },
  applications: { label: 'Applications', Icon: FileTextIcon },
  settings: { label: 'Settings', Icon: SettingsIcon },
};

/** The open tab is a quarter wider than the others (mock: `.tabs div.on { flex: 1.25 }`). */
const ON_GROW = 1.25;
const UNITS = PHONE_TABS.length - 1 + ON_GROW;
/** The pill slides to the tapped tab in ~200ms with a little spring (Motion rules). */
const PILL_SPRING = spring(0.3, 0.74);

/** The lighter pill under the open tab: `--tab-at` is where it is, in tabs from the left. */
function usePill(index: number) {
  const pill = useRef<HTMLSpanElement>(null);
  const shown = useRef(index);
  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = index;
    const element = pill.current;
    if (!element || from === index) return;
    const place = (x: number) => element.style.setProperty('--tab-at', String(x));
    if (prefersReducedMotion()) return place(index);
    void animateSpring({ from, to: index }, PILL_SPRING, place);
  }, [index]);
  return pill;
}

/** True while there are job mails the user has not opened yet: the blue dot on Mails. */
function useNewMails() {
  const count = useDashboard(DEFAULT_PERIOD).data?.now.newJobMails.count ?? 0;
  return count > 0;
}

/**
 * The phone tab bar (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 1): a shorter glass
 * capsule of icons only, the open tab in a lighter, wider pill with a blue icon, a blue dot on
 * Mails while there are new mails, and Search as its own glass circle. Tapping the open tab goes
 * back to its first page, then to the top. The glass swells a little under the finger.
 * `hidden`: a detail page is open; the icons blur away while the glass becomes its bottom bar.
 */
export function TabBar({
  nav,
  hidden,
  onSearch,
}: {
  nav: PhoneNav;
  hidden: boolean;
  onSearch: () => void;
}) {
  const index = PHONE_TABS.indexOf(nav.tab);
  const pill = usePill(index);
  const newMails = useNewMails();
  return (
    <div
      aria-hidden={hidden || undefined}
      inert={hidden}
      className={cn(
        'motion-fade absolute inset-0 flex items-center gap-2 transition-[opacity,filter] duration-250 ease-morph',
        hidden && 'pointer-events-none opacity-0 blur-[6px]',
      )}
    >
      <nav aria-label="Main" className="relative flex h-full flex-1 items-center px-1">
        <span
          ref={pill}
          aria-hidden="true"
          className="absolute inset-y-1 rounded-full bg-[var(--glass-on)] shadow-[0_1px_4px_rgb(0_0_0/0.12)]"
          style={{
            ['--tab-at' as string]: index,
            left: `calc(4px + var(--tab-at) * (100% - 8px) / ${UNITS})`,
            width: `calc((100% - 8px) * ${ON_GROW} / ${UNITS})`,
          }}
        />
        {PHONE_TABS.map((tab) => {
          const { label, Icon } = TABS[tab];
          const on = tab === nav.tab;
          return (
            <a
              key={tab}
              href={TAB_ROOT[tab]}
              aria-current={on ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                nav.openTab(tab);
              }}
              style={{ flexGrow: on ? ON_GROW : 1 }}
              className={cn(
                'relative z-10 flex h-[50px] basis-0 items-center justify-center rounded-full transition-[flex-grow,color,opacity] duration-200 ease-morph select-none',
                on ? 'text-accent' : 'text-text-primary opacity-85',
              )}
            >
              <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
              <span className="sr-only">{label}</span>
              {tab === 'mails' && newMails && (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute top-[9px] right-[calc(50%-18px)] size-[9px] rounded-full border-[1.5px] border-background bg-accent"
                  />
                  <span className="sr-only">, new mails</span>
                </>
              )}
            </a>
          );
        })}
      </nav>
      <button
        type="button"
        aria-label="Search"
        onClick={onSearch}
        className={cn(
          'glass flex size-[58px] shrink-0 cursor-pointer items-center justify-center rounded-full text-text-primary outline-none focus-visible:outline-2 focus-visible:outline-border-focus',
          PRESS,
        )}
      >
        <SearchIcon size={24} strokeWidth={1.9} aria-hidden="true" />
      </button>
    </div>
  );
}
