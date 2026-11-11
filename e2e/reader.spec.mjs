import { expect, test } from '@playwright/test';

// Short timings so a litany plays through in a few seconds. Only set when the
// test has not saved its own, so reload tests keep what they changed.
const FAST = { in: 0.6, hold1: 0.2, out: 0.6, hold2: 0.2 };

test.beforeEach(async ({ page }) => {
  await page.addInitScript((fast) => {
    if (!localStorage.getItem('litany-timings')) localStorage.setItem('litany-timings', JSON.stringify(fast));
  }, FAST);
  await page.goto('./');
});

const open = async (page, title) => {
  // .first(): a favourite is listed twice, under Favourites and in its group.
  await page.locator('#litany-list .open', { hasText: title }).first().click();
  await expect(page.locator('#reader')).toBeVisible();
};
// Every cue word shown so far, in order, so short phases are not missed.
const recordCues = (page) =>
  page.evaluate(() => {
    const cue = document.getElementById('cue');
    window.cues = [cue.textContent];
    new MutationObserver(() => {
      if (window.cues.at(-1) !== cue.textContent) window.cues.push(cue.textContent);
    }).observe(cue, { childList: true, characterData: true, subtree: true });
  });
const cues = (page) => page.evaluate(() => window.cues);
const line = (page) => page.locator('#line');
// The toolbar only shows when the mouse is near the bottom of the screen.
const showControls = async (page) => {
  const { height } = page.viewportSize();
  await page.mouse.move(300, height - 40);
  await expect(page.locator('#controls')).toHaveClass(/show/);
};

test.describe('index', () => {
  test('lists every litany by title, with its opening line and (authors differ here) its author', async ({ page }) => {
    await expect(page.locator('#litany-list .key')).toHaveText([
      'Alpha Litany',
      'Beta Litany',
      'Delta Litany',
      'Gamma Litany',
    ]);
    const alpha = page.locator('#litany-list li', { hasText: 'Alpha Litany' });
    await expect(alpha.locator('.first')).toHaveText('First line of alpha.');
    await expect(alpha.locator('.author-tag')).toHaveText('Tester');
    // None of these titles start "Litany against / for / of", so they share one
    // section, which stays open: folding the only group would hide everything.
    await expect(page.locator('#litany-list h2')).toHaveText(['Litanies']);
    await expect(page.locator('#litany-list .toggle')).toHaveCount(0);
  });

  test('no row is picked out when the page opens', async ({ page }) => {
    await expect(page.locator('#litany-list .key').first()).toBeVisible();
    await expect(page.locator('#litany-list :focus')).toHaveCount(0);
  });

  test('a favourite shows under the always-open Favourites, stays in its group too, and is remembered', async ({
    page,
  }) => {
    await page.locator('#litany-list li', { hasText: 'Gamma Litany' }).locator('.fav').click();
    const favs = page.locator('#litany-list [data-group="fav"]');
    const inGroup = page.locator('#litany-list [data-group="more"] li', { hasText: 'Gamma Litany' });
    await expect(favs.locator('.key')).toHaveText(['Gamma Litany']);
    await expect(inGroup.locator('.fav')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(favs.locator('.key')).toHaveText(['Gamma Litany']);
    await expect(favs.locator('.fav')).toHaveAttribute('aria-pressed', 'true');
    await expect(inGroup.locator('.fav')).toHaveAttribute('aria-pressed', 'true');
    await expect(favs.locator('.toggle')).toHaveCount(0); // nothing to fold
  });

  test('a favourite shows a small heart after its title, for information only', async ({ page }) => {
    await open(page, 'Alpha Litany');
    const heart = page.locator('#reader-title .title-fav');
    await expect(heart).toHaveCount(0);
    await page.keyboard.press('h');
    await expect(heart).toBeVisible();
    await expect(page.locator('#reader-title button')).toHaveCount(0); // not something to click
    await page.keyboard.press('h');
    await expect(heart).toHaveCount(0);
  });

  test('refuses a fourth favourite', async ({ page }) => {
    for (const title of ['Alpha Litany', 'Beta Litany', 'Delta Litany', 'Gamma Litany']) {
      const row = page.locator('#litany-list li', { hasText: title });
      await row.locator('.fav').click();
    }
    await expect(page.locator('#toast')).toHaveText('You can have three favourites. Remove one first.');
    await expect(page.locator('#litany-list [data-group="fav"] li')).toHaveCount(3);
  });
});

// Real titles, so the litanies fall into the folding groups. The offline helper is
// kept out of the way so the made-up index is what the page sees, reload included.
test.describe('index groups', () => {
  test.use({ serviceWorkers: 'block' });
  const items = [
    { id: 'alpha.txt', title: 'Litany Against Fear', author: '', first: 'Fear does not rule me.' },
    { id: 'beta.txt', title: 'Litany Against Worry', author: '', first: 'I will not live tomorrow today.' },
    { id: 'gamma.txt', title: 'Litany for Calm', author: '', first: 'I am the centre of the storm.' },
  ];
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/index.json', (r) => r.fulfill({ json: items }));
    await page.reload();
  });

  test('groups start folded, showing what is in them, and open on a click, remembered', async ({ page }) => {
    const sec = page.locator('#litany-list [data-group="against"]');
    const toggle = sec.locator('.toggle');
    await expect(page.locator('#litany-list .all-head')).toHaveText('All litanies');
    await expect(page.locator('#litany-list .toggle .label')).toHaveText(['Holding steady', 'Every day']);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(sec.locator('.summary')).toHaveText('Fear, Worry');
    await expect(sec.locator('.key').first()).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(sec.locator('.key')).toHaveText(['Fear', 'Worry']);
    await expect(sec.locator('.prefix').first()).toHaveText('Litany Against');
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#litany-list [data-group="toward"] .toggle')).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(sec.locator('.key').first()).toBeHidden();
  });
});

