import IORedis, { type Redis } from "ioredis";

let connection: Redis | undefined;

/**
 * Lazily create the Redis connection BullMQ will use in a later step.
 * No queue or worker is wired up yet — this is just the connection factory.
 */
export function getRedisConnection(): Redis {
  if (connection) return connection;

  const url = process.env.UPSTASH_REDIS_URL;

  if (!url) {
    throw new Error("Redis is not configured: set UPSTASH_REDIS_URL.");
  }

  // maxRetriesPerRequest must be null for BullMQ.
  connection = new IORedis(url, { maxRetriesPerRequest: null });

  return connection;
}
