import { passwordMatches, sessionCookieOptions, signSession } from "@/lib/auth";
import { json } from "@/lib/http";

const attempts = new Map<string, { count: number; until: number }>();

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

function locked(ip: string): boolean {
  const row = attempts.get(ip);
  if (!row) return false;
  if (Date.now() > row.until) {
    attempts.delete(ip);
    return false;
  }
  return row.count >= 12;
}

function markFailure(ip: string) {
  const row = attempts.get(ip);
  const until = Date.now() + 10 * 60 * 1000;
  if (!row || Date.now() > row.until) attempts.set(ip, { count: 1, until });
  else row.count += 1;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (locked(ip)) return json({ error: "Muitas tentativas. Espere alguns minutos." }, 429);

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || !passwordMatches(password)) {
    markFailure(ip);
    return json({ error: "Senha incorreta." }, 401);
  }

  attempts.delete(ip);
  const response = json({ ok: true });
  response.cookies.set({ ...sessionCookieOptions(), value: signSession() });
  return response;
}
