import { z } from "zod";

const DOMAIN_PATTERN =
  /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;

const CANONICAL_REGIONS = [
  "All Regions",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Africa",
  "Oceania",
] as const;

const REGION_ALIASES = new Map<string, (typeof CANONICAL_REGIONS)[number]>([
  ["all", "All Regions"],
  ["all regions", "All Regions"],
  ["asia", "Asia"],
  ["europe", "Europe"],
  ["north america", "North America"],
  ["south america", "South America"],
  ["africa", "Africa"],
  ["oceania", "Oceania"],
]);

function normalizeDnsPropagationRegion(region: string) {
  const normalizedRegion = region.trim();

  if (CANONICAL_REGIONS.includes(normalizedRegion as (typeof CANONICAL_REGIONS)[number])) {
    return normalizedRegion;
  }

  const alias = REGION_ALIASES.get(normalizedRegion.toLowerCase());

  if (alias) {
    return alias;
  }

  return null;
}

const dnsPropagationRequestSchema = z.object({
  domain: z.string({ required_error: "Domain name is required" })
    .trim()
    .min(1, "Domain name is required")
    .transform((domain) => domain.replace(/\.$/, ""))
    .refine((domain) => DOMAIN_PATTERN.test(domain), "Domain name is required"),
  region: z.string()
    .trim()
    .min(1)
    .optional()
    .default("All Regions")
    .transform(normalizeDnsPropagationRegion)
    .refine((region) => region !== null, {
      message: "Region must be one of the supported DNS propagation scopes",
    })
    .transform((region) => region ?? "All Regions"),
  requestId: z.string({ required_error: "Request ID is required" })
    .trim()
    .min(1, "Request ID is required"),
});

export function parseDnsPropagationRequest(input: unknown) {
  return dnsPropagationRequestSchema.parse(input);
}
