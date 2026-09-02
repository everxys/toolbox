import { openMonitorWindow, quitApp } from './api';
import { useVpnMonitor } from './useVpnMonitor';
import VpnFloatingMonitor from './VpnFloatingMonitor';

export default function VpnMonitorTool() {
  const { result, checking, enabled, runCheck } = useVpnMonitor();

  return (
    <div style={{ padding: 16 }}>
      <h2>VPN 连接监控（Clash Verge Rev）</h2>
      <p style={{ color: '#666', fontSize: 13 }}>
        定时 <code>curl https://www.google.com/generate_204</code> 探测，判断 Clash 代理是否有效。托盘图标右键可退出或打开悬浮监控栏。
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => void runCheck()} disabled={checking}>
          {checking ? '检测中…' : '立即检测 Google'}
        </button>
        <button onClick={() => void openMonitorWindow()}>打开悬浮监控栏</button>
        <span style={{ fontSize: 12, color: enabled ? '#16a34a' : '#888' }}>{enabled ? '● 自动检测已启用' : '○ 已暂停'}</span>
        <button
          onClick={() => void quitApp()}
          style={{ marginLeft: 'auto', background: '#fee', border: '1px solid #fcc', borderRadius: 6, padding: '6px 10px' }}
        >
          退出 Toolbox
        </button>
      </div>

      {result && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}`,
            background: result.ok ? '#f0fdf4' : '#fef2f2',
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: result.ok ? '#22c55e' : '#ef4444',
                display: 'inline-block',
              }}
            />
            <strong>{result.ok ? 'Google 可达 — VPN 正常' : 'Google 不可达 — VPN 可能断开'}</strong>
            <span style={{ marginLeft: 'auto', color: '#666' }}>
              {result.latency_ms != null ? `${result.latency_ms} ms` : ''} {result.status ? `HTTP ${result.status}` : ''}
            </span>
          </div>
          {result.error && !result.ok && (
            <div style={{ color: '#991b1b', fontSize: 12, marginTop: 6, wordBreak: 'break-all' }}>{result.error}</div>
          )}
          <div style={{ color: '#666', fontSize: 11, marginTop: 6 }}>checked_at: {result.checked_at}</div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14 }}>悬浮监控栏预览（磨砂半透明置顶）</h3>
        <div
          style={{
            border: '1px dashed #ddd',
            borderRadius: 12,
            padding: 12,
            background: 'linear-gradient(135deg,#eef 0%,#fef 100%)',
          }}
        >
          <VpnFloatingMonitor embedded />
        </div>
        <p style={{ fontSize: 11, color: '#888' }}>
          提示：点击“打开悬浮监控栏”会弹出独立透明置顶窗口（可拖动、始终置顶），托盘右键含“打开监控栏 / 退出 Toolbox”。
        </p>
      </div>
    </div>
  );
}
