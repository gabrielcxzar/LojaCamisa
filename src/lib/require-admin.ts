import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/admin/login");
  }

  if (session.user.role !== "ADMIN") {
    throw new Error("Acesso restrito ao administrador principal.");
  }

  return session;
}
