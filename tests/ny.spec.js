const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { boot, hidePill, makeJpeg } = require('./helpers');

const ART = '/opt/cursor/artifacts';

function shot(page, name) {
  fs.mkdirSync(ART, { recursive: true });
  return page.screenshot({ path: path.join(ART, name + '.png') });
}

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

test('forced holiday theme is on, and the season follows the local date', async ({ page }, info) => {
  await boot(page);
  await expect(page.locator('#stack .card').first()).toBeVisible();
  const flags = await page.evaluate(() => ({
    force: window.__app.ny.force,
    on: window.__app.ny.on,
    cls: document.documentElement.classList.contains('ny'),
    dec14: window.__app.ny.inSeason(new Date(2026, 11, 14)),
    dec15: window.__app.ny.inSeason(new Date(2026, 11, 15)),
    dec31: window.__app.ny.inSeason(new Date(2026, 11, 31)),
    jan1: window.__app.ny.inSeason(new Date(2027, 0, 1)),
    jan15: window.__app.ny.inSeason(new Date(2027, 0, 15)),
    jan16: window.__app.ny.inSeason(new Date(2027, 0, 16)),
  }));
  expect(flags.force).toBe(true);
  expect(flags.on).toBe(true);
  expect(flags.cls).toBe(true);
  expect(flags).toMatchObject({ dec14: false, dec15: true, dec31: true, jan1: true, jan15: true, jan16: false });

  await expect(page.locator('#fx .bubble')).toHaveCount(0);
  await expect(page.locator('#fx .flake')).toHaveCount(11);
  await expect(page.locator('.garland')).toBeVisible();
  await expect(page.locator('.header-flake')).toBeVisible();
  await expect(page.locator('#stack .snowcap').first()).toBeVisible();

  const clear = await page.evaluate(() => {
    const card = document.querySelector('#stack .card');
    const nm = card.querySelector('.nm');
    const cap = card.querySelector('.snowcap');
    const nr = nm.getBoundingClientRect();
    const hit = document.elementFromPoint(nr.left + 12, nr.top + nr.height / 2);
    return {
      nameClear: hit === nm || (nm.contains && nm.contains(hit)),
      hit: hit ? (hit.className && hit.className.baseVal) || hit.className || hit.tagName : 'none',
      cap: !!cap,
    };
  });
  expect(clear.cap).toBe(true);
  expect(clear.hit).toMatch(/nm|card/);

  if (info.project.name === 'chromium') await shot(page, 'ny-stack');

  await page.locator('#stack .card').last().click();
  await page.locator('#viewer:not(.hidden)').waitFor();
  await page.waitForFunction(() => document.querySelector('#vCode').width > 8);
  const panel = await page.locator('#viewer .panel').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(panel).toBe('rgb(255, 255, 255)');
  const barcodeClear = await page.evaluate(() => {
    const canvas = document.querySelector('#vCode');
    const r = canvas.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(12, r.height / 2));
    return {
      inViewer: !!(hit && hit.closest('#viewer')),
      flake: !!(hit && hit.closest('.flake')),
      snowInPanel: document.querySelectorAll('#viewer .flake, #viewer .snowcap, #viewer .bubble').length,
    };
  });
  expect(barcodeClear.inViewer).toBe(true);
  expect(barcodeClear.flake).toBe(false);
  expect(barcodeClear.snowInPanel).toBe(0);
  if (info.project.name === 'chromium') await shot(page, 'ny-open');
  await page.locator('#stack .card').last().click();
  await expect(page.locator('#viewer')).toBeHidden();

  const jpeg = await makeJpeg(page, 900, 560);
  await page.evaluate(async (bytes) => {
    const file = new File([new Uint8Array(bytes)], 'festive.jpg', { type: 'image/jpeg' });
    const prep = await window.__app.art.prepareArt(file);
    const id = 'nyphoto';
    await window.__app.backup.bgPut(id, prep.blob);
    window.__app.cards().push({
      id, name: 'Снег', number: '220066', format: 'Code128', color: '#bcd6f5', order: 99, uses: 0,
      bg: 1, crop: prep.crop, bw: prep.w, bh: prep.h, tone: prep.tone, display: '220066',
    });
    document.querySelector('#search').dispatchEvent(new Event('input'));
  }, [...jpeg]);
  await page.waitForFunction(() => document.querySelector('#stack .card.has-bg img.bg'));
  await page.locator('#stack .card.has-bg').scrollIntoViewIfNeeded();
  const photo = await page.locator('#stack .card.has-bg').evaluate(el => {
    const brand = el.querySelector('.brand').getBoundingClientRect();
    const hole = el.querySelector('.hole').getBoundingClientRect();
    const cap = el.querySelector('.snowcap');
    const br = brand;
    const above = (x, y, node) => {
      const stack = document.elementsFromPoint(x, y);
      const ni = stack.indexOf(node);
      const ci = stack.indexOf(cap);
      return ni >= 0 && (ci < 0 || ni < ci);
    };
    const hx = hole.left + hole.width / 2, hy = hole.top + hole.height / 2;
    const names = document.elementsFromPoint(hx, hy).slice(0, 8).map(n => (n.className && n.className.baseVal) || n.className || n.tagName);
    return {
      chip: above(br.left + 16, br.top + br.height / 2, el.querySelector('.brand')) || above(br.left + 16, br.top + br.height / 2, el.querySelector('.nm')),
      hole: above(hx, hy, el.querySelector('.hole')),
      cap: !!cap,
      gap: hole.left - brand.right,
      debug: names.join(' > '),
    };
  });
  expect(photo.cap).toBe(true);
  expect(photo.chip).toBe(true);
  expect(photo.gap).toBeGreaterThan(4);
  await expect(page.locator('#stack .card.has-bg .hole')).toHaveCount(1);
  await hidePill(page);
  if (info.project.name === 'chromium') await shot(page, 'ny-photo');
});

