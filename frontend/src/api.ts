import type { EmailRow, EmailTab, ScheduleInput, SlackStatus, User } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: async (): Promise<User | null> => {
    const res = await fetch("/api/me", { credentials: "include" });
    return res.ok ? res.json() : null;
  },
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  emails: (tab: EmailTab, q: string) =>
    request<EmailRow[]>(`/api/emails?status=${tab}&q=${encodeURIComponent(q)}`),
  schedule: (input: ScheduleInput) =>
    request<{ count: number }>("/api/schedule", { method: "POST", body: JSON.stringify(input) }),
  slackStatus: () => request<SlackStatus>("/api/slack/status"),
  slackDisconnect: () => request<{ ok: true }>("/api/slack", { method: "DELETE" }),
};
