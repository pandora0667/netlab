import net from "node:net";
import { z } from "zod";

const NETWORK_ADDRESS_REQUIRED_MESSAGE = "networkAddress is required";
const MASK_REQUIRED_MESSAGE = "mask is required";
const DOMAIN_REQUIRED_MESSAGE = "domain is required";
const TARGET_REQUIRED_MESSAGE = "target is required";

export const subnetRequestSchema = z.object({
  networkAddress: z.string().trim().min(1, NETWORK_ADDRESS_REQUIRED_MESSAGE),
  mask: z.string().trim().min(1, MASK_REQUIRED_MESSAGE),
});

const legacySubnetRequestSchema = z.object({
  networkAddress: z.string().trim().optional(),
  ip: z.string().trim().optional(),
  mask: z.string().trim().min(1, MASK_REQUIRED_MESSAGE),
}).superRefine((value, context) => {
  if (!value.networkAddress && !value.ip) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: NETWORK_ADDRESS_REQUIRED_MESSAGE,
      path: ["networkAddress"],
    });
  }
});

export const whoisLookupSchema = z.object({
  domain: z.string()
    .trim()
    .min(1, DOMAIN_REQUIRED_MESSAGE)
    .refine(
      (value) => net.isIP(value) !== 0 || /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(value),
      "WHOIS target must be a valid public IP address or hostname",
    ),
});

export const traceRequestSchema = z.object({
  host: z.string().trim().min(1, TARGET_REQUIRED_MESSAGE),
  maxHops: z.coerce.number().int().min(1).max(16).default(8),
  timeoutMs: z.coerce.number().int().min(1000).max(5000).default(2000),
});

export const httpInspectionRequestSchema = z.object({
  input: z.string().trim().min(1, TARGET_REQUIRED_MESSAGE),
  timeoutMs: z.coerce.number().int().min(1000).max(10000).default(5000),
});

export function parseLegacySubnetRequest(input: unknown) {
  const request = legacySubnetRequestSchema.parse(input);

  return {
    networkAddress: request.networkAddress || request.ip || "",
    mask: request.mask,
  };
}
