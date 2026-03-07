import {
  isPublicIPAddress,
  normalizeIPAddress,
} from "../../../shared/network/ip.js";
import type { NetworkIpInfo } from "./network.types.js";

const IP_INFO_REQUEST_TIMEOUT_MS = 5_000;
const IP_INFO_USER_AGENT = "Netlab/1.0";
const UNKNOWN_IP_INFO_VALUE = "Unknown";

interface IpInfoProvider {
  name: string;
  buildUrl: (ip: string) => string;
  transform: (payload: unknown, ip: string) => NetworkIpInfo | null;
}

const PRIVATE_IP_INFO: Omit<NetworkIpInfo, "ip"> = {
  city: "Private IP",
  country: "Private",
  region: "Private",
  isp: "Private",
  timezone: "Private",
  message: "This is a private IP address",
};

const IP_INFO_PROVIDERS: readonly IpInfoProvider[] = [
  {
    name: "ipapi",
    buildUrl: (ip) => `https://ipapi.co/${ip}/json/`,
    transform: (payload, ip) => {
      if (!payload || typeof payload !== "object") {
        return null;
      }

      const data = payload as Record<string, unknown>;
      return {
        ip,
        city: typeof data.city === "string" ? data.city : UNKNOWN_IP_INFO_VALUE,
        country: typeof data.country_name === "string"
          ? data.country_name
          : UNKNOWN_IP_INFO_VALUE,
        region: typeof data.region === "string" ? data.region : UNKNOWN_IP_INFO_VALUE,
        isp: typeof data.org === "string" ? data.org : UNKNOWN_IP_INFO_VALUE,
        timezone: typeof data.timezone === "string"
          ? data.timezone
          : UNKNOWN_IP_INFO_VALUE,
      };
    },
  },
] as const;

function createUnknownIpInfo(ip: string): NetworkIpInfo {
  return {
    ip,
    city: UNKNOWN_IP_INFO_VALUE,
    country: UNKNOWN_IP_INFO_VALUE,
    region: UNKNOWN_IP_INFO_VALUE,
    isp: UNKNOWN_IP_INFO_VALUE,
    timezone: UNKNOWN_IP_INFO_VALUE,
  };
}

async function fetchProviderPayload(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IP_INFO_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": IP_INFO_USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

class IpInfoService {
  async getIPInfo(ip: string): Promise<NetworkIpInfo> {
    const normalizedIP = normalizeIPAddress(ip);

    if (!isPublicIPAddress(normalizedIP)) {
      return {
        ip: normalizedIP,
        ...PRIVATE_IP_INFO,
      };
    }

    for (const provider of IP_INFO_PROVIDERS) {
      try {
        const payload = await fetchProviderPayload(provider.buildUrl(normalizedIP));
        const transformedPayload = provider.transform(payload, normalizedIP);

        if (transformedPayload) {
          return transformedPayload;
        }
      } catch {
        continue;
      }
    }

    return createUnknownIpInfo(normalizedIP);
  }
}

export const ipInfoService = new IpInfoService();
