"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, copyText, isAuthError } from "@/lib/client";
import { rowsFromCsv } from "@/lib/csv";
import { matchesParticipant, type StatusFilter } from "@/lib/filter";
import { buildParticipantUrl, extractCode, formatWhen, isLocalUrl } from "@/lib/format";
import type { Participant } from "@/lib/types";

type DashboardData = {
  participants: Participant[];
  baseUrl: string;
  suggestions: string[];
};

type Modal =
  | { type: "create" }
  | { type: "edit"; participant: Participant }
  | { type: "qr"; participant: Participant }
  | { type: "import" }
  | null;

export function AdminDashboard() {
  const [tab, setTab] = useState<"lista" | "conferir">("lista");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [baseDraft, setBaseDraft] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const toastTimer = useRef<number | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  const load = useCallback(async (options?: { settings?: boolean }) => {
    try {
      const data = await api<DashboardData>("/api/participants");
      setParticipants(data.participants);
      setSuggestions(data.suggestions);
      if (options?.settings) {
        setBaseUrl(data.baseUrl);
        setBaseDraft(data.baseUrl);
      }
      setError(null);
    } catch (err) {
      if (!isAuthError(err)) setError(err instanceof Error ? err.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "conferir") setTab("conferir");
    setOrigin(window.location.origin);
    void load({ settings: true });
  }, [load]);

  useEffect(() => {
    function onFocus() {
      void load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(() => {
    if (tab === "conferir") codeRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    if (!modal) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setModal(null);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [modal]);

  const delivered = participants.filter((item) => item.deliveredAt).length;
  const pending = participants.length - delivered;
  const filtered = participants.filter((item) => matchesParticipant(item, q, status));
  const percent = participants.length ? Math.round((delivered / participants.length) * 100) : 0;
  const effectiveBase = baseUrl || origin;
  const recent = useMemo(
    () => [...participants]
      .filter((item) => item.deliveredAt)
      .sort((a, b) => (b.deliveredAt ?? "").localeCompare(a.deliveredAt ?? ""))
      .slice(0, 6),
    [participants],
  );

  function chooseTab(next: "lista" | "conferir") {
    setTab(next);
    const url = next === "conferir" ? "/admin?tab=conferir" : "/admin";
    window.history.replaceState(null, "", url);
  }

  async function saveBase(value = baseDraft) {
    const data = await api<{ baseUrl: string }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ baseUrl: value }),
    });
    setBaseUrl(data.baseUrl);
    setBaseDraft(data.baseUrl);
    return data.baseUrl;
  }

  async function exportCsv(kind: "zebra" | "excel", scope: "all" | "filtered") {
    try {
      const saved = baseDraft.trim() === baseUrl ? baseUrl : await saveBase();
      const target = saved || origin;
      if (isLocalUrl(target)) {
        const proceed = window.confirm(
          "A URL das etiquetas ainda aponta para este computador. Os celulares da convenção não vão abrir esse QR. Exportar mesmo assim?",
        );
        if (!proceed) return;
      }

      const params = new URLSearchParams({ sep: kind === "excel" ? "semicolon" : "comma" });
      if (scope === "filtered") {
        if (q.trim()) params.set("q", q.trim());
        if (status !== "all") params.set("status", status);
      }

      const response = await fetch(`/api/export?${params.toString()}`);
      if (response.status === 401) {
        window.location.assign("/login?next=/admin");
        return;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Não foi possível exportar.");
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `kits-franqueados-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      notify(kind === "zebra" ? "CSV da Zebra baixado." : "CSV do Excel baixado.");
    } catch (err) {
      if (!isAuthError(err)) notify(err instanceof Error ? err.message : "Não foi possível exportar.");
    }
  }

  async function remove(participant: Participant) {
    const confirmed = window.confirm(
      `Excluir ${participant.name} (${participant.unit})? O código ${participant.code} deixa de valer e a etiqueta impressa para de funcionar.`,
    );
    if (!confirmed) return;
    try {
      await api(`/api/participants/${participant.id}`, { method: "DELETE" });
      notify("Franqueado excluído.");
      await load();
    } catch (err) {
      if (!isAuthError(err)) notify(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  }

  async function copyLink(participant: Participant) {
    const base = baseUrl || origin;
    if (!base) return;
    await copyText(buildParticipantUrl(base, participant.code));
    notify("Link da etiqueta copiado.");
  }

  function openManual(event: FormEvent) {
    event.preventDefault();
    const code = extractCode(manualCode);
    if (!code) {
      notify("Digite o código da etiqueta.");
      return;
    }
    window.location.assign(`/v/${code}`);
  }

  return (
    <div className="stack">
      <section>
        <div className="stats">
          <article className="stat"><span>Franqueados</span><strong>{participants.length}</strong></article>
          <article className="stat"><span>Entregues</span><strong>{delivered}</strong></article>
          <article className="stat"><span>Pendentes</span><strong>{pending}</strong></article>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={delivered}
          aria-valuemin={0}
          aria-valuemax={participants.length}
          aria-label="Kits entregues"
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <p className="progress-label">{percent}% dos kits entregues</p>
      </section>

      <div className="tabs-bar">
        <div className="tabs" role="tablist">
          <button type="button" className={tab === "lista" ? "tab tab-on" : "tab"} onClick={() => chooseTab("lista")} role="tab" aria-selected={tab === "lista"}>
            Franqueados
          </button>
          <button type="button" className={tab === "conferir" ? "tab tab-on" : "tab"} onClick={() => chooseTab("conferir")} role="tab" aria-selected={tab === "conferir"}>
            Conferir
          </button>
        </div>
      </div>

      {error ? <div className="panel"><p className="field-error">{error}</p><button type="button" className="btn btn-navy" onClick={() => void load({ settings: true })}>Tentar de novo</button></div> : null}

      {tab === "conferir" ? (
        <section className="panel conferir-card">
          <p className="eyebrow">Na retirada</p>
          <h2>Ler a etiqueta</h2>
          <p className="helper">Aponte a câmera do celular para o QR. Se a câmera não abrir, digite o código impresso.</p>
          <form onSubmit={openManual} className="stack">
            <label className="field">
              <span>Código ou link</span>
              <input
                ref={codeRef}
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                placeholder="Ex.: K7H2P9QX"
              />
            </label>
            <button className="btn btn-lime btn-lg" type="submit">Abrir etiqueta</button>
          </form>
          <div>
            <h3>Últimas entregas</h3>
            {recent.length === 0 ? <p className="helper">Nenhum kit entregue ainda.</p> : (
              <div className="recent">
                {recent.map((item) => (
                  <Link key={item.id} href={`/v/${item.code}`}>
                    <strong>{item.name}</strong>
                    <span>{item.deliveredAt ? formatWhen(item.deliveredAt) : ""}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className={participants.length > 0 && !baseUrl ? "panel panel-accent" : "panel"}>
            <h2>Etiquetas para a Zebra</h2>
            <p className="helper">
              O CSV sai com as colunas Nome, Unidade, Codigo e URL. Na Zebra, use vírgula como delimitador. A URL precisa ser um endereço que o celular alcança.
            </p>
            <label className="field" style={{ marginTop: 12 }}>
              <span>URL base das etiquetas</span>
              <input
                value={baseDraft}
                onChange={(event) => setBaseDraft(event.target.value)}
                placeholder="http://192.168.0.15:3000"
                inputMode="url"
              />
            </label>
            {suggestions.length > 0 ? (
              <div className="suggestion-row">
                {suggestions.map((item) => (
                  <button key={item} type="button" className={baseUrl === item ? "chip chip-on" : "chip"} onClick={() => void saveBase(item).then(() => notify("URL das etiquetas atualizada.")).catch((err) => {
                    if (!isAuthError(err)) notify(err instanceof Error ? err.message : "Não foi possível salvar a URL.");
                  })}>
                    {item.replace(/^https?:\/\//, "")}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="inline-actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => void saveBase().then(() => notify("URL das etiquetas salva.")).catch((err) => {
                if (!isAuthError(err)) notify(err instanceof Error ? err.message : "Não foi possível salvar a URL.");
              })}>
                Salvar URL
              </button>
            </div>
            {effectiveBase ? <p className="url-text" style={{ marginTop: 10 }}>Exemplo: {buildParticipantUrl(effectiveBase, participants[0]?.code ?? "CODIGO")}</p> : null}
            {effectiveBase && isLocalUrl(effectiveBase) ? (
              <div className="banner">Esse endereço é local. Toque no IP da sua rede, acima, para os celulares abrirem a etiqueta.</div>
            ) : null}
            <div className="inline-actions" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-lime" disabled={participants.length === 0} onClick={() => void exportCsv("zebra", "all")}>
                Exportar para Zebra
              </button>
              <button type="button" className="btn btn-ghost" disabled={participants.length === 0} onClick={() => void exportCsv("excel", "all")}>
                Exportar para Excel
              </button>
              {q.trim() || status !== "all" ? (
                <button type="button" className="btn btn-ghost" disabled={filtered.length === 0} onClick={() => void exportCsv("zebra", "filtered")}>
                  Zebra desta busca ({filtered.length})
                </button>
              ) : null}
            </div>
          </section>

          <div className="toolbar">
            <input className="search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar por nome, unidade ou código" aria-label="Buscar franqueado" />
            <div className="filters" role="group" aria-label="Filtrar por entrega">
              <button type="button" className={status === "all" ? "chip chip-on" : "chip"} onClick={() => setStatus("all")}>Todos {participants.length}</button>
              <button type="button" className={status === "pending" ? "chip chip-on" : "chip"} onClick={() => setStatus("pending")}>Pendentes {pending}</button>
              <button type="button" className={status === "delivered" ? "chip chip-on" : "chip"} onClick={() => setStatus("delivered")}>Entregues {delivered}</button>
            </div>
            <div className="toolbar-actions">
              <button type="button" className="btn btn-navy" onClick={() => setModal({ type: "create" })}>Cadastrar</button>
              <button type="button" className="btn btn-ghost" onClick={() => setModal({ type: "import" })}>Importar CSV</button>
            </div>
          </div>

          {loading ? (
            <div className="list">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : participants.length === 0 ? (
            <section className="panel empty">
              <h2>Nenhum franqueado cadastrado</h2>
              <p className="helper">Adicione nome e unidade, ou importe a planilha da convenção.</p>
              <div className="inline-actions">
                <button type="button" className="btn btn-lime" onClick={() => setModal({ type: "create" })}>Cadastrar</button>
                <button type="button" className="btn btn-ghost" onClick={() => setModal({ type: "import" })}>Importar CSV</button>
              </div>
            </section>
          ) : filtered.length === 0 ? (
            <section className="panel empty">
              <h2>Nenhum resultado</h2>
              <p className="helper">Não há franqueado com esse nome, unidade ou código.</p>
            </section>
          ) : (
            <div className="list">
              {filtered.map((participant) => (
                <article key={participant.id} className={participant.deliveredAt ? "person person-done" : "person"}>
                  <div>
                    <div className="person-top">
                      <h3 className="person-name">{participant.name}</h3>
                      <span className={participant.deliveredAt ? "badge badge-ok" : "badge badge-wait"}>
                        {participant.deliveredAt ? "Entregue" : "Pendente"}
                      </span>
                    </div>
                    <p className="person-meta">
                      {participant.unit}
                      {" · "}
                      <span className="code">{participant.code}</span>
                      {participant.deliveredAt ? ` · ${formatWhen(participant.deliveredAt)}` : ""}
                    </p>
                  </div>
                  <div className="person-actions">
                    <Link className="btn btn-lime" href={`/v/${participant.code}`}>Conferir</Link>
                    <button type="button" className="btn btn-ghost" onClick={() => setModal({ type: "qr", participant })}>QR</button>
                    <button type="button" className="btn btn-ghost" onClick={() => void copyLink(participant)}>Copiar link</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setModal({ type: "edit", participant })}>Editar</button>
                    <button type="button" className="btn btn-danger" onClick={() => void remove(participant)}>Excluir</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {modal?.type === "create" || modal?.type === "edit" ? (
        <ParticipantForm
          key={modal.type === "edit" ? modal.participant.id : "new"}
          initial={modal.type === "edit" ? modal.participant : null}
          onClose={() => setModal(null)}
          onSaved={(participant, isNew) => {
            setModal(isNew ? { type: "qr", participant } : null);
            notify(isNew ? "Franqueado cadastrado." : "Cadastro atualizado.");
            void load();
          }}
        />
      ) : null}

      {modal?.type === "qr" ? (
        <QrModal participant={modal.participant} baseUrl={effectiveBase} onClose={() => setModal(null)} onCopy={() => void copyLink(modal.participant)} />
      ) : null}

      {modal?.type === "import" ? (
        <ImportModal
          onClose={() => setModal(null)}
          onDone={async (message) => {
            setModal(null);
            notify(message);
            await load();
          }}
        />
      ) : null}

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

function ParticipantForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Participant | null;
  onClose: () => void;
  onSaved: (participant: Participant, isNew: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ participant: Participant }>(initial ? `/api/participants/${initial.id}` : "/api/participants", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify({ name, unit }),
      });
      onSaved(data.participant, !initial);
    } catch (err) {
      if (!isAuthError(err)) setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Editar franqueado" : "Cadastrar franqueado"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="field">
            <span>Nome</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required autoFocus placeholder="Maria Souza" />
          </label>
          <label className="field">
            <span>Unidade</span>
            <input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={1000} required placeholder="inFlux Batel" />
          </label>
        </div>
        {initial ? <p className="helper" style={{ marginTop: 10 }}>O código {initial.code} permanece o mesmo, para a etiqueta já impressa continuar válida.</p> : null}
        {error ? <p className="field-error">{error}</p> : null}
        <button className="btn btn-lime btn-block" style={{ marginTop: 16 }} type="submit" disabled={busy}>
          {busy ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </Modal>
  );
}

function QrModal({
  participant,
  baseUrl,
  onClose,
  onCopy,
}: {
  participant: Participant;
  baseUrl: string;
  onClose: () => void;
  onCopy: () => void;
}) {
  const [src, setSrc] = useState("");
  const url = baseUrl ? buildParticipantUrl(baseUrl, participant.code) : "";

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    import("qrcode")
      .then((QR) => QR.toDataURL(url, {
        margin: 2,
        width: 640,
        errorCorrectionLevel: "Q",
        color: { dark: "#022859", light: "#ffffff" },
      }))
      .then((data) => {
        if (!cancelled) setSrc(data);
      })
      .catch(() => {
        if (!cancelled) setSrc("");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <Modal title="QR da etiqueta" onClose={onClose}>
      <p className="person-name">{participant.name}</p>
      <p className="person-meta">{participant.unit}</p>
      <div className="qr-box">
        {src ? <img src={src} alt={`QR code de ${participant.name}`} /> : <p>Gerando QR...</p>}
      </div>
      <p className="code-chip">{participant.code}</p>
      <p className="url-text" style={{ marginTop: 10 }}>{url}</p>
      <div className="inline-actions" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-navy" onClick={onCopy}>Copiar link</button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!src}
          onClick={() => {
            const link = document.createElement("a");
            link.href = src;
            link.download = `qr-${participant.code}.png`;
            link.click();
          }}
        >
          Baixar QR
        </button>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (csvText.trim() ? rowsFromCsv(csvText) : { rows: [], errors: [] }), [csvText]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ imported: number; errors: { line: number; message: string }[] }>("/api/import", {
        method: "POST",
        body: JSON.stringify({ csv: csvText }),
      });
      const skipped = result.errors.length ? ` ${result.errors.length} linha(s) ignorada(s).` : "";
      onDone(`${result.imported} franqueado(s) cadastrado(s).${skipped}`);
    } catch (err) {
      if (!isAuthError(err)) setError(err instanceof Error ? err.message : "Não foi possível importar.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Importar planilha" onClose={onClose}>
      <p className="helper">
        Use as colunas Nome e Unidade, separadas por ponto e vírgula ou vírgula. A primeira linha pode ser o cabeçalho.
      </p>
      <p className="helper"><a href="/modelo-franqueados.csv">Baixar modelo CSV</a></p>
      <form onSubmit={submit}>
        <div className="inline-actions" style={{ margin: "12px 0" }}>
          <label className="btn btn-ghost">
            Escolher arquivo
            <input
              className="hidden-input"
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setCsvText(await file.text());
              }}
            />
          </label>
        </div>
        <label className="field">
          <span>Conteúdo</span>
          <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder={"Nome;Unidade\nMaria Souza;inFlux Batel"} />
        </label>
        {csvText.trim() ? (
          <p className="preview-note">{preview.rows.length} franqueado(s) pronto(s) para importar.</p>
        ) : null}
        {preview.errors.length > 0 ? (
          <ul className="issue-list">
            {preview.errors.slice(0, 6).map((issue) => (
              <li key={`${issue.line}-${issue.message}`}>Linha {issue.line}: {issue.message}</li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="field-error">{error}</p> : null}
        <button className="btn btn-lime btn-block" style={{ marginTop: 16 }} type="submit" disabled={busy || preview.rows.length === 0}>
          {busy ? "Importando..." : "Importar"}
        </button>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
        </div>
        {children}
      </div>
    </div>
  );
}
