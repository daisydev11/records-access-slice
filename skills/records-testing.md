# Skill: records-testing

1. **Always two users.** A test with one account proves nothing about ownership. Create user A and user B, give A a record, act as B.
2. **Repository level** (`tests/records/repo.test.ts`, Vitest, real database): A sees own; B's list excludes A's; B's get returns null; B's delete returns false and leaves the row and writes no audit row; A's delete removes the row and writes one audit row with the right actor, identifiers and title.
3. **Structure** (`tests/security/scoping.test.ts`): fails if any file other than the repository touches the Note table.
4. **HTTP level** (`npm run audit`, needs the server running): real requests with real session cookies. This is the test that counts, because it attacks the boundary an attacker reaches.
5. **Attacks to include for every identifier route:** another user's valid identifier; an identifier edited by one character; a made-up identifier; a malformed one; the internal numeric id; the same request replayed after deletion; no cookie; a forged cookie.
6. **Never** delete or weaken one of these to get a green run.
