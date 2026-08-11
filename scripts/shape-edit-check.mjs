// Shapes must render with all four edges and stay editable after drawing.
//
//   npm run dev
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/shape-edit-check.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const SESSION = JSON.stringify({
  state: { isAuthenticated: true, currentUser: { username: '선생님', role: '교사' } },
  version: 0,
});

const log = (...a) => console.log('•', ...a);
const shapes = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-canvas-world="true"] > div')]
      .filter((d) => !d.dataset.groupPage && !d.dataset.presenceLayer)
      .map((d) => {
        const cs = getComputedStyle(d);
        return {
          borders: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth],
          color: cs.borderTopColor,
          radius: cs.borderRadius,
          w: Math.round(d.getBoundingClientRect().width),
          h: Math.round(d.getBoundingClientRect().height),
        };
      })
  );

const browser = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE);
await page.evaluate((s) => localStorage.setItem('padlet-auth-local', s), SESSION);
await page.reload();
await page.waitForTimeout(1400);
await page.getByRole('button', { name: /모둠 협업 캔버스/ }).click();
await page.getByRole('button', { name: /새 캔버스/ }).click();
await page.getByPlaceholder('예: 4학년 과학 브레인스토밍').fill('도형 편집 확인');
await page.getByRole('button', { name: /캔버스 만들고 열기/ }).click();
await page.waitForTimeout(1500);

const box = await page.locator('[data-canvas-bg="true"]').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

const drawShape = async (tool, x1, y1, x2, y2) => {
  await page.getByTitle(tool).click();
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
};

await drawShape('사각형', cx - 330, cy - 150, cx - 130, cy - 10);
await drawShape('원', cx + 40, cy - 150, cx + 240, cy - 10);

const drawn = await shapes(page);
log('rect borders:', drawn[0].borders.join(' / '));
log('ellipse borders:', drawn[1].borders.join(' / '));
const allEdges = drawn.every((s) => s.borders.every((b) => parseFloat(b) > 0));
log(`every edge drawn (top no longer missing): ${allEdges}`);

// --- Resize the rectangle by its handle ---
await page.getByTitle('선택 / 이동').click();
await page.mouse.click(cx - 330 + 4, cy - 80); // click the rect's left edge to select
await page.waitForTimeout(500);
const handle = await page.locator('[title="드래그해서 크기 조절"]').first().boundingBox();
log(`resize handle shown when selected: ${Boolean(handle)}`);

if (handle) {
  const beforeResize = (await shapes(page))[0];
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 120, handle.y + 70, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const afterResize = (await shapes(page))[0];
  log(
    `resized: ${afterResize.w > beforeResize.w + 40 && afterResize.h > beforeResize.h + 20}`,
    `(${beforeResize.w}x${beforeResize.h} -> ${afterResize.w}x${afterResize.h})`
  );
}

// --- Recolour and re-thicken the selected shape from the toolbar ---
const beforeColor = (await shapes(page))[0].color;
await page.locator('.sandbox-toolbar .swatch').nth(3).click();
await page.waitForTimeout(500);
const afterColor = (await shapes(page))[0].color;
log(`colour changed from the toolbar: ${afterColor !== beforeColor}`, `(${beforeColor} -> ${afterColor})`);

const beforeWidth = (await shapes(page))[0].borders[0];
await page.locator('.sandbox-toolbar button[title^="두께"]').last().click();
await page.waitForTimeout(500);
const afterWidth = (await shapes(page))[0].borders[0];
log(`thickness changed from the toolbar: ${afterWidth !== beforeWidth}`, `(${beforeWidth} -> ${afterWidth})`);

// Edits must survive a round trip through storage
const stored = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('padlet-sandbox-storage-local'));
  const rect = s.elements.find((e) => e.type === 'rect');
  return { w: Math.round(rect.width), h: Math.round(rect.height), color: rect.color, sw: rect.strokeWidth };
});
log('stored rect:', JSON.stringify(stored));

await page.screenshot({ path: '/tmp/shape-edit.png' });
console.log('\npage errors:', errors.length ? errors : 'none');
await browser.close();
