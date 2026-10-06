# Discovery Report

Written before any Records code, from an inspection of the repository as it stood (the Assessment 1 authentication slice).

| Area | What exists | Consequence for this slice |
|---|---|---|
| Stack | Next.js 15 App Router, TypeScript (strict), Prisma 6 with the `pg` driver adapter, PostgreSQL. Confirmed in `package.json`. | Locked. No new framework, ORM or database. |
| Authentication | Database sessions. `getSessionUser()` in `src/lib/auth/session.ts` returns `{ id, name, email }` or `null` from an HttpOnly cookie. `src/middleware.ts` redirects cookie-less requests. | Reused as is. No second auth mechanism. |
| Database | `src/lib/db.ts` exports one Prisma client (`db`) and the schema name (`dbSchema`). Models: User, Session, VerificationCode, PasswordResetToken, RateLimit. Migrations are SQL files in `prisma/migrations/`. | New models go in the same schema file and a new migration folder. |
| API conventions | Route handlers under `src/app/api/`. `src/lib/http.ts` provides `errorResponse`, `parseBody` (Zod), `crossSiteRequest`. One error shape: `{ error: { code, message, fields? } }`. | Records routes use the same helpers and error shape. |
| Validation | Zod schemas in `src/lib/validation/`, imported by both forms and handlers. | Add `src/lib/validation/records.ts` in the same style. |
| UI | `src/app/globals.css` holds design tokens as CSS variables (`--bg`, `--accent`, ...). Reusable `Field` component with bound labels. No component library. | Reuse the tokens and `Field`. No new styling system. |
| Tests | Vitest, `tests/**/*.test.ts`, loads `.env`, can use the real database. | Records tests go in `tests/records/` and `tests/security/`. |
| Agent files | No `AGENTS.md`, PRD, rules or skills existed. | Created by this slice. |
| Scripts | `dev`, `build`, `typecheck`, `test`, `db:migrate`. | Add `audit` and `measure` scripts for the evidence. |

**Potential conflicts found**
- The root layout centred everything in a card (right for auth screens, wrong for a workspace). Resolved by moving the auth pages into an `(auth)` route group with their own layout; no auth logic changed.
- `/dashboard` was the post-sign-in destination. It is replaced by `/records`.

**Files expected to change:** `prisma/schema.prisma`, a new migration, `src/lib/db.ts` (query logging for measurement), `src/lib/http.ts` (a `requireUser` helper), `src/middleware.ts` (matcher), plus new files under `src/lib/records/`, `src/app/(app)/records/`, `src/app/api/records/`, `src/components/records/`.
