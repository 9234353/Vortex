/* VORTEX site animations: GSAP + ScrollTrigger + Lenis */
(function () {
  document.documentElement.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;

  if (!window.gsap) { document.documentElement.classList.remove('js'); const p = document.getElementById('preloader'); if (p) p.remove(); return; }
  gsap.registerPlugin(ScrollTrigger);

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
    else if (target === 0 || target instanceof Element) (target === 0 ? window.scrollTo(0, 0) : target.scrollIntoView());
    ScrollTrigger.update();
  };

  // ---- Split hero title into letters ----
  const title = document.getElementById('heroTitle');
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
            const m = document.createElement('span'); m.className = 'line-mask';
            m.style.display = 'inline-block';
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
    const words = el.querySelectorAll('.line-in');
    if (reduce) return;
    gsap.set(words, { yPercent: 110 });
    gsap.to(words, { yPercent: 0, duration: 1, stagger: .035, ease: 'power4.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });

  // ---- Airflow lines (SVG) ----
  const svg = document.getElementById('airflow');
  const paths = [];
  for (let i = 0; i < 16; i++) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    if (i % 5 === 0) p.setAttribute('class', 'r');
    svg.appendChild(p); paths.push(p);
  }
  let mx = 800, my = 450, smx = 800, smy = 450;
  addEventListener('mousemove', e => { mx = e.clientX / innerWidth * 1600; my = e.clientY / innerHeight * 900; });
  function drawFlow(time) {
    const t0 = time / 1000;
    smx += (mx - smx) * 0.05; smy += (my - smy) * 0.05;
    paths.forEach((p, i) => {
      const y = 60 + i * 52;
      const wob = Math.sin(t0 * 0.8 + i) * 18;
      const pull = Math.max(0, 1 - Math.abs(y - smy) / 220) * (smy - y) * 0.5;
      p.setAttribute('d', `M-50 ${y} C 400 ${y + wob} ${smx - 150} ${y + pull} ${smx} ${y + pull} S 1300 ${y - wob} 1650 ${y}`);
    });
  }
  if (!reduce) gsap.ticker.add(drawFlow); else drawFlow(0);

  // ---- Blobs drift ----
  if (!reduce) {
    gsap.to('.b1', { x: 120, y: 80, duration: 12, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.b2', { x: -100, y: -60, duration: 14, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.b3', { x: 80, y: -90, duration: 16, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }

  // ---- Marquee ----
  if (!reduce) {
    const mq = gsap.to('#marquee', { xPercent: -50, duration: 28, repeat: -1, ease: 'none' });
    // the banner speeds up (and flips direction) with your scroll speed
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: s => {
      const v = s.getVelocity(), dir = v < 0 ? -1 : 1;
      gsap.to(mq, { timeScale: dir * (1 + Math.min(Math.abs(v) / 250, 8)), duration: .2, overwrite: true,
        onComplete: () => gsap.to(mq, { timeScale: dir, duration: 1 }) });
    } });
  }

  // ---- Preloader then intro ----
  const num = document.getElementById('preNum'), bar = document.getElementById('preBar');
  const counter = { v: 0 };
  const intro = gsap.timeline({ paused: true });
  intro
    .to('.preloader', { yPercent: -100, duration: .9, ease: 'power4.inOut' })
    .to('.mask-title .ch', { y: 0, duration: 1, stagger: .06, ease: 'power4.out' }, '-=.3')
    .to('#heroLine', { scaleX: 1, duration: 1, ease: 'power3.inOut' }, '-=.6')
    .from('.corner', { scale: 0, opacity: 0, duration: .8, stagger: .08, ease: 'back.out(2)' }, '-=.9')
    .from('.race-no', { opacity: 0, x: 80, duration: 1.2, ease: 'power3.out' }, '-=.8')
    .to('.hero .fade-in', { opacity: 1, y: 0, duration: .8, stagger: .12 }, '-=.9')
    .from('#nav', { yPercent: -200, opacity: 0, duration: .8, ease: 'power3.out' }, '-=.8');
  gsap.to(counter, {
    v: 100, duration: reduce ? .1 : 1.6, ease: 'power2.inOut',
    onUpdate() { const v = Math.round(counter.v); num.textContent = v; bar.style.width = v + '%'; },
    onComplete() { intro.play(); }
  });

  // ---- Scroll progress ----
  gsap.to('#progress', { scaleX: 1, ease: 'none', scrollTrigger: { scrub: .3, start: 0, end: 'max' } });

  // ---- Reveals ----
  // Team cards and timeline rows fly in from alternating sides
  document.querySelectorAll('.card, .tl').forEach((el, i) => { el.dataset.dir = (i % 2 ? 1 : -1); });
  gsap.utils.toArray('.reveal').forEach(el => {
    const dir = parseFloat(el.dataset.dir);
    if (dir && !reduce) {
      gsap.fromTo(el, { opacity: 0, x: dir * 220, y: 40, rotate: dir * 5 },
        { opacity: 1, x: 0, y: 0, rotate: 0, duration: 1.1, ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      return;
    }
    gsap.to(el, { opacity: 1, y: 0, duration: .9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  // Hero exits by shrinking and sliding away as you scroll
  if (!reduce) {
    gsap.to('.hero-in', { scale: .82, opacity: 0, yPercent: -14, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.race-no', { xPercent: 40, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  }

  // ---- Image wipe reveals ----
  if (!reduce) {
    gsap.utils.toArray('.img-reveal').forEach(el => {
      gsap.fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.3, ease: 'power4.inOut',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });
  }

  // ---- Counters ----
  document.querySelectorAll('[data-count]').forEach(el => {
    const end = parseFloat(el.dataset.count), dec = String(end).includes('.') ? 1 : 0, o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () =>
      gsap.to(o, { v: end, duration: 1.8, ease: 'power2.out', onUpdate: () => el.textContent = o.v.toFixed(dec) }) });
  });

  // ---- Car: pinned section, specs highlight in sequence + image parallax ----
  const specs = gsap.utils.toArray('.spec');
  const carEnd = '+=' + (specs.length * 40) + '%';
  ScrollTrigger.create({
    trigger: '.car', start: 'top top', end: carEnd, pin: '.car-pin', scrub: true, refreshPriority: 3,
    onUpdate: s => { const i = Math.min(specs.length - 1, Math.floor(s.progress * specs.length));
      specs.forEach((el, k) => el.classList.toggle('active', k === i)); }
  });
  gsap.fromTo('.car-img img', { yPercent: -8 }, { yPercent: 8, ease: 'none',
    scrollTrigger: { trigger: '.car', start: 'top top', end: carEnd, scrub: true } });

  // ---- Horizontal gallery (pinned) ----
  const track = document.getElementById('galTrack');
  if (track && !reduce) {
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    gsap.to(track, { x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '#gallery', start: 'top top', end: () => '+=' + dist(), pin: '.gal-pin', scrub: true, invalidateOnRefresh: true, refreshPriority: 1 } });
  } else if (track) {
    track.parentElement.style.overflowX = 'auto';
  }

  // ---- Engineering: the whole page slides sideways (3 full-screen panels) ----
  const hTrack = document.getElementById('hTrack');
  if (hTrack && !reduce) {
    const hDist = () => Math.max(0, hTrack.scrollWidth - innerWidth);
    const hEnd = () => '+=' + hDist();
    gsap.to(hTrack, { x: () => -hDist(), ease: 'none',
      scrollTrigger: { trigger: '#hsteps', start: 'top top', end: hEnd, pin: '.hpin', scrub: true, invalidateOnRefresh: true, refreshPriority: 2 } });
    gsap.to('#hLine', { scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: '#hsteps', start: 'top top', end: hEnd, scrub: true, invalidateOnRefresh: true } });
  } else if (hTrack) {
    hTrack.parentElement.style.overflowX = 'auto';
  }


  // ---- Chapter indicator ----
  const chapNow = document.getElementById('chapNow');
  document.querySelectorAll('[data-chap]').forEach(sec => {
    const set = () => { chapNow.textContent = sec.dataset.chap; };
    ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onEnter: set, onEnterBack: set });
  });

  // ---- Chapters menu ----
  const menu = document.getElementById('menu'), menuBtn = document.getElementById('menuBtn');
  const menuLinks = menu.querySelectorAll('.menu-list a');
  let menuOpen = false;
  const menuTl = gsap.timeline({ paused: true,
    onReverseComplete() { gsap.set(menu, { visibility: 'hidden' }); } });
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

  // ---- Page transition (red wipe, then dark wipe with chapter name) ----
  const curtain = document.getElementById('curtain');
  const flag = document.getElementById('flag'), car = document.getElementById('f1car');
  const curLabel = document.getElementById('curLabel');
  const curNum = document.getElementById('curNum'), curName = document.getElementById('curName');
  let busy = false, navPause = false;
  gsap.set(curLabel, { xPercent: -50, yPercent: -50 });

  // An F1 car drives right to left dragging a chequered flag behind it.
  // When the flag covers the page we jump to the new section, then the flag
  // drives off to the left and reveals it.
  function go(target, name, number) {
    if (busy) return; busy = true;
    const resolve = () => { jumpTo(target === 'top' ? 0 : target); ScrollTrigger.refresh(); };
    if (reduce) { setMenu(false, true); resolve(); busy = false; return; }
    curNum.textContent = number || ''; curName.textContent = name || '';
    const w = innerWidth, h = innerHeight, carW = car.getBoundingClientRect().width + 40;
    const sq = Math.ceil(h / 6);                          // chequered square size
    flag.style.backgroundSize = (sq * 2) + 'px ' + (sq * 2) + 'px';
    // Odd chapters (01, 03, 05, 07): F1 car drives right to left dragging the flag.
    // Even chapters (00, 02, 04, 06): plain chequered flag sweeping up the screen.
    const withCar = (parseInt(number, 10) || 0) % 2 === 1;
    gsap.set(curtain, { visibility: 'visible' });
    gsap.set(car, { display: withCar ? 'block' : 'none' });
    gsap.set(flag, withCar ? { x: w + carW, y: 0 } : { x: 0, y: h });
    gsap.set(curLabel, { opacity: 0 });
    navPause = true;
    const tl = gsap.timeline({ onComplete() {
      gsap.set(curtain, { visibility: 'hidden' }); busy = false; navPause = false;
      gsap.to('#nav', { yPercent: 0, opacity: 1, duration: .3, overwrite: true });
    } });
    if (withCar) tl.to(flag, { x: 0, duration: .95, ease: 'power3.inOut' })          // car crosses, flag follows
                   .to(car.querySelectorAll('.wheel'), { rotation: -720, transformOrigin: '50% 50%', duration: .95, ease: 'none' }, 0);
    else tl.to(flag, { y: 0, duration: .8, ease: 'power3.inOut' });                  // flag sweeps up
    tl.add(() => { if (menuOpen) setMenu(false, true); resolve(); })                 // page swaps while covered
      .fromTo(curLabel, { opacity: 0, scale: .9 }, { opacity: 1, scale: 1, duration: .35, ease: 'power3.out' })
      .to({}, { duration: .3 })
      .to(curLabel, { opacity: 0, duration: .2 });
    if (withCar) tl.to(flag, { x: -w - 20, duration: .85, ease: 'power3.inOut' });  // flag drives off, new page revealed
    else tl.to(flag, { y: -h - 20, duration: .8, ease: 'power3.inOut' });           // flag keeps sweeping up
  }
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    e.preventDefault();
    if (id === '#top') return go('top', a.dataset.chapter || 'Home', a.dataset.num || '00');
    const t = document.querySelector(id);
    if (t) go(t, a.dataset.chapter || '', a.dataset.num || '');
  }));

  // The top bar stays visible the whole time (it used to hide on scroll, which looked like it vanished).

  // ---- Glass light follows cursor ----
  document.querySelectorAll('.glass').forEach(g => g.addEventListener('pointermove', e => {
    const r = g.getBoundingClientRect();
    g.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    g.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  // ---- Custom cursor + magnetic buttons ----
  if (!touch && !reduce) {
    const c = document.getElementById('cursor'), ring = document.getElementById('cursorRing');
    const cx = gsap.quickTo(c, 'x', { duration: .1 }), cy = gsap.quickTo(c, 'y', { duration: .1 });
    const rx = gsap.quickTo(ring, 'x', { duration: .35 }), ry = gsap.quickTo(ring, 'y', { duration: .35 });
    addEventListener('mousemove', e => { cx(e.clientX); cy(e.clientY); rx(e.clientX); ry(e.clientY); });
    document.querySelectorAll('a,button,input,textarea,.card,.step,.gal-item').forEach(el => {
      el.addEventListener('mouseenter', () => ring.classList.add('big'));
      el.addEventListener('mouseleave', () => ring.classList.remove('big'));
    });
    document.querySelectorAll('.magnetic').forEach(b => {
      b.addEventListener('mousemove', e => { const r = b.getBoundingClientRect();
        gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * .35, y: (e.clientY - r.top - r.height / 2) * .35, duration: .3 }); });
      b.addEventListener('mouseleave', () => gsap.to(b, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1,.4)' }));
    });
  }

  addEventListener('load', () => ScrollTrigger.refresh());
})();
