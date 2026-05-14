# Agent guide — Code Class

Reference for AI assistants and engineers working in this repository. Explore paths below before making larger changes.

## Two main modules

| Module | Root | Stack | Role |
|--------|------|--------|------|
| **Client** | Repository root (`/`) | Vite, React 18, React Router, TanStack Query, shadcn/ui (Radix), Tailwind, Axios | SPA: auth, classes, assignments, tests, practice data, admin UI |
| **Server** | `/server` | Express, Prisma (PostgreSQL), Socket.io dependency present, Redis (ioredis), JWT, node-cron (present but jobs disabled in `index.ts`) | REST API under `/api/v1/*`, health checks, background validation scripts |

The client talks to the server only over HTTP (configured via `VITE_API_URL`, normalized in `src/config/apiBase.ts`). There is no shared TypeScript package between client and server; types are duplicated manually in `src/types/index.ts` vs Prisma-generated types on the server.

## Client layout (high level)

- `src/App.tsx` — routes; wraps app with `QueryClientProvider`, auth, theme, Radix `Toaster` (`@/hooks/use-toast`).
- `src/api/` — Axios instances and API wrappers (`axios.ts`, `admin-axios.ts`, domain modules).
- `src/context/` — `AuthContext`, `ThemeContext`.
- `src/pages/` — route-level screens.
- `src/components/` — UI primitives (`components/ui/`), feature components, layouts.
- `src/hooks/` — shared hooks.
- `public/data/` + `scripts/prepare-data.mjs` — CSV → `src/lib/questions.json` at prebuild.

### Client auth storage

- **`src/lib/authTokenStorage.ts`** — JWT `getAuthToken` / `setAuthToken` / `clearAuthToken`; prefers `localStorage`, falls back to `sessionStorage` when access is blocked. User-facing Axios (`src/api/axios.ts`) and `AuthContext` use these helpers, not raw `localStorage.getItem('token')`.
- **`src/lib/lastSignInStorage.ts`** — Client-only hint for which provider was used last (`GOOGLE` | `GITHUB` | `EMAIL_PASSWORD`). **Not** in the database. Key `code-class-last-sign-in-method`. Written from `AuthContext` after email/password login and from `OAuthCallbackPage` when the OAuth redirect hash includes `signInMethod=` (set in `server/src/api/auth/oauth.controller.ts`). Login/signup surfaces use it for badges (`OAuthBrandButtons`) and copy; safe to ignore for API work.

## Server layout (high level)

- `server/src/index.ts` — Express app, CORS (allowlist + `ADDITIONAL_CORS_ORIGINS`), compression, route mounting, **no WebSocket initialization** (commented as removed for memory).
- `server/src/api/` — Feature routers: `auth`, `classes`, `assignments`, `analytics`, `students`, `announcements`, `tests`, `monitoring`, `dsa-progress`, `admin`, **`portfolio`**.
- `server/src/services/` — Domain services (submissions, platforms, email, anti-cheat). WebSocket server code was removed (HTTP-only API).
- `server/src/lib/` — `prisma.ts`, `redis.ts` (real Redis or in-memory stub via `DISABLE_REDIS` / `USE_MEMORY_REDIS`).
- `server/prisma/schema.prisma` — **only** database schema and Prisma client generation (root-level `prisma/` stub was removed).

## Portfolio (student profiles)

- **Server**: `server/src/api/portfolio/` — `GET/PUT /api/v1/portfolio/me`, public slug, GitHub preview/readme, resume PDF parse, field suggest (`/me/suggest` — **`bio`**, **`roleTitle`**, or **`projectScaffold`** only), **bulk AI fill** `POST /me/fill-with-ai` (two Gemini calls in `portfolio.bulkFill.ts`; user-supplied key). Model id: `server/src/lib/geminiModel.ts` (`GEMINI_MODEL` env). **HTTP**: `server/src/index.ts` uses a longer `req`/`res` timeout for `/portfolio/me/fill-with-ai`, `/parse-resume`, and `/me/suggest` (`PORTFOLIO_AI_HTTP_TIMEOUT_MS`, default 300s). Optional `GEMINI_CALL_TIMEOUT_MS` per Gemini round-trip (see `server/supabase-env-template.txt`). **Hero JSON** validated by `portfolio.schema.ts` — no `tagline` or `currentFocus`; migration `20260519120000_strip_portfolio_hero_tagline_focus` strips those keys from existing `PortfolioProfile.content` rows.
- **Client**: `src/pages/portfolio/PortfolioStudioPage.tsx` (wizard + studio), `PublicPortfolioPage.tsx`, `src/components/portfolio/*`, `src/lib/portfolioMerge.ts` (draft merge, **`mergeBulkAiPortfolioFill`**, **`projectCardHookLine`** for featured tiles and dialog subtitle), `src/lib/studioGeminiKey.ts`, `src/api/portfolio.ts` (fill uses extended Axios timeout). **Featured cards** show title + hook + “View story”; the dialog uses the same hook, then **Intent** (`whyBuilt`), structured sections (**Motivation**, etc.), and story images — no separate long-form blurb field or legacy `longDescription` block in the UI.
- **Types**: `src/types/portfolio.ts` (client); server uses Prisma + `portfolio.schema.ts`.

