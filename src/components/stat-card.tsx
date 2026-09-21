import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function money(value: number | null | undefined) {
  return `KSH ${Number(value ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  accent?: "primary" | "gold" | "muted";
}) {
  return (
    <div className="rounded-xl border bg-card p-5 premium-shadow">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={cn("size-4", accent === "gold" ? "text-gold" : accent === "muted" ? "text-muted-foreground" : "text-primary")} />
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 premium-shadow">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
