import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

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
  component: () => (
    <AppShell title="Dashboard">
      <p className="text-muted-foreground">Your dashboard is being prepared.</p>
    </AppShell>
  ),
});