## Configuration and env

- **Client**: `.env` / `.env.local` with `VITE_API_URL` (optional trailing path variants handled in `getApiV1BaseUrl()`). Hardcoded production fallback: `https://codeclass.up.railway.app/api/v1`.
- **Server**: `server/.env` — `DATABASE_URL`, optional `DIRECT_URL`, Redis variables, JWT secrets, OAuth, etc.
- **CORS**: Allowed origins are partially hardcoded in `server/src/index.ts` (localhost ports + Railway + Vercel); extend via `ADDITIONAL_CORS_ORIGINS` (comma-separated).

---

## Cleanup applied (recent)

- **API base URL** — `getApiV1BaseUrl()` is shared by `src/api/axios.ts`, `admin-axios.ts`, and `admin.ts`.
- **Root Prisma stub** — Removed unused root `prisma/schema.prisma`; only `server/prisma/schema.prisma` applies.
- **Client deps** — Removed unused `@prisma/client`, `prisma`, and `sonner` from root `package.json`.
- **Toasts** — Single Radix toast pipeline; assignment pages use `@/hooks/use-toast`; Sonner component removed.
- **React Query** — Sensible `defaultOptions` on `QueryClient` in `App.tsx`.
- **Classes API** — Dead duplicate `classes.controller.ts` removed; `checkClassSubmissionStatus` lives in `class.controller.ts`. Fixed `req.user` destructuring bug (`id` → `userId`) in that handler path.
- **Auth typing** — `server/src/types/express.d.ts` + typed JWT decode in `auth.middleware.ts`; removed widespread `@ts-expect-error` / `(prisma as any)` in touched controllers; **tests** controllers now use `req.user!.userId` (was incorrectly `.id`).
- **Assignments / DSA** — Corrected `req.user?.id` → `req.user!.userId`; fixed `updateAssignment` using wrong `id` field from JWT.
- **Tests routes** — Violation/session stubs moved to `tests.controller.ts`.
- **Redis** — `redis.ts` logs via `utils/logger` where appropriate.
- **WebSocket** — Deleted unused `websocket.service.ts`; diagnostic script updated.
- **Submissions / Prisma** — `checkClassSubmissionStatus` loads only students + credential fields (no unused assignments tree); one query instead of N+1 user fetches; static imports for platform checks. GFG processing loads bulk solved set once per user when needed; assignment GFG path uses `select` instead of full `include`. `lib/prisma.ts` applies pool hints via `datasourceUrl` for direct `postgres://` URLs only.

## Remaining backlog (optional)

1. **Manual DTO types** — `src/types/index.ts` vs Prisma; consider OpenAPI or a shared package later.
2. **Cron** — Still commented out in `index.ts`; remove commented import block when policy is final.
3. **Redis `MemoryRedis`** — Single-process only; production horizontal scaling needs real Redis (documented in env comments).
4. **Security review** — Axios 401 redirect vs admin token; profile/sanitize coverage for all JSON responses.
5. **ESLint** — May still traverse legacy `generated/` at repo root if present; extend ignore patterns if needed.

---

## Conventions for new work

- **API routes**: New endpoints go under `server/src/api/<feature>/`, mounted in `server/src/index.ts` with prefix `/api/v1/...`.
- **Auth**: `protect` / `isTeacher` / `isStudent` from `server/src/api/auth/auth.middleware.ts`.
- **Client API calls**: Prefer extending `src/api/*.ts` modules and the shared `src/api/axios.ts` instance for user JWT; admin flows use `admin-axios`.
- **Types**: When adding fields to persisted models, update Prisma schema **in `server/prisma`**, run generate/migrate, then update `src/types/index.ts` if the client needs them.
- **Paths**: Client imports use `@/` alias (see `vite.config.ts` / `tsconfig`).

---

## Useful commands

- Client dev: `npm run dev` (root)
- Client build: `npm run build` (runs `prepare-data.mjs` first)
- Server dev: `cd server && npm run dev`
- Server tests: `cd server && npm test`

---

## Exploration checklist (for agents)

1. Confirm which module you are changing (client vs server).
2. Find the route in `App.tsx` or `server/src/index.ts`, then trace to controller/service.
3. Check Prisma models in `server/prisma/schema.prisma` before assuming field names.
4. Verify env vars exist for the feature (client: `VITE_*`; server: `server/.env`).
5. After API changes, update client types and any affected `src/api/*` module.
