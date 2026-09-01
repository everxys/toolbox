export const isPrimaryToolClick = (button: number) => button === 0;

export const runQuickAction = (closeMenu: () => void, runAction: () => void) => {
  closeMenu();
  runAction();
};

export const DEFAULT_TOOL_ICON_SIZE = 32;
export const MIN_TOOL_ICON_SIZE = 24;
export const MAX_TOOL_ICON_SIZE = 80;

const TOOL_ICON_SIZE_KEY = 'toolbox_tool_icon_size';

const normalizeToolIconSize = (size: number) => {
  if (!Number.isFinite(size)) return DEFAULT_TOOL_ICON_SIZE;
  return Math.min(MAX_TOOL_ICON_SIZE, Math.max(MIN_TOOL_ICON_SIZE, Math.round(size)));
};

export const adjustToolIconSize = (current: number, deltaY: number) => {
  const delta = deltaY < 0 ? 4 : deltaY > 0 ? -4 : 0;
  return normalizeToolIconSize(current + delta);
};

export const shouldAdjustToolIcons = ({ ctrlKey, deltaY }: Pick<WheelEvent, 'ctrlKey' | 'deltaY'>) =>
  ctrlKey && deltaY !== 0;

export const loadToolIconSize = () => {
  const savedSize = Number(localStorage.getItem(TOOL_ICON_SIZE_KEY));
  return Number.isInteger(savedSize) && savedSize >= MIN_TOOL_ICON_SIZE && savedSize <= MAX_TOOL_ICON_SIZE
    ? savedSize
    : DEFAULT_TOOL_ICON_SIZE;
};

export const saveToolIconSize = (size: number) => {
  localStorage.setItem(TOOL_ICON_SIZE_KEY, String(normalizeToolIconSize(size)));
};
