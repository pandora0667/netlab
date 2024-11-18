import { z } from "zod";
import { isValidIP } from "./utils/subnet";

const recordType = z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "PTR"]);

const isValidDNSServer = (ip: string) => {
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipPattern.test(ip)) return false;
  return ip.split('.').every(octet => {
    const num = parseInt(octet);
    return num >= 0 && num <= 255;
  });
};

export const dnsLookupSchema = z.object({
  domains: z.array(
    z.object({
      id: z.string(),
      value: z.string().min(1, "도메인을 입력해주세요")
    })
  ).min(1, "최소 하나의 도메인이 필요합니다"),
  servers: z.array(z.string()).min(1, "DNS 서버를 선택해주세요"),
  customServer: z.string()
    .refine(val => !val || isValidDNSServer(val), {
      message: "유효한 DNS 서버 IP를 입력해주세요"
    })
    .optional(),
  includeAllRecords: z.boolean().default(true)
});


export type DNSLookupSchema = z.infer<typeof dnsLookupSchema>;

export const subnetCalculatorSchema = z.object({
  networkAddress: z
    .string()
    .min(1, "Network address is required")
    .refine((val) => isValidIP(val), {
      message: "Invalid IP format. Must be a valid IPv4 address (e.g., 192.168.1.0)",
    }),
  mask: z
    .string()
    .min(1, "Subnet mask is required")
    .refine(
      (val) => {
        // Allow both CIDR and netmask formats
        const cidrPattern = /^\/\d{1,2}$/;
        const netmaskPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        return cidrPattern.test(val) || netmaskPattern.test(val);
      },
      {
        message: "Invalid format. Use CIDR (e.g., /24) or netmask (e.g., 255.255.255.0)",
      }
    )
    .refine(
      (val) => {
        if (val.startsWith('/')) {
          const bits = parseInt(val.slice(1));
          return bits >= 0 && bits <= 32;
        }
        return val.split('.').every(octet => {
          const num = parseInt(octet);
          return num >= 0 && num <= 255;
        });
      },
      {
        message: "Invalid value. CIDR must be between /0 and /32, netmask octets must be 0-255",
      }
    )
    .refine(
      (val) => {
        if (val.startsWith('/')) {
          return true;
        }
        // Validate that netmask is valid (continuous 1s followed by continuous 0s in binary)
        const binary = val.split('.')
          .map(octet => parseInt(octet).toString(2).padStart(8, '0'))
          .join('');
        return /^1*0*$/.test(binary);
      },
      {
        message: "Invalid netmask. Must be a valid subnet mask (e.g., 255.255.255.0, 255.255.0.0)",
      }
    ),
});

export const pingSchema = z.object({
  host: z.string().min(1, "Host is required")
});

export const whoisSchema = z.object({
  domain: z.string().min(1, "Domain is required")
});
