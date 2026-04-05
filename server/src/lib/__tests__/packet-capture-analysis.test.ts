import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  inspectPacketCaptureUpload,
  PacketCaptureAnalyzer,
  PacketCaptureValidationError,
} from "../../../modules/engineering/infrastructure/probes/lab-probes.js";

function hasCommand(command: string) {
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("packet capture analyzer", () => {
  const canRun = hasCommand("text2pcap") && hasCommand("tshark") && hasCommand("capinfos");
  const testMethod = canRun ? it : it.skip;

  testMethod("extracts basic HTTP evidence from a generated capture", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "netlab-pcap-test-"));

    try {
      const inputPath = path.join(tempDir, "http.txt");
      const pcapPath = path.join(tempDir, "http.pcapng");
      await writeFile(
        inputPath,
        [
          "000000 47 45 54 20 2f 20 48 54 54 50 2f 31 2e 31 0d 0a",
          "000010 48 6f 73 74 3a 20 65 78 61 6d 70 6c 65 2e 63 6f",
          "000020 6d 0d 0a 55 73 65 72 2d 41 67 65 6e 74 3a 20 4e",
          "000030 65 74 6c 61 62 0d 0a 0d 0a",
          "",
        ].join("\n"),
      );

      execFileSync("text2pcap", [
        "-q",
        "-T",
        "1234,80",
        "-4",
        "203.0.113.10,198.51.100.20",
        inputPath,
        pcapPath,
      ]);

      const analyzer = new PacketCaptureAnalyzer();
      const payload = await readFile(pcapPath);
      const report = await analyzer.analyze(payload, "http.pcapng");

      assert.equal(report.packetCount, 1);
      assert.ok(report.protocols.some((protocol) => protocol.protocol === "http"));
      assert.equal(report.http.requestCount, 1);
      assert.deepEqual(report.http.hosts, ["example.com"]);
      assert.deepEqual(report.http.methods, ["GET"]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects non-capture payloads before analysis", () => {
    assert.throws(
      () => inspectPacketCaptureUpload(Buffer.from("not-a-capture"), "notes.txt"),
      (error) => error instanceof PacketCaptureValidationError,
    );
  });
});
