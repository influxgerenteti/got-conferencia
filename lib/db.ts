import { generateCode } from "@/lib/codes";
import { AppError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type { DeliveryResult, Participant } from "@/lib/types";

type Row = {
  id: string;
  name: string;
  unit: string;
  code: string;
  delivered_at: string | null;
  created_at: string;
};

function mapParticipant(row: Row): Participant {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    code: row.code,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
  };
}

function dbError(error: { message: string; code?: string }): never {
  console.error("supabase", error.code, error.message);
  if (error.code === "23514") throw new AppError("Nome ou unidade fora do limite permitido.");
  throw new AppError("Não foi possível falar com o banco da conferência.", 500);
}

function lookup(key: { id?: string; code?: string }): { column: "id" | "code"; value: string } | null {
  if (key.id) return { column: "id", value: key.id };
  if (key.code) {
    const value = key.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value) return { column: "code", value };
  }
  return null;
}

async function uniqueCode(existing: Set<string>): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateCode(8);
    if (existing.has(code)) continue;
    existing.add(code);
    return code;
  }
  throw new AppError("Não foi possível gerar um código único.", 500);
}

export async function listParticipants(): Promise<Participant[]> {
  const { data, error } = await supabase().from("participants").select("*");
  if (error) dbError(error);
  return (data as Row[])
    .map(mapParticipant)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

export async function getParticipantByCode(code: string): Promise<Participant | null> {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) return null;

  const { data, error } = await supabase()
    .from("participants")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();
  if (error) dbError(error);
  return data ? mapParticipant(data as Row) : null;
}

export async function getSettings(): Promise<{ baseUrl: string }> {
  const { data, error } = await supabase()
    .from("app_settings")
    .select("base_url")
    .eq("id", 1)
    .maybeSingle();
  if (error) dbError(error);
  return { baseUrl: data?.base_url ?? "" };
}

export async function setBaseUrl(baseUrl: string): Promise<{ baseUrl: string }> {
  const { data, error } = await supabase()
    .from("app_settings")
    .upsert({ id: 1, base_url: baseUrl })
    .select("base_url")
    .single();
  if (error) dbError(error);
  return { baseUrl: data.base_url };
}

export async function createParticipant(name: string, unit: string): Promise<Participant> {
  const { data: codes, error: codesError } = await supabase().from("participants").select("code");
  if (codesError) dbError(codesError);
  const existing = new Set((codes ?? []).map((row) => row.code as string));

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = await uniqueCode(existing);
    const { data, error } = await supabase()
      .from("participants")
      .insert({ name, unit, code })
      .select("*")
      .single();
    if (!error && data) return mapParticipant(data as Row);
    if (error?.code === "23505") continue;
    if (error) dbError(error);
  }

  throw new AppError("Não foi possível gerar um código único.", 500);
}

export async function updateParticipant(id: string, name: string, unit: string): Promise<Participant> {
  const { data, error } = await supabase()
    .from("participants")
    .update({ name, unit })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) dbError(error);
  if (!data) throw new AppError("Franqueado não encontrado.", 404);
  return mapParticipant(data as Row);
}

export async function deleteParticipant(id: string): Promise<void> {
  const { data, error } = await supabase().from("participants").delete().eq("id", id).select("id");
  if (error) dbError(error);
  if (!data?.length) throw new AppError("Franqueado não encontrado.", 404);
}

export async function importParticipants(rows: { name: string; unit: string }[]): Promise<Participant[]> {
  const { data: codes, error: codesError } = await supabase().from("participants").select("code");
  if (codesError) dbError(codesError);
  const existing = new Set((codes ?? []).map((row) => row.code as string));
  const payload = [];
  for (const row of rows) {
    payload.push({
      name: row.name,
      unit: row.unit,
      code: await uniqueCode(existing),
    });
  }

  const { data, error } = await supabase().from("participants").insert(payload).select("*");
  if (error) dbError(error);
  return (data as Row[])
    .map(mapParticipant)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

async function findParticipant(key: { id?: string; code?: string }): Promise<Participant | null> {
  const target = lookup(key);
  if (!target) return null;
  if (target.column === "code") return getParticipantByCode(target.value);

  const { data, error } = await supabase()
    .from("participants")
    .select("*")
    .eq("id", target.value)
    .maybeSingle();
  if (error) dbError(error);
  return data ? mapParticipant(data as Row) : null;
}

export async function confirmDelivery(key: { id?: string; code?: string }): Promise<DeliveryResult> {
  const target = lookup(key);
  if (!target) throw new AppError("Franqueado não encontrado.", 404);

  const { data, error } = await supabase()
    .from("participants")
    .update({ delivered_at: new Date().toISOString() })
    .eq(target.column, target.value)
    .is("delivered_at", null)
    .select("*")
    .maybeSingle();
  if (error) dbError(error);
  if (data) return { participant: mapParticipant(data as Row), already: false };

  const existing = await findParticipant(key);
  if (!existing) throw new AppError("Franqueado não encontrado.", 404);
  if (existing.deliveredAt) return { participant: existing, already: true };
  throw new AppError("Não foi possível registrar a entrega.", 500);
}

export async function undoDelivery(key: { id?: string; code?: string }): Promise<Participant> {
  const target = lookup(key);
  if (!target) throw new AppError("Franqueado não encontrado.", 404);

  const { data, error } = await supabase()
    .from("participants")
    .update({ delivered_at: null })
    .eq(target.column, target.value)
    .not("delivered_at", "is", null)
    .select("*")
    .maybeSingle();
  if (error) dbError(error);
  if (data) return mapParticipant(data as Row);

  const existing = await findParticipant(key);
  if (!existing) throw new AppError("Franqueado não encontrado.", 404);
  throw new AppError("Este kit ainda não foi entregue.");
}
