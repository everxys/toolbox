import { useCallback, useEffect, useRef, useState } from 'react';
import { checkGoogle, type VpnCheckResult } from './api';
import {
  DEFAULT_INTERVAL_MS,
  STORAGE_KEYS,
  clampInterval,
  parseEnabled,
  parseInterval,
} from './constants';

export interface UseVpnMonitorReturn {
  result: VpnCheckResult | null;
  checking: boolean;
  enabled: boolean;
  setEnabled: (v: boolean | ((prev: boolean) => boolean)) => void;
  intervalMs: number;
  setIntervalMs: (ms: number) => void;
  runCheck: () => Promise<void>;
}

export function useVpnMonitor(): UseVpnMonitorReturn {
  const [result, setResult] = useState<VpnCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [enabled, setEnabled] = useState(() => parseEnabled(localStorage.getItem(STORAGE_KEYS.enabled)));
  const [intervalMs, setIntervalMsRaw] = useState(() => parseInterval(localStorage.getItem(STORAGE_KEYS.intervalMs)));

  const timerRef = useRef<number | null>(null);

  const setIntervalMs = useCallback((ms: number) => {
    setIntervalMsRaw(clampInterval(ms));
  }, []);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const r = await checkGoogle();
      setResult(r);
    } catch (e) {
      setResult({
        ok: false,
        latency_ms: null,
        status: null,
        error: String(e),
        checked_at: String(Date.now() / 1000),
      });
    } finally {
      setChecking(false);
    }
  }, []);

  // 持久化
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.enabled, enabled ? '1' : '0');
  }, [enabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.intervalMs, String(intervalMs));
  }, [intervalMs]);

  // 轮询：enabled/intervalMs 变化时重建定时器
  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!enabled) return;
    void runCheck();
    timerRef.current = window.setInterval(() => void runCheck(), intervalMs || DEFAULT_INTERVAL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [enabled, intervalMs, runCheck]);

  return { result, checking, enabled, setEnabled, intervalMs, setIntervalMs, runCheck };
}
