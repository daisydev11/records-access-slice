# PRD: Records & Access Slice

## 1. What This Is
A signed-in user can create notes, see a list of their own notes, open one, and delete one. It is a single flow whose purpose is to demonstrate ownership, access control and efficient data access.

## 2. Problem / Goal
Guarantee that one authenticated user can never read, list or delete another user's records, by any route, and be able to prove it with attack evidence and measurements.

## 3. Scope
In scope: list, create, detail, delete with confirmation, a true empty state, URL state for every view, an audit record for every deletion.

## 4. Screens
One workspace at `/records`, with three views:
- **List**: title, a create action, the user's notes (newest first), or the empty state.
- **Create**: a form with a title and a body.
- **Detail**: one note, with a delete action that asks for confirmation.

## 5. User Flows
1. Create: List → "New note" → fill in → Save → Detail of the new note.
2. View: List → select a note → Detail.
3. Delete: Detail → Delete → confirm → List, without the note.
4. Direct navigation: pasting any view's URL opens that view (after sign-in).

## 6. Behaviours
- A user sees only their own notes, everywhere.
- Views change without a full page load; the URL changes with the view; back and forward work.
- A deletion is recorded for audit before or together with the row's removal.
- No URL, response or markup contains a raw database identifier.
- With no notes, the list shows an empty state and a create action. No sample data.

## 7. Data Model
- `Note`: internal primary key (never exposed), `publicId` (unique, random, used in URLs and responses), `userId` (owner), `title`, `body`, `createdAt`. No `updatedAt`: notes are not editable.
- `AuditLog`: `actorUserId`, `action`, `recordPublicId`, `recordInternalId`, `recordTitle`, `createdAt`. Holds enough to identify what was deleted after the row is gone.

## 8. Engineering Requirements
- Every Note query is scoped to the authenticated user in the query itself.
- Index on the columns filtered and sorted on (`userId`, `createdAt`).
- Deletion and its audit record are atomic.
- Conditional views with URL state: `/records`, `/records?view=create`, `/records?record=<publicId>`.
- Server-side validation of all input from one shared schema.
- A measured query count for list, create and delete, before and after optimisation.

## 9. Security Requirements
- 401 when there is no valid session.
- 404 for a record that is not the caller's, whether or not it exists (see RULES.md, Status codes).
- 403 only for an authenticated request the server refuses to perform (cross-site origin).
- Authorisation never depends on an identifier being hard to guess.

## 10. Do Not Build
Landing page, editing, search, filtering, tags, sharing, collaboration, comments, notifications, favourites, dashboard widgets, analytics, settings, profile.

## 11. Evidence Requirements
1. Access-control audit table: two users, every route, what was attempted, every row passing.
2. Query-count table: list, create, delete, before and after, each query classified.
3. Screenshot of the audit log after a deletion.
4. Screenshot of a URL showing a public identifier.

## 12. Grading Bands
- Pass: ownership enforced everywhere, audit table complete and passing, deletions logged, URLs update with views, no raw identifiers exposed.
- Excellent: ownership by query scoping, not post-fetch checks; a meaningful, accurately classified query reduction; the documentation names the single change that would have prevented the most audit failures.

## 13. Defence Questions
1. Show a query and say what happens if the user condition is removed.
2. An identifier in the URL is changed to a guessed value: which layers stop it?
3. Which single change most reduced the query count, and why?
4. Why 403 and not 404, or the other way round?

## 14. Assumptions
- The domain is notes: the simplest record with meaningful content.
- Notes are private to one user; there is no concept of shared access.
- Authentication is the existing Assessment 1 implementation.
- No pagination: out of scope at this size, listed as a limitation.
