import { useEffect, useState } from 'react';
import { ShareIcon } from 'lucide-react';
import {
  cardAllowed,
  hideForNow,
  INSTALL_CARD_DELAY_MS,
  installNow,
  useInstall,
} from '../lib/install';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

/** True once the app has been open for 20 seconds. */
function useDelayPassed() {
  const [passed, setPassed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPassed(true), INSTALL_CARD_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return passed;
}

/** Comes up from the bottom like a sheet (~300 ms, a tiny settle); a fade with Reduce Motion. */
function slideUp(element: HTMLElement | null) {
  if (!element?.animate) return;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element.animate(
    still
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ transform: 'translateY(calc(100% + 120px))' }, { transform: 'none' }],
    { duration: still ? 200 : 300, easing: 'cubic-bezier(0.3, 1.18, 0.5, 1)' },
  );
}

/** A round pill button on the phone card: grey, or the accent pill for Install. */
function Pill({
  blue = false,
  onClick,
  children,
}: {
  blue?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 cursor-pointer rounded-full px-4 text-[14.5px] font-semibold transition-transform duration-450 ease-[cubic-bezier(0.25,1.6,0.4,1)] active:scale-105 active:duration-120',
        blue ? 'bg-accent text-on-accent' : 'bg-[var(--glass-pill)] text-text-primary',
      )}
    >
      {children}
    </button>
  );
}

/**
 * The phone card (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 12): glass, floating above
 * the tab bar. iPhone: the Share steps and Got it; Android: Not now and Install.
 */
function PhoneInstallCard({ ios, onLater }: { ios: boolean; onLater: () => void }) {
  return (
    <aside
      ref={slideUp}
      aria-label="Install NorthList"
      className="glass fixed inset-x-3.5 bottom-[calc(env(safe-area-inset-bottom)+86px)] z-40 grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-[26px] p-3.5 text-text-primary"
    >
      <img
        src="/icon-192.png"
        alt=""
        width={44}
        height={44}
        className="row-span-2 size-11 rounded-[11px]"
      />
      <p className="text-[15px] leading-5 font-semibold">
        {ios ? 'Add NorthList to your Home Screen' : 'Install NorthList'}
      </p>
      <p className="text-[13.5px] leading-[1.4] text-text-secondary">
        {ios ? (
          <>
            Tap Share{' '}
            <ShareIcon size={15} aria-label="Share" className="inline -translate-y-px text-link" />,
            then Add to Home Screen.
          </>
        ) : (
          'Open it from your home screen, in its own window.'
        )}
      </p>
      <div className="col-span-full mt-2 flex justify-end gap-2">
        {ios ? (
          <Pill onClick={onLater}>Got it</Pill>
        ) : (
          <>
            <Pill onClick={onLater}>Not now</Pill>
            <Pill blue onClick={() => void installNow()}>
              Install
            </Pill>
          </>
        )}
      </div>
    </aside>
  );
}

/**
 * "Install NorthList" (owner, 18 Nov 2026, approved mock `INSTALL-PROMPT-mock/`): a card that waits
 * for an answer, bottom right on laptops and above the tab bar on phones. Chrome, Edge and Android
 * get Not now and Install; iPhone and iPad get the Share steps and Got it. On phones it is a glass
 * card that slides up like a sheet (mock `PHONE-LINEAR-mock/` screen 12). It shows on the first
 * visit after 20 seconds, never inside the installed app, and after Not now not for 30 days. It sits
 * under dialogs and sheets.
 */
export function InstallCard({ phone = false }: { phone?: boolean }) {
  const { kind, forced } = useInstall();
  const passed = useDelayPassed();
  const [, redraw] = useState(0);
  if (!kind || !(forced || (passed && cardAllowed()))) return null;
  const ios = kind === 'ios';
  const later = () => {
    hideForNow();
    redraw((n) => n + 1);
  };
  if (phone) return <PhoneInstallCard ios={ios} onLater={later} />;
  return (
    <aside
      aria-label="Install NorthList"
      className="fixed right-[18px] bottom-[18px] z-40 flex w-[330px] animate-fade-in items-start gap-3 rounded-2xl glass-menu p-3.5 text-sm text-text-primary"
    >
      <img
        src="/icon-192.png"
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-[10px]"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {ios ? 'Add NorthList to your Home Screen' : 'Install NorthList'}
        </p>
        <p className="mt-0.5 leading-5 text-text-secondary">
          {ios ? (
            <>
              Tap Share{' '}
              <ShareIcon
                size={16}
                aria-label="Share"
                className="inline -translate-y-px text-link"
              />
              , then Add to Home Screen.
            </>
          ) : (
            'Open it from your dock or home screen, in its own window.'
          )}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          {ios ? (
            <Button size="sm" onClick={later}>
              Got it
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={later}>
                Not now
              </Button>
              <Button size="sm" onClick={() => void installNow()}>
                Install
              </Button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
