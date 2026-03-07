import { z } from "zod";
import { isPublicIPAddress } from "../../../shared/network/ip.js";
import { dnsServerSchema } from "../../src/lib/dns-utils.js";

export const DOMAIN_PATTERN =
  /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
export const MAX_DNS_SERVERS = 5;
export const DNS_RESOLVER_TIMEOUT_MS = 5_000;
export const DNS_RESOLVER_RETRIES = 2;

export const publicDnsServerSchema = dnsServerSchema.refine(
  (value) => isPublicIPAddress(value),
  {
    message: "Only public DNS servers are allowed",
  },
);

export const dnsLookupRequestSchema = z.object({
  domain: z.string()
    .trim()
    .min(1, "domain is required")
    .refine((domain) => DOMAIN_PATTERN.test(domain), "Invalid domain format"),
  servers: z.array(publicDnsServerSchema)
    .min(1, "At least one DNS server is required")
    .max(MAX_DNS_SERVERS, `Maximum ${MAX_DNS_SERVERS} DNS servers allowed`),
  includeAllRecords: z.boolean().optional().default(false),
});

export const dnsServerValidationSchema = z.object({
  serverIP: z.string().trim().min(1, "serverIP is required"),
});
