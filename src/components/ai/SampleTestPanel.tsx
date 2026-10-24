import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { AISampleTestResponse } from '../../contracts/ai';
import { modelName } from '../../lib/aiLabels';
import { sampleTestProblem } from '../../lib/aiProviderPage';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';

/**
 * Optional proof that the saved key and models return NorthList's structured output. The
 * result is shown, kept only in this component, and discarded; NorthList stores nothing.
 */
export function SampleTestPanel({
  providerId,
  providerName,
}: {
  providerId: string;
  providerName: string;
}) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AISampleTestResponse | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function run() {
    if (running) return;
    setRunning(true);
    setProblem(null);
    setResult(null);
    try {
      setResult(await api.runAISampleTest());
    } catch (err) {
      setProblem(sampleTestProblem(err, providerId));
    } finally {
      setRunning(false);
      // Counts and access state may have changed; never re-run the test automatically.
      queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
    }
  }

  const rows: [string, string | null][] = result
    ? [
        [
          'Relevance',
          `${result.classification.decision} (${Math.round(result.classification.confidence * 100)}% confidence)`,
        ],
        ['Category', result.classification.category],
        ['Company', result.extraction.companyName],
        ['Job title', result.extraction.jobTitle],
        [
          'Interview',
          [
            result.extraction.interviewStage,
            result.extraction.interviewDate,
            result.extraction.interviewTime,
          ]
            .filter(Boolean)
            .join(' · ') || null,
        ],
        [
          'Action required',
          result.extraction.actionRequired === null
            ? null
            : result.extraction.actionRequired
              ? 'Yes'
              : 'No',
        ],
        ['Requested action', result.extraction.requestedAction],
      ]
    : [];

  return (
    <section aria-label="Sample email test" className="flex flex-col items-start gap-3">
      <p className="text-sm text-text-secondary">
        Runs both AI steps on a built-in example recruiter email, never your mail. It costs a few
        tokens on your {providerName} account and counts toward today&apos;s safety limit.
      </p>
      <Button variant="tertiary" onClick={run} loading={running}>
        {running ? 'Testing…' : 'Try a sample email'}
      </Button>
      {problem && (
        <InlineNotification kind="error" className="self-stretch">
          {problem}
        </InlineNotification>
      )}
      {result && (
        <div role="status" className="space-y-2">
          <p className="text-sm font-medium">
            It works. Result from {modelName(providerId, result.models.fast)} and{' '}
            {modelName(providerId, result.models.detailed)} ({result.usage.calls} calls,{' '}
            {result.usage.inputTokens + result.usage.outputTokens} tokens):
          </p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-text-secondary">{label}</dt>
                <dd>{value ?? 'None'}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
