import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CACHE_TTL_MS, EXTERNAL_FETCH_TIMEOUT_MS } from "../../domain/constants.js";
import { InMemoryExpiringCache } from "../cache/in-memory-expiring-cache.js";

const execFileAsync = promisify(execFile);

function shouldPreferCurl(url: string) {
  try {
    return new URL(url).hostname === "stat.ripe.net";
  } catch {
    return false;
  }
}

async function fetchJsonViaCurl<T>(url: string): Promise<T> {
  const { stdout } = await execFileAsync("curl", [
    "-sS",
    "-L",
    "--connect-timeout",
    "5",
    "--max-time",
    String(Math.ceil(EXTERNAL_FETCH_TIMEOUT_MS / 1000)),
    "-H",
    "accept: application/json",
    "-H",
    "user-agent: Netlab Engineering/1.0",
    url,
  ]);

  return JSON.parse(stdout) as T;
}

export class ExternalJsonClient {
  constructor(private readonly cache: InMemoryExpiringCache<unknown>) {}

  async getJson<T>(url: string, ttlMs = CACHE_TTL_MS): Promise<T> {
    const cachedValue = this.cache.get(url);
    if (cachedValue) {
      return cachedValue as T;
    }

    const value = await this.fetchJsonWithTimeout<T>(url);
    this.cache.set(url, value, ttlMs);
    return value;
  }

  async getJsonSafe<T>(url: string, notes: string[], label: string, ttlMs = CACHE_TTL_MS) {
    try {
      return await this.getJson<T>(url, ttlMs);
    } catch (error) {
      notes.push(
        `${label} source did not respond cleanly: ${error instanceof Error ? error.message : "unknown error"}.`,
      );
      return null;
    }
  }

  private async fetchJsonWithTimeout<T>(url: string): Promise<T> {
    if (shouldPreferCurl(url)) {
      return fetchJsonViaCurl<T>(url);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "Netlab Engineering/1.0",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`External request failed with status ${response.status}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      try {
        return await fetchJsonViaCurl<T>(url);
      } catch {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

