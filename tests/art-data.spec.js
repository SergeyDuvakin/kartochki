const { test, expect } = require('@playwright/test');
const { boot, makeJpeg, withExif, openManual, chooseFile } = require('./helpers');

test('image math, exif, limits and separate photo storage', async ({ page }) => {
  await boot(page, { empty: true });
  const wide = await makeJpeg(page, 1600, 900);
  const prepared = await page.evaluate(async (bytes) => {
    const file = new File([new Uint8Array(bytes)], 'wide.jpg', { type: 'image/jpeg' });
    const r = await window.__app.art.prepareArt(file);
    return { w: r.w, h: r.h, size: r.blob.size, type: r.blob.type, tone: r.tone };
  }, [...wide]);
  expect(prepared.type).toBe('image/jpeg');
  expect(prepared.w).toBeLessThanOrEqual(1000);
  expect(prepared.h).toBeLessThanOrEqual(1000);
  expect(prepared.w).toBeGreaterThan(prepared.h);
  expect(prepared.size).toBeGreaterThan(800);
  expect(prepared.size).toBeLessThan(320 * 1024);
  expect(['light', 'dark', '']).toContain(prepared.tone);

  const orient = await page.evaluate(async (bytes) => window.__app.art.jpegOrientation(new Uint8Array(bytes).buffer), [...withExif(wide, 6)]);
  expect(orient).toBe(6);
  const turned = await page.evaluate(async (bytes) => {
    const file = new File([new Uint8Array(bytes)], 'turn.jpg', { type: 'image/jpeg' });
    const r = await window.__app.art.prepareArt(file);
    return { w: r.w, h: r.h };
  }, [...withExif(await makeJpeg(page, 240, 120), 6)]);
  expect(turned.h).toBeGreaterThan(turned.w);

  const limits = await page.evaluate(async (max) => {
    const big = new File([new Uint8Array(max + 8)], 'huge.jpg', { type: 'image/jpeg' });
    const bad = new File([new Uint8Array(64)], 'notes.txt', { type: 'text/plain' });
    const heic = new File([new Uint8Array(64)], 'IMG.HEIC', { type: 'image/heic' });
    const msg = async (file) => { try { await window.__app.art.prepareArt(file); return ''; } catch (e) { return window.__app.art.artMessage(e, file); } };
    return { big: await msg(big), bad: await msg(bad), heic: await msg(heic) };
  }, await page.evaluate(() => window.__app.art.ART_MAX));
  expect(limits.big).toBe('Файл слишком большой');
  expect(limits.bad).toContain('не поддерживается');
  expect(limits.heic).toContain('HEIC');

  const cover = await page.evaluate(() => {
    const crop = window.__app.art.clampCrop({ s: 1, x: 0, y: 0 }, 2000, 800);
    const m = window.__app.art.bgMetrics(crop, 2000, 800);
    const zoom = window.__app.art.zoomCrop({ s: 1, x: 0.5, y: 0.5 }, 2, 200, 126, 400, 252, 1000, 800);
    let pan = window.__app.art.panCrop({ s: 2, x: 0.5, y: 0.5 }, 8000, -8000, 400, 252, 1000, 800);
    const edge = window.__app.art.bgMetrics(pan, 1000, 800);
    return { crop, m, zoom, edge };
  });
  expect(cover.crop.x).toBeGreaterThan(0.2);
  expect(cover.m.leftPct).toBeGreaterThan(-1);
  expect(cover.m.leftPct).toBeLessThan(1);
  expect(cover.m.leftPct + cover.m.wPct).toBeGreaterThan(99);
  expect(cover.zoom.s).toBeGreaterThan(1.9);
  expect(Math.abs(cover.zoom.x - 0.5)).toBeLessThan(0.08);
  expect(cover.edge.leftPct).toBeLessThanOrEqual(0.6);
  expect(cover.edge.topPct).toBeLessThanOrEqual(0.6);
  expect(cover.edge.leftPct + cover.edge.wPct).toBeGreaterThan(99);
  expect(cover.edge.topPct + cover.edge.hPct).toBeGreaterThan(99);

  const split = await page.evaluate(async () => {
    const id = 'same';
    await window.__app.backup.photoPut(id, new Blob(['front-scan'], { type: 'image/jpeg' }));
    await window.__app.backup.bgPut(id, new Blob(['background-art'], { type: 'image/jpeg' }));
    return {
      scan: await (await window.__app.backup.photoGet(id)).text(),
      bg: await (await window.__app.backup.bgGet(id)).text(),
    };
  });
  expect(split.scan).toBe('front-scan');
  expect(split.bg).toBe('background-art');
});

