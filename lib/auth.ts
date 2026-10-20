import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "got_session";
const FOURTEEN_DAYS = 60 * 60 * 24 * 14;

function secret(): string {
  return process.env.SESSION_SECRET || "dev-secret-troque-no-env";
}

function password(): string {
  return process.env.ADMIN_PASSWORD || "got2026";
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function passwordMatches(input: string): boolean {
  const left = digest(input);
  const right = digest(password());
  return timingSafeEqual(left, right);
}

export function signSession(): string {
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", exp: Date.now() + FOURTEEN_DAYS * 1000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number; role?: string };
    return data.role === "admin" && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export async function getSession(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: FOURTEEN_DAYS,
  };
}
