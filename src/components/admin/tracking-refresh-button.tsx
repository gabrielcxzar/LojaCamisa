"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  orderId: string;
};

export function TrackingRefreshButton({ orderId }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/tracking/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Erro ao atualizar rastreamento.");
      }

      const data = await response.json();
      setMessage(data.ok ? "Status atualizado." : "Sem nova atualizacao no rastreio.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Erro ao atualizar rastreamento.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={handleClick} disabled={loading}>
        {loading ? "Atualizando..." : "Atualizar rastreamento"}
      </Button>
      {message && <p className="text-xs text-neutral-500">{message}</p>}
    </div>
  );
}
