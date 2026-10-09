export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

export type EmailStatus = "scheduled" | "sending" | "sent" | "failed";
export type EmailTab = "scheduled" | "sent";

export interface EmailRow {
  id: string;
  to_email: string;
  subject: string;
  status: EmailStatus;
  scheduled_at: string;
  sent_at: string | null;
  error: string | null;
  preview_url: string | null;
  sender_email: string;
}

export interface SlackStatus {
  connected: boolean;
  channel: string | null;
  team: string | null;
}

export interface ScheduleInput {
  subject: string;
  body: string;
  emails: string[];
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
}
