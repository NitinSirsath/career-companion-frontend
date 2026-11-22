import { createContext, useContext } from 'react';
import type { OnboardingStep } from '../../lib/onboarding';
import type { useAlertSwitch } from '../auth/useAlertSwitch';

/** What every step needs from the first run around it. */
export interface Flow {
  phone: boolean;
  step: OnboardingStep;
  steps: readonly OnboardingStep[];
  forward: () => void;
  back: () => void;
  /** Goes straight to a step, sliding the right way. */
  goTo: (step: OnboardingStep) => void;
  /** Ends the first run and opens `to` (the Dashboard, or a page a step links to). */
  leave: (to: string) => void;
  /** Alerts on this device, read once for the whole run. */
  alerts: ReturnType<typeof useAlertSwitch>;
}

export const FlowContext = createContext<Flow | null>(null);

export function useFlow(): Flow {
  const flow = useContext(FlowContext);
  if (!flow) throw new Error('useFlow must be used inside the first run');
  return flow;
}
