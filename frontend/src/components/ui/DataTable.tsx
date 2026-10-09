import type { ReactNode } from "react";
import { Spinner } from "./Spinner";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  loading: boolean;
  error?: string | null;
  rowKey: (row: T) => string;
  empty: { title: string; hint: string };
}

export function DataTable<T>({ columns, rows, loading, error, rowKey, empty }: Props<T>) {
  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-ink/60">
        <Spinner /> Loading emails…
      </div>
    );
  }
  if (error && rows.length === 0) {
    return <div className="py-24 text-center text-sm text-red-700">Couldn't load emails: {error}</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="font-semibold">{empty.title}</p>
        <p className="mt-1 text-sm text-ink/60">{empty.hint}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-ink/60">
            {columns.map((c) => (
              <th key={c.header} className="px-4 py-3 font-medium">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line/70 last:border-0 hover:bg-paper/60">
              {columns.map((c) => (
                <td key={c.header} className="px-4 py-3">{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
