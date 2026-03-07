import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidIPv4,
  isValidIPv6,
  validateIPAddress,
} from "../dns-utils";

describe("DNS utilities", () => {
  describe("validateIPAddress", () => {
    it("validates correct IPv4 addresses", () => {
      const validIPv4s = ["192.168.1.1", "8.8.8.8", "255.255.255.255", "0.0.0.0"];

      validIPv4s.forEach((ip) => {
        const result = validateIPAddress(ip);
        assert.equal(result.isValid, true);
        assert.equal(result.type, "IPv4");
        assert.equal(result.error, undefined);
      });
    });

    it("validates correct IPv6 addresses", () => {
      const validIPv6s = [
        "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        "fe80::1",
      ];

      validIPv6s.forEach((ip) => {
        const result = validateIPAddress(ip);
        assert.equal(result.isValid, true);
        assert.equal(result.type, "IPv6");
        assert.equal(result.error, undefined);
      });
    });

    it("rejects invalid IPv4 addresses", () => {
      const invalidIPv4s = ["256.1.2.3", "1.2.3.4.5", "192.168.1", "a.b.c.d", "192.168.1."];

      invalidIPv4s.forEach((ip) => {
        const result = validateIPAddress(ip);
        assert.equal(result.isValid, false);
        assert.notEqual(result.error, undefined);
      });
    });

    it("rejects invalid IPv6 addresses", () => {
      const invalidIPv6s = [
        "2001:0db8:85a3:0000:0000:8a2e:0370:7334:",
        "::::::",
        "2001:0db8:85a3:0000:0000:8a2e:0370:733g",
        "1:2:3:4:5:6:7:8:9",
      ];

      invalidIPv6s.forEach((ip) => {
        const result = validateIPAddress(ip);
        assert.equal(result.isValid, false);
        assert.notEqual(result.error, undefined);
      });
    });

    it("handles empty input", () => {
      const result = validateIPAddress("");
      assert.equal(result.isValid, false);
      assert.equal(result.error, "IP address cannot be empty");
    });

    it("handles whitespace input", () => {
      const result = validateIPAddress("   ");
      assert.equal(result.isValid, false);
      assert.equal(result.error, "IP address cannot be empty");
    });
  });

  describe("primitive validators", () => {
    it("matches IPv4 addresses directly", () => {
      assert.equal(isValidIPv4("8.8.8.8"), true);
      assert.equal(isValidIPv4("999.8.8.8"), false);
    });

    it("matches IPv6 addresses directly", () => {
      assert.equal(isValidIPv6("fe80::1"), true);
      assert.equal(isValidIPv6("::::::"), false);
    });
  });
});
