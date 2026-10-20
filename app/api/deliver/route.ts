import { confirmDelivery, undoDelivery } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { fail, json, requireAdmin } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => null)) as {
      id?: unknown;
      code?: unknown;
      undo?: unknown;
    } | null;
    const id = typeof body?.id === "string" ? body.id : "";
    const code = typeof body?.code === "string" ? body.code : "";
    if (!id && !code) throw new AppError("Informe o código da etiqueta.");

    if (body?.undo) return json({ participant: await undoDelivery({ id, code }) });
    return json(await confirmDelivery({ id, code }));
  } catch (error) {
    return fail(error);
  }
}
