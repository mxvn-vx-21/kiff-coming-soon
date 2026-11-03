/* ─────────────────────────────────────────────────────────────
   POST /api/subscribe — capture an email into D1.
   ───────────────────────────────────────────────────────────── */

interface Env {
  DB: D1Database;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }
  const email = String(body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }
  if (email.length > 320) {
    return json({ error: 'Email too long.' }, 400);
  }

  const ip = ctx.request.headers.get('CF-Connecting-IP') || null;
  const ua = ctx.request.headers.get('User-Agent') || null;

  try {
    await ctx.env.DB
      .prepare('INSERT OR IGNORE INTO subscribers (email, ip, ua) VALUES (?, ?, ?);')
      .bind(email, ip, ua)
      .run();
  } catch (err) {
    console.error('D1 insert failed', err);
    return json({ error: 'Server error. Please try again later.' }, 500);
  }

  return json({ ok: true, message: "You're on the list. See you at launch." }, 200);
};

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
