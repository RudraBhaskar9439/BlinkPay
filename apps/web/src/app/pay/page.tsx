import { PayInvoice } from "@/components/pay-invoice";
import Link from "next/link";

export const metadata = {
  title: "Pay an invoice — BlinkPay",
};

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { invoice } = await searchParams;

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label="BlinkPay home">
          <span className="brandMark" aria-hidden="true">B</span>
          <span>BlinkPay</span>
        </Link>
        <span className="buildTag">Payer review</span>
      </nav>
      <PayInvoice payload={invoice} />
    </main>
  );
}
