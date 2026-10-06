# Skill: records-security

Use when adding or changing anything that reads, lists or deletes a record.

1. **Authenticate.** In a route handler: `const auth = await requireUser(); if (auth.response) return auth.response;`. In a page: `getSessionUser()` and redirect if null.
2. **Get the scoped repository.** `const notes = notesFor(auth.user.id);`. You now cannot run a Note query without the user id.
3. **Write the query in `src/lib/records/repo.ts`**, never in the handler. Its `WHERE` must contain `userId`. For a lookup by identifier: `where: { publicId, userId }`.
4. **Never** load a row and then compare `row.userId`. If you are about to write that comparison, the query is wrong.
5. **Return only `PUBLIC_FIELDS`.** Never select or return `id`.
6. **Map "nothing found" to 404.** Do not try to tell "not yours" from "does not exist"; doing so needs an unscoped query.
7. **Status codes:** no session → 401. Not the caller's → 404. Cross-site origin → 403. Bad input → 422.
8. **Prove it.** Add the route to `scripts/access-control-audit.mjs` with: user B on user A's identifier, a guessed identifier, a malformed identifier, and no session. Run `npm run audit`.
