import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDeliverTestEmail, useTestToolsBusy } from '../../api/testTools';
import {
  DeliverTestEmailRequestSchema,
  TEST_EMAIL_LABELS,
  TEST_EMAIL_TEMPLATES,
  fillTemplate,
  type DeliverTestEmailRequest,
  type TemplateValues,
  type TestEmailGroup,
} from '../../contracts/testTools';
import { TEST_EMAIL_LABEL_NAME, failureNotice, templateById } from '../../lib/testInbox';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';
import { Textarea } from '../ui/textarea';

const GROUPS: readonly TestEmailGroup[] = ['Job emails', 'Not job emails', 'LinkedIn'];
const DEFAULT_TEMPLATE = 'interview-invite';

interface TestEmailFormProps {
  values: TemplateValues;
  lastThreadId: string | null;
  onDelivered: (threadId: string, notice: string) => void;
  onNotice: (notice: string) => void;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** The ready-made emails, grouped. */
function TemplateSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <NativeSelect id="test-template" value={value} onChange={(e) => onChange(e.target.value)}>
      {GROUPS.map((group) => (
        <optgroup key={group} label={group}>
          {TEST_EMAIL_TEMPLATES.filter((template) => template.group === group).map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </optgroup>
      ))}
    </NativeSelect>
  );
}

/** One test email: start from a ready-made template, edit any field, deliver. */
export function TestEmailForm({ values, lastThreadId, onDelivered, onNotice }: TestEmailFormProps) {
  const deliver = useDeliverTestEmail();
  const busy = useTestToolsBusy();
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE);
  const [replyInThread, setReplyInThread] = useState(false);
  const form = useForm<DeliverTestEmailRequest>({
    resolver: zodResolver(DeliverTestEmailRequestSchema),
    defaultValues: fillTemplate(templateById(DEFAULT_TEMPLATE)!, values),
  });
  const { errors } = form.formState;

  const fill = (id: string) => {
    const template = templateById(id);
    if (template) form.reset(fillTemplate(template, values));
  };

  const onSubmit = form.handleSubmit((data) =>
    deliver.mutate(
      { ...data, threadId: replyInThread && lastThreadId ? lastThreadId : undefined },
      {
        onSuccess: (result) =>
          onDelivered(result.threadId, 'Delivered. The list refreshes while it is processed.'),
        onError: (err) => onNotice(failureNotice('deliver', err)),
      },
    ),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h4 className="font-medium">Send one email</h4>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="test-template" label="Ready-made email">
          <TemplateSelect
            value={templateId}
            onChange={(id) => {
              setTemplateId(id);
              fill(id);
            }}
          />
        </Field>
        <Field id="test-label" label="Gmail category">
          <NativeSelect id="test-label" {...form.register('label')}>
            {TEST_EMAIL_LABELS.map((label) => (
              <option key={label} value={label}>
                {TEST_EMAIL_LABEL_NAME[label]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field id="test-sender" label="From" error={errors.sender?.message}>
        <Input id="test-sender" {...form.register('sender')} />
      </Field>
      <Field id="test-subject" label="Subject" error={errors.subject?.message}>
        <Input id="test-subject" {...form.register('subject')} />
      </Field>
      <Field id="test-body" label="Body" error={errors.body?.message}>
        <Textarea id="test-body" rows={8} maxLength={8000} {...form.register('body')} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={replyInThread}
          disabled={!lastThreadId}
          onChange={(e) => setReplyInThread(e.target.checked)}
        />
        Reply in the same thread as the last test email
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {deliver.isPending ? 'Delivering...' : 'Deliver email'}
        </Button>
        <Button type="button" variant="tertiary" onClick={() => fill(templateId)} disabled={busy}>
          Fill again from template
        </Button>
      </div>
    </form>
  );
}
