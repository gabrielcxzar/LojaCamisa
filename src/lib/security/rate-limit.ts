import { getRedisClient } from "@/lib/redis";

type RateLimitOptions = {
  key: string;
  windowMs: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, Bucket>();

function cleanupMemoryBuckets(now: number) {
  for (const [key, bucket] of memoryBuckets.entries()) {
    if (bucket.resetAt <= now) {
      memoryBuckets.delete(key);
    }
  }
}

function consumeFromMemory(options: RateLimitOptions) {
  const now = Date.now();
  cleanupMemoryBuckets(now);

  const current = memoryBuckets.get(options.key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + options.windowMs;
    memoryBuckets.set(options.key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, options.max - 1),
      resetAt,
    };
  }

  if (current.count >= options.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  memoryBuckets.set(options.key, current);
  return {
    allowed: true,
    remaining: Math.max(0, options.max - current.count),
    resetAt: current.resetAt,
  };
}

export async function consumeRateLimit(options: RateLimitOptions) {
  const redis = await getRedisClient();
  if (!redis) {
    return consumeFromMemory(options);
  }

  const rateKey = `rl:${options.key}`;
  const count = await redis.incr(rateKey);
  if (count === 1) {
    await redis.pExpire(rateKey, options.windowMs);
  }

  const ttlMs = Math.max(0, await redis.pTTL(rateKey));
  const resetAt = Date.now() + ttlMs;
  const allowed = count <= options.max;
  return {
    allowed,
    remaining: allowed ? Math.max(0, options.max - count) : 0,
    resetAt,
  };
}

export function getClientIp(request: Request) {
  const fromHeader = (name: string) => request.headers.get(name)?.trim();
  const candidates = [
    fromHeader("x-vercel-forwarded-for"),
    fromHeader("cf-connecting-ip"),
    fromHeader("x-real-ip"),
    fromHeader("x-forwarded-for")?.split(",")[0]?.trim(),
  ];
  return candidates.find((value) => Boolean(value)) ?? "unknown";
}
