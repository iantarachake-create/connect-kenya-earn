import { Link } from "@tanstack/react-router";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2 font-display font-extrabold text-foreground">
      <span className="grid size-9 place-items-center rounded-md bg-primary text-sm text-primary-foreground">EP</span>
      {!compact && <span className="text-xl">EARN<span className="text-primary">PESA</span> <span aria-label="Kenya">🇰🇪</span></span>}
    </Link>
  );
}