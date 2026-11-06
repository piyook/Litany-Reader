// Keeps the screen awake while a litany plays. Browsers allow this only over
// https or on localhost; elsewhere it quietly does nothing.

let wakeLock = null,
  wantAwake = false,
  requesting = false;

export function keepAwake(on) {
  wantAwake = on;
  if (!('wakeLock' in navigator)) return;
  if (!on) {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
    return;
  }
  if (wakeLock || requesting || document.visibilityState !== 'visible') return;
  requesting = true;
  navigator.wakeLock.request('screen').then(
    (lock) => {
      requesting = false;
      if (!wantAwake) {
        lock.release().catch(() => {});
        return;
      }
      wakeLock = lock;
      lock.addEventListener('release', () => {
        if (wakeLock === lock) wakeLock = null;
      });
    },
    () => {
      requesting = false;
    },
  );
}

// The browser drops the lock when the tab is hidden; take it again on return.
document.addEventListener('visibilitychange', () => {
  if (wantAwake && document.visibilityState === 'visible') keepAwake(true);
});
