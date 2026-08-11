// Walks a rendered page and reports text that fails WCAG AA contrast against
// its effective background. Catches theme-coloured text placed on a fixed
// background (or the reverse), which is easy to introduce and hard to spot.
//
//   npm run dev
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/contrast-audit.mjs
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

const AUDIT = () => {
  const parse = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  // Effective background: composite ancestors until fully opaque
  const bgOf = (el) => {
    let acc = null;
    let node = el;
    while (node && node !== document.documentElement.parentNode) {
      const cs = getComputedStyle(node);
      const bg = parse(cs.backgroundColor);
      const hasImage = cs.backgroundImage && cs.backgroundImage !== 'none';
      if (bg && bg.a > 0) {
        acc = acc ? over(acc, bg) : bg;
        if (acc.a >= 0.999) return { color: acc, hasImage };
      }
      node = node.parentElement;
    }
    return { color: acc || { r: 255, g: 255, b: 255, a: 1 }, hasImage: false };
  };

  const results = [];
  document.querySelectorAll('*').forEach((el) => {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!text) return;

    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') return; // gradient text

    const fg = parse(cs.color);
    if (!fg) return;
    const { color: bg } = bgOf(el);
    const composited = fg.a < 1 ? over(fg, bg) : fg;
    const r = ratio(composited, bg);

    const size = parseFloat(cs.fontSize);
    const bold = +cs.fontWeight >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const threshold = large ? 3 : 4.5;

    if (r < threshold) {
      results.push({
        text: text.slice(0, 28),
        ratio: +r.toFixed(2),
        need: threshold,
        color: cs.color,
        bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
      });
    }
  });
  return results;
};

const browser = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
await page.goto(BASE);
await page.evaluate((s) => sessionStorage.setItem('padlet-board-storage-session', s), SESSION);
await page.reload();
await page.waitForTimeout(1200);

// Seed one board per layout so every badge variant is on screen
const layouts = [
  ['canvas', '자유 캔버스 보드'],
  ['grid', '격자 보드'],
  ['wall', '벽돌 보드'],
  ['column', '컬럼 보드'],
];
for (const [layout, title] of layouts) {
  await page.getByText('새 보드 만들기').click();
  await page.getByPlaceholder('예: 아이디어 기획 보드').fill(title);
  await page.getByRole('button', { name: new RegExp(`^${layout === 'canvas' ? 'Canvas' : layout === 'grid' ? 'Grid' : layout === 'wall' ? 'Wall' : 'Column'}`, 'i') }).click();
  await page.getByRole('button', { name: '생성 완료' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /대시보드/ }).click();
  await page.waitForTimeout(600);
}

const report = async (label) => {
  const issues = await page.evaluate(AUDIT);
  console.log(`\n=== ${label} : ${issues.length} low-contrast text node(s) ===`);
  const seen = new Set();
  issues.forEach((i) => {
    const key = `${i.text}|${i.color}|${i.bg}`;
    if (seen.has(key)) return;
    seen.add(key);
    console.log(`  "${i.text}"  ${i.ratio} (needs ${i.need})  text=${i.color} on ${i.bg}`);
  });
};

await report('dashboard · 보드 tab');
await page.screenshot({ path: '/tmp/audit-dashboard.png' });

await page.getByRole('button', { name: /모둠 협업 캔버스/ }).click();
await page.waitForTimeout(600);
await report('dashboard · 캔버스 tab');
await page.screenshot({ path: '/tmp/audit-canvas-tab.png' });

// --- Collaborative canvas: every 모둠 tab colour must carry readable labels ---
await page.getByRole('button', { name: /새 캔버스/ }).click();
await page.getByPlaceholder('예: 4학년 과학 브레인스토밍').fill('명암 점검 캔버스');
const slider = page.locator('input[type="range"]');
await slider.fill('8'); // exercise every group colour at once
await page.getByRole('button', { name: /캔버스 만들고 열기/ }).click();
await page.waitForTimeout(1200);

const tabs = page.locator('.sandbox-group-tabs button[title$="캔버스 열기"]');
const tabCount = await tabs.count();
console.log(`\n(모둠 tabs found: ${tabCount})`);
for (const groupIndex of [0, 2, 3, 5]) {
  if (groupIndex >= tabCount) continue;
  await tabs.nth(groupIndex).click();
  await page.waitForTimeout(400);
  await report(`sandbox · group tab #${groupIndex + 1} active`);
}
await page.screenshot({ path: '/tmp/audit-sandbox.png' });

// --- Board workspace on a dark wallpaper ---
await page.reload(); // lands back on the dashboard, 보드 tab by default
await page.waitForTimeout(1200);
await page.getByText('컬럼 보드').click();
await page.waitForTimeout(1200);
await report('board workspace · column layout');
await page.screenshot({ path: '/tmp/audit-board.png' });

await browser.close();
