const { test, expect } = require('@playwright/test');
const { boot, openManual, makeJpeg, chooseFile, touchSwipe, pointerSwipe } = require('./helpers');

test('sheet swipes still dismiss add and edit, and a dirty editor asks first', async ({ page }) => {
  await boot(page, { empty: true });
  await page.click('#addBtn');
  await page.locator('#addMenu:not(.hidden)').waitFor();
  await touchSwipe(page, '#addMenu .sheet', 480);
  await expect(page.locator('#addMenu')).toBeHidden();

  await page.click('#addBtn');
  await page.click('[data-act="manual"]');
  await page.locator('#editor:not(.hidden)').waitFor();
  await touchSwipe(page, '#editor .sheet', 520);
  await expect(page.locator('#editor')).toBeHidden();
  await expect(page.locator('#confirm')).toBeHidden();

  await openManual(page, 'Свайп');
  await touchSwipe(page, '#editor .sheet', 520);
  await expect(page.locator('#confirm:not(.hidden)')).toBeVisible();
  await page.click('#confirm [data-ans="keep"]');
  await expect(page.locator('#fName')).toHaveValue('Свайп');
  await expect(page.locator('#editor:not(.hidden)')).toBeVisible();
  await page.click('#edCancel');
  await page.click('#confirm [data-ans="discard"]');
});

test('opening a card still closes with a downward swipe and does not reorder', async ({ page }) => {
  await boot(page, { empty: true });
  await openManual(page, 'Жест');
  await page.locator('#form button[type="submit"]').click();
  await page.locator('#editor').waitFor({ state: 'hidden' });
  await page.locator('#stack .card', { hasText: 'Жест' }).click();
  await page.locator('#viewer:not(.hidden)').waitFor();
  const order = await page.evaluate(() => window.__app.cards().map(c => [c.id, c.order, c.uses]));
  expect(order[0][2]).toBe(1);
  await pointerSwipe(page, '#stack .card', 180);
  await expect(page.locator('#viewer')).toBeHidden();
  const after = await page.evaluate(() => window.__app.cards().map(c => [c.id, c.order, c.uses]));
  expect(after).toEqual(order);
  expect(await page.evaluate(() => localStorage.getItem('manualOrder'))).toBeNull();
});

test('cropping does not close when the photo is dragged', async ({ page }) => {
  await boot(page, { empty: true });
  const jpeg = await makeJpeg(page, 1000, 700);
  await openManual(page, 'Кадр');
  await page.click('#artRow');
  await page.click('#artModeImage');
  await chooseFile(page, '#artPick', jpeg);
  await page.locator('#crop:not(.hidden)').waitFor();
  await page.waitForFunction(() => document.querySelector('#cropFrame').getBoundingClientRect().width > 80);
  await page.locator('#cropZoom').evaluate(el => { el.value = '2.4'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const y0 = await page.evaluate(() => window.__app.art.session().crop.y);
  await pointerSwipe(page, '#cropFrame', 140);
  await expect(page.locator('#crop:not(.hidden)')).toBeVisible();
  await expect(page.locator('#confirm')).toBeHidden();
  await expect(page.locator('#art:not(.hidden)')).toBeVisible();
  const y1 = await page.evaluate(() => {
    const img = document.querySelector('#cropImg');
    return { top: parseFloat(img.style.top), width: parseFloat(img.style.width) };
  });
  expect(y1.width).toBeGreaterThan(100);
  expect(Number.isFinite(y1.top)).toBe(true);
  expect(y0).toBeGreaterThan(0);
  await page.evaluate(() => {
    const frame = document.querySelector('#cropFrame');
    const r = frame.getBoundingClientRect();
    const cy = r.top + r.height / 2, cx = r.left + r.width / 2;
    const fire = (type, x, y, id) => frame.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: id === 1,
    }));
    fire('pointerdown', cx - 30, cy, 1);
    fire('pointerdown', cx + 30, cy, 2);
    fire('pointermove', cx - 70, cy, 1);
    fire('pointermove', cx + 70, cy, 2);
    fire('pointerup', cx - 70, cy, 1);
    fire('pointerup', cx + 70, cy, 2);
  });
  await expect(page.locator('#crop:not(.hidden)')).toBeVisible();
  const zoomed = await page.evaluate(() => parseFloat(document.querySelector('#cropImg').style.width));
  expect(zoomed).toBeGreaterThan(y1.width - 1);
  await page.click('#cropCancel');
  await expect(page.locator('#artPick')).toBeVisible();
});
