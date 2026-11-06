const { test, expect } = require('@playwright/test');
const { boot, shot, makeBrightJpeg, makeDarkJpeg, openManual, chooseFile, hidePill, touchSwipe } = require('./helpers');

async function setDim(page, value) {
  await page.locator('#artDimRange').evaluate((el, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function pickBright(page) {
  const jpeg = await makeBrightJpeg(page);
  await openManual(page, 'Свет');
  await page.click('#artRow');
  await page.click('#artModeImage');
  await chooseFile(page, '#artPick', jpeg);
  await page.locator('#crop:not(.hidden)').waitFor();
  await page.click('#cropDone');
  await expect(page.locator('#artTools')).toBeVisible();
  await expect(page.locator('#artDimRange')).toBeVisible();
}

function scrimOf(selector) {
  return {
    selector,
    read: el => {
      const card = el.closest('.card');
      const edge = card.querySelector('.edge');
      const brand = card.querySelector('.brand');
      const cr = card.getBoundingClientRect();
      const er = edge.getBoundingClientRect();
      const br = brand.getBoundingClientRect();
      const bs = getComputedStyle(brand);
      const es = getComputedStyle(edge);
      const ghosts = [...card.querySelectorAll('*')].filter(n => {
        const box = n.getBoundingClientRect();
        if (box.width < cr.width * 0.5 || box.bottom < cr.top + 2 || box.top > cr.top + 60) return false;
        const s = getComputedStyle(n);
        const solid = /rgba?\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+(?:,\s*([\d.]+))?\s*\)/.exec(s.backgroundColor);
        const alpha = solid ? (solid[1] == null ? 1 : parseFloat(solid[1])) : 0;
        return alpha > 0.45 && (s.backgroundImage === 'none' || !s.backgroundImage);
      }).map(n => n.className || n.tagName);
      return {
        edgeH: er.height,
        edgePastStrip: er.bottom - cr.top,
        gradient: es.backgroundImage,
        brandBg: bs.backgroundColor,
        brandBlur: bs.backdropFilter || bs.getPropertyValue('-webkit-backdrop-filter') || 'none',
        brandW: br.width,
        ghosts,
        darkText: card.classList.contains('dark'),
        dimmed: card.classList.contains('dimmed'),
      };
    },
  };
}

test('a bright photo gets a short fading scrim, not a bar across the stack', async ({ page }) => {
  await boot(page, { empty: true });
  await pickBright(page);
  await expect(page.locator('#artDimRange')).toHaveValue('0');
  await expect(page.locator('#artPreview')).toHaveClass(/has-bg/);
  await expect(page.locator('#artPreview')).toHaveClass(/dark/);
  const preview = await page.locator('#artPreview').evaluate(scrimOf().read);
  expect(preview.edgeH).toBeGreaterThan(30);
  expect(preview.edgeH).toBeLessThanOrEqual(60);
  expect(preview.edgePastStrip).toBeLessThanOrEqual(60.5);
  expect(preview.gradient).toContain('gradient');
  expect(preview.gradient).toMatch(/,\s*0\)|transparent/);
  expect(preview.gradient).toContain('255, 250, 252');
  expect(preview.brandBg).toBe('rgba(0, 0, 0, 0)');
  expect(preview.brandBlur).toBe('none');
  expect(preview.ghosts).toEqual([]);
  expect(preview.dimmed).toBe(false);
  await shot(page, 'bright-appearance');

  const before = await page.evaluate(() => {
    const s = window.__app.art.session();
    return { bytes: s.bytes, rev: s.rev, uses: window.__app.cards().reduce((n, c) => n + (c.uses || 0), 0), n: window.__app.cards().length };
  });
  await setDim(page, 100);
  await expect(page.locator('#artPreview')).toHaveClass(/dimmed/);
  const faded = await page.locator('#artPreview').evaluate(el => {
    const img = el.querySelector('img.bg');
    const nm = el.querySelector('.nm');
    return {
      b: el.style.getPropertyValue('--dim-b'),
      s: el.style.getPropertyValue('--dim-s'),
      img: getComputedStyle(img).filter,
      text: getComputedStyle(nm).filter,
      logo: getComputedStyle(el.querySelector('.logo')).filter,
    };
  });
  expect(faded.b).toBe('0.78');
  expect(faded.s).toBe('0.65');
  expect(faded.img).toContain('brightness');
  expect(faded.img).toContain('saturate');
  expect(faded.img).not.toContain('grayscale');
  expect(faded.text).toBe('none');
  expect(faded.logo).toBe('none');
  await page.waitForFunction(() => {
    const img = document.querySelector('#artPreview img.bg');
    return img && img.complete && img.naturalWidth > 10;
  });
  const colorLeft = await page.evaluate(() => {
    const img = document.querySelector('#artPreview img.bg');
    const c = document.createElement('canvas');
    c.width = 24; c.height = 24;
    const x = c.getContext('2d');
    x.filter = getComputedStyle(img).filter;
    x.drawImage(img, img.naturalWidth * 0.45, img.naturalHeight * 0.62, img.naturalWidth * 0.4, img.naturalHeight * 0.28, 0, 0, 24, 24);
    const d = x.getImageData(0, 0, 24, 24).data;
    let sat = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      sat += mx ? (mx - mn) / mx : 0; n++;
    }
    return sat / n;
  });
  expect(colorLeft).toBeGreaterThan(0.12);
  const mid = await page.evaluate(() => window.__app.art.session());
  expect(mid.bytes).toBe(before.bytes);
  expect(mid.rev).toBe(before.rev);
  expect(mid.dim).toBe(100);
  expect(await page.evaluate(() => window.__app.cards().length)).toBe(0);
  await shot(page, 'bright-dim');
  await setDim(page, 0);
  await expect(page.locator('#artPreview')).not.toHaveClass(/dimmed/);

  await page.click('#lookRow');
  await page.locator('#look:not(.hidden)').waitFor();
  await expect(page.locator('#lookCard .nm')).toHaveText('Свет');
  await page.locator('#lookCard').scrollIntoViewIfNeeded();
  await expect(page.locator('#lookCode')).toBeVisible();
  const codeFilter = await page.locator('#lookCode').evaluate(el => getComputedStyle(el).filter);
  expect(codeFilter).toBe('none');
  const panel = await page.locator('#look .lookpanel').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(panel).toBe('rgb(255, 255, 255)');
  await shot(page, 'bright-full', 400);
  await page.click('#lookStack');
  await expect(page.locator('#lookStackCard .edge')).toBeVisible();
  const stacked = await page.locator('#lookStackCard').evaluate(scrimOf().read);
  expect(stacked.edgeH).toBeLessThanOrEqual(60);
  expect(stacked.ghosts).toEqual([]);
  await page.locator('#lookStackCard').scrollIntoViewIfNeeded();
  await shot(page, 'bright-look-stack', 300);
  await page.click('#lookBack');
  expect(await page.evaluate(() => window.__app.cards().reduce((n, c) => n + (c.uses || 0), 0))).toBe(0);

  await page.click('#artDone');
  await page.locator('#form button[type="submit"]').click();
  await expect(page.locator('#editor')).toBeHidden();
  await hidePill(page);
  await openManual(page, 'Рядом');
  await page.locator('#form button[type="submit"]').click();
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#bkOffer.on')).toBeVisible();
  await hidePill(page);
  await expect(page.locator('#bkOffer.on')).toHaveCount(0);
  await shot(page, 'bright-stack', 600);
  const home = await page.locator('#stack .card', { hasText: 'Свет' }).evaluate(scrimOf().read);
  expect(home.darkText).toBe(true);
  expect(home.edgePastStrip).toBeLessThanOrEqual(60.5);
  expect(home.ghosts).toEqual([]);
  await expect(page.locator('#stack .card', { hasText: 'Рядом' }).locator('.edge')).toHaveCount(0);
  await expect(page.locator('#stack .card', { hasText: 'Рядом' }).locator('.brand')).toHaveCount(0);

  const dark = await makeDarkJpeg(page);
  await page.evaluate(async (bytes) => {
    const prep = await window.__app.art.prepareArt(new File([new Uint8Array(bytes)], 'dark.jpg', { type: 'image/jpeg' }));
    const id = 'dark1';
    await window.__app.backup.bgPut(id, prep.blob);
    window.__app.cards().push({
      id, name: 'Тень', number: '999', format: 'Code128', color: '#243044', order: 5, uses: 0, upd: 1,
      bg: 1, crop: prep.crop, bw: prep.w, bh: prep.h, tone: prep.tone, display: '',
    });
    document.querySelector('#search').dispatchEvent(new Event('input'));
  }, [...dark]);
  await expect(page.locator('#stack .card', { hasText: 'Тень' })).toHaveClass(/has-bg/, { timeout: 8000 });
  const tone = await page.locator('#stack .card', { hasText: 'Тень' }).evaluate(el => ({
    darkText: el.classList.contains('dark'),
    tone: (window.__app.cards().find(c => c.name === 'Тень') || {}).tone,
    gradient: getComputedStyle(el.querySelector('.edge')).backgroundImage,
  }));
  expect(tone.tone).toBe('dark');
  expect(tone.darkText).toBe(false);
  expect(tone.gradient).toContain('36, 20, 40');
});

