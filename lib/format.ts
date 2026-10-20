export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function extractCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const fromPath = trimmed.match(/\/v\/([A-Za-z0-9]+)/i);
  if (fromPath) return fromPath[1].toUpperCase();

  return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildParticipantUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, "")}/v/${code}`;
}

export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/admin";
  }
  return value;
}

export function isLocalUrl(value: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(value);
}
