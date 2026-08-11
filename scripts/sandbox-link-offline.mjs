// Verifies the core promise of a share link: it still opens the canvas after
// everyone who had it open has left.
//
//   npm run dev
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/sandbox-link-offline.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const SESSION = JSON.stringify({
  state: {
    isAuthenticated: true,
    currentUser: { username: '선생님', role: '교사' },
  },
  version: 0,
});

const log = (...a) => console.log('•', ...a);
const browser = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome' });
const errors = [];

// --- Teacher creates a canvas and writes on it ---
const teacherCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const teacher = await teacherCtx.newPage();
teacher.on('pageerror', (e) => errors.push(`[teacher] ${e.message}`));

await teacher.goto(BASE);
await teacher.evaluate((s) => localStorage.setItem('padlet-auth-local', s), SESSION);
await teacher.reload();
await teacher.waitForTimeout(1500);

await teacher.getByRole('button', { name: /모둠 협업 캔버스/ }).click();
await teacher.getByRole('button', { name: /새 캔버스/ }).click();
await teacher.getByPlaceholder('예: 4학년 과학 브레인스토밍').fill('오프라인 링크 캔버스');
await teacher.getByRole('button', { name: /캔버스 만들고 열기/ }).click();
await teacher.waitForTimeout(1500);

const box = await teacher.locator('[data-canvas-bg="true"]').boundingBox();
await teacher.getByTitle('메모지').click();
await teacher.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await teacher.waitForTimeout(400);
await teacher.keyboard.type('선생님이 남긴 메모');
await teacher.mouse.click(box.x + 60, box.y + 60);
await teacher.waitForTimeout(600);

const sandboxId = await teacher.evaluate(
  () => JSON.parse(localStorage.getItem('padlet-sandbox-storage-local')).sandboxes[0].id
);
log('sandbox id:', sandboxId);

// Let the shareable copy settle on the broker, then leave entirely
await teacher.waitForTimeout(3500);
await teacherCtx.close();
log('teacher closed the app');
await new Promise((r) => setTimeout(r, 2500));

// --- A visitor with only the link, nobody else online ---
const visitorCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const visitor = await visitorCtx.newPage();
visitor.on('pageerror', (e) => errors.push(`[visitor] ${e.message}`));

await visitor.goto(`${BASE}?sandbox=${sandboxId}`);
await visitor.waitForTimeout(1500);
const showsLoading = await visitor.getByText('캔버스를 불러오는 중').isVisible().catch(() => false);
log(`shows loading state while fetching: ${showsLoading}`);

await visitor.waitForTimeout(6000);

const opened = await visitor.getByTitle('메모지').isVisible().catch(() => false);
const seesNote = await visitor.evaluate(() => document.body.innerText.includes('선생님이 남긴 메모'));
const notFound = await visitor
  .getByText('캔버스를 찾을 수 없습니다')
  .isVisible()
  .catch(() => false);
log(`visitor opened canvas: ${opened} | sees teacher's note: ${seesNote} | "not found": ${notFound}`);

// The visitor can contribute, and their work must also survive them leaving
if (opened) {
  const vbox = await visitor.locator('[data-canvas-bg="true"]').boundingBox();
  await visitor.getByTitle('메모지').click();
  await visitor.mouse.click(vbox.x + vbox.width / 2 + 240, vbox.y + 160);
  await visitor.waitForTimeout(400);
  await visitor.keyboard.type('방문자 메모');
  await visitor.mouse.click(vbox.x + 60, vbox.y + 60);
  await visitor.waitForTimeout(3500);
}
await visitorCtx.close();
log('visitor closed the app');
await new Promise((r) => setTimeout(r, 2500));

// --- A second visitor, long after everyone left ---
const laterCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const later = await laterCtx.newPage();
later.on('pageerror', (e) => errors.push(`[later] ${e.message}`));
await later.goto(`${BASE}?sandbox=${sandboxId}`);
await later.waitForTimeout(7000);

const laterOpened = await later.getByTitle('메모지').isVisible().catch(() => false);
const laterText = await later.evaluate(() => document.body.innerText);
log(
  `second visitor opened: ${laterOpened} | sees teacher note: ${laterText.includes('선생님이 남긴 메모')} | sees visitor note: ${laterText.includes('방문자 메모')}`
);
await later.screenshot({ path: '/tmp/sandbox-link-offline.png' });

console.log('\npage errors:', errors.length ? errors : 'none');
await browser.close();
