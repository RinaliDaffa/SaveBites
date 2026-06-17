import { type ReactNode } from "react";

type Tone = "emerald" | "amber" | "slate" | "red";

const tones: Record<Tone, string> = {
  emerald: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  slate: "bg-slate-100 text-slate-700",
  red: "bg-red-100 text-red-700",
};

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}