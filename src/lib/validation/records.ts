import { z } from "zod";

// One declaration of the input rules, imported by the form and by the route handler.
export const createNoteSchema = z.object({
  title: z
    .string({ required_error: "Enter a title.", invalid_type_error: "Enter a title." })
    .trim()
    .min(1, "Enter a title.")
    .max(120, "Use at most 120 characters."),
  body: z
    .string({ required_error: "Enter the note.", invalid_type_error: "Enter the note." })
    .max(5000, "Use at most 5,000 characters."),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
