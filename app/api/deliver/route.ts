import { confirmDelivery, undoDelivery } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { fail, json, requireAdmin } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: unknown;
      code?: unknown;
      undo?: unknown;
    } | null;
    const id = typeof body?.id === "string" ? body.id : "";
    const code = typeof body?.code === "string" ? body.code : "";
    if (!id && !code) throw new AppError("Informe o código da etiqueta.");

    // A URL da etiqueta já identifica o franqueado. Sem o código, só a equipe logada confirma.
    if (!code) {
      const denied = await requireAdmin();
      if (denied) return denied;
    }

    if (body?.undo) return json({ participant: await undoDelivery(code ? { code } : { id }) });
    return json(await confirmDelivery(code ? { code } : { id }));
  } catch (error) {
    return fail(error);
  }
}
