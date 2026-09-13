import { z } from 'zod';

export const ApplicationStatusSchema = z.enum([
  'APPLIED',
  'RECRUITER_CONTACT',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'CLOSED',
]);

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const CreateApplicationRequestSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  jobTitle: z.string().optional(),
  location: z.string().optional(),
  appliedAt: z.string().datetime().optional().or(z.date().optional()),
});

export type CreateApplicationRequest = z.infer<typeof CreateApplicationRequestSchema>;

// ─── Recent event summary (embedded in list response) ──────────────────────

export const RecentEventSchema = z.object({
  type: z.string(),
  createdAt: z.string().or(z.date()),
});
export type RecentEvent = z.infer<typeof RecentEventSchema>;

// ─── ApplicationResponse ────────────────────────────────────────────────────

export const ApplicationResponseSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  jobTitle: z.string().nullable(),
  location: z.string().nullable(),
  aiStatus: ApplicationStatusSchema.nullable(),
  userStatus: ApplicationStatusSchema.nullable(),
  userStatusSetAt: z.string().nullable(),
  appliedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  recentEvent: RecentEventSchema.nullable(),
  pendingActionCount: z.number(),
});

export type ApplicationResponse = z.infer<typeof ApplicationResponseSchema>;

export const ListApplicationsResponseSchema = z.array(ApplicationResponseSchema);
export type ListApplicationsResponse = z.infer<typeof ListApplicationsResponseSchema>;

// ─── ApplicationEvent ────────────────────────────────────────────────────────

export const ApplicationEventResponseSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  emailId: z.string().nullable(),
  type: z.string(),
  oldState: ApplicationStatusSchema.nullable(),
  newState: ApplicationStatusSchema.nullable(),
  description: z.string().nullable(),
  provenance: z.string().nullable(),
  createdAt: z.string(),
});

export type ApplicationEventResponse = z.infer<typeof ApplicationEventResponseSchema>;
export type ListApplicationEventsResponse = ApplicationEventResponse[];

// ─── Action ─────────────────────────────────────────────────────────────────

export const ApplicationActionResponseSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  emailId: z.string().nullable(),
  type: z.string(),
  description: z.string().nullable(),
  deadline: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
});

export type ApplicationActionResponse = z.infer<typeof ApplicationActionResponseSchema>;
export type ListApplicationActionsResponse = ApplicationActionResponse[];
