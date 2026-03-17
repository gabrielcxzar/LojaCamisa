import Link from "next/link";
import Image from "next/image";

import { Container } from "@/components/layout/container";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <header className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc)] border-b border-transparent shadow-sm">
        <Container className="flex flex-wrap items-center gap-4 py-4">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white/90 px-4 py-2 text-sm font-semibold tracking-[0.16em] shadow-sm transition hover:border-neutral-300"
          >
            <Image
              src="/gg-favicon.svg"
              alt="GG Camisas"
              width={28}
              height={28}
              className="h-7 w-7 rounded-md"
            />
            <span>GG CAMISAS</span>
          </Link>
          <nav
            aria-label="Admin navigation"
            className="flex flex-wrap flex-1 items-center justify-end gap-3 overflow-x-auto px-2 text-sm font-semibold text-neutral-500 transition [scrollbar-width:none] sm:px-4"
          >
            <Link
              href="/admin"
              className="rounded-2xl px-3 py-1 transition hover:text-black hover:bg-white/50"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/pedidos"
              className="rounded-2xl px-3 py-1 transition hover:text-black hover:bg-white/50"
            >
              Pedidos
            </Link>
            <Link
              href="/admin/produtos"
              className="rounded-2xl px-3 py-1 transition hover:text-black hover:bg-white/50"
            >
              Produtos
            </Link>
            <Link
              href="/admin/fornecedores"
              className="rounded-2xl px-3 py-1 transition hover:text-black hover:bg-white/50"
            >
              Fornecedores
            </Link>
            <Link
              href="/admin/financeiro"
              className="rounded-2xl px-3 py-1 transition hover:text-black hover:bg-white/50"
            >
              Financeiro
            </Link>
            <Link
              href="/admin/orcamento"
              className="rounded-2xl px-3 py-1 transition hover:text-black hover:bg-white/50"
            >
              Orçamento
            </Link>
            <Link
              href="/admin/configuracoes"
              className="rounded-2xl px-3 py-1 transition hover:text-black hover:bg-white/50"
            >
              Configurações
            </Link>
            <Link
              href="/admin/pedidos/novo"
              className="rounded-2xl border border-black bg-black px-3 py-1 text-white transition hover:border-neutral-900 hover:bg-neutral-900"
            >
              Novo pedido
            </Link>
          </nav>
        </Container>
      </header>
      <main className="py-10">{children}</main>
    </div>
  );
}
