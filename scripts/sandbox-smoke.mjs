// Manual smoke test for the collaborative sandbox canvas.
// Covers the parts that are painful to verify by hand: element creation,
// the peer catch-up handshake, and two-way realtime sync between a teacher
// and a guest who joined through a share link.
//
//   npm run dev
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/sandbox-smoke.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';

const SESSION = JSON.stringify({
  state: {
    isAuthenticated: true,
    currentUser: { username: '선생님', role: '교사' },
  },
  version: 0,
});

const log = (...args) => console.log('•', ...args);

const readSandboxState = (page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('padlet-sandbox-storage-local');
    return raw ? JSON.parse(raw) : { sandboxes: [], elements: [] };
  });

async function main() {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome' });

  const teacherCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const teacher = await teacherCtx.newPage();
  const errors = [];
  teacher.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[teacher] ${m.text()}`);
  });
  teacher.on('pageerror', (e) => errors.push(`[teacher pageerror] ${e.message}`));

  await teacher.goto(BASE);
  await teacher.evaluate((s) => localStorage.setItem('padlet-auth-local', s), SESSION);
  await teacher.reload();
  await teacher.waitForTimeout(1200);

  // --- Dashboard tabs ---
  const boardsVisibleFirst = await teacher.getByPlaceholder('보드 검색...').isVisible();
  await teacher.getByRole('button', { name: /모둠 협업 캔버스/ }).click();
  await teacher.waitForTimeout(400);
  const boardsHiddenOnCanvasTab = !(await teacher.getByPlaceholder('보드 검색...').isVisible());
  log(`dashboard tabs: boards default=${boardsVisibleFirst}, boards hidden on canvas tab=${boardsHiddenOnCanvasTab}`);

  // --- Create a canvas ---
  await teacher.getByRole('button', { name: /새 캔버스/ }).click();
  await teacher.getByPlaceholder('예: 4학년 과학 브레인스토밍').fill('스모크 캔버스');
  await teacher.getByRole('button', { name: /캔버스 만들고 열기/ }).click();
  await teacher.waitForTimeout(1000);
  log('canvas created');

  // No name gate: the canvas must be writable as soon as it opens
  const gated = await teacher
    .getByRole('button', { name: /캔버스 참여하기/ })
    .isVisible()
    .catch(() => false);
  log(`join gate shown (should be false): ${gated}`);

  const state0 = await readSandboxState(teacher);
  const sandboxId = state0.sandboxes[0]?.id;
  if (!sandboxId) throw new Error('sandbox was not persisted');
  log('sandbox id:', sandboxId, '| groups:', state0.sandboxes[0].groups.length);

  const box = await teacher.locator('[data-canvas-bg="true"]').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // --- Sticky note ---
  await teacher.getByTitle('메모지').click();
  await teacher.mouse.click(cx - 200, cy);
  await teacher.waitForTimeout(400);
  const focusInfo = await teacher.evaluate(() => {
    const world = document.querySelector('[data-canvas-bg="true"]')?.firstElementChild;
    return {
      active: document.activeElement?.tagName,
      textareas: document.querySelectorAll('textarea').length,
      worldChildren: world ? world.children.length : -1,
      worldHtml: world ? world.innerHTML.slice(0, 400) : 'no world',
    };
  });
  log('after note click ->', JSON.stringify(focusInfo));
  await teacher.keyboard.type('아이디어 1');
  await teacher.waitForTimeout(200);
  const typed = await teacher.evaluate(() => {
    const ta = document.querySelector('textarea');
    return ta ? ta.value : null;
  });
  log('textarea value after typing:', JSON.stringify(typed));
  await teacher.mouse.click(cx + 380, cy + 250); // blur to commit
  await teacher.waitForTimeout(600);

  let state = await readSandboxState(teacher);
  const notes = state.elements.filter((e) => e.type === 'note');
  log(`note created: ${notes.length > 0}`, notes[0] ? `text="${notes[0].text}"` : '');

  // --- Pen stroke ---
  await teacher.getByTitle('펜').click();
  await teacher.mouse.move(cx + 60, cy - 60);
  await teacher.mouse.down();
  for (let i = 0; i < 14; i++) {
    await teacher.mouse.move(cx + 60 + i * 9, cy - 60 + Math.sin(i / 2) * 26);
    await teacher.waitForTimeout(16);
  }
  await teacher.mouse.up();
  await teacher.waitForTimeout(600);

  state = await readSandboxState(teacher);
  const draws = state.elements.filter((e) => e.type === 'draw');
  log(`pen stroke created: ${draws.length > 0}`, draws[0] ? `points=${draws[0].points.length / 2}` : '');

  // --- Rectangle ---
  await teacher.getByTitle('사각형').click();
  await teacher.mouse.move(cx - 120, cy + 120);
  await teacher.mouse.down();
  await teacher.mouse.move(cx + 20, cy + 220, { steps: 8 });
  await teacher.mouse.up();
  await teacher.waitForTimeout(500);

  state = await readSandboxState(teacher);
  log(`rect created: ${state.elements.some((e) => e.type === 'rect')}`);
  log('total elements:', state.elements.length);

  const groups = state.sandboxes[0].groups;
  const firstGroupId = groups[0].id;
  const allInFirstGroup = state.elements.every((e) => e.groupId === firstGroupId);
  log(`all work assigned to the open 모둠 tab: ${allInFirstGroup}`);

  await teacher.screenshot({ path: '/tmp/sandbox-teacher.png' });

  // --- Group tabs isolate each 모둠's canvas ---
  const visibleNotesOn = async () =>
    teacher.evaluate(() => document.body.innerText.includes('아이디어 1'));

  const onGroup1 = await visibleNotesOn();
  await teacher.getByTitle(`${groups[1].name} 캔버스 열기`).click();
  await teacher.waitForTimeout(500);
  const onGroup2 = await visibleNotesOn();
  log(`group tab isolation: visible on 1모둠=${onGroup1}, visible on 2모둠=${onGroup2}`);

  // Work added on another tab stays on that tab
  const box2 = await teacher.locator('[data-canvas-bg="true"]').boundingBox();
  await teacher.getByTitle('메모지').click();
  await teacher.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await teacher.waitForTimeout(350);
  await teacher.keyboard.type('2모둠 메모');
  await teacher.mouse.click(box2.x + 40, box2.y + box2.height - 40);
  await teacher.waitForTimeout(600);

  state = await readSandboxState(teacher);
  const g2 = state.elements.filter((e) => e.groupId === groups[1].id);
  log(`2모둠 element count: ${g2.length} (text="${g2[0]?.text ?? ''}")`);

  // --- PDF export ---
  const downloadPromise = teacher.waitForEvent('download', { timeout: 30000 });
  await teacher.getByTitle('현재 모둠 캔버스를 PDF로 저장').click();
  const download = await downloadPromise;
  const pdfPath = '/tmp/sandbox-group.pdf';
  await download.saveAs(pdfPath);
  const { statSync } = await import('node:fs');
  log(`PDF exported: ${download.suggestedFilename()} (${statSync(pdfPath).size} bytes)`);

  // Back to the first group for the collaboration checks
  await teacher.getByTitle(`${groups[0].name} 캔버스 열기`).click();
  await teacher.waitForTimeout(400);

  // --- Guest joins via share link (separate context = separate storage) ---
  const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const guest = await guestCtx.newPage();
  guest.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[guest] ${m.text()}`);
  });
  guest.on('pageerror', (e) => errors.push(`[guest pageerror] ${e.message}`));

  await guest.goto(`${BASE}?sandbox=${sandboxId}`);
  await guest.waitForTimeout(6000);

  const guestSeesMissing = await guest
    .getByText('캔버스를 찾을 수 없습니다')
    .isVisible()
    .catch(() => false);
  const guestSeesCanvas = !guestSeesMissing && (await guest.getByTitle('메모지').isVisible());
  log(`guest received canvas: ${guestSeesCanvas} | "not found" shown: ${guestSeesMissing}`);

  if (guestSeesCanvas) {
    const gstate = await readSandboxState(guest);
    log('guest element count (synced from teacher):', gstate.elements.length);

    // Guest adds a note; teacher should receive it
    const gbox = await guest.locator('[data-canvas-bg="true"]').boundingBox();
    // Place it on empty space near the top of the page, clear of the teacher's work
    await guest.getByTitle('메모지').click();
    await guest.mouse.click(gbox.x + gbox.width / 2 + 260, gbox.y + 120);
    await guest.waitForTimeout(400);
    await guest.keyboard.type('학생 메모');
    await guest.mouse.click(gbox.x + 60, gbox.y + gbox.height - 60);
    await guest.waitForTimeout(2500);

    const guestState = await readSandboxState(guest);
    const guestOwnNote = guestState.elements.find((e) => e.text === '학생 메모');
    log(
      `guest created its own note: ${Boolean(guestOwnNote)} | guest total=${guestState.elements.length}`
    );

    const teacherState = await readSandboxState(teacher);
    const gotStudentNote = teacherState.elements.some((e) => e.text === '학생 메모');
    log(`teacher received guest note: ${gotStudentNote}`);

    // The guest's note must render as text on the teacher's screen, not as an empty editor
    const renderedOnTeacher = await teacher.evaluate(() =>
      document.body.innerText.includes('학생 메모')
    );
    const strayEditors = await teacher.evaluate(() => document.querySelectorAll('textarea').length);
    log(`guest note rendered on teacher: ${renderedOnTeacher} | stray editors: ${strayEditors}`);

    await guest.screenshot({ path: '/tmp/sandbox-guest.png' });
    await teacher.screenshot({ path: '/tmp/sandbox-teacher-after.png' });
  }

  // --- Mobile: the tool palette must stay on screen ---
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 664 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const mobile = await mobileCtx.newPage();
  mobile.on('pageerror', (e) => errors.push(`[mobile pageerror] ${e.message}`));
  await mobile.goto(`${BASE}?sandbox=${sandboxId}`);
  await mobile.waitForTimeout(6000);

  const toolbarFits = await mobile.evaluate(() => {
    const bar = document.querySelector('.sandbox-toolbar');
    if (!bar) return { found: false };
    const r = bar.getBoundingClientRect();
    return {
      found: true,
      withinViewport: r.bottom <= window.innerHeight + 1 && r.top >= 0 && r.right <= window.innerWidth + 1,
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), right: Math.round(r.right) },
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });
  log('mobile toolbar:', JSON.stringify(toolbarFits));

  const penVisible = await mobile.getByTitle('펜').isVisible().catch(() => false);
  log(`mobile pen tool reachable: ${penVisible}`);
  await mobile.screenshot({ path: '/tmp/sandbox-mobile.png' });

  console.log('\nconsole errors:', errors.length ? errors : 'none');
  await browser.close();
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err);
  process.exit(1);
});
