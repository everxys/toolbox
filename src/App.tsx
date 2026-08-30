import { useState } from 'react';
import QRLogin from './plugins/ncm/QRLogin';
import PlaylistDownloader from './plugins/ncm/PlaylistDownloader';

export default function App() {
  const [logged, setLogged] = useState(false);
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <h1>Toolbox 合集 - 跨平台 (Tauri)</h1>
      <nav style={{ display: 'flex', gap: 12, borderBottom: '1px solid #ddd', paddingBottom: 8 }}>
        <span style={{ background: '#eee', padding: '4px 8px', borderRadius: 6 }}>🎵 网易云歌单</span>
        <span style={{ opacity: 0.5 }}>🧰 更多工具 …</span>
      </nav>
      {!logged ? <QRLogin onLogin={() => setLogged(true)} /> : <p>✅ 已登录 (MUSIC_U 已存于 Rust Cookie 中)</p>}
      <PlaylistDownloader />
    </div>
  );
}