test.describe('reading', () => {
  test('shows the title, then each line in turn with its breathing cue, then the end', async ({ page }) => {
    await open(page, 'Beta Litany');
    await recordCues(page);
    await expect(page.locator('#reader-title')).toHaveText('Beta Litany');
    await expect(line(page)).toHaveText('Beta is calm.');
    await expect(line(page)).toHaveText('Beta is steady.');
    await expect(page.locator('#end')).toBeVisible();
    expect(await cues(page)).toEqual(['breathe in', 'hold', 'breathe out', 'hold']);
    await page.locator('#end-back').click();
    await expect(page.locator('#index')).toBeVisible();
  });

  test('space pauses, and the arrow keys move between lines', async ({ page }) => {
    await open(page, 'Alpha Litany');
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowRight');
    await expect(line(page)).toHaveText('Second line of alpha.');
    await page.keyboard.press('ArrowRight');
    await expect(line(page)).toHaveText('Third line of alpha.');
    await page.keyboard.press('ArrowLeft');
    await expect(line(page)).toHaveText('Second line of alpha.');
    // Paused, so it stays on that line.
    await page.waitForTimeout(2000);
    await expect(line(page)).toHaveText('Second line of alpha.');
  });

  test('the toolbar buttons appear near the bottom and work', async ({ page }) => {
    await open(page, 'Alpha Litany');
    await showControls(page);
    await page.locator('#btn-play').click(); // pause
    // A slower browser may already be on the second line when it pauses, so start from there.
    const lines = ['First line of alpha.', 'Second line of alpha.', 'Third line of alpha.'];
    const at = lines.indexOf(await line(page).textContent());
    expect(at).toBeLessThan(2);
    await page.locator('#btn-next').click();
    await expect(line(page)).toHaveText(lines[at + 1]);
    await page.locator('#btn-prev').click();
    await expect(line(page)).toHaveText(lines[at]);
    await page.locator('#btn-close').click();
    await expect(page.locator('#index')).toBeVisible();
  });

  test('Escape goes back to the index', async ({ page }) => {
    await open(page, 'Alpha Litany');
    await page.keyboard.press('Escape');
    await expect(page.locator('#index')).toBeVisible();
    await expect(page.locator('#reader')).toBeHidden();
  });

  test('the dots show how many lines there are and fill up to the current one', async ({ page }) => {
    await open(page, 'Alpha Litany');
    await page.keyboard.press(' '); // pause
    const dots = page.locator('#progress span');
    await expect(dots).toHaveCount(3);
    await expect(page.locator('#progress span.done')).toHaveCount(1);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#progress span.done')).toHaveCount(2);
    await expect(dots.nth(1)).toHaveClass(/current/);
    await expect(page.locator('#progress')).toHaveAttribute('aria-label', 'Line 2 of 3');
    await page.keyboard.press('v');
    await expect(page.locator('#progress')).toBeHidden();
  });

  test('the breath ring stays in the same place whatever the line and view', async ({ page }) => {
    await open(page, 'Alpha Litany');
    await page.keyboard.press(' ');
    const ringY = async () => (await page.locator('#hold').boundingBox()).y;
    const first = await ringY();
    await page.keyboard.press('ArrowRight');
    expect(await ringY()).toBeCloseTo(first, 0);
    await page.keyboard.press('v'); // whole litany
    expect(await ringY()).toBeCloseTo(first, 0);
  });

  test('on a phone, the return link sits above the last line at the end', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await open(page, 'Beta Litany');
    await expect(page.locator('#end')).toBeVisible();
    const link = await page.locator('#end-back').boundingBox();
    const text = await line(page).boundingBox();
    expect(link.y + link.height).toBeLessThan(text.y);
  });

  test('loop (L) starts again from the first line instead of ending', async ({ page }) => {
    await open(page, 'Beta Litany');
    await page.keyboard.press('l');
    await expect(page.locator('#repeat-pill')).toHaveAttribute('aria-pressed', 'true');
    await expect(line(page)).toHaveText('Beta is steady.');
    await expect(line(page)).toHaveText('Beta is calm.');
    await expect(page.locator('#end')).toBeHidden();
  });
});

