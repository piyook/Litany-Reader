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
  const hexToRgb = (h) => { h = h.trim().replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const mix = (a, b, t) => `rgb(${lerp(a, b, t).join(',')})`;
  // Read from the CSS, and again whenever the theme changes.
  // PREVIEW is what a line brightens to while you read it silently in read-aloud mode.
  let DIM, COL, PREVIEW, HOLD;
  function readColours() {
    const css = getComputedStyle(document.documentElement);
    const v = (name) => hexToRgb(css.getPropertyValue(name));
    DIM = v('--text-dim');
    COL = { in: v('--in'), out: v('--out') };
    HOLD = `rgb(${v('--hold').join(',')})`;
    PREVIEW = lerp(DIM, v('--text'), 0.5);
  }
  readColours();

  // ---- Splitting long lines (off by default) ----
  // When on, a line longer than `splitWords` words is broken at its strongest
  // pause (. ! ? then ; : — then a comma) nearest the middle, so each part fits one breath.
  let splitOn = false, splitWords = 12;
  try {
    splitOn = localStorage.getItem('litany-split') === '1';
    const w = parseInt(localStorage.getItem('litany-split-words'), 10);
    if (w >= 4 && w <= 40) splitWords = w;
  } catch {}
  const MIN_PART = 3; // never leave a part shorter than this many words
  const pauseStrength = (w) => (/[.!?]["'”’)\]]*$/.test(w) ? 3 : /[;:—–]$/.test(w) ? 2 : /,$/.test(w) ? 1 : 0);
  function splitText(text, max) {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= max) return [words.join(' ')];
    let best = -1, bestScore = -Infinity;
    for (let i = MIN_PART - 1; i < words.length - MIN_PART; i++) {
      const s = pauseStrength(words[i]);
      if (!s) continue;
      const score = s * 100 - Math.abs(i + 1 - words.length / 2);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) return [words.join(' ')]; // no natural pause: leave it whole
    return [...splitText(words.slice(0, best + 1).join(' '), max), ...splitText(words.slice(best + 1).join(' '), max)];
  }
  const charCount = (t) => [...t.replace(/\s+/g, '')].length;

  // ---- Reader state ----
  // `src` holds the lines as written; `lines` the steps actually shown (the same
  // unless splitting is on). For step k, partSrc[k] is its source line and
  // partStart[k] / partLen[k] its slice of that line's character spans.
  let src = [], partSrc = [], partStart = [], partLen = [];
  let lines = [], idx = 0, phase = 'breath', elapsed = 0, playing = false, finished = false;
  let chars = [], lastTs = null, rafId = null;
  // Counts lines shown, across loops, so in/out keeps alternating even
  // when a litany with an odd number of lines wraps round.
  let step = 0;

  let looping = false;
  try { looping = localStorage.getItem('litany-loop') === '1'; } catch {}

  // Whole-litany view state
  let fullView = false, rowChars = [], rowEls = [], title = '', author = '';
  try { fullView = localStorage.getItem('litany-full') === '1'; } catch {}
  const viewBtn = $('btn-view');

  // Read-aloud mode: you can only speak on the out-breath, so each line gets a
  // whole breath: read it silently breathing in, hold, speak it breathing out, hold.
  // `half` is 0 for the in-breath half of the line and 1 for the out-breath half.
  let aloud = false, half = 0;
  try { aloud = localStorage.getItem('litany-aloud') === '1'; } catch {}
  const aloudBtn = $('btn-aloud');

  // Short form: a quick version of the litany, for litanies whose file has one.
  let shortForm = false, longLines = [], shortLines = [];
  const usingShort = () => shortForm && shortLines.length > 0;
  const displayTitle = () => (usingShort() ? title + ' · short' : title);
  try { shortForm = localStorage.getItem('litany-short') === '1'; } catch {}
  const shortBtn = $('btn-short');

  const kindOf = () => (aloud ? (half ? 'out' : 'in') : step % 2 === 0 ? 'in' : 'out');
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
        if (it.author) {
          const a = document.createElement('span');
          a.className = 'author-tag';
          a.textContent = it.author;
          b.appendChild(a);
        }
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
    longLines = data.lines;
    shortLines = data.short || [];
    title = data.title;
    author = data.author || '';
    document.title = data.title;
    indexEl.classList.add('hidden');
    readerEl.classList.remove('hidden');
    loadForm();
    play();
  }

  // Shows the long or short form from the first line. With no short form, the long one.
  function loadForm() {
    src = usingShort() ? shortLines : longLines;
    $('reader-title').textContent = displayTitle();
    shortBtn.disabled = !shortLines.length;
    updateShortBtn();
    buildParts();
    step = 0;
    idx = 0;
    rowChars = [];
    goTo(0);
  }

  function updateShortBtn() {
    const on = shortForm && !shortBtn.disabled;
    shortBtn.classList.toggle('active', on);
    shortBtn.setAttribute('aria-pressed', String(on));
    shortBtn.title = shortBtn.disabled ? 'No short form for this litany'
      : on ? 'Short form: on (S)' : 'Short form: off (S)';
  }

  function setShort(on) {
    if (src.length && !shortLines.length) return; // this litany has no short form
    shortForm = on;
    try { localStorage.setItem('litany-short', on ? '1' : '0'); } catch {}
    if (!src.length) return updateShortBtn();
    const wasFinished = finished;
    loadForm();
    if (wasFinished) play();
  }

  function buildParts() {
    lines = []; partSrc = []; partStart = []; partLen = [];
    src.forEach((text, r) => {
      let start = 0;
      for (const part of splitOn ? splitText(text, splitWords) : [text]) {
        const len = charCount(part);
        lines.push(part); partSrc.push(r); partStart.push(start); partLen.push(len);
        start += len;
      }
    });
  }
  const partChars = (k) => rowChars[partSrc[k]].slice(partStart[k], partStart[k] + partLen[k]);

  // Re-split after the setting changes, staying on the same source line.
  function resplit() {
    if (!src.length) return;
    const row = partSrc[idx];
    buildParts();
    const target = partSrc.indexOf(row);
    step = Math.max(0, step + (target - idx));
    idx = target;
    rowChars = [];
    if (!finished) goTo(idx);
  }

  function goTo(i) {
    const target = Math.max(0, Math.min(lines.length - 1, i));
    step = Math.max(0, step + (target - idx));
    idx = target;
    phase = 'breath';
    half = 0;
    elapsed = 0;
    finished = false;
    endEl.classList.add('hidden');
    holdEl.classList.remove('hidden');
    cueEl.classList.remove('hidden');
    renderLine();
    draw();
  }

  // Adds `text` to `container` and returns its character spans. Each word is an
  // unbreakable group, so lines only wrap between words; a word too wide for the
  // screen makes the font shrink instead.
  function buildWords(text, container) {
    const out = [];
    const words = text.split(/\s+/);
    words.forEach((word, wi) => {
      const w = document.createElement('span');
      w.className = 'word';
      for (const ch of word) {
        const s = document.createElement('span');
        s.textContent = ch;
        w.appendChild(s);
        out.push(s);
      }
      container.appendChild(w);
      if (wi < words.length - 1) container.appendChild(document.createTextNode(' '));
    });
    return out;
  }

  const fadeIn = () => lineEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' });

  function renderLine() {
    if (fullView) {
      if (!rowChars.length) buildAllRows();
      chars = partChars(idx);
      paintRows();
      return;
    }
    lineEl.classList.remove('full');
    lineEl.innerHTML = '';
    chars = buildWords(lines[idx], lineEl);
    fitText();
    fadeIn();
  }

  // Whole-litany view: every line on screen as written, one row each, even when
  // split (only the current part lights up). Click a row to jump to it.
  function buildAllRows() {
    lineEl.classList.add('full');
    lineEl.innerHTML = '';
    if (title) {
      const h = document.createElement('div');
      h.className = 'title';
      h.textContent = displayTitle();
      lineEl.appendChild(h);
    }
    rowEls = [];
    rowChars = src.map((text, j) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.onclick = () => goTo(partSrc.indexOf(j));
      lineEl.appendChild(row);
      rowEls.push(row);
      return buildWords(text, row);
    });
    if (author) {
      const a = document.createElement('div');
      a.className = 'author';
      a.textContent = '— ' + author;
      lineEl.appendChild(a);
    }
    fitText();
    fadeIn();
  }

  // Parts already read keep a softer version of their breath colour; parts to come stay dim.
  function paintRows() {
    rowEls.forEach((el, r) => el.classList.toggle('current', r === partSrc[idx]));
    for (let k = 0; k < lines.length; k++) {
      if (k === idx) continue; // draw() fills the current part
      const parity = aloud ? 1 : (((step - idx + k) % 2) + 2) % 2;
      const colour = k < idx ? mix(DIM, COL[parity === 0 ? 'in' : 'out'], 0.5) : `rgb(${DIM.join(',')})`;
      for (const c of partChars(k)) c.style.color = colour;
    }
  }

  function setFullView(on) {
    fullView = on;
    readerEl.classList.toggle('full-view', on);
    viewBtn.classList.toggle('active', on);
    viewBtn.setAttribute('aria-pressed', String(on));
    viewBtn.title = on ? 'Whole litany: on (V)' : 'Whole litany: off (V)';
    try { localStorage.setItem('litany-full', on ? '1' : '0'); } catch {}
    rowChars = [];
    if (lines.length) { renderLine(); draw(); }
  }

  // Largest font size that keeps the text within ~90% width and ~70% height.
  function fitText() {
    const maxH = window.innerHeight * (fullView ? 0.72 : 0.7) - 80; // 80px = stage top padding
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
    const ease = 0.5 - 0.5 * Math.cos(Math.PI * p);
    const n = chars.length;
    if (aloud && kind === 'in') {
      // Silent read: the whole line brightens evenly, ready to be spoken.
      const c = mix(DIM, PREVIEW, phase === 'breath' ? ease : 1);
      for (let i = 0; i < n; i++) chars[i].style.color = c;
    } else {
      // Fill left to right with a soft edge a few characters wide.
      const from = aloud ? PREVIEW : DIM;
      const fill = phase === 'breath' ? p : 1;
      const edge = 3;
      const front = fill * (n + edge);
      for (let i = 0; i < n; i++) {
        const t = Math.max(0, Math.min(1, (front - i) / edge));
        chars[i].style.color = mix(from, COL[kind], t);
      }
    }
    // Breath indicator: orb grows on the in-breath, shrinks on the out-breath,
    // and stays still while the hold arc draws round it.
    const rgb = `rgb(${COL[kind].join(',')})`;
    const holding = phase === 'hold';
    const size = holding ? (kind === 'in' ? 1 : 0) : (kind === 'in' ? ease : 1 - ease);
    orbEl.setAttribute('r', (10 + 24 * size).toFixed(2));
    orbEl.style.fill = rgb;
    holdEl.classList.add('show');
    arcEl.style.stroke = HOLD; // one hold colour for both holds
    arcEl.classList.toggle('on', holding && dur > 0);
    arcEl.style.strokeDashoffset = holding && dur > 0 ? String(1 - p) : '1';
    // Word cue
    const word = holding ? 'hold' : kind === 'in' ? 'breathe in' : aloud ? 'speak' : 'breathe out';
    if (cueEl.textContent !== word) cueEl.textContent = word;
    cueEl.style.color = rgb;
    cueEl.classList.add('show');
  }

  function advance() {
    if (phase === 'breath') {
      phase = 'hold';
      elapsed = 0;
    } else if (aloud && half === 0) {
      // Same line, now the out-breath: speak it.
      half = 1;
      phase = 'breath';
      elapsed = 0;
    } else if (idx < lines.length - 1 || looping) {
      idx = (idx + 1) % lines.length;
      step++;
      half = 0;
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
    // The return link takes the place of the breath ring and cue, clear of the toolbar.
    holdEl.classList.add('hidden');
    cueEl.classList.add('hidden');
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
  function stop() { pause(); lines = []; src = []; }
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

  const loopBtn = $('btn-loop'), repeatPill = $('repeat-pill');
  function setLoop(on) {
    looping = on;
    loopBtn.classList.toggle('active', on);
    loopBtn.setAttribute('aria-pressed', String(on));
    loopBtn.title = on ? 'Loop: on (L)' : 'Loop: off (L)';
    repeatPill.classList.toggle('on', on);
    repeatPill.setAttribute('aria-pressed', String(on));
    repeatPill.title = on ? 'Repeat: on (L)' : 'Read once (L)';
    try { localStorage.setItem('litany-loop', on ? '1' : '0'); } catch {}
    // Turning loop on after the litany has ended starts it again from the top.
    if (on) restartIfFinished();
  }

  // After the litany has ended, changing loop, read-aloud or short form starts it again.
  function restartIfFinished() {
    if (!finished || !lines.length) return false;
    play(); // play() goes back to the first line when finished
    return true;
  }
  setLoop(looping);
  loopBtn.onclick = () => setLoop(!looping);
  repeatPill.onclick = () => setLoop(!looping);
  setFullView(fullView);
  viewBtn.onclick = () => setFullView(!fullView);
  shortBtn.onclick = () => setShort(!shortForm);
  updateShortBtn();

  function setAloud(on) {
    aloud = on;
    aloudBtn.classList.toggle('active', on);
    aloudBtn.setAttribute('aria-pressed', String(on));
    aloudBtn.title = on ? 'Read aloud: on (A)' : 'Read aloud: off (A)';
    modePill.textContent = on ? 'Spoken' : 'Silent';
    modePill.classList.toggle('spoken', on);
    try { localStorage.setItem('litany-aloud', on ? '1' : '0'); } catch {}
    // Restart the current line so it begins on an in-breath in the new mode.
    if (!restartIfFinished() && lines.length) goTo(idx);
  }
  const modePill = $('mode-pill');
  setAloud(aloud);
  aloudBtn.onclick = () => setAloud(!aloud);
  modePill.onclick = () => setAloud(!aloud);

  // Light / dark theme. The <head> script sets it before first paint; this keeps it in step.
  const themeBtns = document.querySelectorAll('.btn-theme');
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('litany-theme', t); } catch {}
    const label = t === 'dark' ? 'Switch to light mode (T)' : 'Switch to dark mode (T)';
    themeBtns.forEach((b) => { b.title = label; b.setAttribute('aria-label', label); });
    readColours();
    if (lines.length && !readerEl.classList.contains('hidden')) {
      if (fullView && rowChars.length) paintRows();
      draw();
    }
  }
  const toggleTheme = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  setTheme(document.documentElement.dataset.theme || 'dark');
  themeBtns.forEach((b) => (b.onclick = toggleTheme));

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
  const splitBox = $('t-split'), splitField = $('t-split-words');
  const fillSplit = () => { splitBox.checked = splitOn; splitField.value = splitWords; splitField.disabled = !splitOn; };
  splitBox.addEventListener('change', () => {
    splitOn = splitBox.checked;
    try { localStorage.setItem('litany-split', splitOn ? '1' : '0'); } catch {}
    fillSplit();
    resplit();
  });
  splitField.addEventListener('input', () => {
    const v = parseInt(splitField.value, 10);
    if (isNaN(v)) return;
    splitWords = Math.max(4, Math.min(40, v));
    try { localStorage.setItem('litany-split-words', String(splitWords)); } catch {}
    if (splitOn) resplit();
  });
  $('btn-settings').onclick = () => { fillFields(); fillSplit(); settingsEl.classList.toggle('hidden'); };
  // A click anywhere outside the panel (other than the gear itself) closes it.
  document.addEventListener('click', (e) => {
    if (settingsOpen() && !settingsEl.contains(e.target) && !$('btn-settings').contains(e.target)) {
      settingsEl.classList.add('hidden');
    }
  });
  $('t-done').onclick = () => settingsEl.classList.add('hidden');
  $('t-reset').onclick = () => { timings = { ...DEFAULTS }; saveTimings(); fillFields(); };

  // ---- Keyboard ----
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') settingsEl.classList.add('hidden'); return; }
    if (e.key === 't' || e.key === 'T') return toggleTheme();
    if (readerEl.classList.contains('hidden')) return;
    switch (e.key) {
      case ' ': e.preventDefault(); toggle(); break;
      case 'ArrowLeft': prev(); break;
      case 'ArrowRight': next(); break;
      case 'Escape':
        if (settingsOpen()) settingsEl.classList.add('hidden');
        else if (!document.fullscreenElement) showIndex();
        break;
      case 'l': case 'L': setLoop(!looping); break;
      case 'v': case 'V': setFullView(!fullView); break;
      case 's': case 'S': setShort(!shortForm); break;
      case 'a': case 'A': setAloud(!aloud); break;
      case 'f': case 'F':
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
        break;
    }
  });

  window.addEventListener('resize', () => { if (lines.length) fitText(); });
  showIndex();
})();
