import IORedis from "ioredis";
import { config } from "./config";

// maxRetriesPerRequest must be null for BullMQ workers
export const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
