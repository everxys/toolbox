export const isPrimaryToolClick = (button: number) => button === 0;

export const runQuickAction = (closeMenu: () => void, runAction: () => void) => {
  closeMenu();
  runAction();
};
