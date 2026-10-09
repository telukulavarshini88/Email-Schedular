import type { EmailRow, EmailTab } from "../types";
import { formatDateTime } from "../lib/format";
import { Badge } from "./ui/Badge";
import { DataTable, type Column } from "./ui/DataTable";

interface Props {
  tab: EmailTab;
  rows: EmailRow[];
  loading: boolean;
  error: string | null;
}

const common: Column<EmailRow>[] = [
  { header: "Email", render: (r) => <span className="font-medium">{r.to_email}</span> },
  { header: "Subject", render: (r) => <span className="line-clamp-1 max-w-xs">{r.subject}</span> },
];

const scheduledColumns: Column<EmailRow>[] = [
  ...common,
  { header: "Scheduled time", render: (r) => formatDateTime(r.scheduled_at) },
  { header: "Status", render: (r) => <Badge status={r.status} /> },
];

const sentColumns: Column<EmailRow>[] = [
  ...common,
  { header: "Sent time", render: (r) => formatDateTime(r.sent_at) },
  {
    header: "Status",
    render: (r) => (
      <span className="inline-flex items-center gap-2">
        <Badge status={r.status} />
        {r.preview_url && (
          <a href={r.preview_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand hover:underline">
            Preview
          </a>
        )}
      </span>
    ),
  },
];

export function EmailTable({ tab, rows, loading, error }: Props) {
  return (
    <DataTable
      columns={tab === "scheduled" ? scheduledColumns : sentColumns}
      rows={rows}
      loading={loading}
      error={error}
      rowKey={(r) => r.id}
      empty={
        tab === "scheduled"
          ? { title: "Nothing scheduled", hint: "Compose a new email to queue your first send." }
          : { title: "No emails sent yet", hint: "Sent emails show up here as the scheduler works through the queue." }
      }
    />
  );
}
