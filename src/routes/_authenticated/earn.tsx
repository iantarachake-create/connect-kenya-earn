import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

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
  component: () => (
    <AppShell title="Earn">
      <p className="text-muted-foreground">Your earning tasks are being prepared.</p>
    </AppShell>
  ),
});
