import Link from "next/link";
import { HeaderWallet } from "@/components/header-wallet";

type AppHeaderProps = {
  context?: string;
};

export function AppHeader({ context }: AppHeaderProps) {
  const action = context === "Merchant"
    ? { href: "/", label: "Back home" }
    : context === "Checkout"
      ? { href: "/merchant", label: "New invoice" }
      : { href: "/merchant", label: "Create invoice" };

  return (
    <header className="siteHeader">
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label="BlinkPay home">
          <span className="brandMark" aria-hidden="true">
            <svg viewBox="0 0 32 32" role="img">
              <path d="M9 5h9.2c5 0 8 2.2 8 6 0 2.4-1.3 4.2-3.7 5.2 3.1.8 4.7 2.6 4.7 5.3 0 4.2-3.5 6.5-9.5 6.5H9V5Zm7.9 9c2.5 0 3.8-.8 3.8-2.5S19.5 9 17 9h-2.5v5H17Zm.6 10c2.7 0 4.1-.9 4.1-2.8 0-1.8-1.4-2.7-4.2-2.7h-2.9V24h3Z" />
            </svg>
          </span>
          <span className="brandWord">BlinkPay</span>
        </Link>

        <div className="navCenter" aria-label="Product sections">
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#routes">Routes</Link>
          <Link href="/#safety">Safety</Link>
          <Link href="/pay">Pay invoice</Link>
        </div>

        <div className="navActions">
          <span className="networkPill monadBadge"><i aria-hidden="true">M</i><span>Built on Monad</span></span>
          {context ? <span className="contextPill">{context}</span> : null}
          <Link className="payNavLink" href="/pay">Pay</Link>
          <HeaderWallet />
          <Link className="navCta" href={action.href}>{action.label}</Link>
        </div>
      </nav>
    </header>
  );
}
