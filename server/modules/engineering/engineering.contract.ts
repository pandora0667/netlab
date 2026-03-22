import { z } from "zod";
import { DOMAIN_PATTERN } from "../dns/dns.contract.js";

const INPUT_REQUIRED_MESSAGE = "input is required";
const DOMAIN_REQUIRED_MESSAGE = "domain is required";

export const engineeringTargetSchema = z.object({
  input: z.string().trim().min(1, INPUT_REQUIRED_MESSAGE),
});

export const engineeringDomainSchema = z.object({
  domain: z.string()
    .trim()
    .min(1, DOMAIN_REQUIRED_MESSAGE)
    .transform((value) => {
      if (value.startsWith("http://") || value.startsWith("https://")) {
        return new URL(value).hostname;
      }

      return value;
    })
    .refine((value) => DOMAIN_PATTERN.test(value), "Domain must be a valid hostname"),
});
