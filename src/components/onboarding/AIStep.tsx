import { useState } from 'react';
import { CheckIcon, MonitorIcon } from 'lucide-react';
import { AI_APPS, aiProgress, type AIAppKey } from '../../lib/onboarding';
import { cn } from '../../lib/utils';
import { buttonNote } from '../../lib/setupPrompt';
import { AIAppChoice, SetupCodeButton } from '../automation/ConnectAIApp';
import { useSetupCode } from '../automation/useSetupCode';
import { DoneLine } from './BasicSteps';
import { AIPicture } from './LaptopPictures';
import { Frame } from './OnboardingFrame';
import { PhoneSettings } from './PhonePictures';

function StepRow({
  index,
  progress,
  fresh,
  title,
  text,
  children,
}: {
  index: number;
  progress: number;
  fresh: boolean;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  const done = index < progress;
  const current = index === progress;
  return (
    <div className={cn('st', done && 'done', current && 'cur')}>
      <span className={cn('n', done && fresh && 'ob-burst')}>
        {done ? (
          <span className="ob-popin flex">
            <CheckIcon size={13} strokeWidth={2.8} aria-hidden="true" />
          </span>
        ) : (
          index + 1
        )}
      </span>
      <div className="min-w-0">
        <b>{title}</b>
        <small>{text}</small>
        {children && <div className="act">{children}</div>}
      </div>
    </div>
  );
}

/** Under the steps: waiting for the AI app, or connected. */
function WaitLine({ progress, appName }: { progress: number; appName: string }) {
  if (progress >= 3)
    return (
      <div className="mt-2.5">
        <DoneLine
          title="Connected"
          line={`${appName} on this laptop · applications will show up here`}
        />
      </div>
    );
  return (
    <div className="ob-wait mt-2.5">
      <span className="ob-pulse" />
      <div>
        <span className="ob-reading">
          {progress < 1 ? 'Follow the steps above' : `Waiting for ${appName}…`}
        </span>
        <div className="faint">Ticks by itself as you go.</div>
      </div>
    </div>
  );
}

function LaptopAIStep({ email }: { email: string }) {
  const [appKey, setAppKey] = useState<AIAppKey>('antigravity');
  const app = AI_APPS.find((a) => a.key === appKey) ?? AI_APPS[0];
  const setup = useSetupCode();
  const progress = aiProgress(setup.made !== null || setup.copied !== null, setup.connected);
  const copyOnly = appKey === 'antigravity';
  return (
    <Frame
      title="Apply to jobs with your AI"
      sub="Optional. NorthList Apply lets your AI app apply for you; each application shows up here by itself."
      picture={<AIPicture done={setup.connected ? 4 : progress} email={email} />}
      phonePicture={null}
      main={{ label: progress >= 3 ? 'Continue' : 'Skip, do it later in Automation' }}
    >
      <AIAppChoice chosen={appKey} onPick={setAppKey} />
      <div className="ob-tl">
        <StepRow
          index={0}
          progress={progress}
          fresh={progress === 1}
          title={copyOnly ? 'Copy your setup prompt' : `Open ${app.name}`}
          text={buttonNote(appKey)}
        >
          {progress < 3 && <SetupCodeButton app={app} setup={setup} withNote={false}} />}
        </StepRow>
        <StepRow
          index={1}
          progress={progress}
          fresh={false}
          title={
            copyOnly ? 'Paste it into a new chat in Antigravity' : `Press Enter in ${app.name}`
          }
          text="It finds or downloads NorthList Apply and connects it."
        />
        <StepRow
          index={2}
          progress={progress}
          fresh={progress === 3}
          title={`Allow "northlist" when ${app.name} asks`}
          text={`One tap. It lets ${app.name} record your applications in NorthList and nothing else.`}
        />
      </div>
      <WaitLine progress={progress} appName={app.name} />
    </Frame>
  );
}

/** Your AI: NorthList Apply, set up on a laptop; a phone says so. */
export function AIStep({ phone, email }: { phone: boolean; email: string }) {
  if (!phone) return <LaptopAIStep email={email} />;
  return (
    <Frame
      title="Apply to jobs with your AI"
      sub="Optional. NorthList Apply lets your AI app apply for you; each application shows up here by itself."
      picture={null}
      phonePicture={<PhoneSettings />}
    >
      <div className="ob-wait items-start">
        <MonitorIcon className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <b>Do this on your laptop</b>
          <div className="faint mt-0.5">
            NorthList Apply runs in an AI app on your laptop (Antigravity recommended). Set it up
            there any time from Automation › Setup.
          </div>
        </div>
      </div>
    </Frame>
  );
}
