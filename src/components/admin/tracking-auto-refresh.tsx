"use client";

import { useEffect } from "react";

type Props = {
  orderId: string;
  lastUpdateAt?: string | null;
};

const HOURS = 12;

export function TrackingAutoRefresh({ orderId, lastUpdateAt }: Props) {
  useEffect(() => {
    if (!lastUpdateAt) return;
    const last = new Date(lastUpdateAt).getTime();
    const hoursDiff = (Date.now() - last) / (1000 * 60 * 60);
    if (hoursDiff < HOURS) return;

    fetch("/api/tracking/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    }).catch(() => undefined);
  }, [orderId, lastUpdateAt]);

  return null;
}
