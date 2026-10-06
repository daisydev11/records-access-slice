# RULES.md

Checkable engineering constraints. Each rule states how to verify it.

## Ownership
- **R1.** Every query on `Note` includes `userId = <authenticated user id>` in its `WHERE` clause (or sets it, for an insert).
  *Check:* read `src/lib/records/repo.ts`; every statement contains the user id.
- **R2.** `db.note` and the `"Note"` table are referenced only in `src/lib/records/repo.ts`.
  *Check:* `tests/security/scoping.test.ts` scans `src/` and fails on any other reference.
- **R3.** The repository is only obtainable as `notesFor(userId)`. No exported function accepts a record identifier without a user id.
  *Check:* the exports of `repo.ts`.

## Forbidden
- **R4.** No code fetches a note by identifier and then compares its owner. There is no "load then check `note.userId`" anywhere.
  *Check:* search `src/` for `.userId ===` and `.userId !==`.

## Public identifiers
- **R5.** `Note.id` (the internal primary key) never appears in an API response, a URL, rendered HTML or a client component's props.
  *Check:* `repo.ts` selects through one `PUBLIC_FIELDS` constant that omits `id`; `tests/records/repo.test.ts` asserts returned objects have no `id` key.
- **R6.** `publicId` is generated from the OS random source, is unique at the database level, and is the only identifier accepted from a client.
  *Check:* `src/lib/records/public-id.ts`; the unique index in the migration.
- **R7.** A public identifier is never treated as proof of access. R1 applies to every lookup by `publicId`.

## Audit
- **R8.** Every successful deletion writes exactly one `AuditLog` row, in the same atomic operation as the delete.
  *Check:* `deleteNote` in `repo.ts`; `tests/records/repo.test.ts`.
- **R9.** A deletion that removes nothing (wrong owner, unknown id) writes no audit row.
  *Check:* same tests.
- **R10.** The audit row stores the actor, the action, the record's public and internal identifiers, its title and the time, so it identifies the record after the row is gone. `AuditLog` has no foreign key to `Note`.

## Status codes
- **R11.** `401` when there is no valid session.
- **R12.** `404` for a record that is not the caller's. The same response whether the record belongs to someone else, never existed, or the identifier is malformed. The server does not know which, because the only query it runs is scoped.
- **R13.** `403` only when the caller is known and the request is refused for what it is: a cross-site origin.
- **R14.** `422` for input that fails validation; `201` for a create; `200` for a read or delete.
  *Check:* `evidence/access-control-audit.md` shows each status against each attempt.

## Indexing
- **R15.** Every column combination used to filter or sort has an index: `Note(userId, createdAt)` for the list, `Note(publicId)` unique for lookups, `AuditLog(actorUserId, createdAt)`.
  *Check:* the migration SQL.
- **R16.** No index exists that no query uses.

## URL state
- **R17.** Every view has a URL: `/records`, `/records?view=create`, `/records?record=<publicId>`. Loading that URL directly renders that view.
- **R18.** Changing view changes the URL through client-side navigation, so back and forward work and no full page load happens.

## Security testing
- **R19.** Access control is tested with two distinct users, against the HTTP boundary, by `npm run audit`.
- **R20.** Every route that takes a record identifier appears in the audit table.

## Scope
- **R21.** No editing, search, sharing, collaboration, tags, dashboard widgets or other feature absent from `PRD.md`.
- **R22.** No fake, sample or placeholder records anywhere, including in tests' leftovers shown to real users.
