import { loadTestEnv } from "./env-guard";

// Integration tests only: unit tests never touch a database.
loadTestEnv("vitest");
