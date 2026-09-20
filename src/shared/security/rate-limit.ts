import { AppError } from "@/shared/errors/app-error";

export interface RateLimiter {
  /** Consume one hit. Throws RATE_LIMITED when the window budget is exceeded. */
  consume(key: string, limit: number, windowMs: number): Promise<void>;
  reset(key: string): Promise<void>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory limiter: adequate for a single-instance MVP. Swap for a Redis
 * implementation behind the same interface when running multiple instances.
 */
class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  async consume(key: string, limit: number, windowMs: number): Promise<void> {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      if (this.buckets.size > 10_000) this.sweep(now);
      return;
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      throw new AppError("RATE_LIMITED", "Too many attempts. Please try again later.");
    }
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  private sweep(now: number) {
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}

declare global {
  var __ccpRateLimiter: RateLimiter | undefined;
}

export const rateLimiter: RateLimiter = globalThis.__ccpRateLimiter ?? new MemoryRateLimiter();
globalThis.__ccpRateLimiter = rateLimiter;
