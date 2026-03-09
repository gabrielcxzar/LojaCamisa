export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSupplierById } from "@/lib/db/queries";
import { updateSupplier } from "@/app/admin/fornecedores/[id]/actions";
import { requireAdmin } from "@/lib/require-admin";

export default async function SupplierDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const supplier = await getSupplierById(params.id);
  if (!supplier) return notFound();

  return (
    <Container className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
          Fornecedor
        </p>
        <h1 className="text-2xl font-semibold">Editar fornecedor</h1>
      </div>

      <form
        action={updateSupplier}
        className="grid gap-6 rounded-3xl border border-neutral-200 bg-white p-8"
      >
        <input type="hidden" name="id" value={supplier.id} />
        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="name"
            required
            defaultValue={supplier.name}
            placeholder="Nome do fornecedor"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="country"
            required
            defaultValue={supplier.country}
            placeholder="Pais"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input name="active" type="checkbox" defaultChecked={supplier.active === 1} />
          Fornecedor ativo
        </label>
        <SubmitButton pendingLabel="Salvando alteracoes..." className="w-full">
          Salvar alteracoes
        </SubmitButton>
      </form>
    </Container>
  );
}
