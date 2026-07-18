import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const colors = {
  ink: "#11110f",
  paper: "#f6f2e9",
  panel: "#ebe4d6",
  purple: "#6f5cff",
  purpleSoft: "#a99cff",
  lime: "#dfff9c",
  orange: "#ff7a4d",
  muted: "#67645e",
  white: "#fffdf8",
};

const font = 'Inter, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
const mono = '"SFMono-Regular", Menlo, Monaco, Consolas, monospace';

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type SceneProps = {
  duration: number;
  children: (frame: number) => ReactNode;
  dark?: boolean;
  chapter: string;
  number: string;
  subtitle: string;
};

const Scene = ({ duration, children, dark = false, chapter, number, subtitle }: SceneProps) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 16, duration - 18, duration], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        background: dark
          ? `radial-gradient(circle at 82% 8%, #2d2468 0%, ${colors.ink} 36%, #090908 100%)`
          : `radial-gradient(circle at 16% 2%, #ffffff 0%, ${colors.paper} 45%, #eee7d9 100%)`,
        color: dark ? colors.white : colors.ink,
        fontFamily: font,
        opacity,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          top: 46,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>BlinkPay</div>
          <div
            style={{
              padding: "7px 13px",
              borderRadius: 999,
              background: colors.lime,
              color: colors.ink,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 1.4,
            }}
          >
            BUILT ON MONAD
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ color: dark ? "#aaa6a0" : colors.muted, fontSize: 16 }}>{number}</span>
          <span style={{ fontSize: 16, fontWeight: 750, letterSpacing: 1.5 }}>{chapter}</span>
        </div>
      </div>
      {children(frame)}
      <div
        style={{
          position: "absolute",
          left: 210,
          right: 210,
          bottom: 45,
          display: "flex",
          justifyContent: "center",
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1420,
            padding: "15px 26px",
            borderRadius: 18,
            background: dark ? "rgba(8,8,8,.78)" : "rgba(255,253,248,.9)",
            border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(17,17,15,.14)"}`,
            boxShadow: "0 12px 42px rgba(0,0,0,.16)",
            fontSize: 25,
            lineHeight: 1.35,
            fontWeight: 650,
            textAlign: "center",
          }}
        >
          {subtitle}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 7,
          width: `${interpolate(frame, [0, duration], [0, 100], clamp)}%`,
          background: `linear-gradient(90deg, ${colors.purple}, ${colors.orange})`,
        }}
      />
    </AbsoluteFill>
  );
};

