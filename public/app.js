// Litany Reader front end: the page itself. The rules it follows (breathing,
// splitting lines, learning by heart, favourites) live in lib/, with tests.
import {
  clampTiming,
  cueWord,
  DEFAULT_TIMINGS,
  ease,
  fillAt,
  kindOf,
  moveStep,
  nextPhase,
  orbRadius,
  pastKind,
  phaseMs,
  revealNow,
} from './lib/breath.js';
import { hexToRgb, lerp, mix, rgb } from './lib/colour.js';
import { favsCookie, favsFirst, parseFavs, toggled } from './lib/favs.js';
import { BPM_START, beatPulse, bpmAt, furthest, glide } from './lib/heartbeat.js';
import { hiddenWords, levelOf, MEM_MAX, MEM_PILL, MEM_TOAST, memKey } from './lib/memorise.js';
import { read, readFlag, readObject, save, saveFlag, saveObject } from './lib/prefs.js';
import { buildParts, letterRange } from './lib/text.js';
import { keepAwake } from './wake-lock.js';

const $ = (id) => document.getElementById(id);
const indexEl = $('index'),
  listEl = $('litany-list'),
  msgEl = $('index-msg');
const readerEl = $('reader'),
  lineEl = $('line'),
  progressEl = $('progress'),
  holdEl = $('hold'),
  arcEl = holdEl.querySelector('.arc'),
  orbEl = holdEl.querySelector('.orb'),
  cueEl = $('cue');
const controlsEl = $('controls'),
  playBtn = $('btn-play'),
  endEl = $('end'),
  settingsEl = $('settings'),
  toastEl = $('toast');
const viewBtn = $('btn-view'),
  aloudBtn = $('btn-aloud'),
  modePill = $('mode-pill'),
  shortBtn = $('btn-short'),
  loopBtn = $('btn-loop'),
  repeatPill = $('repeat-pill'),
  favBtn = $('btn-fav'),
  favPill = $('fav-pill'),
  memBtn = $('btn-mem'),
  memPill = $('mem-pill'),
  beatBtn = $('btn-beat'),
  beatBox = $('t-beat'),
  pulseEl = $('pulse');

// ---- Settings, as saved last time ----
let timings = { ...DEFAULT_TIMINGS, ...readObject('litany-timings', {}) };
// Splitting long lines (off by default): a line longer than `splitWords` words
// is broken at its strongest pause nearest the middle, so each part fits one breath.
let splitOn = readFlag('litany-split'),
  splitWords = 12;
const savedWords = parseInt(read('litany-split-words'), 10);
if (savedWords >= 4 && savedWords <= 40) splitWords = savedWords;
let looping = readFlag('litany-loop');
let fullView = readFlag('litany-full'); // whole-litany view
// Read aloud: you can only speak on the out-breath, so each line gets a whole
// breath: read it silently breathing in, hold, speak it breathing out, hold.
let aloud = readFlag('litany-aloud');
let shortForm = readFlag('litany-short');
let memorise = readFlag('litany-mem');
let beatOn = readFlag('litany-beat'); // heartbeat, off unless turned on
const memLevels = readObject('litany-mem-levels', {});
let favs = parseFavs(document.cookie);

// ---- Reader state ----
// `src` holds the lines as written; `lines` the steps shown (the same unless
// splitting is on). See buildParts in lib/text.js for the part* arrays.
let src = [],
  lines = [],
  partSrc = [],
  partStart = [],
  partLen = [],
  partWord = [];
let idx = 0,
  step = 0, // lines shown, across loops, so in and out keep alternating
  phase = 'breath',
  half = 0, // read aloud: 0 the in-breath half of the line, 1 the out-breath half
  elapsed = 0,
  playing = false,
  finished = false;
let chars = [], // the character spans of the current step
  lastTs = null,
  rafId = null;
let rowChars = [], // whole-litany view: each source line's character spans
  rowEls = [];
let indexItems = [],
  currentId = null,
  title = '',
  author = '',
  longLines = [],
  shortLines = [],
  memHidden = []; // for each source line, the positions of its hidden words
