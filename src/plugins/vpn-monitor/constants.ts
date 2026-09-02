// 存储键与默认值集中管理
export const STORAGE_KEYS = {
  enabled: 'vpn_monitor_enabled',
  intervalMs: 'vpn_monitor_interval_ms',
} as const;

export const DEFAULT_INTERVAL_MS = 8000;
export const MIN_INTERVAL_MS = 3000;
export const MAX_INTERVAL_MS = 300_000;

export const PRESET_INTERVALS_MS = [5000, 8000, 15000, 30000, 60000] as const;

export function clampInterval(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_INTERVAL_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, ms));
}

export function parseEnabled(raw: string | null): boolean {
  return raw !== '0';
}

export function parseInterval(raw: string | null): number {
  const v = Number(raw);
  return clampInterval(v) && v >= MIN_INTERVAL_MS ? v : DEFAULT_INTERVAL_MS;
}
