import { accessSync, constants } from "node:fs";

const executableCache = new Map<string, string>();

export function resolveFixedExecutable(
  name: string,
  candidatePaths: string[],
): string {
  const cacheKey = `${name}:${process.platform}`;
  const cachedPath = executableCache.get(cacheKey);

  if (cachedPath) {
    return cachedPath;
  }

  for (const candidatePath of candidatePaths) {
    try {
      accessSync(candidatePath, constants.X_OK);
      executableCache.set(cacheKey, candidatePath);
      return candidatePath;
    } catch {
      continue;
    }
  }

  throw new Error(
    `${name} executable was not found in fixed system paths: ${candidatePaths.join(", ")}`,
  );
}
