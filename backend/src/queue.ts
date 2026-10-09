import { Queue } from "bullmq";
import { redis } from "./redis";
import { config } from "./config";

export const QUEUE_NAME = "emails";

export interface EmailJobData {
  emailId: string;
  /** hour window (epoch hours) this job already reserved a rate-limit slot in */
  slot?: number;
}

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, { connection: redis });

/** jobId === emailId, so enqueueing the same email twice is a no-op (idempotency). */
export function jobFor(emailId: string, scheduledAt: Date) {
  return {
    name: "send",
    data: { emailId },
    opts: {
      jobId: emailId,
      delay: Math.max(0, scheduledAt.getTime() - Date.now()),
      attempts: config.maxSendAttempts,
      backoff: { type: "exponential" as const, delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  };
}
