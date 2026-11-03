-- ─────────────────────────────────────────────────────────────
-- Kiff (kiffstudio.in) — D1 schema
-- Apply with:  wrangler d1 execute kiff --file=./schema.sql
-- ─────────────────────────────────────────────────────────────

-- Subscribers captured by the "Notify me" form on the landing page.
CREATE TABLE IF NOT EXISTS subscribers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE,
  ip          TEXT,
  ua          TEXT,
  source      TEXT DEFAULT 'landing',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Editable site content (key/value) managed from /db dashboard.
-- Default rows are seeded below so the site renders out of the box.
CREATE TABLE IF NOT EXISTS content (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Seed content ──────────────────────────────────────────────
INSERT OR IGNORE INTO content (key, value) VALUES
  ('hero_title',       'Drag, Drop, Deploy. Build Websites with AI.'),
  ('hero_subtitle',    'Kiff is a drag-n-drop website builder with a template marketplace, a curated library of free templates, and an AI Studio powered by Claude Code, Codex, GLM 5.2, Grok and more. No code. No servers. Free to start.'),
  ('hero_badge',       'Coming soon · Spring 2027'),
  ('cta_placeholder',  'you@domain.com'),
  ('cta_button',       'Notify me at launch'),

  ('feature_1_title',  'Drag-n-Drop Editor'),
  ('feature_1_desc',   'Build pages by dragging blocks — sections, text, images, forms, embeds. Full visual control, zero code.'),
  ('feature_2_title',  'Template Marketplace'),
  ('feature_2_desc',   'Buy premium templates from creators worldwide — or list your own and keep 85% of every sale, paid monthly via Stripe.'),
  ('feature_3_title',  'Free Templates'),
  ('feature_3_desc',   'Start from a curated free template — portfolio, store, landing, blog. Clone, customize, and ship in minutes.'),
  ('feature_4_title',  'AI Studio'),
  ('feature_4_desc',   'Claude Code, Codex, GLM 5.2, Grok — and more. Pick the right model for each task and build entire sites from a single prompt.'),

  ('step_1_title',     'Pick a template'),
  ('step_1_desc',      'Start from a free template, a marketplace purchase, or a blank canvas. Or just describe what you want to the AI.'),
  ('step_2_title',     'Customize in the editor'),
  ('step_2_desc',      'Drag blocks, tweak copy, drop in images. Ask the AI to redesign a section, generate a hero, or write the copy for you.'),
  ('step_3_title',     'Publish with one click'),
  ('step_3_desc',      'Live on a free kiffstudio.in subdomain or your own custom domain in seconds. SSL and global CDN included.'),

  ('faq_1_q',          'Is Kiff free?'),
  ('faq_1_a',          'Yes. Building, publishing, and hosting on a kiffstudio.in subdomain is free forever. Premium templates and AI usage beyond the free monthly quota are paid.'),
  ('faq_2_q',          'Do I need to know how to code?'),
  ('faq_2_a',          'No. Drag blocks in the editor or describe what you want to the AI. A visual editor handles the rest. You can also export the full HTML/CSS/TS source anytime.'),
  ('faq_3_q',          'Which AI models power the Studio?'),
  ('faq_3_a',          'Claude Code (Anthropic), Codex / GPT (OpenAI), GLM 5.2 (Z.ai), and Grok (xAI) — with more providers coming. Pick the right model for each task, or let Kiff choose.'),
  ('faq_4_q',          'Can I sell my templates?'),
  ('faq_4_a',          'Yes. Anyone can list templates on the marketplace. Creators keep 85% of every sale, paid out monthly via Stripe Connect.'),

  ('footer_tagline',   'Built on Cloudflare. Powered by AI.'),
  ('footer_twitter',   'https://twitter.com/kiffstudio'),
  ('footer_github',    'https://github.com/kiffstudio'),
  ('footer_discord',   'https://discord.gg/kiffstudio'),
  ('footer_copyright', 'Kiff Studio');

-- ── Helpful index ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscribers_created ON subscribers(created_at);
