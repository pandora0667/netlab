import http from "http";
import https from "https";
import { TLSSocket } from "tls";
import { resolvePublicTarget } from "../../src/lib/public-targets.js";
import {
  QuicHandshakeProbe,
  ServiceBindingProbe,
} from "../engineering/infrastructure/probes/lab-probes.js";
import type {
  HttpRedirectHop,
  HttpTlsCertificate,
  HttpTlsInspectionResult,
} from "./network.types.js";

const DEFAULT_HTTP_TIMEOUT_MS = 5_000;
const MAX_HTTP_TIMEOUT_MS = 10_000;
const MAX_HTTP_REDIRECTS = 5;
const HTTP_AGENT = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
});
const HTTPS_AGENT = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
});
const serviceBindingProbe = new ServiceBindingProbe();
const quicHandshakeProbe = new QuicHandshakeProbe();

function normalizeInspectorUrl(input: string): URL {
  const normalizedInput = input.startsWith("http://") || input.startsWith("https://")
    ? input
    : `https://${input}`;
  return new URL(normalizedInput);
}

function toHeaderRecord(headers: http.IncomingHttpHeaders): Record<string, string> {
  return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key] = value;
      return acc;
    }

    if (Array.isArray(value)) {
      acc[key] = value.join(", ");
    }

    return acc;
  }, {});
}

function parseCertificate(socket: TLSSocket | undefined): HttpTlsCertificate | null {
  if (!socket || !socket.encrypted) {
    return null;
  }

  const peerCertificate = socket.getPeerCertificate();
  if (!peerCertificate || Object.keys(peerCertificate).length === 0) {
    return null;
  }

  const validTo = peerCertificate.valid_to || null;
  const expiresInDays = validTo
    ? Math.ceil((new Date(validTo).getTime() - Date.now()) / 86_400_000)
    : null;

  return {
    subject: peerCertificate.subject?.CN || null,
    issuer: peerCertificate.issuer?.CN || null,
    validFrom: peerCertificate.valid_from || null,
    validTo,
    expiresInDays,
  };
}

function parseAltSvcHeader(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.match(/^([^=]+)=/)?.[1]?.trim().replace(/^"+|"+$/g, "") ?? null)
    .filter((protocol): protocol is string => Boolean(protocol));
}

function performRequest(url: URL, timeoutMs: number) {
  return new Promise<{
    status: number;
    headers: Record<string, string>;
    location: string | null;
    tlsVersion: string | null;
    alpnProtocol: string | null;
    tlsAuthorized: boolean | null;
    tlsAuthorizationError: string | null;
    certificate: HttpTlsCertificate | null;
  }>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        timeout: timeoutMs,
        agent: url.protocol === "https:" ? HTTPS_AGENT : HTTP_AGENT,
        ...(url.protocol === "https:" ? { rejectUnauthorized: false } : {}),
        headers: {
          "user-agent": "Netlab HTTP Inspector",
          accept: "*/*",
        },
      },
      (response) => {
        const tlsSocket = response.socket instanceof TLSSocket
          ? response.socket
          : undefined;
        const tlsVersion = tlsSocket?.getProtocol() || null;
        const alpnProtocol = tlsSocket?.alpnProtocol || null;
        const tlsAuthorized = tlsSocket ? tlsSocket.authorized : null;
        const tlsAuthorizationError = tlsSocket?.authorizationError
          ? String(tlsSocket.authorizationError)
          : null;
        const certificate = parseCertificate(tlsSocket);

        response.resume();
        response.on("end", () => {
          resolve({
            status: response.statusCode || 0,
            headers: toHeaderRecord(response.headers),
            location: response.headers.location || null,
            tlsVersion,
            alpnProtocol,
            tlsAuthorized,
            tlsAuthorizationError,
            certificate,
          });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    request.on("error", reject);
    request.end();
  });
}

class HttpInspectorService {
  async inspect(
    input: string,
    options?: { timeoutMs?: number },
  ): Promise<HttpTlsInspectionResult> {
    const timeoutMs = Math.min(
      MAX_HTTP_TIMEOUT_MS,
      Math.max(1_000, options?.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS),
    );
    const requestedUrl = normalizeInspectorUrl(input);
    await resolvePublicTarget(requestedUrl.hostname, "HTTP target");

    const redirects: HttpRedirectHop[] = [];
    let currentUrl = requestedUrl;
    let lastResponse:
      | {
          status: number;
          headers: Record<string, string>;
          location: string | null;
          tlsVersion: string | null;
          alpnProtocol: string | null;
          tlsAuthorized: boolean | null;
          tlsAuthorizationError: string | null;
          certificate: HttpTlsCertificate | null;
        }
      | undefined;

    for (let index = 0; index <= MAX_HTTP_REDIRECTS; index += 1) {
      lastResponse = await performRequest(currentUrl, timeoutMs);
      const redirectLocation = lastResponse.location
        ? new URL(lastResponse.location, currentUrl).toString()
        : null;

      redirects.push({
        status: lastResponse.status,
        url: currentUrl.toString(),
        location: redirectLocation,
      });

      if (
        !redirectLocation ||
        lastResponse.status < 300 ||
        lastResponse.status >= 400
      ) {
        break;
      }

      const nextUrl = new URL(redirectLocation);
      await resolvePublicTarget(nextUrl.hostname, "Redirect target");
      currentUrl = nextUrl;
    }

    if (!lastResponse) {
      throw new Error("HTTP inspection did not produce a response");
    }

    const altSvcRaw = lastResponse.headers["alt-svc"] || null;
    const serviceBindings = await serviceBindingProbe.lookup(currentUrl.hostname);
    const altSvcProtocols = parseAltSvcHeader(altSvcRaw);
    const advertisesHttp3 = altSvcProtocols.some((protocol) => protocol.startsWith("h3"))
      || serviceBindings.records.some((record) => record.alpns.some((alpn) => alpn.startsWith("h3")));
    const http3 = currentUrl.protocol === "https:" && advertisesHttp3
      ? await quicHandshakeProbe.probe(currentUrl.toString())
      : {
        available: false,
        binary: null,
        handshakeSucceeded: null,
        httpVersion: null,
        remoteIp: null,
        detail: currentUrl.protocol !== "https:"
          ? "HTTP/3 probing only runs for HTTPS targets."
          : "No HTTP/3 advertisement was visible in Alt-Svc or HTTPS/SVCB evidence.",
      };

    return {
      input,
      requestedUrl: requestedUrl.toString(),
      finalUrl: currentUrl.toString(),
      redirects,
      status: lastResponse.status,
      responseHeaders: lastResponse.headers,
      hsts: lastResponse.headers["strict-transport-security"] || null,
      server: lastResponse.headers.server || null,
      contentType: lastResponse.headers["content-type"] || null,
      protocol: currentUrl.protocol,
      tlsVersion: lastResponse.tlsVersion,
      alpnProtocol: lastResponse.alpnProtocol,
      tlsAuthorized: lastResponse.tlsAuthorized,
      tlsAuthorizationError: lastResponse.tlsAuthorizationError,
      certificate: lastResponse.certificate,
      altSvcRaw,
      altSvcProtocols,
      serviceBindings: serviceBindings.records,
      serviceBindingSource: serviceBindings.source,
      serviceBindingNotes: serviceBindings.notes,
      http3,
      timestamp: Date.now(),
    };
  }
}

export const httpInspectorService = new HttpInspectorService();
