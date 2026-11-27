/**
 * Express `trust proxy` — bez ovoga API iza Railway/Fly/Vercel proxy-ja vidi samo IP proxy-ja,
 * pa rate limit po IP-u postaje **globalan** (npr. 5 prijava/min za sve korisnike).
 *
 * Vrijednost: broj hopova (1 za jedan reverse proxy), true/false, ili izostavljeno.
 * Default: `1` u produkciji, `false` u razvoju (da lokalni X-Forwarded-For ne može da se podmetne).
 */
export type TrustProxySetting = boolean | number;

export function parseTrustProxy(value: string | undefined, nodeEnv: string): TrustProxySetting {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return nodeEnv === 'production' ? 1 : false;
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  const hops = Number(raw);
  if (Number.isInteger(hops) && hops >= 1 && hops <= 10) return hops;

  throw new Error('TRUST_PROXY mora biti true, false ili broj hopova 1–10.');
}
