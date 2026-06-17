import { type ReactNode } from "react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
        props.className ?? ""
      }`}
    />
  );
}