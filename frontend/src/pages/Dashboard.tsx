import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { EmailTable } from "../components/EmailTable";
import { ComposeModal } from "../components/ComposeModal";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";
import { useEmails } from "../hooks/useEmails";
import type { EmailTab, User } from "../types";

const tabs: { id: EmailTab; label: string }[] = [
  { id: "scheduled", label: "Scheduled emails" },
  { id: "sent", label: "Sent emails" },
];

export default function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<EmailTab>("scheduled");
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const { rows, loading, error, refresh } = useEmails(tab, query);

  useEffect(() => {
    const slack = new URLSearchParams(window.location.search).get("slack");
    if (slack) {
      toast(slack === "connected" ? "Slack connected" : "Couldn't connect Slack. Try again.", slack === "connected" ? "success" : "error");
      window.history.replaceState({}, "", "/");
    }
  }, [toast]);

  return (
    <div className="min-h-screen">
      <Header user={user} onLogout={onLogout} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" className="flex gap-1 rounded-xl bg-line/60 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                  tab === t.id ? "bg-white shadow-sm" : "text-ink/60 hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search emails"
              aria-label="Search emails"
              className="w-56 rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <Button onClick={() => setComposing(true)}>Compose new email</Button>
          </div>
        </div>

        <section className="rounded-2xl border border-line bg-white">
          <EmailTable tab={tab} rows={rows} loading={loading} error={error} />
        </section>
      </main>
      {composing && <ComposeModal onClose={() => setComposing(false)} onScheduled={refresh} />}
    </div>
  );
}
