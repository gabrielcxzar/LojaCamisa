import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  logAction,
  updateImportPackageTrackingByCode,
  updateOrderStatus,
  updateShipmentStatus,
} from "@/lib/db/queries";
import { consumeRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { getShipmentTrackingUpdate } from "@/lib/tracking";
import {
  mapTrackingStatusToOrderStatus,
  shouldAdvanceOrderStatus,
} from "@/lib/tracking/status-map";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toPositiveInt(input: string | undefined, fallback: number) {
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
    }

    const ip = getClientIp(request);
    const rateWindowMs = toPositiveInt(
      process.env.TRACKING_REFRESH_RATE_WINDOW_MS,
      60_000,
    );
    const rateMax = toPositiveInt(process.env.TRACKING_REFRESH_RATE_MAX, 20);
    const rate = await consumeRateLimit({
      key: `tracking-refresh:${session.user.email}:${ip}`,
      windowMs: rateWindowMs,
      max: rateMax,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Limite de requisicoes excedido." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)),
            ),
          },
        },
      );
    }

    const { orderId } = (await request.json()) as { orderId?: string };
    if (!orderId) {
      return NextResponse.json({ error: "orderId obrigatorio" }, { status: 400 });
    }
    if (!UUID_V4_REGEX.test(orderId)) {
      return NextResponse.json({ error: "orderId invalido" }, { status: 400 });
    }

    const order = (await db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId)) as
      | { id: string; status: string }
      | undefined;
    const shipment = (await db
      .prepare("SELECT * FROM shipments WHERE order_id = ?")
      .get(orderId)) as
      | { tracking_code: string; carrier: string }
      | undefined;

    if (!order || !shipment) {
      return NextResponse.json(
        { error: "Rastreamento nao encontrado" },
        { status: 404 },
      );
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
    await updateImportPackageTrackingByCode(shipment.tracking_code, {
      lastStatus: update.status,
      lastUpdateAt: update.lastUpdateAt?.toISOString() ?? null,
      etaDate: update.etaDate?.toISOString() ?? null,
    });

    const nextOrderStatus = mapTrackingStatusToOrderStatus(update.status);
    if (nextOrderStatus && shouldAdvanceOrderStatus(order.status, nextOrderStatus)) {
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
