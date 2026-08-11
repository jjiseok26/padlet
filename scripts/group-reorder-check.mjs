// Dragging a 모둠 in the rail must reorder it, survive a reload, and reach
// everyone else in the canvas.
//
//   npm run dev
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/group-reorder-check.mjs
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
const names = (page) =>
  page.$$eval('.sandbox-rail-item .sandbox-rail-name', (els) => els.map((e) => e.textContent.trim()));

const browser = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome' });
const errors = [];

const teacherCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const teacher = await teacherCtx.newPage();
teacher.on('pageerror', (e) => errors.push(`[teacher] ${e.message}`));

await teacher.goto(BASE);
await teacher.evaluate((s) => localStorage.setItem('padlet-auth-local', s), SESSION);
await teacher.reload();
await teacher.waitForTimeout(1400);

await teacher.getByRole('button', { name: /모둠 협업 캔버스/ }).click();
await teacher.getByRole('button', { name: /새 캔버스/ }).click();
await teacher.getByPlaceholder('예: 4학년 과학 브레인스토밍').fill('순서 변경 캔버스');
await teacher.getByRole('button', { name: /캔버스 만들고 열기/ }).click();
await teacher.waitForTimeout(1500);

const before = await names(teacher);
log('before:', before.join(' , '));

// Drag the last 모둠 to the top
const items = teacher.locator('.sandbox-rail-item');
await items.nth(3).dragTo(items.nth(0));
await teacher.waitForTimeout(800);

const after = await names(teacher);
log('after drag 4→1:', after.join(' , '));
await teacher.screenshot({ path: '/tmp/group-reorder-teacher.png' });
log(`reordered: ${after[0] === before[3] && after.length === before.length}`);

// Reordering must not disturb which canvas is open
const openGroup = await teacher.evaluate(
  () => document.querySelector('[data-group-page="true"] > div')?.textContent
);
log(`still viewing: ${openGroup}`);

// Persisted? A reload lands on the dashboard, so read the stored order.
await teacher.reload();
await teacher.waitForTimeout(2500);
const storedOrder = await teacher.evaluate(() =>
  JSON.parse(localStorage.getItem('padlet-sandbox-storage-local')).sandboxes[0].groups.map(
    (g) => g.name
  )
);
log(`survives reload: ${storedOrder.join(',') === after.join(',')}`, `(${storedOrder.join(' , ')})`);

// Does the new order reach a visitor on the share link?
const sandboxId = await teacher.evaluate(
  () => JSON.parse(localStorage.getItem('padlet-sandbox-storage-local')).sandboxes[0].id
);
await teacher.waitForTimeout(2500);

const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const guest = await guestCtx.newPage();
guest.on('pageerror', (e) => errors.push(`[guest] ${e.message}`));
await guest.goto(`${BASE}?sandbox=${sandboxId}`);
await guest.waitForTimeout(6500);
const guestOrder = await names(guest);
log('guest sees:', guestOrder.join(' , '));
log(`order shared with others: ${guestOrder.join(',') === after.join(',')}`);

await guest.screenshot({ path: '/tmp/group-reorder.png' });
console.log('\npage errors:', errors.length ? errors : 'none');
await browser.close();
