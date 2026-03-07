import dns from "node:dns/promises";
import net from "node:net";
import {
  isPublicIPAddress,
  normalizeIPAddress,
  validateIPAddress,
} from "../../../shared/network/ip";

export class PublicTargetError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "PublicTargetError";
  }
}

function ensurePublicIPAddress(address: string, label: string): string {
  const normalizedAddress = normalizeIPAddress(address);
  const validationResult = validateIPAddress(normalizedAddress);

  if (!validationResult.isValid) {
    throw new PublicTargetError(
      validationResult.error || `${label} must be a valid IP address`,
    );
  }

  if (!isPublicIPAddress(normalizedAddress)) {
    throw new PublicTargetError(
      `${label} must be a public IP address. Private, loopback, link-local, and reserved ranges are not allowed.`,
    );
  }

  return normalizedAddress;
}

export function assertPublicIPAddress(address: string, label = "Target"): string {
  return ensurePublicIPAddress(address, label);
}

export async function resolvePublicTarget(target: string, label = "Target") {
  const normalizedTarget = target.trim();

  if (!normalizedTarget) {
    throw new PublicTargetError(`${label} is required`);
  }

  if (net.isIP(normalizedTarget) !== 0) {
    const normalizedAddress = ensurePublicIPAddress(normalizedTarget, label);
    return {
      input: normalizedTarget,
      resolvedTarget: normalizedAddress,
      addresses: [normalizedAddress],
      resolvedFromHostname: false,
    };
  }

  let lookupResults: Array<{ address: string; family: number }>;

  try {
    lookupResults = await dns.lookup(normalizedTarget, {
      all: true,
      verbatim: true,
    });
  } catch {
    throw new PublicTargetError(`${label} could not be resolved to a public IP address.`);
  }

  if (lookupResults.length === 0) {
    throw new PublicTargetError(`${label} could not be resolved to a public IP address.`);
  }

  const resolvedAddresses = [...new Set(
    lookupResults.map((result) => normalizeIPAddress(result.address)),
  )];

  const restrictedAddress = resolvedAddresses.find(
    (address) => !isPublicIPAddress(address),
  );

  if (restrictedAddress) {
    throw new PublicTargetError(
      `${label} must resolve only to public IP addresses. Private, loopback, link-local, and reserved ranges are not allowed.`,
    );
  }

  return {
    input: normalizedTarget,
    resolvedTarget: resolvedAddresses[0],
    addresses: resolvedAddresses,
    resolvedFromHostname: true,
  };
}
