/* ─────────────────────────────────────────────────────────────
   /db — password-gated admin dashboard.
   - GET  /db          → login form (if not authed) OR dashboard
   - POST /db          { password }                  → set session cookie
   - POST /db          { action: 'update', key, value } → update content
   - POST /db          { action: 'delete', key }       → delete content
   - GET  /db?export=subscribers → CSV export of subscribers
   - POST /db?logout=1              → clear cookie
   ───────────────────────────────────────────────────────────── */

interface Env {
  DB: D1Database;
  ADMIN_PASS_HASH: string;
}

const COOKIE = 'bb_admin';
const SESSION_TTL = 60 * 60 * 24 * 7;

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function makeToken(secret: string): Promise<string> {
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

function getCookie(req: Request, name: string): string | undefined {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp(`${name}=([^;]+)`));
  return m ? m[1] : undefined;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const pass = ctx.env.ADMIN_PASS_HASH || '';
  const token = getCookie(ctx.request, COOKIE);
  let authed = await verifyToken(token, pass);

  // ── POST: handle auth + CRUD ──
  if (ctx.request.method === 'POST') {
    let body: any;
    try { body = await ctx.request.json(); } catch {
      try { body = Object.fromEntries(new URLSearchParams(await ctx.request.text())); } catch { body = {}; }
    }

    // logout
    if (body.logout) {
      return new Response('Logged out.', {
        status: 302,
        headers: {
          'Location': '/db',
          'Set-Cookie': `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
        },
      });
    }

    // login attempt
    if (!authed && body.password != null) {
      const submitted = String(body.password);
      const hash = await sha256(submitted);
      if (hash === pass) {
        const newToken = await makeToken(pass);
        authed = true;
        const html = await renderDashboard(ctx.env);
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Set-Cookie': `${COOKIE}=${newToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`,
          },
        });
      } else {
        return new Response(renderLogin('Incorrect password. Try again.'), {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    }

    if (!authed) {
      return new Response(renderLogin('Session expired. Please log in again.'), {
        status: 401,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // CRUD actions
    if (body.action === 'update' && typeof body.key === 'string' && typeof body.value === 'string') {
      await ctx.env.DB
        .prepare(
          `INSERT INTO content (key, value, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now');`
        )
        .bind(body.key.trim().slice(0, 64), body.value.slice(0, 8000))
        .run();
      return json({ ok: true });
    }
    if (body.action === 'delete' && typeof body.key === 'string') {
      await ctx.env.DB.prepare('DELETE FROM content WHERE key = ?;').bind(body.key.trim().slice(0, 64)).run();
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  }

  // ── GET ──
  // CSV export
  if (authed && url.searchParams.get('export') === 'subscribers') {
    const res = await ctx.env.DB.prepare('SELECT email, created_at, ip FROM subscribers ORDER BY id DESC;').all();
    const rows = (res.results || []) as { email: string; created_at: string; ip: string | null }[];
    const csv = ['email,created_at,ip', ...rows.map((r) => `"${r.email}","${r.created_at}","${r.ip || ''}"`)].join('\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="subscribers.csv"',
      },
    });
  }

  if (authed) {
    const html = await renderDashboard(ctx.env);
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return new Response(renderLogin(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* ─────────────  Login page  ───────────── */
function renderLogin(error = ''): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>kiff / db · login</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
  :root { --bg:#0a0a0b; --fg:#f4f4f5; --dim:#a1a1aa; --line:rgba(255,255,255,0.1); --accent:#A3E635; --err:#f87171; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--fg);font-family:'Space Grotesk',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{width:100%;max-width:380px;padding:36px 32px;background:rgba(255,255,255,0.04);border:1px solid var(--line);border-radius:18px;backdrop-filter:blur(14px)}
  .brand{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent);letter-spacing:0.1em;margin-bottom:8px}
  h1{font-size:22px;font-weight:600;margin-bottom:6px;letter-spacing:-0.02em}
  p.sub{color:var(--dim);font-size:13px;margin-bottom:26px}
  label{display:block;font-size:12px;color:var(--dim);margin-bottom:6px;font-family:'JetBrains Mono',monospace;letter-spacing:0.08em}
  input{width:100%;padding:13px 14px;background:rgba(0,0,0,0.3);border:1px solid var(--line);border-radius:10px;color:var(--fg);font-size:14px;font-family:inherit;outline:none}
  input:focus{border-color:var(--accent)}
  button{margin-top:18px;width:100%;padding:13px;background:var(--accent);color:#0a0a0b;font-weight:600;border:none;border-radius:10px;font-family:inherit;font-size:14px;cursor:pointer;transition:transform .2s, box-shadow .2s}
  button:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(163,230,53,0.3)}
  .err{color:var(--err);font-size:12px;margin-top:14px;text-align:center}
  .home{display:block;margin-top:22px;text-align:center;font-size:12px;color:var(--dim);text-decoration:none}
  .home:hover{color:var(--accent)}
</style></head><body>
  <form class="card" method="POST" action="/db">
    <div class="brand">// kiff / db</div>
    <h1>Admin access</h1>
    <p class="sub">Edit the coming-soon page content live.</p>
    <label for="pw">PASSWORD</label>
    <input id="pw" name="password" type="password" autofocus required>
    <button type="submit">Enter dashboard</button>
    ${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
    <a class="home" href="/">← back to site</a>
  </form>
  <script>
    // Also support JSON submit for SPA-ish behaviour; plain form post works too.
    document.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = document.getElementById('pw').value;
      const res = await fetch('/db', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ password: pw })
      });
      if (res.ok) { location.reload(); }
      else { document.querySelector('.err')?.remove(); const d=document.createElement('div'); d.className='err'; d.textContent='Incorrect password. Try again.'; document.querySelector('button').after(d); }
    });
  </script>
</body></html>`;
}

/* ─────────────  Dashboard  ───────────── */
async function renderDashboard(env: Env): Promise<string> {
  let rows: { key: string; value: string; updated_at: string }[] = [];
  let subCount = 0;
  let recent: { email: string; created_at: string }[] = [];
  if (env.DB) {
    try {
      const r1 = await env.DB.prepare('SELECT key, value, updated_at FROM content ORDER BY key;').all();
      rows = (r1.results || []) as any;
      const r2 = await env.DB.prepare('SELECT COUNT(*) as c FROM subscribers;').first<{ c: number }>();
      subCount = r2?.c || 0;
      const r3 = await env.DB.prepare('SELECT email, created_at FROM subscribers ORDER BY id DESC LIMIT 10;').all();
      recent = (r3.results || []) as any;
    } catch (e) {
      console.error('D1 query failed', e);
    }
  }

  // group rows by prefix
  const groups: Record<string, { key: string; value: string }[]> = {};
  for (const r of rows) {
    const prefix = r.key.includes('_') ? r.key.split('_')[0] : 'misc';
    (groups[prefix] = groups[prefix] || []).push({ key: r.key, value: r.value });
  }

  const groupsHtml = Object.keys(groups).sort().map((g) => {
    const items = groups[g].map((it) => `
      <div class="row" data-key="${escapeHtml(it.key)}">
        <div class="row__key">${escapeHtml(it.key)}</div>
        <textarea data-key="${escapeHtml(it.key)}" rows="2">${escapeHtml(it.value)}</textarea>
        <div class="row__actions">
          <button class="btn-save" data-key="${escapeHtml(it.key)}">Save</button>
          <button class="btn-del"  data-key="${escapeHtml(it.key)}">Delete</button>
        </div>
        <div class="row__msg" data-msg="${escapeHtml(it.key)}"></div>
      </div>`).join('');
    return `<section class="group"><h2>${escapeHtml(g)}</h2>${items}</section>`;
  }).join('');

  const recentHtml = recent.length
    ? recent.map((r) => `<tr><td>${escapeHtml(r.email)}</td><td>${escapeHtml(r.created_at)}</td></tr>`).join('')
    : `<tr><td colspan="2" class="empty">No subscribers yet.</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>kiff / db · dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root { --bg:#0a0a0b; --fg:#f4f4f5; --dim:#a1a1aa; --mute:#71717a; --line:rgba(255,255,255,0.1); --accent:#A3E635; --ok:#A3E635; --err:#f87171; --glass:rgba(255,255,255,0.04); }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--fg);font-family:'Space Grotesk',system-ui,sans-serif;line-height:1.5;min-height:100vh}
  header{display:flex;align-items:center;justify-content:space-between;padding:18px clamp(20px,5vw,40px);border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(10,10,11,0.85);backdrop-filter:blur(12px);z-index:10}
  .brand{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent);letter-spacing:0.1em}
  .actions{display:flex;gap:10px;align-items:center}
  .actions a, .actions button{font-size:13px;color:var(--dim);text-decoration:none;padding:7px 12px;border:1px solid var(--line);border-radius:8px;background:none;font-family:inherit;cursor:pointer}
  .actions a:hover, .actions button:hover{color:var(--accent);border-color:var(--accent)}
  main{max-width:1000px;margin:0 auto;padding:32px clamp(20px,5vw,40px)}
  h1{font-size:26px;letter-spacing:-0.02em;margin-bottom:6px}
  .lede{color:var(--dim);font-size:14px;margin-bottom:32px}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:36px}
  .stat{background:var(--glass);border:1px solid var(--line);border-radius:14px;padding:18px 20px}
  .stat__num{font-size:32px;font-weight:600;letter-spacing:-0.02em;color:var(--accent)}
  .stat__label{font-size:12px;color:var(--mute);font-family:'JetBrains Mono',monospace;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px}
  h2{font-size:13px;font-family:'JetBrains Mono',monospace;color:var(--accent);letter-spacing:0.1em;text-transform:uppercase;margin:36px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line)}
  .row{display:grid;grid-template-columns:200px 1fr auto;gap:14px;align-items:start;padding:14px 0;border-bottom:1px solid var(--line)}
  .row__key{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--dim);padding-top:8px;word-break:break-all}
  textarea{width:100%;background:rgba(0,0,0,0.3);border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:10px 12px;font-family:inherit;font-size:13px;resize:vertical;outline:none;min-height:42px}
  textarea:focus{border-color:var(--accent)}
  .row__actions{display:flex;gap:6px}
  .btn-save, .btn-del{font-size:11px;padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:none;color:var(--dim);cursor:pointer;font-family:inherit}
  .btn-save:hover{color:var(--accent);border-color:var(--accent)}
  .btn-del:hover{color:var(--err);border-color:var(--err)}
  .row__msg{grid-column:2/4;font-size:11px;font-family:'JetBrains Mono',monospace;min-height:14px;color:var(--mute)}
  .row__msg.ok{color:var(--ok)}
  .row__msg.err{color:var(--err)}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}
  td, th{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line)}
  th{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--mute);text-transform:uppercase;letter-spacing:0.08em;font-weight:400}
  td.empty{color:var(--mute);text-align:center;padding:24px}
  .add-new{margin-top:20px;padding:18px;background:var(--glass);border:1px dashed var(--line);border-radius:12px;display:grid;grid-template-columns:200px 1fr auto;gap:14px;align-items:center}
  .add-new input, .add-new textarea{background:rgba(0,0,0,0.3);border:1px solid var(--line);border-radius:8px;color:var(--fg);padding:10px 12px;font-family:inherit;font-size:13px;outline:none}
  .add-new input:focus, .add-new textarea:focus{border-color:var(--accent)}
  footer{padding:32px clamp(20px,5vw,40px);border-top:1px solid var(--line);text-align:center;color:var(--mute);font-size:12px}
  @media(max-width:640px){
    .row{grid-template-columns:1fr;gap:8px}
    .row__actions{justify-content:flex-end}
    .row__msg{grid-column:1/-1}
    .add-new{grid-template-columns:1fr}
  }
