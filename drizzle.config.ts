import { defineConfig } from "drizzle-kit";

const path = process.env.DATABASE_PATH ?? "./data/atgpt.db";
const url = /^(file|libsql|https?):/.test(path) ? path : `file:${path}`;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url },
});
