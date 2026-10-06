"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/auth/Field";
import { createNoteSchema } from "@/lib/validation/records";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/auth";

export function CreateNoteForm() {
  const router = useRouter();
  const bodyId = useId();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    // Same schema the server uses. This copy is for speed; the server decides.
    const parsed = createNoteSchema.safeParse({ title, body });
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 201) {
        // The view changes by changing the URL.
        router.push(`/records?record=${data.note.publicId}`);
        router.refresh();
        return;
      }
      if (data?.error?.fields) setErrors(data.error.fields);
      else setFormError(response.status === 401 ? "Your session has ended. Sign in again." : (data?.error?.message ?? "The note was not saved."));
    } catch {
      setFormError("Could not reach the server. The note was not saved.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="note-form">
      <Field label="Title" name="title" type="text" maxLength={120} value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} />
      <div className="field">
        <label htmlFor={bodyId}>Note</label>
        <textarea
          id={bodyId}
          rows={8}
          maxLength={5000}
          value={body}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? `${bodyId}-error` : undefined}
          onChange={(e) => setBody(e.target.value)}
        />
        {errors.body && (
          <p id={`${bodyId}-error`} className="field-error" role="alert">
            {errors.body}
          </p>
        )}
      </div>
      {formError && (
        <p className="alert" role="alert">
          {formError}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save note"}
      </button>
    </form>
  );
}