test('reduced motion keeps the holiday still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page);
  await expect(page.locator('#fx .flake').first()).toBeVisible();
  const before = await page.locator('#fx .flake').first().evaluate(el => el.style.transform);
  await page.waitForTimeout(450);
  const after = await page.locator('#fx .flake').first().evaluate(el => el.style.transform);
  expect(after).toBe(before);
  const garland = await page.locator('.garland .g-dim').evaluate(el => getComputedStyle(el).animationName);
  expect(garland).toBe('none');
});

test('holiday art is cached for offline', async ({ page }) => {
  await boot(page, { empty: true });
  const ready = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return 'no-sw';
    const r = await Promise.race([
      navigator.serviceWorker.ready.then(() => 'ready'),
      new Promise(res => setTimeout(() => res('timeout'), 8000)),
    ]);
    return r;
  });
  expect(ready).toBe('ready');
  await page.context().setOffline(true);
  const body = await page.evaluate(async () => {
    const fromCache = async () => {
      const names = await caches.keys();
      for (const name of names) {
        const c = await caches.open(name);
        const keys = await c.keys();
        const req = keys.find(k => k.url.includes('snowflake-1.svg'));
        if (!req) continue;
        const hit = await c.match(req);
        const text = await hit.text();
        return { ok: true, n: text.length, svg: text.includes('viewBox') };
      }
      return { ok: false, n: 0, svg: false };
    };
    try {
      const r = await fetch('assets/ny/snowflake-1.svg?v=20');
      const text = await r.text();
      if (r.ok && text.includes('viewBox')) return { ok: true, n: text.length, svg: true };
    } catch (e) {}
    return fromCache();
  });
  expect(body.ok).toBe(true);
  expect(body.n).toBeGreaterThan(200);
  expect(body.svg).toBe(true);
  await page.context().setOffline(false);
});
