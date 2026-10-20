import Link from "next/link";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";

export function Topbar() {
  return (
    <header className="topbar">
      <Link href="/admin" className="brand">
        <Logo />
        <span className="brand-text">
          <small>Convenção</small>
          <strong>Conferência de kits</strong>
        </span>
      </Link>
      <LogoutButton />
    </header>
  );
}
