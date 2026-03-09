import { redirect } from "next/navigation";

import { upsertSupplier } from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";

export async function createSupplier(formData: FormData) {
  "use server";

  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const active = formData.get("active") ? 1 : 0;

  if (!name || !country) {
    throw new Error("Dados incompletos para fornecedor.");
  }

  const id = await upsertSupplier({ name, country, active });
  redirect(`/admin/fornecedores/${id}`);
}
