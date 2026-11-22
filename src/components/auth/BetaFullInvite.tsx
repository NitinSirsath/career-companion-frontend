import { useState } from 'react';
import { BETA_FULL_TEXT, BETA_FULL_TITLE } from '../../lib/signIn';
import { InlineNotification } from '../ui/notification';
import { Sheet } from '../ui/sheet';
import { InviteForm } from './InviteForm';

/** After Submit: calm, with the email the invite goes to. */
function OnTheList({ email }: { email: string }) {
  return (
    <InlineNotification kind="success" title="You're on the list.">
      We&rsquo;ll write to <span className="font-medium break-words">{email}</span> when NorthList
      opens.
    </InlineNotification>
  );
}

/**
 * The beta is full (owner, 22 Nov 2026): the warning, then "Get an invite". Laptops show the form
 * under the warning; phones keep the screen calm and open it in a sheet, like email sign-in.
 */
export function BetaFullInvite({ phone = false }: { phone?: boolean }) {
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  if (savedEmail) return <OnTheList email={savedEmail} />;
  const notice = (
    <InlineNotification kind="warning" title={BETA_FULL_TITLE}>
      {BETA_FULL_TEXT}
    </InlineNotification>
  );
  if (!phone)
    return (
      <div className="flex flex-col gap-5">
        {notice}
        <InviteForm onSaved={setSavedEmail} />
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {notice}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex h-[52px] w-full cursor-pointer items-center justify-center rounded-full bg-layer-accent text-[17px] font-semibold text-text-primary transition-transform duration-450 ease-[cubic-bezier(0.25,1.6,0.4,1)] active:scale-[0.98]"
      >
        Get an invite
      </button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Get an invite">
        <InviteForm
          phone
          onSaved={(email) => {
            setSheetOpen(false);
            setSavedEmail(email);
          }}
        />
      </Sheet>
    </div>
  );
}
