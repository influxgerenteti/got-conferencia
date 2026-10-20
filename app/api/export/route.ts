import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { listParticipants, getSettings } from "@/lib/db";
import { buildParticipantUrl } from "@/lib/format";
import { matchesParticipant, parseStatus } from "@/lib/filter";
import { fail, requireAdmin } from "@/lib/http";
import { requestOrigin } from "@/lib/network";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const separator = url.searchParams.get("sep") === "semicolon" ? ";" : ",";
    const withBom = separator === ";";
    const query = url.searchParams.get("q") ?? "";
    const status = parseStatus(url.searchParams.get("status"));
    const settings = await getSettings();
    const base = settings.baseUrl || requestOrigin(request);
    const rows = (await listParticipants()).filter((participant) => matchesParticipant(participant, query, status));

    const csv = toCsv(
      [
        ["Nome", "Unidade", "Codigo", "URL"],
        ...rows.map((participant) => [
          participant.name,
          participant.unit,
          participant.code,
          buildParticipantUrl(base, participant.code),
        ]),
      ],
      separator,
      withBom,
    );

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kits-franqueados-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
