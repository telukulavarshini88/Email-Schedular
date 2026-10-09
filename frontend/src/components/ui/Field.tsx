import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

const base =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm placeholder:text-ink/40 focus:border-brand focus:outline-none";

function Wrapper({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink/60">{hint}</span>}
    </label>
  );
}

interface FieldProps { label: string; hint?: string }

export function Input({ label, hint, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Wrapper label={label} hint={hint}>
      <input {...rest} className={base} />
    </Wrapper>
  );
}

export function Textarea({ label, hint, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Wrapper label={label} hint={hint}>
      <textarea {...rest} className={`${base} min-h-[120px] resize-y`} />
    </Wrapper>
  );
}
