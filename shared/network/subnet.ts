const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;
const NETMASK_BINARY_PATTERN = /^1*0*$/;

export interface SubnetInfo {
  networkAddress: string;
  broadcastAddress: string;
  firstUsableIP: string;
  lastUsableIP: string;
  numHosts: number;
  netmask: string;
  subnetMask: number;
}

const CSV_COLUMN_ACCESSORS: Record<string, (subnet: SubnetInfo) => string | number> = {
  networkAddress: (subnet) => subnet.networkAddress,
  broadcastAddress: (subnet) => subnet.broadcastAddress,
  firstUsableIP: (subnet) => subnet.firstUsableIP,
  lastUsableIP: (subnet) => subnet.lastUsableIP,
  numHosts: (subnet) => subnet.numHosts,
  subnetMask: (subnet) => `${subnet.netmask} (/${subnet.subnetMask})`,
  netmask: (subnet) => `${subnet.netmask} (/${subnet.subnetMask})`,
};

function assertValidIPv4(ip: string): void {
  if (!isValidIP(ip)) {
    throw new Error("Network address must be a valid IPv4 address");
  }
}

function assertValidMask(maskBits: number): void {
  if (!Number.isInteger(maskBits) || maskBits < 0 || maskBits > 32) {
    throw new Error("Subnet mask must be an integer between 0 and 32");
  }
}

function ipv4ToNumber(ip: string): number {
  assertValidIPv4(ip);

  return ip
    .split(".")
    .map((octet) => Number.parseInt(octet, 10))
    .reduce((value, octet) => ((value << 8) | octet) >>> 0, 0);
}

function numberToIPv4(value: number): string {
  const normalized = value >>> 0;

  return [
    (normalized >>> 24) & 255,
    (normalized >>> 16) & 255,
    (normalized >>> 8) & 255,
    normalized & 255,
  ].join(".");
}

function maskBitsToNumber(maskBits: number): number {
  assertValidMask(maskBits);

  if (maskBits === 0) {
    return 0;
  }

  return (0xffffffff << (32 - maskBits)) >>> 0;
}

export function isValidIP(ip: string): boolean {
  if (!IPV4_PATTERN.test(ip)) {
    return false;
  }

  return ip.split(".").every((octet) => {
    const value = Number.parseInt(octet, 10);
    return !Number.isNaN(value) && value >= 0 && value <= 255;
  });
}

export function isValidNetmask(netmask: string): boolean {
  if (!isValidIP(netmask)) {
    return false;
  }

  const binaryMask = netmask
    .split(".")
    .map((octet) => Number.parseInt(octet, 10).toString(2).padStart(8, "0"))
    .join("");

  return NETMASK_BINARY_PATTERN.test(binaryMask);
}

export function cidrToNetmask(cidr: number): string {
  return numberToIPv4(maskBitsToNumber(cidr));
}

export function netmaskToCidr(netmask: string): number {
  if (!isValidNetmask(netmask)) {
    throw new Error("Netmask must be a valid IPv4 subnet mask");
  }

  return netmask
    .split(".")
    .map((octet) => Number.parseInt(octet, 10).toString(2))
    .reduce((bits, binaryOctet) => bits + binaryOctet.split("1").length - 1, 0);
}

export function parseMaskInput(mask: string): number {
  const normalizedMask = mask.trim();

  if (!normalizedMask) {
    throw new Error("Subnet mask is required");
  }

  if (normalizedMask.startsWith("/")) {
    const maskBits = Number.parseInt(normalizedMask.slice(1), 10);
    assertValidMask(maskBits);
    return maskBits;
  }

  return netmaskToCidr(normalizedMask);
}

export function incrementIP(ip: string): string {
  return numberToIPv4((ipv4ToNumber(ip) + 1) >>> 0);
}

export function decrementIP(ip: string): string {
  return numberToIPv4((ipv4ToNumber(ip) - 1) >>> 0);
}

export function calculateSubnetInfo(networkAddress: string, maskBits: number): SubnetInfo {
  assertValidIPv4(networkAddress);
  assertValidMask(maskBits);

  const ipNumber = ipv4ToNumber(networkAddress);
  const maskNumber = maskBitsToNumber(maskBits);
  const networkNumber = ipNumber & maskNumber;
  const hostRangeSize = 2 ** (32 - maskBits);
  const broadcastNumber = (networkNumber + hostRangeSize - 1) >>> 0;
  const normalizedNetwork = numberToIPv4(networkNumber);
  const normalizedBroadcast = numberToIPv4(broadcastNumber);

  let numHosts = hostRangeSize - 2;
  let firstUsableIP = incrementIP(normalizedNetwork);
  let lastUsableIP = decrementIP(normalizedBroadcast);

  if (maskBits === 32) {
    numHosts = 1;
    firstUsableIP = normalizedNetwork;
    lastUsableIP = normalizedNetwork;
  } else if (maskBits === 31) {
    numHosts = 2;
    firstUsableIP = normalizedNetwork;
    lastUsableIP = normalizedBroadcast;
  }

  return {
    networkAddress: normalizedNetwork,
    broadcastAddress: normalizedBroadcast,
    firstUsableIP,
    lastUsableIP,
    numHosts,
    netmask: cidrToNetmask(maskBits),
    subnetMask: maskBits,
  };
}

export function divideSubnet(
  networkAddress: string,
  currentMask: number,
  newMask: number,
): SubnetInfo[] {
  assertValidMask(currentMask);
  assertValidMask(newMask);

  if (newMask <= currentMask) {
    throw new Error("New mask must be larger than current mask");
  }

  const baseSubnet = calculateSubnetInfo(networkAddress, currentMask);
  const baseNetworkNumber = ipv4ToNumber(baseSubnet.networkAddress);
  const subnetSize = 2 ** (32 - newMask);
  const numberOfSubnets = 2 ** (newMask - currentMask);

  return Array.from({ length: numberOfSubnets }, (_, index) => {
    const nextNetwork = numberToIPv4(baseNetworkNumber + subnetSize * index);
    return calculateSubnetInfo(nextNetwork, newMask);
  });
}

export function areAdjacent(subnet1: SubnetInfo, subnet2: SubnetInfo): boolean {
  if (subnet1.subnetMask !== subnet2.subnetMask) {
    return false;
  }

  const orderedSubnets = [subnet1, subnet2].sort((left, right) => {
    return (
      ipv4ToNumber(left.networkAddress) - ipv4ToNumber(right.networkAddress)
    );
  });

  const [firstSubnet, secondSubnet] = orderedSubnets;

  return (
    ipv4ToNumber(firstSubnet.broadcastAddress) + 1 ===
    ipv4ToNumber(secondSubnet.networkAddress)
  );
}

export function exportToCSV(subnets: SubnetInfo[], visibleColumns: string[]): string {
  const columns = visibleColumns.filter((column) => column in CSV_COLUMN_ACCESSORS);

  return subnets
    .map((subnet) =>
      columns
        .map((column) => String(CSV_COLUMN_ACCESSORS[column](subnet)))
        .join(","),
    )
    .join("\n");
}
