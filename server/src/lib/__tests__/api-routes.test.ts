import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { once } from "node:events";
import { createApp } from "../../../app.js";

describe("API routes", () => {
  let server: Server;
  let baseUrl = "";

  before(async () => {
    server = createServer(createApp());
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve test server address");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  async function request(pathname: string, init?: RequestInit) {
    return fetch(`${baseUrl}${pathname}`, init);
  }

  function assertSuccessEnvelope(payload: any) {
    assert.equal(payload.success, true);
    assert.equal(payload.error, null);
    assert.equal(typeof payload.requestId, "string");
  }

  function assertErrorEnvelope(payload: any) {
    assert.equal(payload.success, false);
    assert.equal(payload.data, null);
    assert.equal(typeof payload.requestId, "string");
    assert.equal(typeof payload.error?.code, "string");
    assert.equal(typeof payload.error?.message, "string");
  }

  it("exposes a basic health check endpoint", async () => {
    const response = await request("/healthz");

    assert.equal(response.status, 200);
    assert.match(response.headers.get("x-request-id") || "", /.+/);
    const payload = await response.json();

    assert.equal(payload.status, "ok");
    assert.equal(typeof payload.uptime, "number");
    assert.equal(typeof payload.requestId, "string");
  });

  it("returns private IP metadata for forwarded private addresses", async () => {
    const response = await request("/api/ip", {
      headers: {
        "x-forwarded-for": "10.0.0.1",
      },
    });

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.ip, "10.0.0.1");
    assert.equal(payload.city, "Private IP");
    assert.equal(payload.message, "This is a private IP address");
  });

  it("rejects invalid ping hosts before executing a ping", async () => {
    const response = await request("/api/ping", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        host: "example.com; rm -rf /",
        type: "icmp",
        count: 1,
        timeout: 1000,
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(payload.error, /Host must be a valid/);
  });

  it("rejects ping requests to non-public targets", async () => {
    const response = await request("/api/ping", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        host: "127.0.0.1",
        type: "icmp",
        count: 1,
        timeout: 1000,
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(payload.error, /public IP address/i);
  });

  it("normalizes subnet input and returns subnet metadata", async () => {
    const response = await request("/api/subnet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        networkAddress: "192.168.1.23",
        mask: "/24",
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.networkAddress, "192.168.1.0");
    assert.equal(payload.broadcastAddress, "192.168.1.255");
    assert.equal(payload.firstUsableIP, "192.168.1.1");
    assert.equal(payload.lastUsableIP, "192.168.1.254");
    assert.equal(payload.numHosts, 254);
  });

  it("rejects DNS server validation requests without a server IP", async () => {
    const response = await request("/api/dns/validate-server", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error, "DNS server IP is required");
    assert.equal(payload.code, "MISSING_SERVER_IP");
  });

  it("rejects private DNS servers", async () => {
    const response = await request("/api/dns/validate-server", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        serverIP: "127.0.0.1",
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(payload.error, /public IP address/i);
  });

  it("rejects port scans against non-public IP addresses", async () => {
    const response = await request("/api/port-scanner/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetIp: "127.0.0.1",
        portRange: [80, 81],
        protocol: "TCP",
        timeout: 500,
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(payload.error, /public IP address/i);
  });

  it("rejects DNS propagation requests without a request ID", async () => {
    const response = await request("/api/dns-propagation/propagation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain: "example.com",
        region: "All Regions",
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.message, "Request ID is required");
  });

  it("exposes a standardized v1 public IP endpoint", async () => {
    const response = await request("/api/v1/network/public-ip");

    assert.equal(response.status, 200);
    const payload = await response.json();

    assertSuccessEnvelope(payload);
    assert.equal(payload.data.city, "Private IP");
    assert.equal(payload.data.message, "This is a private IP address");
  });

  it("returns standardized subnet metadata through the v1 network module", async () => {
    const response = await request("/api/v1/network/subnets/inspect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        networkAddress: "192.168.1.23",
        mask: "/24",
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();

    assertSuccessEnvelope(payload);
    assert.equal(payload.data.networkAddress, "192.168.1.0");
    assert.equal(payload.data.broadcastAddress, "192.168.1.255");
  });

  it("returns a standardized error for non-public v1 ping targets", async () => {
    const response = await request("/api/v1/network/pings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        host: "127.0.0.1",
        type: "icmp",
        count: 1,
        timeout: 1000,
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();

    assertErrorEnvelope(payload);
    assert.equal(payload.error.code, "PUBLIC_TARGET_REQUIRED");
    assert.match(payload.error.message, /public IP address/i);
  });

  it("returns a standardized error for invalid v1 DNS validation requests", async () => {
    const response = await request("/api/v1/dns/servers/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();

    assertErrorEnvelope(payload);
    assert.equal(payload.error.code, "INVALID_DNS_SERVER_REQUEST");
  });

  it("returns a standardized error for non-public v1 port scan targets", async () => {
    const response = await request("/api/v1/port-scans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetIp: "127.0.0.1",
        protocol: "TCP",
        timeout: 500,
        portRange: [80, 81],
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();

    assertErrorEnvelope(payload);
    assert.equal(payload.error.code, "PUBLIC_TARGET_REQUIRED");
    assert.match(payload.error.message, /public IP address/i);
  });

  it("returns a standardized error for non-public v1 port scan stream targets", async () => {
    const response = await request(
      "/api/v1/port-scans/stream?targetIp=127.0.0.1&protocol=TCP&startPort=80&endPort=81&timeout=500",
    );

    assert.equal(response.status, 400);
    const payload = await response.json();

    assertErrorEnvelope(payload);
    assert.equal(payload.error.code, "PUBLIC_TARGET_REQUIRED");
    assert.match(payload.error.message, /public IP address/i);
  });

  it("returns a standardized error for incomplete v1 DNS propagation requests", async () => {
    const response = await request("/api/v1/dns-propagation/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain: "example.com",
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();

    assertErrorEnvelope(payload);
    assert.equal(payload.error.code, "INVALID_DNS_PROPAGATION_REQUEST");
  });

  it("returns a standardized error for non-public v1 trace targets", async () => {
    const response = await request("/api/v1/network/traces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        host: "127.0.0.1",
        maxHops: 6,
        timeoutMs: 2000,
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();

    assertErrorEnvelope(payload);
    assert.equal(payload.error.code, "PUBLIC_TARGET_REQUIRED");
  });

  it("returns a standardized error for non-public v1 HTTP inspection targets", async () => {
    const response = await request("/api/v1/network/http-inspections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: "http://127.0.0.1",
        timeoutMs: 2000,
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();

    assertErrorEnvelope(payload);
    assert.equal(payload.error.code, "PUBLIC_TARGET_REQUIRED");
  });
});
