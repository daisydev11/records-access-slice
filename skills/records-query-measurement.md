# Skill: records-query-measurement

1. **What is counted:** every SQL statement sent to Postgres during one user action, including `BEGIN` and `COMMIT`. The count is taken at the driver (`src/lib/db.ts`, enabled by `QUERY_LOG=1`), so nothing an ORM hides is missed.
2. **How:** `npm run measure` starts the built server with logging on, performs List, Create and Delete as a real signed-in user, and prints each action's statements.
3. **Classify every statement** as one of: authentication (who is this), authorisation + data (the scoped read or write), audit, transaction control, or overhead (work that returns nothing the response needs).
4. **Measure before optimising.** Record the first working version's numbers in `evidence/query-count.md` before changing anything.
5. **Optimise the overhead and the duplicates**, never the ownership condition. A change that drops `userId` from a query to save a statement is a security bug, not an optimisation.
6. **Measure again**, record both numbers and the commit they came from, and state which single change removed the most.
