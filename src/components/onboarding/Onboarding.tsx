import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useAlertKey } from '../../api/alerts';
import { authKeys, finishOnboarding, saveOnboardingStep, type User } from '../../api/auth';
import { useInstall } from '../../lib/install';
import {
  markOnboardingFinished,
  nextStep,
  shownStep,
  stepsFor,
  type OnboardingStep,
} from '../../lib/onboarding';
import { transition } from '../../lib/viewTransition';
import { useAlertSwitch } from '../auth/useAlertSwitch';
import { useIsPhone } from '../layout/useIsPhone';
import { AIStep } from './AIStep';
import { AlertsStep, InstallStep, ThemeStep, TourStep, WelcomeStep } from './BasicSteps';
import { DoneStep, GmailStep } from './GmailSteps';
import { FlowContext, type Flow } from './flow';
import './onboarding.css';

/** Alerts can be shown here: the server has alert keys and the browser can show them. */
function useAlertsPossible(state: ReturnType<typeof useAlertSwitch>['state']) {
  const key = useAlertKey();
  if (key.isPending) return true;
  return !!key.data?.available && state !== 'unsupported';
}

/**
 * The browser can install the app here. Once the step was shown it stays, so installing (after
 * which the browser offers nothing) shows "Installed" instead of skipping ahead.
 */
function useInstallable() {
  const { kind } = useInstall();
  const [seen, setSeen] = useState(false);
  if (kind !== null && !seen) setSeen(true);
  return kind !== null || seen;
}

/**
 * The first run (owner, 22 Nov 2026): full screen, one step per screen, Back and Skip on each. It
 * opens at the step the user reached last time, and saves each new one. Finishing it, or leaving
 * from a step's link, ends it for good.
 */
export function Onboarding({ user }: { user: User }) {
  const phone = useIsPhone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const alerts = useAlertSwitch();
  const installable = useInstallable();
  const steps = stepsFor({ install: installable, alerts: useAlertsPossible(alerts.state) });
  const [asked, setAsked] = useState<OnboardingStep>(user.onboarding?.step ?? 'welcome');
  const step = shownStep(steps, asked);

  const move = (target: OnboardingStep, direction: 'forward' | 'backward') => {
    if (target === step) return;
    transition(() => setAsked(target), direction);
    // Only a reminder for next time: a lost save means starting this step again.
    saveOnboardingStep(target).catch(() => undefined);
  };
  const flow: Flow = {
    phone,
    step,
    steps,
    alerts,
    forward: () => move(nextStep(steps, step, 1), 'forward'),
    back: () => move(nextStep(steps, step, -1), 'backward'),
    goTo: (target) =>
      move(target, steps.indexOf(target) > steps.indexOf(step) ? 'forward' : 'backward'),
    leave: (to) => {
      markOnboardingFinished();
      finishOnboarding()
        .then((profile) => queryClient.setQueryData(authKeys.profile, profile))
        .catch(() => undefined);
      void navigate({ to });
    },
  };

  const screens: Record<OnboardingStep, React.ReactNode> = {
    welcome: <WelcomeStep />,
    gmail: <GmailStep />,
    install: <InstallStep />,
    alerts: <AlertsStep />,
    theme: <ThemeStep />,
    tour: <TourStep />,
    ai: <AIStep phone={phone} email={user.email} />,
    done: <DoneStep />,
  };
  return (
    <FlowContext.Provider value={flow}>
      <main className="ob-root" key={step}>
        {screens[step]}
      </main>
    </FlowContext.Provider>
  );
}
