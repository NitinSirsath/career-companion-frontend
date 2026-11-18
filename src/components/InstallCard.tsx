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

/**
 * "Install NorthList" (owner, 18 Nov 2026, approved mock `INSTALL-PROMPT-mock/`): a card that waits
 * for an answer, bottom right on laptops and above the tab bar on phones. Chrome, Edge and Android
 * get Not now and Install; iPhone and iPad get the Share steps and Got it. It shows on the first
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
  return (
    <aside
      aria-label="Install NorthList"
      className={cn(
        'fixed z-40 flex animate-page-in items-start gap-3.5 rounded-[20px] border border-border-subtle glass-menu p-4 text-text-primary shadow-popup',
        phone
          ? 'inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+100px)] text-[15px]'
          : 'right-6 bottom-6 w-96 text-sm',
      )}
    >
      <img
        src="/icon-192.png"
        alt=""
        width={44}
        height={44}
        className="size-11 shrink-0 rounded-[11px]"
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
            `Open it from your ${phone ? 'home screen' : 'dock or home screen'}, in its own window.`
          )}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          {ios ? (
            <Button size={phone ? 'default' : 'sm'} onClick={later}>
              Got it
            </Button>
          ) : (
            <>
              <Button size={phone ? 'default' : 'sm'} variant="secondary" onClick={later}>
                Not now
              </Button>
              <Button size={phone ? 'default' : 'sm'} onClick={() => void installNow()}>
                Install
              </Button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
