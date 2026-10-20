import type { ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CreateTokenForm } from '../components/automation/CreateTokenForm';
import { SubmissionReview } from '../components/automation/SubmissionReview';
import { TokenList } from '../components/automation/TokenList';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { PageHeader } from '../components/layout/PageHeader';
import { SettingsSection } from '../components/layout/SettingsSection';
import { CodeSnippet } from '../components/ui/code-snippet';
import { INTEGRATION_TOKEN_MAX_ACTIVE } from '../contracts/integrationToken';

export const Route = createFileRoute('/automation')({
  errorComponent: RouteErrorPage,
  component: AutomationPage,
});

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

/**
 * Integration tokens for the user's own job-application automation (ADR-0002). The automation
 * reports each confirmed submission to Career Companion's MCP endpoint with one of these tokens.
 */
function AutomationPage() {
  const serverUrl = `${window.location.origin}/mcp`;
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Automation"
        description="Let your own job-application automation tell Career Companion about each application it sends. Career Companion never applies to jobs itself."
      />
      <SettingsSection title="Connect your automation" help="Three steps, once per computer.">
        <ol className="flex flex-col gap-6">
          <Step number={1} title="Create a token">
            <CreateTokenForm />
          </Step>
          <Step number={2} title="Add Career Companion as an MCP server in your AI client">
            <CodeSnippet code={serverUrl} label="the server address" />
            <CodeSnippet code="Authorization: Bearer <token>" label="the header" />
            <p className="text-xs text-text-secondary">
              Put your token in place of &lt;token&gt;. Keep it in your client’s user-level
              settings, never in a file inside a repository.
            </p>
          </Step>
          <Step number={3} title="Allow the tool and turn on sync">
            <p className="text-sm">
              Allow the one tool,{' '}
              <code className="bg-layer-accent px-1.5 py-0.5 font-mono text-xs">
                record_application_submission
              </code>
              , then turn on “Career Companion sync” in your automation profile.
            </p>
            <p className="text-xs text-text-secondary">
              Only the company, job title, platform, job link, location and the confirmation text
              are sent. Your answers, resume and passwords stay on your computer.
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
      <SubmissionReview />
    </div>
  );
}
