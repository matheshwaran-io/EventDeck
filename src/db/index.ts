import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __uemsSql?: ReturnType<typeof postgres> };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Please set DATABASE_URL in your environment to your hosted Supabase PostgreSQL connection string (e.g. postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres)."
    );
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    throw new Error(
      "DATABASE_URL is invalid: an HTTP(S) URL was provided. DATABASE_URL must be a PostgreSQL connection string (postgresql://...), not the Supabase project API URL."
    );
  }
  // prepare:false keeps us compatible with Supabase's transaction pooler (port 6543).
  // max_pipeline:1 sends one query per connection at a time without pipelining:
  // postgres.js otherwise pipelines extra queries onto busy connections (default 100),
  // which hangs or mixes up results through the transaction pooler.
  // Note: max_pipeline must be at least 1, otherwise (0) postgres.js short-circuits
  // internal onexecute handlers and throws UNSAFE_TRANSACTION on db.transaction().
  const options = { prepare: false, max_pipeline: 1, max: process.env.NODE_ENV === "production" ? 5 : 10 };
  return postgres(url, options);
}

const client = globalForDb.__uemsSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__uemsSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
export { schema };
