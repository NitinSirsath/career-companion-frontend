import {
  deriveStatus,
  type ApplicationEventResponse,
  type ApplicationResponse,
} from '../contracts/application';

/** Valid canonical application: derived fields follow the shared rule unless overridden. */
export function makeApplication(overrides: Partial<ApplicationResponse> = {}): ApplicationResponse {
  const base = {
    id: 'app-1',
    archivedAt: null, archiveRevision: 0,
    companyName: 'Acme Corp',
    jobTitle: 'Senior Engineer',
    location: 'Remote',
    aiStatus: null,
    userStatus: null,
    userStatusSetAt: null,
    userStatusRevision: 0,
    appliedAt: '2026-01-15T00:00:00Z',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    recentEvent: null,
    pendingActionCount: 0,
    submittedVia: null,
    ...overrides,
  } as ApplicationResponse;
  return { ...base, ...deriveStatus(base.aiStatus, base.userStatus), ...pickDerived(overrides) };
}

function pickDerived(o: Partial<ApplicationResponse>) {
  const out: Partial<ApplicationResponse> = {};
  if ('effectiveStatus' in o) out.effectiveStatus = o.effectiveStatus;
  if ('statusSource' in o) out.statusSource = o.statusSource;
  if ('hasStatusConflict' in o) out.hasStatusConflict = o.hasStatusConflict;
  return out;
}

export function makeEvent(overrides: Partial<ApplicationEventResponse> = {}): ApplicationEventResponse {
  const createdAt = (overrides.createdAt as string | undefined) ?? '2026-02-01T10:00:00.000Z';
  return {
    id: 'evt-1',
    retiredAt: null,
    retiredReason: null,
    applicationId: 'app-1',
    emailId: null,
    type: 'EMAIL_PROCESSED',
    oldState: null,
    newState: 'RECRUITER_CONTACT',
    description: 'Received recruiter email',
    provenance: null,
    createdAt,
    recordedAt: new Date(createdAt).toISOString(),
    sourceEmail: null,
    analyzedBy: null,
    sourceSubmission: null,
    ...overrides,
  };
}

/** Workspace fixture counts are deliberately independent of page length when overridden. */
export function workspacePage(items: import('../contracts').ActionWithContextResponse[] = [], overrides: Partial<import('../contracts').WorkspaceActionsResponse> = {}): import('../contracts').WorkspaceActionsResponse {
  return { items, metadata: { limit: 20, offset: 0, nextOffset: null }, generatedAt: new Date().toISOString(), timeZone: 'Asia/Kolkata', nextTransitionAt: null,
    counts: { snoozed: 0, overdue: 0, today: 0, later: 0, undated: items.length, totalPending: items.length }, ...overrides };
}
