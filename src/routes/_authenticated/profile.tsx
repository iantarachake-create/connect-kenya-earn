import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BadgeCheck, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { AppShell, StatusBadge, useMe } from "@/components/app-shell";
import { SectionCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTicket, updateProfile } from "@/lib/member.functions";
import { KENYAN_PHONE_HINT } from "@/lib/phone";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — EARNPESA" },
      { name: "description", content: "Manage your EARNPESA profile, verification and support tickets." },
      { property: "og:title", content: "EARNPESA Profile" },
      { property: "og:description", content: "Your account details, verification and support." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const q = useQueryClient();
  const { data: me } = useMe();
  const save = useServerFn(updateProfile);
  const ticket = useServerFn(createTicket);
  const [f, setF] = useState({ full_name: "", phone: "", county: "" });
  const [t, setT] = useState({ subject: "", category: "general", message: "" });
  useEffect(() => {
    if (me?.profile) setF({ full_name: me.profile.full_name ?? "", phone: me.profile.phone ? `0${me.profile.phone.slice(3)}` : "", county: me.profile.county ?? "" });
  }, [me?.profile?.id]);
  const saveM = useMutation({ mutationFn: () => save({ data: f }), onSuccess: (r) => { (r.ok ? toast.success : toast.error)(r.message); void q.invalidateQueries({ queryKey: ["me"] }); } });
  const ticketM = useMutation({ mutationFn: () => ticket({ data: t }), onSuccess: (r) => { (r.ok ? toast.success : toast.error)(r.message); if (r.ok) setT({ subject: "", category: "general", message: "" }); } });

  return (
    <AppShell title="Profile">
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Your details" action={<StatusBadge status={me?.profile?.verification_status ?? "unverified"} />}>
          <div className="space-y-4">
            <div><Label>Full name</Label><Input className="mt-2" value={f.full_name} maxLength={100} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input className="mt-2" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">{KENYAN_PHONE_HINT}</p></div>
            <div><Label>County</Label><Input className="mt-2" value={f.county} maxLength={60} onChange={(e) => setF({ ...f, county: e.target.value })} /></div>
            <div className="flex items-center justify-between rounded-md bg-muted/60 p-3 text-sm">
              <span className="flex items-center gap-2"><BadgeCheck className="size-4 text-primary" /> Registration fee</span>
              <StatusBadge status={me?.profile?.registration_paid_at ? "completed" : "pending"} />
            </div>
            <Button disabled={saveM.isPending} onClick={() => saveM.mutate()}>Save profile</Button>
          </div>
        </SectionCard>
        <SectionCard title="Support & disputes">
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><LifeBuoy className="size-4" /> Report fraud, dispute a reward or ask for help.</p>
            <div><Label>Subject</Label><Input className="mt-2" maxLength={150} value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} /></div>
            <div>
              <Label>Category</Label>
              <select className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm" value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })}>
                {["general", "payment", "withdrawal", "campaign", "fraud", "dispute"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>Message</Label><Textarea className="mt-2" rows={4} maxLength={2000} value={t.message} onChange={(e) => setT({ ...t, message: e.target.value })} /></div>
            <Button disabled={ticketM.isPending || t.subject.length < 4 || t.message.length < 5} onClick={() => ticketM.mutate()}>Open ticket</Button>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
