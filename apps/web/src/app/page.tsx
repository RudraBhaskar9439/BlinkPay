import { NetworkStatus } from "@/components/network-status";

export const dynamic = "force-dynamic";

const phases = [
  "Exact USDC invoice",
  "Any-token exact payment",
  "Policy-aware routing",
  "Yield-position payment",
];

export default function Home() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="BlinkPay home">
          <span className="brandMark" aria-hidden="true">B</span>
          <span>BlinkPay</span>
        </a>
        <span className="buildTag">Built on Monad</span>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow">Payment intelligence, not another wallet</div>
        <h1>
          Pay from what you own.
          <span> Keep what you value.</span>
        </h1>
        <p className="lede">
          BlinkPay will find the least painful way to settle an exact USDC
          invoice from idle tokens and supported DeFi positions—under rules you
          control.
        </p>

        <div className="foundationCard">
          <div>
            <p className="cardLabel">Foundation status</p>
            <h2>The payment rails are being assembled.</h2>
          </div>
          <NetworkStatus />
        </div>
      </section>

      <section className="roadmap" aria-labelledby="roadmap-title">
        <div>
          <p className="sectionNumber">01 / Foundation</p>
          <h2 id="roadmap-title">One working route at a time.</h2>
        </div>
        <ol>
          {phases.map((phase, index) => (
            <li key={phase}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{phase}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer>
        <span>Self-custodial by design.</span>
        <span>Every route simulated before signing.</span>
      </footer>
    </main>
  );
}
