import { Band, BandTitle } from './ProductParts';
import { ReadingPreview } from './ReadingPreview';

const STEPS = [
  {
    title: 'Connect Gmail',
    text: [
      'Choose how far back to look, from 1 to 30 days. After that, NorthList checks for new mail about once an hour.',
    ],
  },
  {
    title: 'AI reads your job mails',
    text: [
      'It tells job mails from other mail. In each job mail it finds the company, the role, and what the mail asks you to do and by when.',
      // Owner, 31 Oct 2026: say that no key is needed, with no model or vendor names.
      'No AI key needed: NorthList includes free AI. You can also use your own key.',
    ],
  },
  {
    title: 'You see what to do next',
    text: [
      'Each mail shows its next step. Each application shows where it stands: Applied, Interview, Offer, and so on.',
    ],
  },
];

/** The three steps from signing in to a sorted list, next to the drawn AI reading status. */
export function HowItWorks() {
  return (
    <Band
      labelledBy="how-it-works"
      className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16"
    >
      <div>
        <BandTitle
          id="how-it-works"
          title="How it works"
          lead="Three steps. You sign in once, and NorthList keeps up from then on."
        />
        <ol className="m-0 list-none p-0">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="grid grid-cols-[40px_minmax(0,1fr)] border-t border-border-subtle py-5 last:border-b"
            >
              <span className="font-mono text-sm leading-[22px] text-text-tertiary">
                {index + 1}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-base leading-[22px] font-semibold">{step.title}</h3>
                {step.text.map((line) => (
                  <p key={line} className="text-text-secondary">
                    {line}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <ReadingPreview />
    </Band>
  );
}
