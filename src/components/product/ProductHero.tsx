import { ArrowRight } from '@carbon/icons-react';
import { MailsPreview } from './MailsPreview';
import { Band, PrivacyLink, SIGN_IN_URL } from './ProductParts';

/** What NorthList is, in one line; the one blue button; and the drawn Mails list. */
export function ProductHero() {
  return (
    <Band labelledBy="product-title">
      <h1
        id="product-title"
        className="max-w-[760px] text-[32px] leading-10 font-normal tracking-[-0.02em] md:text-5xl md:leading-14"
      >
        Your job search, sorted from your Gmail.
      </h1>
      <p className="mt-4 max-w-[620px] text-base text-text-secondary md:text-lg">
        NorthList reads the job mails in your Gmail, finds what each one asks of you, and keeps your
        applications in one place.
      </p>
      <div className="mt-8 flex flex-col items-stretch gap-4 md:flex-row md:items-center md:gap-6">
        <a
          href={SIGN_IN_URL}
          className="inline-flex h-12 items-center justify-between gap-12 bg-action-primary px-4 text-sm font-medium text-text-inverse transition-colors duration-70 ease-standard hover:bg-action-primary-hover"
        >
          Sign in
          <ArrowRight size={16} aria-hidden="true" />
        </a>
        <PrivacyLink />
      </div>
      <p className="mt-4 text-xs text-text-secondary">
        <span className="font-semibold text-text-primary">New here?</span> Sign in with Google. That
        creates your account.
      </p>
      <MailsPreview />
    </Band>
  );
}
