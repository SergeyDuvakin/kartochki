const { test, expect } = require('@playwright/test');
const { boot, shot, makeBrightJpeg, makeDarkJpeg, openManual, chooseFile, hidePill } = require('./helpers');

async function pickBright(page) {
  const jpeg = await makeBrightJpeg(page);
  await openManual(page, 'Свет');
  await page.click('#artRow');
  await page.click('#artModeImage');
  await chooseFile(page, '#artPick', jpeg);
  await page.locator('#crop:not(.hidden)').waitFor();
  await page.click('#cropDone');
  await expect(page.locator('#artTools')).toBeVisible();
}

function readScrim(el) {
  const card = el.closest('.card');
  const edge = card.querySelector('.edge');
  const brand = card.querySelector('.brand');
  const cr = card.getBoundingClientRect();
  const er = edge.getBoundingClientRect();
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
    ghosts,
    darkText: card.classList.contains('dark'),
  };
}

test('a bright photo gets a short fading scrim, not a bar across the stack', async ({ page }) => {
  await boot(page, { empty: true });
  await pickBright(page);
  await expect(page.locator('#art input[type="range"]')).toHaveCount(0);
  await expect(page.locator('#art')).not.toContainText('Приглушение');
  await expect(page.locator('#artPreview')).toHaveClass(/has-bg/);
  await expect(page.locator('#artPreview')).toHaveClass(/dark/);
  const preview = await page.locator('#artPreview').evaluate(readScrim);
  expect(preview.edgeH).toBeGreaterThan(30);
  expect(preview.edgeH).toBeLessThanOrEqual(60);
  expect(preview.edgePastStrip).toBeLessThanOrEqual(60.5);
  expect(preview.gradient).toContain('gradient');
  expect(preview.gradient).toMatch(/,\s*0\)|transparent/);
  expect(preview.gradient).toContain('255, 250, 252');
  expect(preview.brandBg).toBe('rgba(0, 0, 0, 0)');
  expect(preview.brandBlur).toBe('none');
  expect(preview.ghosts).toEqual([]);
  await expect(page.locator('#lookRow')).toBeVisible();
  await expect(page.locator('#artReplace')).toBeVisible();
  await expect(page.locator('#artCrop')).toBeVisible();
  await expect(page.locator('#artDel')).toBeVisible();
  await shot(page, 'bright-appearance');

  const before = await page.evaluate(() => window.__app.cards().reduce((n, c) => n + (c.uses || 0), 0));
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
  await page.locator('#lookStackCard').scrollIntoViewIfNeeded();
  const stacked = await page.locator('#lookStackCard').evaluate(readScrim);
  expect(stacked.edgeH).toBeLessThanOrEqual(60);
  expect(stacked.ghosts).toEqual([]);
  await shot(page, 'bright-look-stack', 300);
  await page.click('#lookBack');
  expect(await page.evaluate(() => window.__app.cards().reduce((n, c) => n + (c.uses || 0), 0))).toBe(before);

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
  const home = await page.locator('#stack .card', { hasText: 'Свет' }).evaluate(readScrim);
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
