import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { EmailRow, EmailTab } from "../types";

/** Loads one tab's emails, debounces search, and polls so statuses stay live. */
export function useEmails(tab: EmailTab, query: string) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.emails(tab, query);
        if (!cancelled) { setRows(data); setError(null); }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 300 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tab, query, tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { rows, loading, error, refresh };
}
