import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: process.env.ENV_FILE ?? ".env.local" });
config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Neither DIRECT_URL nor DATABASE_URL is configured. Please set DIRECT_URL (direct port 5432) or DATABASE_URL (transaction pooler) to your hosted Supabase PostgreSQL connection string."
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: connectionString },
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
