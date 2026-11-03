/* ─────────────────────────────────────────────────────────────
   GET /api/content — returns all key/value rows from D1 as JSON.
   Falls back to sensible defaults if D1 isn't bound yet.
   ───────────────────────────────────────────────────────────── */

interface Env {
  DB: D1Database;
  LAUNCH_DATE_ISO?: string;
}

const FALLBACK: Record<string, string> = {
  hero_title: 'Drag, Drop, Deploy. Build Websites with AI.',
  hero_subtitle:
    'Kiff is a drag-n-drop website builder with a template marketplace, a curated library of free templates, and an AI Studio powered by Claude Code, Codex, GLM 5.2, Grok and more. No code. No servers. Free to start.',
  hero_badge: 'Coming soon · Spring 2027',
  cta_placeholder: 'you@domain.com',
  cta_button: 'Notify me at launch',
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  let data: Record<string, string> = { ...FALLBACK };

  if (ctx.env.DB) {
    try {
      const res = await ctx.env.DB.prepare('SELECT key, value FROM content;').all<{ key: string; value: string }>();
      for (const row of res.results || []) {
        data[row.key] = row.value;
      }
    } catch (err) {
      console.error('D1 read failed', err);
    }
  }

  if (ctx.env.LAUNCH_DATE_ISO) data.launch_date = ctx.env.LAUNCH_DATE_ISO;

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  });
};
