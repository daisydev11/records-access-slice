import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolClient } from "pg";

function readDatabaseUrl(): { connectionString: string; schema: string } {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  // The node-postgres driver ignores Prisma's ?schema= parameter, so it is
  // read here and handed to the adapter explicitly.
  const schema = new URL(url).searchParams.get("schema") ?? "public";
  if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) throw new Error("Invalid schema name in DATABASE_URL.");
  return { connectionString: url, schema };
}

const { connectionString, schema } = readDatabaseUrl();

/** The Postgres schema this slice lives in. Used to qualify raw SQL. */
export const dbSchema = schema;

function createClient(): PrismaClient {
  const pool = new Pool({ connectionString });
  if (process.env.QUERY_LOG === "1") {
    // Measurement only. Every statement sent to Postgres is printed, counted
    // at the driver so that BEGIN, COMMIT and anything the ORM adds are included.
    pool.on("connect", (client: PoolClient) => {
      const run = client.query.bind(client) as (...args: unknown[]) => unknown;
      (client as unknown as { query: (...args: unknown[]) => unknown }).query = (...args: unknown[]) => {
        const first = args[0] as string | { text?: string };
        const text = typeof first === "string" ? first : (first?.text ?? "");
        console.log(`[query] ${text.replace(/\s+/g, " ").trim()}`);
        return run(...args);
      };
    });
  }
  return new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// One client per process. In development Next.js reloads modules on every
// edit, so the client is cached on globalThis to avoid exhausting connections.
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
