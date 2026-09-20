import { Clock, ShieldCheck, Users } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export type Opportunity = { title:string; brand:string; category:string; reward:number; minutes:number; spots:string; verified:boolean; end:string };
export function OpportunityCard({ item }: { item: Opportunity }) {
  return <article className="premium-shadow flex h-full flex-col rounded-lg border bg-card p-5 transition-transform hover:-translate-y-1">
    <div className="flex items-start justify-between gap-3"><div className="grid size-11 place-items-center rounded-md bg-secondary font-display font-bold text-secondary-foreground">{item.brand.slice(0,2).toUpperCase()}</div>{item.verified && <Badge className="gap-1 bg-success text-success-foreground hover:bg-success"><ShieldCheck className="size-3"/> Verified</Badge>}</div>
    <p className="mt-5 text-xs font-bold uppercase text-primary">{item.category}</p><h3 className="mt-1 text-lg font-bold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">by {item.brand}</p>
    <div className="my-5 grid grid-cols-2 gap-3 border-y py-4"><div><p className="text-xs text-muted-foreground">Reward</p><p className="font-display text-xl font-bold text-primary">KES {item.reward}</p></div><div><p className="text-xs text-muted-foreground">Availability</p><p className="flex items-center gap-1 text-sm font-semibold"><Users className="size-4"/>{item.spots}</p></div></div>
    <div className="mb-5 flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock className="size-4"/>{item.minutes} min</span><span>Ends {item.end}</span></div>
    <Button className="mt-auto w-full">View opportunity</Button>
  </article>;
}