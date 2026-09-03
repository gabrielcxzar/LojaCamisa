import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { listAllSuppliers } from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";

export default async function FornecedoresPage() {
  await requireAdmin();
  const suppliers = await listAllSuppliers();

  return (
    <Container className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
            Fornecedores
          </p>
          <h1 className="text-2xl font-semibold">Gerenciar fornecedores</h1>
        </div>
        <Link
          href="/admin/fornecedores/novo"
          className="inline-flex items-center rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
        >
          Novo fornecedor
        </Link>
      </div>

      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        {suppliers.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nenhum fornecedor cadastrado.
          </p>
        )}
        {suppliers.map((supplier) => (
          <Link
            key={supplier.id}
            href={`/admin/fornecedores/${supplier.id}`}
            className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 text-sm hover:border-neutral-400"
          >
            <div>
              <p className="font-semibold">{supplier.name}</p>
              <p className="text-neutral-500">{supplier.country}</p>
            </div>
            <Badge tone={supplier.active ? "success" : "muted"}>
              {supplier.active ? "Ativo" : "Inativo"}
            </Badge>
          </Link>
        ))}
      </div>
    </Container>
  );
}
