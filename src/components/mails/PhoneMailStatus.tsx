import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApplicationResponse } from '../../contracts/application';
import type { Conversation } from '../../contracts/conversation';
import { statusSourceLine } from '../../lib/applicationDetail';
import { applicationQueryOptions } from '../../lib/applicationCache';
import { statusTag } from '../../lib/statusTags';
import { PhoneStatusSheet } from '../applications/StatusSelect';
import { useStatusControl } from '../applications/useStatusControl';
import { PRESS } from '../phone/GlassButton';
import { Ring } from '../ui/ring';
import { Pill } from './PhoneMailParts';

type Linked = NonNullable<Conversation['application']>;

/** The status pill while the application loads, or when it cannot change. */
function StillPill({ application }: { application: Linked }) {
  const look = statusTag(application.effectiveStatus);
  return <Pill icon={<Ring kind={look.ring} />}>{look.label}</Pill>;
}

/** The pill as a button: it opens the Status sheet, which saves the choice at once. */
function StatusButton({
  application,
  noticePlace,
}: {
  application: ApplicationResponse;
  noticePlace: HTMLElement | null;
}) {
  const [open, setOpen] = useState(false);
  const { choice, notice } = useStatusControl(application, true);
  return (
    <>
      <button
        type="button"
        aria-label={`Status: ${choice.shown.label}. Change status`}
        disabled={choice.disabled}
        onClick={() => setOpen(true)}
        className={`flex cursor-pointer rounded-full disabled:cursor-default ${PRESS}`}
      >
        <Pill icon={<Ring kind={choice.shown.ring} />}>{choice.shown.label}</Pill>
      </button>
      <PhoneStatusSheet
        aiStatus={application.aiStatus}
        note={statusSourceLine(application)}
        value={choice.value}
        open={open}
        onOpenChange={setOpen}
        onChoose={choice.choose}
      />
      {noticePlace && createPortal(notice, noticePlace)}
    </>
  );
}

/**
 * The status pill on a phone's mail page (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` #2 and
 * #3): a tap opens the Status sheet, with the same save as the application page. A note about
 * the last choice shows in `noticePlace`, under the round card.
 */
export function PhoneMailStatus({
  application,
  noticePlace,
}: {
  application: Linked;
  noticePlace: HTMLElement | null;
}) {
  const queryClient = useQueryClient();
  const full = useQuery(applicationQueryOptions(queryClient, application.id));
  if (!full.data || full.isError || application.archived)
    return <StillPill application={application} />;
  return <StatusButton application={full.data} noticePlace={noticePlace} />;
}
