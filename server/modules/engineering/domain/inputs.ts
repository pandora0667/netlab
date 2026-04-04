export function normalizeUrlInput(input: string): URL {
  const trimmedInput = input.trim();
  const normalizedInput = trimmedInput.startsWith("http://") || trimmedInput.startsWith("https://")
    ? trimmedInput
    : `https://${trimmedInput}`;
  return new URL(normalizedInput);
}

export function normalizeHostnameInput(input: string): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    throw new Error("A hostname is required");
  }

  if (trimmedInput.startsWith("http://") || trimmedInput.startsWith("https://")) {
    return new URL(trimmedInput).hostname.toLowerCase();
  }

  return trimmedInput.toLowerCase();
}

export function normalizeDomainInput(input: string): string {
  const hostname = normalizeHostnameInput(input);

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) {
    throw new Error("A valid domain is required");
  }

  return hostname.replace(/\.+$/, "");
}

export function normalizeUnorderedStrings(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

