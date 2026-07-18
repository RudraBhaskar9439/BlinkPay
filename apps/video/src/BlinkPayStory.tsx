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
} from "remotion";

const c = {
  ink: "#10100e",
  paper: "#f7f3ea",
  white: "#fffdf8",
  purple: "#6f5cff",
  purpleSoft: "#a99cff",
  lime: "#dfff9c",
  orange: "#ff754d",
  red: "#ff5b58",
  muted: "#68655f",
  line: "rgba(255,255,255,.14)",
};

const sans = 'Inter, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
const mono = '"SFMono-Regular", Menlo, Monaco, Consolas, monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, 14, duration - 14, duration], [0, 1, 1, 0], clamp);

const typed = (text: string, frame: number, start: number, end: number) =>
  text.slice(0, Math.floor(interpolate(frame, [start, end], [0, text.length], clamp)));

const Scene = ({
  duration,
  chapter,
  subtitle,
  children,
  light = false,
}: {
  duration: number;
  chapter: string;
  subtitle: string;
  children: (frame: number) => ReactNode;
  light?: boolean;
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, duration], [0, 100], clamp);
  const sweep = interpolate(frame, [0, 22], [-180, 2100], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        fontFamily: sans,
        color: light ? c.ink : c.white,
        background: light
          ? `radial-gradient(circle at 82% 10%, #fff 0%, ${c.paper} 48%, #eee6d8 100%)`
          : `radial-gradient(circle at 72% 16%, #2c2464 0%, ${c.ink} 40%, #070706 100%)`,
        opacity: fade(frame, duration),
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: light ? 0.065 : 0.12,
          backgroundImage: light
            ? "linear-gradient(rgba(17,17,15,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,15,.16) 1px, transparent 1px)"
            : "linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          transform: `translate(${(frame * .16) % 56}px, ${(frame * .1) % 56}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: 999,
          left: -210 + Math.sin(frame / 45) * 50,
          top: 180 + Math.cos(frame / 52) * 38,
          background: light ? "rgba(111,92,255,.08)" : "rgba(111,92,255,.18)",
          filter: "blur(100px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 42,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
          <strong style={{ fontSize: 27, letterSpacing: -1 }}>BlinkPay</strong>
          <span style={{ background: c.lime, color: c.ink, padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 900, letterSpacing: 1.5 }}>
            BUILT ON MONAD
          </span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2, opacity: .72 }}>{chapter}</span>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(${Math.sin(frame / 60) * 4}px) scale(${interpolate(frame, [0, duration], [1.004, 1.018], clamp)})`,
          transformOrigin: "center",
        }}
      >
        {children(frame)}
      </div>
      <div style={{ position: "absolute", left: 230, right: 230, bottom: 34, display: "flex", justifyContent: "center", zIndex: 40 }}>
        <div style={{ padding: "13px 22px", borderRadius: 16, background: light ? "rgba(255,253,248,.92)" : "rgba(7,7,6,.82)", border: `1px solid ${light ? "rgba(17,17,15,.14)" : c.line}`, boxShadow: "0 18px 45px rgba(0,0,0,.18)", fontSize: 22, lineHeight: 1.3, textAlign: "center", fontWeight: 700 }}>
          {subtitle}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, bottom: 0, width: `${progress}%`, height: 6, background: `linear-gradient(90deg,${c.purple},${c.orange},${c.lime})` }} />
      <div style={{ position: "absolute", zIndex: 90, top: -120, bottom: -120, left: sweep, width: 86, opacity: interpolate(frame, [0, 5, 18, 22], [0, .65, .65, 0], clamp), transform: "rotate(8deg)", filter: "blur(15px)", background: `linear-gradient(90deg,transparent,${light ? "rgba(111,92,255,.3)" : "rgba(169,156,255,.5)"},transparent)` }} />
    </AbsoluteFill>
  );
};

type CursorPoint = [frame: number, x: number, y: number];

const Cursor = ({ frame, points, clicks = [] }: { frame: number; points: CursorPoint[]; clicks?: number[] }) => {
  const frames = points.map(([f]) => f);
  const x = interpolate(frame, frames, points.map(([, value]) => value), clamp);
  const y = interpolate(frame, frames, points.map(([, , value]) => value), clamp);
  const visible = interpolate(frame, [frames[0] - 4, frames[0], frames[frames.length - 1], frames[frames.length - 1] + 6], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 90, opacity: visible, filter: "drop-shadow(0 5px 8px rgba(0,0,0,.35))" }}>
      {clicks.map((click) => {
        const p = interpolate(frame, [click, click + 14], [0, 1], clamp);
        return <div key={click} style={{ position: "absolute", left: -15, top: -15, width: 52, height: 52, borderRadius: 99, border: `3px solid ${c.lime}`, opacity: p < 1 ? 1 - p : 0, transform: `scale(${.2 + p * 1.4})` }} />;
      })}
      <svg width="38" height="46" viewBox="0 0 38 46">
        <path d="M3 2 L3 36 L12 28 L19 44 L26 40 L19 25 L34 24 Z" fill="#11110f" stroke="#fffdf8" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

const Browser = ({ frame, children }: { frame: number; children: ReactNode }) => {
  const enter = spring({ frame, fps: 30, config: { damping: 18, stiffness: 90 } });
  return (
    <div style={{ position: "absolute", left: 110, top: 125, width: 1700, height: 830, borderRadius: 30, overflow: "hidden", background: c.paper, color: c.ink, border: "2px solid rgba(255,255,255,.18)", boxShadow: "22px 27px 0 rgba(111,92,255,.72), 0 45px 100px rgba(0,0,0,.35)", transform: `translateY(${interpolate(enter, [0, 1], [80, 0])}px) scale(${interpolate(enter, [0, 1], [.95, 1])})`, opacity: enter }}>
      <div style={{ height: 54, display: "flex", alignItems: "center", gap: 9, padding: "0 20px", background: "#151513", color: c.white }}>
        {[c.orange, "#ffd86b", c.lime].map((color) => <span key={color} style={{ width: 13, height: 13, borderRadius: 99, background: color }} />)}
        <div style={{ marginLeft: 18, flex: 1, background: "#292926", borderRadius: 10, padding: "8px 15px", fontFamily: mono, fontSize: 13, color: "#b8b6af" }}>blink-pay-web.vercel.app</div>
      </div>
      <div style={{ position: "relative", height: 776, overflow: "hidden" }}>{children}</div>
    </div>
  );
};

const Phone = ({ frame, children, x = 1260, y = 120, rotate = 2.5 }: { frame: number; children: ReactNode; x?: number; y?: number; rotate?: number }) => {
  const enter = spring({ frame, fps: 30, config: { damping: 16, stiffness: 95 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 420, height: 860, borderRadius: 54, border: "10px solid #10100e", background: c.paper, color: c.ink, overflow: "hidden", boxShadow: "22px 28px 0 rgba(111,92,255,.7), 0 42px 90px rgba(0,0,0,.35)", transform: `translateY(${interpolate(enter, [0, 1], [120, 0]) + Math.sin(frame / 28) * 7}px) rotate(${rotate + Math.sin(frame / 72) * .45}deg)`, opacity: enter }}>
      <div style={{ position: "absolute", zIndex: 30, left: 142, top: 0, width: 116, height: 25, borderRadius: "0 0 16px 16px", background: c.ink }} />
      {children}
    </div>
  );
};

const Label = ({ children, tone = c.purple }: { children: ReactNode; tone?: string }) => (
  <div style={{ color: tone, fontSize: 17, fontWeight: 900, letterSpacing: 2.5 }}>{children}</div>
);

const HookScene = () => (
  <Scene duration={270} chapter="00 / THE PROBLEM" subtitle="The merchant wants exactly 1 USDC. The payer's value is fragmented across wallet and DeFi positions.">
    {(frame) => {
      const center = spring({ frame: frame - 18, fps: 30, config: { damping: 17, stiffness: 90 } });
      const chips = [
        ["0.80", "Wallet USDC", 250, 230, c.lime],
        ["0.90", "Vault shares", 1290, 220, c.orange],
        ["0.048", "WMON", 230, 710, c.purpleSoft],
        ["MON", "Gas reserve", 1320, 700, "#71d7ff"],
      ] as const;
      return (
        <>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
            <div style={{ transform: `scale(${interpolate(center, [0, 1], [.8, 1])})`, opacity: center }}>
              <Label tone={c.lime}>SIGNED PAYMENT REQUEST</Label>
              <div style={{ marginTop: 20, fontSize: 132, letterSpacing: -8, lineHeight: .9, fontWeight: 950 }}>1.00 <span style={{ color: c.lime }}>USDC</span></div>
              <div style={{ marginTop: 28, fontSize: 29, color: "#aaa7a0", fontWeight: 650 }}>Merchant must receive the exact amount.</div>
            </div>
          </div>
          {chips.map(([value, label, left, top, color], index) => {
            const chipIn = spring({ frame: frame - 35 - index * 12, fps: 30, config: { damping: 16, stiffness: 105 } });
            return (
              <div key={label} style={{ position: "absolute", left, top, width: 300, padding: "22px 24px", borderRadius: 22, background: "rgba(255,255,255,.07)", border: `1px solid ${color}`, transform: `translateY(${interpolate(chipIn, [0, 1], [45, 0]) + Math.sin((frame + index * 18) / 25) * 8}px)`, opacity: chipIn }}>
                <div style={{ fontSize: 38, fontWeight: 900, color }}>{value}</div>
                <div style={{ marginTop: 7, color: "#aaa7a0", fontSize: 18, fontWeight: 750 }}>{label}</div>
              </div>
            );
          })}
          {[0, 1, 2].map((index) => <div key={index} style={{ position: "absolute", left: 960 - index * 175, top: 535 + index * 18, width: 350, height: 2, opacity: .28, background: `linear-gradient(90deg,transparent,${index === 1 ? c.orange : c.purple},transparent)`, transform: `rotate(${index * 24 - 24}deg) scaleX(${interpolate(frame, [70 + index * 12, 130 + index * 12], [0, 1], clamp)})` }} />)}
        </>
      );
    }}
  </Scene>
);

const MerchantScene = () => (
  <Scene duration={780} chapter="01 / MERCHANT" subtitle="The merchant enters 1 USDC, signs the EIP-712 request, and BlinkPay generates a shareable payment QR." light>
    {(frame) => {
      const amount = typed("1.00", frame, 70, 120);
      const description = typed("Spark demo payment", frame, 145, 245);
      const walletOpen = interpolate(frame, [285, 310, 420, 445], [0, 1, 1, 0], clamp);
      const qrIn = spring({ frame: frame - 420, fps: 30, config: { damping: 15, stiffness: 95 } });
      return (
        <>
          <Browser frame={frame}>
            <div style={{ height: 70, padding: "0 34px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #d9d4ca" }}>
              <strong style={{ fontSize: 25 }}>BlinkPay merchant</strong>
              <div style={{ display: "flex", gap: 18, alignItems: "center" }}><span style={{ color: c.muted, fontSize: 15 }}>Monad Testnet</span><span style={{ padding: "10px 14px", borderRadius: 12, background: c.white, border: "1px solid #ccc6bc", fontFamily: mono }}>0xD1A1…061d2</span></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 28, padding: "32px 36px" }}>
              <div style={{ padding: "30px", borderRadius: 26, border: "1px solid #d7d1c7", background: c.white }}>
                <Label>REQUEST AN EXACT PAYMENT</Label>
                <div style={{ marginTop: 10, fontSize: 52, lineHeight: 1, letterSpacing: -3, fontWeight: 920 }}>Create a signed invoice.</div>
                <div style={{ marginTop: 26, fontSize: 15, fontWeight: 850 }}>AMOUNT</div>
                <div style={{ marginTop: 8, height: 70, border: `2px solid ${frame > 55 && frame < 135 ? c.purple : "#d4cec4"}`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", fontSize: 29, fontWeight: 850 }}><span>{amount}<i style={{ opacity: frame > 70 && frame < 125 ? 1 : 0 }}>|</i></span><span style={{ color: c.muted, fontSize: 18 }}>USDC</span></div>
                <div style={{ marginTop: 20, fontSize: 15, fontWeight: 850 }}>WHAT IS THIS FOR?</div>
                <div style={{ marginTop: 8, height: 70, border: `2px solid ${frame > 135 && frame < 260 ? c.purple : "#d4cec4"}`, borderRadius: 16, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 24, fontWeight: 700 }}>{description}<i style={{ opacity: frame > 145 && frame < 248 ? 1 : 0 }}>|</i></div>
                <div style={{ marginTop: 20, display: "flex", gap: 14 }}>
                  <div style={{ flex: 1, padding: "16px 18px", borderRadius: 14, background: c.paper, border: "1px solid #d4cec4" }}><small style={{ color: c.muted }}>EXPIRES</small><strong style={{ display: "block", marginTop: 5 }}>30 minutes</strong></div>
                  <div style={{ flex: 1, padding: "16px 18px", borderRadius: 14, background: c.paper, border: "1px solid #d4cec4" }}><small style={{ color: c.muted }}>NETWORK</small><strong style={{ display: "block", marginTop: 5 }}>Monad Testnet</strong></div>
                </div>
                <button style={{ marginTop: 23, width: "100%", height: 66, border: 0, borderRadius: 16, background: c.ink, color: c.white, fontSize: 23, fontWeight: 900, boxShadow: `8px 9px 0 ${c.purple}` }}>Sign invoice ↗</button>
              </div>
              <div style={{ position: "relative", padding: "30px", borderRadius: 26, border: "1px solid #d7d1c7", background: qrIn > .02 ? "#ebe4d6" : "rgba(235,228,214,.42)", overflow: "hidden" }}>
                <div style={{ opacity: interpolate(qrIn, [0, 1], [0, 1]), transform: `translateY(${interpolate(qrIn, [0, 1], [55, 0])}px) scale(${interpolate(qrIn, [0, 1], [.9, 1])})`, textAlign: "center" }}>
                  <Label tone={c.orange}>SIGNED INVOICE READY</Label>
                  <div style={{ margin: "18px auto 0", width: 300, height: 300, padding: 14, borderRadius: 22, background: c.white, boxShadow: "0 20px 50px rgba(0,0,0,.15)" }}><Img src={staticFile("ui/blinkpay-payment-qr.png")} style={{ width: "100%", height: "100%" }} /></div>
                  <div style={{ marginTop: 20, fontSize: 48, fontWeight: 920 }}>1.00 USDC</div>
                  <div style={{ marginTop: 8, color: c.muted, fontSize: 19 }}>Spark demo payment</div>
                  <div style={{ marginTop: 20, padding: "14px", borderRadius: 12, background: c.white, border: "1px solid #d4cec4", fontFamily: mono, fontSize: 13 }}>blink-pay-web.vercel.app/pay?invoice=…</div>
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 10 }}><span style={safePill}>✓ Merchant signature</span><span style={safePill}>✓ Replay protected</span></div>
                </div>
                <div style={{ position: "absolute", inset: 0, display: qrIn > .02 ? "none" : "grid", placeItems: "center", color: c.muted, textAlign: "center", fontSize: 22, lineHeight: 1.4 }}>Sign the invoice to create<br />the QR and payment link.</div>
              </div>
            </div>
            <div style={{ position: "absolute", right: 70, top: 105, width: 420, padding: 24, borderRadius: 24, background: "#1c1c1a", color: c.white, boxShadow: "0 28px 70px rgba(0,0,0,.35)", opacity: walletOpen, transform: `translateY(${interpolate(walletOpen, [0, 1], [-25, 0])}px) scale(${.96 + walletOpen * .04})`, zIndex: 70 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontSize: 21 }}>Wallet signature</strong><span style={{ color: c.lime, fontSize: 13 }}>MONAD TESTNET</span></div>
              <div style={{ marginTop: 18, padding: 17, borderRadius: 15, background: "#2a2a27", fontFamily: mono, fontSize: 14, lineHeight: 1.7 }}>amount: 1.00 USDC<br />merchant: 0xD1A1…061d2<br />expiry: 30 minutes<br />invoiceId: 0xda06…</div>
              <div style={{ marginTop: 18, display: "flex", gap: 12 }}><button style={walletSecondary}>Cancel</button><button style={walletPrimary}>Sign</button></div>
            </div>
          </Browser>
          <Cursor frame={frame} points={[[15, 1530, 170], [65, 700, 382], [150, 710, 525], [270, 720, 790], [350, 1540, 540], [480, 1390, 780], [720, 1470, 770]]} clicks={[70, 150, 275, 355, 490]} />
        </>
      );
    }}
  </Scene>
);

const safePill: CSSProperties = { padding: "9px 12px", borderRadius: 999, background: c.lime, color: c.ink, fontSize: 13, fontWeight: 850 };
const walletPrimary: CSSProperties = { flex: 1, height: 52, border: 0, borderRadius: 13, background: c.purple, color: c.white, fontSize: 17, fontWeight: 900 };
const walletSecondary: CSSProperties = { flex: 1, height: 52, border: "1px solid #555", borderRadius: 13, background: "transparent", color: c.white, fontSize: 17, fontWeight: 800 };

const ScanScene = () => (
  <Scene duration={450} chapter="02 / SCAN" subtitle="The payer scans the QR. The signed invoice opens directly on their phone—amount, merchant and expiry already verified.">
    {(frame) => {
      const scanned = spring({ frame: frame - 205, fps: 30, config: { damping: 16, stiffness: 100 } });
      const beam = interpolate(frame % 80, [0, 40, 80], [95, 465, 95], clamp);
      return (
        <>
          <div style={{ position: "absolute", left: 210, top: 190, width: 650 }}>
            <Label tone={c.lime}>SCAN TO PAY</Label>
            <div style={{ marginTop: 18, fontSize: 72, lineHeight: .98, letterSpacing: -4, fontWeight: 930 }}>A payment request<br />that travels.</div>
            <div style={{ position: "relative", marginTop: 38, width: 420, height: 420, borderRadius: 32, padding: 22, background: c.white, boxShadow: "18px 22px 0 rgba(111,92,255,.7)" }}>
              <Img src={staticFile("ui/blinkpay-payment-qr.png")} style={{ width: "100%", height: "100%" }} />
              <div style={{ position: "absolute", left: 18, right: 18, top: beam, height: 4, background: c.lime, boxShadow: `0 0 22px ${c.lime}`, opacity: frame < 230 ? .9 : 0 }} />
              <div style={{ position: "absolute", inset: 10, border: `3px solid ${frame > 190 ? c.lime : c.purple}`, borderRadius: 25, opacity: .75 }} />
            </div>
          </div>
          <Phone frame={frame} x={1160} y={125} rotate={3}>
            <div style={{ position: "absolute", inset: 0, background: c.ink, color: c.white, opacity: 1 - scanned, display: "grid", placeItems: "center" }}>
              <div style={{ width: 300, height: 300, border: `3px solid ${c.lime}`, borderRadius: 28, position: "relative" }}><div style={{ position: "absolute", left: 22, right: 22, top: interpolate(frame % 80, [0, 40, 80], [30, 260, 30], clamp), height: 3, background: c.lime, boxShadow: `0 0 18px ${c.lime}` }} /></div>
              <div style={{ position: "absolute", bottom: 110, fontSize: 18, fontWeight: 800 }}>Point at the BlinkPay QR</div>
            </div>
            <div style={{ position: "absolute", inset: 0, background: c.paper, opacity: scanned, padding: "54px 24px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: 9, background: c.ink, color: c.lime, display: "grid", placeItems: "center", fontWeight: 950 }}>B</div><strong>BlinkPay</strong></div>
              <div style={{ marginTop: 38, color: c.purple, fontSize: 13, fontWeight: 900, letterSpacing: 1.6 }}>SIGNED PAYMENT REQUEST</div>
              <div style={{ marginTop: 12, fontSize: 42, lineHeight: .98, letterSpacing: -2.5, fontWeight: 930 }}>Merchant receives exactly</div>
              <div style={{ marginTop: 16, fontSize: 64, fontWeight: 950 }}>1.00 <span style={{ color: c.purple }}>USDC</span></div>
              <div style={{ marginTop: 24, padding: 18, borderRadius: 16, background: c.white, border: "1px solid #d3cdc3" }}><small style={{ color: c.muted }}>FOR</small><strong style={{ display: "block", marginTop: 6, fontSize: 21 }}>Spark demo payment</strong></div>
              <div style={{ marginTop: 12, display: "grid", gap: 9 }}>{["✓ Merchant signature attached", "✓ Exact amount enforced", "✓ Replay protected"].map((item) => <div key={item} style={{ padding: "11px 13px", borderRadius: 999, background: c.lime, fontSize: 14, fontWeight: 850 }}>{item}</div>)}</div>
              <button style={{ marginTop: 24, width: "100%", height: 60, border: 0, borderRadius: 15, background: c.ink, color: c.white, fontSize: 19, fontWeight: 900 }}>Connect payer wallet</button>
            </div>
          </Phone>
          <div style={{ position: "absolute", left: 880, top: 515, width: 250, height: 3, background: `linear-gradient(90deg,${c.lime},${c.purple})`, transform: `scaleX(${interpolate(frame, [120, 230], [0, 1], clamp)})`, transformOrigin: "left" }} />
          <div style={{ position: "absolute", left: 1090, top: 500, width: 22, height: 22, borderRadius: 99, background: c.lime, boxShadow: `0 0 30px ${c.lime}`, opacity: interpolate(frame, [160, 205, 250], [0, 1, 0], clamp) }} />
        </>
      );
    }}
  </Scene>
);

const PayerScene = () => (
  <Scene duration={900} chapter="03 / PAYER" subtitle="The payer is short 0.20 wallet USDC. AI converts their preference into policy; deterministic code analyzes live balances and routes." light>
    {(frame) => {
      const prompt = typed("Preserve WMON. Use wallet USDC first. Do not borrow.", frame, 260, 455);
      const policyIn = spring({ frame: frame - 500, fps: 30, config: { damping: 17, stiffness: 100 } });
      const analyzing = frame > 680;
      const assets = [
        ["Wallet USDC", "0.80", "Spendable", c.lime],
        ["Vault position", "0.90", "USDC shares", c.orange],
        ["WMON", "0.048", "Preserve", c.purple],
      ] as const;
      return (
        <>
          <div style={{ position: "absolute", left: 95, top: 145, width: 760 }}>
            <Label>LIVE WALLET STATE</Label>
            <div style={{ marginTop: 15, fontSize: 64, lineHeight: .96, letterSpacing: -4, fontWeight: 930 }}>The invoice is 1 USDC.<br /><span style={{ color: c.red }}>Wallet USDC is not enough.</span></div>
            <div style={{ marginTop: 36, display: "grid", gap: 14 }}>
              {assets.map(([name, value, detail, color], index) => {
                const itemIn = spring({ frame: frame - 28 - index * 13, fps: 30, config: { damping: 16, stiffness: 105 } });
                return <div key={name} style={{ padding: "20px 22px", borderRadius: 20, background: c.white, border: `2px solid ${color}`, display: "flex", justifyContent: "space-between", alignItems: "center", transform: `translateX(${interpolate(itemIn, [0, 1], [-60, 0])}px)`, opacity: itemIn }}><div><small style={{ color: c.muted, fontWeight: 800 }}>{name.toUpperCase()}</small><div style={{ marginTop: 5, fontSize: 28, fontWeight: 900 }}>{value}</div></div><span style={{ padding: "9px 12px", borderRadius: 999, background: `${color}33`, color: c.ink, fontSize: 14, fontWeight: 850 }}>{detail}</span></div>;
              })}
            </div>
            <div style={{ marginTop: 18, padding: "18px 22px", borderRadius: 18, background: "#fff1ee", border: `1px solid ${c.red}` }}><strong style={{ color: c.red }}>Direct payment unavailable</strong><span style={{ float: "right", fontFamily: mono }}>0.20 USDC shortfall</span></div>
          </div>
          <div style={{ position: "absolute", right: 92, top: 145, width: 880, height: 760, padding: "32px", borderRadius: 28, background: "#171715", color: c.white, border: "1px solid rgba(17,17,15,.2)", boxShadow: "18px 22px 0 rgba(111,92,255,.62)" }}>
            <Label tone={c.lime}>AI PREFERENCE GUARDRAIL</Label>
            <div style={{ marginTop: 13, fontSize: 46, lineHeight: 1, fontWeight: 920 }}>Tell BlinkPay what matters.</div>
            <div style={{ marginTop: 25, minHeight: 130, padding: "22px", borderRadius: 18, background: "#292926", border: `2px solid ${frame > 235 && frame < 470 ? c.purple : "#454541"}`, fontSize: 22, lineHeight: 1.45 }}>{prompt}<i style={{ opacity: frame > 260 && frame < 458 ? 1 : 0, color: c.lime }}>|</i></div>
            <div style={{ marginTop: 17, display: "flex", gap: 12 }}><button style={{ flex: 1, height: 58, border: `1px solid ${c.lime}`, borderRadius: 14, background: c.lime, color: c.ink, fontSize: 18, fontWeight: 900 }}>Apply preferences</button><button style={{ flex: 1, height: 58, border: "1px solid #777", borderRadius: 14, background: "transparent", color: c.white, fontSize: 18, fontWeight: 850 }}>Use safe defaults</button></div>
            <div style={{ marginTop: 22, padding: "20px", borderRadius: 18, background: "#222220", border: "1px solid #444", opacity: policyIn, transform: `translateY(${interpolate(policyIn, [0, 1], [30, 0])}px)` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><strong style={{ color: c.lime }}>STRICT POLICY COMPILED</strong><span style={{ fontSize: 13, color: "#aaa7a0" }}>AI cannot sign</span></div>
              <div style={{ marginTop: 12, fontFamily: mono, fontSize: 16, lineHeight: 1.7 }}><span style={{ color: c.purpleSoft }}>preserveAssets</span>: ["WMON"]<br /><span style={{ color: c.purpleSoft }}>spendWalletUsdcFirst</span>: true<br /><span style={{ color: c.purpleSoft }}>borrowingAllowed</span>: false</div>
            </div>
            <button style={{ marginTop: 22, width: "100%", height: 66, border: 0, borderRadius: 16, background: analyzing ? c.purple : c.white, color: analyzing ? c.white : c.ink, fontSize: 21, fontWeight: 920, boxShadow: `8px 9px 0 ${c.lime}` }}>{analyzing ? "Analyzing 5 wallet routes…" : "Analyze wallet routes"}</button>
            <div style={{ marginTop: 18, display: "flex", gap: 10 }}>{["Balances", "Allowances", "Vault preview", "Gas", "Replay state"].map((label, index) => <span key={label} style={{ padding: "8px 10px", borderRadius: 999, background: analyzing && frame > 690 + index * 16 ? c.lime : "#333330", color: analyzing && frame > 690 + index * 16 ? c.ink : "#aaa7a0", fontSize: 12, fontWeight: 850 }}>{analyzing && frame > 690 + index * 16 ? "✓ " : ""}{label}</span>)}</div>
          </div>
          <Cursor frame={frame} points={[[210, 1500, 390], [270, 1210, 410], [475, 1230, 565], [590, 1340, 770], [680, 1340, 775], [860, 1400, 840]]} clicks={[270, 480, 685]} />
        </>
      );
    }}
  </Scene>
);

const PlannerScene = () => (
  <Scene duration={1050} chapter="04 / PLANNER" subtitle="AI explains the preference. The deterministic planner recommends one atomic split: 0.80 wallet USDC plus 0.20 USDC from the vault.">
    {(frame) => {
      const routes = [
        ["01", "Wallet USDC", "Unavailable", "Short 0.20", c.red],
        ["02", "WMON", "Eligible", "Preserved by policy", c.purpleSoft],
        ["03", "Vault only", "Eligible", "Higher share cost", c.orange],
        ["04", "USDC + vault", "Recommended", "0.80 + 0.20", c.lime],
        ["05", "USDC + WMON", "Eligible", "WMON preserved", c.purpleSoft],
      ] as const;
      const flow = interpolate(frame, [470, 760], [0, 1], clamp);
      return (
        <>
          <div style={{ position: "absolute", left: 95, right: 95, top: 135 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}><div><Label tone={c.lime}>AI-ASSISTED. DETERMINISTICALLY EXECUTED.</Label><div style={{ marginTop: 12, fontSize: 63, lineHeight: .95, letterSpacing: -4, fontWeight: 930 }}>Five routes enter.<br /><span style={{ color: c.lime }}>One exact route wins.</span></div></div><div style={{ display: "flex", gap: 9, alignItems: "center" }}>{["Intent", "Policy", "Live state", "Simulation", "Rank"].map((label, index) => <div key={label} style={{ padding: "12px 14px", borderRadius: 12, background: frame > 80 + index * 20 ? c.lime : "rgba(255,255,255,.08)", color: frame > 80 + index * 20 ? c.ink : c.white, fontSize: 13, fontWeight: 900 }}>{index + 1}. {label}</div>)}</div></div>
            <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 13 }}>
              {routes.map(([number, title, status, detail, tone], index) => {
                const cardIn = spring({ frame: frame - 70 - index * 18, fps: 30, config: { damping: 18, stiffness: 105 } });
                const recommended = number === "04";
                const scan = interpolate(frame, [120 + index * 55, 165 + index * 55, 210 + index * 55], [0, 1, 0], clamp);
                return <div key={number} style={{ position: "relative", overflow: "hidden", minHeight: 225, padding: "22px", borderRadius: 22, background: recommended && frame > 380 ? c.white : "rgba(255,255,255,.07)", color: recommended && frame > 380 ? c.ink : c.white, border: `2px solid ${recommended && frame > 380 ? c.lime : scan > .1 ? c.purpleSoft : "rgba(255,255,255,.15)"}`, boxShadow: recommended && frame > 380 ? `12px 14px 0 ${c.purple}` : "none", transform: `translateY(${interpolate(cardIn, [0, 1], [55, 0])}px) scale(${recommended && frame > 380 ? 1.025 : 1})`, opacity: cardIn }}><div style={{ fontSize: 14, letterSpacing: 1.5, fontWeight: 900, color: recommended && frame > 380 ? c.purple : "#aaa7a0" }}>ROUTE {number}</div><div style={{ marginTop: 17, fontSize: 26, lineHeight: 1.05, fontWeight: 900 }}>{title}</div><div style={{ marginTop: 20, display: "inline-flex", padding: "8px 10px", borderRadius: 999, background: tone, color: c.ink, fontSize: 12, fontWeight: 900 }}>{status}</div><div style={{ marginTop: 16, fontFamily: mono, fontSize: 14, color: recommended && frame > 380 ? c.muted : "#aaa7a0" }}>{detail}</div><div style={{ position: "absolute", inset: 0, width: "40%", background: "linear-gradient(90deg,transparent,rgba(169,156,255,.22),transparent)", transform: `translateX(${interpolate(frame, [90 + index * 35, 250 + index * 35], [-180, 520], clamp)}px) skewX(-14deg)` }} /></div>;
              })}
            </div>
            <div style={{ marginTop: 45, height: 280, position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1.15fr", gap: 80, alignItems: "center" }}>
              <div style={{ padding: "24px", borderRadius: 22, background: "rgba(223,255,156,.1)", border: `2px solid ${c.lime}` }}><small style={{ color: c.lime, fontWeight: 900 }}>SOURCE 1</small><div style={{ marginTop: 8, fontSize: 38, fontWeight: 920 }}>0.80 USDC</div><div style={{ color: "#aaa7a0" }}>wallet balance</div></div>
              <div style={{ padding: "24px", borderRadius: 22, background: "rgba(255,117,77,.1)", border: `2px solid ${c.orange}` }}><small style={{ color: c.orange, fontWeight: 900 }}>SOURCE 2</small><div style={{ marginTop: 8, fontSize: 38, fontWeight: 920 }}>0.20 USDC</div><div style={{ color: "#aaa7a0" }}>redeemed from vault</div></div>
              <div style={{ padding: "30px", borderRadius: 25, background: c.lime, color: c.ink, boxShadow: `14px 17px 0 ${c.purple}`, transform: `scale(${.92 + flow * .08})` }}><small style={{ fontWeight: 900 }}>MERCHANT RECEIVES</small><div style={{ marginTop: 7, fontSize: 56, fontWeight: 950 }}>1.00 USDC</div><div style={{ fontWeight: 800 }}>exactly, or the transaction reverts</div></div>
              {[0, 1, 2].map((index) => <div key={index} style={{ position: "absolute", left: 480 + flow * 650, top: 95 + index * 28, width: 16, height: 16, borderRadius: 99, background: index === 1 ? c.orange : c.lime, boxShadow: `0 0 18px ${index === 1 ? c.orange : c.lime}`, opacity: frame > 470 ? 1 : 0 }} />)}
            </div>
          </div>
        </>
      );
    }}
  </Scene>
);

const PaymentScene = () => (
  <Scene duration={750} chapter="05 / ONE ATOMIC PAYMENT" subtitle="The payer reviews the exact split, confirms the wallet transaction, and both funding legs settle atomically on Monad." light>
    {(frame) => {
      const walletOpen = spring({ frame: frame - 245, fps: 30, config: { damping: 16, stiffness: 105 } });
      const confirmed = spring({ frame: frame - 490, fps: 30, config: { damping: 14, stiffness: 110 } });
      return (
        <>
          <Phone frame={frame} x={250} y={125} rotate={-2.5}>
            <div style={{ padding: "58px 24px 24px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}><div style={{ width: 34, height: 34, borderRadius: 9, background: c.ink, color: c.lime, display: "grid", placeItems: "center", fontWeight: 950 }}>B</div><strong>BlinkPay checkout</strong></div>
              <div style={{ marginTop: 33, fontSize: 15, fontWeight: 900, letterSpacing: 1.6, color: c.purple }}>RECOMMENDED ROUTE #1</div>
              <div style={{ marginTop: 12, fontSize: 39, lineHeight: 1.02, letterSpacing: -2, fontWeight: 920 }}>Pay with USDC<br />+ vault shares</div>
              <div style={{ marginTop: 24, padding: 18, borderRadius: 18, background: c.white, border: "1px solid #d4cec4" }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>Wallet USDC</span><strong>0.80</strong></div><div style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}><span>Vault redemption</span><strong>0.20</strong></div><div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #d4cec4", display: "flex", justifyContent: "space-between", fontSize: 22 }}><strong>Merchant receives</strong><strong>1.00 USDC</strong></div></div>
              <div style={{ marginTop: 18, display: "grid", gap: 8 }}>{["Simulated", "Atomic", "Replay protected"].map((item) => <div key={item} style={{ padding: "9px 11px", borderRadius: 999, background: c.lime, fontSize: 13, fontWeight: 850 }}>✓ {item}</div>)}</div>
              <button style={{ marginTop: 23, width: "100%", height: 62, border: 0, borderRadius: 15, background: c.ink, color: c.white, fontSize: 19, fontWeight: 900, boxShadow: `7px 8px 0 ${c.purple}` }}>Pay 1.00 USDC</button>
            </div>
          </Phone>
          <div style={{ position: "absolute", left: 820, top: 170, width: 900 }}>
            <Label>FINAL USER AUTHORITY</Label>
            <div style={{ marginTop: 15, fontSize: 70, lineHeight: .95, letterSpacing: -4, fontWeight: 930 }}>AI never signs.<br /><span style={{ color: c.purple }}>The payer confirms.</span></div>
            <div style={{ marginTop: 45, padding: "30px", borderRadius: 28, background: "#1b1b19", color: c.white, boxShadow: "17px 20px 0 rgba(111,92,255,.62)", opacity: walletOpen, transform: `translateY(${interpolate(walletOpen, [0, 1], [60, 0])}px) scale(${interpolate(walletOpen, [0, 1], [.94, 1])})` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><strong style={{ fontSize: 25 }}>Confirm transaction</strong><span style={{ color: c.lime, fontWeight: 850 }}>MONAD TESTNET</span></div>
              <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{[["METHOD", "paySplitWithVault"], ["MERCHANT", "0xD1A1…061d2"], ["WALLET USDC", "0.80"], ["VAULT MAX", "0.201 shares"]].map(([label, value]) => <div key={label} style={{ padding: 16, borderRadius: 14, background: "#292926" }}><small style={{ color: "#aaa7a0" }}>{label}</small><strong style={{ display: "block", marginTop: 6, fontFamily: mono }}>{value}</strong></div>)}</div>
              <div style={{ marginTop: 18, padding: "15px 17px", borderRadius: 14, border: `1px solid ${c.lime}`, color: c.lime, fontSize: 14 }}>✓ Exact 1.00 USDC output · ✓ Atomic or revert · ✓ No retained funds</div>
              <div style={{ marginTop: 20, display: "flex", gap: 12 }}><button style={walletSecondary}>Reject</button><button style={walletPrimary}>Confirm</button></div>
            </div>
            <div style={{ marginTop: 42, display: "flex", alignItems: "center", gap: 18, opacity: confirmed }}><div style={{ width: 72, height: 72, borderRadius: 20, background: c.lime, display: "grid", placeItems: "center", fontSize: 38, fontWeight: 950 }}>✓</div><div><strong style={{ fontSize: 27 }}>Submitted to Monad</strong><div style={{ marginTop: 5, color: c.muted }}>Waiting for final receipt…</div></div></div>
          </div>
          <Cursor frame={frame} points={[[120, 530, 780], [210, 530, 820], [330, 1480, 730], [470, 1480, 735], [680, 1520, 795]]} clicks={[215, 475]} />
        </>
      );
    }}
  </Scene>
);

const ProofScene = () => (
  <Scene duration={630} chapter="06 / ONCHAIN PROOF" subtitle="A real Monad receipt proves the split: 0.80 wallet USDC + 0.20 vault USDC became exactly 1.00 USDC for the merchant.">
    {(frame) => {
      const receiptIn = spring({ frame: frame - 25, fps: 30, config: { damping: 17, stiffness: 90 } });
      const gain = interpolate(frame, [90, 230], [0, 1], clamp);
      const rows = [["STATUS", "Success"], ["METHOD", "paySplitWithVault"], ["DIRECT LEG", "0.800000 USDC"], ["VAULT LEG", "0.200000 USDC"], ["MERCHANT DELTA", "+1.000000 USDC"], ["BLOCK", "44,974,526"]];
      return (
        <>
          <div style={{ position: "absolute", left: 110, top: 155, width: 650 }}><Label tone={c.lime}>REAL MONAD TESTNET TRANSACTION</Label><div style={{ marginTop: 16, fontSize: 74, lineHeight: .94, letterSpacing: -4.5, fontWeight: 940 }}>Not a success toast.<br /><span style={{ color: c.lime }}>A verifiable receipt.</span></div><div style={{ marginTop: 42, padding: "26px", borderRadius: 24, background: "rgba(255,255,255,.07)", border: `1px solid ${c.line}` }}><small style={{ color: "#aaa7a0", fontWeight: 850 }}>MERCHANT WALLET CHANGE</small><div style={{ marginTop: 9, fontSize: 55, fontFamily: mono, fontWeight: 900, color: c.lime }}>+{gain.toFixed(6)} USDC</div></div><div style={{ marginTop: 16, display: "flex", gap: 10 }}><span style={darkPill}>✓ Router retained 0</span><span style={darkPill}>✓ Invoice marked paid</span></div><div style={{ marginTop: 10 }}><span style={darkPill}>✓ Replay attempt reverts</span></div></div>
          <div style={{ position: "absolute", right: 110, top: 145, width: 960, height: 780, padding: "35px 40px", borderRadius: 32, background: c.white, color: c.ink, boxShadow: `22px 25px 0 ${c.purple}`, transform: `translateY(${interpolate(receiptIn, [0, 1], [65, 0])}px) scale(${interpolate(receiptIn, [0, 1], [.95, 1])})`, opacity: receiptIn }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><small style={{ color: c.muted, fontWeight: 900, letterSpacing: 1.5 }}>MONAD TESTNET</small><div style={{ marginTop: 7, fontSize: 35, fontWeight: 920 }}>Atomic payment receipt</div></div><div style={{ width: 70, height: 70, borderRadius: 20, background: c.lime, display: "grid", placeItems: "center", fontSize: 39, fontWeight: 950 }}>✓</div></div><div style={{ marginTop: 26, borderTop: "1px solid #d8d2c8" }}>{rows.map(([label, value], index) => { const rowIn = spring({ frame: frame - 45 - index * 10, fps: 30, config: { damping: 18, stiffness: 105 } }); return <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "18px 0", borderBottom: "1px solid #d8d2c8", opacity: rowIn, transform: `translateX(${interpolate(rowIn, [0, 1], [45, 0])}px)` }}><span style={{ color: c.muted, fontWeight: 850, letterSpacing: 1.2 }}>{label}</span><strong style={{ fontFamily: mono }}>{value}</strong></div>; })}</div><div style={{ marginTop: 22, fontFamily: mono, fontSize: 14, color: c.purple, wordBreak: "break-all" }}>0xc6af11ffcf78c61575832936db84bdfb1c05fe456f2a4e93b6463286e286a4a2</div></div>
        </>
      );
    }}
  </Scene>
);

const darkPill: CSSProperties = { display: "inline-flex", padding: "10px 13px", borderRadius: 999, border: `1px solid ${c.lime}`, color: c.lime, fontSize: 13, fontWeight: 850 };

const OutroScene = () => (
  <Scene duration={420} chapter="07 / BLINKPAY" subtitle="One signed invoice. Any supported position. The safest exact route—without giving AI custody or signing power." light>
    {(frame) => {
      const logo = spring({ frame, fps: 30, config: { damping: 15, stiffness: 85 } });
      return (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", paddingBottom: 70 }}><div style={{ transform: `scale(${interpolate(logo, [0, 1], [.82, 1])})`, opacity: logo }}><div style={{ display: "inline-flex", padding: "10px 16px", borderRadius: 999, background: c.lime, fontWeight: 900, letterSpacing: 1.7 }}>LIVE ON MONAD TESTNET</div><div style={{ marginTop: 27, fontSize: 110, lineHeight: .9, letterSpacing: -7, fontWeight: 950 }}>Ask for USDC.<br /><span style={{ color: c.purple }}>Pay from what you own.</span></div><div style={{ marginTop: 35, display: "flex", justifyContent: "center", gap: 14 }}>{["5 executable routes", "AI with boundaries", "Exact atomic settlement", "0 custody"].map((item, index) => { const itemIn = spring({ frame: frame - 25 - index * 8, fps: 30, config: { damping: 16, stiffness: 115 } }); return <div key={item} style={{ padding: "15px 19px", borderRadius: 16, background: c.white, border: "1px solid #d4cec4", fontWeight: 850, opacity: itemIn, transform: `translateY(${interpolate(itemIn, [0, 1], [30, 0])}px)` }}>{item}</div>; })}</div><div style={{ marginTop: 38, display: "flex", justifyContent: "center", gap: 14 }}><div style={{ padding: "18px 26px", borderRadius: 15, background: c.ink, color: c.white, fontSize: 22, fontWeight: 900 }}>blink-pay-web.vercel.app</div><div style={{ padding: "16px 24px", borderRadius: 15, border: `2px solid ${c.ink}`, fontSize: 20, fontWeight: 850 }}>github.com/RudraBhaskar9439/BlinkPay</div></div></div></div>
      );
    }}
  </Scene>
);

export const BlinkPayStory = ({ narrationFile }: { narrationFile?: string }) => (
  <AbsoluteFill style={{ background: c.ink }}>
    <Audio src={staticFile("blinkpay-bed.mp3")} volume={0.15} />
    {narrationFile ? <Audio src={staticFile(narrationFile)} volume={1} /> : null}
    {[270, 1050, 1500, 2400, 3450, 4200, 4830].map((from) => <Sequence key={from} from={from} durationInFrames={24}><Audio src={staticFile("blinkpay-whoosh.mp3")} volume={0.24} /></Sequence>)}
    {[2490, 2508, 2526, 2544, 2562, 3590, 3690].map((from) => <Sequence key={from} from={from} durationInFrames={8}><Audio src={staticFile("blinkpay-tick.mp3")} volume={0.15} /></Sequence>)}
    <Sequence from={0} durationInFrames={270}><HookScene /></Sequence>
    <Sequence from={270} durationInFrames={780}><MerchantScene /></Sequence>
    <Sequence from={1050} durationInFrames={450}><ScanScene /></Sequence>
    <Sequence from={1500} durationInFrames={900}><PayerScene /></Sequence>
    <Sequence from={2400} durationInFrames={1050}><PlannerScene /></Sequence>
    <Sequence from={3450} durationInFrames={750}><PaymentScene /></Sequence>
    <Sequence from={4200} durationInFrames={630}><ProofScene /></Sequence>
    <Sequence from={4830} durationInFrames={420}><OutroScene /></Sequence>
  </AbsoluteFill>
);
