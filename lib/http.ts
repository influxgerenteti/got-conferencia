import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function requireAdmin() {
  if (await getSession()) return null;
  return json({ error: "Faça login para continuar." }, 401);
}

export function fail(error: unknown) {
  if (error instanceof AppError) return json({ error: error.message }, error.status);
  console.error(error);
  return json({ error: "Não foi possível concluir. Tente de novo." }, 500);
}
