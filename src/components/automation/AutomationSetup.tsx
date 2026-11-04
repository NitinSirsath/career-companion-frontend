import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Launch } from '@carbon/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { INTEGRATION_TOKEN_MAX_ACTIVE } from '../../contracts/integrationToken';
import { NORTHLIST_APPLY_URL } from '../../lib/setupPrompt';
import { cn } from '../../lib/utils';
import { SettingsSection } from '../layout/SettingsSection';
import { CodeSnippet } from '../ui/code-snippet';
import { Collapse } from '../ui/collapse';
import { CreateTokenForm } from './CreateTokenForm';
import { TokenList } from './TokenList';

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
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn('transition-transform duration-150 ease-standard', !open && '-rotate-90')}
        />
        Set it up by hand instead
      </button>
      <Collapse open={open} id={panelId}>
        <div className="flex flex-col gap-3 pt-4">
          <p className="text-sm">
            Create the prompt above and copy the token from it. Then add NorthList as an MCP server
            in your AI app’s user-level settings:
          </p>
          {serverAddress && (
            <CodeSnippet code={`${serverAddress}/mcp`} label="the server address" />
          )}
          <CodeSnippet code="Authorization: Bearer <token>" label="the header" />
          <p className="text-sm">
            Allow the two tools, <Code>record_application_submission</Code> and{' '}
            <Code>record_not_submitted_job</Code>, then add this line to your automation profile,{' '}
            <Code>personal_data/profile.md</Code>:
          </p>
          {serverAddress && (
            <CodeSnippet code={`- NorthList server: ${serverAddress}`} label="the profile line" />
          )}
          <p className="text-xs text-text-secondary">
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
  // The backend's own public address when it has one (on Render the page and the backend differ);
  // locally this page passes /mcp on, so its own address works.
  const connection = useQuery({
    queryKey: ['mcp-connection'],
    queryFn: ({ signal }) => api.getMcpConnection({ signal }),
    staleTime: Infinity,
  });
  // Nothing is shown until the answer is in, so a wrong address never flashes up.
  const serverAddress = connection.isPending
    ? null
    : (connection.data?.serverAddress ?? window.location.origin);
  return (
    <>
      <SettingsSection
        title="Connect your automation"
        help="Three steps, once per computer. Your AI app does the setup."
      >
        <ol className="flex flex-col gap-6">
          <Step number={1} title="Get NorthList Apply">
            <p className="text-sm">
              Download it from GitHub, then open its folder in your AI app: Claude Code, Codex or
              Antigravity.
            </p>
            <a
              href={NORTHLIST_APPLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-fit items-center gap-2 rounded-md border border-button-tertiary px-3 text-sm font-medium text-button-tertiary transition-colors duration-70 ease-standard hover:bg-button-tertiary hover:text-button-tertiary-hover-text"
            >
              NorthList Apply on GitHub
              <Launch size={16} aria-hidden="true" />
            </a>
          </Step>
          <Step number={2} title="Create your setup prompt">
            <CreateTokenForm serverAddress={serverAddress} />
          </Step>
          <Step number={3} title="Paste it into your AI app">
            <p className="text-sm">
              Paste the prompt into a chat in the NorthList Apply folder. The app adds NorthList to
              its own settings and asks you to allow the change. When it says so, open a new chat or
              restart the app, then type <Code>start</Code>. When it first asks to use NorthList,
              allow it.
            </p>
            <p className="text-xs text-text-secondary">
              For each application it sends: company, job title, platform, job and apply page links,
              job ID, where the job was found, location, work mode, time, the site’s confirmation,
              resume file name and your submitted answers. For jobs it did not apply to: company,
              job title, platform, job link and the reason. Your resume itself and your passwords
              stay on your computer.
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
