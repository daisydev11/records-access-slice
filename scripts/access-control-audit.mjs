// Access-control audit. Attacks every record route over HTTP as two real
// signed-in users and writes the results to evidence/access-control-audit.md.
//
//   npm run dev            (in one terminal)
//   npm run audit          (in another; pass a base URL to target elsewhere)
//
// Every row is a request that was actually sent. Nothing is typed in by hand.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createUser, pool, removeUser, t } from "./lib.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const rows = [];

async function send(user, method, path, { body, headers = {}, cookie } = {}) {
  const response = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: { ...(user ? { Cookie: cookie ?? user.cookie } : cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, text, json, location: response.headers.get("location") };
}

/** Records one attempt. `check` returns [passed, what actually happened]. */
async function attempt(who, method, shownPath, what, expected, run) {
  let passed = false;
  let actual = "";
  let status = "";
  try {
    const { response, check } = await run();
    status = response.status;
    [passed, actual] = await check(response);
  } catch (error) {
    actual = `Request failed: ${error.message}`;
  }
  rows.push({ who, method, path: shownPath, what, expected, actual, status, result: passed ? "PASS" : "FAIL" });
}

const noteExists = async (publicId) => (await pool.query(`SELECT 1 FROM ${t("Note")} WHERE "publicId" = $1`, [publicId])).rowCount === 1;
const auditRows = async (publicId) => (await pool.query(`SELECT "actorUserId","recordTitle","recordInternalId" FROM ${t("AuditLog")} WHERE "recordPublicId" = $1`, [publicId])).rows;

const A = await createUser("A");
const B = await createUser("B");
let failed = 0;
try {
  // User A owns two notes. Everything below is someone trying to reach them.
  const secret = `A-private-${randomBytes(4).toString("hex")}`;
  const first = (await send(A, "POST", "/api/records", { body: { title: `${secret} one`, body: "Only A may read this." } })).json.note;
  const second = (await send(A, "POST", "/api/records", { body: { title: `${secret} two`, body: "Only A may read this either." } })).json.note;
  const internalId = (await pool.query(`SELECT "id" FROM ${t("Note")} WHERE "publicId" = $1`, [first.publicId])).rows[0].id;
  const edited = first.publicId.slice(0, -1) + (first.publicId.endsWith("A") ? "B" : "A");
  const guessed = randomBytes(12).toString("base64url");
  const leaks = (r) => r.text.includes(secret);

  // ---------- List ----------
  await attempt("B", "GET", "/api/records", "List notes as B while A owns two", "200, none of A's notes", async () => ({
    response: await send(B, "GET", "/api/records"),
    check: (r) => [r.status === 200 && r.json.notes.length === 0 && !leaks(r), `${r.json?.notes?.length} notes returned, A's titles ${leaks(r) ? "PRESENT" : "absent"}`],
  }));
  await attempt("B", "GET", "/api/records?userId=<A's user id>", "Manipulated parameter: ask for A's list by user id", "200, parameter ignored, none of A's notes", async () => ({
    response: await send(B, "GET", `/api/records?userId=${A.id}`),
    check: (r) => [r.status === 200 && r.json.notes.length === 0 && !leaks(r), `${r.json?.notes?.length} notes returned, A's titles ${leaks(r) ? "PRESENT" : "absent"}`],
  }));
  await attempt("none", "GET", "/api/records", "List with no session cookie", "401", async () => ({
    response: await send(null, "GET", "/api/records"),
    check: (r) => [r.status === 401 && !leaks(r), r.json?.error?.code],
  }));
  await attempt("none", "GET", "/api/records", "List with a forged session cookie", "401", async () => ({
    response: await send(null, "GET", "/api/records", { cookie: "session=forged-value" }),
    check: (r) => [r.status === 401 && !leaks(r), r.json?.error?.code],
  }));
  await attempt("B", "GET", "/records", "Load the list page as B", "200, A's titles not in the HTML", async () => ({
    response: await send(B, "GET", "/records"),
    check: (r) => [r.status === 200 && !leaks(r), `A's titles ${leaks(r) ? "PRESENT" : "absent"} in the page`],
  }));
  await attempt("none", "GET", "/records", "Load the list page with no session", "Redirect to /signin", async () => ({
    response: await send(null, "GET", "/records"),
    check: (r) => [r.status === 307 && r.location?.endsWith("/signin"), `redirect to ${r.location}`],
  }));

  // ---------- Create ----------
  await attempt("none", "POST", "/api/records", "Create with no session", "401, nothing created", async () => ({
    response: await send(null, "POST", "/api/records", { body: { title: "anon", body: "" } }),
    check: (r) => [r.status === 401, r.json?.error?.code],
  }));
  await attempt("B", "POST", "/api/records", "Mass assignment: body claims userId = A, publicId = A's note, id = A's internal id", "201, owned by B, with a new identifier; A's data untouched", async () => {
    const response = await send(B, "POST", "/api/records", { body: { title: "B planted", body: "", userId: A.id, publicId: first.publicId, id: internalId } });
    return {
      response,
      check: async (r) => {
        const owner = (await pool.query(`SELECT "userId" FROM ${t("Note")} WHERE "publicId" = $1`, [r.json?.note?.publicId])).rows[0]?.userId;
        const aList = (await send(A, "GET", "/api/records")).json.notes;
        const ok = r.status === 201 && owner === B.id && r.json.note.publicId !== first.publicId && aList.length === 2 && !aList.some((n) => n.title === "B planted");
        return [ok, `created for ${owner === B.id ? "B" : "SOMEONE ELSE"}, new identifier ${r.json?.note?.publicId !== first.publicId ? "issued" : "REUSED"}, A still has ${aList.length} notes`];
      },
    };
  });
  await attempt("B", "POST", "/api/records", "Cross-site request: Origin header of another site", "403, nothing created", async () => ({
    response: await send(B, "POST", "/api/records", { body: { title: "csrf", body: "" }, headers: { Origin: "https://evil.example" } }),
    check: (r) => [r.status === 403, r.json?.error?.code],
  }));
  await attempt("B", "POST", "/api/records", "Invalid input: empty title, 6,000-character body", "422 with field errors", async () => ({
    response: await send(B, "POST", "/api/records", { body: { title: "  ", body: "x".repeat(6000) } }),
    check: (r) => [r.status === 422 && r.json.error.fields.title && r.json.error.fields.body, Object.keys(r.json?.error?.fields ?? {}).join(", ") + " rejected"],
  }));

  // ---------- Detail ----------
  const detailAttacks = [
    ["/api/records/<A's publicId>", first.publicId, "Direct request for A's note using its real public identifier"],
    ["/api/records/<A's publicId, last character edited>", edited, "Edited identifier"],
    ["/api/records/<random 16-character guess>", guessed, "Guessed identifier"],
    ["/api/records/<A's internal database id>", String(internalId), "Raw database identifier in place of the public one"],
    ["/api/records/<SQL injection string>", encodeURIComponent("x' OR '1'='1"), "Malformed identifier: SQL injection attempt"],
    ["/api/records/<400-character string>", "a".repeat(400), "Malformed identifier: oversized"],
  ];
  for (const [shown, value, what] of detailAttacks) {
    await attempt("B", "GET", shown, what, "404, no note data", async () => ({
      response: await send(B, "GET", `/api/records/${value}`),
      check: (r) => [r.status === 404 && !leaks(r), `${r.json?.error?.code}, A's content ${leaks(r) ? "PRESENT" : "absent"}`],
    }));
  }
  await attempt("none", "GET", "/api/records/<A's publicId>", "Direct request with no session", "401", async () => ({
    response: await send(null, "GET", `/api/records/${first.publicId}`),
    check: (r) => [r.status === 401 && !leaks(r), r.json?.error?.code],
  }));
  await attempt("B", "GET", "/records?record=<A's publicId>", "Paste A's note URL into B's browser", "Page says not found; A's content not in the HTML", async () => ({
    response: await send(B, "GET", `/records?record=${first.publicId}`),
    check: (r) => [r.status === 200 && !leaks(r) && r.text.includes("Note not found"), `"Note not found" shown, A's content ${leaks(r) ? "PRESENT" : "absent"}`],
  }));
  await attempt("A", "GET", "/api/records/<A's publicId>", "Owner reads own note; response inspected for the internal id", "200, with publicId and no internal id", async () => ({
    response: await send(A, "GET", `/api/records/${first.publicId}`),
    check: (r) => [r.status === 200 && r.json.note.publicId === first.publicId && !("id" in r.json.note) && !("userId" in r.json.note), `fields returned: ${Object.keys(r.json?.note ?? {}).join(", ")}`],
  }));
  for (const method of ["PUT", "PATCH"]) {
    await attempt("B", method, "/api/records/<A's publicId>", `Try to overwrite A's note with ${method}`, "405, method not supported", async () => ({
      response: await send(B, method, `/api/records/${first.publicId}`, { body: { title: "overwritten" } }),
      check: async (r) => [r.status === 405 && (await noteExists(first.publicId)), "no handler; A's note unchanged"],
    }));
  }

  // ---------- Delete ----------
  const stillThere = async (label) => `${label}; A's note ${(await noteExists(first.publicId)) ? "still exists" : "IS GONE"}; audit rows: ${(await auditRows(first.publicId)).length}`;
  const deleteAttacks = [
    ["/api/records/<A's publicId>", first.publicId, "Cross-user deletion using the real public identifier"],
    ["/api/records/<A's publicId, last character edited>", edited, "Deletion with an edited identifier"],
    ["/api/records/<A's internal database id>", String(internalId), "Deletion by raw database identifier"],
  ];
  for (const [shown, value, what] of deleteAttacks) {
    await attempt("B", "DELETE", shown, what, "404, note intact, no audit row", async () => ({
      response: await send(B, "DELETE", `/api/records/${value}`),
      check: async (r) => [r.status === 404 && (await noteExists(first.publicId)) && (await auditRows(first.publicId)).length === 0, await stillThere(r.json?.error?.code)],
    }));
  }
  await attempt("none", "DELETE", "/api/records/<A's publicId>", "Deletion with no session", "401, note intact", async () => ({
    response: await send(null, "DELETE", `/api/records/${first.publicId}`),
    check: async (r) => [r.status === 401 && (await noteExists(first.publicId)), await stillThere(r.json?.error?.code)],
  }));
  await attempt("A", "DELETE", "/api/records/<A's publicId>", "Cross-site request forgery: A's own cookie, another site's Origin", "403, note intact", async () => ({
    response: await send(A, "DELETE", `/api/records/${first.publicId}`, { headers: { Origin: "https://evil.example" } }),
    check: async (r) => [r.status === 403 && (await noteExists(first.publicId)), await stillThere(r.json?.error?.code)],
  }));
  await attempt("A", "DELETE", "/api/records/<A's publicId>", "Owner deletes own note", "200, note gone, one audit row naming A and the note", async () => ({
    response: await send(A, "DELETE", `/api/records/${first.publicId}`),
    check: async (r) => {
      const audit = await auditRows(first.publicId);
      const ok = r.status === 200 && !(await noteExists(first.publicId)) && audit.length === 1 && audit[0].actorUserId === A.id && audit[0].recordTitle === first.title && audit[0].recordInternalId === internalId;
      return [ok, `note gone; ${audit.length} audit row: actor ${audit[0]?.actorUserId === A.id ? "A" : "WRONG"}, title and internal id ${audit[0]?.recordTitle === first.title ? "recorded" : "MISSING"}`];
    },
  }));
  await attempt("A", "DELETE", "/api/records/<A's publicId>", "Replay the same delete request", "404, still exactly one audit row", async () => ({
    response: await send(A, "DELETE", `/api/records/${first.publicId}`),
    check: async (r) => [r.status === 404 && (await auditRows(first.publicId)).length === 1, `${r.json?.error?.code}; audit rows: ${(await auditRows(first.publicId)).length}`],
  }));
  await attempt("B", "DELETE", "/api/records/<A's deleted publicId>", "B replays A's delete request after it succeeded", "404, no new audit row", async () => ({
    response: await send(B, "DELETE", `/api/records/${first.publicId}`),
    check: async (r) => [r.status === 404 && (await auditRows(first.publicId)).length === 1, `${r.json?.error?.code}; audit rows: ${(await auditRows(first.publicId)).length}`],
  }));
  await attempt("A", "GET", "/api/records/<A's deleted publicId>", "Read a note after it was deleted", "404", async () => ({
    response: await send(A, "GET", `/api/records/${first.publicId}`),
    check: (r) => [r.status === 404, r.json?.error?.code],
  }));
  await attempt("A", "GET", "/api/records", "A's list after all of the above", "200, exactly A's one remaining note", async () => ({
    response: await send(A, "GET", "/api/records"),
    check: (r) => [r.status === 200 && r.json.notes.length === 1 && r.json.notes[0].publicId === second.publicId, `${r.json?.notes?.length} note, the untouched one`],
  }));
} finally {
  await removeUser(A);
  await removeUser(B);
  await pool.end();
}

failed = rows.filter((r) => r.result === "FAIL").length;
let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD").toString().trim();
} catch {}
const cell = (v) => String(v).replaceAll("|", "\\|");
const table = rows.map((r) => `| ${r.who} | ${r.method} | \`${cell(r.path)}\` | ${cell(r.what)} | ${cell(r.expected)} | ${cell(r.actual)} | ${r.status} | **${r.result}** |`).join("\n");
const markdown = `# Access-Control Audit

Generated by \`npm run audit\` (\`scripts/access-control-audit.mjs\`) on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC, against ${BASE}, at commit \`${commit}\`.

Two users were created for the run. **User A** owns two notes. **User B** is a different signed-in user. "none" is a request with no valid session. Every row is one real HTTP request; "Actual" is what the server did, checked against the database where it matters.

**${rows.length - failed} of ${rows.length} attempts passed.**

| User | Method | Path | Attempt | Expected | Actual | Status | Result |
|---|---|---|---|---|---|---|---|
${table}
`;
writeFileSync("evidence/access-control-audit.md", markdown);
console.log(rows.map((r) => `${r.result}  ${String(r.status).padEnd(3)} ${r.who.padEnd(4)} ${r.method.padEnd(6)} ${r.what}${r.result === "FAIL" ? `\n      expected: ${r.expected}\n      actual:   ${r.actual}` : ""}`).join("\n"));
console.log(`\n${rows.length - failed} of ${rows.length} passed. Written to evidence/access-control-audit.md`);
process.exit(failed ? 1 : 0);
