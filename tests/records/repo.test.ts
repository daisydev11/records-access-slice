import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { db, dbSchema } from "@/lib/db";
import { notesFor } from "@/lib/records/repo";

// Two users, always. Ownership cannot be tested with one account.
const run = Date.now();
let userA: string;
let userB: string;

beforeAll(async () => {
  const make = (label: string) => db.user.create({ data: { email: `repo-${label}-${run}@test.local`, name: label, passwordHash: "x" }, select: { id: true } });
  userA = (await make("a")).id;
  userB = (await make("b")).id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorUserId: { in: [userA, userB] } } });
  await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await db.$disconnect();
});

describe("ownership", () => {
  it("a new user has a genuinely empty list", async () => {
    expect(await notesFor(userB).list()).toEqual([]);
  });

  it("A sees A's notes; B does not", async () => {
    const note = await notesFor(userA).create({ title: "A's plan", body: "private" });
    expect((await notesFor(userA).list()).map((n) => n.publicId)).toContain(note.publicId);
    expect(await notesFor(userB).list()).toEqual([]);
  });

  it("A can open A's note; B gets null for the same identifier", async () => {
    const note = await notesFor(userA).create({ title: "Readable by A", body: "" });
    expect(await notesFor(userA).get(note.publicId)).toMatchObject({ title: "Readable by A" });
    expect(await notesFor(userB).get(note.publicId)).toBeNull();
  });

  it("B cannot delete A's note: it stays, and nothing is written to the audit log", async () => {
    const note = await notesFor(userA).create({ title: "Not yours", body: "" });
    expect(await notesFor(userB).delete(note.publicId)).toBe(false);
    expect(await notesFor(userA).get(note.publicId)).not.toBeNull();
    expect(await db.auditLog.count({ where: { recordPublicId: note.publicId } })).toBe(0);
  });

  it("an unknown or malformed identifier finds nothing and deletes nothing", async () => {
    for (const id of ["AAAAAAAAAAAAAAAA", "1", "", "x' OR '1'='1", "a".repeat(500)]) {
      expect(await notesFor(userA).get(id)).toBeNull();
      expect(await notesFor(userA).delete(id)).toBe(false);
    }
  });
});

describe("public identifiers", () => {
  it("returns a 16-character publicId and never the internal id or the owner", async () => {
    const created = await notesFor(userA).create({ title: "Identifiers", body: "" });
    expect(created.publicId).toMatch(/^[A-Za-z0-9_-]{16}$/);
    for (const note of [created, await notesFor(userA).get(created.publicId), ...(await notesFor(userA).list())]) {
      expect(Object.keys(note!).sort()).toEqual(["body", "createdAt", "publicId", "title"]);
    }
  });

  it("the internal id does not work as an identifier", async () => {
    const created = await notesFor(userA).create({ title: "Internal", body: "" });
    const table = Prisma.raw(`"${dbSchema}"."Note"`);
    const internal = (await db.$queryRaw<{ id: number }[]>`SELECT "id" FROM ${table} WHERE "publicId" = ${created.publicId}`)[0].id;
    expect(await notesFor(userA).get(String(internal))).toBeNull();
  });
});

describe("audit", () => {
  it("a deletion removes the note and writes one audit row that still identifies it", async () => {
    const note = await notesFor(userA).create({ title: "To be deleted", body: "gone soon" });
    const before = new Date(Date.now() - 1000);
    expect(await notesFor(userA).delete(note.publicId)).toBe(true);
    expect(await notesFor(userA).get(note.publicId)).toBeNull();

    const audit = await db.auditLog.findMany({ where: { recordPublicId: note.publicId } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorUserId: userA, action: "NOTE_DELETED", recordTitle: "To be deleted" });
    expect(audit[0].recordInternalId).toBeGreaterThan(0);
    expect(audit[0].createdAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it("deleting twice, or twice at once, writes exactly one audit row", async () => {
    const note = await notesFor(userA).create({ title: "Double delete", body: "" });
    const results = await Promise.all([notesFor(userA).delete(note.publicId), notesFor(userA).delete(note.publicId), notesFor(userA).delete(note.publicId)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await notesFor(userA).delete(note.publicId)).toBe(false);
    expect(await db.auditLog.count({ where: { recordPublicId: note.publicId } })).toBe(1);
  });
});