test('dimming is metadata, survives backup, and only a real save asks to update the copy', async ({ page }) => {
  test.setTimeout(90000);
  page.on('dialog', d => d.accept());
  await boot(page, { empty: true });
  await pickBright(page);
  await page.click('#artDone');
  await expect(page.locator('#art')).toBeHidden();
  await page.click('#artRow');
  await page.locator('#art:not(.hidden)').waitFor();
  await setDim(page, 40);
  await page.click('#artBack');
  await expect(page.locator('#confirm:not(.hidden)')).toBeVisible();
  await page.click('#confirm [data-ans="discard"]');
  await expect(page.locator('#art')).toBeHidden();
  expect(await page.evaluate(() => window.__app.art.draft().dim)).toBe(0);
  await page.click('#artRow');
  await page.locator('#art:not(.hidden)').waitFor();
  await expect(page.locator('#artDimRange')).toHaveValue('0');
  await setDim(page, 40);
  await page.click('#artBack');
  await expect(page.locator('#confirm:not(.hidden)')).toBeVisible();
  await page.click('#confirm [data-ans="save"]');
  await expect(page.locator('#edPreview')).toHaveClass(/dimmed/);
  await page.click('#edCancel');
  await page.click('#confirm [data-ans="discard"]');
  expect(await page.evaluate(() => window.__app.cards().length)).toBe(0);

  await pickBright(page);
  const sized = await page.evaluate(() => window.__app.art.session().bytes);
  expect(sized).toBeGreaterThan(1000);
  await setDim(page, 60);
  expect(await page.evaluate(() => window.__app.art.session().bytes)).toBe(sized);
  await page.click('#artDone');
  await page.locator('#form button[type="submit"]').click();
  await expect(page.locator('#editor')).toBeHidden();
  await page.evaluate(async () => localStorage.setItem('bkHash', await window.__app.backup.dataHash()));
  await hidePill(page);
  const saved = await page.evaluate(async () => {
    const c = window.__app.cards()[0];
    const bg = await window.__app.backup.bgGet(c.id);
    return { dim: c.dim, uses: c.uses || 0, order: c.order, bytes: bg.size, len: JSON.stringify(c).length };
  });
  expect(saved.dim).toBe(60);
  expect(saved.uses).toBe(0);
  expect(saved.bytes).toBeGreaterThan(500);
  expect(saved.len).toBeLessThan(4096);
  const photoBytes = saved.bytes;

  await page.locator('#stack .card').click();
  await page.locator('#viewer:not(.hidden)').waitFor();
  await page.click('#editBtn');
  await page.locator('#editor:not(.hidden)').waitFor();
  const counts = await page.evaluate(() => {
    const c = window.__app.cards()[0];
    return { uses: c.uses, order: c.order };
  });
  await page.click('#artRow');
  await expect(page.locator('#artDimRange')).toHaveValue('60');
  await setDim(page, 25);
  const live = await page.evaluate(() => {
    const c = window.__app.cards()[0];
    return { dim: c.dim, uses: c.uses, order: c.order, bytes: window.__app.art.session().bytes };
  });
  expect(live.dim).toBe(60);
  expect(live.uses).toBe(counts.uses);
  expect(live.order).toBe(counts.order);
  expect(live.bytes).toBeGreaterThan(500);
  await expect(page.locator('#bkOffer.on')).toHaveCount(0);
  await page.click('#artDone');
  await page.locator('#form button[type="submit"]').click();
  await expect(page.locator('#bkOffer.on')).toBeVisible();
  await expect(page.locator('#bkOffer')).toContainText('Обновить копию');
  const after = await page.evaluate(async () => {
    const c = window.__app.cards()[0];
    const bg = await window.__app.backup.bgGet(c.id);
    const h = await window.__app.backup.dataHash();
    c.uses = (c.uses || 0) + 5;
    const again = await window.__app.backup.dataHash();
    c.uses = 1;
    return { dim: c.dim, bytes: bg.size, changed: h !== localStorage.getItem('bkHash'), same: again === h };
  });
  expect(after.dim).toBe(25);
  expect(after.bytes).toBe(photoBytes);
  expect(after.changed).toBe(true);
  expect(after.same).toBe(true);

  const round = await page.evaluate(async () => {
    const file = await window.__app.backup.buildBackup();
    const packed = JSON.parse(await file.text());
    const card = packed.cards[0];
    window.__app.cards().splice(0, window.__app.cards().length);
    await window.__app.backup.bgPut(card.id, null);
    await window.__app.backup.restoreFrom([new File([JSON.stringify(packed)], 'CardsForKitty.json', { type: 'application/json' })]);
    const c = window.__app.cards().find(x => x.name === 'Свет');
    const bg = await window.__app.backup.bgGet(c.id);
    const amounts = [0, 25, 50, 75, 100].map(n => window.__app.art.dimAmount(n).b);
    return {
      dim: c.dim, bytes: bg.size,       leak: JSON.stringify(card).includes('data:image'),
      even: Math.abs((amounts[2] - amounts[1]) - (amounts[1] - amounts[0])) < 0.002,
      maxB: window.__app.art.dimAmount(100).b, maxS: window.__app.art.dimAmount(100).s,
      clamp: [window.__app.art.clampDim(140), window.__app.art.clampDim(-3), window.__app.art.clampDim('40'), window.__app.art.clampDim('nope')],
    };
  });
  expect(round.dim).toBe(25);
  expect(round.bytes).toBe(photoBytes);
  expect(round.leak).toBe(false);
  expect(round.even).toBe(true);
  expect(round.maxB).toBeGreaterThanOrEqual(0.75);
  expect(round.maxS).toBeGreaterThanOrEqual(0.6);
  expect(round.clamp).toEqual([100, 0, 40, 0]);

  const legacy = await page.evaluate(async () => {
    const older = { app: 'kartochki', savedAt: '2024-06-01T00:00:00.000Z', cards: [{ id: 'old1', name: 'Старая', number: '777', format: 'Code128', color: '#bcd6f5', upd: Date.now(), display: '' }] };
    await window.__app.backup.restoreFrom([new File([JSON.stringify(older)], 'old.json', { type: 'application/json' })]);
    const old = window.__app.cards().find(c => c.id === 'old1');
    const file = await window.__app.backup.buildBackup();
    const packed = JSON.parse(await file.text());
    const card = packed.cards.find(c => c.name === 'Свет');
    card.dim = 140;
    card.upd = Date.now() + 1000;
    packed.savedAt = '2026-08-01T00:00:00.000Z';
    await window.__app.backup.restoreFrom([new File([JSON.stringify(packed)], 'hi.json', { type: 'application/json' })]);
    const w = window.__app.cards().find(c => c.name === 'Свет');
    const bg = await window.__app.backup.bgGet(w.id);
    return { oldDim: old && old.dim || 0, oldBg: old && old.bg || 0, wildDim: w.dim, bytes: bg.size };
  });
  expect(legacy.oldDim).toBe(0);
  expect(legacy.oldBg).toBe(0);
  expect(legacy.wildDim).toBe(100);
  expect(legacy.bytes).toBe(photoBytes);

  await page.evaluate(() => {
    for (const id of ['#editor', '#art', '#look', '#confirm', '#addMenu']) {
      const el = document.querySelector(id);
      if (el) el.classList.add('hidden');
    }
  });
  await page.click('#searchBtn');
  await page.fill('#search', 'свет');
  await expect(page.locator('#stack .card')).toHaveCount(1);
  await page.locator('#stack .card', { hasText: 'Свет' }).click();
  await page.locator('#viewer:not(.hidden)').waitFor();
  await page.click('#editBtn');
  await page.locator('#editor:not(.hidden)').waitFor();
  await page.click('#artRow');
  await page.click('#artModeColor');
  await expect(page.locator('#artDimRange')).toBeHidden();
  await page.click('#artDone');
  await page.locator('#form button[type="submit"]').click();
  const cleared = await page.evaluate(async () => {
    const c = window.__app.cards().find(x => x.name === 'Свет');
    return { dim: c.dim || 0, bg: c.bg || 0, color: c.color };
  });
  expect(cleared.dim).toBe(0);
  expect(cleared.bg).toBe(0);
  expect(cleared.color.toLowerCase()).toBe('#f9c5d5');
});