let revealKey = ''; // what applyReveal last showed, so it only touches the page on a change
// Heartbeat: how far through the litany (0 to 1, never going back), the rate
// shown, and the point in the current beat (0 to 1).
let beatDone = 0,
  bpm = BPM_START,
  beatAt = 0;

const usingShort = () => shortForm && shortLines.length > 0;
const displayTitle = () => (usingShort() ? `${title} · short` : title);
const memLevel = () => levelOf(memLevels, memKey(currentId, usingShort()));
const kind = () => kindOf({ aloud, half, step });
const phaseDuration = () => phaseMs(timings, phase, kind());

// ---- Colours, read from the CSS, and again whenever the theme changes ----
// PREVIEW is what a line brightens to while you read it silently in read-aloud mode.
let DIM, COL, PREVIEW, HOLD;
function readColours() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => hexToRgb(css.getPropertyValue(name));
  DIM = v('--text-dim');
  COL = { in: v('--in'), out: v('--out') };
  HOLD = rgb(v('--hold'));
  PREVIEW = lerp(DIM, v('--text'), 0.5);
}
readColours();

const HEART =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 20s-7.5-4.6-9-9.2C1.9 7.4 4 4.5 7.2 4.5c2 0 3.5 1.1 4.8 2.9 1.3-1.8 2.8-2.9 4.8-2.9 3.2 0 5.3 2.9 4.2 6.3-1.5 4.6-9 9.2-9 9.2z"/></svg>';

// A short message near the bottom of the screen.
let toastTimer = null;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

// Shows an on/off toolbar button's state, e.g. "Loop: on (L)".
function showToggle(btn, on, label, key) {
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.title = `${label}: ${on ? 'on' : 'off'} (${key})`;
}

// ---- Favourites ----
const saveFavs = () => {
  // biome-ignore lint/suspicious/noDocumentCookie: one small cookie; the Cookie Store API is not in every browser.
  document.cookie = favsCookie(favs);
};
// Adds or removes a favourite. Returns false when the limit stopped it.
function toggleFav(id) {
  const next = toggled(favs, id);
  if (!next) {
    toast('You can have three favourites. Remove one first.');
    return false;
  }
  favs = next;
  saveFavs();
  return true;
}

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
    const res = await fetch('api/index.json', { cache: 'no-store' });
    indexItems = await res.json();
    // Ask the offline helper to save any litanies it hasn't seen yet.
    navigator.serviceWorker?.controller?.postMessage('save-litanies');
    msgEl.textContent = indexItems.length ? '' : 'No litanies found. Add .txt files to the litanies folder.';
    // Forget favourites whose file has gone, so they don't hold a slot.
    const ids = new Set(indexItems.map((it) => it.id));
    const kept = favs.filter((f) => ids.has(f));
    if (kept.length !== favs.length) {
      favs = kept;
      saveFavs();
    }
    renderIndex();
    listEl.querySelector('.open')?.focus();
  } catch {
    msgEl.textContent = 'Could not reach the server. Is it running?';
  }
}

function indexRow(it) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.className = 'open';
  b.textContent = it.title;
  if (it.author) {
    const a = document.createElement('span');
    a.className = 'author-tag';
    a.textContent = it.author;
    b.appendChild(a);
  }
  b.onclick = () => openLitany(it.id);
  const h = document.createElement('button');
  const on = favs.includes(it.id);
  h.className = `fav${on ? ' on' : ''}`;
  h.innerHTML = HEART;
  h.dataset.id = it.id;
  h.setAttribute('aria-pressed', String(on));
  h.title = on ? 'Remove from favourites' : 'Add to favourites';
  h.setAttribute('aria-label', `${h.title}: ${it.title}`);
  h.onclick = () => {
    if (!toggleFav(it.id)) return;
    renderIndex();
    listEl.querySelector(`.fav[data-id="${CSS.escape(it.id)}"]`)?.focus();
  };
  li.append(b, h);
  return li;
}

// Favourites first, then the rest, each in the server's (alphabetical) order.
function renderIndex() {
  listEl.innerHTML = '';
  for (const it of favsFirst(indexItems, favs)) listEl.appendChild(indexRow(it));
}

