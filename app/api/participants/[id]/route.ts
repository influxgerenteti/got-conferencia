import { deleteParticipant, updateParticipant } from "@/lib/db";
import { fail, json, requireAdmin } from "@/lib/http";
import { cleanText, participantError } from "@/lib/validate";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { name?: unknown; unit?: unknown } | null;
    const name = cleanText(body?.name);
    const unit = cleanText(body?.unit);
    const problem = participantError(name, unit);
    if (problem) return json({ error: problem }, 400);
    return json({ participant: await updateParticipant(id, name, unit) });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await context.params;
    await deleteParticipant(id);
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
