import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { createFileRoute } from '@tanstack/react-router';
import { CreateTokenForm } from '../components/automation/CreateTokenForm';
import { TokenList } from '../components/automation/TokenList';

export const Route = createFileRoute('/automation')({
  errorComponent: RouteErrorPage,
  component: AutomationPage,
});

/**
 * Integration tokens for the user's own job-application automation (ADR-0002). The automation
 * reports each confirmed submission to Career Companion's MCP endpoint with one of these tokens.
 */
function AutomationPage() {
  const serverUrl = `${window.location.origin}/mcp`;
  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 md:px-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Automation</h2>
        <p className="text-sm text-text-secondary mt-1">
          Let your own job-application automation tell Career Companion about each application it
          submits. Career Companion never applies to jobs itself.
        </p>
      </div>

      <CreateTokenForm />
      <TokenList />

      <section
        aria-labelledby="connect-heading"
        className="border border-border-default bg-surface p-4 space-y-3 text-sm"
      >
        <h3 id="connect-heading" className="text-lg font-semibold">
          Connect your automation
        </h3>
        <p>
          MCP server URL: <code className="font-mono break-all">{serverUrl}</code>
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-text-secondary">
          <li>Create a token above and copy it.</li>
          <li>
            Add Career Companion as an MCP server in your AI client, with the header{' '}
            <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>. Keep it in your
            client’s user-level settings, never in a file inside a repository.
          </li>
          <li>
            Allow the one tool, <code className="font-mono">record_application_submission</code>,
            and turn on “Career Companion sync” in your automation profile.
          </li>
        </ol>
        <p className="text-text-secondary">
          Only the company, job title, platform, job link, location and the confirmation text are
          sent. Your answers, resume and passwords stay on your computer. Submissions Career
          Companion cannot match with certainty wait for you on the dashboard.
        </p>
      </section>
    </div>
  );
}
