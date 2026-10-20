import { Select as BaseSelect } from '@base-ui/react/select';
import { Checkmark, ChevronDown } from '@carbon/icons-react';
import { ApplicationStatusSchema, type ApplicationResponse } from '../../contracts/application';
import { statusSourceLine } from '../../lib/applicationDetail';
import { USE_AI, statusWords, type Choice, type Phase } from '../../lib/statusChoice';
import { STATUS_LABEL } from '../../lib/statusLabels';
import { applicationTag, statusTag, type TagLook } from '../../lib/statusTags';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { ITEM_CLASS, POPUP_CLASS } from '../ui/select';
import { Tag } from '../ui/tag';

/** The status as a dropdown, the way it looks in lists: a coloured tag with a chevron. */
function StatusSelect({
  application,
  value,
  shown,
  disabled,
  onChoose,
}: {
  application: ApplicationResponse;
  value: Choice;
  shown: TagLook;
  disabled: boolean;
  onChoose: (choice: Choice) => void;
}) {
  const ai = application.aiStatus;
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(next) => next !== null && onChoose(next as Choice)}
      disabled={disabled}
    >
      <BaseSelect.Trigger
        aria-label={`Status: ${shown.label}. Change status`}
        className="group inline-flex h-8 cursor-pointer items-center gap-1 pr-2 transition-colors duration-70 ease-standard outline-none hover:bg-layer-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus data-disabled:cursor-not-allowed data-disabled:opacity-60 data-disabled:hover:bg-transparent"
      >
        <Tag color={shown.color}>{shown.label}</Tag>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="transition-transform duration-110 ease-standard group-data-popup-open:rotate-180"
        />
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          alignItemWithTrigger={false}
          align="start"
          sideOffset={4}
          className="z-50 outline-none"
        >
          <BaseSelect.Popup className={cn(POPUP_CLASS, 'w-72')}>
            <BaseSelect.List aria-label="Status">
              {ApplicationStatusSchema.options.map((status) => (
                <BaseSelect.Item key={status} value={status} className={ITEM_CLASS}>
                  <BaseSelect.ItemText render={<Tag color={statusTag(status).color} />}>
                    {STATUS_LABEL[status]}
                  </BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="flex text-link">
                    <Checkmark size={16} aria-hidden="true" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
              <BaseSelect.Separator className="my-1 h-px bg-border-subtle" />
              <BaseSelect.Item value={USE_AI} className={ITEM_CLASS}>
                <BaseSelect.ItemText>
                  Use the AI's status ({ai ? STATUS_LABEL[ai] : 'none yet'})
                </BaseSelect.ItemText>
                <BaseSelect.ItemIndicator className="flex text-link">
                  <Checkmark size={16} aria-hidden="true" />
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            </BaseSelect.List>
            <p className="border-t border-border-subtle px-4 pt-2 pb-1 text-xs text-text-secondary">
              Changing the status does not finish to-dos, ask the AI again or send anything.
            </p>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

/** The status beside the role: the dropdown (a plain tag once archived) and who set it. */
export function StatusLine({
  application,
  value,
  shown,
  disabled,
  busy,
  announcement,
  onChoose,
}: {
  application: ApplicationResponse;
  value: Choice;
  shown: TagLook;
  disabled: boolean;
  busy: boolean;
  announcement: string;
  onChoose: (choice: Choice) => void;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {application.archivedAt ? (
        <Tag color={shown.color}>{shown.label}</Tag>
      ) : (
        <StatusSelect
          application={application}
          value={value}
          shown={shown}
          disabled={disabled}
          onChoose={onChoose}
        />
      )}
      <span className="text-xs tracking-[0.32px] text-text-secondary">
        {busy ? 'Saving…' : statusSourceLine(application)}
      </span>
      {/* One live region that stays the same node, so "Status saved." is read when it is set. */}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </span>
  );
}

/** What went wrong with the last choice, or what the user may want to know now. */
export function StatusNotice({
  phase,
  application,
  onUseAi,
  onCheckAgain,
  onClose,
}: {
  phase: Phase;
  application: ApplicationResponse;
  onUseAi: () => void;
  onCheckAgain: () => void;
  onClose: () => void;
}) {
  const current = applicationTag(application).label;
  const ok = (
    <Button variant="ghost" size="sm" className="-my-1.5" onClick={onClose}>
      OK
    </Button>
  );
  switch (phase.kind) {
    case 'reconciling':
      return <InlineNotification>Checking whether your change was saved…</InlineNotification>;
    case 'failed':
      return (
        <InlineNotification kind="error" title="Not saved." action={ok}>
          The server did not take the change. Choose the status again to try once more.
        </InlineNotification>
      );
    case 'conflict':
      return (
        <InlineNotification kind="warning" title="Not saved." action={ok}>
          The status was changed somewhere else, for example in another tab. It is now {current}.
          Choose {statusWords(phase.wanted)} again if you still want it.
        </InlineNotification>
      );
    case 'review':
      return (
        <InlineNotification kind="warning" title="Not sure it was saved." action={ok}>
          We could not confirm your change. The status is now {current}. Choose again if this is not
          what you wanted.
        </InlineNotification>
      );
    case 'unknown':
      return (
        <InlineNotification
          kind="error"
          title="Not sure it was saved."
          action={
            <Button variant="ghost" size="sm" className="-my-1.5" onClick={onCheckAgain}>
              Check again
            </Button>
          }
        >
          We could not confirm your change, and the status could not be loaded.
        </InlineNotification>
      );
    case 'unavailable':
      return (
        <InlineNotification kind="error">
          This application is no longer available.
        </InlineNotification>
      );
    default:
      if (!application.hasStatusConflict || !application.aiStatus || !application.userStatus)
        return null;
      return (
        <InlineNotification
          action={
            <Button variant="ghost" size="sm" className="-my-1.5" onClick={onUseAi}>
              Use the AI's status
            </Button>
          }
        >
          You set {STATUS_LABEL[application.userStatus]}. The AI reads your latest mail as{' '}
          {STATUS_LABEL[application.aiStatus]}. Your choice stays until you switch back.
        </InlineNotification>
      );
  }
}
