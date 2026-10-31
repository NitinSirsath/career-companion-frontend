import { CONTACT_EMAIL, SIGN_IN_URL } from '../../lib/productPage';
import { Wordmark } from '../layout/Logo';
import { GooglePermissions } from './GooglePermissions';
import { HowItWorks } from './HowItWorks';
import { ProductHero } from './ProductHero';
import { PrivacyLink } from './ProductParts';
import { WhatYouCanDo } from './WhatYouCanDo';

/** The top bar: the name, and "Sign in" at the right, as on the sign-in page. */
function ProductBar() {
  return (
    <header className="flex h-14 items-stretch border-b border-border-subtle">
      <span className="flex min-w-0 flex-1 items-center">
        <Wordmark className="px-5" />
      </span>
      <a
        href={SIGN_IN_URL}
        className="flex items-center border-l border-border-subtle px-5 text-sm text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover"
      >
        Sign in
      </a>
    </header>
  );
}

function ProductFooter() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto flex w-full max-w-[1184px] flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-6 pb-8 md:px-12">
        <Wordmark size={16} />
        <span className="text-xs text-text-secondary">© {new Date().getFullYear()} NorthList</span>
        <span className="flex flex-wrap gap-x-6 gap-y-2 md:ml-auto">
          <PrivacyLink label="Privacy policy" className="text-xs" />
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-xs text-link hover:text-link-hover hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </span>
      </div>
    </footer>
  );
}

/**
 * The product site's one page on northlist.site (owner, 31 Oct 2026): what NorthList does, why it
 * asks for Gmail, and the privacy policy. Google's OAuth branding names it as the app's home page,
 * so it must never need sign-in. Its tab title is in `site/index.html`.
 */
export function ProductPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-text-primary">
      <ProductBar />
      <main>
        <ProductHero />
        <HowItWorks />
        <WhatYouCanDo />
        <GooglePermissions />
      </main>
      <ProductFooter />
    </div>
  );
}
