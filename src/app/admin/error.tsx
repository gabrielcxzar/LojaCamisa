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

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
      <h2 className="text-lg font-semibold">Falha ao carregar o painel</h2>
      <p className="mt-2 text-sm">
        Ocorreu um erro inesperado na aplicacao. Atualize a pagina ou tente novamente.
      </p>
      <div className="mt-4">
        <Button type="button" variant="outline" onClick={reset}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
