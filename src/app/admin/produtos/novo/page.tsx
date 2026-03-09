export const dynamic = "force-dynamic";

import { Container } from "@/components/layout/container";
import { SubmitButton } from "@/components/ui/submit-button";
import { createProduct } from "@/app/admin/produtos/novo/actions";
import { requireAdmin } from "@/lib/require-admin";

export default async function NewProductPage() {
  await requireAdmin();
  return (
    <Container className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
          Novo produto
        </p>
        <h1 className="text-2xl font-semibold">Cadastrar produto</h1>
      </div>

      <form
        action={createProduct}
        className="grid gap-6 rounded-3xl border border-neutral-200 bg-white p-8"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="name"
            required
            placeholder="Nome do produto"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="team"
            required
            placeholder="Time"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="model"
            required
            placeholder="Modelo"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="basePrice"
            required
            type="number"
            step="0.01"
            placeholder="Preco base"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
        </div>
        <textarea
          name="description"
          placeholder="Descricao"
          className="min-h-[120px] w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input name="active" type="checkbox" defaultChecked />
          Produto ativo no catalogo interno
        </label>
        <SubmitButton pendingLabel="Salvando produto..." className="w-full">
          Salvar produto
        </SubmitButton>
      </form>
    </Container>
  );
}
