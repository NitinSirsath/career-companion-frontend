import { useState } from 'react';
import { parseSender } from '../../lib/mails';
import { Button } from '../ui/button';
import { SandboxThreadMailForm, type ThreadMailCopy } from './SandboxThreadMailForm';

const REPLY_COPY: ThreadMailCopy = {
  form: 'Reply',
  label: 'Your reply',
  hint: 'The earlier mail is quoted below your text. The app sees the reply after the next sync.',
  send: 'Send',
};

/**
 * Mail written in the open conversation. A reply is always the user's. The other person's next
 * mail has its own box, opened by a link, so the two are never mixed up.
 */
export function SandboxReplyForm({ threadId, party }: { threadId: string; party: string }) {
  const [writingNext, setWritingNext] = useState(false);

  return (
    <>
      <SandboxThreadMailForm threadId={threadId} as="me" copy={REPLY_COPY} />
      {writingNext ? (
        <SandboxThreadMailForm
          threadId={threadId}
          as="them"
          copy={{
            form: 'Next mail from the other person',
            title: `Next mail from ${party}`,
            label: 'Their mail',
            hint: 'It arrives in your inbox, in this conversation. The app sees it after the next sync.',
            send: `Send as ${parseSender(party).name}`,
          }}
          onClose={() => setWritingNext(false)}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-11 justify-start whitespace-normal break-words px-0 text-left text-text-primary underline hover:bg-transparent"
          onClick={() => setWritingNext(true)}
        >
          Write next mail from {party}
        </Button>
      )}
    </>
  );
}