test.describe('modes', () => {
  test('whole litany (V) shows every line, and a click jumps to one', async ({ page }) => {
    await open(page, 'Alpha Litany');
    await page.keyboard.press('v');
    const rows = page.locator('#line .row');
    await expect(rows).toHaveCount(3);
    await expect(page.locator('#line .author')).toHaveText('— Tester');
    await page.keyboard.press(' ');
    await rows.nth(2).click();
    await expect(rows.nth(2)).toHaveClass(/current/);
    await page.keyboard.press('v');
    await expect(rows).toHaveCount(0);
    await expect(line(page)).toHaveText('Third line of alpha.');
  });

  test('short form (S) switches to the quick version, where there is one', async ({ page }) => {
    await open(page, 'Alpha Litany');
    await page.keyboard.press('s');
    await expect(page.locator('#reader-title')).toHaveText('Alpha Litany · short');
    await expect(line(page)).toHaveText('Short alpha one.');
    await page.keyboard.press('Escape');
    await open(page, 'Beta Litany');
    await expect(page.locator('#btn-short')).toBeDisabled();
    await expect(page.locator('#reader-title')).toHaveText('Beta Litany');
  });

  test('read aloud (A) reads in silence breathing in, then speaks breathing out', async ({ page }) => {
    await open(page, 'Alpha Litany');
    await page.keyboard.press('a');
    await recordCues(page);
    await expect(page.locator('#mode-pill')).toHaveText('Spoken');
    await expect(line(page)).toHaveText('Second line of alpha.');
    // The first line took a whole breath: read in silence, hold, speak, hold.
    expect((await cues(page)).slice(0, 4)).toEqual(['breathe in', 'hold', 'speak', 'hold']);
  });

  test('learn by heart (M) hides words, and the pill raises the level', async ({ page }) => {
    await open(page, 'Alpha Litany');
    await page.keyboard.press('m');
    const pill = page.locator('#mem-pill');
    await expect(pill).toHaveText('Hide 25%');
    await expect(page.locator('#line .mem').first()).toBeAttached();
    const hidden = await page.locator('#line .mem').count();
    await pill.click();
    await expect(pill).toHaveText('Hide 50%');
    expect(await page.locator('#line .mem').count()).toBeGreaterThan(hidden);
    await page.keyboard.press('m');
    await expect(pill).toBeHidden();
    await expect(page.locator('#line .mem')).toHaveCount(0);
  });

  test('heartbeat (B) is off at first, beats when on, and is remembered', async ({ page }) => {
    await open(page, 'Alpha Litany');
    const pulse = page.locator('#pulse');
    const box = page.locator('#t-beat');
    await expect(pulse).toBeHidden();
    await page.keyboard.press('b');
    await expect(pulse).toBeVisible();
    await expect(page.locator('#btn-beat')).toHaveAttribute('aria-pressed', 'true');
    // It beats: the heart fades in and out over a second or so.
    const beat = () => pulse.evaluate((el) => el.style.getPropertyValue('--beat'));
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      seen.add(await beat());
      await page.waitForTimeout(100);
    }
    expect(seen.size).toBeGreaterThan(2);
    // The settings checkbox agrees, and turns it off too.
    await showControls(page);
    await page.locator('#btn-settings').click();
    await expect(box).toBeChecked();
    await box.uncheck();
    await expect(pulse).toBeHidden();
    await expect(page.locator('#btn-beat')).toHaveAttribute('aria-pressed', 'false');
    await box.check();
    await page.reload();
    await open(page, 'Alpha Litany');
    await expect(pulse).toBeVisible();
  });

  test('the top bar switches the heartbeat and mutes its sound', async ({ page }) => {
    await open(page, 'Alpha Litany');
    const beatPill = page.locator('#beat-pill');
    const soundPill = page.locator('#sound-pill');
    await expect(beatPill).toHaveAttribute('aria-pressed', 'false');
    await expect(soundPill).toHaveAttribute('aria-pressed', 'false');
    await beatPill.click();
    await expect(page.locator('#pulse')).toBeVisible();
    await expect(page.locator('#btn-beat')).toHaveAttribute('aria-pressed', 'true');
    await soundPill.click();
    await expect(soundPill).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#t-beat-sound')).toBeChecked();
    await soundPill.click(); // mute
    await expect(page.locator('#t-beat-sound')).not.toBeChecked();
    await beatPill.click();
    await expect(page.locator('#pulse')).toBeHidden();
  });

  test('heartbeat sound and heart rates are set in the settings and remembered', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, 'Alpha Litany');
    await showControls(page);
    await page.locator('#btn-settings').click();
    // The app's version sits at the foot of the panel.
    await expect(page.locator('#app-version')).toHaveText(/^Version \d+\.\d+\.\d+$/);
    const box = page.locator('#t-beat-sound');
    await expect(box).not.toBeChecked();
    await box.check();
    // The heart rates start at 60 and 20, and a change is saved.
    await expect(page.locator('#t-hr-start')).toHaveValue('60');
    await expect(page.locator('#t-hr-end')).toHaveValue('20');
    await page.locator('#t-hr-end').fill('35');
    // Volume starts at 70 and is saved when moved.
    const volume = page.locator('#t-beat-volume');
    await expect(volume).toHaveValue('70');
    await volume.fill('90');
    expect(await page.evaluate(() => localStorage.getItem('litany-beat-volume'))).toBe('90');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('litany-heart-rates')))).toEqual({
      start: 60,
      end: 35,
    });
    await page.locator('#t-done').click();
    await page.waitForTimeout(2000); // a couple of beats play without errors
    expect(errors).toEqual([]);
    await page.reload();
    await open(page, 'Alpha Litany');
    await showControls(page);
    await page.locator('#btn-settings').click();
    await expect(box).toBeChecked();
    await expect(page.locator('#t-hr-end')).toHaveValue('35');
    await expect(page.locator('#t-beat-volume')).toHaveValue('90');
  });

  test('the theme picker (T) changes the theme and it is remembered', async ({ page }) => {
    const theme = () => page.locator('html').getAttribute('data-theme');
    // The status bar / browser colour follows the theme's background.
    const barColour = () => page.locator('meta[name="theme-color"]').getAttribute('content');
    const popup = page.locator('#theme-popup');
    const rows = page.locator('.theme-opt');
    // Nothing saved yet and a dark system: the default theme, Dusk.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => localStorage.removeItem('litany-theme'));
    await page.reload();
    expect(await theme()).toBe('dusk');
    expect(await barColour()).toBe('#0b0b0f');
    await expect(popup).toBeHidden();

    await page.keyboard.press('t');
    await expect(popup).toBeVisible();
    await expect(rows).toHaveCount(6);
    await expect(page.locator('.theme-opt[aria-checked="true"]')).toHaveAttribute('data-theme', 'dusk');
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();

    await page.locator('.index-head .btn-theme').click();
    await page.locator('.theme-opt[data-theme="forest"]').click();
    await expect(popup).toBeHidden();
    expect(await theme()).toBe('forest');
    expect(await barColour()).toBe('#0c140f');

    await page.reload();
    expect(await theme()).toBe('forest');
    expect(await barColour()).toBe('#0c140f');
    await page.keyboard.press('t');
    await page.keyboard.press('ArrowDown'); // from Forest to the next row, Parchment
    await page.keyboard.press('Enter');
    expect(await theme()).toBe('parchment');
  });

  test('themes saved as dark or light before themes existed still work', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('litany-theme', 'light'));
    await page.reload();
    expect(await page.locator('html').getAttribute('data-theme')).toBe('dawn');
  });
});

