export const isPrimaryToolClick = (button: number) => button === 0;

export const runQuickAction = (closeMenu: () => void, runAction: () => void) => {
  closeMenu();
  runAction();
};

export const DEFAULT_TOOL_ICON_SIZE = 32;
export const MIN_TOOL_ICON_SIZE = 24;
export const MAX_TOOL_ICON_SIZE = 80;
export const DEFAULT_TOOL_CARD_SIZE = 180;
export const MIN_TOOL_CARD_SIZE = 120;
export const MAX_TOOL_CARD_SIZE = 280;

const TOOL_ICON_SIZE_KEY = 'toolbox_tool_icon_size';
const TOOL_CARD_SIZE_KEY = 'toolbox_tool_card_size';

const normalizeSize = (size: number, def: number, min: number, max: number) => {
  if (!Number.isFinite(size)) return def;
  return Math.min(max, Math.max(min, Math.round(size)));
};
const loadSize = (key: string, def: number, min: number, max: number) => {
  const saved = Number(localStorage.getItem(key));
  return Number.isInteger(saved) && saved >= min && saved <= max ? saved : def;
};
const saveSize = (key: string, size: number, def: number, min: number, max: number) => {
  localStorage.setItem(key, String(normalizeSize(size, def, min, max)));
};

const normalizeToolIconSize = (size: number) => normalizeSize(size, DEFAULT_TOOL_ICON_SIZE, MIN_TOOL_ICON_SIZE, MAX_TOOL_ICON_SIZE);
const normalizeToolCardSize = (size: number) => normalizeSize(size, DEFAULT_TOOL_CARD_SIZE, MIN_TOOL_CARD_SIZE, MAX_TOOL_CARD_SIZE);

export const adjustToolIconSize = (current: number, deltaY: number) => {
  const delta = deltaY < 0 ? 4 : deltaY > 0 ? -4 : 0;
  return normalizeToolIconSize(current + delta);
};

export const adjustToolCardSize = (current: number, deltaY: number) => {
  const delta = deltaY < 0 ? 16 : deltaY > 0 ? -16 : 0;
  return normalizeToolCardSize(current + delta);
};

export const shouldAdjustToolIcons = ({ ctrlKey, deltaY }: Pick<WheelEvent, 'ctrlKey' | 'deltaY'>) =>
  ctrlKey && deltaY !== 0;

export const loadToolIconSize = () => loadSize(TOOL_ICON_SIZE_KEY, DEFAULT_TOOL_ICON_SIZE, MIN_TOOL_ICON_SIZE, MAX_TOOL_ICON_SIZE);
export const saveToolIconSize = (size: number) => saveSize(TOOL_ICON_SIZE_KEY, size, DEFAULT_TOOL_ICON_SIZE, MIN_TOOL_ICON_SIZE, MAX_TOOL_ICON_SIZE);

export const loadToolCardSize = () => loadSize(TOOL_CARD_SIZE_KEY, DEFAULT_TOOL_CARD_SIZE, MIN_TOOL_CARD_SIZE, MAX_TOOL_CARD_SIZE);
export const saveToolCardSize = (size: number) => saveSize(TOOL_CARD_SIZE_KEY, size, DEFAULT_TOOL_CARD_SIZE, MIN_TOOL_CARD_SIZE, MAX_TOOL_CARD_SIZE);
