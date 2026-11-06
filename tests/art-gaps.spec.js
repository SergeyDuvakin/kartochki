const { test, expect } = require('@playwright/test');
const { boot, makeJpeg, openManual, chooseFile } = require('./helpers');

async function hit(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const box = await page.locator(selector).boundingBox();
  expect(box, selector).toBeTruthy();
  expect(Math.round(box.height), selector + ' height').toBeGreaterThanOrEqual(44);
  expect(Math.round(box.width), selector + ' width').toBeGreaterThanOrEqual(44);
  const view = page.viewportSize();
  expect(box.y, selector + ' top').toBeGreaterThanOrEqual(-1);
  expect(box.y + box.height, selector + ' bottom').toBeLessThanOrEqual(view.height + 1);
  expect(box.x, selector + ' left').toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, selector + ' right').toBeLessThanOrEqual(view.width + 1);
}

test('tap targets, safe area and a short keyboard viewport keep controls reachable', async ({ page }) => {
  await boot(page, { empty: true });
  await openManual(page, 'Тест');
  await page.locator('#artRow').scrollIntoViewIfNeeded();
  await hit(page, '#artRow');
  await hit(page, '#edCancel');
  await hit(page, '#form button[type="submit"]');
  await page.click('#artRow');
  await page.locator('#art:not(.hidden)').waitFor();
  await page.waitForTimeout(650);
  await hit(page, '#artBack');
  await hit(page, '#artDone');
  await hit(page, '#artModeColor');
  await hit(page, '#artModeImage');
  await hit(page, '#lookRow');
  await hit(page, '#artColors button >> nth=0');
  await page.click('#artModeImage');
  await hit(page, '#artPick');
  const jpeg = await makeJpeg(page, 720, 480);
  await chooseFile(page, '#artPick', jpeg);
  await page.locator('#crop:not(.hidden)').waitFor();
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--tg-safe-area-inset-top', '59px');
    document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', '34px');
  });
  await hit(page, '#cropCancel');
  await hit(page, '#cropDone');
  await hit(page, '#cropReset');
  await hit(page, '#cropZoom');
  const pad = await page.locator('.cropbar').evaluate(el => ({
    top: parseFloat(getComputedStyle(el).paddingTop),
    bottom: parseFloat(getComputedStyle(el).paddingBottom),
  }));
  expect(pad.top).toBeGreaterThanOrEqual(59);
  const scalePad = await page.locator('.cropscale').evaluate(el => parseFloat(getComputedStyle(el).paddingBottom));
  expect(scalePad).toBeGreaterThanOrEqual(34);
  await page.click('#cropDone');
  await page.setViewportSize({ width: 390, height: 480 });
  await page.locator('#artDel').scrollIntoViewIfNeeded();
  await hit(page, '#artDel');
  await hit(page, '#artReplace');
  await hit(page, '#artBack');
  await page.locator('#art .sheet').evaluate(el => { el.scrollTop = 0; });
  await page.locator('#fName').scrollIntoViewIfNeeded();
  await page.focus('#fName');
  const field = await page.locator('#fName').boundingBox();
  expect(field.y).toBeGreaterThanOrEqual(0);
  expect(field.y + field.height).toBeLessThanOrEqual(480);
});

test('nested save writes the editor draft and leaves the stored card alone', async ({ page }) => {
  await boot(page, { empty: true });
  await openManual(page, 'Черновик');
  await page.locator('#form button[type="submit"]').click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  await page.locator('#stack .card').click();
  await page.locator('#viewer:not(.hidden)').waitFor();
  await page.click('#editBtn');
  await page.locator('#editor:not(.hidden)').waitFor();
  const before = await page.evaluate(() => {
    const c = window.__app.cards()[0];
    return { color: c.color, uses: c.uses || 0, order: c.order, bg: c.bg || 0, stored: localStorage.getItem('c_' + c.id), manual: localStorage.getItem('manualOrder') };
  });
  await page.click('#artRow');
  await page.click('#artColors button[data-c="#aec3ee"]');
  await page.click('#artBack');
  await page.click('#confirm [data-ans="save"]');
  await expect(page.locator('#art')).toBeHidden();
  await expect(page.locator('#editor:not(.hidden)')).toBeVisible();
  await expect(page.locator('#confirm')).toBeHidden();
  const mid = await page.evaluate(() => {
    const c = window.__app.cards()[0];
    const preview = document.querySelector('#edPreview').style.background;
    return { color: c.color, uses: c.uses || 0, order: c.order, bg: c.bg || 0, stored: localStorage.getItem('c_' + c.id), preview, touched: window.__app.art.draft().touched };
  });
  expect(mid.color).toBe(before.color);
  expect(mid.uses).toBe(before.uses);
  expect(mid.order).toBe(before.order);
  expect(mid.bg).toBe(0);
  expect(mid.stored).toBe(before.stored);
  expect(mid.touched).toBe(true);
  expect(mid.preview).toContain('174, 195, 238');
  await page.click('#edCancel');
  await page.click('#confirm [data-ans="discard"]');
  const kept = await page.evaluate(() => window.__app.cards()[0].color);
  expect(kept).toBe(before.color);
});

