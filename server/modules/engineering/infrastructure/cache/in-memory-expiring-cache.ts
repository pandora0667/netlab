interface CachedValue<T> {
  expiresAt: number;
  value: T;
}

export class InMemoryExpiringCache<T> {
  private readonly values = new Map<string, CachedValue<T>>();

  get(key: string): T | null {
    const cachedValue = this.values.get(key);
    if (!cachedValue) {
      return null;
    }

    if (cachedValue.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }

    return cachedValue.value;
  }

  set(key: string, value: T, ttlMs: number) {
    this.values.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }
}

