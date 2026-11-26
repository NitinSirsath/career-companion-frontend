import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { CircleCheckIcon, MailIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import type { ApplicationActionListItem } from '../../contracts/application';
import { stepText, type stepSource } from '../../lib/applicationDetail';
import { closesByHand } from '../../lib/mails';
import { MISSED, missedLine, missedNote } from '../../lib/missed';
import { isOfflineError } from '../../lib/offline';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { OverflowMenu, type MenuAction } from '../ui/menu';
import { InlineNotification } from '../ui/notification';
import { Ring } from '../ui/ring';
import { Sheet, SheetAction, SheetBody, SheetGroup } from '../ui/sheet';
import { DETAIL_ROW } from './DetailSection';
import { useStepChange } from './useStepChange';

/*
 * An application's missed steps (owner, 26 Nov 2026, mock `MISSED-mock/`): open steps from mails
 * that left Needs action by themselves. They sit under the open ones, dim and not counted, with
 * "Still open" as their action.
 */

interface MissedStepProps {
  action: ApplicationActionListItem;
  archived: boolean;
  source: ReturnType<typeof stepSource>;
}

const CHANGE_FAILED =
  'We could not confirm this change. The list was read again: check the step before you try once more.';

/** A missed step in the laptop card: dim words, "Still open", and the rest in "…". */
export function MissedStepRow({ action, archived, source }: MissedStepProps) {
  const { update, change, stillOpen } = useStepChange(action);
  const text = stepText(action);
  const actions: MenuAction[] = [
    ...(closesByHand(action) ? [{ label: 'I did this', onSelect: () => change('COMPLETED') }] : []),
    { label: 'Dismiss', onSelect: () => change('DISMISSED') },
  ];
  return (
    <li className="grid animate-fade-in grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-border-subtle py-3.5">
      <div className="flex min-w-0 flex-col gap-1 opacity-55">
        <span className="break-words">{text}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
          <span>{missedLine(action)}</span>
          {source && (
            // The dot stays with the words after it when the line wraps.
            <span className="flex items-center gap-2">
              <span aria-hidden="true">·</span>
              {source.mailId ? (
                <Link to="/mails/$key" params={{ key: source.mailId }} className="text-link">
                  {source.text}
                </Link>
              ) : (
                <span>{source.text}</span>
              )}
            </span>
          )}
        </span>
      </div>
      {!archived && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`${MISSED.stillOpen}: ${text}`}
            disabled={update.isPending}
            onClick={stillOpen}
          >
            {MISSED.stillOpen}
          </Button>
          <OverflowMenu label={`More for ${text}`} actions={actions} />
        </div>
      )}
      {/* Offline the toast says that nothing changed. */}
      {update.isError && !isOfflineError(update.error) && (
        <InlineNotification kind="error" className="col-span-2">
          {CHANGE_FAILED}
        </InlineNotification>
      )}
    </li>
  );
}

/** The row's words on a phone: the empty ring, the step, and "Missed". */
function PhoneMissedLine({ text }: { text: string }) {
  return (
    <>
      <Ring kind="todo" size={17} className="opacity-55" />
      <span className="min-w-0 flex-1 text-[15px] leading-[21px] break-words text-text-secondary">
        {text}
      </span>
      <span className="shrink-0 text-phone-sub whitespace-nowrap text-text-secondary">
        {MISSED.label}
      </span>
    </>
  );
}

/**
 * A missed step on a phone: a dim row; a tap opens the sheet a missed mail has, with Still open,
 * "I did this", Dismiss and the mail it came from.
 */
export function PhoneMissedStepRow({ action, archived, source }: MissedStepProps) {
  const { update, change, stillOpen } = useStepChange(action);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const text = stepText(action);
  const body = <PhoneMissedLine text={text} />;
  if (archived)
    return <div className={cn(DETAIL_ROW, 'py-[9px] active:bg-transparent')}>{body}</div>;
  const pick = (run: () => void) => () => {
    setOpen(false);
    run();
  };
  const mailId = source?.mailId;
  return (
    <>
      <button
        type="button"
        aria-label={`${text}, ${MISSED.label}`}
        className={cn(DETAIL_ROW, 'cursor-pointer py-[9px]')}
        onClick={() => setOpen(true)}
      >
        {body}
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Next step">
        <SheetBody>
          <p className="text-[17px] leading-6 break-words">{text}</p>
          <p className="text-[13px] leading-[18px] text-text-secondary">{missedLine(action)}</p>
        </SheetBody>
        <SheetGroup>
          <SheetAction
            icon={<RotateCcwIcon size={22} aria-hidden="true" />}
            disabled={update.isPending}
            onClick={pick(stillOpen)}
          >
            {MISSED.stillOpen}
          </SheetAction>
          {closesByHand(action) && (
            <SheetAction
              icon={<CircleCheckIcon size={22} aria-hidden="true" />}
              disabled={update.isPending}
              onClick={pick(() => change('COMPLETED'))}
            >
              I did this
            </SheetAction>
          )}
          <SheetAction
            icon={<XIcon size={22} aria-hidden="true" />}
            disabled={update.isPending}
            onClick={pick(() => change('DISMISSED'))}
          >
            Dismiss
          </SheetAction>
          {mailId && (
            <SheetAction
              icon={<MailIcon size={22} aria-hidden="true" />}
              onClick={pick(() => void navigate({ to: '/mails/$key', params: { key: mailId } }))}
            >
              Open the mail
            </SheetAction>
          )}
        </SheetGroup>
        {action.missed && (
          <p className="text-[13px] leading-[18px] text-text-tertiary">
            {missedNote(action.missed)}
          </p>
        )}
      </Sheet>
      {update.isError && !isOfflineError(update.error) && (
        <div className="px-[18px] py-2">
          <InlineNotification kind="error">{CHANGE_FAILED}</InlineNotification>
        </div>
      )}
    </>
  );
}
