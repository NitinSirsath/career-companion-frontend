import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useSandboxSenders, useSendSandboxMail } from '../../api/sandbox';
import { SendSandboxMailRequestSchema, type SendSandboxMailRequest } from '../../contracts/sandbox';
import { BODY_PROBLEM, FROM_PROBLEM, sandboxProblem } from '../../lib/sandbox';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

interface SandboxComposeFormProps {
  /** The user's sandbox address: a new mail always goes there. */
  mailbox: string;
  onSent: () => void;
  onDiscard: () => void;
}

/**
 * A new mail to the user from any address. "From" is picked from the addresses used before or
 * typed; a typed one is in the list after the mail is sent.
 */
export function SandboxComposeForm({ mailbox, onSent, onDiscard }: SandboxComposeFormProps) {
  const { data: senders } = useSandboxSenders();
  const send = useSendSandboxMail();
  const form = useForm<SendSandboxMailRequest>({
    resolver: zodResolver(SendSandboxMailRequestSchema),
    defaultValues: { from: '', subject: '', body: '' },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((input) => send.mutate(input, { onSuccess: onSent }));

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="New mail"
      className="max-w-3xl border border-border-strong"
    >
      <h2 className="bg-text-primary px-4 py-3 text-sm font-semibold text-text-inverse">
        New mail
      </h2>
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="compose-from">From</Label>
          <Input
            id="compose-from"
            list="compose-senders"
            autoComplete="off"
            placeholder="Priya Raman <priya.raman@northwind.example>"
            {...form.register('from')}
          />
          <datalist id="compose-senders">
            {(senders ?? []).map((sender) => (
              <option key={sender} value={sender} />
            ))}
          </datalist>
          <p className={`text-sm ${errors.from ? 'text-status-error' : 'text-text-secondary'}`}>
            {errors.from
              ? FROM_PROBLEM
              : 'Pick an address used before, or type any address, with or without a name. Nothing leaves the app.'}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="compose-to">To</Label>
          <Input id="compose-to" value={`Me <${mailbox}>`} disabled readOnly />
          <p className="text-sm text-text-secondary">A new mail always goes to your own inbox.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="compose-subject">Subject</Label>
          <Input id="compose-subject" autoComplete="off" {...form.register('subject')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="compose-body">Message</Label>
          <Textarea id="compose-body" rows={10} {...form.register('body')} />
          {errors.body && <p className="text-sm text-status-error">{BODY_PROBLEM}</p>}
        </div>
        {send.isError && (
          <p role="alert" className="text-sm text-status-error">
            {sandboxProblem(send.error)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4">
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? 'Sending…' : 'Send'}
          </Button>
          <Button type="button" variant="ghost" onClick={onDiscard}>
            Discard
          </Button>
          <p className="min-w-0 flex-1 text-sm text-text-secondary">
            The mail waits in the sandbox. The app sees it after the next sync.
          </p>
        </div>
      </div>
    </form>
  );
}
