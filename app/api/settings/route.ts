import { setBaseUrl } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { fail, json, requireAdmin } from "@/lib/http";

export const runtime = "nodejs";

export function normalizeBaseUrl(value: unknown): string {
  if (typeof value !== "string") throw new AppError("Informe o endereço das etiquetas.");
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new AppError("Informe um endereço válido. Ex.: http://192.168.0.15:3000");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError("Use um endereço que comece com http ou https.");
  }

  return url.origin;
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => null)) as { baseUrl?: unknown } | null;
    const baseUrl = normalizeBaseUrl(body?.baseUrl);
    return json(await setBaseUrl(baseUrl));
  } catch (error) {
    return fail(error);
  }
}
