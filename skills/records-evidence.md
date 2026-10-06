# Skill: records-evidence

Evidence is produced by running the system. Nothing is typed in by hand.

| Artifact | How it is produced |
|---|---|
| `evidence/access-control-audit.md` | `npm run audit` against a running server. The script writes the table from the real responses. |
| `evidence/query-count.md` | `npm run measure` for the numbers; before and after are both recorded, with commits. |
| `evidence/screenshots/audit-log-after-deletion.png` | Delete a note, then view the `AuditLog` table (`npx prisma studio`). |
| `evidence/screenshots/url-public-identifier.png` | Open a note; capture the browser with the address bar showing `?record=<publicId>`. |

Checklist before submitting: every audit row says PASS; two users were used; each row says what was attempted, not only the result; the query table has before, after and a classification per statement; both screenshots exist and are readable.
