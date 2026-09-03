"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: Props) {
  useEffect(() => {
    console.error("Erro na area administrativa:", error);
  }, [error]);

  const message =
    error?.message && error.message !== "An unexpected error occurred."
      ? error.message
      : "Ocorreu um erro inesperado ao carregar ou salvar os dados.";

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
      <h2 className="text-lg font-semibold">Falha ao carregar o painel</h2>
      <p className="mt-2 text-sm">
        {message}
      </p>
      <p className="mt-2 text-xs text-red-600/80">
        Se a tela ficar presa, tente recarregar a pagina para refazer a consulta.
      </p>
      <div className="mt-4 flex gap-3">
        <Button type="button" variant="outline" onClick={reset}>
          Tentar novamente
        </Button>
        <Button type="button" onClick={() => window.location.reload()}>
          Recarregar pagina
        </Button>
      </div>
    </div>
  );
}