</style></head><body>
<header>
  <div class="brand">// buildbyte / db</div>
  <div class="actions">
    <a href="/">View site ↗</a>
    <a href="/db?export=subscribers">Export CSV</a>
    <button id="logout">Logout</button>
  </div>
</header>

<main>
  <h1>Dashboard</h1>
  <p class="lede">Edit the content shown on the landing page. Changes go live immediately. Keys are grouped by prefix (hero_, feature_, step_, faq_, footer_).</p>

  <div class="stats">
    <div class="stat"><div class="stat__num">${subCount}</div><div class="stat__label">Subscribers</div></div>
    <div class="stat"><div class="stat__num">${rows.length}</div><div class="stat__label">Content keys</div></div>
    <div class="stat"><div class="stat__num">${recent.length}</div><div class="stat__label">Recent (shown)</div></div>
  </div>

  <h2>Recent subscribers</h2>
  <table><thead><tr><th>Email</th><th>Signed up</th></tr></thead><tbody>${recentHtml}</tbody></table>

  <h2>Content</h2>
  ${groupsHtml || '<p class="lede">No content rows yet. Add one below.</p>'}

  <div class="add-new">
    <input id="new-key" placeholder="new_key (e.g. faq_5_q)">
    <textarea id="new-val" rows="2" placeholder="value…"></textarea>
    <button class="btn-save" id="add-btn">Add</button>
  </div>
