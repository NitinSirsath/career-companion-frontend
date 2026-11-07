import { useLayoutEffect, type ReactNode } from 'react';
import { PRIVACY_POLICY_URL } from '../../lib/productPage';
import { usePictureStep } from '../../lib/signInPicture';
import { DevModeBanner } from '../devMode/DevModeBanner';
import { Wordmark } from '../layout/Logo';
import { useTheme } from '../ThemeProvider';
import { SignInPicture } from './SignInPicture';

/** The half sun of the NorthList mark, large and faint in the panel's corner. */
const HALF_SUN = 'M2 16A14 0 0 1 30 16Z';
const HEADLINE = 'Your job search, sorted from your Gmail.';

/**
 * Tablets and phones (owner, 7 Nov 2026): a short blue band on top with the name, the headline and
 * a small picture of the Mails list that runs past the band's right and bottom edges.
 */
function PhoneBand({ step }: { step: number }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-[292px] shrink-0 overflow-hidden rounded-2xl bg-[#0f62fe] px-5 pt-5 text-white lg:hidden"
    >
      <svg
        viewBox="2 2 28 28"
        className="absolute -top-[50px] -right-[90px] size-[240px] fill-white/[0.07]"
      >
        <path d={HALF_SUN} />
      </svg>
      <Wordmark size={20} className="relative text-white [&_svg]:fill-white" />
      <p className="relative mt-[18px] max-w-[300px] text-2xl leading-[29px] font-semibold tracking-[-0.03em]">
        {HEADLINE}
      </p>
      <div className="relative mt-5 -mr-9">
        <SignInPicture step={step} compact />
      </div>
    </div>
  );
}

/**
 * The sign-in pages (owner, 3 Nov 2026): on laptops the form on the left and a blue panel with the
 * product page headline and a picture of the Mails list on the right; tablets and phones put a short
 * blue band above the form (7 Nov 2026). Always light, like northlist.site; the app keeps each
 * person's theme after sign-in.
 */
export function SignInLayout({ children }: { children: ReactNode }) {
  const { setLightOnly } = useTheme();
  const step = usePictureStep();
  // The whole page and the window bar are light while this page is open; the saved theme stays.
  useLayoutEffect(() => {
    setLightOnly(true);
    return () => setLightOnly(false);
  }, [setLightOnly]);

  return (
    <div className="grid min-h-screen bg-background p-3 font-sans text-text-primary [color-scheme:light] lg:h-screen lg:min-h-[640px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-3">
      <div className="flex min-w-0 flex-col lg:overflow-y-auto lg:px-[52px] lg:py-7">
        <PhoneBand step={step} />
        <header className="flex items-center justify-between gap-4 lg:min-h-8">
          <Wordmark className="hidden lg:inline-block" />
          <DevModeBanner />
        </header>
        <main className="flex animate-fade-in justify-center px-2 py-7 lg:flex-1 lg:items-center lg:px-0 lg:py-12">
          <div className="w-full max-w-[380px]">{children}</div>
        </main>
        <footer className="mx-auto flex w-full max-w-[380px] flex-col gap-1 px-2 pb-1 text-xs text-text-tertiary md:flex-row md:justify-between md:gap-4 lg:mx-0 lg:max-w-none lg:px-0 lg:pb-0">
          <span>Free while in beta. No card needed.</span>
          <span>
            <a href={PRIVACY_POLICY_URL} className="text-text-secondary hover:underline">
              Privacy
            </a>
            {' · '}
            <a href="https://northlist.site" className="text-text-secondary hover:underline">
              northlist.site
            </a>
          </span>
        </footer>
      </div>
      <aside
        aria-hidden="true"
        className="relative hidden min-w-0 flex-col overflow-hidden rounded-2xl bg-[#0f62fe] px-14 pt-16 text-white lg:flex"
      >
        <svg
          viewBox="2 2 28 28"
          className="absolute -top-[70px] -right-[140px] size-[400px] fill-white/[0.07]"
        >
          <path d={HALF_SUN} />
        </svg>
        <p className="relative max-w-[520px] text-[42px] leading-[48px] font-semibold tracking-[-0.035em]">
          {HEADLINE}
        </p>
        <p className="relative mt-4 max-w-[480px] text-base text-white/80">
          NorthList reads the job mails in your Gmail, finds what each one asks of you, and keeps
          every application up to date.
        </p>
        <div className="relative mt-12 -mr-[260px] min-h-0 flex-1">
          <SignInPicture step={step} />
        </div>
      </aside>
    </div>
  );
}
