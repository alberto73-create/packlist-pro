const buckets = new Map();
const fail = (res, status, error) => res.status(status).json({ ok: false, error });

export default function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Metodo non consentito');
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const hits = (buckets.get(ip) || []).filter(time => now - time < 60000);
  if (hits.length >= 10) return fail(res, 429, 'Troppe richieste. Riprova tra un minuto.');
  hits.push(now); buckets.set(ip, hits);
  if (!process.env.ADMIN_PASSWORD || req.body?.password !== process.env.ADMIN_PASSWORD) return fail(res, 401, 'Credenziali non valide');
  return res.status(200).json({ ok: true });
}
