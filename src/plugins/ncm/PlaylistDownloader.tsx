import { useState } from 'react';
import { openDownloadDir } from './api';
import { toCsv, downloadCsv } from './utils';
import DownloadQueue from './DownloadQueue';
import { useTaskFiltering } from './useTaskFiltering';
import { usePlaylistLoader } from './usePlaylistLoader';
import { useDownloadActions } from './useDownloadActions';
import type { DownloadTask } from './types';

export default function PlaylistDownloader() {
  const [level, setLevel] = useState('exhigh');
  const [concurrency] = useState(3);

  const { url, setUrl, info, tracks, tasks, setTasks, loading, error: loadError, load: loadPlaylist } = usePlaylistLoader();

  const {
    filter, setFilter,
    search, setSearch,
    page, setPage,
    pageSize, filteredTasks, pageTasks, totalPages, counts, reset: resetFiltering,
  } = useTaskFiltering(tasks, 100);

  const {
    logged: loggedIn,
    isDownloading,
    feedback: actionFeedback,
    cancelRef,
    downloadAllUndownloaded,
    downloadTrack,
    markFromThisTrack,
  } = useDownloadActions(tasks, setTasks, level, concurrency);
  const [dirError, setDirError] = useState<string | null>(null);

  const load = async () => {
    await loadPlaylist();
    resetFiltering();
  };

  const [exportError, setExportError] = useState<string | null>(null);
  const exportCsv = (onlyFiltered = false) => {
    if (tracks.length === 0) {
      setExportError('先解析歌单');
      return;
    }
    setExportError(null);
    const data = onlyFiltered ? filteredTasks.map((t) => t.track) : tracks;
    const csv = toCsv(data);
    downloadCsv(`playlist_${info?.id || 'export'}_${onlyFiltered ? 'filtered_' : ''}${Date.now()}.csv`, csv);
  };

  const statusBadge = (s: DownloadTask['status']) => {
    const map: Record<DownloadTask['status'], { c: string; t: string }> = {
      pending: { c: '#ff9800', t: '未下载' },
      done: { c: '#4caf50', t: '已下载' },
      downloading: { c: '#2196f3', t: '下载中' },
      error: { c: '#f44336', t: '失败' },
      skipped: { c: '#999', t: '已跳过' },
    };
    const v = map[s];
    return <span style={{ background: v.c, color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{v.t}</span>;
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>网易云歌单批量下载</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ flex: 1 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="粘贴分享链接" />
        <button onClick={load} disabled={loading}>{loading ? '拉取中...' : '解析歌单'}</button>
      </div>
      {loadError && <p role="status" style={{ margin: '8px 0', color: '#f44336' }}>{loadError}</p>}
      {exportError && <p role="status" style={{ margin: '8px 0', color: '#f44336' }}>{exportError}</p>}
      {actionFeedback && <p role="status" style={{ margin: '8px 0', color: '#b45309' }}>{actionFeedback}</p>}
      {dirError && <p role="status" style={{ margin: '8px 0', color: '#f44336' }}>{dirError}</p>}
      {info && <p style={{ margin: '8px 0' }}>{info.name} - {info.creator} | 官方 {info.trackCount}首 | 已拉取 {tracks.length} | <span style={{ color: '#4caf50' }}>已下载 {counts.done}</span> / <span style={{ color: '#ff9800' }}>未下载 {counts.pending}</span> / 失败 {counts.error}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          下载音质
          <select value={level} onChange={(event) => setLevel(event.target.value)} disabled={isDownloading}>
            <option value="standard">标准（128k）</option>
            <option value="higher">较高（192k）</option>
            <option value="exhigh">极高（320k）</option>
            <option value="lossless">无损 FLAC</option>
            <option value="hires">Hi-Res</option>
          </select>
        </label>
        <button onClick={downloadAllUndownloaded} disabled={!loggedIn || counts.pending === 0 || isDownloading}>
          {isDownloading ? '下载中...' : `下载全部未下载 (${counts.pending})`} · 并发{concurrency}
        </button>
        <button onClick={() => openDownloadDir().catch((error) => setDirError(`无法打开下载目录：${String(error)}`))}>打开下载目录</button>
        <button onClick={() => exportCsv(false)} disabled={tracks.length === 0}>导出全部 CSV ({counts.all})</button>
        <button onClick={() => exportCsv(true)} disabled={filteredTasks.length === 0}>导出当前筛选 CSV ({filteredTasks.length})</button>
        {isDownloading && <button onClick={() => cancelRef.current = true}>取消队列</button>}
        {counts.error > 0 && <button onClick={() => setTasks((prev) => prev.map((p) => p.status === 'error' ? { ...p, status: 'pending', error: undefined } : p))}>重试失败 ({counts.error})</button>}
      </div>

      <DownloadQueue tasks={tasks} concurrency={concurrency} />

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'pending', 'done', 'error'] as const).map((f) => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{ background: filter === f ? '#2196f3' : '#eee', color: filter === f ? '#fff' : '#000', border: 'none', padding: '6px 10px', borderRadius: 6 }}>
              {f === 'all' ? `全部 ${counts.all}` : f === 'pending' ? `未下载 ${counts.pending}` : f === 'done' ? `已下载 ${counts.done}` : `失败 ${counts.error}`}
            </button>
          ))}
        </div>
        <input placeholder="搜索 歌名/歌手/id" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ flex: 1, minWidth: 160, padding: 6 }} />
        <span style={{ fontSize: 12, color: '#666' }}>共 {filteredTasks.length} 条 / {totalPages} 页 · 每页 {pageSize}</span>
      </div>

      <div style={{ maxHeight: 520, overflow: 'auto', marginTop: 8, border: '1px solid #eee', borderRadius: 8 }}>
        <table width="100%" style={{ fontSize: 13, borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#fafafa' }}><tr><th style={{ textAlign: 'left', padding: 6 }}>#</th><th>hash(id)</th><th>歌名</th><th>歌手</th><th>专辑</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {pageTasks.map((t, idx) => (
              <tr key={t.track.id} style={{ background: idx % 2 ? '#fff' : '#fcfcfc', borderTop: '1px solid #eee' }}>
                <td style={{ padding: 6 }}>{(page - 1) * pageSize + idx + 1}</td>
                <td style={{ fontFamily: 'monospace' }}>{t.track.id}</td>
                <td>{t.track.name}</td>
                <td>{t.track.artists.join('/')}</td>
                <td style={{ color: '#666', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.track.album}</td>
                <td>{statusBadge(t.status)}</td>
                <td>
                  {t.status !== 'downloading' && <button style={{ fontSize: 12 }} disabled={!loggedIn} onClick={() => downloadTrack(t)}>{t.status === 'done' ? '重新下载' : '下载'}</button>}
                  {t.status === 'pending' && <button style={{ fontSize: 12, marginLeft: 4 }} onClick={() => markFromThisTrack(t.track.id)}>从此首起标记</button>}
                  {t.status === 'done' && <span style={{ fontSize: 12, color: '#4caf50' }}>✓ {t.filePath ? t.filePath.split('/').pop() : ''}</span>}
                  {t.status === 'error' && <span title={t.error} style={{ fontSize: 12, color: '#f44336' }}>{t.error?.slice(0, 20)}</span>}
                </td>
              </tr>
            ))}
            {pageTasks.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#999' }}>无数据（切换筛选或清空搜索）</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, alignItems: 'center' }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
        <span style={{ fontSize: 12 }}>{page} / {totalPages} · 已拉取 {tracks.length} 首（官方 {info?.trackCount || 0}）</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
        <button onClick={() => setPage(1)}>回到第一页</button>
      </div>
      <p style={{ fontSize: 12, color: '#888' }}>提示：hash 即网易云 song id，天然唯一；已下载状态存于 SQLite，跨重启持久化；“输出所有歌单列表”即上表 + CSV 导出。</p>
    </div>
  );
}
