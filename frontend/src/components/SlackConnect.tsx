import { useEffect, useState } from "react";
import { api } from "../api";
import type { SlackStatus } from "../types";
import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";

export function SlackConnect() {
  const toast = useToast();
  const [status, setStatus] = useState<SlackStatus | null>(null);

  useEffect(() => {
    api.slackStatus().then(setStatus).catch(() => setStatus({ connected: false, channel: null, team: null }));
  }, []);

  const disconnect = async () => {
    try {
      await api.slackDisconnect();
      setStatus({ connected: false, channel: null, team: null });
      toast("Slack disconnected");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (!status) return null;
  return status.connected ? (
    <Button variant="secondary" onClick={disconnect} title="Click to disconnect">
      Slack: {status.channel ?? "connected"}
    </Button>
  ) : (
    <Button variant="secondary" onClick={() => (window.location.href = "/api/slack/connect")}>
      Connect Slack
    </Button>
  );
}
