export interface IPInfo {
  ip: string;
  city: string;
  country: string;
  region: string;
  isp: string;
  timezone: string;
  message?: string;
}

export interface WhoisLookupResult {
  data: string;
}

export const EMPTY_IP_INFO: IPInfo = {
  ip: "Loading...",
  city: "",
  country: "",
  region: "",
  isp: "",
  timezone: "",
};
