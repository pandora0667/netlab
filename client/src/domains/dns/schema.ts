import { z } from "zod";
import { isValidIPv4, isValidIPv6 } from "../../../../shared/network/ip";

function isValidDnsServer(ip: string) {
  return isValidIPv4(ip) || isValidIPv6(ip);
}

export const dnsLookupSchema = z.object({
  domains: z.array(
    z.object({
      id: z.string(),
      value: z.string().min(1, "Please enter a domain"),
    }),
  ).min(1, "At least one domain is required"),
  servers: z.array(z.string()).min(1, "Please select a DNS server"),
  customServer: z.string()
    .refine((value) => !value || isValidDnsServer(value), {
      message: "Please enter a valid DNS server IP",
    })
    .optional(),
  includeAllRecords: z.boolean().default(true),
});

export type DNSLookupSchema = z.infer<typeof dnsLookupSchema>;
