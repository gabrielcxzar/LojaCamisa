import { Container } from "@/components/layout/container";
import { NewOrderCustomerFields } from "@/components/admin/new-order-customer-fields";
import { NewOrderDetails } from "@/components/admin/new-order-details";
import { createOrderManual } from "@/app/admin/pedidos/novo/actions";
import {
  listProducts,
  listSuppliers,
} from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";

export default async function NewOrderPage() {
  await requireAdmin();
  const [products, suppliers] = await Promise.all([
    listProducts(),
    listSuppliers(),
  ]);
  const sortedProducts = products.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-gradient-to-br from-neutral-50 via-white to-neutral-100 py-6 lg:py-8">
      <Container className="space-y-5 lg:space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
            Novo pedido
          </p>
          <h1 className="text-2xl font-semibold">Criar pedido manual</h1>
        </div>
        <form
          action={createOrderManual}
          className="space-y-5 rounded-[28px] border border-neutral-200 bg-gradient-to-br from-white/90 to-white/70 p-4 shadow-xl backdrop-blur lg:space-y-6 lg:p-6"
        >
          <div className="rounded-[26px] border border-neutral-200 bg-white/90 p-4 shadow-sm">
            <NewOrderCustomerFields />
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
    </div>
  );
}
