import { rowsFromCsv } from "@/lib/csv";
import { importParticipants } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { fail, json, requireAdmin } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => null)) as { csv?: unknown } | null;
    const csv = typeof body?.csv === "string" ? body.csv : "";
    if (!csv.trim()) throw new AppError("Cole a planilha ou escolha um arquivo CSV.");
    if (csv.length > 1_000_000) throw new AppError("O arquivo é grande demais.");

    const parsed = rowsFromCsv(csv);
    if (parsed.rows.length === 0) {
      return json(
        {
          error: parsed.errors[0]?.message || "Nenhuma linha com nome e unidade.",
          imported: 0,
          errors: parsed.errors,
        },
        400,
      );
    }

    const created = await importParticipants(parsed.rows);
    return json({ imported: created.length, errors: parsed.errors });
  } catch (error) {
    return fail(error);
  }
}
