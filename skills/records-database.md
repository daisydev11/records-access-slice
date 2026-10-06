# Skill: records-database

Use when changing the schema or writing a query.

1. **Schema** goes in `prisma/schema.prisma`; the SQL goes in a new folder under `prisma/migrations/`. Check constraints and anything Prisma cannot express are written by hand in that SQL.
2. **Two identifiers.** Internal `id` (autoincrement integer, primary key, joins only). `publicId` (random, unique, the only one a client sees).
3. **Ownership column.** `userId` is `NOT NULL` with a foreign key to `User`.
4. **Indexes follow queries.** Before adding one, name the query that uses it. List = `WHERE userId = ? ORDER BY createdAt DESC` → `(userId, createdAt)`.
5. **Deleting with audit** is one atomic operation. The current implementation is a single statement: a CTE deletes the owned row and inserts the audit row from what was deleted. Never delete, then log.
6. **Audit rows are self-contained.** They copy the identifiers and title. They hold no foreign key to the record.
7. **Count your queries.** Start the server with `QUERY_LOG=1` and watch `[query]` lines, or run `npm run measure`.
