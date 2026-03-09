import { Container } from "@/components/layout/container";
import { SubmitButton } from "@/components/ui/submit-button";
import { createSupplier } from "@/app/admin/fornecedores/novo/actions";
import { requireAdmin } from "@/lib/require-admin";

export default async function NewSupplierPage() {
  await requireAdmin();
  return (
    <Container className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
          Novo fornecedor
        </p>
        <h1 className="text-2xl font-semibold">Cadastrar fornecedor</h1>
      </div>

      <form
        action={createSupplier}
        className="grid gap-6 rounded-3xl border border-neutral-200 bg-white p-8"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="name"
            required
            placeholder="Nome do fornecedor"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="country"
            required
            placeholder="Pais"
            defaultValue="Tailandia"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input name="active" type="checkbox" defaultChecked />
          Fornecedor ativo
        </label>
        <SubmitButton pendingLabel="Salvando fornecedor..." className="w-full">
          Salvar fornecedor
        </SubmitButton>
      </form>
    </Container>
  );
}
