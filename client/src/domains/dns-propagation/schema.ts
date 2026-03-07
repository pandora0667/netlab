import { z } from "zod";

const DOMAIN_PATTERN =
  /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;

export const dnsPropagationFormSchema = z.object({
  domain: z.string()
    .trim()
    .min(1, "Please enter a domain name")
    .transform((domain) => domain.replace(/\.$/, ""))
    .refine((domain) => DOMAIN_PATTERN.test(domain), {
      message: "Please enter a valid domain name",
    }),
  region: z.string().trim().min(1).default("All Regions"),
});

export const dnsPropagationRequestSchema = dnsPropagationFormSchema.extend({
  requestId: z.string().trim().min(1, "Request ID is required"),
});

export type DNSPropagationFormData = z.infer<typeof dnsPropagationFormSchema>;
export type DNSPropagationRequest = z.infer<typeof dnsPropagationRequestSchema>;
