import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

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
  component: () => (
    <AppShell title="Wallet">
      <p className="text-muted-foreground">Your wallet is being prepared.</p>
    </AppShell>
  ),
});