test('the slider fits a short screen, stays offline, and does not dismiss the sheet', async ({ page }) => {
  await boot(page, { empty: true });
  await pickBright(page);
  await page.setViewportSize({ width: 390, height: 480 });
  const nested = await page.locator('#art .sheet').evaluate(el => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  expect(nested.top).toBeGreaterThanOrEqual(-1);
  expect(nested.bottom).toBeLessThanOrEqual(481);
  expect(nested.left).toBeGreaterThanOrEqual(-1);
  expect(nested.right).toBeLessThanOrEqual(391);
  expect(nested.sw).toBeLessThanOrEqual(nested.cw + 1);

  const hit = async (selector) => {
    await page.locator(selector).scrollIntoViewIfNeeded();
    const box = await page.locator(selector).boundingBox();
    expect(box, selector).toBeTruthy();
    expect(Math.round(box.height), selector).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.width), selector).toBeGreaterThanOrEqual(44);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.y + box.height).toBeLessThanOrEqual(481);
  };
  await page.locator('#artDel').scrollIntoViewIfNeeded();
  await hit('#artDel');
  await hit('#artReplace');
  await hit('#artCrop');
  await hit('#artBack');
  await hit('#lookRow');
  await hit('#artDimRange');
  await page.click('#artDone');
  const outer = await page.locator('#editor .sheet').evaluate(el => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, right: r.right, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  expect(outer.top).toBeGreaterThanOrEqual(-1);
  expect(outer.bottom).toBeLessThanOrEqual(481);
  expect(outer.right).toBeLessThanOrEqual(391);
  expect(outer.sw).toBeLessThanOrEqual(outer.cw + 1);
  await page.click('#artRow');
  await page.locator('#artDimRange').scrollIntoViewIfNeeded();
  await touchSwipe(page, '#artDimRange', 420);
  await expect(page.locator('#art:not(.hidden)')).toBeVisible();
  await expect(page.locator('#confirm')).toBeHidden();

  await page.context().setOffline(true);
  await setDim(page, 80);
  await expect(page.locator('#artPreview')).toHaveClass(/dimmed/);
  const offline = await page.locator('#artPreview').evaluate(el => el.style.getPropertyValue('--dim-b'));
  expect(offline).toBe('0.824');
  await page.context().setOffline(false);
});
