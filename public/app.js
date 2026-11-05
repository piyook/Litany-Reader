// Litany Reader front end.
(() => {
  const $ = (id) => document.getElementById(id);
  const indexEl = $('index'), listEl = $('litany-list'), msgEl = $('index-msg');
  const readerEl = $('reader'), lineEl = $('line'), holdEl = $('hold'), arcEl = holdEl.querySelector('.arc');
  const orbEl = holdEl.querySelector('.orb'), cueEl = $('cue');
  const controlsEl = $('controls'), playBtn = $('btn-play'), endEl = $('end'), settingsEl = $('settings');

  // ---- Timings (seconds) ----
  const DEFAULTS = { in: 4, hold1: 4, out: 6, hold2: 2 };
  let timings = { ...DEFAULTS };
  try { Object.assign(timings, JSON.parse(localStorage.getItem('litany-timings') || '{}')); } catch {}
  const saveTimings = () => { try { localStorage.setItem('litany-timings', JSON.stringify(timings)); } catch {} };

  // ---- Colours for the fill ----
  const css = getComputedStyle(document.documentElement);
  const hexToRgb = (h) => { h = h.trim().replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const DIM = hexToRgb(css.getPropertyValue('--text-dim'));
  const COL = { in: hexToRgb(css.getPropertyValue('--in')), out: hexToRgb(css.getPropertyValue('--out')) };
  const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

  // ---- Reader state ----
  let lines = [], idx = 0, phase = 'breath', elapsed = 0, playing = false, finished = false;
  let chars = [], lastTs = null, rafId = null;
  // Counts lines shown, across loops, so in/out keeps alternating even
  // when a litany with an odd number of lines wraps round.
  let step = 0;

  let looping = false;
  try { looping = localStorage.getItem('litany-loop') === '1'; } catch {}

  const kindOf = () => (step % 2 === 0 ? 'in' : 'out');
  const phaseDuration = () => {
    const k = kindOf();
    if (phase === 'breath') return (k === 'in' ? timings.in : timings.out) * 1000;
    return (k === 'in' ? timings.hold1 : timings.hold2) * 1000;
  };

  // ---- Index ----
  async function showIndex() {
    stop();
    readerEl.classList.add('hidden');
    indexEl.classList.remove('hidden');
    settingsEl.classList.add('hidden');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    listEl.innerHTML = '';
    msgEl.textContent = 'Loading…';
    try {
      const res = await fetch('/api/litanies', { cache: 'no-store' });
      const items = await res.json();
      msgEl.textContent = items.length ? '' : 'No litanies found. Add .txt files to the litanies folder.';
      for (const it of items) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.textContent = it.title;
        b.onclick = () => openLitany(it.id);
        li.appendChild(b);
        listEl.appendChild(li);
      }
      listEl.querySelector('button')?.focus();
    } catch {
      msgEl.textContent = 'Could not reach the server. Is it running?';
    }
  }

  // ---- Reader ----
  async function openLitany(id) {
    const res = await fetch('/api/litanies/' + encodeURIComponent(id), { cache: 'no-store' });
    if (!res.ok) { msgEl.textContent = 'Could not open that litany.'; return; }
    const data = await res.json();
    lines = data.lines.length ? data.lines : [data.title];
    document.title = data.title;
    indexEl.classList.add('hidden');
    readerEl.classList.remove('hidden');
    step = 0;
    idx = 0;
    goTo(0);
    play();
  }

  function goTo(i) {
    const target = Math.max(0, Math.min(lines.length - 1, i));
    step = Math.max(0, step + (target - idx));
    idx = target;
    phase = 'breath';
    elapsed = 0;
    finished = false;
    endEl.classList.add('hidden');
    renderLine();
    draw();
  }

  function renderLine() {
    lineEl.innerHTML = '';
    chars = [];
    // Each word is an unbreakable group of character spans, so lines only wrap
    // between words. A word too wide for the screen makes the font shrink instead.
    const words = lines[idx].split(/\s+/);
    words.forEach((word, wi) => {
      const w = document.createElement('span');
      w.className = 'word';
      for (const ch of word) {
        const s = document.createElement('span');
        s.textContent = ch;
        w.appendChild(s);
        chars.push(s);
      }
      lineEl.appendChild(w);
      if (wi < words.length - 1) lineEl.appendChild(document.createTextNode(' '));
    });
    fitText();
    lineEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' });
  }

  // Largest font size that keeps the line within ~90% width and ~70% height.
  function fitText() {
    const maxH = window.innerHeight * 0.7;
    let lo = 12, hi = 600;
    while (hi - lo > 1) {
      const mid = (lo + hi) / 2;
      lineEl.style.fontSize = mid + 'px';
      const fits = lineEl.scrollHeight <= maxH && lineEl.scrollWidth <= lineEl.clientWidth + 1;
      if (fits) lo = mid; else hi = mid;
    }
    lineEl.style.fontSize = lo + 'px';
  }

  function draw() {
    const kind = kindOf();
    const dur = phaseDuration();
    const p = dur > 0 ? Math.min(1, elapsed / dur) : 1;
    // Fill left to right with a soft edge a few characters wide.
    const fill = phase === 'breath' ? p : 1;
    const edge = 3, n = chars.length;
    const front = fill * (n + edge);
    for (let i = 0; i < n; i++) {
      const t = Math.max(0, Math.min(1, (front - i) / edge));
      chars[i].style.color = mix(DIM, COL[kind], t);
    }
    // Breath indicator: orb grows on the in-breath, shrinks on the out-breath,
    // and stays still while the hold arc draws round it.
    const rgb = `rgb(${COL[kind].join(',')})`;
    const holding = phase === 'hold';
    const ease = 0.5 - 0.5 * Math.cos(Math.PI * p);
    const size = holding ? (kind === 'in' ? 1 : 0) : (kind === 'in' ? ease : 1 - ease);
    orbEl.setAttribute('r', (10 + 24 * size).toFixed(2));
    orbEl.style.fill = rgb;
    holdEl.classList.add('show');
    arcEl.style.stroke = rgb;
    arcEl.classList.toggle('on', holding && dur > 0);
    arcEl.style.strokeDashoffset = holding && dur > 0 ? String(1 - p) : '1';
    // Word cue
    const word = holding ? 'hold' : kind === 'in' ? 'breathe in' : 'breathe out';
    if (cueEl.textContent !== word) cueEl.textContent = word;
    cueEl.style.color = rgb;
    cueEl.classList.add('show');
  }

  function advance() {
    if (phase === 'breath') {
      phase = 'hold';
      elapsed = 0;
    } else if (idx < lines.length - 1 || looping) {
      idx = (idx + 1) % lines.length;
      step++;
      phase = 'breath';
      elapsed = 0;
      renderLine();
    } else {
      finish();
    }
  }

  function finish() {
    finished = true;
    pause();
    holdEl.classList.remove('show');
    cueEl.classList.remove('show');
    endEl.classList.remove('hidden');
  }

  function tick(ts) {
    if (!playing) return;
    if (lastTs == null) lastTs = ts;
    elapsed += Math.min(100, ts - lastTs); // cap jumps, e.g. after the tab was hidden
    lastTs = ts;
    // Loop handles zero-length holds without stalling a frame.
    let guard = 4;
    while (playing && elapsed >= phaseDuration() && guard--) {
      const over = elapsed - phaseDuration();
      advance();
      if (playing) elapsed = over;
    }
    draw();
    rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (finished) goTo(0);
    if (playing) return;
    playing = true;
    lastTs = null;
    playBtn.innerHTML = '&#x23F8;&#xFE0E;';
    rafId = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    playBtn.innerHTML = '&#x25B6;&#xFE0E;';
  }
  function stop() { pause(); lines = []; }
  const toggle = () => (playing ? pause() : play());
  const prev = () => {
    if (finished) return goTo(lines.length - 1);
    if (idx === 0 && looping) { step--; idx = lines.length - 1; return goTo(idx); }
    goTo(idx - 1);
  };
  const next = () => {
    if (idx < lines.length - 1) goTo(idx + 1);
    else if (looping) { step++; idx = 0; goTo(0); }
    else finish();
  };

  const loopBtn = $('btn-loop');
  function setLoop(on) {
    looping = on;
    loopBtn.classList.toggle('active', on);
    loopBtn.setAttribute('aria-pressed', String(on));
    loopBtn.title = on ? 'Loop: on (L)' : 'Loop: off (L)';
    try { localStorage.setItem('litany-loop', on ? '1' : '0'); } catch {}
  }
  setLoop(looping);
  loopBtn.onclick = () => setLoop(!looping);

  // ---- Controls ----
  playBtn.onclick = toggle;
  $('btn-prev').onclick = prev;
  $('btn-next').onclick = next;
  $('btn-close').onclick = showIndex;
  $('end-back').onclick = showIndex;

  // Show controls only when the pointer is near the bottom; hide the cursor when idle.
  let hideTimer = null, idleTimer = null;
  const settingsOpen = () => !settingsEl.classList.contains('hidden');
  readerEl.addEventListener('mousemove', (e) => {
    readerEl.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!settingsOpen()) readerEl.classList.add('idle'); }, 2500);
    if (e.clientY > window.innerHeight - 120 || settingsOpen()) {
      clearTimeout(hideTimer);
      controlsEl.classList.add('show');
    } else {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => controlsEl.classList.remove('show'), 600);
    }
  });
  readerEl.addEventListener('mouseleave', () => { if (!settingsOpen()) controlsEl.classList.remove('show'); });

  // ---- Settings ----
  const fields = { in: $('t-in'), hold1: $('t-hold1'), out: $('t-out'), hold2: $('t-hold2') };
  const fillFields = () => { for (const k in fields) fields[k].value = timings[k]; };
  for (const k in fields) {
    fields[k].addEventListener('input', () => {
      const v = parseFloat(fields[k].value);
      const min = k.startsWith('hold') ? 0 : 0.5;
      if (!isNaN(v)) { timings[k] = Math.max(min, Math.min(30, v)); saveTimings(); }
    });
  }
  $('btn-settings').onclick = () => { fillFields(); settingsEl.classList.toggle('hidden'); };
  $('t-done').onclick = () => settingsEl.classList.add('hidden');
  $('t-reset').onclick = () => { timings = { ...DEFAULTS }; saveTimings(); fillFields(); };

  // ---- Keyboard ----
  document.addEventListener('keydown', (e) => {
    if (readerEl.classList.contains('hidden')) return;
    if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') settingsEl.classList.add('hidden'); return; }
    switch (e.key) {
      case ' ': e.preventDefault(); toggle(); break;
      case 'ArrowLeft': prev(); break;
      case 'ArrowRight': next(); break;
      case 'Escape':
        if (settingsOpen()) settingsEl.classList.add('hidden');
        else if (!document.fullscreenElement) showIndex();
        break;
      case 'l': case 'L': setLoop(!looping); break;
      case 'f': case 'F':
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
        break;
    }
  });

  window.addEventListener('resize', () => { if (lines.length) fitText(); });

  showIndex();
})();
