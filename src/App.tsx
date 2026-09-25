import { useState } from 'react';
import NcmLoginDialog from './plugins/ncm/NcmLoginDialog';
import NcmTool from './plugins/ncm/NcmTool';
import NcmQuickDownloadDialog from './plugins/ncm/NcmQuickDownloadDialog';
import { NcmAuthProvider, useNcmAuth } from './plugins/ncm/NcmAuthContext';
import HomePage from './toolbox/HomePage';
import ToolPageShell from './toolbox/ToolPageShell';
import { type ToolId } from './toolbox/tools';
import { loadLastNcmPlaylistUrl, saveLastNcmPlaylistUrl } from './plugins/ncm/preferences';
import LibraryTool from './plugins/library/LibraryTool';
import SkillManagerTool from './plugins/skills/SkillManagerTool';
import SettingsPage from './toolbox/SettingsPage';

function AppShell() {
  type AppView = 'home' | 'settings' | ToolId;
  const [view, setView] = useState<AppView>('home');
  const [showLogin, setShowLogin] = useState(false);
  const [showQuickDownload, setShowQuickDownload] = useState(false);
  const [quickDownloadInitialUrl, setQuickDownloadInitialUrl] = useState('');
  const { login } = useNcmAuth();

  const handleLogin = async (cookie: string) => {
    await login(cookie);
    setShowLogin(false);
  };
  const handleQuickAction = (toolId: ToolId, actionId: string) => {
    if (toolId === 'ncm' && actionId === 'download-undownloaded') {
      setQuickDownloadInitialUrl(loadLastNcmPlaylistUrl());
      setShowQuickDownload(true);
      return;
    }
  };
  return (
    <div style={{ fontFamily: 'sans-serif', width: 'calc(100% - 32px)', maxWidth: view === 'library' ? 1280 : 900, margin: '0 auto' }}>
      {showLogin && <NcmLoginDialog onClose={() => setShowLogin(false)} onLogin={handleLogin} />}
      {view === 'settings' ? (
        <ToolPageShell title="设置" onBackHome={() => setView('home')}>
          <SettingsPage />
        </ToolPageShell>
      ) : view === 'home' ? (
        <HomePage onOpenSettings={() => setView('settings')} onOpenTool={setView} onQuickAction={handleQuickAction} />
      ) : view === 'ncm' ? (
        <ToolPageShell title="网易云歌单" onBackHome={() => setView('home')}>
          <NcmTool onShowLogin={() => setShowLogin(true)} />
        </ToolPageShell>
      ) : view === 'library' ? (
        <ToolPageShell title="图书馆" onBackHome={() => setView('home')}>
          <LibraryTool />
        </ToolPageShell>
      ) : (
        <ToolPageShell title="Skill 管理" onBackHome={() => setView('home')}>
          <SkillManagerTool />
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
