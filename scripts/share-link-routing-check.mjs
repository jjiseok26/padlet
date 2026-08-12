// A share link must open the canvas for everyone — signed out or signed in,
// same browser or a different one.
//
//   npm run dev
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/share-link-routing-check.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const SESSION = JSON.stringify({
  state: { isAuthenticated: true, currentUser: { username: '선생님', role: '교사' } },
  version: 0,
});

const log = (...a) => console.log('•', ...a);

const landedOnCanvas = async (page) => {
  const canvas = await page.locator('[data-canvas-bg="true"]').isVisible().catch(() => false);
  const dashboard = await page.getByPlaceholder('보드 검색...').isVisible().catch(() => false);
  const login = await page
    .getByRole('button', { name: /Google 계정으로 로그인/ })
    .isVisible()
    .catch(() => false);
  return { canvas, dashboard, login };
};

const browser = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome' });
const errors = [];

// --- Teacher creates a canvas and copies the link ---
const teacherCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const teacher = await teacherCtx.newPage();
teacher.on('pageerror', (e) => errors.push(`[teacher] ${e.message}`));

await teacher.goto(BASE);
await teacher.evaluate((s) => localStorage.setItem('padlet-auth-local', s), SESSION);
await teacher.reload();
await teacher.waitForTimeout(1400);
await teacher.getByRole('button', { name: /모둠 협업 캔버스/ }).click();
await teacher.getByRole('button', { name: /새 캔버스/ }).click();
await teacher.getByPlaceholder('예: 4학년 과학 브레인스토밍').fill('링크 라우팅 캔버스');
await teacher.getByRole('button', { name: /캔버스 만들고 열기/ }).click();
await teacher.waitForTimeout(1500);

const sandboxId = await teacher.evaluate(
  () => JSON.parse(localStorage.getItem('padlet-sandbox-storage-local')).sandboxes[0].id
);
const link = `${BASE}?sandbox=${sandboxId}`;
log('share link:', link);
await teacher.waitForTimeout(2500); // let the shareable copy settle

// 1) A second tab in the teacher's own browser — signed in
const sameBrowserTab = await teacherCtx.newPage();
await sameBrowserTab.goto(link);
await sameBrowserTab.waitForTimeout(4000);
const signedIn = await landedOnCanvas(sameBrowserTab);
log(`signed-in tab opens the canvas: ${signedIn.canvas}`, JSON.stringify(signedIn));
const ownerControls = await sameBrowserTab.locator('.sandbox-rail-controls').count();
log(`opened with owner controls: ${ownerControls > 0}`);

// The address bar must keep the sandbox id, so refresh and copy keep working
log(`link kept in the address bar: ${sameBrowserTab.url().includes(`sandbox=${sandboxId}`)}`, sameBrowserTab.url());
await sameBrowserTab.reload();
await sameBrowserTab.waitForTimeout(4000);
const afterReload = await landedOnCanvas(sameBrowserTab);
log(`refresh reopens the canvas: ${afterReload.canvas}`);

// Leaving the canvas must go to the dashboard, not bounce back into it
await sameBrowserTab.getByTitle('대시보드로').click();
await sameBrowserTab.waitForTimeout(1200);
const afterExit = await landedOnCanvas(sameBrowserTab);
log(`exit lands on the dashboard and stays: ${afterExit.dashboard && !afterExit.canvas}`);
log(`link removed after leaving: ${!sameBrowserTab.url().includes('sandbox=')}`, sameBrowserTab.url());

// Opening a canvas from the dashboard should put it in the address bar too
await sameBrowserTab.getByRole('button', { name: /모둠 협업 캔버스/ }).click();
await sameBrowserTab.waitForTimeout(500);
await sameBrowserTab.locator('.glass-card button.button-premium.active').first().click();
await sameBrowserTab.waitForTimeout(1500);
log(`opening from the dashboard sets the link: ${sameBrowserTab.url().includes('sandbox=')}`, sameBrowserTab.url());

// 2) A signed-out visitor in a clean browser
const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const guest = await guestCtx.newPage();
guest.on('pageerror', (e) => errors.push(`[guest] ${e.message}`));
await guest.goto(link);
await guest.waitForTimeout(6500);
const guestState = await landedOnCanvas(guest);
log(`signed-out visitor opens the canvas: ${guestState.canvas}`, JSON.stringify(guestState));

await sameBrowserTab.screenshot({ path: '/tmp/share-link-routing.png' });
console.log('\npage errors:', errors.length ? errors : 'none');
await browser.close();
