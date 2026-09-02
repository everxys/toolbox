import { useEffect, useRef, useState } from 'react';
import { checkGoogle, type VpnCheckResult } from './api';

const INTERVAL_KEY = 'vpn_monitor_interval_ms';
const ENABLED_KEY = 'vpn_monitor_enabled';
const DEFAULT_INTERVAL = 8000;

function formatTime(ts: string) {
  const n = Number(ts);
  if (!Number.isFinite(n)) return ts;
  const d = new Date(n * 1000);
  return d.toLocaleTimeString();
}

export default function VpnFloatingMonitor({ embedded = false }: { embedded?: boolean }) {
  const [result, setResult] = useState<VpnCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [enabled, setEnabled] = useState(() => localStorage.getItem(ENABLED_KEY) !== '0');
  const [intervalMs, setIntervalMs] = useState(() => {
    const v = Number(localStorage.getItem(INTERVAL_KEY));
    return Number.isFinite(v) && v >= 3000 ? v : DEFAULT_INTERVAL;
  });
  const timerRef = useRef<number | null>(null);

  const runCheck = async () => {
    setChecking(true);
    try {
      const r = await checkGoogle();
      setResult(r);
    } catch (e) {
      setResult({ ok: false, latency_ms: null, status: null, error: String(e), checked_at: String(Date.now() / 1000) });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(INTERVAL_KEY, String(intervalMs));
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
    if (!enabled) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    void runCheck();
    timerRef.current = window.setInterval(() => void runCheck(), intervalMs);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [intervalMs, enabled]);

  const ok = !enabled ? null : result?.ok ?? null;
  const dotColor = !enabled ? '#999' : ok === null ? '#999' : ok ? '#22c55e' : '#ef4444';
  const statusText = !enabled ? '已暂停检测' : ok === null ? '检测中…' : ok ? 'Google 连接正常' : 'Google 连接异常';
  const latency = result?.latency_ms != null ? `${result.latency_ms} ms` : '—';

  const closeWindow = async () => {
    try {
      const { closeMonitorWindow } = await import('./api');
      await closeMonitorWindow();
    } catch { window.close(); }
  };

  return (
    <>
      {!embedded && (
        <style>{`html,body{margin:0;padding:0;overflow:hidden;background:transparent}::-webkit-scrollbar{display:none}*{scrollbar-width:none}`}</style>
      )}
      <div
        data-tauri-drag-region={!embedded || undefined}
        style={{
          width: embedded ? '100%' : '100%',
          height: embedded ? 'auto' : '100%',
          minHeight: embedded ? undefined : '100vh',
          boxSizing: 'border-box',
          display: 'grid',
          placeItems: 'center',
          background: embedded ? 'transparent' : 'transparent',
          padding: embedded ? 0 : 8,
          overflow: 'hidden',
        }}
      >
        <div
          data-tauri-drag-region={!embedded || undefined}
          style={{
            width: '100%',
            maxWidth: 340,
            boxSizing: 'border-box',
            borderRadius: 16,
            padding: '14px 16px',
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
            fontFamily: 'sans-serif',
            userSelect: 'none',
            overflow: 'hidden',
          }}
        >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: dotColor, boxShadow: `0 0 8px ${dotColor}`, display: 'inline-block', flexShrink: 0 }} />
            <strong style={{ fontSize: 13 }}>{statusText}</strong>
            {checking && <span style={{ fontSize: 11, color: '#666' }}>检测中…</span>}
          </div>
          {!embedded && (
            <button
              onClick={() => void closeWindow()}
              style={{ border: 0, background: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
              aria-label="关闭监控栏"
            >✕</button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#444', flexWrap: 'wrap' }}>
          <span>延迟 {latency}</span>
          {result?.status && <span>HTTP {result.status}</span>}
          <span>上次 {result ? formatTime(result.checked_at) : '—'}</span>
        </div>
        {result?.error && !result.ok && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#991b1b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={result.error}>
            {result.error.slice(0, 80)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> 启用检测
          </label>
          <button
            onClick={() => void runCheck()}
            disabled={checking || !enabled}
            style={{ flex: 1, border: '1px solid rgba(0,0,0,0.08)', background: enabled ? '#fff' : '#f5f5f5', borderRadius: 8, padding: '6px 0', fontSize: 12, cursor: enabled ? 'pointer' : 'not-allowed' }}
          >立即检测</button>
          <select
            value={[5000, 8000, 15000, 30000, 60000].includes(intervalMs) ? intervalMs : -1}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v === -1) return;
              setIntervalMs(v);
            }}
            style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '5px 6px', fontSize: 12, background: '#fff' }}
            aria-label="检测间隔"
          >
            <option value={5000}>5s</option>
            <option value={8000}>8s</option>
            <option value={15000}>15s</option>
            <option value={30000}>30s</option>
            <option value={60000}>60s</option>
            {![5000, 8000, 15000, 30000, 60000].includes(intervalMs) && <option value={-1}>{Math.round(intervalMs / 1000)}s 自定义</option>}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#444' }}>
            每
            <input
              type="number"
              min={3}
              max={300}
              value={Math.round(intervalMs / 1000)}
              onChange={(e) => {
                const sec = Math.min(300, Math.max(3, Number(e.target.value) || 8));
                setIntervalMs(sec * 1000);
              }}
              style={{ width: 48, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, padding: '4px 6px', fontSize: 12, background: '#fff' }}
            />
            秒
          </label>
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: '#888', textAlign: 'center' }} data-tauri-drag-region>
          拖动此卡片任意空白可移动窗口 · 右键托盘图标退出
        </div>
      </div>
      </div>
    </>
  );
}