test.describe('settings', () => {
  test('timings are saved, and reset puts them back', async ({ page }) => {
    await open(page, 'Alpha Litany');
    await showControls(page);
    await page.locator('#btn-settings').click();
    await expect(page.locator('#settings')).toBeVisible();
    await page.locator('#t-out').fill('9');
    await page.locator('#t-done').click();
    await expect(page.locator('#settings')).toBeHidden();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('litany-timings')));
    expect(saved.out).toBe(9);

    await showControls(page);
    await page.locator('#btn-settings').click();
    await page.locator('#t-reset').click();
    await expect(page.locator('#t-out')).toHaveValue('6');
  });

  test('splitting long lines breaks a line at its pause', async ({ page }) => {
    await open(page, 'Alpha Litany');
    await page.keyboard.press(' ');
    await showControls(page);
    await page.locator('#btn-settings').click();
    await page.locator('#t-split').check();
    await page.locator('#t-split-words').fill('4');
    await page.keyboard.press('Escape');
    // "First line of alpha." has no pause, so it stays whole.
    await expect(line(page)).toHaveText('First line of alpha.');
  });
});

test.describe('on a phone', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 780 } });

  test('a tap shows the toolbar and another hides it', async ({ page }) => {
    await page.locator('#litany-list .open', { hasText: 'Beta Litany' }).tap();
    const controls = page.locator('#controls');
    await page.locator('#line').tap();
    await expect(controls).toHaveClass(/show/);
    await page.locator('#line').tap();
    await expect(controls).not.toHaveClass(/show/);
  });
});

test('works offline once it has been opened', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now the offline helper answers for the page
  await expect(page.locator('#litany-list .open')).toHaveCount(4);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#litany-list .open')).toHaveCount(4);
  await open(page, 'Delta Litany');
  await expect(line(page)).toHaveText('Delta one.');
});
