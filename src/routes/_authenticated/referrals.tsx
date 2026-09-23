import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, MousePointerClick, Percent, Share2, UserCheck, UserPlus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { StatCard, SectionCard, money } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getReferrals } from "@/lib/member.functions";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — EARNPESA" },
      { name: "description", content: "Share your referral link and track qualified referrals and earnings." },
      { property: "og:title", content: "EARNPESA Referrals" },
      { property: "og:description", content: "Track clicks, signups and qualified referrals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Referrals,
});

function Referrals() {
  const fn = useServerFn(getReferrals);
  const { data } = useQuery({ queryKey: ["referrals"], queryFn: () => fn() });
  const link = typeof window !== "undefined" && data?.code ? `${window.location.origin}/auth?mode=signup&ref=${data.code}` : "";
  const text = encodeURIComponent(`Join me on EARNPESA 🇰🇪 — complete verified campaigns and earn rewards. ${link}`);
  const copy = async () => { await navigator.clipboard.writeText(link); toast.success("Link copied"); };

  return (
    <AppShell title="Referrals">
      <section className="rounded-xl bg-foreground p-6 text-background premium-shadow sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-gold">Your referral code</p>
        <p className="mt-1 font-display text-4xl font-extrabold tracking-wider">{data?.code || "…"}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={link} className="h-11 border-background/20 bg-background/10 text-background" />
          <Button className="h-11" onClick={copy} disabled={!link}><Copy /> Copy link</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="rounded-md bg-background/10 px-4 py-2 text-sm font-semibold" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${text}`}>WhatsApp</a>
          <a className="rounded-md bg-background/10 px-4 py-2 text-sm font-semibold" target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`}>Telegram</a>
          <a className="rounded-md bg-background/10 px-4 py-2 text-sm font-semibold" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}>Facebook</a>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Clicks" value={data?.clicks ?? 0} icon={MousePointerClick} />
        <StatCard label="Signups" value={data?.signups ?? 0} icon={UserPlus} />
        <StatCard label="Qualified" value={data?.qualified ?? 0} icon={UserCheck} accent="gold" />
        <StatCard label="Conversion" value={`${data?.conversion ?? 0}%`} icon={Percent} />
        <StatCard label="Earnings" value={money(data?.earnings)} icon={Wallet} accent="gold" />
      </div>
      <SectionCard title="Your referrals">
        <p className="mb-4 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
          Rewards are released only after your friend activates their account and completes a verified qualifying action. Self-referrals and duplicate accounts are blocked.
        </p>
        {(data?.list ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground"><Share2 className="mx-auto mb-2 size-6" />No referrals yet — share your link to get started.</p>
        ) : (
          <ul className="divide-y">
            {data!.list.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-semibold">{r.person?.full_name ?? "Pending signup"}</p>
                  <p className="text-xs text-muted-foreground">Joined {new Date(r.created_at).toLocaleDateString("en-KE")}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={r.rewarded_at ? "rewarded" : r.qualified_at ? "approved" : "pending"} />
                  {r.rewarded_at && <p className="mt-1 text-xs font-bold text-gold">{money(r.reward_amount)}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </AppShell>
  );
}
