import { z } from "zod";
import { isValidIP, isValidNetmask } from "@/lib/utils/subnet";

export const subnetCalculatorSchema = z.object({
  networkAddress: z
    .string()
    .min(1, "Network address is required")
    .refine((value) => isValidIP(value), {
      message: "Invalid IP format. Must be a valid IPv4 address (e.g., 192.168.1.0)",
    }),
  mask: z
    .string()
    .min(1, "Subnet mask is required")
    .refine((value) => {
      const normalizedMask = value.trim();

      if (normalizedMask.startsWith("/")) {
        const bits = Number.parseInt(normalizedMask.slice(1), 10);
        return Number.isInteger(bits) && bits >= 0 && bits <= 32;
      }

      return isValidNetmask(normalizedMask);
    }, {
      message: "Invalid subnet mask. Use CIDR (e.g., /24) or a valid netmask (e.g., 255.255.255.0)",
    }),
});

export const whoisSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
});
