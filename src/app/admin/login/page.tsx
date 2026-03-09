"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
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
        return;
      }

      if (result.error) {
        if (result.error === "CredentialsSignin") {
          setError("Email ou senha invalidos.");
        } else {
          setError(`Falha ao entrar (${result.error}).`);
        }
        return;
      }

      if (result.url) {
        window.location.assign(result.url);
        return;
      }

      window.location.assign("/admin");
    } catch {
      setError("Erro ao entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
        <form
          action={handleSubmit}
          className="w-full space-y-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm"
        >
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
              Admin
            </p>
            <h1 className="text-2xl font-semibold">Acesso ao painel</h1>
            <p className="text-sm text-neutral-500">
              Entre com suas credenciais seguras.
            </p>
          </div>
          <div className="space-y-4">
            <input
              name="email"
              type="email"
              required
              placeholder="Email"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="Senha"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
            />
          </div>
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
