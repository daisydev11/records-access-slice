import { NextResponse } from "next/server";
import { crossSiteRequest, parseBody, requireUser } from "@/lib/http";
import { notesFor } from "@/lib/records/repo";
import { createNoteSchema } from "@/lib/validation/records";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response; // 401: we do not know who is asking
  return NextResponse.json({ notes: await notesFor(auth.user.id).list() });
}

export async function POST(request: Request) {
  const blocked = crossSiteRequest(request);
  if (blocked) return blocked; // 403: we may know who, and refuse the request for what it is
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const body = await parseBody(request, createNoteSchema);
  if (body.response) return body.response; // 422
  // The owner is the session's user. A userId in the request body is not read at all.
  const note = await notesFor(auth.user.id).create(body.data);
  return NextResponse.json({ note }, { status: 201 });
}
