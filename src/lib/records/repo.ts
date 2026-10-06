import { db } from "@/lib/db";
import { newPublicId, PUBLIC_ID_PATTERN } from "@/lib/records/public-id";
import type { CreateNoteInput } from "@/lib/validation/records";

// THE ONLY FILE THAT MAY TOUCH THE NOTE TABLE (RULES.md R2).
//
// There is no way to get at notes except notesFor(userId), and every query
// below carries that userId in its WHERE clause. A route handler cannot
// "forget the ownership check", because there is no separate check to forget:
// the only query it can run is already scoped.

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
     * Deletes one of this user's notes and records the deletion.
     * Returns false if there was no such note for this user.
     */
    async delete(publicId: string): Promise<boolean> {
      if (!PUBLIC_ID_PATTERN.test(publicId)) return false;
      const note = await db.note.findFirst({ where: { publicId, userId }, select: { id: true, publicId: true, title: true } });
      if (!note) return false;
      // Audit row and delete commit together or not at all.
      await db.$transaction([
        db.auditLog.create({
          data: { actorUserId: userId, action: "NOTE_DELETED", recordPublicId: note.publicId, recordInternalId: note.id, recordTitle: note.title },
        }),
        db.note.deleteMany({ where: { id: note.id, userId } }),
      ]);
      return true;
    },
  };
}