// ---- Reader ----
async function openLitany(id) {
  const res = await fetch(`api/litany/${encodeURIComponent(id)}.json`, { cache: 'no-store' });
  if (!res.ok) {
    msgEl.textContent = 'Could not open that litany.';
    return;
  }
  const data = await res.json();
  currentId = id;
  updateFavBtn();
  longLines = data.lines;
  shortLines = data.short || [];
  title = data.title;
  author = data.author || '';
  document.title = data.title;
  indexEl.classList.add('hidden');
  readerEl.classList.remove('hidden');
  // A new litany starts the heartbeat quick again.
  beatDone = 0;
  bpm = BPM_START;
  beatAt = 0;
  loadForm();
  play();
}

// Shows the long or short form from the first line. With no short form, the long one.
function loadForm() {
  src = usingShort() ? shortLines : longLines;
  $('reader-title').textContent = displayTitle();
  shortBtn.disabled = !shortLines.length;
  updateShortBtn();
  splitLines();
  buildHidden();
  updateMemPill();
  step = 0;
  idx = 0;
  rowChars = [];
  goTo(0);
}

function updateShortBtn() {
  showToggle(shortBtn, shortForm && !shortBtn.disabled, 'Short form', 'S');
  if (shortBtn.disabled) shortBtn.title = 'No short form for this litany';
}

function setShort(on) {
  if (src.length && !shortLines.length) return; // this litany has no short form
  shortForm = on;
  saveFlag('litany-short', on);
  if (!src.length) return updateShortBtn();
  const wasFinished = finished;
  loadForm();
  if (wasFinished) play();
}

function splitLines() {
  ({ lines, partSrc, partStart, partLen, partWord } = buildParts(src, splitOn ? splitWords : 0));
}
const partChars = (k) => rowChars[partSrc[k]].slice(partStart[k], partStart[k] + partLen[k]);

// Re-split after the setting changes, staying on the same source line.
function resplit() {
  if (!src.length) return;
  const row = partSrc[idx];
  splitLines();
  const target = partSrc.indexOf(row);
  step = moveStep(step, idx, target);
  idx = target;
  rowChars = [];
  if (!finished) goTo(idx);
}

function buildHidden() {
  memHidden = src.map((text) => (memorise ? hiddenWords(text, memLevel()) : new Set()));
}

function goTo(i) {
  const target = Math.max(0, Math.min(lines.length - 1, i));
  step = moveStep(step, idx, target);
  idx = target;
  phase = 'breath';
  half = 0;
  elapsed = 0;
  finished = false;
  readerEl.classList.remove('finished');
  endEl.classList.add('hidden');
  holdEl.classList.remove('hidden');
  cueEl.classList.remove('hidden');
  showPulse();
  renderLine();
  draw();
}

// Adds `text` to `container` and returns its character spans. Each word is an
// unbreakable group, so lines only wrap between words; a word too wide for the
// screen makes the font shrink instead. Words whose position (counted from
// `offset`) is in `hidden` are hidden for learning by heart: their letters get
// the class "mem", and any punctuation before or after stays visible.
function buildWords(text, container, hidden, offset = 0) {
  const out = [];
  const words = text.split(/\s+/);
  words.forEach((word, wi) => {
    const w = document.createElement('span');
    w.className = 'word';
    const chs = [...word];
    const [a, b] = hidden?.has(offset + wi) ? letterRange(chs) : [0, -1];
    // The hidden letters sit in one "gap" span, so the underline is a single line.
    const gap = b >= a ? document.createElement('span') : null;
    if (gap) gap.className = 'gap';
    chs.forEach((ch, ci) => {
      const s = document.createElement('span');
      s.textContent = ch;
      if (ci >= a && ci <= b) {
        s.className = 'mem';
        gap.appendChild(s);
        if (ci === a) w.appendChild(gap);
      } else {
        w.appendChild(s);
      }
      out.push(s);
    });
    container.appendChild(w);
    if (wi < words.length - 1) container.appendChild(document.createTextNode(' '));
  });
  return out;
}

const fadeIn = () => lineEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' });