test('cancel, a broken photo and a bad HEIC keep the current background', async ({ page }) => {
  await boot(page, { empty: true });
  const jpeg = await makeJpeg(page, 800, 520);
  await openManual(page, 'Фон');
  await page.click('#artRow');
  await page.click('#artModeImage');
  await chooseFile(page, '#artPick', jpeg);
  await page.locator('#crop:not(.hidden)').waitFor();
  await page.click('#cropDone');
  const kept = await page.evaluate(() => window.__app.art.session().bytes);
  await page.evaluate(() => document.querySelector('#artFile').dispatchEvent(new Event('change')));
  expect(await page.evaluate(() => window.__app.art.session().bytes)).toBe(kept);
  await expect(page.locator('#crop')).toBeHidden();
  const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xd9]), Buffer.alloc(48, 1)]);
  await chooseFile(page, '#artReplace', broken, 'broken.jpg', 'image/jpeg');
  await expect(page.locator('#artMsg')).toContainText('Не удалось прочитать');
  await expect(page.locator('#crop')).toBeHidden();
  expect(await page.evaluate(() => window.__app.art.session().bytes)).toBe(kept);
  await chooseFile(page, '#artReplace', Buffer.alloc(96, 9), 'IMG_2041.HEIC', 'image/heic');
  await expect(page.locator('#artMsg')).toContainText('HEIC');
  await expect(page.locator('#crop')).toBeHidden();
  expect(await page.evaluate(() => window.__app.art.session().bytes)).toBe(kept);
  await expect(page.locator('#artPreview')).toHaveClass(/has-bg/);
});

