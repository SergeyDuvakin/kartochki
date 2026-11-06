const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { boot, hidePill } = require('./helpers');

const ART = '/opt/cursor/artifacts';

async function paintWallet(page) {
  await page.evaluate(async () => {
    const W = 900, H = 568;
    const ellipse = (x, cx, cy, rx, ry, color) => { x.fillStyle = color; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
    const paints = {
      sky(x, w, h) {
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#b9e0ff'); g.addColorStop(.4, '#eaf6ff'); g.addColorStop(1, '#8ec8ef');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        ellipse(x, w * .25, h * .16, w * .22, h * .08, 'rgba(255,255,255,.92)');
        ellipse(x, w * .62, h * .12, w * .2, h * .07, 'rgba(255,255,255,.88)');
      },
      warm(x, w, h) {
        x.fillStyle = '#e25822'; x.fillRect(0, 0, w, h);
        const g = x.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#ffb03a'); g.addColorStop(1, '#c62828');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        ellipse(x, w * .7, h * .28, w * .14, w * .14, '#ffe08a');
      },
      pale(x, w, h) {
        x.fillStyle = '#f7f1e8'; x.fillRect(0, 0, w, h);
        ellipse(x, w * .55, h * .55, w * .2, h * .26, 'rgba(214,186,156,.6)');
      },
      psy(x, w, h) {
        x.fillStyle = '#1b1030'; x.fillRect(0, 0, w, h);
        const colors = ['#ff4fa3', '#44e0d0', '#ffe14a', '#7aa2ff'];
        for (let i = 0; i < 12; i++) {
          x.strokeStyle = colors[i % colors.length]; x.lineWidth = 8;
          x.beginPath();
          for (let px = 0; px <= w; px += 16) {
            const y = h * (0.08 + (i % 5) * 0.16) + Math.sin(px / 60 + i) * 22;
            px ? x.lineTo(px, y) : x.moveTo(px, y);
          }
          x.stroke();
        }
      },
      desert(x, w, h) {
        x.fillStyle = '#08343c'; x.fillRect(0, 0, w, h * .42);
        x.fillStyle = '#d7f2ff';
        x.beginPath(); x.moveTo(0, 0); x.lineTo(w * .5, 0); x.quadraticCurveTo(w * .32, h * .2, w * .46, h * .42); x.lineTo(0, h * .42); x.fill();
        ellipse(x, w * .22, h * .1, w * .12, h * .05, '#fff');
        ellipse(x, w * .72, h * .18, 30, 30, '#d81b60');
        const g = x.createLinearGradient(0, h * .4, 0, h);
        g.addColorStop(0, '#f3c56a'); g.addColorStop(1, '#c4552a');
        x.fillStyle = g; x.fillRect(0, h * .4, w, h);
      },
    };
    const cards = [
      ['sky', 'Дикси', '1001', 0],
      ['warm', 'АШАН', '1002', 1],
      ['pale', 'Перекрёсток', '1003', 3],
      ['psy', 'METRO', '1004', 4],
      ['desert', 'SPAR', '1005', 5],
    ];
    let i = 0;
    for (const [kind, name, num, order] of cards) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      paints[kind](c.getContext('2d'), W, H);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      const prep = await window.__app.art.prepareArt(new File([blob], kind + '.jpg', { type: 'image/jpeg' }));
      const id = 'abs' + i;
      await window.__app.backup.bgPut(id, prep.blob);
      window.__app.cards().push({
        id, name, number: num, format: 'EAN-13', color: '#f9c5d5', order, uses: 0, upd: 10 + order,
        bg: 1, crop: prep.crop, bw: prep.w, bh: prep.h, tone: prep.tone, display: '4601234567890',
      });
      i++;
    }
    window.__app.cards().push({
      id: 'plain', name: 'Цветная', number: '1006', format: 'Code128', color: '#f4a7b9', order: 2, uses: 0, display: '',
    });
    document.querySelector('#search').dispatchEvent(new Event('input'));
  });
  await page.waitForFunction(() => document.querySelectorAll('#stack img.bg').length >= 5);
}

