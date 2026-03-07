export interface IPValidationResult {
  isValid: boolean;
  type?: "IPv4" | "IPv6";
  error?: string;
}

function ipv4ToNumber(ip: string): number {
  return normalizeIPAddress(ip)
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .reduce((value, octet) => ((value << 8) | octet) >>> 0, 0);
}

function isIPv4InCidr(ip: string, network: string, prefixLength: number): boolean {
  const mask = prefixLength === 0
    ? 0
    : (0xffffffff << (32 - prefixLength)) >>> 0;

  return (ipv4ToNumber(ip) & mask) === (ipv4ToNumber(network) & mask);
}

function isRestrictedIPv6Address(ip: string): boolean {
  const lowerAddress = normalizeIPAddress(ip).toLowerCase();

  return (
    lowerAddress === "::" ||
    lowerAddress === "::1" ||
    lowerAddress.startsWith("fc") ||
    lowerAddress.startsWith("fd") ||
    /^fe[89ab]/.test(lowerAddress) ||
    lowerAddress.startsWith("ff") ||
    lowerAddress.startsWith("2001:db8:")
  );
}

export function normalizeIPAddress(ip: string): string {
  const trimmedIP = ip.trim();
  if (trimmedIP.toLowerCase().startsWith("::ffff:")) {
    return trimmedIP.slice(7);
  }

  return trimmedIP;
}

export function isValidIPv4(ip: string): boolean {
  const normalizedIP = normalizeIPAddress(ip);
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

  if (!ipv4Regex.test(normalizedIP)) {
    return false;
  }

  return normalizedIP.split(".").every((part) => {
    const num = Number.parseInt(part, 10);
    return !Number.isNaN(num) && num >= 0 && num <= 255;
  });
}

export function isValidIPv6(ip: string): boolean {
  const address = normalizeIPAddress(ip).toLowerCase();

  if (!address || !/^[0-9a-f:]+$/.test(address) || address.includes(":::")) {
    return false;
  }

  const compressionSections = address.split("::");
  if (compressionSections.length > 2) {
    return false;
  }

  const [left = "", right = ""] = compressionSections;
  const leftParts = left ? left.split(":") : [];
  const rightParts = right ? right.split(":") : [];
  const isValidGroup = (part: string) => /^[0-9a-f]{1,4}$/.test(part);

  if (!leftParts.every(isValidGroup) || !rightParts.every(isValidGroup)) {
    return false;
  }

  if (compressionSections.length === 1) {
    return leftParts.length === 8;
  }

  return leftParts.length + rightParts.length < 8;
}

export function validateIPAddress(ip: string): IPValidationResult {
  const normalizedIP = normalizeIPAddress(ip);

  if (!normalizedIP) {
    return {
      isValid: false,
      error: "IP address cannot be empty",
    };
  }

  if (isValidIPv4(normalizedIP)) {
    return {
      isValid: true,
      type: "IPv4",
    };
  }

  if (isValidIPv6(normalizedIP)) {
    return {
      isValid: true,
      type: "IPv6",
    };
  }

  if (normalizedIP.includes(".")) {
    const parts = normalizedIP.split(".");
    if (parts.length !== 4) {
      return {
        isValid: false,
        error: "IPv4 address must contain exactly 4 parts separated by dots",
      };
    }

    const invalidPart = parts.find((part) => {
      const num = Number.parseInt(part, 10);
      return Number.isNaN(num) || num < 0 || num > 255;
    });

    if (invalidPart) {
      return {
        isValid: false,
        error: `Invalid IPv4 part: ${invalidPart}. Each part must be between 0 and 255`,
      };
    }
  } else if (normalizedIP.includes(":")) {
    return {
      isValid: false,
      error: "Invalid IPv6 format. Example of valid format: 2001:db8::1",
    };
  }

  return {
    isValid: false,
    error: "Invalid IP address format. Please enter a valid IPv4 or IPv6 address",
  };
}

export function isPrivateIPAddress(ip: string): boolean {
  const normalizedIP = normalizeIPAddress(ip);

  if (isValidIPv4(normalizedIP)) {
    return (
      isIPv4InCidr(normalizedIP, "10.0.0.0", 8) ||
      isIPv4InCidr(normalizedIP, "172.16.0.0", 12) ||
      isIPv4InCidr(normalizedIP, "192.168.0.0", 16) ||
      isIPv4InCidr(normalizedIP, "127.0.0.0", 8) ||
      isIPv4InCidr(normalizedIP, "169.254.0.0", 16)
    );
  }

  return (
    normalizedIP.toLowerCase() === "::1" ||
    normalizedIP.toLowerCase().startsWith("fc") ||
    normalizedIP.toLowerCase().startsWith("fd") ||
    /^fe[89ab]/.test(normalizedIP.toLowerCase())
  );
}

export function isRestrictedIPAddress(ip: string): boolean {
  const normalizedIP = normalizeIPAddress(ip);

  if (isValidIPv4(normalizedIP)) {
    return (
      isIPv4InCidr(normalizedIP, "0.0.0.0", 8) ||
      isIPv4InCidr(normalizedIP, "10.0.0.0", 8) ||
      isIPv4InCidr(normalizedIP, "100.64.0.0", 10) ||
      isIPv4InCidr(normalizedIP, "127.0.0.0", 8) ||
      isIPv4InCidr(normalizedIP, "169.254.0.0", 16) ||
      isIPv4InCidr(normalizedIP, "172.16.0.0", 12) ||
      isIPv4InCidr(normalizedIP, "192.0.0.0", 24) ||
      isIPv4InCidr(normalizedIP, "192.0.2.0", 24) ||
      isIPv4InCidr(normalizedIP, "192.88.99.0", 24) ||
      isIPv4InCidr(normalizedIP, "192.168.0.0", 16) ||
      isIPv4InCidr(normalizedIP, "198.18.0.0", 15) ||
      isIPv4InCidr(normalizedIP, "198.51.100.0", 24) ||
      isIPv4InCidr(normalizedIP, "203.0.113.0", 24) ||
      isIPv4InCidr(normalizedIP, "224.0.0.0", 4) ||
      isIPv4InCidr(normalizedIP, "240.0.0.0", 4) ||
      normalizedIP === "255.255.255.255"
    );
  }

  if (isValidIPv6(normalizedIP)) {
    return isRestrictedIPv6Address(normalizedIP);
  }

  return true;
}

export function isPublicIPAddress(ip: string): boolean {
  const normalizedIP = normalizeIPAddress(ip);

  return (
    (isValidIPv4(normalizedIP) || isValidIPv6(normalizedIP)) &&
    !isRestrictedIPAddress(normalizedIP)
  );
}
