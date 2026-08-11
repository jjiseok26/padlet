// Visual check: a card on a dark-wallpaper board must still have readable text.
// Usage: npm run dev, then node scripts/board-contrast-check.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const SESSION = JSON.stringify({
  state: {
    isAuthenticated: true,
    currentUser: { username: '선생님', role: '교사' },
  },
  version: 0,
});

const luminance = ([r, g, b]) => {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const parseRgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number);

const browser = await chromium.launch({ executablePath: '/usr/local/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE);
await page.evaluate((s) => localStorage.setItem('padlet-auth-local', s), SESSION);
await page.reload();
await page.waitForTimeout(1200);

// Create a board on the darkest wallpaper, the worst case for card contrast
await page.getByText('새 보드 만들기').click();
await page.getByPlaceholder('예: 아이디어 기획 보드').fill('명암 확인 보드');
await page.getByTitle('인크 Black').click();
await page.getByRole('button', { name: '생성 완료' }).click();
await page.waitForTimeout(1200);

// Add a card and write in it
await page.getByRole('button', { name: /카드 추가/ }).first().click();
await page.waitForTimeout(600);
const ta = page.locator('textarea').first();
if (await ta.isVisible().catch(() => false)) {
  await ta.fill('어두운 배경에서도 잘 보이는 글자');
}
await page.getByRole('button', { name: '저장' }).click();
await page.waitForTimeout(900);

const measured = await page.evaluate(() => {
  const card = document.querySelector('.glass-card');
  if (!card) return null;
  const cs = getComputedStyle(card);
  const textNode =
    card.querySelector('div[style*="cardContent"], p, h3') || card;
  return {
    cardBg: cs.backgroundColor,
    textColor: getComputedStyle(textNode).color,
  };
});

if (measured) {
  const ratio = contrast(parseRgb(measured.cardBg), parseRgb(measured.textColor));
  console.log('card bg  :', measured.cardBg);
  console.log('text     :', measured.textColor);
  console.log('contrast :', ratio.toFixed(2), ratio >= 4.5 ? '(passes WCAG AA)' : '(TOO LOW)');
} else {
  console.log('no card found to measure');
}

// Highlighted header buttons must keep a readable label on dark boards
const activeBtn = await page.evaluate(() => {
  const btn = document.querySelector('.button-premium.active');
  if (!btn) return null;
  const cs = getComputedStyle(btn);
  return { bg: cs.backgroundColor, color: cs.color, label: btn.textContent?.trim() };
});
if (activeBtn) {
  const ratio = contrast(parseRgb(activeBtn.bg), parseRgb(activeBtn.color));
  console.log('active button:', activeBtn.label, activeBtn.bg, activeBtn.color);
  console.log('button contrast :', ratio.toFixed(2), ratio >= 4.5 ? '(passes WCAG AA)' : '(TOO LOW)');
}

await page.screenshot({ path: '/tmp/board-contrast.png' });
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
