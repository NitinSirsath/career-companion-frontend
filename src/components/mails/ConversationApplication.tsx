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
import {
  CAREER_CONTACT,
  careerContact,
  companyAndRole,
  linkLabel,
  linkProblem,
  type LinkProblem,
} from '../../lib/mails';
import { StatusBadge } from '../ui/ring';
import { Tag } from '../ui/tag';
import { ApplicationPicker } from '../ApplicationPicker';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { isOfflineError } from '../../lib/offline';
import { closedAfterDeclineLine } from '../../lib/declineQuestion';
import { DeclineQuestion } from '../applications/DeclineQuestion';
import { MailType } from './MailType';

/**
 * The conversation's application, or the one-click way to give it one. In a table row ("cell")
 * the way to create one is a quiet link; on a mail's page it is a full button. In a Mails list row
 * ("row", laptops only) the company is plain text with the status under it.
 */
export function ConversationApplication({
  conversation,
  appearance = 'panel',
}: {
  conversation: Conversation;
  appearance?: 'cell' | 'row' | 'panel';
}) {
  const { application } = conversation;
  if (application && appearance === 'row')
    return (
      // Laptop Mails row (laptop v2, 18 Nov 2026): the company, then the status ring and word.
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <Link
          to="/applications/$id"
          params={{ id: application.id }}
          title={application.jobTitle ?? undefined}
          className="max-w-full truncate font-medium text-text-primary hover:underline"
        >
          {application.companyName}
        </Link>
        <div className="flex max-w-full items-center gap-2 text-text-secondary">
          <StatusBadge status={application.effectiveStatus} />
          {application.archived && <Tag color="outline">Archived</Tag>}
        </div>
      </div>
    );
  if (application)
    return (
      <div className="flex flex-col items-start gap-1">
        <Link
          to="/applications/$id"
          params={{ id: application.id }}
          className={
            appearance === 'panel'
              ? 'text-base text-text-primary underline decoration-border-default underline-offset-[3px] hover:decoration-text-primary'
              : 'text-link'
          }
        >
          {application.companyName}
        </Link>
        {application.jobTitle && (
          <p className="text-xs text-text-secondary break-words">{application.jobTitle}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={application.effectiveStatus} />
          {application.archived && <Tag color="outline">Archived</Tag>}
        </div>
        {application.closedAfterDeclineAt && (
          <p className="text-xs text-text-secondary">
            {closedAfterDeclineLine(application.closedAfterDeclineAt)}
          </p>
        )}
        {appearance === 'panel' && application.decline && (
          <DeclineQuestion applicationId={application.id} decline={application.decline} />
        )}
      </div>
    );
  // Laptop Mails row: the company leads, in the text colour, even with no application (owner,
  // 17 Nov 2026); "Not linked" only when no company is known (laptop v2, 18 Nov 2026).
  const company = appearance === 'row' ? conversation.company : null;
  if (company)
    return (
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="max-w-full truncate font-medium text-text-primary">{company}</span>
        <NoApplication conversation={conversation} appearance={appearance} named />
      </div>
    );
  return <NoApplication conversation={conversation} appearance={appearance} />;
}

/** A conversation without an application: why it has none, or the way to give it one. */
function NoApplication({
  conversation,
  appearance,
  named = false,
}: {
  conversation: Conversation;
  appearance: 'cell' | 'row' | 'panel';
  /** The row already names the company above: no "Not linked" line. */
  named?: boolean;
}) {
  // The user said earlier that this mail belongs to no application.
  if (conversation.link === 'IGNORED')
    return <p className="text-sm text-text-secondary">No application</p>;
  if (careerContact(conversation))
    return appearance === 'panel' ? (
      <p className="text-sm text-text-secondary">{CAREER_CONTACT.noApplication}</p>
    ) : (
      <div className="flex flex-col items-start gap-1">
        <MailType category="CAREER_CONTACT" />
        <span className="text-xs text-text-tertiary">{CAREER_CONTACT.noApplication}</span>
      </div>
    );
  return <CreateApplication conversation={conversation} appearance={appearance} named={named} />;
}

/**
 * The create button: quiet in a list row, bordered for a probable fake offer, else the panel's one
 * primary move, full width and 48px tall on phones (owner, 7 Nov 2026).
 */
function createButtonLook(cell: boolean, quiet: boolean) {
  if (cell) return { variant: 'ghost', size: 'sm', className: '-ml-3' } as const;
  if (quiet) return { variant: 'secondary', size: 'default' } as const;
  return {
    variant: 'primary',
    size: 'default',
    className: 'max-md:h-12 max-md:w-full max-md:justify-center',
  } as const;
}

/** Which button shows the spinner while the request runs. */
function pendingButton(running: boolean, body: LinkConversation | undefined) {
  if (!running) return null;
  return body && 'applicationId' in body ? 'link' : 'create';
}

/**
 * "Link to POOLit · Front-end Developer" when the company already has an application (owner,
 * 17 Nov 2026), then "Create application". A list row shows only the first.
 */
function LinkButtons({
  conversation,
  cell,
  busy,
  pending,
  onLink,
  onCreate,
}: {
  conversation: Conversation;
  cell: boolean;
  busy: boolean;
  pending: 'link' | 'create' | null;
  onLink: () => void;
  onCreate: () => void;
}) {
  const offers = conversation.sameCompanyApplications;
  // A probable fake offer: linking stays possible, but it is not the suggested next move.
  const quiet = cell || conversation.fakeOfferWarning !== null;
  const [first] = offers;
  return (
    <div className="flex flex-wrap gap-2 max-md:w-full">
      {first && (
        <Button
          {...createButtonLook(cell, quiet)}
          loading={pending === 'link'}
          disabled={busy}
          onClick={onLink}
        >
          {offers.length === 1 ? linkLabel(first) : `Link to ${first.companyName}`}
        </Button>
      )}
      {!(cell && first) && (
        <Button
          {...createButtonLook(cell, quiet || !!first)}
          loading={pending === 'create'}
          disabled={busy}
          onClick={onCreate}
        >
          {conversation.link === 'NEEDS_REVIEW' ? 'Choose application' : 'Create application'}
        </Button>
      )}
    </div>
  );
}

function CreateApplication({
  conversation,
  appearance,
  named = false,
}: {
  conversation: Conversation;
  appearance: 'cell' | 'row' | 'panel';
  named?: boolean;
}) {
  const link = useLinkConversation(conversation.key);
  const [problem, setProblem] = useState<LinkProblem | null>(null);
  const send = (body: LinkConversation) =>
    // Offline the toast says that nothing changed.
    link.mutate(body, {
      onError: (error) => setProblem(isOfflineError(error) ? null : linkProblem(error)),
    });
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
  const cell = appearance !== 'panel';
  // The company already has an application: linking to it comes first, creating second.
  const offers = conversation.sameCompanyApplications;
  return (
    <div className="flex flex-col items-start gap-1">
      {cell && !named && <span className="text-text-secondary">Not linked</span>}
      <LinkButtons
        conversation={conversation}
        cell={cell}
        busy={busy}
        pending={pendingButton(link.isPending, link.variables)}
        onLink={() =>
          offers.length === 1
            ? send({ applicationId: offers[0].id })
            : setProblem({ kind: 'choice', candidates: offers })
        }
        onCreate={() => send({})}
      />
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
