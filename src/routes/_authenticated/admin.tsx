import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — EARNPESA" },
      { name: "description", content: "Review campaigns, withdrawals, fraud alerts and support tickets." },
      { property: "og:title", content: "EARNPESA Admin" },
      { property: "og:description", content: "Platform review and operations tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell title="Admin">
      <p className="text-muted-foreground">Admin tools are being prepared.</p>
    </AppShell>
  ),
});
