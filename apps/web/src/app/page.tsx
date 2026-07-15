import { AppHeader } from "@/components/app-header";
import { NetworkStatus } from "@/components/network-status";

export const dynamic = "force-dynamic";

const routes = [
  { number: "01", title: "Wallet USDC", detail: "Direct settlement", tone: "acid" },
  { number: "02", title: "WMON", detail: "Exact-output swap", tone: "violet" },
  { number: "03", title: "Vault shares", detail: "ERC-4626 redeem", tone: "orange" },
  { number: "04", title: "USDC + vault", detail: "Atomic split", tone: "blue" },
  { number: "05", title: "USDC + WMON", detail: "Atomic split", tone: "pink" },
];

export default function Home() {
  return (
    <main>
      <AppHeader />

      <section className="hero" id="top">
        <div className="heroCopy">
          <div className="eyebrow"><span aria-hidden="true">✦</span> Intelligent payments on Monad</div>
          <h1>
            Pay from what you own.<span> Keep what you value.</span>
          </h1>
          <p className="lede">
            BlinkPay turns one exact USDC invoice into the safest executable route
            across your wallet and DeFi positions—under rules you control.
          </p>
          <div className="heroActions">
            <a className="primaryButton buttonLink" href="/merchant">Create a signed invoice <span aria-hidden="true">↗</span></a>
            <a className="textLink" href="#how-it-works">See how routing works <span aria-hidden="true">↓</span></a>
          </div>
          <div className="heroProof" aria-label="BlinkPay assurances">
            <span><i>01</i> No custody</span>
            <span><i>02</i> Exact settlement</span>
            <span><i>03</i> Onchain receipts</span>
          </div>
        </div>

        <div className="heroDemo" aria-label="BlinkPay route preview">
          <div className="demoTopbar">
            <span className="demoBrand">BLINK<span>PAY</span></span>
            <span className="demoLive"><i /> LIVE PLAN</span>
          </div>
          <div className="demoInvoice">
            <span>Invoice total</span>
            <strong>48.00 <small>USDC</small></strong>
            <p>Design system · @studio</p>
          </div>
          <div className="demoPrompt">
            <span>AI policy</span>
            <p>“Preserve MON and keep 25 USDC liquid.”</p>
            <b>STRICT ✓</b>
          </div>
          <div className="demoRoute">
            <div className="demoRouteHead">
              <span>Recommended route</span>
              <b>#1</b>
            </div>
            <strong>USDC + vault shares</strong>
            <div className="routeComposition" aria-hidden="true"><i /><i /></div>
            <div className="routeSplit"><span>18 USDC</span><span>30 vault USDC</span></div>
          </div>
          <button className="demoButton" type="button" tabIndex={-1}>Review exact payment <span>→</span></button>
          <p className="demoFoot"><span>Simulated</span><span>Atomic</span><span>Replay protected</span></p>
        </div>
      </section>

      <section className="signalBar" aria-label="Live network status">
        <p><strong>One invoice.</strong> Five ways to settle.</p>
        <NetworkStatus />
      </section>

      <section className="howSection" id="how-it-works" aria-labelledby="how-title">
        <div className="sectionHeading">
          <p className="sectionNumber">01 / How it works</p>
          <h2 id="how-title">Intent becomes a safe transaction.</h2>
          <p>AI interprets preferences. Deterministic code owns every financial decision.</p>
        </div>
        <div className="stepsGrid">
          <article>
            <span>01</span>
            <div className="stepIcon" aria-hidden="true">✎</div>
            <h3>Merchant signs</h3>
            <p>Create an exact USDC request. The signed invoice travels in the link—never a private database.</p>
          </article>
          <article>
            <span>02</span>
            <div className="stepIcon" aria-hidden="true">⌁</div>
            <h3>Planner compares</h3>
            <p>Live balances, allowances, quotes, gas, reserves, and replay state become verifiable evidence.</p>
          </article>
          <article>
            <span>03</span>
            <div className="stepIcon" aria-hidden="true">✓</div>
            <h3>You approve</h3>
            <p>Review the exact route in your wallet. The merchant receives the signed amount or everything reverts.</p>
          </article>
        </div>
      </section>

      <section className="routesSection" id="routes" aria-labelledby="routes-title">
        <div className="sectionHeading splitHeading">
          <div>
            <p className="sectionNumber">02 / Route engine</p>
            <h2 id="routes-title">Liquidity, without the liquidation.</h2>
          </div>
          <p>Spend directly, swap only what is needed, redeem yield positions, or combine sources in one atomic transaction.</p>
        </div>
        <div className="landingRoutes">
          {routes.map((route) => (
            <article className={`landingRoute ${route.tone}`} key={route.number}>
              <span>{route.number}</span>
              <div><strong>{route.title}</strong><small>{route.detail}</small></div>
              <b aria-hidden="true">↗</b>
            </article>
          ))}
        </div>
      </section>

      <section className="safetySection" id="safety" aria-labelledby="safety-title">
        <div className="safetyCopy">
          <p className="sectionNumber">03 / AI with boundaries</p>
          <h2 id="safety-title">Helpful intelligence. Zero signing authority.</h2>
          <p>The model can translate “preserve MON” into versioned policy fields. It cannot choose addresses, produce calldata, move funds, or bypass simulation.</p>
          <a className="secondaryButton buttonLink" href="/merchant">Try the live flow <span aria-hidden="true">→</span></a>
        </div>
        <div className="boundaryCard">
          <div className="boundaryHeader"><span>Policy boundary</span><b>VERIFIED</b></div>
          <ul>
            <li><span>AI</span><strong>Natural language → strict JSON</strong><i>Allowed</i></li>
            <li><span>Planner</span><strong>Balances → ranked routes</strong><i>Deterministic</i></li>
            <li><span>Wallet</span><strong>Final user signature</strong><i>Required</i></li>
          </ul>
          <p>Addresses · calldata · quotes · signing</p>
          <div className="boundaryLock">AI ACCESS DENIED</div>
        </div>
      </section>

      <section className="closingCta">
        <p className="sectionNumber">Ready on Monad testnet</p>
        <h2>Make every asset feel spendable.</h2>
        <a className="primaryButton buttonLink" href="/merchant">Create your first invoice <span aria-hidden="true">↗</span></a>
      </section>

      <footer>
        <a className="brand footerBrand" href="#top"><span className="brandMark" aria-hidden="true">B</span><span>BlinkPay</span></a>
        <p>Self-custodial payment intelligence on Monad.</p>
        <span>Testnet · 2026</span>
      </footer>
    </main>
  );
}
