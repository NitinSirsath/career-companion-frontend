import { useId, useState, type ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { INTEGRATION_TOKEN_MAX_ACTIVE } from '../../contracts/integrationToken';
import { AI_APPS, type AIAppKey } from '../../lib/onboarding';
import { cn } from '../../lib/utils';
import { SettingsSection } from '../layout/SettingsSection';
import { CodeSnippet } from '../ui/code-snippet';
import { Collapse } from '../ui/collapse';
import { inAppText } from '../../lib/setupPrompt';
import { AIAppChoice, SetupCodeButton } from './ConnectAIApp';
import { CreateTokenForm } from './CreateTokenForm';
import { useSetupCode } from './useSetupCode';
import { TokenList } from './TokenList';
import { useServerAddress } from './useServerAddress';

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center bg-layer-accent text-xs font-semibold"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {children}
      </div>
    </li>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="bg-layer-accent px-1.5 py-0.5 font-mono text-xs">{children}</code>
);

/** Today's setup steps, for people who connect their AI app themselves. Closed by default. */
function ByHand({ serverAddress }: { serverAddress: string | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="border-t border-border-subtle pt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center gap-2 text-sm font-medium text-link hover:underline"
      >
        <ChevronDownIcon
          size={16}
          aria-hidden="true"
          className={cn('transition-transform duration-150 ease-standard', !open && '-rotate-90')}
        />
        Set it up by hand instead
      </button>
      <Collapse open={open} id={panelId}>
        <div className="flex flex-col gap-3 pt-4">
          <p className="max-w-160 text-sm">
            Create a token here and copy it. Then add NorthList as an MCP server in your AI app’s
            user-level settings:
          </p>
          <CreateTokenForm serverAddress={serverAddress} />
          {serverAddress && (
            <CodeSnippet code={`${serverAddress}/mcp`} label="the server address" />
          )}
          <CodeSnippet code="Authorization: Bearer <token>" label="the header" />
          <p className="max-w-160 text-sm">
            Allow the two tools, <Code>record_application_submission</Code> and{' '}
            <Code>record_not_submitted_job</Code>, then add this line to your automation profile,{' '}
            <Code>personal_data/profile.md</Code>:
          </p>
          {serverAddress && (
            <CodeSnippet code={`- NorthList server: ${serverAddress}`} label="the profile line" />
          )}
          <p className="max-w-160 text-xs text-text-secondary">
            Put your token in place of &lt;token&gt;. Keep it in your app’s user-level settings,
            never in a file inside a repository.
          </p>
        </div>
      </Collapse>
    </div>
  );
}

/** How to connect the automation, and the tokens it uses. */
export function AutomationSetup() {
  const serverAddress = useServerAddress();
  const [key, setKey] = useState<AIAppKey>('antigravity');
  const app = AI_APPS.find((a) => a.key === key) ?? AI_APPS[0];
  const setup = useSetupCode();
  return (
    <>
      <SettingsSection
        title="Connect your AI app"
        help="Once per computer. One click, then your AI app does the rest: it finds or downloads NorthList Apply and connects it."
      >
        <ol className="flex flex-col gap-6">
          <Step number={1} title="Pick your AI app">
            <AIAppChoice chosen={key} onPick={setKey} />
          </Step>
          <Step
            number={2}
            title={key === 'antigravity' ? 'Copy your setup prompt' : `Open ${app.name}`}
          >
            <SetupCodeButton app={app} setup={setup} />
          </Step>
          <Step number={3} title="In your AI app">
            <p className="max-w-160 text-sm">{inAppText(key, app.name)}</p>
            <p className="max-w-160 text-xs text-text-secondary">
              For each application it sends: company, job title, platform, job and apply page links,
              job ID, where the job was found, location, work mode, time, the site’s confirmation,
              resume file name and your submitted answers. For Workday and company portals it also
              sends the account it used: sign-in page, email and password. NorthList stores the
              password encrypted. For jobs it did not apply to: company, job title, platform, job
              link and the reason. Your resume itself stays on your computer.
            </p>
          </Step>
        </ol>
        <ByHand serverAddress={serverAddress} />
      </SettingsSection>
      <SettingsSection
        title="Your tokens"
        help={`Up to ${INTEGRATION_TOKEN_MAX_ACTIVE} active tokens. Revoked tokens stay listed.`}
      >
        <TokenList />
      </SettingsSection>
    </>
  );
}
