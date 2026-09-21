import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/business")({
  head: () => ({
    meta: [
      { title: "Business portal — EARNPESA" },
      { name: "description", content: "Create campaigns, fund rewards and track verified actions." },
      { property: "og:title", content: "EARNPESA Business Portal" },
      { property: "og:description", content: "Campaign creation, funding and conversion tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell title="Business">
      <p className="text-muted-foreground">Your business workspace is being prepared.</p>
    </AppShell>
  ),
});
