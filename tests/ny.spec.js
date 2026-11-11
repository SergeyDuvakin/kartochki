const { test, expect, devices } = require('@playwright/test');
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
  await expect(page.locator('#fx .flake')).toHaveCount(15);
  await expect(page.locator('.garland')).toBeVisible();
  await expect(page.locator('.header-flake')).toBeVisible();
  await expect(page.locator('#stack .snowcap').first()).toBeVisible();
  await expect(page.locator('#stack .card:not(.has-bg) .hole')).toHaveCount(0);
  await expect(page.locator('#stack .card:not(.has-bg) .logo')).toHaveCount(0);

  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('#stack .card')];
    if (cards.length < 2) return false;
    return cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().top > 50;
  });
  const caps = await page.locator('#stack .snowcap').evaluateAll(els => els.map(el => el.getAttribute('src')));
  expect(caps.length).toBeGreaterThan(2);
  expect(new Set(caps).size).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < caps.length; i++) expect(caps[i]).not.toBe(caps[i - 1]);
  const fit = await page.locator('#stack .card').evaluateAll(cards => cards.map(card => {
    const cap = card.querySelector('.snowcap');
    const nm = card.querySelector('.nm');
    const cr = card.getBoundingClientRect();
    const pr = cap.getBoundingClientRect();
    const nr = nm.getBoundingClientRect();
    const nameHit = document.elementFromPoint(nr.left + 10, nr.top + nr.height / 2);
    return {
      above: pr.top < cr.top - 4,
      side: pr.left >= cr.left - 1 && pr.right <= cr.right + 1,
      name: nameHit === nm || nameHit === card || !!(nm.contains && nm.contains(nameHit)),
      gap: Math.round(nr.top - cr.top),
    };
  }));
  for (const row of fit) {
    expect(row.above).toBe(true);
    expect(row.side).toBe(true);
    expect(row.name).toBe(true);
    expect(row.gap).toBeGreaterThan(10);
  }

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

  const taps = await page.evaluate(() => {
    const hit = sel => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!(at && at.closest(sel));
    };
    return { add: hit('#addBtn'), search: hit('#searchBtn') };
  });
  expect(taps.add).toBe(true);
  expect(taps.search).toBe(true);

  if (info.project.name === 'chromium') {
    await page.waitForTimeout(900);
    await shot(page, 'ny-stack');
    const head = await page.locator('header.top').boundingBox();
    await page.screenshot({ path: path.join(ART, 'ny-header.png'), clip: head });
    await page.evaluate(() => {
      document.documentElement.classList.remove('ny');
      document.querySelectorAll('.snowcap, #fx').forEach(el => { el.style.visibility = 'hidden'; });
    });
    await shot(page, 'main-stack');
    await page.evaluate(() => {
      document.documentElement.classList.add('ny');
      document.querySelectorAll('.snowcap, #fx').forEach(el => { el.style.visibility = ''; });
    });
  }

  await page.locator('#stack .card').last().click();
  await page.waitForFunction(() => (window.__app.ny.openedCrumbs || 0) > 0);
  await page.waitForFunction(() => {
    const card = document.querySelector('.card.open').getBoundingClientRect();
    const panel = document.querySelector('#viewer .panel').getBoundingClientRect();
    return card.bottom <= panel.top + 4;
  });
  const overlap = await page.evaluate(() => {
    const p = document.querySelector('#viewer .panel').getBoundingClientRect();
    return [...document.querySelectorAll('.crumb')].some(c => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.bottom > p.top + 1 && r.top < p.bottom && r.right > p.left + 1 && r.left < p.right - 1;
    });
  });
  expect(overlap).toBe(false);
  expect(await page.locator('#crumbs .crumb').count()).toBeGreaterThan(0);
  if (info.project.name === 'chromium') {
    await page.waitForTimeout(140);
    await shot(page, 'ny-crumble');
  }
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
  const openCap = await page.locator('#stack .card.open .snowcap').evaluate(el => el.getAttribute('src'));
  expect(openCap).toContain('-tall');
  if (info.project.name === 'chromium') {
    await page.waitForFunction(() => document.querySelectorAll('.crumb').length === 0);
    await shot(page, 'ny-open');
  }
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
  const holeSeen = await page.locator('#stack .card.has-bg .hole').evaluate(el => {
    el.style.pointerEvents = 'auto';
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const logo = el.parentElement.querySelector('.logo');
    logo.style.pointerEvents = 'auto';
    const lr = logo.getBoundingClientRect();
    const logoHit = document.elementFromPoint(lr.left + lr.width / 2, lr.top + lr.height / 2);
    return { hole: hit === el, logo: logoHit === logo, w: r.width, lw: lr.width };
  });
  expect(holeSeen.hole).toBe(true);
  expect(holeSeen.logo).toBe(true);
  expect(holeSeen.w).toBeGreaterThan(8);
  expect(holeSeen.lw).toBeGreaterThan(16);
  const charm = await page.locator('#stack .card.has-bg').evaluate(el => {
    const c = el.querySelector('.charm').getBoundingClientRect();
    const brand = el.querySelector('.brand').getBoundingClientRect();
    const hole = el.querySelector('.hole').getBoundingClientRect();
    const overlap = !(c.right < brand.left || c.left > brand.right || c.bottom < brand.top || c.top > brand.bottom);
    return { n: el.querySelectorAll('.charm').length, overlap, below: c.top >= hole.top + hole.height * 0.4 };
  });
  expect(charm.n).toBe(1);
  expect(charm.overlap).toBe(false);
  expect(charm.below).toBe(true);
  await expect(page.locator('#stack .card:not(.has-bg) .charm')).toHaveCount(0);
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
  const bulb = await page.locator('.garland .bulb i').first().evaluate(el => getComputedStyle(el).animationName);
  expect(bulb).toBe('none');
  await page.locator('.garland .bulb').first().click();
  expect(await page.locator('.garland').getAttribute('data-run')).toBeNull();
  await page.locator('#stack .card').last().click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__app.ny.openedCrumbs || 0)).toBe(0);
  expect(await page.locator('.crumb').count()).toBe(0);
  await page.mouse.wheel(0, 400);
  expect(await page.evaluate(() => window.__app.ny.shed || 0)).toBe(0);
});

