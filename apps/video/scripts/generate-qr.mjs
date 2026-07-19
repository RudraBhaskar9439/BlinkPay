import QRCode from "qrcode";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "../public/ui/blinkpay-payment-qr.png");

await QRCode.toFile(output, "https://blink-pay-web.vercel.app/pay", {
  width: 900,
  margin: 2,
  color: {
    dark: "#11110fff",
    light: "#fffdf8ff",
  },
});

console.log(`Generated ${output}`);