// The dots under the title: one per line shown, filled up to and including this one.
function paintProgress() {
  if (progressEl.childElementCount !== lines.length) {
    progressEl.innerHTML = '';
    for (let k = 0; k < lines.length; k++) progressEl.appendChild(document.createElement('span'));
  }
  [...progressEl.children].forEach((dot, k) => {
    dot.classList.toggle('done', k <= idx);
    dot.classList.toggle('current', k === idx);
  });
  progressEl.setAttribute('aria-label', `Line ${idx + 1} of ${lines.length}`);
}

function renderLine() {
  revealKey = '';
  paintProgress();
  if (fullView) {
    if (!rowChars.length) buildAllRows();
    chars = partChars(idx);
    paintRows();
    return;
  }
  lineEl.classList.remove('full');
  lineEl.innerHTML = '';
  chars = buildWords(lines[idx], lineEl, memHidden[partSrc[idx]], partWord[idx]);
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
    return buildWords(text, row, memHidden[j]);
  });
  revealKey = '';
  if (author) {
    const a = document.createElement('div');
    a.className = 'author';
    a.textContent = `— ${author}`;
    lineEl.appendChild(a);
  }
  fitText();
  fadeIn();
}

// Parts already read keep a softer version of their breath colour; parts to come stay dim.
function paintRows() {
  rowEls.forEach((el, r) => {
    el.classList.toggle('current', r === partSrc[idx]);
  });
  for (let k = 0; k < lines.length; k++) {
    if (k === idx) continue; // draw() fills the current part
    const colour = k < idx ? mix(DIM, COL[pastKind(k, idx, step, aloud)], 0.5) : rgb(DIM);
    for (const c of partChars(k)) c.style.color = colour;
  }
}

function setFullView(on) {
  fullView = on;
  readerEl.classList.toggle('full-view', on);
  showToggle(viewBtn, on, 'Whole litany', 'V');
  saveFlag('litany-full', on);
  rowChars = [];
  if (lines.length) {
    renderLine();
    draw();
  }
}

// Largest font size that keeps the text within ~90% width and ~70% height.
function fitText() {
  const maxH = window.innerHeight * (fullView ? 0.72 : 0.7) - (fullView ? 80 : 110); // the stage's top padding
  let lo = 12,
    hi = 600;
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    lineEl.style.fontSize = `${mid}px`;
    const fits = lineEl.scrollHeight <= maxH && lineEl.scrollWidth <= lineEl.clientWidth + 1;
    if (fits) lo = mid;
    else hi = mid;
  }
  lineEl.style.fontSize = `${lo}px`;
  // The heartbeat heart sits behind the middle of the text.
  pulseEl.style.setProperty('--pulse-y', `${lineEl.offsetTop + lineEl.offsetHeight / 2}px`);
}

// One frame: the line's colour, the breath indicator and the word cue.
// p is how far through the current phase we are (0 to 1).
function draw() {
  const k = kind();
  const dur = phaseDuration();
  const p = dur > 0 ? Math.min(1, elapsed / dur) : 1;
  const eased = ease(p);
  const colour = rgb(COL[k]);
  paintLine(k, p, eased);
  paintIndicator(k, p, eased, dur, colour);
  paintCue(k, colour);
  paintPulse(colour);
  applyReveal();
}

// ---- Heartbeat ----
// Moves the heartbeat on by `ms`: the rate glides toward where the reader has got to.
function beatTick(ms) {
  beatDone = furthest(beatDone, step, lines.length);
  bpm = glide(bpm, bpmAt(beatDone), ms);
  beatAt = (beatAt + (ms * bpm) / 60000) % 1;
}
function paintPulse(colour) {
  if (!beatOn) return;
  pulseEl.style.color = colour;
  pulseEl.style.setProperty('--beat', beatPulse(beatAt).toFixed(3));
}
const showPulse = () => pulseEl.classList.toggle('hidden', !beatOn || finished || !lines.length);
function setBeat(on) {
  beatOn = on;
  showToggle(beatBtn, on, 'Heartbeat', 'B');
  beatBox.checked = on;
  saveFlag('litany-beat', on);
  showPulse();
  if (on && lines.length) draw();
}