test('holiday header stays tappable on narrow and wide phones', async ({ page }, info) => {
  await boot(page);
  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 780 });
    await page.waitForTimeout(60);
    const hit = await page.evaluate(() => {
      const ok = sel => {
        const el = document.querySelector(sel);
        const r = el.getBoundingClientRect();
        const at = document.elementFromPoint(r.left + Math.min(16, r.width / 2), r.top + r.height / 2);
        return !!(at && at.closest(sel));
      };
      return {
        add: ok('#addBtn'),
        search: ok('#searchBtn'),
        wire: document.querySelector('.g-bright').naturalWidth > 0,
        bulbs: document.querySelectorAll('.garland .bulb').length,
      };
    });
    expect(hit).toEqual({ add: true, search: true, wire: true, bulbs: 15 });
    if (info.project.name === 'chromium') await shot(page, 'ny-w' + width);
  }
});

test('garland bulbs twinkle, and a tap runs a light along the wire', async ({ page }) => {
  await boot(page);
  await expect(page.locator('.garland .bulb')).toHaveCount(15);
  const motion = await page.locator('.garland .bulb i').first().evaluate(el => {
    const cs = getComputedStyle(el);
    return { name: cs.animationName, dur: parseFloat(cs.animationDuration) };
  });
  expect(motion.name).toBe('bulbglow');
  expect(motion.dur).toBeGreaterThan(2);
  expect(motion.dur).toBeLessThan(5);
  await page.locator('.garland .bulb').nth(4).click();
  await expect(page.locator('.garland')).toHaveAttribute('data-run', '1');
  await expect(page.locator('.garland .bulb.hot')).toHaveCount(1);
  await expect(page.locator('.garland .runner.on')).toHaveCount(1);
});

function pointerDrag(page, dy, frameMs) {
  return page.evaluate(({ dy, frameMs }) => new Promise(res => {
    const card = document.querySelector('#stack .card');
    const r = card.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + 22;
    const ev = (type, cy) => card.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: x, clientY: cy, pointerId: 1, pointerType: 'mouse', buttons: 1,
    }));
    ev('pointerdown', y);
    setTimeout(() => {
      const steps = 5;
      let i = 0;
      const step = () => {
        i += 1;
        ev('pointermove', y + (dy * i) / steps);
        if (i < steps) {
          if (frameMs) setTimeout(step, frameMs);
          else requestAnimationFrame(step);
        } else {
          ev('pointerup', y + dy);
          res(true);
        }
      };
      step();
    }, 470);
  }), { dy, frameMs });
}

