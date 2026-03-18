import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  listAvailableInternalStockOrders,
  listCustomerPresets,
  listImportPackages,
} from "@/lib/db/queries";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");

  if (kind === "customer-presets") {
    const presets = await listCustomerPresets();
    return NextResponse.json({ presets });
  }

  if (kind === "packages") {
    const packages = await listImportPackages();
    return NextResponse.json({
      packages: packages.map((importPackage) => ({
        id: importPackage.id,
        code: importPackage.code,
        trackingCode: importPackage.tracking_code,
        linkedOrders: Number(importPackage.linked_orders ?? 0),
      })),
    });
  }

  if (kind === "internal-stock") {
    const internalStockOrders = await listAvailableInternalStockOrders();
    return NextResponse.json({
      internalStockOrders: internalStockOrders.map((stockOrder) => ({
        id: stockOrder.source_order_id,
        code: stockOrder.source_order_code,
        customerName: stockOrder.source_customer_name,
        supplierName: stockOrder.supplier_name,
        availableQuantity: Number(stockOrder.available_quantity ?? 0),
        unitCost: Number(stockOrder.unit_cost ?? 0),
        packageCode: stockOrder.package_code,
      })),
    });
  }

  return NextResponse.json({ error: "kind invalido" }, { status: 400 });
}
