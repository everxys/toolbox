export type VpnCheckResult = {
  ok: boolean;
  latency_ms?: number | null;
  status?: number | null;
  error?: string | null;
  checked_at: string;
};

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

export const checkGoogle = () => invoke<VpnCheckResult>('vpn_check_google');
export const openMonitorWindow = () => invoke<void>('vpn_open_monitor_window');
export const closeMonitorWindow = () => invoke<void>('vpn_close_monitor_window');
export const quitApp = () => invoke<void>('vpn_quit_app');
