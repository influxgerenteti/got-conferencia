import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="screen-navy">
      <div className="hero">
        <Logo size="lg" />
        <h1 className="not-found" style={{ marginTop: 24 }}>Página não encontrada</h1>
        <p className="lede">Esse endereço não faz parte da conferência de kits.</p>
        <div className="hero-actions">
          <Link className="btn btn-lime" href="/">Voltar ao início</Link>
        </div>
      </div>
    </main>
  );
}
