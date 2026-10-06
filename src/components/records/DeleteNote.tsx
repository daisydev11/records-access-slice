"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Delete with a confirmation step. Receives the public identifier only. */
export function DeleteNote({ publicId, title }: { publicId: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/records/${encodeURIComponent(publicId)}`, { method: "DELETE" });
      // 404 means it is already gone, which is the state the user asked for.
      if (response.ok || response.status === 404) {
        router.replace("/records");
        router.refresh();
        return;
      }
      setError(response.status === 401 ? "Your session has ended. Sign in again." : "The note was not deleted.");
    } catch {
      setError("Could not reach the server. The note was not deleted.");
    }
    setPending(false);
  }

  if (!confirming) {
    return (
      <button type="button" className="secondary" onClick={() => setConfirming(true)}>
        Delete note
      </button>
    );
  }
  return (
    <div className="panel stack" role="group" aria-label="Confirm deletion">
      <p>
        <strong>Delete “{title}”?</strong> This cannot be undone.
      </p>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="button" className="danger" onClick={remove} disabled={pending}>
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button type="button" className="secondary" onClick={() => setConfirming(false)} disabled={pending}>
          Keep note
        </button>
      </div>
    </div>
  );
}