</main>

<footer>kiffstudio.in · admin dashboard · all changes are logged in D1</footer>

<script>
  async function call(body) {
    const res = await fetch('/db', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    return res;
  }
  function setMsg(key, text, ok) {
    const m = document.querySelector('[data-msg="'+key+'"]');
    if (!m) return;
    m.textContent = text;
    m.className = 'row__msg ' + (ok ? 'ok' : 'err');
    setTimeout(() => { m.textContent=''; m.className='row__msg'; }, 2500);
  }
  document.querySelectorAll('.btn-save').forEach(b => {
    b.addEventListener('click', async () => {
      const key = b.dataset.key;
      const ta = document.querySelector('textarea[data-key="'+CSS.escape(key)+'"]');
      const res = await call({ action:'update', key, value: ta.value });
      setMsg(key, res.ok ? 'saved ✓' : 'error', res.ok);
    });
  });
  document.querySelectorAll('.btn-del').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Delete "'+b.dataset.key+'"?')) return;
      const res = await call({ action:'delete', key: b.dataset.key });
      if (res.ok) b.closest('.row').remove();
    });
  });
  document.getElementById('add-btn').addEventListener('click', async () => {
    const k = document.getElementById('new-key').value.trim();
    const v = document.getElementById('new-val').value;
    if (!k) return;
    const res = await call({ action:'update', key:k, value:v });
    if (res.ok) location.reload();
  });
  document.getElementById('logout').addEventListener('click', async () => {
    await call({ logout: true });
    location.href = '/db';
  });
</script>
</body></html>`;

  return html;
}
