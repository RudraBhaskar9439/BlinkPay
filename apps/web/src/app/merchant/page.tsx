import { MerchantInvoiceForm } from "@/components/merchant-invoice-form";
import Link from "next/link";

export const metadata = {
  title: "Create an invoice — BlinkPay",
};

export default function MerchantPage() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label="BlinkPay home">
          <span className="brandMark" aria-hidden="true">B</span>
          <span>BlinkPay</span>
        </Link>
        <span className="buildTag">Merchant invoice</span>
      </nav>
      <MerchantInvoiceForm />
    </main>
  );
}
