# Frontend Repository Guidance

This repository contains the Career Companion React/TypeScript frontend.

Before changing API routes, API clients or API-facing behavior, read the canonical cross-cutting API contracts:
https://github.com/NitinSirsath/career-companion-docs/blob/main/docs/architecture/api-contracts.md

Feature-local requirements remain in the relevant feature specification and Linear issue.

Run the test suite with:
npm test   (runs `vitest run`)

## Code standards (read before writing code)

Full standards, with a file to copy for each job:
https://github.com/NitinSirsath/career-companion-docs/blob/main/docs/engineering/code-standards.md

- Routes (`src/routes/`): define the route and compose components. Logic goes into hooks and `src/lib/`.
- Data: never type a cache key by hand in a component. Use or add a key helper like `applicationKey()` in `lib/applicationCache.ts`.
- Decisions (labels, statuses, dates) are plain functions in `src/lib/` with unit tests, not logic inside JSX. Copy `lib/statusLabels.ts`.
- UI: use the parts in `src/components/ui/` (Button, Badge, NativeSelect, Dialog, Input), not raw elements.
- Forms: react-hook-form with `zodResolver` and the contract schema. Copy the create-application form in `routes/applications.tsx`.
- Contracts: never edit `src/contracts/` by hand. Run `npm run sync-contracts`.
- Build only what the ticket needs. One home per rule or constant. No nested ternaries, no `any`. Comments say why; no ticket IDs in code.
- Size is guidance: a component over ~80 lines or a file over ~500 lines is a sign to split. Explain exceptions in the PR.
- If code you must change breaks these standards, fix that part first in a separate refactor commit.
- No scratch files in commits: use the git-ignored `scratch/` folder.
- Formatting: Prettier (`.prettierrc`, same settings as the backend). Run `npm run format` before committing; CI fails on unformatted code.
- Before "done": npm run typecheck && npm run lint && npm run format:check && npm test && npm run build. List exceptions in the PR.
