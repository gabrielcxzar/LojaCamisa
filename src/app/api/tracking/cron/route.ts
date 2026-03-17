import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { timingSafeEqual } from "node:crypto";

import { authOptions } from "@/lib/auth";
import {
  listTrackableShipments,
  logAction,
  updateOrderStatus,
  updateImportPackageTrackingByCode,
  updateShipmentStatus,
} from "@/lib/db/queries";
import { getShipmentTrackingUpdate } from "@/lib/tracking";
import {
  mapTrackingStatusToOrderStatus,
  shouldAdvanceOrderStatus,
} from "@/lib/tracking/status-map";
import { consumeRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { toPositiveInt } from "@/lib/tracking/helpers";

async function resolveActorEmail(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "ADMIN" && session.user.email) {
    return session.user.email;
  }

  const configuredSecret =
    process.env.CRON_SECRET ?? process.env.TRACKING_CRON_SECRET ?? "";
  if (!configuredSecret) return null;

  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  const isSameLength = bearerToken.length === configuredSecret.length;
  const tokenMatch =
    isSameLength &&
    timingSafeEqual(
      Buffer.from(bearerToken, "utf8"),
      Buffer.from(configuredSecret, "utf8"),
    );

  if (tokenMatch) {
    return "cron@system";
  }

  return null;
}

async function run(request: Request) {
  const actorEmail = await resolveActorEmail(request);
  if (!actorEmail) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
  }
  const ip = getClientIp(request);
  const rateWindowMs = toPositiveInt(process.env.TRACKING_CRON_RATE_WINDOW_MS, 60_000);
  const rateMax = toPositiveInt(process.env.TRACKING_CRON_RATE_MAX, 5);
  const rate = await consumeRateLimit({
    key: `tracking-cron:${actorEmail}:${ip}`,
    windowMs: rateWindowMs,
    max: rateMax,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Limite de requisicoes excedido." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  const refreshIntervalHours = toPositiveInt(
    process.env.TRACKING_AUTO_REFRESH_HOURS,
    6,
  );
  const batchLimit = toPositiveInt(process.env.TRACKING_AUTO_REFRESH_BATCH, 20);

  if ((process.env.TRACKING_PROVIDER ?? "17track") === "17track" && !process.env.TRACKING_17TRACK_KEY) {
    return NextResponse.json(
      { error: "TRACKING_17TRACK_KEY nao configurado." },
      { status: 500 },
    );
  }

  const shipments = await listTrackableShipments({
    refreshIntervalHours,
    limit: batchLimit,
  });

  let updated = 0;
  let delivered = 0;
  let failed = 0;
  const errors: Array<{ orderId: string; error: string }> = [];

  for (const shipment of shipments) {
    try {
      const update = await getShipmentTrackingUpdate(
        shipment.tracking_code,
        shipment.carrier,
      );
      if (!update) continue;

      await updateShipmentStatus(shipment.order_id, {
        lastStatus: update.status,
        lastUpdateAt: update.lastUpdateAt?.toISOString() ?? null,
        etaDate: update.etaDate?.toISOString() ?? null,
      });
      await updateImportPackageTrackingByCode(shipment.tracking_code, {
        lastStatus: update.status,
        lastUpdateAt: update.lastUpdateAt?.toISOString() ?? null,
        etaDate: update.etaDate?.toISOString() ?? null,
      });
      updated += 1;

      const nextOrderStatus = mapTrackingStatusToOrderStatus(update.status);
      if (
        nextOrderStatus &&
        shouldAdvanceOrderStatus(shipment.order_status, nextOrderStatus)
      ) {
        await updateOrderStatus(
          shipment.order_id,
          nextOrderStatus,
          `Status atualizado automaticamente via rastreio: ${update.status}`,
        );
        if (nextOrderStatus === "DELIVERED") delivered += 1;
      }

      await logAction({
        userEmail: actorEmail,
        action: "Atualizacao automatica de rastreamento",
        orderId: shipment.order_id,
      });
    } catch (error) {
      failed += 1;
      errors.push({
        orderId: shipment.order_id,
        error: error instanceof Error ? error.message : "Erro inesperado",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    actor: actorEmail,
    scanned: shipments.length,
    updated,
    delivered,
    failed,
    refreshIntervalHours,
    batchLimit,
    errors,
  });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
