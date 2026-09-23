import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowDownToLine, Hourglass, Smartphone, TrendingUp, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { ActivationCard } from "@/components/activation-card";
import { StatCard, SectionCard, money } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWallet, requestWithdrawal } from "@/lib/member.functions";
import { KENYAN_PHONE_HINT, normalizeKenyanPhone } from "@/lib/phone";
import { TxTable } from "./dashboard";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — EARNPESA" },
      { name: "description", content: "View available and pending rewards, transactions and M-Pesa withdrawals." },
      { property: "og:title", content: "EARNPESA Wallet" },
      { property: "og:description", content: "Balances, transactions and withdrawal requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Wallet,
});

function Wallet() {
  const q = useQueryClient();
  const fn = useServerFn(getWallet);
  const withdraw = useServerFn(requestWithdrawal);
  const { data } = useQuery({ queryKey: ["wallet"], queryFn: () => fn() });
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => { if (data?.phone && !phone) setPhone(`0${data.phone.slice(3)}`); }, [data?.phone]);
  const w = data?.wallet;
  const available = Number(w?.available_balance ?? 0);
  const amt = Math.floor(Number(amount));
  const valid = amt >= 100 && amt <= available && Boolean(normalizeKenyanPhone(phone));

  const m = useMutation({
    mutationFn: () => withdraw({ data: { amount: amt, phone } }),
    onSuccess: (r) => {
      (r.ok ? toast.success : toast.error)(r.message);
      if (r.ok) { setAmount(""); void q.invalidateQueries({ queryKey: ["wallet"] }); void q.invalidateQueries({ queryKey: ["dashboard"] }); }
    },
  });

  return (
    <AppShell title="Wallet">
      <ActivationCard />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Available" value={money(w?.available_balance)} icon={WalletCards} />
        <StatCard label="Pending" value={money(w?.pending_balance)} icon={Hourglass} accent="gold" />
        <StatCard label="Total earned" value={money(w?.total_earned)} icon={TrendingUp} accent="gold" />
        <StatCard label="Withdrawn" value={money(w?.total_withdrawn)} icon={ArrowDownToLine} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <SectionCard title="Withdraw to M-Pesa">
          <div className="space-y-4">
            <div>
              <Label htmlFor="amt">Amount (KSH)</Label>
              <Input id="amt" className="mt-2 h-11" inputMode="numeric" placeholder="Minimum 100" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
              <div className="mt-2 flex gap-2">
                {[100, 500, 1000].map((v) => <Button key={v} size="sm" variant="outline" onClick={() => setAmount(String(v))}>{v}</Button>)}
                <Button size="sm" variant="outline" onClick={() => setAmount(String(Math.floor(available)))}>Max</Button>
              </div>
            </div>
            <div>
              <Label htmlFor="ph">M-Pesa number</Label>
              <Input id="ph" className="mt-2 h-11" inputMode="tel" placeholder="0711385747" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">{KENYAN_PHONE_HINT}</p>
            </div>
            {amt > available && <p className="text-xs text-destructive">Amount is more than your available balance.</p>}
            <Button className="h-11 w-full" disabled={!valid || !data?.paid || m.isPending} onClick={() => m.mutate()}><Smartphone /> {m.isPending ? "Submitting…" : "Request withdrawal"}</Button>
            <p className="text-xs text-muted-foreground">Withdrawals are reviewed and sent manually to M-Pesa, usually within 24 hours. One request at a time.</p>
          </div>
        </SectionCard>
        <SectionCard title="History">
          <Tabs defaultValue="tx">
            <TabsList><TabsTrigger value="tx">Transactions</TabsTrigger><TabsTrigger value="wd">Withdrawals</TabsTrigger></TabsList>
            <TabsContent value="tx"><TxTable rows={data?.transactions ?? []} /></TabsContent>
            <TabsContent value="wd">
              {(data?.withdrawals ?? []).length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No withdrawals yet.</p> : (
                <ul className="divide-y">
                  {data!.withdrawals.map((x) => (
                    <li key={x.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-bold tabular-nums">{money(x.amount)}</p>
                        <p className="font-mono text-xs text-muted-foreground">{x.reference_id} · 0{x.mpesa_phone.slice(3)}</p>
                        {x.mpesa_receipt && <p className="text-xs">M-Pesa receipt: <b>{x.mpesa_receipt}</b></p>}
                        {x.review_notes && <p className="text-xs text-muted-foreground">{x.review_notes}</p>}
                      </div>
                      <div className="text-right"><StatusBadge status={x.status} /><p className="mt-1 text-xs text-muted-foreground">{new Date(x.created_at).toLocaleDateString("en-KE")}</p></div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </SectionCard>
      </div>
    </AppShell>
  );
}
