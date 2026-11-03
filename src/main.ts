/* ─────────────────────────────────────────────────────────────
   kiffstudio.in (Kiff) — front-end interactions
   - Custom cursor (dot + trailing ring)
   - Click ripple particles
   - Scroll-reveal
   - 3D tilt cards
   - Magnetic buttons
   - Three.js floating honeycomb logo
   - Countdown timer
   - Email capture (POST /api/subscribe)
   - Hydrate content from /api/content
   ───────────────────────────────────────────────────────────── */

import * as THREE from 'three';

/* ════════════ 1. Custom cursor ════════════ */
(() => {
  if (matchMedia('(hover: none)').matches) return;
  const dot = document.querySelector<HTMLElement>('.cursor-dot')!;
  const ring = document.querySelector<HTMLElement>('.cursor-ring')!;
  const startX = window.innerWidth / 2;
  const startY = window.innerHeight / 2;
  let mx = startX, my = startY, rx = startX, ry = startY;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  });

  const hoverSel = 'a, button, summary, [data-magnetic], input, .card, details';
  document.addEventListener('mouseover', (e) => {
    if ((e.target as Element).closest(hoverSel)) {
      dot.classList.add('is-hover'); ring.classList.add('is-hover');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if ((e.target as Element).closest(hoverSel)) {
      dot.classList.remove('is-hover'); ring.classList.remove('is-hover');
    }
  });

  // Trailing ring with easing
  function tick() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  }
  tick();
})();

/* ════════════ 2. Click ripple particles ════════════ */
(() => {
  const canvas = document.getElementById('ripple-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize(); window.addEventListener('resize', resize);

  interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; ring: boolean; }
  const ps: P[] = [];

  function spawn(x: number, y: number) {
    // expanding ring
    ps.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.7, r: 4, ring: true });
    // particle burst
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.3;
      const sp = 1.5 + Math.random() * 3;
      ps.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, max: 0.6 + Math.random() * 0.4, r: 1.5 + Math.random() * 2, ring: false,
      });
    }
  }

  window.addEventListener('pointerdown', (e) => {
    // ignore clicks on form inputs / details summary still spawn — they're nice
    spawn(e.clientX, e.clientY);
  });

  let last = performance.now();
  function loop(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) { ps.splice(i, 1); continue; }
      if (p.ring) {
        const r = p.r + t * 60;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(163, 230, 53, ${0.6 * (1 - t)})`;
        ctx.lineWidth = 1.5 * (1 - t);
        ctx.stroke();
      } else {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.96; p.vy *= 0.96;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(163, 230, 53, ${0.9 * (1 - t)})`;
        ctx.fill();
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

/* ════════════ 3. Scroll reveal ════════════ */
(() => {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en, i) => {
      if (en.isIntersecting) {
        const el = en.target as HTMLElement;
        const delay = (el.dataset.delay ? Number(el.dataset.delay) : 0) + (i % 4) * 60;
        setTimeout(() => el.classList.add('is-visible'), delay);
        io.unobserve(el);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach((el) => io.observe(el));
})();

/* ════════════ 4. 3D tilt cards ════════════ */
(() => {
  if (matchMedia('(hover: none)').matches) return;
  const cards = document.querySelectorAll<HTMLElement>('[data-tilt]');
  cards.forEach((card) => {
    const max = 6; // degrees
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${-py * max}deg) rotateY(${px * max}deg) translateY(-2px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
})();

/* ════════════ 5. Magnetic buttons ════════════ */
(() => {
  if (matchMedia('(hover: none)').matches) return;
  const mags = document.querySelectorAll<HTMLElement>('[data-magnetic]');
  const strength = 0.35;
  mags.forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
})();

/* ════════════ 6. Three.js floating honeycomb logo ════════════ */
(() => {
  const canvas = document.getElementById('hero-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  // ── Honeycomb cluster ──
  const group = new THREE.Group();
  scene.add(group);

  const hexShape = new THREE.Shape();
  const r = 1;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) hexShape.moveTo(x, y); else hexShape.lineTo(x, y);
  }
  hexShape.closePath();
  const geo = new THREE.ExtrudeGeometry(hexShape, {
    depth: 0.4, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3,
  });
  geo.center();

  const matFill = new THREE.MeshStandardMaterial({
    color: 0x1a1a1c, metalness: 0.4, roughness: 0.35,
    emissive: 0x101010,
  });
  const matAccent = new THREE.MeshStandardMaterial({
    color: 0xa3e635, metalness: 0.3, roughness: 0.25,
    emissive: 0x3a5a14, emissiveIntensity: 0.6,
  });
  const matWire = new THREE.LineBasicMaterial({ color: 0xa3e635, transparent: true, opacity: 0.4 });

  // central hex (accent)
  const centerHex = new THREE.Mesh(geo, matAccent);
  group.add(centerHex);
  const centerEdges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), matWire);
  centerHex.add(centerEdges);

  // surrounding hexes (arranged in honeycomb pattern)
  const surrounds: THREE.Mesh[] = [];
  const ring = 1.8;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const x = Math.cos(a) * ring, y = Math.sin(a) * ring;
    const m = new THREE.Mesh(geo, matFill);
    m.position.set(x, y, 0);
    m.scale.setScalar(0.55);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), matWire);
    m.add(e);
    group.add(m);
    surrounds.push(m);
  }

  group.rotation.x = -0.5;
  group.position.y = 0.3;

  // ── Particle dust ──
  const pCount = 180;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const rad = 4 + Math.random() * 6;
    const th = Math.random() * Math.PI * 2;
    const ph = (Math.random() - 0.5) * Math.PI;
    pos[i * 3] = Math.cos(th) * Math.cos(ph) * rad;
    pos[i * 3 + 1] = Math.sin(ph) * rad;
    pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * rad - 3;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xa3e635, size: 0.04, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // ── Lighting ──
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xa3e635, 1.2);
  key.position.set(3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(-3, -2, 2); scene.add(fill);

  // ── Camera/cursor parallax ──
  let cx = 0, cy = 0, tcx = 0, tcy = 0;
  window.addEventListener('mousemove', (e) => {
    tcx = (e.clientX / window.innerWidth - 0.5) * 2;
    tcy = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);
  // observe hero resize too
  new ResizeObserver(resize).observe(canvas);

  const clock = new THREE.Clock();
  function animate() {
    const t = clock.getElapsedTime();
    cx += (tcx - cx) * 0.05; cy += (tcy - cy) * 0.05;

    group.rotation.y = t * 0.25 + cx * 0.4;
    group.rotation.x = -0.5 + cy * 0.3 + Math.sin(t * 0.6) * 0.05;
    group.position.y = 0.3 + Math.sin(t * 0.8) * 0.15;

    surrounds.forEach((m, i) => {
      m.position.z = Math.sin(t * 1.2 + i) * 0.25;
    });

    points.rotation.y = t * 0.04;
    points.rotation.x = t * 0.02;

    camera.position.x = cx * 0.6;
    camera.position.y = -cy * 0.4;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ════════════ 7. Countdown timer ════════════ */
(() => {
  // launch date is supplied by the worker via env var; fallback to March 1 next year
  const meta = document.querySelector('meta[name="launch-date"]');
  let launch: Date;
  if (meta && meta.getAttribute('content')) {
    launch = new Date(meta.getAttribute('content')!);
  } else {
    const now = new Date();
    launch = new Date(now.getFullYear() + (now.getMonth() > 2 || (now.getMonth() === 2 && now.getDate() > 1) ? 1 : 0), 2, 1, 0, 0, 0);
  }

  const dEl = document.getElementById('cd-days');
  const hEl = document.getElementById('cd-hours');
  const mEl = document.getElementById('cd-mins');
  const sEl = document.getElementById('cd-secs');
  const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0');

  function tick() {
    const diff = launch.getTime() - Date.now();
    if (diff <= 0) {
      dEl!.textContent = hEl!.textContent = mEl!.textContent = sEl!.textContent = '00';
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    dEl!.textContent = pad(d);
    hEl!.textContent = pad(h);
    mEl!.textContent = pad(m);
    sEl!.textContent = pad(s);
  }
  tick(); setInterval(tick, 1000);
})();

/* ════════════ 8. Email capture ════════════ */
(() => {
  function wire(formId: string, emailId: string, msgId: string) {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const email = document.getElementById(emailId) as HTMLInputElement;
    const msg = document.getElementById(msgId) as HTMLParagraphElement;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = email.value.trim();
      if (!v) return;
      msg.className = 'hero__form-msg';
      msg.textContent = 'Adding you to the list…';
      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: v }),
        });
        const data = (await res.json()) as { message?: string; error?: string };
        if (res.ok) {
          msg.className = 'hero__form-msg is-ok';
          msg.textContent = data.message || "You're on the list. See you at launch.";
          form.reset();
        } else {
          msg.className = 'hero__form-msg is-err';
          msg.textContent = data.error || 'Something went wrong. Try again.';
        }
      } catch {
        msg.className = 'hero__form-msg is-err';
        msg.textContent = 'Network error. Try again.';
      }
    });
  }
  wire('notify-form', 'notify-email', 'notify-msg');
  wire('notify-form-2', 'notify-email-2', 'notify-msg-2');
})();

