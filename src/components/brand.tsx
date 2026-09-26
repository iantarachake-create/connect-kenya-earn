import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/earnpesa-logo.png.asset.json";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2 font-display font-extrabold text-foreground">
      <img src={logoAsset.url} alt="EARNPESA logo" className="size-9 rounded-full object-cover" />
      {!compact && <span className="text-xl">EARN<span className="text-primary">PESA</span> <span aria-label="Kenya">🇰🇪</span></span>}
    </Link>
  );
}
