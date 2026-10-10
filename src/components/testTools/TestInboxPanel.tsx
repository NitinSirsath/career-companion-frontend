import { useState } from 'react';
import { useTestToolsEnabled } from '../../api/testTools';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ResetTestDataDialog } from './ResetTestDataDialog';
import { TestEmailForm } from './TestEmailForm';
import { TestScenarioRunner } from './TestScenarioRunner';

/**
 * Test inbox for the manual test environment. Each email goes through the same steps as real
 * Gmail mail (relevance check, extraction, matching), without Gmail or a second account.
 */
export function TestInboxPanel() {
  const enabled = useTestToolsEnabled();
  const [company, setCompany] = useState('Northwind Robotics');
  const [role, setRole] = useState('Senior Platform Engineer');
  const [lastThreadId, setLastThreadId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // A new key after a reset starts the form and the scenario from scratch.
  const [resets, setResets] = useState(0);

  if (!enabled) return null;

  const values = { company, role };
  const delivered = (threadId: string, text: string) => {
    setLastThreadId(threadId);
    setNotice(text);
  };
  const afterReset = (text: string) => {
    setLastThreadId(null);
    setResets((count) => count + 1);
    setNotice(text);
  };

  return (
    <section
      aria-labelledby="test-inbox-heading"
      className="space-y-6 rounded-xl border border-status-warning bg-card p-6 text-card-foreground shadow-sm"
    >
      <div>
        <h3 id="test-inbox-heading" className="mb-1 text-lg font-medium">
          Test inbox
        </h3>
        <p className="text-sm text-muted-foreground">
          Test emails go through the same steps as real Gmail mail: relevance check, extraction and
          matching. Only the emails are made up: your AI provider reads them, so each one uses AI
          calls on your key.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="test-company">Company</Label>
          <Input id="test-company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="test-role">Role</Label>
          <Input id="test-role" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
      </div>

      <TestEmailForm
        key={`form-${resets}`}
        values={values}
        lastThreadId={lastThreadId}
        onDelivered={delivered}
        onNotice={setNotice}
      />
      <TestScenarioRunner
        key={`scenario-${resets}`}
        values={values}
        onDelivered={delivered}
        onNotice={setNotice}
      />
      <ResetTestDataDialog onReset={afterReset} onNotice={setNotice} />

      {notice && (
        <p role="status" className="text-sm font-medium">
          {notice}
        </p>
      )}
    </section>
  );
}