function paintLine(k, p, eased) {
  const n = chars.length;
  if (aloud && k === 'in') {
    // Silent read: the whole line brightens evenly, ready to be spoken.
    const c = mix(DIM, PREVIEW, phase === 'breath' ? eased : 1);
    for (let i = 0; i < n; i++) chars[i].style.color = c;
    return;
  }
  // Fill left to right with a soft edge a few characters wide.
  const from = aloud ? PREVIEW : DIM;
  const edge = 3;
  const front = (phase === 'breath' ? p : 1) * (n + edge);
  for (let i = 0; i < n; i++) chars[i].style.color = mix(from, COL[k], fillAt(front, i, edge));
}

// The orb grows and shrinks with the breath; the hold arc draws round it.
function paintIndicator(k, p, eased, dur, colour) {
  orbEl.setAttribute('r', orbRadius(phase, k, eased).toFixed(2));
  orbEl.style.fill = colour;
  holdEl.classList.add('show');
  arcEl.style.stroke = HOLD; // one hold colour for both holds
  const arcOn = phase === 'hold' && dur > 0;
  arcEl.classList.toggle('on', arcOn);
  arcEl.style.strokeDashoffset = arcOn ? String(1 - p) : '1';
}

function paintCue(k, colour) {
  const word = cueWord(phase, k, aloud);
  if (cueEl.textContent !== word) cueEl.textContent = word;
  cueEl.style.color = colour;
  cueEl.classList.add('show');
}

// Learning by heart: hidden words come back in the hold after the line. In the
// whole-litany view, lines already read stay revealed and lines to come stay hidden.
function applyReveal() {
  if (!memorise || (fullView && !rowChars.length)) return;
  const now = revealNow(phase, aloud, half);
  const key = `${idx}:${now}`;
  if (key === revealKey) return;
  revealKey = key;
  if (!fullView) {
    for (const c of chars) c.classList.toggle('shown', now);
    return;
  }
  for (let k = 0; k < lines.length; k++) {
    const on = k < idx || (k === idx && now);
    for (const c of partChars(k)) c.classList.toggle('shown', on);
  }
}

// After each time through, hide more words next time.
function raiseMemLevel() {
  if (!memorise || memLevel() >= MEM_MAX) return;
  memLevels[memKey(currentId, usingShort())] = memLevel() + 1;
  saveObject('litany-mem-levels', memLevels);
  buildHidden();
  rowChars = []; // the whole-litany view is rebuilt with the new words hidden
  updateMemPill();
  toast(`Learn by heart: next time, ${MEM_TOAST[memLevel()]} will be hidden.`);
}

function advance() {
  const s = nextPhase({ phase, half, idx, step }, { aloud, count: lines.length, looping });
  if (s.event === 'end') {
    raiseMemLevel();
    finish();
    return;
  }
  ({ phase, half, idx, step } = s);
  elapsed = 0;
  if (s.event === 'loop') raiseMemLevel(); // one more time through
  if (s.event === 'line' || s.event === 'loop') renderLine();
}

function finish() {
  finished = true;
  pause();
  // The return link takes the place of the breath ring and cue (on phones it
  // moves above the line instead, clear of the toolbar).
  readerEl.classList.add('finished');
  holdEl.classList.add('hidden');
  cueEl.classList.add('hidden');
  showPulse();
  endEl.classList.remove('hidden');
}

function tick(ts) {
  if (!playing) return;
  if (lastTs == null) lastTs = ts;
  const ms = Math.min(100, ts - lastTs); // cap jumps, e.g. after the tab was hidden
  elapsed += ms;
  lastTs = ts;
  beatTick(ms);
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
  keepAwake(true);
}
function pause() {
  playing = false;
  keepAwake(false);
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  playBtn.innerHTML = '&#x25B6;&#xFE0E;';
}
function stop() {
  pause();
  lines = [];
  src = [];
}
const toggle = () => (playing ? pause() : play());
const prev = () => {
  if (finished) return goTo(lines.length - 1);
  if (idx === 0 && looping) {
    step--;
    idx = lines.length - 1;
    return goTo(idx);
  }
  goTo(idx - 1);
};
const next = () => {
  if (idx < lines.length - 1) goTo(idx + 1);
  else if (looping) {
    step++;
    idx = 0;
    goTo(0);
  } else finish();
};

// After the litany has ended, changing loop or read-aloud starts it again.
function restartIfFinished() {
  if (!finished || !lines.length) return false;
  play(); // play() goes back to the first line when finished
  return true;
}

