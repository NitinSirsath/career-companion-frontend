import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { api } from '../api/client';
import { CreateApplicationRequestSchema, CreateApplicationRequest } from '../contracts/application';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export const Route = createFileRoute('/applications')({
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const queryClient = useQueryClient();

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.listApplications(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateApplicationRequest) => api.createApplication(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      form.reset();
    },
  });

  const form = useForm<CreateApplicationRequest>({
    resolver: zodResolver(CreateApplicationRequestSchema),
    defaultValues: {
      companyName: '',
      jobTitle: '',
      location: '',
      appliedAt: '',
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    createMutation.mutate(data);
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Applications</h2>
      </div>

      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
        <h3 className="text-lg font-medium mb-4">New Application</h3>
        
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                placeholder="Linear"
                {...form.register('companyName')}
              />
              {form.formState.errors.companyName && (
                <p className="text-sm text-destructive font-medium">
                  {form.formState.errors.companyName.message}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                placeholder="Frontend Engineer"
                {...form.register('jobTitle')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="Remote"
                {...form.register('location')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appliedAt">Applied At</Label>
              <Input
                id="appliedAt"
                type="datetime-local"
                {...form.register('appliedAt', {
                  setValueAs: (v) => v === "" ? undefined : new Date(v).toISOString()
                })}
              />
            </div>
          </div>

          {createMutation.isError && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium">
              Error creating application: {createMutation.error.message}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save Application'}
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground border rounded-xl border-dashed">
            Loading applications...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive border-destructive/20 border rounded-xl bg-destructive/5">
            Failed to load applications: {error.message}
          </div>
        ) : !applications?.length ? (
          <div className="p-12 text-center text-muted-foreground border rounded-xl border-dashed">
            No applications yet. Track your first job application above.
          </div>
        ) : (
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{app.companyName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{app.jobTitle || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">
                        {app.userStatus || 'APPLIED'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {app.appliedAt ? format(new Date(app.appliedAt), 'MMM d, yyyy') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
