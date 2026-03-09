import { redirect } from "next/navigation";

import { upsertSupplier } from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";

export async function updateSupplier(formData: FormData) {
  "use server";

  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const active = formData.get("active") ? 1 : 0;

  if (!id || !name || !country) {
    throw new Error("Dados incompletos para fornecedor.");
  }

  await upsertSupplier({ supplierId: id, name, country, active });
  redirect(`/admin/fornecedores/${id}`);
}
