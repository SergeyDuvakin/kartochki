const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ART = '/opt/cursor/artifacts';

test.use({ viewport: { width: 390, height: 920 } });

test('abstract stack shows three title treatments and one open card', async ({ page }, info) => {
  await page.goto('/preview/titles.html');
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await expect(page.locator('.banner')).toContainText('Не публиковать');
  await expect(page.locator('input, [type="range"]')).toHaveCount(0);

  const tones = await page.locator('#now .card').evaluateAll(nodes => nodes.map(n => ({
    name: n.dataset.name, tone: n.dataset.tone,
  })));
  expect(tones.map(t => t.name)).toEqual(['Дикси', 'АШАН', 'Перекрёсток', 'METRO', 'SPAR']);
  expect(tones.find(t => t.name === 'SPAR').tone).toBe('dark');
  expect(tones.find(t => t.name === 'Дикси').tone).toBe('light');

  const chip = await page.locator('#rim .card', { hasText: 'Перекрёсток' }).evaluate(el => {
    const card = el.getBoundingClientRect();
    const brand = el.querySelector('.brand').getBoundingClientRect();
    const hole = el.querySelector('.hole').getBoundingClientRect();
    const bg = getComputedStyle(el.querySelector('.brand')).backgroundColor;
    return {
      brandW: brand.width, cardW: card.width, brandH: brand.height,
      brandBottom: brand.bottom - card.top, holeLeft: hole.left, brandRight: brand.right,
      bg,
    };
  });
  expect(chip.brandW).toBeLessThan(chip.cardW * 0.8);
  expect(chip.brandH).toBeLessThan(46);
  expect(chip.brandBottom).toBeLessThan(58);
  expect(chip.brandRight).toBeLessThan(chip.holeLeft - 4);
  expect(chip.bg).toContain('255');

  const versions = await page.evaluate(async () => {
    const app = await (await fetch('/app.js?v=18')).text();
    const j = await (await fetch('/version.json')).json();
    return { app: app.includes('const APP_V = 18'), v: j.v };
  });
  expect(versions).toEqual({ app: true, v: 18 });

  if (info.project.name !== 'chromium') return;
  fs.mkdirSync(ART, { recursive: true });
  for (const id of ['now', 'chip', 'rim', 'open']) {
    await page.locator('#' + id).screenshot({ path: path.join(ART, 'preview-' + id + '.png') });
  }
});
