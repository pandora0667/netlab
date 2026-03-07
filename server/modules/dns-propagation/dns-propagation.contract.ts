import { z } from "zod";

const DOMAIN_PATTERN =
  /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;

const dnsPropagationRequestSchema = z.object({
  domain: z.string({ required_error: "Domain name is required" })
    .trim()
    .min(1, "Domain name is required")
    .transform((domain) => domain.replace(/\.$/, ""))
    .refine((domain) => DOMAIN_PATTERN.test(domain), "Domain name is required"),
  region: z.string().trim().min(1).optional().default("All Regions"),
  requestId: z.string({ required_error: "Request ID is required" })
    .trim()
    .min(1, "Request ID is required"),
});

export function parseDnsPropagationRequest(input: unknown) {
  return dnsPropagationRequestSchema.parse(input);
}
