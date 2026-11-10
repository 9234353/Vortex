/* VORTEX site: GSAP 3 + ScrollTrigger + Lenis
   =========================================================
   Editable settings
   ========================================================= */
const IDLE_SECONDS = 30;   // auto-tour starts after this many seconds with no input
const TOUR_SPEED   = 70;   // auto-tour scroll speed, in pixels per second
const SECTORS = { '00': 'Home', '01': 'About', '02': 'The Car', '03': 'Test Chamber', '04': 'Engineering',
                  '05': 'Team', '06': 'Results', '07': 'Sponsors', '08': 'Contact' };

(function () {
  document.documentElement.classList.add('js');
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ink = () => root.dataset.theme === 'light' ? '10,10,10' : '255,255,255';   // line colour for canvases

  if (!window.gsap) { root.classList.remove('js'); const p = $('preloader'); if (p) p.remove(); return; }
  gsap.registerPlugin(ScrollTrigger);

  // State shared between features
  let menuOpen = false, busy = false, tunnelActive = false;

  // ---- Smooth scroll (Lenis) ----
  let lenis;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const jumpTo = target => {
    if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
    else if (target === 0) window.scrollTo(0, 0);
    else if (target instanceof Element) target.scrollIntoView();
    ScrollTrigger.update();
  };

  // ---- Split hero title into letters ----
  const title = $('heroTitle');
  title.innerHTML = [...title.textContent].map(c => `<span class="ch">${c}</span>`).join('');

  // ---- Split big headlines into words (masked slide-up) ----
  function splitWords(el) {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(w => {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return; }
            const m = document.createElement('span'); m.className = 'line-mask'; m.style.display = 'inline-block';
            const i = document.createElement('span'); i.className = 'line-in'; i.textContent = w;
            m.appendChild(i); frag.appendChild(m);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  }
  document.querySelectorAll('.split').forEach(el => {
    splitWords(el);
    if (reduce) return;
    const words = el.querySelectorAll('.line-in');
    gsap.set(words, { yPercent: 110 });
    gsap.to(words, { yPercent: 0, duration: 1, stagger: .035, ease: 'power4.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });

  // ---- Hero: canvas particle stream (bends around the mouse, speeds up with scroll) ----
  (function heroFlow() {
    const cv = $('heroFlow'); if (!cv) return;
    const ctx = cv.getContext('2d'), host = cv.parentElement;
    const N = touch ? 60 : 150;
    let W = 0, H = 0, visible = true, boost = 1, boostT = 1, mx = -9999, my = -9999;
    const pts = [];
    const rnd = (a, b) => a + Math.random() * (b - a);
    function size() { const r = host.getBoundingClientRect(); W = cv.width = Math.floor(r.width); H = cv.height = Math.floor(r.height); }
    size(); addEventListener('resize', size);
    for (let i = 0; i < N; i++) pts.push({ x: rnd(0, W), y: rnd(0, H), s: rnd(.6, 1.6), red: i % 6 === 0, vx: 1, vy: 0 });
    host.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    host.addEventListener('pointerleave', () => { mx = my = -9999; });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(cv);
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: s => { boostT = 1 + Math.min(Math.abs(s.getVelocity()) / 500, 2.5); } });
    function tick(time, dtMs) {
      if (!visible || document.hidden) return;
      const k = Math.min(dtMs || 16.7, 50) / 16.7;                       // frame-rate independent
      boostT += (1 - boostT) * .03; boost += (boostT - boost) * .1;
      ctx.clearRect(0, 0, W, H); ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      const col = ink();
      for (const p of pts) {
        let vx = 1.6 * boost * p.s, vy = Math.sin(p.x * .01 + p.y * .02) * .3;
        const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
        if (d < 160 && d > .1) { const f = (1 - d / 160) * 4; vx += dx / d * f; vy += dy / d * f; }
        p.x += vx * k; p.y += vy * k;
        if (p.x > W + 10 || p.y < -10 || p.y > H + 10) { p.x = -10; p.y = rnd(0, H); }
        ctx.strokeStyle = p.red ? 'rgba(225,6,0,.6)' : `rgba(${col},.28)`;
        ctx.beginPath(); ctx.moveTo(p.x - vx * 7, p.y - vy * 7); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
    }
    if (!reduce) gsap.ticker.add(tick); else tick();
  })();

  // ---- Blobs drift, but only while the hero is on screen ----
  // Moving blobs force every glass panel above them to re-blur each frame, which is the
  // single most expensive thing on the page, so they hold still once you scroll past.
  if (!reduce) {
    const blobTweens = [
      gsap.to('.b1', { x: 120, y: 80, duration: 12, repeat: -1, yoyo: true, ease: 'sine.inOut' }),
      gsap.to('.b2', { x: -100, y: -60, duration: 14, repeat: -1, yoyo: true, ease: 'sine.inOut' }),
      gsap.to('.b3', { x: 80, y: -90, duration: 16, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    ];
    new IntersectionObserver(([en]) => blobTweens.forEach(tw => en.isIntersecting ? tw.play() : tw.pause())).observe(document.querySelector('.hero'));
  }

  // ---- Marquee (speeds up and flips with scroll) ----
  if (!reduce) {
    const mq = gsap.to('#marquee', { xPercent: -50, duration: 28, repeat: -1, ease: 'none' });
    let mqTarget = 1;
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: s => { const v = s.getVelocity(); mqTarget = (v < 0 ? -1 : 1) * (1 + Math.min(Math.abs(v) / 250, 8)); } });
    gsap.ticker.add(() => { mqTarget += ((mqTarget < 0 ? -1 : 1) - mqTarget) * .04; mq.timeScale(mq.timeScale() + (mqTarget - mq.timeScale()) * .12); });
  }

  // ---- Preloader then intro ----
  const num = $('preNum'), bar = $('preBar'), counter = { v: 0 };
  const intro = gsap.timeline({ paused: true });
  intro
    .to('.preloader', { yPercent: -100, duration: .9, ease: 'power4.inOut' })
    .to('.mask-title .ch', { y: 0, duration: 1, stagger: .06, ease: 'power4.out' }, '-=.3')
    .to('#heroLine', { scaleX: 1, duration: 1, ease: 'power3.inOut' }, '-=.6')
    .from('.corner', { scale: 0, opacity: 0, duration: .8, stagger: .08, ease: 'back.out(2)' }, '-=.9')
    .from('.race-no', { opacity: 0, x: 80, duration: 1.2, ease: 'power3.out' }, '-=.8')
    .to('.hero .fade-in', { opacity: 1, y: 0, duration: .8, stagger: .12 }, '-=.9')
    .from('#nav', { yPercent: -200, opacity: 0, duration: .8, ease: 'power3.out' }, '-=.8')
    .from('#hud', { y: 30, opacity: 0, duration: .6 }, '-=.4');
  gsap.to(counter, { v: 100, duration: reduce ? .1 : 1.6, ease: 'power2.inOut',
    onUpdate() { const v = Math.round(counter.v); num.textContent = v; bar.style.width = v + '%'; },
    onComplete() { intro.play(); } });

  // ---- Scroll progress ----
  gsap.to('#progress', { scaleX: 1, ease: 'none', scrollTrigger: { scrub: .3, start: 0, end: 'max' } });

  // ---- Reveals (cards and timeline rows fly in from alternating sides) ----
  document.querySelectorAll('.card, .tl').forEach((el, i) => { el.dataset.dir = (i % 2 ? 1 : -1); });
  gsap.utils.toArray('.reveal').forEach(el => {
    const dir = parseFloat(el.dataset.dir);
    if (dir && !reduce) {
      gsap.fromTo(el, { opacity: 0, x: dir * 220, y: 40, rotate: dir * 5 },
        { opacity: 1, x: 0, y: 0, rotate: 0, duration: 1.1, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      return;
    }
    gsap.to(el, { opacity: 1, y: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  // Hero exits by shrinking and sliding away as you scroll
  if (!reduce) {
    gsap.to('.hero-in', { scale: .82, opacity: 0, yPercent: -14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.race-no', { xPercent: 40, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.utils.toArray('.img-reveal').forEach(el => {
      gsap.fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.3, ease: 'power4.inOut', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });
  }

  // ---- Counters ----
  document.querySelectorAll('[data-count]').forEach(el => {
    const end = parseFloat(el.dataset.count), dec = String(end).includes('.') ? 1 : 0, o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () =>
      gsap.to(o, { v: end, duration: 1.8, ease: 'power2.out', onUpdate: () => el.textContent = o.v.toFixed(dec) }) });
  });

  // ---- Car: pinned section, specs highlight in sequence, image parallax ----
  const specs = gsap.utils.toArray('.spec');
  const carEnd = '+=' + (specs.length * 40) + '%';
  ScrollTrigger.create({ trigger: '.car', start: 'top top', end: carEnd, pin: '.car-pin', scrub: true, refreshPriority: 3,
    onUpdate: s => { const i = Math.min(specs.length - 1, Math.floor(s.progress * specs.length)); specs.forEach((el, k) => el.classList.toggle('active', k === i)); } });
  gsap.fromTo('.car-img img', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.car', start: 'top top', end: carEnd, scrub: true } });

  // Car showcase: tilt toward the cursor, layered parallax, hotspot tooltips
  (function carShowcase() {
    const stage = $('carStage'); if (!stage) return;
    if (!touch && !reduce) {
      const img = stage.querySelector('img');
      const rx = gsap.quickTo(stage, 'rotationX', { duration: .5 }), ry = gsap.quickTo(stage, 'rotationY', { duration: .5 });
      const ix = gsap.quickTo(img, 'x', { duration: .6 });
      stage.addEventListener('pointermove', e => { const r = stage.getBoundingClientRect(); const nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5; ry(nx * 10); rx(-ny * 8); ix(nx * -16); });
      stage.addEventListener('pointerleave', () => { rx(0); ry(0); ix(0); });
    }
    stage.querySelectorAll('.hotspot').forEach(h => {
      const b = h.querySelector('button');
      b.addEventListener('click', e => { e.stopPropagation(); const open = h.classList.toggle('open'); b.setAttribute('aria-expanded', open); });
    });
    document.addEventListener('click', () => stage.querySelectorAll('.hotspot.open').forEach(h => { h.classList.remove('open'); h.querySelector('button').setAttribute('aria-expanded', 'false'); }));
  })();

  // ---- Horizontal gallery (pinned) ----
  const track = $('galTrack');
  if (track && !reduce) {
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '#gallery', start: 'top top', end: () => '+=' + dist(), pin: '.gal-pin', scrub: true, invalidateOnRefresh: true, refreshPriority: 1 } });
  } else if (track) track.parentElement.style.overflowX = 'auto';

  // ---- Engineering: the whole page slides sideways (3 full-screen panels) ----
  const hTrack = $('hTrack');
  if (hTrack && !reduce) {
    const hDist = () => Math.max(0, hTrack.scrollWidth - innerWidth), hEnd = () => '+=' + hDist();
    gsap.to(hTrack, { x: () => -hDist(), ease: 'none', scrollTrigger: { trigger: '#hsteps', start: 'top top', end: hEnd, pin: '.hpin', scrub: true, invalidateOnRefresh: true, refreshPriority: 2 } });
    gsap.to('#hLine', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '#hsteps', start: 'top top', end: hEnd, scrub: true, invalidateOnRefresh: true } });
  } else if (hTrack) hTrack.parentElement.style.overflowX = 'auto';

  // ---- Chapter indicator + HUD sector ----
  const chapNow = $('chapNow'), hudSec = $('hudSec');
  document.querySelectorAll('[data-chap]').forEach(sec => {
    const set = () => { chapNow.textContent = sec.dataset.chap; if (hudSec) hudSec.textContent = sec.dataset.sector || SECTORS[sec.dataset.chap] || ''; };
    ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onEnter: set, onEnterBack: set });
  });

  // ---- Chapters menu ----
  const menu = $('menu'), menuBtn = $('menuBtn'), menuLinks = menu.querySelectorAll('.menu-list a');
  const menuTl = gsap.timeline({ paused: true, onReverseComplete() { gsap.set(menu, { visibility: 'hidden' }); } });
  menuTl
    .set(menu, { visibility: 'visible' })
    .fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: .7, ease: 'power4.inOut' })
    .fromTo(menuLinks, { yPercent: 110 }, { yPercent: 0, duration: .7, stagger: .06, ease: 'power4.out' }, '-=.3')
    .fromTo('.menu-foot', { opacity: 0 }, { opacity: 1, duration: .5 }, '-=.3');
  function setMenu(open, instant) {
    menuOpen = open;
    menuBtn.setAttribute('aria-expanded', open);
    menu.setAttribute('aria-hidden', !open);
    menuBtn.querySelector('.mb-txt').textContent = open ? 'Close' : 'Chapters';
    if (lenis) open ? lenis.stop() : lenis.start();
    if (instant) { open ? menuTl.progress(1) : (menuTl.progress(0), gsap.set(menu, { visibility: 'hidden' })); }
    else open ? menuTl.play() : menuTl.reverse();
  }
  menuBtn.addEventListener('click', () => setMenu(!menuOpen));
  addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  // ---- Page transition: chequered ribbons (+ F1 car on odd chapters) ----
  const curtain = $('curtain'), flag = $('flag'), car = $('f1car'), curLabel = $('curLabel'), curNum = $('curNum'), curName = $('curName');
  gsap.set(curLabel, { xPercent: -50, yPercent: -50 });
  const ROWS = 8, strips = [];
  for (let i = 0; i < ROWS; i++) { const s = document.createElement('i'); s.className = 'strip'; flag.appendChild(s); strips.push(s); }

  function go(target, name, number) {
    if (busy) return; busy = true;
    const resolve = () => { jumpTo(target === 'top' ? 0 : target); ScrollTrigger.refresh(); };
    if (reduce) { setMenu(false, true); resolve(); busy = false; return; }
    curNum.textContent = number || ''; curName.textContent = name || '';
    const w = innerWidth, h = innerHeight, sq = Math.ceil(h / ROWS);
    strips.forEach((s, i) => { s.style.height = sq + 'px'; s.style.backgroundSize = (sq * 2) + 'px ' + (sq * 2) + 'px'; s.style.backgroundPosition = '0 ' + (i % 2 ? -sq : 0) + 'px'; });
    const span = flag.offsetWidth + 60;
    const withCar = (parseInt(number, 10) || 0) % 2 === 1;
    gsap.set(curtain, { visibility: 'visible' }); gsap.set(curLabel, { opacity: 0 }); gsap.set(car, { display: withCar ? 'block' : 'none' });
    const tl = gsap.timeline({ onComplete() { gsap.set(curtain, { visibility: 'hidden' }); busy = false; } });
    if (withCar) {
      const carW = car.getBoundingClientRect().width;
      gsap.set(strips, { x: span }); gsap.set(car, { x: w + 40, yPercent: -50 });
      tl.to(car, { x: -carW - 60, duration: 1.05, ease: 'power2.inOut' }, 0)
        .fromTo(car.querySelectorAll('.wheel'), { rotation: 0 }, { rotation: -1080, transformOrigin: '50% 50%', duration: 1.05, ease: 'none' }, 0)
        .to(strips, { x: 0, duration: .7, ease: 'power3.inOut', stagger: { each: .04, from: 'center' } }, .2);
    } else {
      gsap.set(strips, { x: i => (i % 2 ? span : -span) });
      tl.to(strips, { x: 0, duration: .75, ease: 'power4.inOut', stagger: { each: .05, from: 'start' } });
    }
    tl.add(() => { if (menuOpen) setMenu(false, true); resolve(); })
      .fromTo(curLabel, { opacity: 0, scale: .9 }, { opacity: 1, scale: 1, duration: .35, ease: 'power3.out' })
      .to({}, { duration: .3 })
      .to(curLabel, { opacity: 0, duration: .2 });
    if (withCar) tl.to(strips, { x: -span, duration: .7, ease: 'power3.inOut', stagger: { each: .04, from: 'center' } });
    else tl.to(strips, { x: i => (i % 2 ? -span : span), duration: .75, ease: 'power4.inOut', stagger: { each: .05, from: 'end' } });
  }
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); e.preventDefault();
    if (id === '#top') return go('top', a.dataset.chapter || 'Home', a.dataset.num || '00');
    const t = document.querySelector(id); if (t) go(t, a.dataset.chapter || '', a.dataset.num || '');
  }));

  // ---- Micro-interactions: glass light, 3D tilt, press feedback ----
  document.querySelectorAll('.glass').forEach(g => g.addEventListener('pointermove', e => {
    const r = g.getBoundingClientRect(); g.style.setProperty('--mx', (e.clientX - r.left) + 'px'); g.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));
  if (!touch && !reduce) {
    document.querySelectorAll('.tilt').forEach(el => {
      const rx = gsap.quickTo(el, 'rotationX', { duration: .45 }), ry = gsap.quickTo(el, 'rotationY', { duration: .45 });
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); const nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5; ry(nx * 8); rx(-ny * 8); });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }
  if (!reduce) document.querySelectorAll('.btn, .tilt, .menu-btn, .icon-btn, .seg button').forEach(el => {
    el.addEventListener('pointerdown', () => gsap.to(el, { scale: .96, duration: .12 }));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => gsap.to(el, { scale: 1, duration: .5, ease: 'elastic.out(1,.5)' })));
  });

  // ---- Custom cursor + magnetic buttons ----
  if (!touch && !reduce) {
    const c = $('cursor'), ring = $('cursorRing');
    const cx = gsap.quickTo(c, 'x', { duration: .1 }), cy = gsap.quickTo(c, 'y', { duration: .1 });
    const rx = gsap.quickTo(ring, 'x', { duration: .35 }), ry = gsap.quickTo(ring, 'y', { duration: .35 });
    addEventListener('mousemove', e => { cx(e.clientX); cy(e.clientY); rx(e.clientX); ry(e.clientY); });
    document.querySelectorAll('a,button,input,textarea,.card,.gal-item,.tcar').forEach(el => {
      el.addEventListener('mouseenter', () => ring.classList.add('big'));
      el.addEventListener('mouseleave', () => ring.classList.remove('big'));
    });
    document.querySelectorAll('.magnetic').forEach(b => {
      b.addEventListener('mousemove', e => { const r = b.getBoundingClientRect(); gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * .35, y: (e.clientY - r.top - r.height / 2) * .35, duration: .3 }); });
      b.addEventListener('mouseleave', () => gsap.to(b, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1,.4)' }));
    });
  }

  // =========================================================
  // TEST CHAMBER: interactive wind tunnel on a canvas
  // Flow = uniform wind + potential flow around the car (an ellipse) + a
  // turbulent wake + a "smoke wand" repulsion around the cursor.
  // =========================================================
  (function windTunnel() {
    const box = $('tunnel'); if (!box) return;
    const cv = $('tunnelCanvas'), ctx = cv.getContext('2d'), carEl = $('tcar');
    const fans = box.querySelectorAll('.fan');
    const sSpeed = $('tSpeed'), sWing = $('tWing'), vSpeed = $('tSpeedV'), vWing = $('tWingV');
    const rDrag = $('rDrag'), rDown = $('rDown'), rRun = $('rRun');
    const LINES = touch ? 70 : 150, TRAIL = 36;        // how many smoke lines, and how long each trail is
    let W = 0, H = 0, view = 'smoke', U = .8, wing = 8, rideY = 0, on = false, visible = false, alpha = 0, t = 0, mx = -9999, my = -9999;
    let carBox = { cx: 0, cy: 0, a: 1, b: 1 };
    const parts = [];

    function measureCar() {
      const c = cv.getBoundingClientRect(), k = carEl.getBoundingClientRect();
      carBox = { cx: k.left - c.left + k.width / 2, cy: k.top - c.top + k.height / 2, a: k.width * .5, b: k.height * .46 };
    }
    function spawn(p, fresh) { p.x = fresh ? Math.random() * W : -4; p.y = p.row; p.trail = []; }
    function seed() {
      parts.length = 0; const n = view === 'particles' ? LINES * 2 : LINES;
      for (let i = 0; i < n; i++) { const p = { row: (i + .5) / n * H, bright: i % 4 === 0 }; spawn(p, true); parts.push(p); }
    }
    function size() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
      W = Math.floor(r.width); H = Math.floor(r.height); cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      measureCar(); seed();
    }
    // Velocity at a point: uniform wind, potential flow round the car body (treated as an
    // ellipse, so the air stagnates at the nose and speeds up over the top), a slower,
    // turbulent wake with downwash behind the rear wing, and a push away from the cursor.
    function field(x, y) {
      const { cx, cy, a, b } = carBox;
      const dx = (x - cx) / a, dy = (y - cy) / b, r2 = dx * dx + dy * dy;
      let vx = 1, vy = 0;
      if (r2 > 1) { const r4 = r2 * r2; vx = 1 - (dx * dx - dy * dy) / r4; vy = (-2 * dx * dy / r4) * (b / a); }
      const wa = wing / 20;
      if (dx > .5 && Math.abs(dy) < 2.2) {
        const decay = Math.exp(-(dx - .5) * .7), lat = Math.exp(-dy * dy * .8);
        vy += (wa * .45 + Math.sin(x * .05 - t * 3.2 + y * .04) * .3 * (.4 + wa)) * decay * lat;
        vx += (Math.cos(x * .04 - t * 2.4) * .12 - .25 * (1 - wa * .5)) * decay * lat;
      }
      const mdx = x - mx, mdy = y - my, md = Math.hypot(mdx, mdy);
      if (md < 90 && md > .1) { const f = (1 - md / 90) * 1.6; vx += mdx / md * f; vy += mdy / md * f; }
      return [vx, vy];
    }
    function step(dt) {
      t += dt * U; const spd = 140 * U * dt;              // pixels per second at wind speed U
      const { cx, cy, a, b } = carBox;
      for (const p of parts) {
        const [vx, vy] = field(p.x, p.y); p.x += vx * spd; p.y += vy * spd;
        // lines slide along the body surface instead of disappearing into it
        const dx = (p.x - cx) / a, dy = (p.y - cy) / b, r2 = dx * dx + dy * dy;
        if (r2 < 1.02) { const k = 1.02 / (Math.sqrt(r2) || 1e-3); p.x = cx + dx * k * a; p.y = cy + dy * k * b; if (Math.abs(vx) + Math.abs(vy) < .05) p.y += dy >= 0 ? .6 : -.6; }
        if (view !== 'particles') { p.trail.push(p.x, p.y); if (p.trail.length > TRAIL * 2) p.trail.splice(0, 2); }
        if (p.x > W + 4 || p.y < -4 || p.y > H + 4) spawn(p, false);
      }
    }
    function drawPressure(col) {
      const cell = 16;
      for (let y = cell / 2; y < H; y += cell) for (let x = cell / 2; x < W; x += cell) {
        const dx = (x - carBox.cx) / carBox.a, dy = (y - carBox.cy) / carBox.b; if (dx * dx + dy * dy < 1) continue;
        const [vx, vy] = field(x, y), cp = 1 - (vx * vx + vy * vy); if (Math.abs(cp) < .06) continue;
        ctx.fillStyle = cp > 0 ? `rgba(225,6,0,${Math.min(cp, 1) * .6 * alpha})` : `rgba(${col},${Math.min(-cp / 3, 1) * .28 * alpha})`;
        ctx.fillRect(x - cell / 2, y - cell / 2, cell, cell);
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H); const col = ink();
      if (view === 'pressure') drawPressure(col);
      if (view === 'particles') { ctx.fillStyle = `rgba(${col},${.7 * alpha})`; for (const p of parts) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, 6.283); ctx.fill(); } return; }
      ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const base = view === 'pressure' ? .14 : .3;
      for (let pass = 0; pass < 2; pass++) {                  // dim lines first, then the brighter every-fourth line
        ctx.strokeStyle = `rgba(${col},${(pass ? base * 1.9 : base) * alpha})`;
        ctx.beginPath();
        for (const p of parts) { if ((p.bright ? 1 : 0) !== pass) continue; const tr = p.trail; if (tr.length < 4) continue; ctx.moveTo(tr[0], tr[1]); for (let i = 2; i < tr.length; i += 2) ctx.lineTo(tr[i], tr[i + 1]); }
        ctx.stroke();
      }
    }
    function readouts(animate) {
      const v = U * 20, ride = rideY / (H * .22);                            // ride: -1 (low) to 1 (high)
      const drag = .011 * v * v * (1 + wing / 25) * (1 + ride * .08);
      const down = .016 * v * v * (.25 + wing / 12);
      const run = clamp(.95 + drag * .012 - Math.min(down, 30) * .0025 + ride * .03, .85, 1.6);
      const vals = { drag, down, run };
      if (animate && !reduce) { const o = { drag: 0, down: 0, run: 0 }; gsap.to(o, { ...vals, duration: 1.4, ease: 'power2.out', onUpdate: () => { rDrag.textContent = o.drag.toFixed(1); rDown.textContent = o.down.toFixed(1); rRun.textContent = o.run.toFixed(2); } }); return; }
      rDrag.textContent = drag.toFixed(1); rDown.textContent = down.toFixed(1); rRun.textContent = run.toFixed(2);
    }
    function staticFrame() { for (let i = 0; i < 300; i++) step(1 / 60); draw(); }

    // Fans spin up when the tunnel switches on, and follow the wind-speed slider
    const fanTw = gsap.to(fans, { rotation: '+=360', duration: .6, repeat: -1, ease: 'none', transformOrigin: '50% 50%', paused: true });
    function setWing() { gsap.to('#tFront', { rotation: wing * .9, transformOrigin: '100% 50%', duration: .4 }); gsap.to('#tRear', { rotation: wing * .9, transformOrigin: '0% 50%', duration: .4 }); }

    size(); setWing(); readouts(false);
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(box); else addEventListener('resize', size);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(box);
    ScrollTrigger.create({ trigger: box, start: 'top 75%', once: true, onEnter() {
      on = true;
      if (reduce) { alpha = 1; staticFrame(); readouts(false); return; }
      fanTw.play(); gsap.fromTo(fanTw, { timeScale: 0 }, { timeScale: U, duration: 1.5 });
      gsap.to({ a: 0 }, { a: 1, duration: 1.4, onUpdate() { alpha = this.targets()[0].a; } });
      readouts(true);
    } });

    // Cursor as a smoke wand
    box.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    box.addEventListener('pointerleave', () => { mx = my = -9999; });

    // Drag the car up or down (ride height)
    let dragging = false, startY = 0, startRide = 0;
    carEl.addEventListener('pointerdown', e => { dragging = true; tunnelActive = true; startY = e.clientY; startRide = rideY; carEl.setPointerCapture(e.pointerId); e.preventDefault(); });
    carEl.addEventListener('pointermove', e => {
      if (!dragging) return; const lim = H * .22;
      rideY = clamp(startRide + (e.clientY - startY), -lim, lim); gsap.set(carEl, { y: rideY }); measureCar(); readouts(false);
      if (reduce) staticFrame();
    });
    ['pointerup', 'pointercancel'].forEach(ev => carEl.addEventListener(ev, () => { dragging = false; tunnelActive = false; }));

    // Sliders and flow view
    const onSpeed = () => { U = sSpeed.value / 100; vSpeed.textContent = Math.round(U * 20) + ' m/s'; gsap.to(fanTw, { timeScale: U, duration: .4 }); readouts(false); if (reduce) staticFrame(); };
    const onWing = () => { wing = +sWing.value; vWing.textContent = wing + '°'; setWing(); readouts(false); if (reduce) staticFrame(); };
    sSpeed.addEventListener('input', onSpeed); sWing.addEventListener('input', onWing);
    [sSpeed, sWing].forEach(s => { s.addEventListener('pointerdown', () => tunnelActive = true); s.addEventListener('focus', () => tunnelActive = true); s.addEventListener('blur', () => tunnelActive = false); });
    addEventListener('pointerup', () => { if (!dragging) tunnelActive = document.activeElement === sSpeed || document.activeElement === sWing; });
    box.parentElement.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
      box.parentElement.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b));
      view = b.dataset.view; seed(); if (reduce) staticFrame();
    }));
    onSpeed();

    gsap.ticker.add((time, dtMs) => { if (!on || !visible || document.hidden || reduce) return; step(Math.min(dtMs || 16.7, 50) / 1000); draw(); });
  })();

  // ---- Spec explorer (illustrative numbers) ----
  (function specLab() {
    const sw = $('sWeight'), sb = $('sBase'); if (!sw || !sb) return;
    const out = $('sRun'), barEl = $('sBar'), wv = $('sWeightV'), bv = $('sBaseV');
    const o = { v: 1.02 };
    function calc() {
      const w = +sw.value, b = +sb.value; wv.textContent = w + ' g'; bv.textContent = b + ' mm';
      const run = .92 + (w - 45) * .0062 + Math.abs(b - 128) * .0014;
      gsap.to(o, { v: run, duration: reduce ? 0 : .5, ease: 'power2.out', onUpdate: () => out.textContent = o.v.toFixed(2) });
      barEl.style.width = (clamp((1.5 - run) / (1.5 - .85), 0, 1) * 100) + '%';
    }
    [sw, sb].forEach(s => { s.addEventListener('input', calc); s.addEventListener('pointerdown', () => tunnelActive = true); s.addEventListener('blur', () => tunnelActive = false); });
    calc();
  })();

  // ---- Results chart (hover for details, line draws on scroll) ----
  (function chart() {
    const box = $('chart'); if (!box) return;
    const esc = s => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    const data = (box.dataset.designs || '').split(',').map(s => { const i = s.lastIndexOf(':'); return { n: s.slice(0, i).trim(), v: parseFloat(s.slice(i + 1)) }; }).filter(d => d.n && !isNaN(d.v));
    if (data.length < 2) return;
    const target = parseFloat(box.dataset.target);
    const W = 600, H = 240, P = { l: 44, r: 20, t: 20, b: 34 };
    const vals = data.map(d => d.v).concat(isNaN(target) ? [] : [target]);
    const min = Math.min(...vals) - .04, max = Math.max(...vals) + .04;
    const X = i => P.l + i * (W - P.l - P.r) / (data.length - 1), Y = v => H - P.b - (v - min) / (max - min) * (H - P.t - P.b);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Run time by design">`;
    for (let k = 0; k <= 4; k++) { const v = min + (max - min) * k / 4, y = Y(v).toFixed(1); s += `<line class="cgrid" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/><text x="${P.l - 8}" y="${+y + 4}" text-anchor="end">${v.toFixed(2)}</text>`; }
    if (!isNaN(target)) s += `<line class="cgrid ctarget" x1="${P.l}" x2="${W - P.r}" y1="${Y(target)}" y2="${Y(target)}"/><text x="${W - P.r}" y="${Y(target) - 6}" text-anchor="end">target ${target} s</text>`;
    s += `<path class="cline" d="${data.map((d, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(d.v).toFixed(1)).join(' ')}"/>`;
    data.forEach((d, i) => { s += `<text x="${X(i)}" y="${H - 10}" text-anchor="middle">${esc(d.n)}</text><circle class="cpt" data-i="${i}" tabindex="0" cx="${X(i)}" cy="${Y(d.v)}" r="5"><title>${esc(d.n)}: ${d.v.toFixed(2)} s</title></circle>`; });
    s += `</svg><div class="ctip glass" id="chartTip"></div>`;
    box.insertAdjacentHTML('beforeend', s);
    const svg = box.querySelector('svg'), tip = $('chartTip'), pts = box.querySelectorAll('.cpt'), line = box.querySelector('.cline');
    if (!reduce) {
      const len = line.getTotalLength(); line.style.strokeDasharray = len; line.style.strokeDashoffset = len;
      gsap.to(line, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.out', scrollTrigger: { trigger: box, start: 'top 80%', once: true } });
      gsap.from(pts, { scale: 0, transformOrigin: '50% 50%', stagger: .12, duration: .5, ease: 'back.out(2)', scrollTrigger: { trigger: box, start: 'top 80%', once: true } });
    }
    function show(i) {
      pts.forEach((p, k) => p.classList.toggle('on', k === i));
      const r = pts[i].getBoundingClientRect(), c = box.getBoundingClientRect();
      tip.innerHTML = `<b>${data[i].v.toFixed(2)} s</b> · ${esc(data[i].n)}`;
      tip.style.left = (r.left + r.width / 2 - c.left) + 'px'; tip.style.top = (r.top - c.top) + 'px'; tip.classList.add('show');
    }
    const hide = () => { tip.classList.remove('show'); pts.forEach(p => p.classList.remove('on')); };
    svg.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W; let best = 0, bd = 1e9; data.forEach((d, i) => { const dd = Math.abs(X(i) - x); if (dd < bd) { bd = dd; best = i; } }); show(best); });
    svg.addEventListener('pointerleave', hide);
    pts.forEach(p => { p.addEventListener('focus', () => show(+p.dataset.i)); p.addEventListener('blur', hide); });
  })();

  // ---- HUD: speed, gear and lap progress from your scrolling ----
  let hudSpeed = 0;
  (function hud() {
    const spd = $('hudSpd'), gear = $('hudGear'), lap = $('hudLap'); if (!spd) return;
    let target = 0, lastSpd = -1, lastGear = '', lastLap = -1;
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: s => {
      target = Math.min(Math.abs(s.getVelocity()) * .16, 340);
      const l = Math.round(s.progress * 100); if (l !== lastLap) { lastLap = l; lap.textContent = l; }
    } });
    gsap.ticker.add(() => {
      if (document.hidden) return;
      hudSpeed += (target - hudSpeed) * .08; target *= .9;
      const s = Math.round(hudSpeed); if (s !== lastSpd) { lastSpd = s; spd.textContent = s; }       // only touch the DOM when a value changes
      const g = hudSpeed < 6 ? 'N' : String(Math.min(8, 1 + Math.floor(hudSpeed / 42))); if (g !== lastGear) { lastGear = g; gear.textContent = g; }
    });
  })();

  // ---- Team cards expand on click / Enter / Space ----
  document.querySelectorAll('.card.member').forEach(c => {
    const toggle = () => { const o = c.classList.toggle('open'); c.setAttribute('aria-expanded', o); };
    c.addEventListener('click', toggle);
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  // ---- Sticky "Sponsor us" (appears after the hero, hides near Contact) ----
  (function sticky() {
    const ss = $('stickySponsor'), contact = $('contact'); if (!ss || !contact) return;
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: s => {
      const y = s.scroll(), near = contact.getBoundingClientRect().top < innerHeight * .85;
      ss.classList.toggle('show', y > innerHeight * .8 && !near);
    } });
  })();

  // ---- Theme switch (remembered in localStorage) ----
  (function theme() {
    const btn = $('themeBtn'); if (!btn) return;
    const apply = () => btn.setAttribute('aria-label', root.dataset.theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    apply();
    btn.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('vortex-theme', root.dataset.theme); } catch (e) {}
      apply();
    });
  })();

  // ---- Easter egg: type VORTEX (or the Konami code) and a car drives across the screen ----
  (function egg() {
    let buf = ''; const KONAMI = 'ArrowUpArrowUpArrowDownArrowDownArrowLeftArrowRightArrowLeftArrowRightba';
    addEventListener('keydown', e => {
      if (e.target.matches('input,textarea')) return;
      buf = (buf + e.key).slice(-80);
      if (buf.toLowerCase().endsWith('vortex') || buf.endsWith(KONAMI)) { buf = ''; driveBy(); }
    });
    function driveBy() {
      if (reduce) return;
      const c = car.cloneNode(true); c.removeAttribute('id'); c.classList.add('drive-by'); document.body.appendChild(c);
      gsap.set(c, { display: 'block', top: (20 + Math.random() * 55) + '%', x: innerWidth + 60 });
      gsap.to(c, { x: -600, duration: 1.6, ease: 'power2.inOut', onComplete: () => c.remove() });
      gsap.to(c.querySelectorAll('.wheel'), { rotation: -1440, transformOrigin: '50% 50%', duration: 1.6, ease: 'none' });
    }
  })();

  // =========================================================
  // IDLE AUTO-TOUR: after IDLE_SECONDS with no input the page scrolls down
  // by itself; at the bottom it triggers "Back to top" and carries on.
  // Any real input stops it at once and re-arms the timer.
  // =========================================================
  (function autoTour() {
    const btn = $('tourBtn'), pill = $('tourPill');
    if (reduce || !lenis) { if (btn) btn.hidden = true; return; }
    let timer = null, running = false, lastX = -1, lastY = -1;
    const typing = () => document.activeElement && document.activeElement.matches('input,textarea');
    const blocked = () => menuOpen || busy || tunnelActive || document.hidden || typing();
    const arm = () => { clearTimeout(timer); timer = setTimeout(start, IDLE_SECONDS * 1000); };
    const setBtn = () => { if (!btn) return; btn.setAttribute('aria-pressed', running); btn.setAttribute('aria-label', running ? 'Stop auto tour' : 'Start auto tour'); };
    function start() { if (blocked()) { arm(); return; } running = true; pill.classList.add('show'); setBtn(); }
    function stop() { if (running) { running = false; pill.classList.remove('show'); setBtn(); } arm(); }
    // The nav button starts or stops the tour by hand. Its own clicks must not count as "input that stops the tour".
    const fromBtn = e => btn && e.target && e.target.closest && e.target.closest('#tourBtn');
    let graceUntil = 0;   // after a manual start, mouse movement is ignored briefly so moving off the button doesn't stop the tour
    if (btn) btn.addEventListener('click', () => { if (running) stop(); else { if (menuOpen) setMenu(false); graceUntil = Date.now() + 2000; start(); } });
    gsap.ticker.add((time, dt) => {
      if (!running) return;
      if (blocked()) { stop(); return; }
      const next = lenis.scroll + TOUR_SPEED * dt / 1000;
      if (next >= lenis.limit - 2) {                                        // reached the bottom: back to top, then keep going
        running = false; pill.classList.remove('show');
        go('top', 'Home', '00');
        const resume = () => { if (busy) return setTimeout(resume, 200); if (!blocked()) { running = true; pill.classList.add('show'); setBtn(); } else { setBtn(); arm(); } };
        setTimeout(resume, 400);
        return;
      }
      lenis.scrollTo(next, { immediate: true, force: true });
    });
    // Real input only: the tour's own scrolling never fires these. Tiny pointer jitters are ignored.
    addEventListener('pointermove', e => {
      if (fromBtn(e)) return;
      const moved = lastX < 0 || Math.hypot(e.clientX - lastX, e.clientY - lastY) >= 3;
      lastX = e.clientX; lastY = e.clientY;
      if (moved && Date.now() > graceUntil) stop();
    }, { passive: true });
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, e => { if (!fromBtn(e)) stop(); }, { passive: true }));
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : arm());
    arm();
  })();

  // ---- Pause everything when the tab is hidden ----
  document.addEventListener('visibilitychange', () => document.hidden ? gsap.globalTimeline.pause() : gsap.globalTimeline.resume());

  addEventListener('load', () => ScrollTrigger.refresh());
})();