test('backup is one file, merges like before, and old copies still restore', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await boot(page, { empty: true });
  const jpeg = await makeJpeg(page, 800, 500);
  await page.evaluate(async (bytes) => {
    const file = new File([new Uint8Array(bytes)], 'card.jpg', { type: 'image/jpeg' });
    const prep = await window.__app.art.prepareArt(file);
    const id = 'card1';
    await window.__app.backup.photoPut(id, new Blob(['scan-kept'], { type: 'image/jpeg' }));
    await window.__app.backup.bgPut(id, prep.blob);
    window.__app.cards().push({
      id, name: 'Фото', number: '555', format: 'Code128', color: '#f9c5d5', order: 0, uses: 3, upd: 50,
      bg: 1, crop: prep.crop, bw: prep.w, bh: prep.h, tone: prep.tone, display: '',
    });
    const h = await window.__app.backup.dataHash();
    const card = window.__app.cards()[0];
    card.uses = 9; card.last = 123;
    const same = await window.__app.backup.dataHash();
    card.uses = 3;
    return { h, same, w: prep.w };
  }, [...jpeg]).then(r => { expect(r.h).toBe(r.same); expect(r.w).toBeLessThanOrEqual(1000); });

  await page.evaluate(() => {
    localStorage.removeItem('bkHash');
    navigator.canShare = () => true;
    navigator.share = async (data) => {
      window.__shared = { keys: Object.keys(data), n: data.files.length, name: data.files[0].name, title: data.title || '', text: data.text || '' };
    };
  });
  await page.click('#moreBtn');
  await page.locator('.ctx button', { hasText: 'Сохранить копию' }).click();
  await expect.poll(() => page.evaluate(() => window.__shared && window.__shared.n)).toBe(1);
  const shared = await page.evaluate(() => window.__shared);
  expect(shared.keys).toEqual(['files']);
  expect(shared.name).toBe('CardsForKitty.json');
  expect(shared.title).toBe('');
  expect(shared.text).toBe('');

  const packed = await page.evaluate(async () => {
    const f = await window.__app.backup.buildBackup();
    const j = JSON.parse(await f.text());
    const card = j.cards.find(c => c.id === 'card1');
    return {
      name: f.name,
      photos: (j.photos.card1 || '').includes('scan-kept') || (j.photos.card1 || '').startsWith('data:'),
      scanText: j.photos.card1 ? true : false,
      bg: (j.backgrounds.card1 || '').startsWith('data:image/jpeg'),
      cardBg: card.bg, cardNoData: !JSON.stringify(card).includes('data:image'),
      len: JSON.stringify(card).length,
      photoKeys: Object.keys(j.photos), bgKeys: Object.keys(j.backgrounds),
    };
  });
  expect(packed.name).toBe('CardsForKitty.json');
  expect(packed.bg).toBe(true);
  expect(packed.cardBg).toBe(1);
  expect(packed.cardNoData).toBe(true);
  expect(packed.len).toBeLessThan(4096);
  expect(packed.photoKeys).toContain('card1');
  expect(packed.bgKeys).toEqual(['card1']);

  const round = await page.evaluate(async () => {
    const f = await window.__app.backup.buildBackup();
    const text = await f.text();
    window.__app.cards().splice(0, window.__app.cards().length);
    await window.__app.backup.bgPut('card1', null);
    await window.__app.backup.photoPut('card1', null);
    const file = new File([text], 'CardsForKitty.json', { type: 'application/json' });
    await window.__app.backup.restoreFrom([file]);
    const c = window.__app.cards().find(x => x.id === 'card1');
    const bg = await window.__app.backup.bgGet('card1');
    const scan = await window.__app.backup.photoGet('card1');
    return { name: c && c.name, bg: c && c.bg, bytes: bg && bg.size || 0, scan: scan ? await scan.text() : '' };
  });
  expect(round.name).toBe('Фото');
  expect(round.bg).toBe(1);
  expect(round.bytes).toBeGreaterThan(500);
  expect(round.scan).toContain('scan');

  const merge = await page.evaluate(async () => {
    const local = window.__app.cards().find(c => c.id === 'card1');
    local.upd = 500; local.name = 'Новее';
    const older = { app: 'kartochki', savedAt: '2024-01-01T00:00:00.000Z', cards: [{ id: 'card1', name: 'Старее', number: '555', format: 'Code128', color: '#f9c5d5', upd: 10 }] };
    await window.__app.backup.restoreFrom([new File([JSON.stringify(older)], 'a.json', { type: 'application/json' })]);
    const still = window.__app.cards().find(c => c.id === 'card1').name;
    const freshId = { app: 'kartochki', savedAt: '2024-05-01T00:00:00.000Z', cards: [{ id: 'dup', name: 'Дубль', number: '555', format: 'Code128', color: '#f9c5d5', upd: 9999 }] };
    await window.__app.backup.restoreFrom([new File([JSON.stringify(freshId)], 'b.json', { type: 'application/json' })]);
    const dup = window.__app.cards().some(c => c.id === 'dup');
    const classic = { app: 'kartochki', savedAt: '2024-06-01T00:00:00.000Z', cards: [{ id: 'old1', name: 'Старая', number: '777', format: 'Code128', color: '#bcd6f5', upd: 20, display: '' }] };
    await window.__app.backup.restoreFrom([new File([JSON.stringify(classic)], 'c.json', { type: 'application/json' })]);
    const old = window.__app.cards().find(c => c.id === 'old1');
    return { still, dup, old: old && old.name, oldBg: old && old.bg || 0 };
  });
  expect(merge.still).toBe('Новее');
  expect(merge.dup).toBe(false);
  expect(merge.old).toBe('Старая');
  expect(merge.oldBg).toBe(0);
});

