import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";
import { useState } from "react";

import { signOutFn } from "@/modules/identity/auth.functions";

export const Route = createFileRoute("/access-denied")({
  component: AccessDenied,
  headers: () => ({ "Cache-Control": "private, no-store" }),
});

function AccessDenied() {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const [error, setError] = useState("");
  async function logout() {
    setPending(true);
    setError("");
    try {
      const result = await signOutFn();
      await router.invalidate();
      if (!result.remoteRevoked) {
        setError("Sessão local encerrada. A revogação remota não foi confirmada.");
      } else {
        window.location.assign("/login");
      }
    } catch {
      setError("Não foi possível encerrar a sessão com segurança.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
        <ShieldX aria-hidden="true" className="mx-auto size-10 text-forest" />
        <h1 className="mt-5 font-serif text-3xl text-forest">Acesso administrativo indisponível</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Sua identidade não recebeu autorização administrativa verificável. O acesso permanece
          negado até a ativação de uma verificação confiável no backend.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-7 flex justify-center gap-4">
          <button
            type="button"
            disabled={pending}
            onClick={logout}
            className="rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Encerrar sessão
          </button>
          <Link to="/" className="rounded-lg border border-input px-5 py-3 text-sm">
            Voltar ao início
          </Link>
        </div>
      </section>
    </main>
  );
}
