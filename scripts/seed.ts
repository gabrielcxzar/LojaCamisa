import "dotenv/config";

import bcrypt from "bcryptjs";

import { initSchema } from "../src/lib/db";
import {
  ensureAdminUser,
  ensureSupplier,
  upsertProduct,
} from "../src/lib/db/queries";

async function main() {
  await initSchema();

  const adminName = process.env.ADMIN_NAME ?? "Admin";
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@lojacamisa.com")
    .toLowerCase()
    .trim();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  if (process.env.NODE_ENV === "production") {
    if (!adminPassword) {
      throw new Error("ADMIN_PASSWORD obrigatoria em producao.");
    }
    if (adminPassword.length < 12) {
      throw new Error("ADMIN_PASSWORD deve ter no minimo 12 caracteres em producao.");
    }
    if (adminPassword.toLowerCase() === "admin123") {
      throw new Error("ADMIN_PASSWORD insegura em producao.");
    }
  }

  const effectivePassword = adminPassword || "admin123";

  const passwordHash = await bcrypt.hash(effectivePassword, 10);
  await ensureAdminUser({ name: adminName, email: adminEmail, passwordHash });

  await ensureSupplier({ name: "Fornecedor Tailandia", country: "Tailandia" });

  const productsData = [
    {
      name: "Camisa Time Classica",
      team: "Corinthians",
      model: "Edicao 2024",
      slug: "corinthians-edicao-2024",
      description:
        "Modelo classico com tecido premium e acabamento minimalista.",
      basePrice: 299.9,
    },
    {
      name: "Camisa Time Pro",
      team: "Real Madrid",
      model: "Edicao 2025",
      slug: "real-madrid-edicao-2025",
      description:
        "Versao performance com corte atletico e respirabilidade.",
      basePrice: 349.9,
    },
    {
      name: "Camisa Time Elite",
      team: "Brasil",
      model: "Edicao 2026",
      slug: "brasil-edicao-2026",
      description:
        "Linha premium inspirada em uniformes de selecao.",
      basePrice: 389.9,
    },
  ];

  for (const product of productsData) {
    await upsertProduct(product);
  }

  console.log("Seed concluido.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
