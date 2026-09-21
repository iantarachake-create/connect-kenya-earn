import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Brand } from "./brand";
import { Button } from "./ui/button";

const links = [
  ["/opportunities", "Opportunities"], ["/refer", "Refer & Earn"], ["/businesses", "Businesses"],
  ["/learn", "Learn"], ["/help", "Help"],
] as const;

export function PublicShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="page-shell flex h-16 items-center justify-between">
        <Brand />
        <nav className="hidden items-center gap-7 lg:flex">
          {links.map(([to,label]) => <Link key={to} to={to} className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground" activeProps={{className:"text-primary"}}>{label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <Button asChild variant="ghost"><Link to="/auth" search={{mode:"login"}}>Log in</Link></Button>
          <Button asChild><Link to="/auth" search={{mode:"signup"}}>Join EARNPESA</Link></Button>
        </div>
        <Button size="icon" variant="ghost" className="sm:hidden" aria-label="Toggle menu" onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</Button>
      </div>
      {open && <nav className="page-shell grid gap-1 border-t py-3 sm:hidden">{links.map(([to,label]) => <Link key={to} to={to} onClick={()=>setOpen(false)} className="rounded-md px-3 py-3 text-sm font-semibold hover:bg-muted">{label}</Link>)}<Link to="/auth" search={{mode:"login"}} className="rounded-md px-3 py-3 text-sm font-semibold text-primary">Log in / Join</Link></nav>}
    </header>
    <main>{children}</main>
    <footer className="border-t bg-foreground py-12 text-background">
      <div className="page-shell grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div><Brand/><p className="mt-4 max-w-sm text-sm text-background/70">A transparent marketplace connecting Kenyans with verified digital opportunities.</p></div>
        <div><p className="font-bold">Trust & support</p><div className="mt-3 grid gap-2 text-sm text-background/70"><Link to="/trust">Trust Center</Link><Link to="/help">Help Center</Link><Link to="/withdrawal-policy">Withdrawal policy</Link></div></div>
        <div><p className="font-bold">Legal</p><div className="mt-3 grid gap-2 text-sm text-background/70"><Link to="/terms">Terms & Conditions</Link><Link to="/privacy">Privacy Policy</Link></div></div>
      </div>
    </footer>
  </div>;
}