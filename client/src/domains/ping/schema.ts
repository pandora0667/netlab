import { z } from "zod";

const MIN_PORT = 1;
const MAX_PORT = 65_535;
const MIN_ATTEMPTS = 1;
const MAX_ATTEMPTS = 10;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 5_000;

export const pingSchema = z.object({
  host: z.string().min(1, "Host is required"),
  type: z.enum(["icmp", "tcp"]),
  port: z.coerce
    .number()
    .int()
    .min(MIN_PORT, "Port must be between 1 and 65535")
    .max(MAX_PORT, "Port must be between 1 and 65535")
    .optional(),
  count: z.coerce
    .number()
    .int()
    .min(MIN_ATTEMPTS, "Attempts must be between 1 and 10")
    .max(MAX_ATTEMPTS, "Attempts must be between 1 and 10"),
  timeout: z.coerce
    .number()
    .int()
    .min(MIN_TIMEOUT_MS, "Timeout must be between 1-30 seconds")
    .max(MAX_TIMEOUT_MS, "Timeout must be between 1-30 seconds")
    .default(DEFAULT_TIMEOUT_MS),
});

export type PingFormData = z.infer<typeof pingSchema>;
