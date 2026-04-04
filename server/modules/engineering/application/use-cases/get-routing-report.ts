import { resolvePublicTarget } from "../../../../src/lib/public-targets.js";
import { safeArray } from "../../domain/collections.js";
import type { RoutingControlPlaneReport } from "../../engineering.types.js";
import type { EngineeringDependencies } from "../engineering.dependencies.js";

export async function getRoutingReport(
  input: string,
  deps: EngineeringDependencies,
): Promise<RoutingControlPlaneReport> {
  const target = await resolvePublicTarget(input, "Routing target");
  const targetIp = target.resolvedTarget;
  const notes: string[] = [];

  const [networkInfoPayload, prefixOverviewPayload, routingStatusPayload, geo] = await Promise.all([
    deps.externalJsonClient.getJsonSafe<any>(
      `https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(targetIp)}`,
      notes,
      "Network-info",
    ),
    deps.externalJsonClient.getJsonSafe<any>(
      `https://stat.ripe.net/data/prefix-overview/data.json?resource=${encodeURIComponent(targetIp)}`,
      notes,
      "Prefix-overview",
    ),
    deps.externalJsonClient.getJsonSafe<any>(
      `https://stat.ripe.net/data/routing-status/data.json?resource=${encodeURIComponent(targetIp)}`,
      notes,
      "Routing-status",
    ),
    deps.geoIpLookup.getIPInfo(targetIp),
  ]);

  const prefix = prefixOverviewPayload?.data?.resource
    ?? networkInfoPayload?.data?.prefix
    ?? null;
  const originAsn = routingStatusPayload?.data?.origins?.[0]?.origin != null
    ? String(routingStatusPayload.data.origins[0].origin)
    : (networkInfoPayload?.data?.asns?.[0] != null
      ? String(networkInfoPayload.data.asns[0])
      : null);
  const originHolder = prefixOverviewPayload?.data?.asns?.[0]?.holder ?? null;
  const rpkiValidationPayload = prefix && originAsn
    ? await deps.externalJsonClient.getJsonSafe<any>(
      `https://stat.ripe.net/data/rpki-validation/data.json?resource=${encodeURIComponent(originAsn)}&prefix=${encodeURIComponent(prefix)}`,
      notes,
      "RPKI validation",
    )
    : null;

  notes.push(...safeArray<string>(routingStatusPayload?.messages?.map((item: unknown) => {
    if (!Array.isArray(item) || typeof item[1] !== "string") {
      return null;
    }

    return item[1];
  }).filter(Boolean)));

  const history = deps.historyStore.remember("routing", input, {
    Prefix: prefix,
    "Origin ASN": originAsn,
    "RPKI status": rpkiValidationPayload?.data?.status ?? "unknown",
    "IPv4 visibility": routingStatusPayload?.data?.visibility?.v4?.ris_peers_seeing ?? "n/a",
    "IPv6 visibility": routingStatusPayload?.data?.visibility?.v6?.ris_peers_seeing ?? "n/a",
  });

  return {
    input,
    targetIp,
    resolvedAddresses: target.addresses,
    resolvedFromHostname: target.resolvedFromHostname,
    prefix,
    originAsn,
    originHolder,
    rpkiStatus: rpkiValidationPayload?.data?.status ?? null,
    validatingRoas: safeArray<any>(rpkiValidationPayload?.data?.validating_roas).map((roa) => ({
      origin: String(roa.origin),
      prefix: String(roa.prefix),
      validity: String(roa.validity),
      maxLength: typeof roa.max_length === "number" ? roa.max_length : null,
    })),
    visibility: {
      ipv4RisPeersSeeing: routingStatusPayload?.data?.visibility?.v4?.ris_peers_seeing ?? null,
      ipv4RisPeersTotal: routingStatusPayload?.data?.visibility?.v4?.total_ris_peers ?? null,
      ipv6RisPeersSeeing: routingStatusPayload?.data?.visibility?.v6?.ris_peers_seeing ?? null,
      ipv6RisPeersTotal: routingStatusPayload?.data?.visibility?.v6?.total_ris_peers ?? null,
    },
    firstSeen: routingStatusPayload?.data?.first_seen?.time ?? null,
    lastSeen: routingStatusPayload?.data?.last_seen?.time ?? null,
    lessSpecifics: safeArray<any>(routingStatusPayload?.data?.less_specifics).map((item) => ({
      prefix: String(item.prefix),
      origin: typeof item.origin === "number" ? item.origin : null,
    })),
    moreSpecifics: safeArray<any>(routingStatusPayload?.data?.more_specifics).map((item) => ({
      prefix: String(item.prefix),
      origin: typeof item.origin === "number" ? item.origin : null,
    })),
    registryBlock: {
      resource: prefixOverviewPayload?.data?.block?.resource ?? null,
      name: prefixOverviewPayload?.data?.block?.name ?? null,
      description: prefixOverviewPayload?.data?.block?.desc ?? null,
    },
    geo,
    notes,
    checkedAt: Date.now(),
    history,
  };
}
