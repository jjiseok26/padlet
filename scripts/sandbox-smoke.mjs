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
    activeBoardId: 'dashboard',
    panX: 0,
    panY: 0,
    scale: 1,
    driveSyncStatus: 'idle',
    lastDriveSyncTime: null,
    driveSyncError: null,
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
  await teacher.evaluate((s) => sessionStorage.setItem('padlet-board-storage-session', s), SESSION);
  await teacher.reload();
  await teacher.waitForTimeout(1200);

  // --- Create a canvas ---
  await teacher.getByRole('button', { name: /새 캔버스/ }).click();
  await teacher.getByPlaceholder('예: 4학년 과학 브레인스토밍').fill('스모크 캔버스');
  await teacher.getByRole('button', { name: /캔버스 만들고 열기/ }).click();
  await teacher.waitForTimeout(800);
  log('canvas created');

  // --- Join as teacher ---
  await teacher.getByPlaceholder('예: 김하늘').fill('선생님');
  await teacher.getByRole('button', { name: /캔버스 참여하기/ }).click();
  await teacher.waitForTimeout(600);
  log('teacher joined');

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

  await teacher.screenshot({ path: '/tmp/sandbox-teacher.png' });

  // --- Guest joins via share link (separate context = separate storage) ---
  const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const guest = await guestCtx.newPage();
  guest.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[guest] ${m.text()}`);
  });
  guest.on('pageerror', (e) => errors.push(`[guest pageerror] ${e.message}`));

  await guest.goto(`${BASE}?sandbox=${sandboxId}`);
  await guest.waitForTimeout(6000);

  const guestSeesCanvas = await guest.getByPlaceholder('예: 김하늘').isVisible().catch(() => false);
  const guestSeesMissing = await guest
    .getByText('캔버스를 찾을 수 없습니다')
    .isVisible()
    .catch(() => false);
  log(`guest received canvas: ${guestSeesCanvas} | "not found" shown: ${guestSeesMissing}`);

  if (guestSeesCanvas) {
    await guest.getByPlaceholder('예: 김하늘').fill('학생1');
    await guest.getByRole('button', { name: /캔버스 참여하기/ }).click();
    await guest.waitForTimeout(1000);

    const gstate = await readSandboxState(guest);
    log('guest element count (synced from teacher):', gstate.elements.length);

    // Guest adds a note; teacher should receive it
    const gbox = await guest.locator('[data-canvas-bg="true"]').boundingBox();
    await guest.getByTitle('메모지').click();
    await guest.mouse.click(gbox.x + gbox.width / 2 + 120, gbox.y + gbox.height / 2 - 40);
    await guest.waitForTimeout(400);
    await guest.keyboard.type('학생 메모');
    await guest.mouse.click(gbox.x + 60, gbox.y + gbox.height - 60);
    await guest.waitForTimeout(2000);

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

  console.log('\nconsole errors:', errors.length ? errors : 'none');
  await browser.close();
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err);
  process.exit(1);
});
