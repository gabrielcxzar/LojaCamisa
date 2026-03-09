import { Container } from "@/components/layout/container";
import { NewOrderDetails } from "@/components/admin/new-order-details";
import { createOrderManual } from "@/app/admin/pedidos/novo/actions";
import { listProducts, listSuppliers } from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";

export default async function NewOrderPage() {
  await requireAdmin();
  const [products, suppliers] = await Promise.all([listProducts(), listSuppliers()]);
  const sortedProducts = products.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Container className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
          Novo pedido
        </p>
        <h1 className="text-2xl font-semibold">Criar pedido manual</h1>
      </div>
      <form
        action={createOrderManual}
        className="grid gap-10 rounded-3xl border border-neutral-200 bg-white p-8 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold">Cliente</h2>
            <div className="mt-4 grid gap-4">
              <input
                name="name"
                required
                placeholder="Nome completo"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
              />
              <input
                name="email"
                type="email"
                required
                placeholder="Email"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
              />
              <input
                name="phone"
                placeholder="Telefone / WhatsApp"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
              />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Destino</h2>
            <div className="mt-4 grid gap-4">
              <input
                name="line1"
                required
                placeholder="Rua e numero"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
              />
              <input
                name="line2"
                placeholder="Complemento"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
              />
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  name="city"
                  required
                  placeholder="Cidade"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                />
                <input
                  name="state"
                  required
                  placeholder="Estado"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  name="postalCode"
                  placeholder="CEP"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                />
                <input
                  name="country"
                  defaultValue="Brasil"
                  placeholder="Pais"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                />
              </div>
            </div>
          </section>
        </div>

        <NewOrderDetails
          products={sortedProducts.map((product) => ({
            id: product.id,
            slug: product.slug,
            name: product.name,
            basePrice: Number(product.base_price),
          }))}
          suppliers={suppliers.map((supplier) => ({
            id: supplier.id,
            name: supplier.name,
          }))}
        />
      </form>
    </Container>
  );
}