test('version matches and offline buttons still work after the first load', async ({ page }) => {
  await boot(page, { empty: true });
  const versions = await page.evaluate(async () => {
    const j = await (await fetch('version.json?t=' + Date.now(), { cache: 'no-store' })).json();
    const sw = await (await fetch('sw.js?t=' + Date.now(), { cache: 'no-store' })).text();
    const html = await (await fetch('index.html?t=' + Date.now(), { cache: 'no-store' })).text();
    const app = await (await fetch('app.js?v=' + j.v, { cache: 'no-store' })).text();
    const man = await (await fetch('manifest.webmanifest?t=' + Date.now(), { cache: 'no-store' })).text();
    return {
      v: j.v,
      sw: sw.includes('const VERSION = ' + j.v) && sw.includes('app.js?v=' + j.v),
      html: html.includes('app.js?v=' + j.v) && html.includes('style.css?v=' + j.v) && html.includes('seed.js?v=' + j.v),
      app: app.includes('const APP_V = ' + j.v),
      man: man.includes('icon-192.png?v=' + j.v),
    };
  });
  expect(versions).toEqual({ v: 18, sw: true, html: true, app: true, man: true });

  const reg = await page.evaluate(async () => {
    const ready = navigator.serviceWorker && navigator.serviceWorker.ready;
    if (!ready) return 'no-sw';
    const r = await Promise.race([ready.then(() => 'ready'), new Promise(res => setTimeout(() => res('timeout'), 8000))]);
    return r;
  });
  expect(reg).toBe('ready');

  const jpeg = await makeJpeg(page, 640, 400);
  await page.context().setOffline(true);
  // Playwright WebKit refuses createImageBitmap/file reads while the context is offline.
  // Chromium still exercises the real offline decode path; buttons are checked on both.
  if (test.info().project.name !== 'webkit') {
    const decoded = await page.evaluate(async (bytes) => {
      const file = new File([new Uint8Array(bytes)], 'offline.jpg', { type: 'image/jpeg' });
      const r = await window.__app.art.prepareArt(file);
      return { w: r.w, h: r.h, size: r.blob.size };
    }, [...jpeg]);
    expect(decoded.w).toBeGreaterThan(20);
    expect(decoded.w).toBeLessThanOrEqual(1000);
    expect(decoded.size).toBeGreaterThan(200);
  }
  await openManual(page, 'Офлайн');
  await page.click('#artRow');
  await page.locator('#artColors button').nth(2).click();
  await page.click('#artDone');
  await page.locator('#form button[type="submit"]').click();
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#stack .card', { hasText: 'Офлайн' })).toHaveCount(1);
  await page.click('#searchBtn');
  await page.fill('#search', 'офлайн');
  await expect(page.locator('#stack .card')).toHaveCount(1);
  await page.click('#searchCancel');
  await page.click('#moreBtn');
  await expect(page.locator('.ctx button', { hasText: 'Восстановить из копии' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelectorAll('.ctx').forEach(n => n.remove()));
});

test('a huge restore file is refused without losing cards', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(() => window.__app.cards().map(c => c.id + ':' + c.name));
  const tooBig = await page.evaluate(async () => {
    const f = new File([new Uint8Array(30 * 1024 * 1024 + 8)], 'CardsForKitty.json', { type: 'application/json' });
    await window.__app.backup.restoreFrom([f]);
    return { names: window.__app.cards().map(c => c.id + ':' + c.name), toast: document.querySelector('#toast').textContent };
  });
  expect(tooBig.names).toEqual(before);
  expect(tooBig.toast).toContain('большой');
});
