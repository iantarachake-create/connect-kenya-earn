import { Link, useNavigate } from "@tanstack/react-router";
import { BriefcaseBusiness, Gift, LayoutDashboard, LogOut, Menu, Share2, ShieldCheck, UserRound, WalletCards, Bell } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { getMe, listNotifications, markNotificationsRead } from "@/lib/member.functions";

export function useMe() {
  const fn = useServerFn(getMe);
  return useQuery({ queryKey: ["me"], queryFn: () => fn() });
}

const baseNav = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/earn", icon: Gift, label: "Earn" },
  { to: "/referrals", icon: Share2, label: "Referrals" },
  { to: "/wallet", icon: WalletCards, label: "Wallet" },
  { to: "/profile", icon: UserRound, label: "Profile" },
  { to: "/business", icon: BriefcaseBusiness, label: "Business" },
] as const;

function Notifications({ unread }: { unread: number }) {
  const q = useQueryClient();
  const list = useServerFn(listNotifications);
  const mark = useServerFn(markNotificationsRead);
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => list(), enabled: open });
  const read = useMutation({ mutationFn: () => mark(), onSuccess: () => q.invalidateQueries({ queryKey: ["me"] }) });
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o && unread) read.mutate(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b p-3 text-sm font-bold">Notifications</p>
        <div className="max-h-80 overflow-auto">
          {(data ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">You're all caught up.</p>}
          {(data ?? []).map((n) => (
            <div key={n.id} className="border-b p-3 last:border-0">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.message}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("en-KE")}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const q = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const nav = me?.isAdmin ? [...baseNav, { to: "/admin", icon: ShieldCheck, label: "Admin" } as const] : baseNav;
  const name = me?.profile?.full_name ?? "Member";
  const initials = name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();

  async function logout() {
    await q.cancelQueries();
    q.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const links = (
    <nav className="mt-10 space-y-1">
      {nav.map(({ to, icon: Icon, label }) => (
        <Link key={to} to={to} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" activeProps={{ className: "bg-secondary !text-primary" }}>
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-card p-5 lg:block">
        <Brand />
        {links}
        <Button variant="ghost" className="absolute bottom-5 left-5 justify-start" onClick={logout}><LogOut /> Sign out</Button>
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-5">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand />
          {links}
          <Button variant="ghost" className="mt-6 justify-start" onClick={logout}><LogOut /> Sign out</Button>
        </SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></Button>
            <h1 className="text-lg font-bold">{title}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Notifications unread={me?.unread ?? 0} />
            <Link to="/profile" className="ml-2 grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold text-primary" aria-label="Profile">{initials || "EP"}</Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl space-y-6 p-4 pb-24 sm:p-7 lg:pb-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-card px-2 py-2 lg:hidden">
        {baseNav.slice(0, 5).map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-1 py-1 text-[11px] font-semibold text-muted-foreground" activeProps={{ className: "!text-primary" }}>
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    ["completed", "rewarded", "live", "approved", "success", "verified"].includes(status)
      ? "bg-success/15 text-success"
      : ["rejected", "failed", "reversed"].includes(status)
        ? "bg-destructive/10 text-destructive"
        : "bg-gold/15 text-foreground";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${tone}`}>{status.replace(/_/g, " ")}</span>;
}
