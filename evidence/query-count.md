# Query Count

Measured with `npm run measure` (`scripts/measure-queries.mjs`). The script starts the built server with `QUERY_LOG=1`, which logs every statement at the Postgres driver, so `BEGIN`, `COMMIT` and anything the ORM adds are counted. Each action is performed over HTTP as a real signed-in user.

- **Before:** commit `85cb21c`, the first working version.
- **After:** commit `4a826b4`.

## Summary

| Action | Before | After | Reduction |
|---|---|---|---|
| List (`GET /records`, the page) | 5 | 2 | −3 (60%) |
| Create (`POST /api/records`) | 3 | 2 | −1 (33%) |
| Delete (`DELETE /api/records/<publicId>`) | 7 | 2 | −5 (71%) |
| **Three main actions together** | **15** | **6** | **−9 (60%)** |
| Detail (`GET /records?record=<publicId>`, the page), measured as well | 6 | 2 | −4 (67%) |

## Every statement, classified

| Action | Query | Purpose | Before | After | Reduction |
|---|---|---|---|---|---|
| List | `SELECT … FROM "Session" WHERE tokenHash = $1 AND expiresAt > $2` | Authentication (layout) | 1 | merged | |
| List | `SELECT … FROM "User" WHERE id IN ($1)` | Authentication, second half of the same lookup | 1 | merged | |
| List | `SELECT … FROM "Session" …` again | **Duplicate**: the page repeated the layout's lookup | 1 | 0 | |
| List | `SELECT … FROM "User" …` again | **Duplicate** | 1 | 0 | |
| List | `SELECT u.id, u.name, u.email FROM "Session" s JOIN "User" u … WHERE s.tokenHash = $1 AND s.expiresAt > $2` | Authentication, one statement, once per request | 0 | 1 | |
| List | `SELECT publicId, title, createdAt FROM "Note" WHERE userId = $1 ORDER BY createdAt DESC` | Authorisation + data (scoped list) | 1 | 1 | |
| | | **List total** | **5** | **2** | **−3** |
| Create | `SELECT … FROM "Session" …` | Authentication | 1 | merged | |
| Create | `SELECT … FROM "User" …` | Authentication, second half | 1 | merged | |
| Create | `SELECT … FROM "Session" s JOIN "User" u …` | Authentication, one statement | 0 | 1 | |
| Create | `INSERT INTO "Note" (publicId, userId, title, body, createdAt) … RETURNING …` | Data write, owner set from the session | 1 | 1 | |
| | | **Create total** | **3** | **2** | **−1** |
| Delete | `SELECT … FROM "Session" …` | Authentication | 1 | merged | |
| Delete | `SELECT … FROM "User" …` | Authentication, second half | 1 | merged | |
| Delete | `SELECT … FROM "Session" s JOIN "User" u …` | Authentication, one statement | 0 | 1 | |
| Delete | `SELECT id, publicId, title FROM "Note" WHERE publicId = $1 AND userId = $2` | Authorisation (scoped lookup before deleting) | 1 | merged | |
| Delete | `BEGIN` | Transaction control | 1 | 0 | |
| Delete | `INSERT INTO "AuditLog" …` | Audit | 1 | merged | |
| Delete | `DELETE FROM "Note" WHERE id = $1 AND userId = $2` | Data write (scoped) | 1 | merged | |
| Delete | `COMMIT` | Transaction control | 1 | 0 | |
| Delete | `WITH deleted AS (DELETE FROM "Note" WHERE publicId = $1 AND userId = $2 RETURNING …) INSERT INTO "AuditLog" … SELECT … FROM deleted` | Authorisation + data write + audit, one atomic statement | 0 | 1 | |
| | | **Delete total** | **7** | **2** | **−5** |

## What each change removed

Measured after each change, one commit per change.

| Commit | Change | List | Create | Detail | Delete |
|---|---|---|---|---|---|
| `85cb21c` | First working version | 5 | 3 | 6 | 7 |
| `66cddb8` | Session and user read in one JOIN | 3 | 2 | 4 | 6 |
| `2a40ba3` | Session resolved once per request (`cache()`) | 2 | 2 | 3 | 6 |
| `8167dce` | Each view loads only what it shows | 2 | 2 | 2 | 6 |
| `4a826b4` | Delete and audit in one statement | 2 | 2 | 2 | 2 |

## Which single change did the most, and why

**Reading the session and its user in one JOIN** (`66cddb8`): 6 statements across the four measured actions (List −2, Create −1, Detail −2, Delete −1), and 4 across the three main ones. It wins because authentication runs on every request, so a cost there is multiplied by everything the application does, and on pages it was being paid twice. The cause was invisible in the code: one Prisma call with a nested `select` looked like one query and was sent as two.

For a single action, the largest saving was the **single-statement delete** (`4a826b4`): Delete went from 6 to 2, removing the separate lookup, `BEGIN` and `COMMIT`. It ties with the JOIN on the three main actions (4 each) and is the more valuable change for correctness, because the delete and its audit row can no longer be separated.

No ownership condition was removed to save a statement. Every Note statement in the "after" column still carries `userId`.
