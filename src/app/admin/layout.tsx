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
      <header className="border-b border-neutral-200 bg-white">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src="/gg-favicon.svg"
              alt="GG Camisas"
              width={28}
              height={28}
              className="h-7 w-7 rounded-md"
            />
            <span className="text-sm font-semibold tracking-[0.16em]">GG CAMISAS</span>
          </Link>
          <nav className="flex gap-6 text-sm text-neutral-500">
            <Link href="/admin" className="hover:text-black">
              Dashboard
            </Link>
            <Link href="/admin/pedidos" className="hover:text-black">
              Pedidos
            </Link>
            <Link href="/admin/produtos" className="hover:text-black">
              Produtos
            </Link>
            <Link href="/admin/fornecedores" className="hover:text-black">
              Fornecedores
            </Link>
            <Link href="/admin/financeiro" className="hover:text-black">
              Financeiro
            </Link>
            <Link href="/admin/configuracoes" className="hover:text-black">
              Configuracoes
            </Link>
            <Link href="/admin/pedidos/novo" className="hover:text-black">
              Novo pedido
            </Link>
          </nav>
        </Container>
      </header>
      <main className="py-10">{children}</main>
    </div>
  );
}
