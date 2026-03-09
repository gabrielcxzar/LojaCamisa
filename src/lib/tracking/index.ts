import { fetchTrackingUpdate, registerTracking } from "@/lib/tracking/17track";
import { TrackingUpdate } from "@/lib/tracking/types";

export async function registerShipmentTracking(
  number: string,
  carrier?: string,
): Promise<void> {
  const provider = process.env.TRACKING_PROVIDER ?? "17track";
  if (provider === "17track") {
    await registerTracking(number, carrier);
    return;
  }

  throw new Error(`Provedor de rastreamento inválido: ${provider}`);
}

export async function getShipmentTrackingUpdate(
  number: string,
  carrier?: string,
): Promise<TrackingUpdate | null> {
  const provider = process.env.TRACKING_PROVIDER ?? "17track";
  if (provider === "17track") {
    return fetchTrackingUpdate(number, carrier);
  }

  throw new Error(`Provedor de rastreamento inválido: ${provider}`);
}
