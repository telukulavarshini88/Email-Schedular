import type { EmailStatus } from "../../types";

const styles: Record<EmailStatus, string> = {
  scheduled: "bg-brand-soft text-brand-dark",
  sending: "bg-amber-100 text-amber-800",
  sent: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

export function Badge({ status }: { status: EmailStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
