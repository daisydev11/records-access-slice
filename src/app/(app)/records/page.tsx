import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateNoteForm } from "@/components/records/CreateNoteForm";
import { DeleteNote } from "@/components/records/DeleteNote";
import { getSessionUser } from "@/lib/auth/session";
import { notesFor } from "@/lib/records/repo";

type Props = { searchParams: Promise<{ view?: string; record?: string }> };

const formatDate = (date: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC";

/**
 * One page, three views, chosen by the URL:
 *   /records                      the list
 *   /records?view=create          the create form
 *   /records?record=<publicId>    one note
 * Moving between them is client-side navigation (no full page load), and
 * because the view lives in the URL, each one can be bookmarked, shared,
 * reloaded, and reached with back and forward.
 */
export default async function RecordsPage({ searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const { view, record } = await searchParams;
  const notes = notesFor(user.id);
  const list = await notes.list();

  if (view === "create") {
    return (
      <div className="stack">
        <Link href="/records">← All notes</Link>
        <h1>New note</h1>
        <CreateNoteForm />
      </div>
    );
  }

  if (record) {
    const note = await notes.get(record);
    if (!note) {
      return (
        <div className="stack">
          <Link href="/records">← All notes</Link>
          <h1>Note not found</h1>
          <p className="lede">There is no note at this address in your account.</p>
        </div>
      );
    }
    return (
      <article className="stack">
        <Link href="/records">← All notes</Link>
        <h1>{note.title}</h1>
        <p className="hint">Created {formatDate(note.createdAt)}</p>
        {note.body ? <p className="note-body">{note.body}</p> : <p className="lede">This note has no text.</p>}
        <DeleteNote publicId={note.publicId} title={note.title} />
      </article>
    );
  }

  return (
    <div className="stack">
      <div className="title-row">
        <h1>Notes</h1>
        <Link className="button" href="/records?view=create">
          New note
        </Link>
      </div>
      {list.length === 0 ? (
        <div className="panel stack empty">
          <p>
            <strong>You have no notes yet.</strong>
          </p>
          <p className="lede">Notes you create appear here. Only you can see them.</p>
          <Link className="button" href="/records?view=create">
            Create your first note
          </Link>
        </div>
      ) : (
        <ul className="note-list">
          {list.map((note) => (
            <li key={note.publicId}>
              <Link href={`/records?record=${note.publicId}`}>{note.title}</Link>
              <span className="hint">{formatDate(note.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
