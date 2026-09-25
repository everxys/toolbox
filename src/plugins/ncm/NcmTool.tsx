import { useNcmAuth } from './NcmAuthContext';
import PlaylistDownloader from './PlaylistDownloader';

export default function NcmTool({ onShowLogin }: { onShowLogin: () => void }) {
  const { nickname, logged, logout } = useNcmAuth();
  return <>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 16px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
      <span style={{ fontSize: 13, color: '#666' }}>网易云歌单 — 需登录后下载</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{logged ? <><span title="网易云音乐登录账号" style={{ fontSize: 13 }}>👤 {nickname}</span><button onClick={() => void logout()} style={{ fontSize: 13 }}>退出登录</button></> : <button onClick={onShowLogin} style={{ fontSize: 13 }}>登录网易云</button>}</div>
    </div>
    <PlaylistDownloader />
  </>;
}
