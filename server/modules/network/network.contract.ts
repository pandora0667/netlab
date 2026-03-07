import { z } from "zod";

const NETWORK_ADDRESS_REQUIRED_MESSAGE = "networkAddress is required";
const MASK_REQUIRED_MESSAGE = "mask is required";
const DOMAIN_REQUIRED_MESSAGE = "domain is required";

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
  domain: z.string().trim().min(1, DOMAIN_REQUIRED_MESSAGE),
});

export function parseLegacySubnetRequest(input: unknown) {
  const request = legacySubnetRequestSchema.parse(input);

  return {
    networkAddress: request.networkAddress || request.ip || "",
    mask: request.mask,
  };
}
