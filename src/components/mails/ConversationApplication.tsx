import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useLinkConversation } from '../../api/conversations';
import {
  LinkConversationSchema,
  type ApplicationChoiceDetails,
  type Conversation,
  type LinkConversation,
} from '../../contracts/conversation';
import { companyAndRole, linkProblem, type LinkProblem } from '../../lib/mails';
import { StatusBadge } from '../ApplicationStatus';
import { Tag } from '../ui/tag';
import { ApplicationPicker } from '../ApplicationPicker';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/**
 * The conversation's application, or the one-click way to give it one. In a table row ("cell")
 * the way to create one is a quiet link; on a mail's page it is a full button.
 */
export function ConversationApplication({
  conversation,
  appearance = 'panel',
}: {
  conversation: Conversation;
  appearance?: 'cell' | 'panel';
}) {
  const { application } = conversation;
  if (application)
    return (
      <div className="flex flex-col items-start gap-1">
        <Link to="/applications/$id" params={{ id: application.id }} className="text-link">
          {application.companyName}
        </Link>
        {application.jobTitle && (
          <p className="text-xs text-text-secondary break-words">{application.jobTitle}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={application.effectiveStatus} />
          {application.archived && <Tag color="outline">Archived</Tag>}
        </div>
      </div>
    );
  // The user said earlier that this mail belongs to no application.
  if (conversation.link === 'IGNORED')
    return <p className="text-sm text-text-secondary">No application</p>;
  return <CreateApplication conversation={conversation} appearance={appearance} />;
}

function CreateApplication({
  conversation,
  appearance,
}: {
  conversation: Conversation;
  appearance: 'cell' | 'panel';
}) {
  const link = useLinkConversation(conversation.key);
  const [problem, setProblem] = useState<LinkProblem | null>(null);
  const send = (body: LinkConversation) =>
    link.mutate(body, { onError: (error) => setProblem(linkProblem(error)) });
  // Stays off after success until the refreshed list shows the application.
  const busy = link.isPending || link.isSuccess;
  const filled = companyAndRole(conversation);

  if (problem?.kind === 'company')
    return (
      <CompanyForm
        id={conversation.key}
        busy={busy}
        onSubmit={(companyName) => send({ companyName })}
      />
    );
  if (problem?.kind === 'choice')
    return (
      <ApplicationChoice
        id={conversation.key}
        candidates={problem.candidates}
        busy={busy}
        onChoose={(applicationId) => send({ applicationId })}
      />
    );
  const cell = appearance === 'cell';
  return (
    <div className="flex flex-col items-start gap-1">
      {cell && <span className="text-text-secondary">Not linked</span>}
      <Button
        variant={cell ? 'ghost' : 'primary'}
        size={cell ? 'sm' : 'default'}
        className={cell ? '-ml-3' : undefined}
        loading={link.isPending}
        disabled={busy}
        onClick={() => send({})}
      >
        {conversation.link === 'NEEDS_REVIEW' ? 'Choose application' : 'Create application'}
      </Button>
      {filled && !cell && <p className="text-xs text-text-secondary break-words">{filled}</p>}
      {problem && (
        <p role="alert" className="text-xs text-status-error">
          {problem.text}
        </p>
      )}
    </div>
  );
}

const CompanySchema = LinkConversationSchema.options[1].pick({ companyName: true }).required();
type CompanyInput = z.infer<typeof CompanySchema>;

/** Shown only when the AI could not read a company name from the mail. */
function CompanyForm({
  id,
  busy,
  onSubmit,
}: {
  id: string;
  busy: boolean;
  onSubmit: (companyName: string) => void;
}) {
  const form = useForm<CompanyInput>({
    resolver: zodResolver(CompanySchema),
    defaultValues: { companyName: '' },
  });
  const inputId = `company-${id}`;
  return (
    <form
      className="space-y-2"
      noValidate
      onSubmit={form.handleSubmit((data) => onSubmit(data.companyName))}
    >
      <Label htmlFor={inputId}>Company name</Label>
      <p className="text-xs text-text-secondary">The company could not be read from this mail.</p>
      <Input id={inputId} maxLength={200} {...form.register('companyName')} />
      {form.formState.errors.companyName && (
        <p role="alert" className="text-xs text-status-error">
          Enter the company name.
        </p>
      )}
      <Button type="submit" size="sm" disabled={busy}>
        Create application
      </Button>
    </form>
  );
}

/** Shown when more than one of the user's applications fits the conversation. */
function ApplicationChoice({
  id,
  candidates,
  busy,
  onChoose,
}: {
  id: string;
  candidates: ApplicationChoiceDetails['candidates'];
  busy: boolean;
  onChoose: (applicationId: string) => void;
}) {
  const [applicationId, setApplicationId] = useState('');
  const selectId = `application-${id}`;
  return (
    <div className="space-y-2">
      <ApplicationPicker
        id={selectId}
        label="Choose an application"
        helperText="More than one of yours fits this mail."
        applications={candidates}
        value={applicationId}
        disabled={busy}
        onChange={setApplicationId}
      />
      <Button size="sm" disabled={busy || !applicationId} onClick={() => onChoose(applicationId)}>
        Use this application
      </Button>
    </div>
  );
}
