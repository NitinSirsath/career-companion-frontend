import { Checkmark, Email, Send } from '@carbon/icons-react';
import { Band, BandTitle, PrivacyLink, Tile, Tiles } from './ProductParts';

/** Google's review asks the home page to say why each Google permission is needed. */
function Scope({ name }: { name: string }) {
  return (
    <code className="bg-surface-subtle px-1.5 font-mono text-xs text-text-secondary">{name}</code>
  );
}

const PROMISES = [
  'No ads, no selling your data, no tracking tools.',
  'NorthList asks its AI service to keep nothing, so your mail is not stored there or used to train AI.',
  'Disconnect Gmail at any time, in NorthList or in your Google account.',
];

/** The two Gmail permissions in the privacy policy's words, and what NorthList never does. */
export function GooglePermissions() {
  return (
    <Band labelledBy="google-permissions">
      <BandTitle
        id="google-permissions"
        title="What NorthList asks Google for"
        lead="You sign in with Google and connect Gmail. NorthList asks for two Gmail permissions, and uses them only for this:"
      />
      <Tiles>
        <Tile icon={Email} title="Read your mail" note={<Scope name="gmail.readonly" />}>
          To find your job mails and what they ask of you. NorthList keeps each mail's subject,
          sender and date, and what the AI found in job mails. It does not keep the text of your
          mails or their attachments.
        </Tile>
        <Tile icon={Send} title="Send mail" note={<Scope name="gmail.send" />}>
          Only when you write a reply in NorthList and press Send. It never sends anything by
          itself.
        </Tile>
      </Tiles>
      <ul className="mt-6 flex list-none flex-col gap-2.5 p-0">
        {PROMISES.map((promise) => (
          <li key={promise} className="flex items-start gap-2.5 text-text-secondary">
            <Checkmark size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ok" />
            {promise}
          </li>
        ))}
      </ul>
      <PrivacyLink arrow className="mt-6" />
    </Band>
  );
}
