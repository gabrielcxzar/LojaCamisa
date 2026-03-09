export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { listAllProducts } from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";

export default async function ProductsPage() {
  await requireAdmin();
  const products = await listAllProducts();

  return (
    <Container className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
            Produtos
          </p>
          <h1 className="text-2xl font-semibold">Catálogo interno</h1>
        </div>
        <Link
          href="/admin/produtos/novo"
          className="inline-flex items-center rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
        >
          Novo produto
        </Link>
      </div>

      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        {products.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nenhum produto cadastrado.
          </p>
        )}
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/admin/produtos/${product.id}`}
            className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 text-sm hover:border-neutral-400"
          >
            <div>
              <p className="font-semibold">
                {product.name} • {product.team}
              </p>
              <p className="text-neutral-500">
                R$ {Number(product.base_price).toFixed(2)} • {product.model}
              </p>
            </div>
            <Badge tone={product.active ? "success" : "muted"}>
              {product.active ? "Ativo" : "Inativo"}
            </Badge>
          </Link>
        ))}
      </div>
    </Container>
  );
}
