import { useState } from 'react';
import { checkForUpdate, downloadAndInstall, type UpdaterState } from './updater';

export default function UpdaterButton() {
  const [state, setState] = useState<UpdaterState>({ status: 'idle' });
  const [progress, setProgress] = useState<{ done: number; total?: number } | null>(null);

  const onCheck = async () => {
    setState({ status: 'checking' });
    try {
      const s = await checkForUpdate();
      setState(s);
    } catch (e) {
      setState({ status: 'error', message: String(e) });
    }
  };

  const onUpdate = async () => {
    if (state.status !== 'available') return;
    setState({ status: 'downloading', version: state.version });
    try {
      await downloadAndInstall((done, total) => setProgress({ done, total }));
      setState({ status: 'ready', version: (state as { version: string }).version });
    } catch (e) {
      setState({ status: 'error', message: String(e) });
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button onClick={() => void onCheck()} disabled={state.status === 'checking' || state.status === 'downloading'}>
        {state.status === 'checking' ? '检查中…' : state.status === 'downloading' ? '下载中…' : '检查更新'}
      </button>
      {state.status === 'available' && (
        <button onClick={() => void onUpdate()} style={{ background: '#22c55e', color: '#fff', border: 0, borderRadius: 6, padding: '6px 10px' }}>
          更新到 {state.version}
        </button>
      )}
      {state.status === 'up-to-date' && <span style={{ fontSize: 12, color: '#22c55e' }}>已是最新</span>}
      {state.status === 'error' && <span style={{ fontSize: 12, color: '#ef4444' }} title={state.message}>{state.message.slice(0, 80)}</span>}
      {state.status === 'downloading' && progress && (
        <span style={{ fontSize: 12, color: '#666' }}>
          {progress.total ? `${Math.round((progress.done / progress.total) * 100)}%` : `${Math.round(progress.done / 1024)} KB`}
        </span>
      )}
      {state.status === 'ready' && <span style={{ fontSize: 12, color: '#22c55e' }}>已下载，重启生效</span>}
    </div>
  );
}
