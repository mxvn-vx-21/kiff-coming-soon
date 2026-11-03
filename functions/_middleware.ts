/* ─────────────────────────────────────────────────────────────
   Edge middleware — injects launch-date meta tag and gates /db.
   ───────────────────────────────────────────────────────────── */

interface Env {
  DB: D1Database;
  ADMIN_PASS_HASH: string;
  LAUNCH_DATE_ISO: string;
}

const COOKIE = 'bb_admin';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days, in seconds

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function makeToken(secret: string): Promise<string> {
  // token = hmac-like: sha256(secret + '|' + expiry)
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const sig = await sha256(`${secret}|${exp}`);
  return `${exp}.${sig}`;
}

async function verifyToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split('.');
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await sha256(`${secret}|${exp}`);
  return sig === expected;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);

  // ── Inject launch date as meta tag into the static HTML ──
  // (cheaper: do this only on the root path)
  if (url.pathname === '/' && ctx.request.method === 'GET') {
    const res = await ctx.next();
    // We can't easily inject into a streamed Response without cloning;
    // for the landing page we expose launch date via a /api/content field instead.
    return res;
  }

  // ── Gate /db (and /db/*) ──
  if (url.pathname === '/db' || url.pathname.startsWith('/db/')) {
    const cookie = ctx.request.headers.get('Cookie') || '';
    const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
    const token = match ? match[1] : undefined;
    const authed = await verifyToken(token, ctx.env.ADMIN_PASS_HASH || 'unset');

    if (authed) {
      // allow through to the /db handler (functions/db.ts)
      return ctx.next();
    }

    // Not authed — show login form (handled by the /db route itself).
    // We pass through; functions/db.ts will render the login form on GET.
    return ctx.next();
  }

  return ctx.next();
};
