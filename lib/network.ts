import os from "os";

export function suggestBases(request: Request): string[] {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  const proto = (request.headers.get("x-forwarded-proto") || "http").split(",")[0].trim();
  const current = `${proto}://${host}`;
  const port = host.includes(":") ? host.split(":").pop() : proto === "https" ? "443" : "3000";
  const addresses: string[] = [];

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      const family = entry.family as string | number;
      if (entry.internal) continue;
      if (family === "IPv4" || family === 4) addresses.push(`http://${entry.address}:${port}`);
    }
  }

  return Array.from(new Set([...addresses, current]));
}

export function requestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  const proto = (request.headers.get("x-forwarded-proto") || "http").split(",")[0].trim();
  return `${proto}://${host}`;
}
