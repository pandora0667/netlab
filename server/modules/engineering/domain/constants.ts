export const EXTERNAL_FETCH_TIMEOUT_MS = 8_000;
export const CACHE_TTL_MS = 5 * 60 * 1000;
export const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_ENGINEERING_EHLO = "EHLO netlab.tools\r\n";
export const DEFAULT_SMTP_TIMEOUT_MS = 5_000;
export const COMMON_DKIM_SELECTORS = [
  "default",
  "google",
  "selector1",
  "selector2",
  "dkim",
  "mail",
  "smtp",
  "k1",
  "s1",
  "s2",
] as const;
export const PMTU_MIN_PAYLOAD = 1200;
export const PMTU_MAX_PAYLOAD = 1472;
export const PMTU_TIMEOUT_MS = 2_000;
export const TCP_PROBE_TIMEOUT_MS = 1_500;

