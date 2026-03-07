export interface DNSServer {
  country_code: string;
  name: string;
  ip_address: string;
  reliability: number;
  dnssec: boolean;
  is_working: boolean;
}

export interface DNSQueryResult {
  requestId?: string;
  server: DNSServer;
  response: string;
  latency: number;
  status: "success" | "error";
  error?: string;
  timestamp?: number;
}

export interface QueryStats {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageLatency: number;
  dnssecEnabled: number;
}

export interface DNSPropagationProgressEvent {
  requestId: string;
  completedQueries: number;
  totalQueries: number;
  timestamp: number;
  progress: number;
}

export interface DNSPropagationCompleteEvent {
  requestId: string;
  domain: string;
  region: string;
  totalQueries: number;
  timestamp: number;
}

export interface FilterState {
  status: "all" | "success" | "error";
  dnssec: "all" | "enabled" | "disabled";
}

export const REGIONS = {
  "All Regions": ["*"],
  Asia: ["JP", "KR", "CN", "SG", "IN", "HK"],
  Europe: ["GB", "DE", "FR", "IT", "ES", "NL"],
  "North America": ["US", "CA", "MX"],
  "South America": ["BR", "AR", "CL", "CO"],
  Africa: ["ZA", "EG", "NG", "KE"],
  Oceania: ["AU", "NZ"],
} as const;

export const SERVER_COORDINATES: Record<string, [number, number]> = {
  JP: [139.6917, 35.6895],
  KR: [126.978, 37.5665],
  CN: [116.4074, 39.9042],
  SG: [103.8198, 1.3521],
  IN: [77.209, 28.6139],
  HK: [114.1694, 22.3193],
  GB: [-0.1276, 51.5074],
  DE: [13.405, 52.52],
  FR: [2.3522, 48.8566],
  IT: [12.4964, 41.9028],
  ES: [-3.7038, 40.4168],
  NL: [4.9041, 52.3676],
  US: [-95.7129, 37.0902],
  CA: [-106.3468, 56.1304],
  MX: [-102.5528, 23.6345],
  BR: [-47.9292, -15.7801],
  AR: [-58.3816, -34.6037],
  CL: [-70.6483, -33.4489],
  CO: [-74.0721, 4.711],
  ZA: [28.0473, -26.2041],
  EG: [31.2357, 30.0444],
  NG: [3.3792, 6.5244],
  KE: [36.8219, -1.2921],
  AU: [149.13, -35.2809],
  NZ: [174.7787, -41.2924],
};

export const GEO_URL = "/world-countries.json";

export function getRegionColor(countryCode: string): string {
  for (const [region, countries] of Object.entries(REGIONS)) {
    const regionCountries = countries as readonly string[];

    if (regionCountries.includes("*") || regionCountries.includes(countryCode)) {
      switch (region) {
        case "Asia":
          return "#FFE0B2";
        case "Europe":
          return "#C8E6C9";
        case "North America":
          return "#B3E5FC";
        case "South America":
          return "#F8BBD0";
        case "Africa":
          return "#FFE0B2";
        case "Oceania":
          return "#E1BEE7";
        default:
          return "#EAEAEC";
      }
    }
  }

  return "#EAEAEC";
}
