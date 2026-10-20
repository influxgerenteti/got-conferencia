import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getParticipantByCode } from "@/lib/db";
import { VerifyScreen } from "@/components/verify-screen";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const participant = await getParticipantByCode(code);
  return {
    title: participant ? `${participant.name} · Kit` : "Etiqueta não encontrada",
  };
}

export default async function VerifyPage({ params }: PageProps) {
  const { code } = await params;
  const participant = await getParticipantByCode(code);
  const authed = await getSession();
  return <VerifyScreen code={code.toUpperCase()} participant={participant} authed={authed} />;
}
