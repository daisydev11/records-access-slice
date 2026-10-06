import { randomBytes } from "node:crypto";

/**
 * The identifier a client sees for a record: 96 random bits as 16 URL-safe
 * characters. It replaces the internal primary key everywhere outside the
 * database. It is an address, not a permission: every lookup by it is still
 * scoped to the signed-in user.
 */
export function newPublicId(): string {
  return randomBytes(12).toString("base64url");
}

export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
