"use client";

import { FormEvent, useState } from "react";
import { Logo } from "@/components/logo";
import { safeNext } from "@/lib/format";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error || "Não foi possível entrar.");
        setBusy(false);
        return;
      }

      const next = safeNext(new URLSearchParams(window.location.search).get("next"));
      window.location.assign(next);
    } catch {
      setError("Sem conexão. Tente de novo.");
      setBusy(false);
    }
  }

  return (
    <main className="screen-navy">
      <div className="login-wrap">
        <Logo size="lg" />
        <form className="login-card" onSubmit={submit}>
          <p className="eyebrow">Área da equipe</p>
          <h1>Entrar</h1>
          <p className="helper">Use a senha da convenção para cadastrar franqueados e abrir o painel. A leitura do QR confirma a entrega sem login.</p>
          <label className="field">
            <span>Senha</span>
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </label>
          <div className="inline-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShow((value) => !value)}>
              {show ? "Ocultar senha" : "Mostrar senha"}
            </button>
          </div>
          {error ? <p className="field-error">{error}</p> : null}
          <button className="btn btn-lime btn-block" style={{ marginTop: 16 }} type="submit" disabled={busy}>
            {busy ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
