import { Prisma } from "@prisma/client";
import { db, dbSchema } from "@/lib/db";
import { newPublicId, PUBLIC_ID_PATTERN } from "@/lib/records/public-id";
import type { CreateNoteInput } from "@/lib/validation/records";

// THE ONLY FILE THAT MAY TOUCH THE NOTE TABLE (RULES.md R2).
//
// There is no way to get at notes except notesFor(userId), and every query
// below carries that userId in its WHERE clause. A route handler cannot
// "forget the ownership check", because there is no separate check to forget:
// the only query it can run is already scoped.

const noteTable = Prisma.raw(`"${dbSchema}"."Note"`);
const auditTable = Prisma.raw(`"${dbSchema}"."AuditLog"`);
const auditAction = Prisma.raw(`"${dbSchema}"."AuditAction"`);

// What a client may see. The internal primary key (id) is not in this list.
const PUBLIC_FIELDS = { publicId: true, title: true, body: true, createdAt: true } as const;

const SUMMARY_FIELDS = { publicId: true, title: true, createdAt: true } as const;

export type PublicNote = { publicId: string; title: string; body: string; createdAt: Date };
export type NoteSummary = Omit<PublicNote, "body">;

export function notesFor(userId: string) {
  return {
    /** The user's notes, newest first. Titles only: the list never shows the body. */
    list(): Promise<NoteSummary[]> {
      return db.note.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: SUMMARY_FIELDS });
    },

    /** One note, only if it is this user's. Null for anything else. */
    get(publicId: string): Promise<PublicNote | null> {
      if (!PUBLIC_ID_PATTERN.test(publicId)) return Promise.resolve(null);
      return db.note.findFirst({ where: { publicId, userId }, select: PUBLIC_FIELDS });
    },

    create(input: CreateNoteInput): Promise<PublicNote> {
      return db.note.create({ data: { ...input, userId, publicId: newPublicId() }, select: PUBLIC_FIELDS });
    },

    /**
     * Deletes one of this user's notes and records the deletion, in ONE
     * statement. The DELETE only matches a row with this publicId AND this
     * userId; the audit row is built from whatever that DELETE returned.
     *   - not this user's note, or no such note: nothing deleted, nothing logged
     *   - the audit insert fails: the statement fails, so the delete is undone
     * There is no moment at which the note is gone and the log does not say so.
     */
    async delete(publicId: string): Promise<boolean> {
      if (!PUBLIC_ID_PATTERN.test(publicId)) return false;
      const logged = await db.$executeRaw`
        WITH deleted AS (
          DELETE FROM ${noteTable} WHERE "publicId" = ${publicId} AND "userId" = ${userId}
          RETURNING "id", "publicId", "title"
        )
        INSERT INTO ${auditTable} ("actorUserId", "action", "recordPublicId", "recordInternalId", "recordTitle", "createdAt")
        SELECT ${userId}, 'NOTE_DELETED'::${auditAction}, "publicId", "id", "title", ${new Date()} FROM deleted`;
      return logged === 1;
    },
  };
}
