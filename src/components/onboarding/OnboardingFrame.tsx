import { useEffect, useRef, type ReactNode } from 'react';
import { middleSteps, stepCount } from '../../lib/onboarding';
import { Wordmark } from '../layout/Logo';
import { Button } from '../ui/button';
import { useFlow } from './flow';

export interface MainAction {
  label: string;
  /** Default: the next step. */
  onClick?: () => void;
  disabled?: boolean;
}

interface FrameProps {
  title: string;
  sub: string;
  children?: ReactNode;
  /** The big moving picture on laptops. */
  picture: ReactNode;
  /** The phone app in a small iPhone, on phones. */
  phonePicture: ReactNode;
  main?: MainAction;
  /** Shows Skip, which goes to the next step. */
  skip?: boolean;
  /** Runs before Skip moves on: the step's own "not now". */
  onSkip?: () => void;
}

/** Faint circles behind the laptop picture. */
function Rings() {
  const radii = Array.from({ length: 13 }, (_, i) => 60 + i * 70);
  return (
    <svg className="ob-rings" aria-hidden="true">
      {radii.map((r) => (
        <circle
          key={r}
          cx="50%"
          cy="50%"
          r={r}
          fill="none"
          stroke="var(--ob-art)"
          strokeOpacity={0.06}
        />
      ))}
    </svg>
  );
}

const segmentLook = (i: number, at: number) => {
  if (i < at) return 'done';
  return i === at ? 'now' : undefined;
};

/** The thin line of steps between Welcome and Done. */
function Progress() {
  const { step, steps } = useFlow();
  const middle = middleSteps(steps);
  const at = middle.indexOf(step);
  return (
    <div className="ob-prog" aria-hidden="true">
      {middle.map((s, i) => (
        <i key={s} className={segmentLook(i, at)} />
      ))}
    </div>
  );
}

function Footer({
  main,
  skip,
  onSkip,
}: {
  main?: MainAction;
  skip?: boolean;
  onSkip?: () => void;
}) {
  const { step, forward, back, phone } = useFlow();
  return (
    <div className="ob-foot">
      {step !== 'welcome' ? (
        <Button variant="ghost" size="lg" onClick={back}>
          Back
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-1 justify-end gap-3">
        {skip && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              onSkip?.();
              forward();
            }}
          >
            Skip
          </Button>
        )}
        <Button
          size="lg"
          className={phone ? 'ob-main px-6' : 'px-6'}
          disabled={main?.disabled}
          onClick={main?.onClick ?? forward}
        >
          {main?.label ?? 'Continue'}
        </Button>
      </div>
    </div>
  );
}

/**
 * One step's screen. Laptop: words left, the moving picture right. Phone: the phone app in a small
 * iPhone on top, half shown, the words below (as on the product site's Mobile page).
 */
export function Frame({
  title,
  sub,
  children,
  picture,
  phonePicture,
  main,
  skip,
  onSkip,
}: FrameProps) {
  const { phone, step, steps } = useFlow();
  const heading = useRef<HTMLHeadingElement>(null);
  // A screen reader starts each new step at its title.
  useEffect(() => heading.current?.focus({ preventScroll: true }), [step]);
  const count = stepCount(steps, step);
  const words = (
    <div className="ob-step">
      {count && !phone && (
        <div className="ob-kicker">
          Step {count.number} of {count.of} · {count.name}
        </div>
      )}
      <h1 ref={heading} tabIndex={-1} className="ob-title outline-none">
        {title}
      </h1>
      <p className="ob-sub">{sub}</p>
      <div className="ob-body">
        <div key={step} className="ob-stagger">
          {children}
        </div>
      </div>
    </div>
  );
  if (phone)
    return (
      <div className="ob-phone">
        {count && <Progress />}
        <div className="ob-phstage" aria-hidden="true">
          {phonePicture}
        </div>
        {words}
        <Footer main={main} skip={skip} onSkip={onSkip} />
      </div>
    );
  return (
    <div className="ob-laptop">
      <div className="ob-left">
        <div className="ob-top">
          <Wordmark size={22} />
        </div>
        {count ? <Progress /> : <div className="ob-prog-space" />}
        {words}
        <Footer main={main} skip={skip} onSkip={onSkip} />
      </div>
      <div className="ob-right" aria-hidden="true">
        <Rings />
        <div className="ob-pic-slot">{picture}</div>
      </div>
    </div>
  );
}
