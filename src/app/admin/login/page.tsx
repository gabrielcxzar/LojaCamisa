"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "authenticating" | "redirecting">("idle");
  const loading = phase !== "idle";

  async function handleSubmit(formData: FormData) {
    if (loading) return;

    setError(null);
    setPhase("authenticating");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/admin",
      });

      if (!result) {
        setError("Falha ao entrar. Tente novamente.");
        setPhase("idle");
        return;
      }

      if (result.error) {
        if (result.error === "CredentialsSignin") {
          setError("Email ou senha invalidos.");
        } else {
          setError(`Falha ao entrar (${result.error}).`);
        }
        setPhase("idle");
        return;
      }

      setPhase("redirecting");
      if (result.url) {
        window.location.assign(result.url);
        return;
      }

      window.location.assign("/admin");
    } catch {
      setError("Erro ao entrar. Tente novamente.");
      setPhase("idle");
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
        <form
          action={handleSubmit}
          className={`w-full space-y-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm transition ${
            loading ? "opacity-95" : "opacity-100"
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Image
                src="/gg-favicon.svg"
                alt="GG Camisas"
                width={32}
                height={32}
                className="h-8 w-8 rounded-md"
              />
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
                GG Camisas
              </p>
            </div>
            <h1 className="text-2xl font-semibold">Acesso ao painel</h1>
            <p className="text-sm text-neutral-500">
              Sistema interno de pedidos.
            </p>
          </div>
          <div className="space-y-4">
            <input
              name="email"
              type="email"
              required
              placeholder="Email"
              disabled={loading}
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="Senha"
              disabled={loading}
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
            />
          </div>
          {loading && (
            <p className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              {phase === "authenticating"
                ? "Validando credenciais..."
                : "Entrando no painel..."}
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === "authenticating" ? "Validando..." : "Entrando..."}
              </span>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
