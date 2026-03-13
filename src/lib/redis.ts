import { createClient, type RedisClientType } from "redis";

declare global {
  var __lojaCamisaRedisClient: RedisClientType | undefined;
}

let redisClient: RedisClientType | null = null;
let connectingPromise: Promise<RedisClientType> | null = null;

export async function getRedisClient() {
  const redisUrl = process.env.REDIS_URL?.trim() ?? "";
  if (!redisUrl) return null;

  if (!redisClient) {
    redisClient =
      process.env.NODE_ENV === "production"
        ? createClient({ url: redisUrl })
        : globalThis.__lojaCamisaRedisClient ?? createClient({ url: redisUrl });

    redisClient.on("error", (error) => {
      console.error("Falha no Redis:", error);
    });

    if (process.env.NODE_ENV !== "production" && !globalThis.__lojaCamisaRedisClient) {
      globalThis.__lojaCamisaRedisClient = redisClient;
    }
  }

  if (redisClient.isOpen) return redisClient;
  if (!connectingPromise) {
    connectingPromise = redisClient.connect().then(() => redisClient as RedisClientType);
  }
  return connectingPromise;
}
