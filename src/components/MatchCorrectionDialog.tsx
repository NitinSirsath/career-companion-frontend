import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../api/client';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Pagination } from './ui/pagination';

export function MatchCorrectionDialog({ emailId, matchState, applicationId, label = 'Change link' }: {
  emailId: string; matchState: 'MATCHED' | 'IGNORED'; applicationId: string | null; label?: string;
}) {
  const client = useQueryClient();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [expected, setExpected] = useState({ expectedMatchState: matchState, expectedApplicationId: applicationId });
  const applications = useQuery({ queryKey: ['applications', 'match-picker', offset], queryFn: ({ signal }) => api.listApplications({ offset, limit: 20 }, { signal }), enabled: open });
  const refresh = async () => {
    await Promise.all(['workspace', 'agenda', 'gmailMessages', 'applications', 'actions', 'application', 'application-events', 'application-actions', 'unmatched-emails', 'ambiguous-emails'].map(key => client.invalidateQueries({ queryKey: [key] })));
  };
  const mutation = useMutation({
    mutationFn: () => api.correctEmailMatch(emailId, { ...expected, applicationId: selected === 'unlink' ? null : selected }),
    retry: false,
    onSuccess: async () => { await refresh(); setOpen(false); },
    onError: async error => {
      setProblem(isApiError(error) && error.code === 'MATCH_CONFLICT'
        ? "This email's link changed. The list is refreshing to show where it is now. Close this dialog and check the link."
        : isApiError(error) && error.status === 404
          ? 'This email or application is no longer available. Close this dialog and check the refreshed list.'
          : 'The change could not be confirmed. Check the refreshed link before trying again.');
      await refresh();
    },
  });
  const changeOpen = (value: boolean) => {
    if (mutation.isPending) return;
    if (value) { setSelected(''); setOffset(0); setProblem(null); setExpected({ expectedMatchState: matchState, expectedApplicationId: applicationId }); mutation.reset(); }
    setOpen(value);
  };
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="tertiary" size="sm">{label}</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Correct email link</DialogTitle></DialogHeader>
      <p className="text-sm text-text-secondary my-3">The old timeline entry stays marked as moved or unlinked. Handled actions stay handled. The old application's AI status is recalculated; your status choices do not change. No notification is sent.</p>
      {expected.expectedMatchState === 'MATCHED' && <p className="text-sm text-text-secondary mb-3">Unlinking also leaves later emails in this thread unlinked for review.</p>}
      <label htmlFor={id} className="text-sm font-medium">Application</label>
      <select id={id} className="mt-2 w-full border border-border bg-surface p-2" value={selected} disabled={mutation.isPending || !!problem} onChange={e => setSelected(e.target.value)}>
        <option value="">Choose an application</option>
        {expected.expectedMatchState === 'MATCHED' && <option value="unlink">Not linked to any application</option>}
        {(applications.data?.items ?? []).filter(a => a.id !== expected.expectedApplicationId).map(a => <option key={a.id} value={a.id}>{a.companyName}{a.jobTitle ? ` · ${a.jobTitle}` : ''}</option>)}
      </select>
      {applications.isLoading && <p className="text-sm">Loading applications…</p>}
      {applications.isError && <p role="alert">Could not load applications. Close and try again.</p>}
      {!mutation.isPending && <Pagination offset={offset} limit={20} hasNext={applications.data?.metadata.nextOffset != null} onPrevious={() => { setSelected(''); setOffset(Math.max(0, offset - 20)); }} onNext={() => { setSelected(''); setOffset(applications.data!.metadata.nextOffset!); }} />}
      {problem && <p role="alert" className="text-sm text-status-error mt-3">{problem}</p>}
      <DialogFooter>
        <Button variant="tertiary" disabled={mutation.isPending} onClick={() => changeOpen(false)}>Cancel</Button>
        <Button disabled={!selected || !!problem || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Save link'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
