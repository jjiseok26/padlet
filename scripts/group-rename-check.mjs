// Renaming a 모둠 from the rail must stick, survive a reload, and reach the
// other people in the canvas.
//
//   npm run dev
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/group-rename-check.mjs
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
await teacher.getByPlaceholder('예: 4학년 과학 브레인스토밍').fill('이름 변경 캔버스');
await teacher.getByRole('button', { name: /캔버스 만들고 열기/ }).click();
await teacher.waitForTimeout(1500);

log('before:', (await names(teacher)).join(' , '));

// 1) Pencil button on the row
const rows = teacher.locator('.sandbox-rail-item');
await rows.nth(0).hover();
await rows.nth(0).locator('.sandbox-rail-controls button').first().click();
await teacher.waitForTimeout(300);
await teacher.keyboard.press('ControlOrMeta+a');
await teacher.keyboard.type('바다 탐험대');
await teacher.keyboard.press('Enter');
await teacher.waitForTimeout(700);
log('after pencil rename:', (await names(teacher)).join(' , '));

// 2) Double-click the row
await rows.nth(1).dblclick();
await teacher.waitForTimeout(300);
await teacher.keyboard.press('ControlOrMeta+a');
await teacher.keyboard.type('숲 지킴이');
await teacher.keyboard.press('Enter');
await teacher.waitForTimeout(700);
const renamed = await names(teacher);
log('after double-click rename:', renamed.join(' , '));

// 3) Escape must leave the name alone
await rows.nth(2).dblclick();
await teacher.waitForTimeout(300);
await teacher.keyboard.press('ControlOrMeta+a');
await teacher.keyboard.type('버려질 이름');
await teacher.keyboard.press('Escape');
await teacher.waitForTimeout(500);
const afterEscape = await names(teacher);
log(`escape cancels the edit: ${afterEscape.join(',') === renamed.join(',')}`);

// The renamed group's page badge should follow
await teacher.locator('.sandbox-rail-item').nth(0).locator('button').first().click();
await teacher.waitForTimeout(600);
const pageBadge = await teacher.evaluate(
  () => document.querySelector('[data-group-page="true"] > div')?.textContent
);
log(`canvas badge shows new name: ${pageBadge === '바다 탐험대'} (${pageBadge})`);

await teacher.screenshot({ path: '/tmp/group-rename.png' });

// Persisted and shared?
const stored = await teacher.evaluate(() =>
  JSON.parse(localStorage.getItem('padlet-sandbox-storage-local')).sandboxes[0].groups.map((g) => g.name)
);
log(`stored: ${stored.join(',') === renamed.join(',')}`, `(${stored.join(' , ')})`);

const sandboxId = await teacher.evaluate(
  () => JSON.parse(localStorage.getItem('padlet-sandbox-storage-local')).sandboxes[0].id
);
await teacher.waitForTimeout(2500);

const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const guest = await guestCtx.newPage();
guest.on('pageerror', (e) => errors.push(`[guest] ${e.message}`));
await guest.goto(`${BASE}?sandbox=${sandboxId}`);
await guest.waitForTimeout(6500);
const guestNames = await names(guest);
log(`others see the new names: ${guestNames.join(',') === renamed.join(',')}`, `(${guestNames.join(' , ')})`);

// Guests must not be able to rename
const guestControls = await guest.locator('.sandbox-rail-controls').count();
log(`guest has no rename controls: ${guestControls === 0}`);

console.log('\npage errors:', errors.length ? errors : 'none');
await browser.close();
