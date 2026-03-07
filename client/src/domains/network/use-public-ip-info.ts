import useSWR from "swr";
import { fetchPublicIpInfo, PUBLIC_IP_ENDPOINT } from "./api";
import { EMPTY_IP_INFO, type IPInfo } from "./types";

const REVALIDATION_RETRY_DELAY_MS = 5_000;
const IP_INFO_DEDUPING_INTERVAL_MS = 10_000;
const MAX_RETRY_COUNT = 3;

export function usePublicIpInfo() {
  return useSWR<IPInfo>(PUBLIC_IP_ENDPOINT, fetchPublicIpInfo, {
    revalidateOnFocus: false,
    refreshInterval: 0,
    dedupingInterval: IP_INFO_DEDUPING_INTERVAL_MS,
    errorRetryInterval: REVALIDATION_RETRY_DELAY_MS,
    onErrorRetry: (_error, _key, _config, revalidate, context) => {
      if (context.retryCount >= MAX_RETRY_COUNT) {
        return;
      }

      setTimeout(() => {
        void revalidate({ retryCount: context.retryCount });
      }, REVALIDATION_RETRY_DELAY_MS);
    },
    fallbackData: EMPTY_IP_INFO,
  });
}