test('compact light chip and thin rim stay readable on every photo', async ({ page }, info) => {
  await boot(page, { empty: true });
  await paintWallet(page);
  await expect(page.locator('#stack .card.has-bg')).toHaveCount(5);
  await expect(page.locator('#stack .card', { hasText: 'Цветная' }).locator('.brand')).toHaveCount(0);
  await expect(page.locator('#stack .edge, #artDimRange')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Приглушение');

  const metrics = await page.locator('#stack .card', { hasText: 'SPAR' }).evaluate(el => {
    const card = el.getBoundingClientRect();
    const brand = el.querySelector('.brand').getBoundingClientRect();
    const logo = el.querySelector('.logo').getBoundingClientRect();
    const hole = el.querySelector('.hole').getBoundingClientRect();
    const nm = getComputedStyle(el.querySelector('.nm'));
    const bs = getComputedStyle(el.querySelector('.brand'));
    const shadow = getComputedStyle(el).boxShadow;
    return {
      brandW: brand.width, cardW: card.width, brandH: brand.height,
      logo: logo.width, font: parseFloat(nm.fontSize),
      color: bs.color, bg: bs.backgroundColor, blur: bs.backdropFilter || 'none',
      gap: hole.left - brand.right, shadow,
    };
  });
  expect(metrics.brandW).toBeLessThan(metrics.cardW * 0.62);
  expect(metrics.brandH).toBeLessThanOrEqual(32);
  expect(metrics.logo).toBeLessThanOrEqual(24);
  expect(metrics.font).toBeLessThanOrEqual(14);
  expect(metrics.color).toContain('40');
  expect(metrics.bg).toContain('255');
  expect(metrics.blur).toBe('none');
  expect(metrics.gap).toBeGreaterThan(6);
  expect(metrics.shadow).toMatch(/255,\s*255,\s*255/);

  const tones = await page.locator('#stack .card.has-bg .brand').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).color));
  expect(new Set(tones).size).toBe(1);

  const long = await page.evaluate(() => {
    const c = window.__app.cards().find(x => x.name === 'Перекрёсток');
    c.name = 'Золотое яблоко и очень длинное название';
    document.querySelector('#search').dispatchEvent(new Event('input'));
    return true;
  });
  expect(long).toBe(true);
  await page.setViewportSize({ width: 320, height: 700 });
  const clipped = await page.locator('#stack .card', { hasText: 'Золотое' }).evaluate(el => {
    const brand = el.querySelector('.brand').getBoundingClientRect();
    const hole = el.querySelector('.hole').getBoundingClientRect();
    const nm = el.querySelector('.nm');
    return { gap: hole.left - brand.right, overflow: nm.scrollWidth > nm.clientWidth + 1, text: nm.textContent };
  });
  expect(clipped.gap).toBeGreaterThan(4);
  expect(clipped.overflow).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const c = window.__app.cards().find(x => x.number === '1003');
    c.name = 'Перекрёсток';
    document.querySelector('#search').dispatchEvent(new Event('input'));
  });
  await page.waitForFunction(() => document.querySelectorAll('#stack img.bg').length >= 5);

  await hidePill(page);
  if (info.project.name === 'chromium') {
    fs.mkdirSync(ART, { recursive: true });
    await page.screenshot({ path: path.join(ART, 'v19-stack.png') });
  }

  await page.locator('#stack .card', { hasText: 'SPAR' }).click();
  await page.locator('#viewer:not(.hidden)').waitFor();
  await page.waitForFunction(() => document.querySelector('#vCode').width > 8);
  const open = await page.locator('#viewer .panel').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(open).toBe('rgb(255, 255, 255)');
  await expect(page.locator('#stack .card', { hasText: 'SPAR' }).locator('.brand')).toBeVisible();
  if (info.project.name === 'chromium') {
    await page.screenshot({ path: path.join(ART, 'v19-open.png') });
  }
});
