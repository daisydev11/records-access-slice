import { NextResponse } from "next/server";
import { crossSiteRequest, errorResponse, requireUser } from "@/lib/http";
import { notesFor } from "@/lib/records/repo";

type Context = { params: Promise<{ publicId: string }> };

// One answer for "belongs to someone else", "never existed" and "malformed
// identifier". The scoped query cannot tell them apart, and the caller is not
// entitled to learn which it was.
const notFound = () => errorResponse(404, "NOT_FOUND", "No such note.");

export async function GET(_request: Request, { params }: Context) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const note = await notesFor(auth.user.id).get((await params).publicId);
  return note ? NextResponse.json({ note }) : notFound();
}

export async function DELETE(request: Request, { params }: Context) {
  const blocked = crossSiteRequest(request);
  if (blocked) return blocked;
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const deleted = await notesFor(auth.user.id).delete((await params).publicId);
  return deleted ? NextResponse.json({ ok: true }) : notFound();
}