test('moving the stack sheds a little snow and ignores tiny motion', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#stack .card').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 540 });
  const tiny = await page.evaluate(() => new Promise(res => {
    const sc = document.querySelector('#scroller');
    const before = window.__app.ny.shed;
    let i = 0;
    const step = () => {
      sc.scrollTop += 1;
      if (++i < 8) requestAnimationFrame(step);
      else res(window.__app.ny.shed - before);
    };
    requestAnimationFrame(step);
  }));
  expect(tiny).toBe(0);
  const brisk = await page.evaluate(() => new Promise(res => {
    const sc = document.querySelector('#scroller');
    const before = window.__app.ny.shed;
    let i = 0;
    const step = () => {
      sc.scrollTop += 36;
      if (++i < 8) requestAnimationFrame(step);
      else res({ shed: window.__app.ny.shed - before, top: sc.scrollTop, alive: document.querySelectorAll('.crumb').length });
    };
    requestAnimationFrame(step);
  }));
  expect(brisk.top).toBeGreaterThan(40);
  expect(brisk.shed).toBeGreaterThan(0);
  expect(brisk.shed).toBeLessThanOrEqual(12);
  expect(brisk.alive).toBeLessThanOrEqual(22);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.querySelector('#scroller').scrollTop = 0; });
  await page.waitForTimeout(200);
  const beforeSlow = await page.evaluate(() => window.__app.ny.shed);
  await pointerDrag(page, 20, 120);
  expect(await page.evaluate(() => window.__app.ny.shed)).toBe(beforeSlow);
  await pointerDrag(page, 150, 0);
  const after = await page.evaluate(() => ({ shed: window.__app.ny.shed, alive: document.querySelectorAll('.crumb').length }));
  expect(after.shed).toBeGreaterThan(beforeSlow);
  expect(after.shed - beforeSlow).toBeLessThanOrEqual(12);
  expect(after.alive).toBeLessThanOrEqual(22);
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
      const r = await fetch('assets/ny/snowflake-1.svg?v=23');
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

test('an iPhone flick sheds snow from the caps', async ({ browser, browserName }) => {
  test.skip(browserName !== 'webkit', 'real touch scrolling is the WebKit case');
  const context = await browser.newContext({
    ...devices['iPhone 11'],
    viewport: { width: 414, height: 896 },
    screen: { width: 414, height: 896 },
    baseURL: 'http://127.0.0.1:8765',
    serviceWorkers: 'allow',
  });
  const page = await context.newPage();
  try {
    await boot(page);
    await expect(page.locator('#stack .card').first()).toBeVisible();
    await page.waitForFunction(() => {
      const cards = [...document.querySelectorAll('#stack .card')];
      return cards.length > 2 && cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().top > 50;
    });
    await page.waitForTimeout(800);
    fs.mkdirSync(ART, { recursive: true });
    await page.screenshot({ path: path.join(ART, 'ny-blush-stack.png') });
    await page.setViewportSize({ width: 414, height: 680 });
    await page.waitForFunction(() => {
      const cards = [...document.querySelectorAll('#stack .card')];
      const sc = document.querySelector('#scroller');
      return cards.length > 2 && cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().top > 50 && sc.scrollHeight - sc.clientHeight > 80;
    });
    const pending = page.evaluate(async () => {
      const sc = document.querySelector('#scroller');
      const card = document.querySelector('#stack .card');
      const before = window.__app.ny.shed || 0;
      sc.scrollTop += 1;
      await new Promise(r => setTimeout(r, 450));
      const rct = card.getBoundingClientRect();
      const x = rct.left + rct.width / 2;
      let y = rct.top + 36;
      const fire = (type, cy) => {
        const ev = new Event(type, { bubbles: true, cancelable: true });
        const point = { identifier: 1, target: card, clientX: x, clientY: cy, pageX: x, pageY: cy };
        const list = type === 'touchend' ? [] : [point];
        Object.defineProperty(ev, 'touches', { get: () => list });
        Object.defineProperty(ev, 'targetTouches', { get: () => list });
        Object.defineProperty(ev, 'changedTouches', { get: () => [point] });
        card.dispatchEvent(ev);
      };
      fire('touchstart', y);
      const steps = 8;
      const dy = -220;
      for (let i = 1; i <= steps; i++) {
        await new Promise(r => setTimeout(r, 18));
        fire('touchmove', y + (dy * i) / steps);
      }
      fire('touchend', y + dy);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const seen = [...document.querySelectorAll('.crumb')].filter(el => {
        const b = el.getBoundingClientRect();
        const opacity = parseFloat(getComputedStyle(el).opacity || '1');
        return b.width > 1 && b.height > 1 && opacity > 0.15 && b.bottom > 0 && b.top < innerHeight;
      }).length;
      window.__flickReady = true;
      await new Promise(r => setTimeout(r, 420));
      sc.scrollTop += 48;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const host = document.querySelector('#crumbs');
      return {
        shed: (window.__app.ny.shed || 0) - before,
        crumbs: document.querySelectorAll('.crumb').length,
        visible: seen,
        clipped: !!(host && host.closest('#scroller')),
        top: sc.scrollTop,
        viewport: { w: innerWidth, h: innerHeight },
      };
    });
    await page.waitForFunction(() => window.__flickReady);
    await page.screenshot({ path: path.join(ART, 'ny-flick-snow.png') });
    const flick = await pending;
    expect(flick.viewport).toEqual({ w: 414, h: 680 });
    expect(flick.top).toBeGreaterThan(40);
    expect(flick.shed, JSON.stringify(flick)).toBeGreaterThan(0);
    expect(flick.visible, JSON.stringify(flick)).toBeGreaterThan(0);
    expect(flick.clipped).toBe(false);
    expect(flick.shed).toBeLessThanOrEqual(22);
  } finally {
    await context.close();
  }
});

