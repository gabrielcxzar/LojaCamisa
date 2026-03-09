import { redirect } from "next/navigation";

import { setSetting } from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";

export async function saveSettings(formData: FormData) {
  "use server";

  await requireAdmin();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const stalledDays = String(formData.get("stalledDays") ?? "").trim();
  const paymentFeePercent = String(formData.get("paymentFeePercent") ?? "").trim();
  const paymentFeeFixed = String(formData.get("paymentFeeFixed") ?? "").trim();

  if (businessName) {
    await setSetting("business_name", businessName);
  }
  if (stalledDays) {
    await setSetting("stalled_days", stalledDays);
  }
  if (paymentFeePercent) {
    await setSetting("payment_fee_percent", paymentFeePercent);
  }
  if (paymentFeeFixed) {
    await setSetting("payment_fee_fixed", paymentFeeFixed);
  }

  redirect("/admin/configuracoes");
}
