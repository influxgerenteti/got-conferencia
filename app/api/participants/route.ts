import { createParticipant, listParticipants, getSettings } from "@/lib/db";
import { fail, json, requireAdmin } from "@/lib/http";
import { suggestBases } from "@/lib/network";
import { cleanText, participantError } from "@/lib/validate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const settings = await getSettings();
    return json({
      participants: await listParticipants(),
      baseUrl: settings.baseUrl,
      suggestions: suggestBases(request),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => null)) as { name?: unknown; unit?: unknown } | null;
    const name = cleanText(body?.name);
    const unit = cleanText(body?.unit);
    const problem = participantError(name, unit);
    if (problem) return json({ error: problem }, 400);
    return json({ participant: await createParticipant(name, unit) }, 201);
  } catch (error) {
    return fail(error);
  }
}
