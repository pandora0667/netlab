import net from "node:net";
import { resolvePublicTarget } from "../../../../src/lib/public-targets.js";
import type { PathMtuReport } from "../../engineering.types.js";
import type { EngineeringDependencies } from "../engineering.dependencies.js";

export async function getPathMtuReport(
  input: string,
  deps: EngineeringDependencies,
): Promise<PathMtuReport> {
  const target = await resolvePublicTarget(input, "Path MTU target");
  const ipv4Target = target.addresses.find((address) => net.isIP(address) === 4);

  if (!ipv4Target) {
    throw new Error("Path MTU probing currently requires an IPv4-reachable target");
  }

  const result = await deps.pathMtuProbe.probe(ipv4Target);
  const history = deps.historyStore.remember("pmtu", input, {
    "Max payload": result.maxPayloadSize ?? "n/a",
    "Estimated MTU": result.estimatedPathMtu ?? "n/a",
  });

  return {
    input,
    targetIp: ipv4Target,
    ...result,
    checkedAt: Date.now(),
    history,
  };
}
