import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { BadgeCheck, CalendarDays, Clock, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { ActivationCard } from "@/components/activation-card";
import { money } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listEarn, startTask, submitTask } from "@/lib/member.functions";

export const Route = createFileRoute("/_authenticated/earn")({
  head: () => ({
    meta: [
      { title: "Earn — EARNPESA" },
      { name: "description", content: "Complete verified campaigns, surveys and missions to earn rewards." },
      { property: "og:title", content: "Earn on EARNPESA" },
      { property: "og:description", content: "Verified campaigns, surveys and daily missions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Earn,
});

const steps = ["started", "submitted", "verification", "approved", "rewarded"];

function Earn() {
  const q = useQueryClient();
  const list = useServerFn(listEarn);
  const start = useServerFn(startTask);
  const submit = useServerFn(submitTask);
  const { data, isLoading } = useQuery({ queryKey: ["earn"], queryFn: () => list() });
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [proof, setProof] = useState<{ id: string; title: string } | null>(null);
  const [evidence, setEvidence] = useState("");

  const cats = useMemo(() => ["All", ...new Set((data?.campaigns ?? []).map((c) => c.category))], [data]);
  const shown = (data?.campaigns ?? []).filter((c) => (cat === "All" || c.category === cat) && c.title.toLowerCase().includes(search.toLowerCase()));

  const done = (r: { ok: boolean; message: string }) => {
    (r.ok ? toast.success : toast.error)(r.message);
    void q.invalidateQueries({ queryKey: ["earn"] });
  };
  const startM = useMutation({ mutationFn: (id: string) => start({ data: { campaignId: id } }), onSuccess: done });
  const submitM = useMutation({
    mutationFn: () => submit({ data: { id: proof!.id, evidence } }),
    onSuccess: (r) => { done(r); if (r.ok) { setProof(null); setEvidence(""); } },
  });

  return (
    <AppShell title="Earn">
      <ActivationCard />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input className="h-10 pl-9" placeholder="Search opportunities" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {cats.map((c) => (
            <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)}>{c}</Button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading opportunities…</p>}
      {!isLoading && shown.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <p className="font-display text-lg font-bold">No live campaigns right now</p>
          <p className="mt-1 text-sm text-muted-foreground">New verified campaigns are added as businesses fund them. We'll notify you.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => {
          const mine = data?.mine.find((m) => m.campaign_id === c.id);
          return (
            <article key={c.id} className="flex flex-col rounded-xl border bg-card p-5 premium-shadow">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-primary">{c.category}</span>
                {c.is_verified && <span className="flex items-center gap-1 text-[11px] font-bold text-success"><BadgeCheck className="size-3.5" /> Verified Campaign</span>}
              </div>
              <h3 className="mt-3 font-display text-lg font-bold leading-snug">{c.title}</h3>
              <p className="text-xs text-muted-foreground">{(c as any).businesses?.name}</p>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{c.description}</p>
              <p className="mt-4 font-display text-2xl font-extrabold text-gold">{money(c.reward_amount)}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="size-3.5" />{c.estimated_minutes} min</span>
                <span className="flex items-center gap-1"><Users className="size-3.5" />{c.participant_limit} spots</span>
                <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />Ends {new Date(c.ends_at).toLocaleDateString("en-KE")}</span>
                <span className="flex items-center gap-1"><BadgeCheck className="size-3.5" />{c.verification_method}</span>
              </dl>
              <p className="mt-3 rounded-md bg-muted/60 p-2 text-xs"><b>Requirements:</b> {c.requirements}</p>
              {mine && (
                <div className="mt-4">
                  <div className="flex gap-1">
                    {steps.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full ${steps.indexOf(mine.status) >= i ? "bg-primary" : "bg-muted"}`} />)}
                  </div>
                  <div className="mt-2 flex items-center justify-between"><StatusBadge status={mine.status} />{mine.reviewer_notes && <span className="text-xs text-muted-foreground">{mine.reviewer_notes}</span>}</div>
                </div>
              )}
              <div className="mt-auto pt-4">
                {!mine && <Button className="w-full" disabled={!data?.paid || startM.isPending} onClick={() => startM.mutate(c.id)}>{data?.paid ? "Start task" : "Activate account to start"}</Button>}
                {mine?.status === "started" && <Button className="w-full" onClick={() => setProof({ id: mine.id, title: c.title })}>Submit proof</Button>}
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={Boolean(proof)} onOpenChange={(o) => !o && setProof(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit proof</DialogTitle>
            <DialogDescription>{proof?.title} — describe what you did (link, code, username or screenshot link).</DialogDescription>
          </DialogHeader>
          <Textarea rows={5} maxLength={1000} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          <Button disabled={evidence.trim().length < 3 || submitM.isPending} onClick={() => submitM.mutate()}>Send for verification</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
