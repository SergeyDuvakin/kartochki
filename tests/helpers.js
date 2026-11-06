const fs = require('fs');
const path = require('path');

const ART = '/opt/cursor/artifacts';

async function boot(page, { empty = false } = {}) {
  if (empty) {
    await page.addInitScript(() => {
      localStorage.setItem('seeded', '1');
      localStorage.setItem('seedV', '2');
      localStorage.setItem('mirror', '[]');
    });
  }
  await page.goto('/index.html');
  await page.waitForFunction(() => window.__app && window.__app.art && window.__app.backup);
  await page.locator('h1').waitFor();
}

async function shot(page, name, pause = 0) {
  if (page.context()._browser.browserType().name() !== 'chromium') return;
  if (pause) await page.waitForTimeout(pause);
  fs.mkdirSync(ART, { recursive: true });
  await page.screenshot({ path: path.join(ART, name + '.png') });
}

async function makeJpeg(page, w, h) {
  const bytes = await page.evaluate(async ({ w, h }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#5b2a86');
    g.addColorStop(0.5, '#f4a7c5');
    g.addColorStop(1, '#ffe08a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(w * 0.3, h * 0.42, Math.min(w, h) * 0.16, 0, 7); x.fill();
    x.fillStyle = '#3a2030';
    x.font = `700 ${Math.max(12, Math.round(h * 0.09))}px sans-serif`;
    x.fillText('LOYAL', w * 0.48, h * 0.48);
    for (let i = 0; i < 1200; i++) {
      x.fillStyle = `rgba(20,10,30,${Math.random() * 0.25})`;
      x.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    return [...new Uint8Array(await blob.arrayBuffer())];
  }, { w, h });
  return Buffer.from(bytes);
}

function withExif(jpeg, orient) {
  const tiff = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orient & 255, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const len = payload.length + 2;
  const seg = Buffer.concat([Buffer.from([0xff, 0xe1, (len >> 8) & 255, len & 255]), payload]);
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('not a jpeg');
  return Buffer.concat([jpeg.subarray(0, 2), seg, jpeg.subarray(2)]);
}

async function openManual(page, name = 'Тест') {
  await page.click('#addBtn');
  await page.locator('#addMenu:not(.hidden)').waitFor();
  await page.click('[data-act="manual"]');
  await page.locator('#editor:not(.hidden)').waitFor();
  await page.fill('#fName', name);
  await page.fill('#fNum', 'ABC12345');
  await page.selectOption('#fFmt', 'Code128');
}

async function chooseFile(page, selector, buffer, name = 'photo.jpg', mime = 'image/jpeg') {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click(selector),
  ]);
  await chooser.setFiles({ name, mimeType: mime, buffer });
}

async function hidePill(page) {
  const pill = page.locator('#bkOffer.on');
  if (await pill.count()) await page.click('#bkOffer [data-b="later"]');
}

async function touchSwipe(page, selector, dy) {
  await page.evaluate(({ selector, dy }) => {
    const el = document.querySelector(selector);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = Math.min(r.bottom - 24, r.top + 28);
    let touchOk = true;
    try { new Touch({ identifier: 1, target: el, clientX: x, clientY: y }); }
    catch (e) { touchOk = false; }
    if (touchOk) {
      const fire = (type, cy) => {
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: cy, pageX: x, pageY: cy });
        el.dispatchEvent(new TouchEvent(type, {
          bubbles: true, cancelable: true,
          touches: type === 'touchend' ? [] : [t],
          targetTouches: type === 'touchend' ? [] : [t],
          changedTouches: [t],
        }));
      };
      fire('touchstart', y);
      for (let i = 1; i <= 6; i++) fire('touchmove', y + dy * i / 6);
      fire('touchend', y + dy);
      return;
    }
    const fire = (type, cy) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: x, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0,
    }));
    fire('pointerdown', y);
    for (let i = 1; i <= 6; i++) fire('pointermove', y + dy * i / 6);
    fire('pointerup', y + dy);
  }, { selector, dy });
}

async function pointerSwipe(page, selector, dy) {
  await page.evaluate(({ selector, dy }) => {
    const el = document.querySelector(selector);
    const r = el.getBoundingClientRect();
    const x = r.left + Math.min(40, r.width / 2);
    const y = r.top + 36;
    const fire = (type, cy) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: x, clientY: cy,
      pointerId: 1, pointerType: 'touch', isPrimary: true,
    }));
    fire('pointerdown', y);
    for (let i = 1; i <= 5; i++) fire('pointermove', y + dy * i / 5);
    fire('pointerup', y + dy);
  }, { selector, dy });
}

module.exports = { boot, shot, makeJpeg, withExif, openManual, chooseFile, hidePill, touchSwipe, pointerSwipe, ART };
