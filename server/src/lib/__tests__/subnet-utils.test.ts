import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateSubnetInfo,
  divideSubnet,
  exportToCSV,
  parseMaskInput,
} from "../../../../shared/network/subnet";

describe("shared subnet utilities", () => {
  it("treats /31 networks as point-to-point networks with two usable addresses", () => {
    const subnet = calculateSubnetInfo("192.168.10.0", 31);

    assert.equal(subnet.networkAddress, "192.168.10.0");
    assert.equal(subnet.broadcastAddress, "192.168.10.1");
    assert.equal(subnet.firstUsableIP, "192.168.10.0");
    assert.equal(subnet.lastUsableIP, "192.168.10.1");
    assert.equal(subnet.numHosts, 2);
  });

  it("treats /32 networks as a single-host subnet", () => {
    const subnet = calculateSubnetInfo("192.168.10.7", 32);

    assert.equal(subnet.networkAddress, "192.168.10.7");
    assert.equal(subnet.broadcastAddress, "192.168.10.7");
    assert.equal(subnet.firstUsableIP, "192.168.10.7");
    assert.equal(subnet.lastUsableIP, "192.168.10.7");
    assert.equal(subnet.numHosts, 1);
  });

  it("parses dotted netmasks and rejects invalid masks", () => {
    assert.equal(parseMaskInput("255.255.255.0"), 24);
    assert.throws(
      () => parseMaskInput("255.0.255.0"),
      /valid IPv4 subnet mask/,
    );
  });

  it("divides a subnet from its normalized network boundary", () => {
    const subnets = divideSubnet("10.0.0.11", 24, 26);

    assert.deepEqual(
      subnets.map((subnet) => subnet.networkAddress),
      ["10.0.0.0", "10.0.0.64", "10.0.0.128", "10.0.0.192"],
    );
  });

  it("exports CSV rows using the requested column order", () => {
    const subnet = calculateSubnetInfo("10.0.0.0", 24);

    const csv = exportToCSV([subnet], [
      "numHosts",
      "networkAddress",
      "subnetMask",
    ]);

    assert.equal(csv, "254,10.0.0.0,255.255.255.0 (/24)");
  });
});
