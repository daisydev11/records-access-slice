import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// RULES.md R2 and R4, enforced by reading the source. If someone adds a
// second place that queries notes, or a post-fetch ownership comparison,
// this fails before any attacker has the chance to find it.

const SRC = path.resolve(__dirname, "../../src");
const REPO = path.join("lib", "records", "repo.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const files = sourceFiles(SRC).map((file) => ({ file: path.relative(SRC, file), text: readFileSync(file, "utf8") }));

describe("query scoping", () => {
  it("only the repository touches the Note table", () => {
    const offenders = files.filter(({ file, text }) => file !== REPO && (/\b(db|tx|prisma)\.note\b/.test(text) || /"Note"/.test(text)));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("every statement in the repository carries the user id", () => {
    const repo = files.find(({ file }) => file === REPO)!.text;
    // Each Prisma call on notes, and each raw SQL statement naming the table.
    const prismaCalls = repo.match(/db\.note\.\w+\(\{[^;]*?\}\)/gs) ?? [];
    const rawStatements = repo.match(/\$(queryRaw|executeRaw)`[^`]*`/gs) ?? [];
    expect(prismaCalls.length + rawStatements.length).toBeGreaterThan(0);
    for (const statement of [...prismaCalls, ...rawStatements]) {
      expect(statement, `unscoped statement:\n${statement}`).toMatch(/userId/);
    }
  });

  it("nothing authorises by comparing an owner after fetching", () => {
    const offenders = files.filter(({ text }) => /\.userId\s*[!=]==?\s*/.test(text));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("the repository exposes notes only through notesFor(userId)", () => {
    const repo = files.find(({ file }) => file === REPO)!.text;
    const exported = [...repo.matchAll(/export (?:async )?(?:function|const) (\w+)/g)].map((m) => m[1]);
    expect(exported).toEqual(["notesFor"]);
  });
});
