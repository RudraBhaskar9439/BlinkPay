import { MerchantInvoiceForm } from "@/components/merchant-invoice-form";
import { AppHeader } from "@/components/app-header";

export const metadata = {
  title: "Create an invoice",
};

export default function MerchantPage() {
  return (
    <main>
      <AppHeader context="Merchant" />
      <MerchantInvoiceForm />
    </main>
  );
}
