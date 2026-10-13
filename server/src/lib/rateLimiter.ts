/**
 * A small fixed-window rate limiter kept in memory.
 * Used to slow down password guessing on the login mutation: GraphQL sends every operation
 * to the same /graphql URL, so a normal per-route HTTP limiter can't single out login.
 *
 * In-memory state is fine for one server. With several servers you'd keep the counters in
 * Redis so every instance sees the same numbers.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records an attempt. Returns false once the key has used up its attempts for this window. */
  attempt(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.cleanup(now);
      return true;
    }
    entry.count++;
    return entry.count <= this.limit;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  // Drop expired entries now and then so the map can't grow forever.
  private cleanup(now: number): void {
    if (this.hits.size < 10_000) return;
    for (const [key, entry] of this.hits) if (now >= entry.resetAt) this.hits.delete(key);
  }
}
