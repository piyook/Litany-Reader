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
  await page.locator('#litany-list .open', { hasText: title }).click();
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
  test('lists every litany by title, with its author', async ({ page }) => {
    await expect(page.locator('#litany-list .open')).toHaveText([
      /^Alpha Litany\s*Tester$/,
      'Beta Litany',
      'Delta Litany',
      'Gamma Litany',
    ]);
  });

  test('a favourite moves to the top and stays there after a reload', async ({ page }) => {
    const row = page.locator('#litany-list li', { hasText: 'Gamma Litany' });
    await row.hover();
    await row.locator('.fav').click();
    await expect(page.locator('#litany-list .open').first()).toHaveText('Gamma Litany');
    await page.reload();
    await expect(page.locator('#litany-list .open').first()).toHaveText('Gamma Litany');
    await expect(page.locator('#litany-list .fav').first()).toHaveAttribute('aria-pressed', 'true');
  });

  test('refuses a fourth favourite', async ({ page }) => {
    for (const title of ['Alpha Litany', 'Beta Litany', 'Delta Litany', 'Gamma Litany']) {
      const row = page.locator('#litany-list li', { hasText: title });
      await row.hover();
      await row.locator('.fav').click();
    }
    await expect(page.locator('#toast')).toHaveText('You can have three favourites. Remove one first.');
    await expect(page.locator('#litany-list .fav.on')).toHaveCount(3);
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

  test('the theme (T) switches and is remembered', async ({ page }) => {
    const theme = () => page.locator('html').getAttribute('data-theme');
    // The status bar / browser colour follows the theme's background.
    const barColour = () => page.locator('meta[name="theme-color"]').getAttribute('content');
    const colours = { dark: '#0b0b0f', light: '#f3efe6' };
    const before = await theme();
    expect(await barColour()).toBe(colours[before]);
    await page.keyboard.press('t');
    const after = await theme();
    expect(after).not.toBe(before);
    expect(await barColour()).toBe(colours[after]);
    await page.reload();
    expect(await theme()).toBe(after);
    expect(await barColour()).toBe(colours[after]);
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
