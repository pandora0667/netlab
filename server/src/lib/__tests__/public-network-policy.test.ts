import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPrivateIPAddress,
  isPublicIPAddress,
  isRestrictedIPAddress,
} from "../../../../shared/network/ip";

describe("public network policy", () => {
  it("accepts public IPv4 and IPv6 addresses", () => {
    assert.equal(isPublicIPAddress("8.8.8.8"), true);
    assert.equal(isPublicIPAddress("2001:4860:4860::8888"), true);
  });

  it("rejects private and loopback addresses", () => {
    assert.equal(isPrivateIPAddress("10.0.0.1"), true);
    assert.equal(isPublicIPAddress("10.0.0.1"), false);
    assert.equal(isRestrictedIPAddress("127.0.0.1"), true);
    assert.equal(isPublicIPAddress("127.0.0.1"), false);
  });

  it("rejects reserved documentation and link-local ranges", () => {
    assert.equal(isRestrictedIPAddress("203.0.113.10"), true);
    assert.equal(isRestrictedIPAddress("fe80::1"), true);
    assert.equal(isRestrictedIPAddress("2001:db8::1"), true);
  });
});
