// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  FollowUpEditor,
  SnoozeControl,
  ArchiveControl,
} from "../components/FollowThrough";
import { api, ApiError } from "../api/client";
import { makeApplication } from "./fixtures";
import {
  applyAcknowledgedApplication,
  fetchApplicationsPage,
  preferNewerManualState,
} from "../lib/applicationCache";
import type { ActionWithContextResponse } from "../contracts";
vi.mock("../api/client", async (original) => ({
  ...(await original<typeof import("../api/client")>()),
  api: {
    createFollowUp: vi.fn(),
    editFollowUp: vi.fn(),
    followUpByRequest: vi.fn(),
    snoozeAction: vi.fn(),
    archiveApplication: vi.fn(),
    listApplications: vi.fn(),
  },
}));
const action: ActionWithContextResponse = {
  id: "action",
  applicationId: "app-1",
  emailId: null,
  type: "USER_FOLLOW_UP",
  description: "Follow up",
  deadline: null,
  deadlinePrecision: null,
  status: "PENDING",
  createdAt: "2026-10-03T00:00:00Z",
  origin: "USER",
  actionRevision: 3,
  clientRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  snoozedUntil: null,
  application: { companyName: "Fixture", jobTitle: null },
  email: null,
};
function show(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 3 } },
  });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return client;
}
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("creates personal work with a stable receipt and no provider request", async () => {
  vi.mocked(api.createFollowUp).mockResolvedValue(action);
  show(<FollowUpEditor applicationId="app-1" />);
  fireEvent.click(screen.getByRole("button", { name: "Add follow-up" }));
  fireEvent.change(screen.getByLabelText("Follow-up description"), {
    target: { value: "Thank the recruiter" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
  await waitFor(() => expect(api.createFollowUp).toHaveBeenCalledTimes(1));
  expect(api.createFollowUp).toHaveBeenCalledWith("app-1", {
    description: "Thank the recruiter",
    deadline: null,
    clientRequestId: expect.any(String),
  });
});
it("retains an uncertain draft across close/reopen and reconciles before a deliberate same-key retry", async () => {
  vi.mocked(api.createFollowUp)
    .mockRejectedValueOnce(new ApiError("lost", "network"))
    .mockResolvedValueOnce(action);
  vi.mocked(api.followUpByRequest).mockRejectedValue(
    new ApiError("not found", "http", 404),
  );
  show(<FollowUpEditor applicationId="app-1" />);
  fireEvent.click(screen.getByRole("button", { name: "Add follow-up" }));
  fireEvent.change(screen.getByLabelText("Follow-up description"), {
    target: { value: "One draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
  await screen.findByRole("button", { name: "Check saved follow-up" });
  expect(api.createFollowUp).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Resolve follow-up creation" }),
  );
  expect(screen.getByLabelText("Follow-up description")).toHaveValue(
    "One draft",
  );
  expect(screen.getByLabelText("Follow-up description")).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Check saved follow-up" }),
  );
  await screen.findByRole("button", { name: "Retry same request" });
  expect(api.createFollowUp).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Retry same request" }));
  await waitFor(() => expect(api.createFollowUp).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.createFollowUp).mock.calls[1]).toEqual(
    vi.mocked(api.createFollowUp).mock.calls[0],
  );
});
it("successful receipt lookup closes recovery without resubmission", async () => {
  vi.mocked(api.createFollowUp).mockRejectedValue(
    new ApiError("lost", "network"),
  );
  vi.mocked(api.followUpByRequest).mockResolvedValue(action);
  show(<FollowUpEditor applicationId="app-1" />);
  fireEvent.click(screen.getByRole("button", { name: "Add follow-up" }));
  fireEvent.change(screen.getByLabelText("Follow-up description"), {
    target: { value: "One draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Check saved follow-up" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(api.createFollowUp).toHaveBeenCalledTimes(1);
});
it("keeps a stale edit draft and blocks replay", async () => {
  vi.mocked(api.editFollowUp).mockRejectedValue(
    new ApiError("conflict", "http", 409),
  );
  show(<FollowUpEditor applicationId="app-1" action={action} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit follow-up" }));
  fireEvent.change(screen.getByLabelText("Follow-up description"), {
    target: { value: "My edit" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save follow-up" }),
    ).toBeDisabled(),
  );
  expect(screen.getByLabelText("Follow-up description")).toHaveValue("My edit");
  expect(api.editFollowUp).toHaveBeenCalledWith(
    "action",
    expect.objectContaining({ expectedActionRevision: 3 }),
  );
});
it("unsnoozes using the captured revision without sending a deadline change", async () => {
  vi.mocked(api.snoozeAction).mockResolvedValue(action);
  show(
    <SnoozeControl
      action={{ ...action, snoozedUntil: "2099-10-03T00:00:00Z" }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Change snooze" }));
  fireEvent.click(screen.getByRole("button", { name: "Unsnooze" }));
  await waitFor(() =>
    expect(api.snoozeAction).toHaveBeenCalledWith("action", {
      expectedActionRevision: 3,
      snoozedUntil: null,
    }),
  );
});
it("archive acknowledges the new revision and removes the active list entry", async () => {
  const app = makeApplication();
  const archived = makeApplication({
    archivedAt: "2026-10-03T00:00:00Z",
    archiveRevision: 1,
  });
  vi.mocked(api.archiveApplication).mockResolvedValue(archived);
  const client = show(<ArchiveControl application={app} />);
  client.setQueryData(["applications", { archive: "active" }], {
    items: [app],
    metadata: { limit: 20, offset: 0, nextOffset: null },
  });
  fireEvent.click(screen.getByRole("button", { name: "Archive application" }));
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  await waitFor(() =>
    expect(client.getQueryData(["application", "app-1"])).toMatchObject({
      archiveRevision: 1,
    }),
  );
  expect(
    client.getQueryData(["applications", { archive: "active" }]),
  ).toMatchObject({ items: [] });
});
it("late reads cannot repaint a newer archive while independent manual status survives", async () => {
  const client = new QueryClient(),
    old = makeApplication(),
    archived = makeApplication({
      archiveRevision: 2,
      archivedAt: "2026-10-03T00:00:00Z",
    });
  applyAcknowledgedApplication(client, archived);
  expect(
    preferNewerManualState(
      archived,
      makeApplication({ userStatus: "OFFER", userStatusRevision: 5 }),
    ),
  ).toMatchObject({
    archiveRevision: 2,
    userStatusRevision: 5,
    archivedAt: archived.archivedAt,
  });
  vi.mocked(api.listApplications).mockResolvedValue({
    items: [old],
    metadata: { limit: 20, offset: 0, nextOffset: null },
  });
  await expect(
    fetchApplicationsPage(client, { offset: 0, limit: 20, archive: "active" }),
  ).rejects.toMatchObject({ kind: "contract" });
  expect(api.listApplications).toHaveBeenCalledTimes(2);
});
