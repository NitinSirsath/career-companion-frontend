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

This frontend is not a monorepo. Shared contracts are synced manually from the backend repository using `npm run sync-contracts`, which assumes the backend is cloned as a sibling directory (`../career-companion-backend`).
