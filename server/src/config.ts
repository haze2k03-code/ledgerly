import { z } from "zod";

// Load the shared .env from the repo root when running locally.
// In Docker the variables come from docker-compose, so a missing file is fine.
for (const path of ["../.env", ".env"]) {
  try {
    process.loadEnvFile(path);
    break;
  } catch {
    /* not found: try the next one */
  }
}

// Validate settings once at startup so the app fails fast with a clear message.
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const config = parsed.data;
