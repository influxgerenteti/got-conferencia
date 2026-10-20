import type { Participant } from "@/lib/types";

export type StatusFilter = "all" | "pending" | "delivered";

export function parseStatus(value: string | null): StatusFilter {
  if (value === "pending" || value === "delivered") return value;
  return "all";
}

export function matchesParticipant(participant: Participant, query: string, status: StatusFilter): boolean {
  if (status === "pending" && participant.deliveredAt) return false;
  if (status === "delivered" && !participant.deliveredAt) return false;

  const needle = query.trim().toLocaleLowerCase("pt-BR");
  if (!needle) return true;

  return [participant.name, participant.unit, participant.code].some((value) =>
    value.toLocaleLowerCase("pt-BR").includes(needle),
  );
}

export function byName(a: Participant, b: Participant): number {
  return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
}
