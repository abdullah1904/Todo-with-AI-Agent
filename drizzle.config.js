import "dotenv/config.js";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    output: "./drizzle",
    schema: "./src/db/schema.ts",
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL,
    }
});