function setLoop(on) {
  looping = on;
  showToggle(loopBtn, on, 'Loop', 'L');
  repeatPill.classList.toggle('on', on);
  repeatPill.setAttribute('aria-pressed', String(on));
  repeatPill.title = on ? 'Repeat: on (L)' : 'Read once (L)';
  saveFlag('litany-loop', on);
  if (on) restartIfFinished(); // turning loop on after the end starts it again from the top
}

function setAloud(on) {
  aloud = on;
  showToggle(aloudBtn, on, 'Read aloud', 'A');
  modePill.textContent = on ? 'Spoken' : 'Silent';
  modePill.classList.toggle('spoken', on);
  saveFlag('litany-aloud', on);
  // Restart the current line so it begins on an in-breath in the new mode.
  if (!restartIfFinished() && lines.length) goTo(idx);
}

// The heart in the reader toolbar, and in the top bar, for the open litany.
function updateFavBtn() {
  const on = currentId != null && favs.includes(currentId);
  favPill.classList.toggle('hidden', !on);
  showToggle(favBtn, on, 'Favourite', 'H');
}
const toggleCurrentFav = () => {
  if (currentId != null && toggleFav(currentId)) updateFavBtn();
};

// Learn-by-heart button (M) turns it on and off; the pill shows the level and
// steps through the levels when clicked.
function updateMemPill() {
  memPill.classList.toggle('hidden', !memorise);
  memPill.textContent = MEM_PILL[memLevel()];
}
// Starts the current line again with the words hidden afresh.
function rehide() {
  buildHidden();
  rowChars = [];
  updateMemPill();
  if (lines.length && !finished) goTo(idx);
}
function setMemorise(on) {
  memorise = on;
  showToggle(memBtn, on, 'Learn by heart', 'M');
  saveFlag('litany-mem', on);
  rehide();
}
function nextMemLevel() {
  memLevels[memKey(currentId, usingShort())] = (memLevel() % MEM_MAX) + 1;
  saveObject('litany-mem-levels', memLevels);
  rehide();
}

// Light / dark theme. The <head> script sets it before first paint; this keeps it in step.
const themeBtns = document.querySelectorAll('.btn-theme');
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  save('litany-theme', t);
  const label = t === 'dark' ? 'Switch to light mode (T)' : 'Switch to dark mode (T)';
  themeBtns.forEach((b) => {
    b.title = label;
    b.setAttribute('aria-label', label);
  });
  readColours();
  // Status bar and browser colour follow the page background.
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  if (lines.length && !readerEl.classList.contains('hidden')) {
    if (fullView && rowChars.length) paintRows();
    draw();
  }
}
const toggleTheme = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  // Missing on older iPads (before iPadOS 16.4) and on iPhone: do nothing there.
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

// ---- Start-up: show the saved settings and wire up the buttons ----
setLoop(looping);
setFullView(fullView);
updateShortBtn();
favBtn.innerHTML = HEART;
favPill.innerHTML = HEART.replace(/width="20" height="20"/, 'width="16" height="16"');
setAloud(aloud);
setMemorise(memorise);
setBeat(beatOn);
setTheme(document.documentElement.dataset.theme || 'dark');

loopBtn.onclick = () => setLoop(!looping);
repeatPill.onclick = () => setLoop(!looping);
viewBtn.onclick = () => setFullView(!fullView);
shortBtn.onclick = () => setShort(!shortForm);
favBtn.onclick = toggleCurrentFav;
favPill.onclick = toggleCurrentFav;
memBtn.onclick = () => setMemorise(!memorise);
memPill.onclick = nextMemLevel;
beatBtn.onclick = () => setBeat(!beatOn);
beatBox.addEventListener('change', () => setBeat(beatBox.checked));
aloudBtn.onclick = () => setAloud(!aloud);
modePill.onclick = () => setAloud(!aloud);
for (const b of themeBtns) b.onclick = toggleTheme;
playBtn.onclick = toggle;
$('btn-prev').onclick = prev;
$('btn-next').onclick = next;
$('btn-close').onclick = showIndex;
$('end-back').onclick = showIndex;

