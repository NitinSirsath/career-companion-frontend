import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { INTEGRATION_TOKEN_MAX_ACTIVE } from '../../contracts/integrationToken';
import { SettingsSection } from '../layout/SettingsSection';
import { CodeSnippet } from '../ui/code-snippet';
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
      <SettingsSection title="Connect your automation" help="Three steps, once per computer.">
        <ol className="flex flex-col gap-6">
          <Step number={1} title="Create a token">
            <CreateTokenForm />
          </Step>
          <Step number={2} title="Add Career Companion as an MCP server in your AI client">
            {serverAddress && (
              <CodeSnippet code={`${serverAddress}/mcp`} label="the server address" />
            )}
            <CodeSnippet code="Authorization: Bearer <token>" label="the header" />
            <p className="text-xs text-text-secondary">
              Put your token in place of &lt;token&gt;. Keep it in your client’s user-level
              settings, never in a file inside a repository.
            </p>
          </Step>
          <Step number={3} title="Allow the tools and turn on sync">
            <p className="text-sm">
              Allow the two tools,{' '}
              <code className="bg-layer-accent px-1.5 py-0.5 font-mono text-xs">
                record_application_submission
              </code>{' '}
              and{' '}
              <code className="bg-layer-accent px-1.5 py-0.5 font-mono text-xs">
                record_not_submitted_job
              </code>
              , then add this line to your automation profile,{' '}
              <code className="bg-layer-accent px-1.5 py-0.5 font-mono text-xs">
                personal_data/profile.md
              </code>
              :
            </p>
            {serverAddress && (
              <CodeSnippet
                code={`- Career Companion server: ${serverAddress}`}
                label="the profile line"
              />
            )}
            <p className="text-xs text-text-secondary">
              For each application it sends: company, job title, platform, job and apply page links,
              job ID, where the job was found, location, work mode, time, the site’s confirmation,
              resume file name and your submitted answers. For jobs it did not apply to: company,
              job title, platform, job link and the reason. Your resume itself and your passwords
              stay on your computer.
            </p>
          </Step>
        </ol>
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
