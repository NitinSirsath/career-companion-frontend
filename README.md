# Career Companion Frontend

This is the frontend repository for Career Companion.

## Foundation

- React 19
- Vite
- TypeScript
- TanStack Router
- TanStack Query
- Tailwind CSS v4
- shadcn/ui

## Setup

1. Make sure Node.js is installed.
2. Run `npm install` to install dependencies.
3. Ensure `.env` is created based on `.env.example`.
4. Run `npm run dev` to start the development server.

## Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run lint` - Run Oxlint
- `npm run test` - Run Vitest
- `npm run sync-contracts` - Syncs shared Zod contracts/types from the backend repository

## Architecture

This frontend is not a monorepo. Shared contracts are copied from the backend repository with `npm run sync-contracts`. The script uses `BACKEND_DIR`, else the sibling `../career-companion-backend-main`, else `../career-companion-backend`, and exits non-zero if none is found (a skip is never reported as success). Review the contract diff after syncing; never hand-edit `src/contracts`.

### Runtime contract validation

Application create/list/detail/status-PATCH and history responses are parsed at runtime with the synced Zod schemas in `src/api/client.ts`. Missing required fields, invalid enums/timestamps or inconsistent derived status are an `ApiError` of kind `contract` with a sanitized message; true `null` values stay valid. `ApiError` keeps the HTTP `status` and server `code`; `outcomeUncertain` is true for timeouts, network failures, 5xx and malformed success bodies, which callers reconcile by reading instead of resubmitting. Every request uses the shared 15-second deadline and forwards TanStack Query's `AbortSignal`.

### Status editor and evidence (Sprint 6)

The detail page's "Change status" editor freezes its draft and base revision; background refresh never rebases it. Saves are never retried automatically; 409 requires "Use current version"; uncertain outcomes re-read the application and fail safe to "Save outcome unknown". Cached detail/list data never accept an older manual revision (`src/lib/applicationCache.ts`). History shows "Recorded" and separate "Email date" labels in recording order.

### AI provider (ADR-0001)

`/ai` (nav "AI Provider") is where the user sets up their own AI account. Components live in `src/components/ai/`; copy and fixes for each access state are in `src/lib/aiLabels.ts`.
- **Page:** choose a curated provider, follow the guided key steps, paste the key, pick recommended or tested models, read what is sent and consent, then save and verify. The page also shows status with one fix, Career Companion's own counts and the safety limit, an optional sample test, switch and remove.
- **The key is write-only in the browser.** It lives only in an uncontrolled password field and one local variable during the save request, and the field is cleared at once and on unmount. It is never put in TanStack's query or mutation caches (save calls `api.saveAISettings` directly), the URL or storage. Tests assert this.
- **Elsewhere:**
  - an AI notice on the dashboard and Gmail page while access is not ready;
  - "Waiting for AI" for pending rows, which are not polled;
  - a "Retry anyway" dialog for uncertain outcomes, sent once and only after confirmation;
  - "Analyzed by <provider · model>" labels.
- Run the smoke with `SMOKE_SCREENSHOTS=<dir>` to save screenshots of the AI screens.

### Automation (ADR-0002)

`/automation` (nav "Automation") manages integration tokens for the user's own job-application automation, which reports confirmed submissions to the backend's MCP endpoint. Components live in `src/components/automation/`.
- **Token page:** create (name and expiry), show the plaintext once with a copy button and warning, list (prefix, status, last used, expiry, a warning in the last 14 days) and revoke after confirmation. The create API is called directly, never through a cached mutation; the plaintext lives only in component state and is dropped on "Done" or unmount. An uncertain create refreshes the list and is never resent.
- **Dashboard:** "Automation submissions to review", next to the email panels: link to an application (choose, then "Link"), create, or ignore. Fields are untrusted plain text; a job link is shown only for a stored `http`/`https` URL, with `rel="noopener noreferrer"`.
- **Status and timeline:** "Applied · via automation" shows only while the status source is `UNKNOWN` and `submittedVia` is set. The `AUTOMATION_SUBMITTED` event renders as "Submitted via automation" with separate "Submitted" and "Recorded" times, never as AI interpretation or missing email.
- The Vite dev server proxies `/mcp` to the backend, like `/api`, so the URL on the page works locally.
- Smoke: the MCP scenario uses `scripts/fixtures/mcp-daily-applications.{md,json}` and the official SDK client from the backend's dev dependencies.

## Verification

```bash
npm run sync-contracts
npm run typecheck
npm run lint
npm test
npm run build
SMOKE_DATABASE_URL=postgresql://…/career_companion_x_smoke_test node scripts/smoke-stabilization.mjs
```

The smoke runs real backend workers against an exclusive smoke database with deterministic Gmail/Gemini adapters and covers the Sprint 5 flow plus the browser-level Sprint 6 scenarios listed in the Sprint 6 execution report's coverage map (others are covered by component/backend tests). See the backend `STABILIZATION.md` for prerequisites, teardown order and the `SMOKE_INJECT` teardown checks.
