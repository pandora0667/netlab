import type { PacketCaptureReport } from "../../engineering.types.js";
import type { EngineeringDependencies } from "../engineering.dependencies.js";

const MAX_PACKET_CAPTURE_BYTES = 12 * 1024 * 1024;

export async function getPacketCaptureReport(
  payload: Buffer,
  filename: string,
  deps: EngineeringDependencies,
): Promise<PacketCaptureReport> {
  if (payload.length > MAX_PACKET_CAPTURE_BYTES) {
    throw new Error("Packet capture exceeds the 12 MB analysis limit");
  }

  return deps.packetCaptureAnalyzer.analyze(payload, filename);
}
