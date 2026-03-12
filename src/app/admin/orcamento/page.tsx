import { BudgetCalculator } from "@/components/admin/budget-calculator";
import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/lib/require-admin";

export default async function BudgetPage() {
  await requireAdmin();

  return (
    <Container className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Orcamento</p>
        <h1 className="text-2xl font-semibold">Calculadora de preco por margem</h1>
      </div>
      <BudgetCalculator />
    </Container>
  );
}
