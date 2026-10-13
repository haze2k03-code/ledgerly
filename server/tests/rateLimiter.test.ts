import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/lib/rateLimiter.js";

describe("RateLimiter", () => {
  it("allows up to the limit, then blocks", () => {
    const limiter = new RateLimiter(3, 1000);
    expect([1, 2, 3].map(() => limiter.attempt("ip:a", 0))).toEqual([true, true, true]);
    expect(limiter.attempt("ip:a", 10)).toBe(false);
  });

  it("starts a fresh window after it expires", () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.attempt("k", 0);
    expect(limiter.attempt("k", 500)).toBe(false);
    expect(limiter.attempt("k", 1000)).toBe(true);
  });

  it("tracks keys separately and can be reset", () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.attempt("a", 0);
    expect(limiter.attempt("b", 0)).toBe(true);
    limiter.reset("a");
    expect(limiter.attempt("a", 0)).toBe(true);
  });
});
