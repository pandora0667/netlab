import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NetworkInputError,
  isValidPingHost,
  normalizePingOptions,
} from "../network-validation";

describe("network validation", () => {
  describe("isValidPingHost", () => {
    it("accepts IP addresses and hostnames", () => {
      assert.equal(isValidPingHost("8.8.8.8"), true);
      assert.equal(isValidPingHost("example.com"), true);
      assert.equal(isValidPingHost("localhost"), true);
    });

    it("rejects shell-like payloads", () => {
      assert.equal(isValidPingHost("example.com; rm -rf /"), false);
      assert.equal(isValidPingHost("$(whoami)"), false);
      assert.equal(isValidPingHost(""), false);
    });
  });

  describe("normalizePingOptions", () => {
    it("normalizes valid ICMP options", () => {
      const options = normalizePingOptions({
        host: " example.com ",
        type: "icmp",
        count: 2,
        timeout: 2000,
      });

      assert.deepEqual(options, {
        host: "example.com",
        type: "icmp",
        count: 2,
        timeout: 2000,
        retries: undefined,
      });
    });

    it("requires a TCP port", () => {
      assert.throws(
        () => normalizePingOptions({ host: "example.com", type: "tcp" }),
        (error) => {
          assert.equal(error instanceof NetworkInputError, true);
          assert.match(
            (error as Error).message,
            /TCP ping requires a port/,
          );
          return true;
        },
      );
    });

    it("rejects out-of-range counts", () => {
      assert.throws(
        () =>
          normalizePingOptions({
            host: "example.com",
            type: "icmp",
            count: 20,
          }),
        (error) => {
          assert.equal(error instanceof NetworkInputError, true);
          assert.match((error as Error).message, /Ping count/);
          return true;
        },
      );
    });
  });
});
