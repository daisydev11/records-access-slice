// Shared by the evidence scripts: database access and throwaway signed-in users.
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

try {
  process.loadEnvFile(".env");
} catch {}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
const schema = new URL(url).searchParams.get("schema") ?? "public";
export const pool = new pg.Pool({ connectionString: url });
export const t = (name) => `"${schema}"."${name}"`;

/** Creates a verified user with a live session, exactly as sign-in would leave them. */
export async function createUser(label) {
  const id = `audit_${label}_${randomBytes(6).toString("hex")}`;
  const token = randomBytes(32).toString("base64url");
  await pool.query(`INSERT INTO ${t("User")} ("id","email","name","passwordHash","emailVerifiedAt") VALUES ($1,$2,$3,'not-a-real-hash',now())`, [id, `${id.toLowerCase()}@audit.local`, `User ${label}`]);
  await pool.query(`INSERT INTO ${t("Session")} ("id","tokenHash","userId","expiresAt") VALUES ($1,$2,$3, now() + interval '1 hour')`, [`s_${id}`, createHash("sha256").update(token).digest("hex"), id]);
  return { id, label, cookie: `session=${token}` };
}

/** Removes a throwaway user and everything they own, including their audit rows. */
export async function removeUser(user) {
  await pool.query(`DELETE FROM ${t("AuditLog")} WHERE "actorUserId" = $1`, [user.id]);
  await pool.query(`DELETE FROM ${t("User")} WHERE "id" = $1`, [user.id]);
}