/* ════════════ 9. Hydrate content from /api/content ════════════ */
(() => {
  fetch('/api/content')
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((raw: unknown) => {
      const data = (raw || {}) as Record<string, string>;
      // text content
      document.querySelectorAll<HTMLElement>('[data-content]').forEach((el) => {
        const k = el.dataset.content!;
        if (data[k] != null) el.textContent = data[k];
      });
      // hero
      const heroTitle = document.getElementById('hero-title');
      if (heroTitle && data.hero_title) {
        heroTitle.innerHTML = data.hero_title.replace(/\bAI\b/g, '<span class="accent">AI</span>');
      }
      const heroSub = document.getElementById('hero-subtitle');
      if (heroSub && data.hero_subtitle) heroSub.textContent = data.hero_subtitle;
      const heroBadge = document.getElementById('hero-badge');
      if (heroBadge && data.hero_badge) heroBadge.textContent = data.hero_badge;
      const ctaInput = document.getElementById('notify-email') as HTMLInputElement;
      if (ctaInput && data.cta_placeholder) ctaInput.placeholder = data.cta_placeholder;
      const ctaBtn = document.getElementById('notify-btn');
      if (ctaBtn && data.cta_button) ctaBtn.textContent = data.cta_button;

      // features
      document.querySelectorAll<HTMLElement>('[data-feature]').forEach((el) => {
        const k = el.dataset.feature!;
        const key = `feature_${k}`;
        if (data[key] != null) el.textContent = data[key];
      });
      // steps
      document.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => {
        const k = el.dataset.step!;
        const key = `step_${k}`;
        if (data[key] != null) el.textContent = data[key];
      });
      // faq
      document.querySelectorAll<HTMLElement>('[data-faq]').forEach((el) => {
        const k = el.dataset.faq!;
        const key = `faq_${k}`;
        if (data[key] != null) el.textContent = data[key];
      });

      // launch date meta (set by worker via header)
    })
    .catch(() => { /* fail silently — fall back to inline defaults */ });

  // launch date from header injected by worker as meta tag — already handled above.
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
