import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

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
  component: () => (
    <AppShell title="Referrals">
      <p className="text-muted-foreground">Your referral centre is being prepared.</p>
    </AppShell>
  ),
});
