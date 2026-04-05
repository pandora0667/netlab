export class ConcurrencyLimitError extends Error {
  constructor(message: string, public statusCode = 429) {
    super(message);
    this.name = "ConcurrencyLimitError";
  }
}

export class ConcurrencyGate {
  private activeGlobal = 0;
  private activePerKey = new Map<string, number>();

  constructor(
    private readonly operationName: string,
    private readonly maxGlobal: number,
    private readonly maxPerKey: number,
  ) {}

  acquire(key: string): () => void {
    const normalizedKey = key || "unknown";
    const activeForKey = this.activePerKey.get(normalizedKey) ?? 0;

    if (activeForKey >= this.maxPerKey) {
      throw new ConcurrencyLimitError(
        `Too many concurrent ${this.operationName} requests from this IP. Please wait for the current request to finish.`,
      );
    }

    if (this.activeGlobal >= this.maxGlobal) {
      throw new ConcurrencyLimitError(
        `The service is currently handling the maximum number of concurrent ${this.operationName} requests. Please try again shortly.`,
      );
    }

    this.activeGlobal += 1;
    this.activePerKey.set(normalizedKey, activeForKey + 1);

    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;
      this.activeGlobal = Math.max(0, this.activeGlobal - 1);

      const nextActiveForKey = (this.activePerKey.get(normalizedKey) ?? 1) - 1;
      if (nextActiveForKey <= 0) {
        this.activePerKey.delete(normalizedKey);
        return;
      }

      this.activePerKey.set(normalizedKey, nextActiveForKey);
    };
  }

  getSnapshot(key = "unknown") {
    const normalizedKey = key || "unknown";

    return {
      operationName: this.operationName,
      activeGlobal: this.activeGlobal,
      activeForKey: this.activePerKey.get(normalizedKey) ?? 0,
      maxGlobal: this.maxGlobal,
      maxPerKey: this.maxPerKey,
    };
  }
}
