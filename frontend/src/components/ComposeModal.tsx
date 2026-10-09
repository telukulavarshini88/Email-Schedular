import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { extractEmails } from "../lib/csv";
import { toLocalInputValue } from "../lib/format";
import { Button } from "./ui/Button";
import { Input, Textarea } from "./ui/Field";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";

export function ComposeModal({ onClose, onScheduled }: { onClose: () => void; onScheduled: () => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [leads, setLeads] = useState<string[]>([]);
  const [start, setStart] = useState(() => toLocalInputValue(new Date(Date.now() + 60_000)));
  const [delaySec, setDelaySec] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => subject.trim() && body.trim() && leads.length > 0 && start && hourlyLimit > 0,
    [subject, body, leads, start, hourlyLimit]
  );

  const onFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setLeads(extractEmails(await file.text()));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { count } = await api.schedule({
        subject, body, emails: leads,
        startTime: new Date(start).toISOString(),
        delayMs: Math.round(delaySec * 1000),
        hourlyLimit,
      });
      toast(`Scheduled ${count} emails`);
      onScheduled();
      onClose();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Compose new email" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick question about your onboarding" />
        <Textarea label="Body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message. HTML is supported." />

        <div>
          <span className="mb-1 block text-sm font-medium">Leads file</span>
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-line bg-paper px-3 py-3 text-sm hover:border-brand">
            <span>{fileName ?? "Upload a CSV or text file"}</span>
            <span className="font-semibold text-brand">Choose file</span>
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {fileName && (
            <p className={`mt-1 text-xs ${leads.length ? "text-emerald-700" : "text-red-700"}`}>
              {leads.length ? `${leads.length} email addresses detected` : "No email addresses found in this file"}
            </p>
          )}
        </div>

        <Input label="Start time" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Delay between emails (sec)" type="number" min={0} step={0.5} value={delaySec} onChange={(e) => setDelaySec(Number(e.target.value))} />
          <Input label="Hourly limit per sender" type="number" min={1} value={hourlyLimit} onChange={(e) => setHourlyLimit(Number(e.target.value))} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting} disabled={!canSubmit}>Schedule</Button>
        </div>
      </form>
    </Modal>
  );
}
