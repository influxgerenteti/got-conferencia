"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Logo } from "@/components/logo";
import { api, isAuthError } from "@/lib/client";
import { formatWhen } from "@/lib/format";
import type { Participant } from "@/lib/types";

type Props = {
  code: string;
  participant: Participant | null;
  authed: boolean;
};

export function VerifyScreen({ code, participant, authed }: Props) {
  const [current, setCurrent] = useState(participant);
  const [logged, setLogged] = useState(authed);
  const [phase, setPhase] = useState<"details" | "confirm" | "done" | "already">(
    participant?.deliveredAt ? "already" : "details",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginHref = useMemo(() => {
    const next = current ? `/v/${current.code}` : `/v/${code}`;
    return `/login?next=${encodeURIComponent(next)}`;
  }, [code, current]);

  async function confirm() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ participant: Participant; already: boolean }>("/api/deliver", {
        method: "POST",
        body: JSON.stringify({ code: current.code }),
      });
      setCurrent(result.participant);
      setPhase(result.already ? "already" : "done");
      if (!result.already && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(40);
      }
    } catch (err) {
      if (isAuthError(err)) {
        setLogged(false);
        return;
      }
      setError(err instanceof Error ? err.message : "Não foi possível confirmar.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ participant: Participant }>("/api/deliver", {
        method: "POST",
        body: JSON.stringify({ code: current.code, undo: true }),
      });
      setCurrent(result.participant);
      setPhase("details");
    } catch (err) {
      if (!isAuthError(err)) setError(err instanceof Error ? err.message : "Não foi possível desfazer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="verify-page">
      <header className="verify-top">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo />
          <div>
            <div className="verify-kicker">inFlux Got Talent</div>
            <strong>Entrega de kit</strong>
          </div>
        </div>
        {logged ? <Link className="btn btn-on-navy" href="/admin?tab=conferir">Painel</Link> : null}
      </header>

      <div className="verify-body">
        {!current ? (
          <section className="ticket">
            <div className="ticket-stripe ticket-stripe-warn" />
            <div className="ticket-body">
              <p className="kicker">Etiqueta</p>
              <h1 className="ticket-name">Não encontrada</h1>
              <p>O código <span className="code">{code || "—"}</span> não está no cadastro. Confira a etiqueta ou fale com a equipe.</p>
              {logged ? <Link className="btn btn-navy btn-block" href="/admin?tab=conferir">Digitar outro código</Link> : null}
            </div>
          </section>
        ) : (
          <section className="ticket">
            <div className={phase === "already" ? "ticket-stripe ticket-stripe-warn" : "ticket-stripe"} />
            <div className="ticket-body">
              {phase === "done" ? (
                <div className="result result-ok">
                  <Check />
                  <strong>Kit entregue</strong>
                  <span>{current.deliveredAt ? `Confirmado às ${formatWhen(current.deliveredAt)}` : "Entrega confirmada."}</span>
                </div>
              ) : null}

              {phase === "already" ? (
                <div className="result result-warn">
                  <strong>Este kit já foi entregue</strong>
                  <span>
                    {current.deliveredAt ? `Registrado às ${formatWhen(current.deliveredAt)}. ` : ""}
                    Não entregue outro kit.
                  </span>
                </div>
              ) : null}

              <div>
                <p className="kicker">Franqueado</p>
                <h1 className="ticket-name">{current.name}</h1>
              </div>

              <div className="unit-box">
                <p className="kicker">Unidade</p>
                <strong>{current.unit}</strong>
              </div>

              <div>
                <p className="kicker">Código</p>
                <div className="code-chip">{current.code}</div>
              </div>

              {error ? <p className="field-error">{error}</p> : null}

              {phase === "details" && logged ? (
                <button type="button" className="btn btn-lime btn-lg" onClick={() => setPhase("confirm")}>
                  Confirmar entrega do kit
                </button>
              ) : null}

              {phase === "confirm" ? (
                <div className="stack">
                  <p>Entregar o kit para <strong>{current.name}</strong>, unidade <strong>{current.unit}</strong>?</p>
                  <button type="button" className="btn btn-lime btn-lg" onClick={confirm} disabled={busy}>
                    {busy ? "Confirmando..." : "Sim, entregar"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-block" onClick={() => setPhase("details")} disabled={busy}>
                    Voltar
                  </button>
                </div>
              ) : null}

              {phase === "details" && !logged ? (
                <Link className="btn btn-lime btn-lg" href={loginHref}>
                  Entrar para confirmar
                </Link>
              ) : null}

              {phase === "done" || phase === "already" ? (
                <div className="stack">
                  {logged ? (
                    <Link className="btn btn-navy btn-lg" href="/admin?tab=conferir">
                      Próxima etiqueta
                    </Link>
                  ) : null}
                  {logged ? (
                    <button type="button" className="btn btn-ghost btn-block" onClick={undo} disabled={busy}>
                      Desfazer, foi um engano
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg className="check" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#a1d700" />
      <path d="M7 12.5 10.2 16 17 8.5" fill="none" stroke="#022859" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
