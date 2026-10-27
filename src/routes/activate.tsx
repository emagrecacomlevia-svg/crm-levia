import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { recoveryFromFragment, type RecoveryCredential } from "@/modules/identity/recovery";
import { activatePasswordFn } from "@/modules/identity/auth.functions";

export const Route = createFileRoute("/activate")({
  component: ActivatePage,
  headers: () => ({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" }),
});
function ActivatePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [credential, setCredential] = useState<RecoveryCredential | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const parsed = recoveryFromFragment(window.location.hash);
    if (parsed) setCredential(parsed);
    window.history.replaceState(null, "", "/activate");
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !credential) return;
    const fields = new FormData(event.currentTarget);
    const submittedPassword = String(fields.get("password") ?? "");
    const submittedConfirmation = String(fields.get("confirmation") ?? "");
    if (submittedPassword !== submittedConfirmation) {
      setMessage("As senhas devem ser iguais.");
      return;
    }
    setPending(true);
    try {
      const result = await activatePasswordFn({
        data: { credential, password: submittedPassword },
      });
      setMessage(result.message);
      if (result.ok || ("passwordSaved" in result && result.passwordSaved)) {
        setDone(true);
        setPassword("");
        setConfirmation("");
        setCredential(null);
        if (result.ok) {
          await router.invalidate();
          await navigate({ to: "/app" });
        }
      }
    } catch {
      setMessage("Não foi possível definir a senha. Verifique o link e tente novamente.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-widest text-forest">LEVIA BIOSCIENCE</p>
        <h1 className="mt-6 font-serif text-3xl text-forest">Definir senha de acesso</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Use o link privado recebido e escolha uma senha exclusiva com pelo menos 12 caracteres.
        </p>
        {!done && (
          <form method="post" onSubmit={submit} className="mt-7 space-y-5">
            <label className="block text-sm">
              Nova senha
              <input
                aria-label="Nova senha"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-lg border border-input bg-background p-3"
              />
            </label>
            <label className="block text-sm">
              Confirmar senha
              <input
                aria-label="Confirmar senha"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="mt-2 w-full rounded-lg border border-input bg-background p-3"
              />
            </label>
            <button
              disabled={pending || !credential}
              className="w-full rounded-lg bg-forest px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Salvando..." : "Definir senha"}
            </button>
            {!credential && (
              <p className="text-sm text-muted-foreground">
                Abra esta página pelo seu link privado de ativação.
              </p>
            )}
          </form>
        )}
        {message && (
          <p role="status" className="mt-5 text-sm">
            {message}
          </p>
        )}
        <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-forest">
          Ir para o acesso
        </Link>
      </section>
    </main>
  );
}
