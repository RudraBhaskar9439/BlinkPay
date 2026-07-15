import { PayInvoice } from "@/components/pay-invoice";
import { AppHeader } from "@/components/app-header";
import { PaymentLinkOpener } from "@/components/payment-link-opener";

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
      <AppHeader context="Checkout" />
      {invoice ? <PayInvoice payload={invoice} /> : <PaymentLinkOpener />}
    </main>
  );
}
