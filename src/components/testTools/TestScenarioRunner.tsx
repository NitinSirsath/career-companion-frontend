import { useState } from 'react';
import { useDeliverTestEmail, useStartTestScenario, useTestToolsBusy } from '../../api/testTools';
import {
  TEST_SCENARIOS,
  fillTemplate,
  type TemplateValues,
  type TestEmailTemplate,
} from '../../contracts/testTools';
import {
  failureNotice,
  nextStepTemplate,
  scenarioStartNotice,
  scenarioStepNotice,
  type ScenarioRun,
} from '../../lib/testInbox';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';

interface TestScenarioRunnerProps {
  values: TemplateValues;
  onDelivered: (threadId: string, notice: string) => void;
  onNotice: (notice: string) => void;
}

/** A ready-made sequence of emails, delivered one step at a time. */
export function TestScenarioRunner({ values, onDelivered, onNotice }: TestScenarioRunnerProps) {
  const start = useStartTestScenario();
  const deliver = useDeliverTestEmail();
  const busy = useTestToolsBusy();
  const [scenarioId, setScenarioId] = useState(TEST_SCENARIOS[0].id);
  const [run, setRun] = useState<ScenarioRun | null>(null);

  const scenario = TEST_SCENARIOS.find((item) => item.id === scenarioId) ?? TEST_SCENARIOS[0];
  const nextTemplate = run ? nextStepTemplate(run) : undefined;

  const startRun = () =>
    start.mutate(
      { scenario, values },
      {
        onSuccess: () => {
          setRun({ scenario, next: 0, threadId: null });
          onNotice(scenarioStartNotice(scenario, values.company));
        },
        onError: (err) => onNotice(failureNotice('start', err)),
      },
    );

  const deliverNext = (current: ScenarioRun, template: TestEmailTemplate) =>
    deliver.mutate(
      {
        ...fillTemplate(template, values),
        threadId: current.scenario.sameThread && current.threadId ? current.threadId : undefined,
      },
      {
        onSuccess: (result) => {
          const next = current.next + 1;
          setRun({
            ...current,
            next,
            threadId: current.scenario.sameThread ? result.threadId : null,
          });
          onDelivered(
            result.threadId,
            scenarioStepNotice(template.name, next >= current.scenario.steps.length),
          );
        },
        onError: (err) => onNotice(failureNotice('deliver', err)),
      },
    );

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Run a scenario</h4>
      <div className="space-y-2">
        <Label htmlFor="test-scenario">Scenario</Label>
        <NativeSelect
          id="test-scenario"
          value={scenarioId}
          onChange={(e) => {
            setScenarioId(e.target.value);
            setRun(null);
          }}
        >
          {TEST_SCENARIOS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </NativeSelect>
        <p className="text-sm text-muted-foreground">{scenario.description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={startRun} disabled={busy}>
          {run ? 'Start again' : 'Start scenario'}
        </Button>
        {run && nextTemplate && (
          <Button onClick={() => deliverNext(run, nextTemplate)} disabled={busy}>
            {`Deliver email ${run.next + 1} of ${run.scenario.steps.length}: ${nextTemplate.name}`}
          </Button>
        )}
      </div>
    </div>
  );
}
