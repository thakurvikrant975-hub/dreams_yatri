import dns from "dns/promises";
import pg from "pg";

async function resolveIPv4(hostname: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const [ip] = await dns.resolve4(hostname);
      return ip;
    } catch {
      if (attempt === 3) break;
      await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }
  const { address } = await dns.lookup(hostname, { family: 4 });
  return address;
}

export async function createIPv4Pool(
  connectionString: string,
  opts: Partial<pg.PoolConfig> = {}
): Promise<pg.Pool> {
  const url = new URL(connectionString);
  const ip = await resolveIPv4(url.hostname);
  return new pg.Pool({
    host: ip,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: false, servername: url.hostname },
    ...opts,
  });
}
