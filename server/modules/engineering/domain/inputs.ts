function isAsciiLetter(char: string) {
  const code = char.charCodeAt(0);
  return code >= 97 && code <= 122;
}

function isAsciiDigit(char: string) {
  const code = char.charCodeAt(0);
  return code >= 48 && code <= 57;
}

function isValidDomainLabel(label: string) {
  if (!label || label.startsWith("-") || label.endsWith("-")) {
    return false;
  }

  for (const char of label) {
    if (isAsciiLetter(char) || isAsciiDigit(char) || char === "-") {
      continue;
    }

    return false;
  }

  return true;
}

function hasAlphabeticTld(value: string) {
  if (value.length < 2) {
    return false;
  }

  for (const char of value) {
    if (!isAsciiLetter(char)) {
      return false;
    }
  }

  return true;
}

export function trimTrailingDots(value: string) {
  let end = value.length;

  while (end > 0 && value[end - 1] === ".") {
    end -= 1;
  }

  return value.slice(0, end);
}

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
  const hostname = trimTrailingDots(normalizeHostnameInput(input));
  const labels = hostname.split(".");

  if (
    labels.length < 2
    || labels.some((label) => !isValidDomainLabel(label))
    || !hasAlphabeticTld(labels[labels.length - 1] || "")
  ) {
    throw new Error("A valid domain is required");
  }

  return hostname;
}

export function normalizeUnorderedStrings(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}
