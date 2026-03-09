export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { dbPath } from "@/lib/db";
import { getProductById } from "@/lib/db/queries";
import { updateProduct } from "@/app/admin/produtos/[id]/actions";
import { requireAdmin } from "@/lib/require-admin";

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  await requireAdmin();
  const resolvedParams = await Promise.resolve(params);
  const product = await getProductById(resolvedParams.id);
  if (!product) {
    return (
      <Container className="space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h1 className="text-xl font-semibold">Produto nao encontrado</h1>
          <p className="mt-2 text-sm text-neutral-600">
            ID: {resolvedParams.id ?? "(vazio)"}
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            DB: {dbPath}
          </p>
          <p className="mt-4 text-sm text-neutral-600">
            Volte para a lista de produtos e selecione novamente.
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
          Produto
        </p>
        <h1 className="text-2xl font-semibold">Editar produto</h1>
      </div>

      <form
        action={updateProduct}
        className="grid gap-6 rounded-3xl border border-neutral-200 bg-white p-8"
      >
        <input type="hidden" name="id" value={product.id} />
        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="name"
            required
            defaultValue={product.name}
            placeholder="Nome do produto"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="team"
            required
            defaultValue={product.team}
            placeholder="Time"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="model"
            required
            defaultValue={product.model}
            placeholder="Modelo"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="basePrice"
            required
            type="number"
            step="0.01"
            defaultValue={Number(product.base_price).toFixed(2)}
            placeholder="Preco base"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
        </div>
        <textarea
          name="description"
          defaultValue={product.description}
          placeholder="Descricao"
          className="min-h-[120px] w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input name="active" type="checkbox" defaultChecked={product.active === 1} />
          Produto ativo no catalogo interno
        </label>
        <Button type="submit" className="w-full">
          Salvar alteracoes
        </Button>
      </form>
    </Container>
  );
}