// ---- Showing the controls ----
// Only when the pointer is near the bottom; the cursor hides when idle.
let hideTimer = null,
  idleTimer = null;
const settingsOpen = () => !settingsEl.classList.contains('hidden');
const closeSettings = () => settingsEl.classList.add('hidden');
readerEl.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return; // touch screens use the tap below
  readerEl.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!settingsOpen()) readerEl.classList.add('idle');
  }, 2500);
  clearTimeout(hideTimer);
  if (e.clientY > window.innerHeight - 120 || settingsOpen()) controlsEl.classList.add('show');
  else hideTimer = setTimeout(() => controlsEl.classList.remove('show'), 600);
});
readerEl.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse' && !settingsOpen()) controlsEl.classList.remove('show');
});
// Touch screens have no pointer to move: a tap on the page shows or hides the
// controls, and they hide again after a few seconds untouched.
const autoHide = () => {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (!settingsOpen()) controlsEl.classList.remove('show');
  }, 5000);
};
readerEl.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'mouse') return;
  // A tap on a button, a line in the whole view, or the settings keeps the controls up a little longer.
  if (e.target.closest('button, input, label, #controls, #settings, #line.full .row')) {
    if (controlsEl.classList.contains('show')) autoHide();
    return;
  }
  if (controlsEl.classList.toggle('show')) autoHide();
  else clearTimeout(hideTimer);
});

// ---- Settings panel ----
const fields = { in: $('t-in'), hold1: $('t-hold1'), out: $('t-out'), hold2: $('t-hold2') };
const fillFields = () => {
  for (const k in fields) fields[k].value = timings[k];
};
for (const k in fields) {
  fields[k].addEventListener('input', () => {
    const v = parseFloat(fields[k].value);
    if (Number.isNaN(v)) return;
    timings[k] = clampTiming(k, v);
    saveObject('litany-timings', timings);
  });
}
const splitBox = $('t-split'),
  splitField = $('t-split-words');
const fillSplit = () => {
  splitBox.checked = splitOn;
  splitField.value = splitWords;
  splitField.disabled = !splitOn;
};
splitBox.addEventListener('change', () => {
  splitOn = splitBox.checked;
  saveFlag('litany-split', splitOn);
  fillSplit();
  resplit();
});
splitField.addEventListener('input', () => {
  const v = parseInt(splitField.value, 10);
  if (Number.isNaN(v)) return;
  splitWords = Math.max(4, Math.min(40, v));
  save('litany-split-words', String(splitWords));
  if (splitOn) resplit();
});
$('btn-settings').onclick = () => {
  fillFields();
  fillSplit();
  settingsEl.classList.toggle('hidden');
};
// A click anywhere outside the panel (other than the gear itself) closes it.
document.addEventListener('click', (e) => {
  if (settingsOpen() && !settingsEl.contains(e.target) && !$('btn-settings').contains(e.target)) closeSettings();
});
$('t-done').onclick = closeSettings;
$('t-reset').onclick = () => {
  timings = { ...DEFAULT_TIMINGS };
  saveObject('litany-timings', timings);
  fillFields();
};

// ---- Keyboard ----
// Letter keys work in either case. T works everywhere, the rest only in the reader.
const KEYS = new Map([
  [
    ' ',
    (e) => {
      e.preventDefault();
      toggle();
    },
  ],
  ['ArrowLeft', prev],
  ['ArrowRight', next],
  [
    'Escape',
    () => {
      if (settingsOpen()) closeSettings();
      else if (!document.fullscreenElement) showIndex();
    },
  ],
  ['l', () => setLoop(!looping)],
  ['v', () => setFullView(!fullView)],
  ['s', () => setShort(!shortForm)],
  ['a', () => setAloud(!aloud)],
  ['h', toggleCurrentFav],
  ['m', () => setMemorise(!memorise)],
  ['b', () => setBeat(!beatOn)],
  ['f', toggleFullscreen],
]);
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') {
    if (e.key === 'Escape') closeSettings();
    return;
  }
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === 't') return toggleTheme();
  if (!readerEl.classList.contains('hidden')) KEYS.get(key)?.(e);
});

window.addEventListener('resize', () => {
  if (lines.length) fitText();
});
showIndex();
