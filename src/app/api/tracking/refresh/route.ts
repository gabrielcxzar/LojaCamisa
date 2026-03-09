import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";

import { db } from "@/lib/db";
import { logAction, updateOrderStatus, updateShipmentStatus } from "@/lib/db/queries";
import { authOptions } from "@/lib/auth";
import { getShipmentTrackingUpdate } from "@/lib/tracking";
import {
  mapTrackingStatusToOrderStatus,
  shouldAdvanceOrderStatus,
} from "@/lib/tracking/status-map";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
    }

    const { orderId } = (await request.json()) as { orderId?: string };
    if (!orderId) {
      return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 });
    }

    const order = await db
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(orderId) as { id: string; status: string } | undefined;
    const shipment = await db
      .prepare("SELECT * FROM shipments WHERE order_id = ?")
      .get(orderId) as { tracking_code: string; carrier: string } | undefined;

    if (!order || !shipment) {
      return NextResponse.json({ error: "Rastreamento não encontrado" }, { status: 404 });
    }

    const update = await getShipmentTrackingUpdate(
      shipment.tracking_code,
      shipment.carrier,
    );

    if (!update) {
      return NextResponse.json({ ok: false });
    }

    await updateShipmentStatus(orderId, {
      lastStatus: update.status,
      lastUpdateAt: update.lastUpdateAt?.toISOString() ?? null,
      etaDate: update.etaDate?.toISOString() ?? null,
    });

    const nextOrderStatus = mapTrackingStatusToOrderStatus(update.status);
    if (
      nextOrderStatus &&
      shouldAdvanceOrderStatus(order.status, nextOrderStatus)
    ) {
      await updateOrderStatus(
        orderId,
        nextOrderStatus,
        `Status atualizado automaticamente via rastreio: ${update.status}`,
      );
    }

    await logAction({
      userEmail: session.user.email,
      action: "Atualizou rastreamento",
      orderId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
