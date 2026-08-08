import type { Reactions } from '../store/useBoardStore';

export const CARD_COLOR_PRESETS = [
  { name: '화이트', value: 'var(--card-paper)' },
  { name: '스카이', value: 'var(--card-sky)' },
  { name: '민트', value: 'var(--card-mint)' },
  { name: '피치', value: 'var(--card-peach)' },
  { name: '로즈', value: 'var(--card-rose)' },
  { name: '앰버', value: 'var(--card-amber)' },
  { name: '에메랄드', value: 'var(--card-emerald)' },
  { name: '소프트 블루', value: 'var(--card-indigo)' },
] as const;

export const pickRandomCardColor = (): string => {
  // Prefer soft paper tones that sit well on colorful wallpapers
  const pool = [
    'var(--card-paper)',
    'var(--card-sky)',
    'var(--card-mint)',
    'var(--card-peach)',
    'var(--card-rose)',
    'var(--card-amber)',
    'var(--card-emerald)',
  ];
  return pool[Math.floor(Math.random() * pool.length)];
};

const MY_REACTIONS_KEY = 'padlet-my-reactions-v1';

type MyReactionMap = Record<string, Partial<Record<keyof Reactions, boolean>>>;

export const loadMyReactions = (): MyReactionMap => {
  try {
    const raw = localStorage.getItem(MY_REACTIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const saveMyReactions = (map: MyReactionMap): void => {
  try {
    localStorage.setItem(MY_REACTIONS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to persist reaction state', e);
  }
};

export const hasMyReaction = (postId: string, type: keyof Reactions): boolean => {
  return Boolean(loadMyReactions()[postId]?.[type]);
};

export const setMyReaction = (postId: string, type: keyof Reactions, active: boolean): void => {
  const map = loadMyReactions();
  const current = { ...(map[postId] || {}) };
  if (active) {
    current[type] = true;
  } else {
    delete current[type];
  }
  if (Object.keys(current).length === 0) {
    delete map[postId];
  } else {
    map[postId] = current;
  }
  saveMyReactions(map);
};