const BrowserFrame = ({ src, frame }: { src: string; frame: number }) => {
  const lift = interpolate(frame, [0, 40], [55, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const scale = interpolate(frame, [0, 360], [1.025, 1.07], clamp);
  return (
    <div
      style={{
        width: 1420,
        height: 790,
        borderRadius: 28,
        overflow: "hidden",
        border: "2px solid rgba(17,17,15,.75)",
        boxShadow: "18px 22px 0 rgba(111,92,255,.85), 0 40px 90px rgba(0,0,0,.22)",
        transform: `translateY(${lift}px)`,
        background: colors.paper,
      }}
    >
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 20px",
          background: "#151513",
        }}
      >
        {[colors.orange, "#ffd86b", colors.lime].map((color) => (
          <div key={color} style={{ width: 13, height: 13, borderRadius: 99, background: color }} />
        ))}
        <div
          style={{
            marginLeft: 18,
            flex: 1,
            padding: "7px 16px",
            borderRadius: 10,
            background: "#292926",
            color: "#b8b6af",
            fontFamily: mono,
            fontSize: 13,
          }}
        >
          blink-pay-web.vercel.app
        </div>
      </div>
      <div style={{ height: 742, overflow: "hidden", background: colors.paper }}>
        <Img
          src={staticFile(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
};

const PhoneFrame = ({ src, frame, side = "left" }: { src: string; frame: number; side?: "left" | "right" }) => {
  const entrance = spring({ fps: 30, frame, config: { damping: 16, stiffness: 100 } });
  const rotation = side === "left" ? -2.5 : 2.5;
  return (
    <div
      style={{
        width: 405,
        height: 862,
        border: "10px solid #121210",
        borderRadius: 52,
        background: "#121210",
        overflow: "hidden",
        boxShadow: `${side === "left" ? 22 : -22}px 28px 0 rgba(111,92,255,.72), 0 40px 80px rgba(0,0,0,.28)`,
        transform: `translateY(${interpolate(entrance, [0, 1], [110, 0])}px) rotate(${rotation}deg)`,
      }}
    >
      <div style={{ position: "absolute", width: 116, height: 25, background: "#121210", borderRadius: 0, marginLeft: 134, zIndex: 2 }} />
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
    </div>
  );
};

const Pill = ({ children, accent = false }: { children: ReactNode; accent?: boolean }) => (
  <div
    style={{
      padding: "12px 18px",
      borderRadius: 999,
      background: accent ? colors.lime : "rgba(255,255,255,.08)",
      border: `1px solid ${accent ? colors.lime : "rgba(255,255,255,.16)"}`,
      color: accent ? colors.ink : colors.white,
      fontWeight: 750,
      fontSize: 18,
    }}
  >
    {children}
  </div>
);

const Title = ({ eyebrow, children, dark = false }: { eyebrow: string; children: ReactNode; dark?: boolean }) => (
  <div>
    <div style={{ color: colors.purple, fontSize: 18, fontWeight: 850, letterSpacing: 2.4, marginBottom: 18 }}>{eyebrow}</div>
    <div style={{ fontSize: 72, lineHeight: 0.99, letterSpacing: -4, fontWeight: 880, color: dark ? colors.white : colors.ink }}>
      {children}
    </div>
  </div>
);

const IntroScene = () => (
  <Scene
    duration={600}
    chapter="THE PROBLEM"
    number="00:00"
    subtitle="One exact invoice. Value fragmented across wallet tokens and DeFi positions."
  >
    {(frame) => {
      const titleIn = spring({ frame, fps: 30, config: { damping: 18, stiffness: 90 } });
      return (
        <>
          <div style={{ position: "absolute", left: 95, top: 210, width: 750, transform: `translateY(${interpolate(titleIn, [0, 1], [50, 0])}px)`, opacity: titleIn }}>
            <div style={{ fontSize: 19, fontWeight: 850, letterSpacing: 3, color: colors.purple, marginBottom: 28 }}>INTELLIGENT PAYMENTS ON MONAD</div>
            <div style={{ fontSize: 88, lineHeight: 0.94, letterSpacing: -5, fontWeight: 900 }}>
              <div>Pay from</div>
              <div>what you own.</div>
            </div>
            <div style={{ marginTop: 8, fontSize: 88, lineHeight: 0.94, letterSpacing: -5, fontWeight: 900, color: colors.purple }}>
              <div>Keep what</div>
              <div>you value.</div>
            </div>
            <div style={{ marginTop: 38, fontSize: 26, lineHeight: 1.4, color: colors.muted, width: 680 }}>
              BlinkPay turns fragmented onchain liquidity into one exact, self-custodial USDC payment.
            </div>
          </div>
          <div style={{ position: "absolute", right: 85, top: 170, transform: "scale(.70)", transformOrigin: "top right" }}>
            <BrowserFrame src="ui/blinkpay-desktop.jpg" frame={frame} />
          </div>
          <div style={{ position: "absolute", left: 104, top: 780, display: "flex", gap: 12 }}>
            <div style={assetChip}>USDC wallet</div>
            <div style={assetChip}>WMON</div>
            <div style={assetChip}>Vault shares</div>
          </div>
        </>
      );
    }}
  </Scene>
);

const assetChip: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 13,
  border: "1px solid rgba(17,17,15,.18)",
  background: "rgba(255,253,248,.82)",
  fontSize: 17,
  fontWeight: 750,
};

const InvoiceScene = () => (
  <Scene
    duration={660}
    chapter="SIGNED REQUEST"
    number="00:20"
    subtitle="The merchant signs a portable EIP-712 invoice—no custodial database required."
  >
    {(frame) => {
      const cardIn = spring({ frame: frame - 20, fps: 30, config: { damping: 18, stiffness: 100 } });
      return (
        <>
          <div style={{ position: "absolute", left: 130, top: 160 }}>
            <PhoneFrame src="ui/blinkpay-merchant-mobile.jpg" frame={frame} />
          </div>
          <div style={{ position: "absolute", left: 720, top: 200, width: 990 }}>
            <Title eyebrow="MERCHANT FLOW">A signed request,<br />portable by design.</Title>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 50 }}>
              {[
                ["Exact amount", "0.10 USDC"],
                ["Network", "Monad Testnet"],
                ["Signature", "EIP-712 attached"],
                ["Replay", "Invoice ID protected"],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  style={{
                    padding: "25px 28px",
                    borderRadius: 22,
                    background: index === 2 ? colors.lime : colors.white,
                    border: "1px solid rgba(17,17,15,.18)",
                    boxShadow: "0 16px 44px rgba(0,0,0,.07)",
                    transform: `translateY(${interpolate(cardIn, [0, 1], [45, 0]) + index * 2}px)`,
                  }}
                >
                  <div style={{ fontSize: 15, letterSpacing: 1.4, fontWeight: 800, color: colors.muted }}>{label.toUpperCase()}</div>
                  <div style={{ marginTop: 10, fontSize: 28, fontWeight: 850 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 30, padding: "20px 24px", border: `2px solid ${colors.purple}`, borderRadius: 20, fontFamily: mono, fontSize: 17, color: colors.purple }}>
              amount · merchant · expiry · chain · router · invoiceId
            </div>
          </div>
        </>
      );
    }}
  </Scene>
);

const PolicyScene = () => (
  <Scene
    duration={990}
    dark
    chapter="AI WITH BOUNDARIES"
    number="00:42"
    subtitle="AI translates intent into strict policy. Deterministic code owns every financial decision."
  >
    {(frame) => {
      const pulse = 0.76 + Math.sin(frame / 18) * 0.08;
      const arrow = interpolate(frame, [40, 110], [0, 1], clamp);
      return (
        <>
          <div style={{ position: "absolute", left: 105, top: 165, width: 820 }}>
            <Title eyebrow="NATURAL LANGUAGE → STRICT POLICY" dark>Helpful intelligence.<br /><span style={{ color: colors.lime }}>Zero signing authority.</span></Title>
            <div style={{ marginTop: 42, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Pill accent>Preserve MON</Pill>
              <Pill>Keep 0.05 USDC liquid</Pill>
              <Pill>No borrowing</Pill>
            </div>
            <div style={{ marginTop: 36, padding: "28px 30px", borderRadius: 24, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)", fontFamily: mono, fontSize: 20, lineHeight: 1.65 }}>
              <span style={{ color: colors.purpleSoft }}>{`{`}</span><br />
              &nbsp;&nbsp;<span style={{ color: colors.lime }}>"preserveAssets"</span>: ["MON"],<br />
              &nbsp;&nbsp;<span style={{ color: colors.lime }}>"minimumUsdcReserveUnits"</span>: "50000",<br />
              &nbsp;&nbsp;<span style={{ color: colors.lime }}>"borrowingAllowed"</span>: false<br />
              <span style={{ color: colors.purpleSoft }}>{`}`}</span>
            </div>
          </div>
          <div style={{ position: "absolute", left: 955, top: 188, width: 830 }}>
            <div style={{ display: "grid", gap: 18 }}>
              {[
                ["AI", "Language → schema", "Allowed", colors.purple],
                ["Planner", "Live state → ranked routes", "Deterministic", colors.lime],
                ["Wallet", "Final user signature", "Required", colors.orange],
              ].map(([name, detail, badge, color], index) => {
                const enter = spring({ frame: frame - 20 - index * 14, fps: 30, config: { damping: 18, stiffness: 110 } });
                return (
                  <div key={name} style={{ padding: "30px 32px", borderRadius: 26, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.16)", display: "flex", alignItems: "center", gap: 24, transform: `translateX(${interpolate(enter, [0, 1], [90, 0])}px)`, opacity: enter }}>
                    <div style={{ width: 64, height: 64, borderRadius: 18, background: color, color: colors.ink, display: "grid", placeItems: "center", fontSize: 23, fontWeight: 950 }}>{index + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 19, color: "#aaa7a0", fontWeight: 750 }}>{name}</div>
                      <div style={{ marginTop: 6, fontSize: 30, fontWeight: 850 }}>{detail}</div>
                    </div>
                    <div style={{ padding: "9px 13px", borderRadius: 999, border: `1px solid ${color}`, color, fontSize: 14, fontWeight: 800 }}>{badge}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 28, padding: "24px 30px", borderRadius: 24, background: "rgba(255,122,77,.11)", border: "1px solid rgba(255,122,77,.55)" }}>
              <div style={{ color: colors.orange, fontSize: 16, fontWeight: 850, letterSpacing: 1.7 }}>AI ACCESS DENIED</div>
              <div style={{ marginTop: 12, fontSize: 25, fontWeight: 800 }}>Addresses · calldata · quotes · signing</div>
            </div>
          </div>
          <div style={{ position: "absolute", left: 902, top: 438, width: 80, height: 4, background: colors.purple, transform: `scaleX(${arrow})`, transformOrigin: "left", opacity: pulse }} />
        </>
      );
    }}
  </Scene>
);

const RouteCard = ({ number, title, detail, color, active, frame, delay }: { number: string; title: string; detail: string; color: string; active?: boolean; frame: number; delay: number }) => {
  const enter = spring({ frame: frame - delay, fps: 30, config: { damping: 20, stiffness: 95 } });
  return (
    <div style={{ padding: "24px 26px", minHeight: 137, borderRadius: 24, background: active ? colors.white : "rgba(255,255,255,.55)", border: `2px solid ${active ? colors.purple : "rgba(17,17,15,.14)"}`, boxShadow: active ? "10px 12px 0 rgba(111,92,255,.28)" : "none", transform: `translateY(${interpolate(enter, [0, 1], [55, 0])}px)`, opacity: enter }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 850, letterSpacing: 1.7, color: colors.muted }}>ROUTE {number}</div>
        <div style={{ width: 11, height: 11, borderRadius: 99, background: color }} />
      </div>
      <div style={{ marginTop: 12, fontSize: 27, fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 17, color: colors.muted, fontWeight: 600 }}>{detail}</div>
    </div>
  );
};

const RoutesScene = () => (
  <Scene
    duration={1110}
    chapter="DETERMINISTIC ROUTING"
    number="01:15"
    subtitle="Five real routes are simulated, constrained, and ranked before the wallet sees a transaction."
  >
    {(frame) => (
      <>
        <div style={{ position: "absolute", left: 95, top: 150, width: 1160 }}>
          <Title eyebrow="THE ROUTE ENGINE">One invoice.<br /><span style={{ color: colors.purple }}>Five ways to settle.</span></Title>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 40 }}>
            <RouteCard number="01" title="Wallet USDC" detail="Direct settlement" color={colors.lime} active frame={frame} delay={10} />
            <RouteCard number="02" title="WMON" detail="Exact-output swap" color={colors.purple} frame={frame} delay={22} />
            <RouteCard number="03" title="Vault shares" detail="ERC-4626 exact redeem" color={colors.orange} frame={frame} delay={34} />
            <RouteCard number="04" title="USDC + vault" detail="Atomic shortfall split" color={colors.lime} frame={frame} delay={46} />
            <RouteCard number="05" title="USDC + WMON" detail="Atomic exact-buy split" color={colors.purple} frame={frame} delay={58} />
            <div style={{ padding: "24px 26px", borderRadius: 24, background: colors.ink, color: colors.white }}>
              <div style={{ fontSize: 15, letterSpacing: 1.7, color: colors.lime, fontWeight: 850 }}>HARD CONSTRAINT</div>
              <div style={{ marginTop: 12, fontSize: 26, fontWeight: 850 }}>Exact USDC or revert</div>
              <div style={{ marginTop: 8, color: "#aaa7a0", fontSize: 17 }}>No partial merchant settlement.</div>
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", right: 88, top: 125 }}>
          <PhoneFrame src="ui/blinkpay-payer-mobile.jpg" frame={frame} side="right" />
        </div>
      </>
    )}
  </Scene>
);

const ProofScene = () => (
  <Scene
    duration={780}
    dark
    chapter="ONCHAIN PROOF"
    number="01:52"
    subtitle="A real Monad testnet receipt proves exact settlement, zero retained funds, and replay protection."
  >
    {(frame) => {
      const check = spring({ frame: frame - 20, fps: 30, config: { damping: 12, stiffness: 120 } });
      return (
        <>
          <div style={{ position: "absolute", left: 110, top: 165, width: 760 }}>
            <Title eyebrow="VERIFIED ON MONAD" dark>Proof, not<br /><span style={{ color: colors.lime }}>a success screen.</span></Title>
            <div style={{ marginTop: 42, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                ["Merchant received", "+0.100000 USDC"],
                ["Router retained", "0 new tokens"],
                ["Replay state", "PAID"],
                ["Transaction", "SUCCESS"],
              ].map(([label, value], index) => (
                <div key={label} style={{ padding: "24px 25px", borderRadius: 22, background: index === 3 ? colors.lime : "rgba(255,255,255,.07)", color: index === 3 ? colors.ink : colors.white, border: "1px solid rgba(255,255,255,.15)" }}>
                  <div style={{ fontSize: 14, letterSpacing: 1.5, fontWeight: 800, color: index === 3 ? colors.muted : "#aaa7a0" }}>{label.toUpperCase()}</div>
                  <div style={{ marginTop: 10, fontFamily: mono, fontSize: 24, fontWeight: 850 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: "absolute", right: 115, top: 165, width: 830, height: 700, borderRadius: 32, padding: "38px 42px", background: colors.white, color: colors.ink, boxShadow: "22px 25px 0 rgba(111,92,255,.78)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: colors.muted, letterSpacing: 1.8, fontSize: 15, fontWeight: 850 }}>MONAD TESTNET</div>
                <div style={{ marginTop: 8, fontSize: 34, fontWeight: 900 }}>Transaction receipt</div>
              </div>
              <div style={{ width: 74, height: 74, borderRadius: 22, background: colors.lime, display: "grid", placeItems: "center", fontSize: 42, fontWeight: 950, transform: `scale(${check})` }}>✓</div>
            </div>
            <div style={{ marginTop: 34, borderTop: "1px solid #d8d3ca" }}>
              {[
                ["STATUS", "Success"],
                ["FROM", "0x76D7…7cB1"],
                ["ROUTER", "0x6054…c9AA"],
                ["METHOD", "payFromVault"],
                ["BLOCK", "44,982,723"],
              ].map(([key, value]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "20px 0", borderBottom: "1px solid #d8d3ca" }}>
                  <span style={{ color: colors.muted, fontSize: 16, letterSpacing: 1.5, fontWeight: 800 }}>{key}</span>
                  <span style={{ fontFamily: mono, fontSize: 20, fontWeight: 800 }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 28, fontFamily: mono, fontSize: 15, color: colors.purple, lineHeight: 1.45, wordBreak: "break-all" }}>
              0xb4a23e00583b366aee730f0a6cdbe11544efb1d9a129687979e9b0fa71328571
            </div>
          </div>
        </>
      );
    }}
  </Scene>
);

const OutroScene = () => (
  <Scene
    duration={810}
    chapter="WHY IT MATTERS"
    number="02:18"
    subtitle="Fragmented onchain assets become spendable—without giving AI custody or signing power."
  >
    {(frame) => {
      const logo = spring({ frame, fps: 30, config: { damping: 16, stiffness: 80 } });
      return (
        <>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", paddingBottom: 80 }}>
            <div style={{ transform: `scale(${interpolate(logo, [0, 1], [.86, 1])})`, opacity: logo }}>
              <div style={{ display: "inline-flex", padding: "10px 18px", borderRadius: 999, background: colors.lime, fontSize: 16, fontWeight: 850, letterSpacing: 1.8 }}>LIVE ON MONAD TESTNET</div>
              <div style={{ marginTop: 30, fontSize: 114, lineHeight: .92, letterSpacing: -7, fontWeight: 920 }}>Make every asset<br /><span style={{ color: colors.purple }}>feel spendable.</span></div>
              <div style={{ marginTop: 38, display: "flex", gap: 16, justifyContent: "center" }}>
                {["60 Solidity tests", "24,576 invariant calls", "5 atomic routes", "0 custody"].map((metric) => (
                  <div key={metric} style={{ padding: "17px 22px", borderRadius: 18, background: colors.white, border: "1px solid rgba(17,17,15,.16)", fontSize: 18, fontWeight: 800 }}>{metric}</div>
                ))}
              </div>
              <div style={{ marginTop: 44, display: "flex", gap: 16, justifyContent: "center", alignItems: "center" }}>
                <div style={{ padding: "20px 30px", borderRadius: 17, background: colors.ink, color: colors.white, fontSize: 24, fontWeight: 850 }}>blink-pay-web.vercel.app</div>
                <div style={{ padding: "18px 28px", borderRadius: 17, border: `2px solid ${colors.ink}`, fontSize: 21, fontWeight: 800 }}>github.com/RudraBhaskar9439/BlinkPay</div>
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", width: 480, height: 480, borderRadius: 999, border: `2px solid ${colors.purple}`, left: -140, top: 230, opacity: .22 }} />
          <div style={{ position: "absolute", width: 620, height: 620, borderRadius: 999, border: `2px solid ${colors.orange}`, right: -240, top: 170, opacity: .2 }} />
        </>
      );
    }}
  </Scene>
);

export const BlinkPayDemo = ({ narrationFile }: { narrationFile?: string }) => (
  <AbsoluteFill style={{ background: colors.ink }}>
    <Audio src={staticFile("blinkpay-bed.mp3")} volume={0.16} />
    {narrationFile ? <Audio src={staticFile(narrationFile)} volume={1} /> : null}
    <Sequence from={0} durationInFrames={600}><IntroScene /></Sequence>
    <Sequence from={600} durationInFrames={660}><InvoiceScene /></Sequence>
    <Sequence from={1260} durationInFrames={990}><PolicyScene /></Sequence>
    <Sequence from={2250} durationInFrames={1110}><RoutesScene /></Sequence>
    <Sequence from={3360} durationInFrames={780}><ProofScene /></Sequence>
    <Sequence from={4140} durationInFrames={810}><OutroScene /></Sequence>
  </AbsoluteFill>
);
