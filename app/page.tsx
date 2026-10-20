import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authed = await getSession();

  return (
    <main className="screen-navy">
      <div className="hero">
        <Logo size="lg" />
        <div className="marquee" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
        </div>
        <p className="eyebrow">Convenção</p>
        <h1>Conferência de kits</h1>
        <p className="lede">
          Cadastre os franqueados, gere a etiqueta com QR code e confirme a entrega do kit na retirada.
        </p>
        <ol className="steps">
          <li>
            <span>1</span>
            <div>
              <strong>Cadastre</strong>
              <p>Nome e unidade de quem vai retirar o kit.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Exporte</strong>
              <p>CSV com nome, unidade, código e URL para a Zebra.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Confirme</strong>
              <p>Leia o QR no celular e registre a entrega.</p>
            </div>
          </li>
        </ol>
        <div className="hero-actions">
          <Link className="btn btn-lime btn-lg" href={authed ? "/admin" : "/login"}>
            {authed ? "Abrir a conferência" : "Entrar na área da equipe"}
          </Link>
        </div>
      </div>
    </main>
  );
}
