// A soft heartbeat sound, "lub-dub", made by the browser (no audio file).
//
// The beat is drawn once with the browser's audio engine, turned into a short
// WAV in memory and played with an ordinary audio player. Played straight from
// the audio engine, it was silent on some Android phone speakers (fine on
// headphones); played as media, like any sound file, it is heard there too.
//
// Browsers only allow sound after a tap or key press, so the players are
// started on the first one.
//
// A few players take turns, and each is wound back once it has finished. Older
// iOS winds back slowly and not quite to the start: wound back just before
// playing, the beat came in late and lost its opening click.

const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
const RATE = 44100;
const LENGTH = 0.45; // seconds: both thumps and their fade
const PLAYERS = 3;

let players = null,
  turn = 0,
  url = null,
  gainNow = -1,
  ready = Promise.resolve(),
  unlocked = false;

const audioEls = () => {
  if (!players && typeof Audio !== 'undefined') {
    players = Array.from({ length: PLAYERS }, () => {
      const p = new Audio();
      p.preload = 'auto';
      p.addEventListener('ended', () => {
        p.currentTime = 0;
      });
      return p;
    });
  }
  return players;
};

// One soft thump at `at` seconds. The pitch falls from about 110Hz to 45Hz:
// deep enough to feel like a heartbeat.
function thump(a, at, loudness) {
  const osc = a.createOscillator();
  const filter = a.createBiquadFilter();
  const gain = a.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(110, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
  filter.type = 'lowpass';
  filter.frequency.value = 350;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(loudness, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  osc.connect(filter).connect(gain).connect(a.destination);
  osc.start(at);
  osc.stop(at + 0.2);
}

// 16-bit mono WAV of the samples, taken `rate` times a second.
function wav(samples, rate) {
  const n = samples.length;
  const view = new DataView(new ArrayBuffer(44 + n * 2));
  const text = (at, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

// One heartbeat, a thump then a softer one just after, at `gain`
// (1 the original quiet level, about 2.6 the loudest that doesn't distort).
async function renderBeat(gain) {
  const a = new OAC(1, Math.ceil(RATE * LENGTH), RATE);
  thump(a, 0.01, 0.35 * gain);
  thump(a, 0.17, 0.2 * gain);
  const buffer = await a.startRendering();
  // Older iOS may draw at its own rate (often 48000) rather than the one asked
  // for; labelling the WAV with the asked-for rate then plays it slow and deep.
  return wav(buffer.getChannelData(0), buffer.sampleRate || a.sampleRate || RATE);
}

// Sets how loud the beat plays, drawing it afresh when the level changes.
export function setSoundGain(gain) {
  const ps = audioEls();
  if (!OAC || !ps || gain === gainNow) return;
  gainNow = gain;
  if (gain <= 0) return;
  ready = renderBeat(gain)
    .then((blob) => {
      if (gain !== gainNow) return; // a newer level has taken over
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      for (const p of ps) p.src = url;
    })
    .catch(() => {});
}

// Lets the players make sound: browsers allow it once each has played during a
// tap or key press. Chrome on Android only counts a finished tap (the finger
// lifting, or a click), so listen for all of them until it works.
export function readySound() {
  const unlockOne = (p) => {
    p.muted = true;
    return p.play().then(
      () => {
        p.pause();
        p.currentTime = 0;
        p.muted = false;
      },
      (err) => {
        p.muted = false;
        throw err;
      },
    );
  };
  const unlock = () => {
    const ps = audioEls();
    if (unlocked || !ps?.[0].src) return;
    Promise.all(ps.map(unlockOne)).then(
      () => {
        unlocked = true;
      },
      () => {},
    );
  };
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    document.addEventListener(type, unlock, { passive: true });
  }
}

// Plays one heartbeat at the level last set.
export function playBeat() {
  const ps = audioEls();
  if (!ps || gainNow <= 0) return;
  ready.then(() => {
    const p = ps[turn];
    turn = (turn + 1) % ps.length;
    if (!p.src) return;
    p.muted = false;
    // Normally already wound back when it ended; only if it hasn't (cut short,
    // or a new level just loaded) wind it back here.
    if (p.currentTime > 0) p.currentTime = 0;
    p.play().catch(() => {});
  });
}