test('wipe, restore, delete and a conflicting backup do not leak or mix backgrounds', async ({ page }) => {
  page.on('dialog', async d => { await d.accept(); });
  await boot(page, { empty: true });
  const jpeg = await makeJpeg(page, 700, 460);
  const other = await makeJpeg(page, 460, 700);
  const seeded = await page.evaluate(async ({ a, b }) => {
    const prep = async (bytes, name) => window.__app.art.prepareArt(new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' }));
    const A = await prep(a, 'a.jpg');
    const B = await prep(b, 'b.jpg');
    const card = { id: 'keep', name: 'Фон', number: '4242', format: 'Code128', color: '#f9c5d5', order: 0, uses: 2, upd: 100, bg: 1, crop: A.crop, bw: A.w, bh: A.h, tone: A.tone, display: '' };
    window.__app.cards().push(card);
    await window.__app.backup.bgPut('keep', A.blob);
    await window.__app.backup.photoPut('keep', new Blob(['scan-kept'], { type: 'image/jpeg' }));
    const file = await window.__app.backup.buildBackup();
    const text = await file.text();
    const mirror = localStorage.getItem('mirror') || '';
    return { text, w: A.w, leakMirror: mirror.includes('data:image'), scan: text.includes('scan-kept') };
  }, { a: [...jpeg], b: [...other] });
  expect(seeded.leakMirror).toBe(false);

  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise(res => { const r = indexedDB.deleteDatabase('kartochki'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
    window.__app.backup.resetStore();
    window.__app.cards().splice(0, window.__app.cards().length);
  });
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.backup);
  const restored = await page.evaluate(async (text) => {
    window.__app.backup.resetStore();
    await window.__app.backup.restoreFrom([new File([text], 'CardsForKitty.json', { type: 'application/json' })]);
    const c = window.__app.cards().find(x => x.id === 'keep');
    const bg = await window.__app.backup.bgGet('keep');
    const scan = await window.__app.backup.photoGet('keep');
    const stored = localStorage.getItem('c_keep') || '';
    const mirror = localStorage.getItem('mirror') || '';
    return {
      name: c && c.name, bg: c && c.bg, bytes: bg && bg.size || 0, scan: scan ? await scan.text() : '',
      cardLeak: stored.includes('data:image'), mirrorLeak: mirror.includes('data:image'), len: stored.length,
    };
  }, seeded.text);
  expect(restored.name).toBe('Фон');
  expect(restored.bg).toBe(1);
  expect(restored.bytes).toBeGreaterThan(500);
  expect(restored.scan).toContain('scan');
  expect(restored.cardLeak).toBe(false);
  expect(restored.mirrorLeak).toBe(false);
  expect(restored.len).toBeLessThan(4096);

  const conflict = await page.evaluate(async ({ b }) => {
    const next = await window.__app.art.prepareArt(new File([new Uint8Array(b)], 'b.jpg', { type: 'image/jpeg' }));
    const older = await window.__app.backup.buildBackup();
    const olderText = await older.text();
    const local = window.__app.cards().find(c => c.id === 'keep');
    local.upd = 500; local.name = 'Новее';
    await window.__app.backup.bgPut('keep', next.blob);
    local.bw = next.w; local.bh = next.h; local.crop = next.crop;
    await window.__app.backup.restoreFrom([new File([olderText], 'old.json', { type: 'application/json' })]);
    const still = window.__app.cards().find(c => c.id === 'keep');
    const sizeAfterOld = (await window.__app.backup.bgGet('keep')).size;
    const newer = JSON.parse(olderText);
    newer.savedAt = '2026-01-01T00:00:00.000Z';
    newer.cards.find(c => c.id === 'keep').upd = 900;
    newer.cards.find(c => c.id === 'keep').name = 'Из копии';
    delete newer.cards.find(c => c.id === 'keep').bg;
    delete newer.backgrounds.keep;
    await window.__app.backup.restoreFrom([new File([JSON.stringify(newer)], 'new.json', { type: 'application/json' })]);
    const won = window.__app.cards().find(c => c.id === 'keep');
    const gone = await window.__app.backup.bgGet('keep');
    const again = await window.__app.backup.buildBackup();
    const packed = JSON.parse(await again.text());
    return { still: still.name, sizeAfterOld, won: won.name, wonBg: won.bg || 0, gone: gone && gone.size || 0, packedHas: !!(packed.backgrounds && packed.backgrounds.keep), cardLeak: JSON.stringify(packed.cards).includes('data:image') };
  }, { b: [...other] });
  expect(conflict.still).toBe('Новее');
  expect(conflict.sizeAfterOld).toBeGreaterThan(500);
  expect(conflict.won).toBe('Из копии');
  expect(conflict.wonBg).toBe(0);
  expect(conflict.gone).toBe(0);
  expect(conflict.packedHas).toBe(false);
  expect(conflict.cardLeak).toBe(false);

  await page.evaluate(async () => {
    const c = window.__app.cards().find(x => x.id === 'keep');
    c.bg = 1; c.upd = 5; c.name = 'Снова';
    await window.__app.backup.bgPut('keep', new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], { type: 'image/jpeg' }));
    localStorage.setItem('c_' + c.id, JSON.stringify(c));
    localStorage.setItem('mirror', JSON.stringify(window.__app.cards()));
    document.querySelector('#search').dispatchEvent(new Event('input'));
  });
  await page.locator('#stack .card', { hasText: 'Снова' }).click();
  await page.locator('#viewer:not(.hidden)').waitFor();
  await page.click('#delBtn');
  await expect(page.locator('#stack .card', { hasText: 'Снова' })).toHaveCount(0);
  const afterDelete = await page.evaluate(async () => {
    const bg = await window.__app.backup.bgGet('keep');
    const file = await window.__app.backup.buildBackup();
    const packed = JSON.parse(await file.text());
    const dump = Object.keys(localStorage).filter(k => k === 'mirror' || k.startsWith('c_')).map(k => localStorage.getItem(k)).join('\n');
    return { bg: bg && bg.size || 0, has: !!(packed.backgrounds && packed.backgrounds.keep), leak: dump.includes('data:image'), listed: window.__app.cards().some(c => c.id === 'keep') };
  });
  expect(afterDelete.bg).toBe(0);
  expect(afterDelete.has).toBe(false);
  expect(afterDelete.leak).toBe(false);
  expect(afterDelete.listed).toBe(false);
});
