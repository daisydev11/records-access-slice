// Counts the SQL statements each main action sends to Postgres.
//   npm run build && npm run measure
// Starts the built server with QUERY_LOG=1 (statements are logged at the
// driver, so BEGIN/COMMIT and anything the ORM adds are included), performs
// each action as a real signed-in user over HTTP, and prints what was sent.
import { spawn } from "node:child_process";
import { createUser, pool, removeUser } from "./lib.mjs";

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const lines = [];
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, QUERY_LOG: "1" } });
server.stdout.on("data", (chunk) => lines.push(...String(chunk).split("\n").filter((l) => l.startsWith("[query]"))));
server.stderr.on("data", () => {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${BASE}/signin`);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error("Server did not start. Run `npm run build` first.");
}

async function measure(name, action) {
  await sleep(400);
  const from = lines.length;
  const result = await action();
  await sleep(400);
  const sent = lines.slice(from).map((l) => l.replace("[query] ", ""));
  console.log(`\n${name}: ${sent.length} statement${sent.length === 1 ? "" : "s"}`);
  sent.forEach((s, i) => console.log(`  ${i + 1}. ${s.length > 150 ? s.slice(0, 150) + "…" : s}`));
  return { result, count: sent.length };
}

let user;
try {
  await ready();
  user = await createUser("measure");
  const headers = { Cookie: user.cookie, "Content-Type": "application/json" };
  const post = (title) => fetch(`${BASE}/api/records`, { method: "POST", headers, body: JSON.stringify({ title, body: "Measured." }) }).then((r) => r.json());
  // Two notes to list, and a warm connection, before anything is measured.
  await post("First");
  await post("Second");
  await fetch(`${BASE}/records`, { headers });

  const counts = {};
  counts.List = (await measure("List    GET /records (the page)", () => fetch(`${BASE}/records`, { headers }).then((r) => r.text()))).count;
  const created = await measure("Create  POST /api/records", () => post("Third"));
  counts.Create = created.count;
  const id = created.result.note.publicId;
  counts.Detail = (await measure("Detail  GET /records?record=<publicId> (the page)", () => fetch(`${BASE}/records?record=${id}`, { headers }).then((r) => r.text()))).count;
  counts.Delete = (await measure("Delete  DELETE /api/records/<publicId>", () => fetch(`${BASE}/api/records/${id}`, { method: "DELETE", headers }).then((r) => r.json()))).count;
  console.log("\nSummary:", JSON.stringify(counts));
} finally {
  if (user) await removeUser(user);
  await pool.end();
  server.kill();
}
