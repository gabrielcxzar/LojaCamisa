import { redirect } from "next/navigation";

import { upsertProduct } from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function createProduct(formData: FormData) {
  "use server";

  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const team = String(formData.get("team") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const basePrice = Number(formData.get("basePrice") ?? 0);
  const active = formData.get("active") ? 1 : 0;

  if (!name || !team || !model || basePrice <= 0) {
    throw new Error("Dados incompletos para criar produto.");
  }

  const slug = slugify(`${team}-${model}-${name}`);
  const productId = await upsertProduct({
    name,
    team,
    model,
    slug,
    description: description || "Produto premium sob encomenda.",
    basePrice,
    active,
  });

  redirect(`/admin/produtos/${productId}`);
}
