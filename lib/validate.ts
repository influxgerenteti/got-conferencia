export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

export function participantError(name: string, unit: string): string | null {
  if (name.length < 2) return "Informe o nome do franqueado.";
  if (name.length > 120) return "O nome pode ter no máximo 120 caracteres.";
  if (!unit) return "Informe a unidade.";
  if (unit.length > 1000) return "A unidade pode ter no máximo 1000 caracteres.";
  return null;
}
