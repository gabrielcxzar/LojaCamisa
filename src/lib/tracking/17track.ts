import { TrackingUpdate } from "@/lib/tracking/types";

const API_BASE = "https://api.17track.net/track/v2";

type RegisterRequest = {
  number: string;
  carrier?: number;
};

type TrackInfoRequest = {
  number: string;
  carrier?: number;
};

type TrackInfoResponse = {
  data?: {
    accepted?: Array<{
      track_info?: {
        latest_status?: { status?: string };
        latest_event?: { time_utc?: string };
        time_metrics?: { estimated_delivery_date?: { to?: string } };
      };
    }>;
  };
};

function getToken() {
  const token = process.env.TRACKING_17TRACK_KEY ?? "";
  if (!token) {
    throw new Error("TRACKING_17TRACK_KEY não configurado.");
  }
  return token;
}

function normalizeCarrier(carrier?: string) {
  if (!carrier) return undefined;
  const parsed = Number(carrier);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function registerTracking(number: string, carrier?: string) {
  const payload: RegisterRequest[] = [
    {
      number,
      carrier: normalizeCarrier(carrier),
    },
  ];

  const response = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: {
      "17token": getToken(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao registrar tracking: ${text}`);
  }
}

export async function fetchTrackingUpdate(
  number: string,
  carrier?: string,
): Promise<TrackingUpdate | null> {
  const payload: TrackInfoRequest[] = [
    {
      number,
      carrier: normalizeCarrier(carrier),
    },
  ];

  const response = await fetch(`${API_BASE}/gettrackinfo`, {
    method: "POST",
    headers: {
      "17token": getToken(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao consultar tracking: ${text}`);
  }

  const json = (await response.json()) as TrackInfoResponse;
  const info = json.data?.accepted?.[0]?.track_info;
  if (!info) return null;

  const status = info.latest_status?.status ?? "Em trânsito";
  const lastUpdateAt = info.latest_event?.time_utc
    ? new Date(info.latest_event.time_utc)
    : undefined;
  const etaDate = info.time_metrics?.estimated_delivery_date?.to
    ? new Date(info.time_metrics.estimated_delivery_date.to)
    : undefined;

  return { status, lastUpdateAt, etaDate };
}