test('a fitted iPhone stack sheds snow when stretched and when compressed', async ({ browser, browserName }) => {
  test.skip(browserName !== 'webkit', 'the fitted-stack gesture is the WebKit case');
  const context = await browser.newContext({
    ...devices['iPhone 11'],
    viewport: { width: 414, height: 896 },
    screen: { width: 414, height: 896 },
    baseURL: 'http://127.0.0.1:8765',
    serviceWorkers: 'allow',
  });
  const page = await context.newPage();
  try {
    await boot(page);
    await expect(page.locator('#stack .card').first()).toBeVisible();
    await page.waitForFunction(() => document.querySelectorAll('#stack .card').length >= 5);
    const ready = await page.evaluate(() => {
      const all = [...document.querySelectorAll('#stack .card')];
      all.slice(5).forEach(el => el.remove());
      const sc = document.querySelector('#scroller');
      const cards = [...document.querySelectorAll('#stack .card')];
      const tops = cards.map(el => el.getBoundingClientRect().top);
      const gap = tops.length > 1 ? tops[1] - tops[0] : 0;
      return {
        n: cards.length,
        max: sc.scrollHeight - sc.clientHeight,
        fits: sc.scrollHeight - sc.clientHeight < 24,
        gap: Math.round(gap),
        w: innerWidth,
        h: innerHeight,
      };
    });
    expect(ready).toMatchObject({ n: 5, fits: true, w: 414, h: 896 });
    const gesture = (dy) => page.evaluate(async (dy) => {
      const sc = document.querySelector('#scroller');
      const card = document.querySelector('#stack .card');
      const beforeShed = window.__app.ny.shed || 0;
      const tops = () => [...document.querySelectorAll('#stack .card')].map(el => el.getBoundingClientRect().top);
      const before = tops();
      const r = card.getBoundingClientRect();
      const x = r.left + r.width / 2;
      let y = Math.min(r.bottom - 30, r.top + 70);
      const fire = (type, cy) => {
        const ev = new Event(type, { bubbles: true, cancelable: true });
        const point = { identifier: 1, target: card, clientX: x, clientY: cy };
        const list = type === 'touchend' ? [] : [point];
        Object.defineProperty(ev, 'touches', { get: () => list });
        Object.defineProperty(ev, 'targetTouches', { get: () => list });
        Object.defineProperty(ev, 'changedTouches', { get: () => [point] });
        card.dispatchEvent(ev);
      };
      fire('touchstart', y);
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        await new Promise(res => setTimeout(res, 28));
        fire('touchmove', y + (dy * i) / steps);
      }
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      if (dy > 0) {
        window.__stretchReady = 'down';
        await new Promise(res => setTimeout(res, 180));
      }
      const mid = tops();
      const moved = Math.abs(mid[mid.length - 1] - before[before.length - 1]);
      const seen = [...document.querySelectorAll('.crumb')].filter(el => {
        const b = el.getBoundingClientRect();
        const opacity = parseFloat(getComputedStyle(el).opacity || '1');
        return b.width > 1 && opacity > 0.2 && b.top < innerHeight && b.bottom > 0;
      }).length;
      fire('touchend', y + dy);
      await new Promise(res => setTimeout(res, 650));
      return {
        dy,
        moved: Math.round(moved),
        seen,
        shed: (window.__app.ny.shed || 0) - beforeShed,
        max: Math.round(sc.scrollHeight - sc.clientHeight),
      };
    }, dy);
    const downPromise = gesture(110);
    await page.waitForFunction(() => window.__stretchReady === 'down');
    fs.mkdirSync(ART, { recursive: true });
    await page.screenshot({ path: path.join(ART, 'ny-stretch-crumbs.png') });
    const down = await downPromise;
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const sc = document.querySelector('#scroller');
      sc.scrollTop = sc.scrollHeight - sc.clientHeight;
    });
    const up = await gesture(-110);
    expect(down.moved, JSON.stringify(down)).toBeGreaterThan(8);
    expect(down.shed, JSON.stringify(down)).toBeGreaterThan(0);
    expect(down.seen, JSON.stringify(down)).toBeGreaterThan(0);
    expect(up.moved, JSON.stringify(up)).toBeGreaterThan(8);
    expect(up.shed, JSON.stringify(up)).toBeGreaterThan(0);
    expect(up.seen, JSON.stringify(up)).toBeGreaterThan(0);
    expect(down.shed).toBeLessThanOrEqual(22);
    expect(up.shed).toBeLessThanOrEqual(22);
  } finally {
    await context.close();
  }
});
