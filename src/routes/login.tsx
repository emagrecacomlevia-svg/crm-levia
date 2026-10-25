import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Leaf, LockKeyhole } from "lucide-react";

import { signInFn } from "@/modules/identity/server/auth.functions";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  headers: () => ({ "Cache-Control": "private, no-store" }),
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      const result = await signInFn({ data: { email, password } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPassword("");
      await router.invalidate();
      await navigate({ to: "/app" });
    } catch {
      setError("Não foi possível iniciar a sessão. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-forest">
          <Leaf aria-hidden="true" className="size-5" /> LEVIA BIOSCIENCE
        </Link>
        <div className="mt-8 flex items-center gap-3 text-forest">
          <LockKeyhole aria-hidden="true" />
          <h1 className="font-serif text-3xl">Acesso ao LEVIA HUB</h1>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Autenticação não concede automaticamente acesso administrativo.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-input bg-background px-4 py-3"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-input bg-background px-4 py-3"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-forest px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Verificando..." : "Entrar"}
          </button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">
          Acesso restrito. Não há cadastro público nem recuperação automática nesta fase.
        </p>
      </section>
    </main>
  );
}
