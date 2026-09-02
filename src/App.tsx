import { useState } from 'react';
import QRLogin from './plugins/ncm/QRLogin';
import PlaylistDownloader from './plugins/ncm/PlaylistDownloader';
import NcmQuickDownloadDialog from './plugins/ncm/NcmQuickDownloadDialog';
import { NcmAuthProvider, useNcmAuth } from './plugins/ncm/NcmAuthContext';
import HomePage from './toolbox/HomePage';
import ToolPageShell from './toolbox/ToolPageShell';
import { loadLastNcmPlaylistUrl, saveLastNcmPlaylistUrl, type ToolId } from './toolbox/tools';
import VpnMonitorTool from './plugins/vpn-monitor/VpnMonitorTool';
import { openMonitorWindow } from './plugins/vpn-monitor/api';
import UpdaterButton from './toolbox/UpdaterButton';

function AuthHeader({ onShowLogin }: { onShowLogin: () => void }) {
  const { nickname, logged, logout } = useNcmAuth();
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <h1>Toolbox 合集 - 跨平台 (Tauri)</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <UpdaterButton />
        {logged ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <span title="网易云音乐登录账号">👤 {nickname}</span>
            <button onClick={() => void logout()}>退出登录</button>
          </div>
        ) : (
          <button onClick={onShowLogin}>登录</button>
        )}
      </div>
    </header>
  );
}

function AppShell() {
  const [view, setView] = useState<'home' | 'ncm' | 'vpn-monitor'>('home');
  const [showLogin, setShowLogin] = useState(false);
  const [showQuickDownload, setShowQuickDownload] = useState(false);
  const [quickDownloadInitialUrl, setQuickDownloadInitialUrl] = useState('');
  const { login } = useNcmAuth();

  const handleLogin = async (cookie: string) => {
    await login(cookie);
    setShowLogin(false);
  };
  const handleQuickAction = (toolId: ToolId, actionId: 'download-undownloaded' | 'vpn-open-monitor') => {
    if (toolId === 'ncm' && actionId === 'download-undownloaded') {
      setQuickDownloadInitialUrl(loadLastNcmPlaylistUrl());
      setShowQuickDownload(true);
      return;
    }
    if (toolId === 'vpn-monitor' && actionId === 'vpn-open-monitor') {
      void openMonitorWindow();
      setView('vpn-monitor');
    }
  };
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <AuthHeader onShowLogin={() => setShowLogin(true)} />
      {showLogin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="网易云音乐登录"
          style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'grid', placeItems: 'center', background: 'rgba(0, 0, 0, 0.35)', padding: 16 }}
          onClick={() => setShowLogin(false)}
        >
          <div style={{ width: 'min(420px, 100%)', background: '#fff', borderRadius: 12, padding: 16 }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button aria-label="关闭登录弹窗" onClick={() => setShowLogin(false)}>关闭</button>
            </div>
            <QRLogin onLogin={handleLogin} />
          </div>
        </div>
      )}
      {view === 'home' ? (
        <HomePage onOpenTool={(id) => setView(id as any)} onQuickAction={handleQuickAction} />
      ) : view === 'ncm' ? (
        <ToolPageShell onBackHome={() => setView('home')}>
          <nav style={{ display: 'flex', gap: 12, borderBottom: '1px solid #ddd', padding: '8px 16px' }}>
            <span style={{ background: '#eee', padding: '4px 8px', borderRadius: 6 }}>🎵 网易云歌单</span>
            <span style={{ opacity: 0.5 }}>🧰 更多工具 …</span>
          </nav>
          <PlaylistDownloader />
        </ToolPageShell>
      ) : (
        <ToolPageShell onBackHome={() => setView('home')}>
          <nav style={{ display: 'flex', gap: 12, borderBottom: '1px solid #ddd', padding: '8px 16px' }}>
            <span style={{ background: '#eee', padding: '4px 8px', borderRadius: 6 }}>🛡️ VPN 监控</span>
            <span style={{ opacity: 0.5 }}>🧰 更多工具 …</span>
          </nav>
          <VpnMonitorTool />
        </ToolPageShell>
      )}
      <NcmQuickDownloadDialog
        open={showQuickDownload}
        initialUrl={quickDownloadInitialUrl}
        onClose={() => setShowQuickDownload(false)}
        onUrlSaved={saveLastNcmPlaylistUrl}
      />
    </div>
  );
}

export default function App() {
  return (
    <NcmAuthProvider>
      <AppShell />
    </NcmAuthProvider>
  );
}
