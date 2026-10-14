import { config } from "dotenv";

// Loads .env.local by default (hosted Supabase configuration)
config({ path: process.env.ENV_FILE ?? ".env.local" });
config();
