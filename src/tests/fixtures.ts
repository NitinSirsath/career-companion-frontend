import {
  deriveStatus,
  type ApplicationEventResponse,
  type ApplicationResponse,
} from '../contracts/application';
import type { Conversation, ConversationMail } from '../contracts/conversation';
import type { MailMessage } from '../contracts/mailbox';

/** Valid canonical application: derived fields follow the shared rule unless overridden. */
export function makeApplication(overrides: Partial<ApplicationResponse> = {}): ApplicationResponse {
  const base = {
    id: 'app-1',
    archivedAt: null,
    archiveRevision: 0,
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
    automation: null,
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

export function makeEvent(
  overrides: Partial<ApplicationEventResponse> = {},
): ApplicationEventResponse {
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
export function workspacePage(
  items: import('../contracts').ActionWithContextResponse[] = [],
  overrides: Partial<import('../contracts').WorkspaceActionsResponse> = {},
): import('../contracts').WorkspaceActionsResponse {
  return {
    items,
    metadata: { limit: 20, offset: 0, nextOffset: null },
    generatedAt: new Date().toISOString(),
    timeZone: 'Asia/Kolkata',
    nextTransitionAt: null,
    counts: {
      snoozed: 0,
      overdue: 0,
      today: 0,
      later: 0,
      undated: items.length,
      totalPending: items.length,
    },
    ...overrides,
  };
}

/** A new job-mail conversation with an open request and no application yet. */
export function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    key: 'thread-1',
    threadId: 'thread-1',
    subject: 'Interview: first round availability',
    sender: 'Priya Nair <priya.nair@northwind.example>',
    lastReceivedAt: '2026-10-11T05:12:00.000Z',
    mailCount: 1,
    sentCount: 0,
    isNew: true,
    category: 'INTERVIEW',
    company: 'Northwind Robotics',
    role: 'Senior Platform Engineer',
    interview: null,
    assessmentDeadline: null,
    request: {
      emailId: '11111111-1111-4111-8111-111111111111',
      state: 'OPEN',
      kind: 'ACTION',
      text: 'Send your available dates',
      deadline: '2026-10-13T00:00:00.000Z',
      deadlinePrecision: 'DATE',
      repliedAt: null,
    },
    link: 'UNLINKED',
    application: null,
    analyzedBy: { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
    ...overrides,
  };
}

/** What the AI read from the one mail of `makeConversation`. */
export function makeConversationMail(overrides: Partial<ConversationMail> = {}): ConversationMail {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    gmailMessageId: 'message-1',
    subject: 'Interview: first round availability',
    sender: 'Priya Nair <priya.nair@northwind.example>',
    receivedAt: '2026-10-11T05:12:00.000Z',
    category: 'INTERVIEW',
    company: 'Northwind Robotics',
    role: 'Senior Platform Engineer',
    recruiterName: 'Priya Nair',
    recruiterEmail: null,
    interviewStage: 'First round',
    interviewType: 'video',
    interviewDate: null,
    interviewTime: null,
    assessmentInfo: null,
    assessmentDeadline: null,
    offerInfo: null,
    rejectionInfo: null,
    requestedAction: 'Dates and times you are free next week',
    actionDeadline: 'Oct 13',
    followUpDate: null,
    analyzedBy: { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
    ...overrides,
  };
}

/** One message of a live Gmail thread, received by the user. */
export function makeMailMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'message-1',
    from: 'Priya Nair <priya.nair@northwind.example>',
    to: 'me@example.com',
    cc: null,
    date: '2026-10-11T05:12:00.000Z',
    subject: 'Interview: first round availability',
    labels: ['Inbox'],
    sentByUser: false,
    text: 'Could you share the dates you are free next week?',
    html: null,
    truncated: false,
    attachments: [],
    ...overrides,
  };
}
