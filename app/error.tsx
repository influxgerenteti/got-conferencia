"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="screen-navy">
      <div className="hero">
        <h1>Algo saiu do esperado</h1>
        <p className="lede">A conferência não carregou. Tente de novo em instantes.</p>
        <div className="hero-actions">
          <button type="button" className="btn btn-lime" onClick={() => reset()}>Tentar de novo</button>
        </div>
      </div>
    </main>
  );
}
