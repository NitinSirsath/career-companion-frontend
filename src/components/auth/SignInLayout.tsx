import { useLayoutEffect, type ReactNode } from 'react';
import { PRIVACY_POLICY_URL } from '../../lib/productPage';
import { usePictureStep } from '../../lib/signInPicture';
import { DevModeBanner } from '../devMode/DevModeBanner';
import { Logo, Wordmark } from '../layout/Logo';
import { useTheme } from '../ThemeProvider';
import { SignInPicture } from './SignInPicture';

/** The half sun of the NorthList mark, large and faint in the panel's corner. */
const HALF_SUN = 'M2 16A14 14 0 0 1 30 16Z';
const HEADLINE = 'Your job search, sorted from your Gmail.';

/**
 * Tablets (owner, 7 Nov 2026): a short blue band on top with the name, the headline and a small
 * picture of the Mails list that runs past the band's right and bottom edges.
 */
function TabletBand({ step }: { step: number }) {
  return (
    <div
      aria-hidden="true"
      className="relative hidden h-[292px] shrink-0 overflow-hidden rounded-2xl bg-[#0f62fe] px-5 pt-5 text-white md:block lg:hidden"
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
 * Phones (owner, 15 Nov 2026, approved mock `SIGNIN-PHONE-mock/`): the app icon and the headline,
 * calm in the middle of the screen; the sign-in buttons sit below them, at the bottom.
 */
function PhoneHero() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-2 text-center md:hidden">
      <div
        aria-hidden="true"
        className="flex size-[84px] items-center justify-center rounded-[20px] bg-[#0f62fe] shadow-[0_6px_18px_rgb(15_98_254/0.22)] max-[389px]:size-[72px] max-[389px]:rounded-[17px]"
      >
        <Logo size={58} className="fill-white max-[389px]:size-[50px]" />
      </div>
      <p className="mt-[26px] max-w-[310px] text-[29px] leading-[35px] font-bold tracking-[-0.035em] max-[389px]:mt-[22px] max-[389px]:text-[26px] max-[389px]:leading-8">
        {HEADLINE}
      </p>
    </div>
  );
}

/**
 * The sign-in pages (owner, 3 Nov 2026): on laptops the form on the left and a blue panel with the
 * product page headline and a picture of the Mails list on the right; tablets put a short blue band
 * above the form (7 Nov 2026); phones show one calm screen that fits without scrolling, clear of
 * the notch and the home bar (15 Nov 2026). Always light, like northlist.site; the app keeps each
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
    <div className="grid min-h-screen bg-background p-3 font-sans text-text-primary [color-scheme:light] max-md:flex max-md:min-h-dvh max-md:flex-col max-md:px-6 max-md:pt-[env(safe-area-inset-top)] max-md:pb-[calc(env(safe-area-inset-bottom)+14px)] lg:h-screen lg:min-h-[640px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-3">
      <div className="flex min-w-0 flex-col max-md:flex-1 lg:overflow-y-auto lg:px-[52px] lg:py-7">
        <TabletBand step={step} />
        <PhoneHero />
        <header className="flex items-center justify-between gap-4 max-md:justify-center lg:min-h-8">
          <Wordmark className="hidden lg:inline-block" />
          <DevModeBanner />
        </header>
        <main className="flex animate-fade-in justify-center px-2 py-7 max-md:px-0 max-md:pt-3 max-md:pb-0 lg:flex-1 lg:items-center lg:px-0 lg:py-12">
          <div className="w-full max-w-[380px]">{children}</div>
        </main>
        {/* Phones: one short centred line under the buttons. */}
        <footer className="mx-auto flex w-full max-w-[380px] flex-col gap-1 px-2 pb-1 text-xs text-text-tertiary max-md:mt-[18px] max-md:flex-row max-md:flex-wrap max-md:justify-center max-md:gap-x-1 max-md:px-0 max-md:pb-0 md:flex-row md:justify-between md:gap-4 lg:mx-0 lg:max-w-none lg:px-0 lg:pb-0">
          <span>
            Free while in beta<span className="max-md:hidden">. No card needed.</span>
          </span>
          <span aria-hidden="true" className="md:hidden">
            ·
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
