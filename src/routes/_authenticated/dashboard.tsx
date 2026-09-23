import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownToLine, CheckCircle2, ClipboardCheck, Gift, Hourglass, PlayCircle, Share2, Sparkles, TrendingUp, WalletCards } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, StatusBadge, useMe } from "@/components/app-shell";
import { ActivationCard } from "@/components/activation-card";
import { StatCard, SectionCard, money } from "@/components/stat-card";
import { getDashboard } from "@/lib/member.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — EARNPESA" },
      { name: "description", content: "Track your balance, rewards and opportunities on EARNPESA." },
      { property: "og:title", content: "EARNPESA Dashboard" },
      { property: "og:description", content: "Your balance, rewards and verified opportunities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const actions = [
  { to: "/earn", icon: Gift, label: "Earn" },
  { to: "/referrals", icon: Share2, label: "Refer" },
  { to: "/earn", icon: ClipboardCheck, label: "Surveys" },
  { to: "/earn", icon: PlayCircle, label: "Watch & Earn" },
  { to: "/earn", icon: Sparkles, label: "Offers" },
  { to: "/wallet", icon: WalletCards, label: "Wallet" },
  { to: "/wallet", icon: ArrowDownToLine, label: "Withdraw" },
] as const;

function Dashboard() {
  const fn = useServerFn(getDashboard);
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });
  const w = data?.wallet;
  const first = (me?.profile?.full_name ?? "").split(" ")[0];

  return (
    <AppShell title="Dashboard">
      <ActivationCard />
      <section className="overflow-hidden rounded-xl bg-foreground p-6 text-background premium-shadow sm:p-8">
        <p className="text-sm text-background/60">Karibu{first ? `, ${first}` : ""} 👋</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-gold">Available balance</p>
        <p className="mt-1 font-display text-4xl font-extrabold tabular-nums sm:text-5xl">{isLoading ? "…" : money(w?.available_balance)}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/wallet" className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Withdraw to M-Pesa</Link>
          <Link to="/earn" className="rounded-md border border-background/20 px-4 py-2 text-sm font-bold">Find opportunities</Link>
        </div>
      </section>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {actions.map(({ to, icon: Icon, label }) => (
          <Link key={label} to={to} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center text-xs font-semibold transition hover:-translate-y-0.5 hover:border-primary/40">
            <span className="grid size-10 place-items-center rounded-full bg-secondary text-primary"><Icon className="size-5" /></span>
            {label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending rewards" value={money(w?.pending_balance)} icon={Hourglass} accent="gold" />
        <StatCard label="Total earned" value={money(w?.total_earned)} icon={TrendingUp} accent="gold" />
        <StatCard label="Total withdrawn" value={money(w?.total_withdrawn)} icon={ArrowDownToLine} />
        <StatCard label="Referral earnings" value={money(data?.referralEarnings)} icon={Share2} accent="gold" />
        <StatCard label="Available opportunities" value={data?.live ?? 0} icon={Gift} />
        <StatCard label="Completed tasks" value={data?.completed ?? 0} icon={CheckCircle2} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title="Earnings — last 14 days">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chart ?? []}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Area type="monotone" dataKey="earned" stroke="var(--gold)" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Latest alerts">
          {(data?.notifications ?? []).length === 0 && <p className="text-sm text-muted-foreground">No alerts yet.</p>}
          <ul className="space-y-3">
            {(data?.notifications ?? []).map((n) => (
              <li key={n.id} className="rounded-md bg-muted/60 p-3">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Recent transactions" action={<Link to="/wallet" className="text-sm font-semibold text-primary">View all</Link>}>
        <TxTable rows={data?.transactions ?? []} />
      </SectionCard>
    </AppShell>
  );
}

export function TxTable({ rows }: { rows: { id: string; amount: number; type: string; status: string; reference_id: string; created_at: string; description?: string | null }[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet. Complete a campaign to earn your first reward.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr><th className="pb-2">Amount</th><th className="pb-2">Type</th><th className="pb-2">Date</th><th className="pb-2">Status</th><th className="pb-2">Reference</th></tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t">
              <td className={`py-3 font-bold tabular-nums ${Number(t.amount) < 0 || t.type === "withdrawal" ? "" : "text-success"}`}>{money(t.amount)}</td>
              <td className="py-3 capitalize">{t.type.replace(/_/g, " ")}</td>
              <td className="py-3 text-muted-foreground">{new Date(t.created_at).toLocaleDateString("en-KE")}</td>
              <td className="py-3"><StatusBadge status={t.status} /></td>
              <td className="py-3 font-mono text-xs">{t.reference_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
