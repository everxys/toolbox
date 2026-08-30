import { useMemo, useRef, useState } from 'react';
import { extractPlaylistId, fetchPlaylistDetail, fetchSongDetails, fetchPlayerUrl } from './api';
import { loadDownloadedIds, markDownloaded } from './store';
import type { Track, DownloadTask } from './types';
import { toCsv, downloadCsv, pool } from './utils';
import DownloadQueue from './DownloadQueue';

type FilterType = 'all' | 'pending' | 'done' | 'error';

export default function PlaylistDownloader() {
  const [url, setUrl] = useState('https://music.163.com/playlist?id=784204124');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [info, setInfo] = useState<any>(null);
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [concurrency] = useState(3);
  const [isDownloading, setIsDownloading] = useState(false);
  const cancelRef = useRef(false);

  // 全量列表增强：筛选 / 搜索 / 分页
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 100;

  const load = async () => {
    const id = extractPlaylistId(url);
    if (!id) return alert('无法解析 id，请粘贴完整的分享链接');
    setLoading(true);
    try {
      const { info, trackIds } = await fetchPlaylistDetail(id);
      setInfo(info);
      const ids = trackIds.map((t) => t.id);
      const all: Track[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const songs = await fetchSongDetails(chunk);
        chunk.forEach((cid, idx) => {
          const s = songs.find((x) => x.id === cid);
          if (s) s.v = trackIds[i + idx].v;
        });
        all.push(...songs);
        setTracks([...all]);
      }
      const downloaded = loadDownloadedIds();
      setTasks(all.map((t) => ({
        track: t,
        status: downloaded.has(t.id) ? 'done' : 'pending',
        progress: downloaded.has(t.id) ? 100 : 0,
      })));
      setFilter('all'); setSearch(''); setPage(1);
    } finally { setLoading(false); }
  };

  const exportCsv = (onlyFiltered = false) => {
    if (tracks.length === 0) return alert('先解析歌单');
    const data = onlyFiltered ? filteredTasks.map(t=>t.track) : tracks;
    const csv = toCsv(data);
    downloadCsv(`playlist_${info?.id || 'export'}_${onlyFiltered?'filtered_':''}${Date.now()}.csv`, csv);
  };

  const downloadAllUndownloaded = async () => {
    const pending = tasks.filter((t) => t.status === 'pending');
    if (pending.length === 0) return alert('已全部下载');
    setIsDownloading(true); cancelRef.current = false;
    const { invoke } = await import('@tauri-apps/api/core').catch(()=>({invoke: null as any}));
    const update = (id: number, patch: Partial<DownloadTask>) => {
      setTasks(prev => prev.map(p => p.track.id===id ? {...p, ...patch} : p));
    };
    await pool(pending, concurrency, async (task) => {
      if (cancelRef.current) { update(task.track.id, { status:'pending' }); return; }
      update(task.track.id, { status:'downloading', progress:10 });
      let retries = 3;
      while (retries-- > 0) {
        try {
          if (invoke) {
            try {
              const r: any = await invoke('ncm_download', { id: task.track.id, level: 'standard' });
              update(task.track.id, { status:'done', progress:100, filePath: r.filePath });
              markDownloaded(task.track.id); return;
            } catch (e:any) { if (!String(e).includes('no url')) throw e; }
          }
          const dlUrl = await fetchPlayerUrl(task.track.id);
          if (!dlUrl) throw new Error('无版权/需会员/未登录');
          const a = document.createElement('a'); a.href = dlUrl;
          a.download = `${task.track.artists.join(',')} - ${task.track.name}.mp3`; a.click();
          update(task.track.id, { status:'done', progress:100, url: dlUrl });
          markDownloaded(task.track.id); return;
        } catch (e:any) {
          if (retries===0) update(task.track.id, { status:'error', error: e.message || String(e) });
          else await new Promise(r=>setTimeout(r, 500*(3-retries)));
        }
      }
    });
    setIsDownloading(false);
  };

  // 派生：筛选 + 搜索
  const filteredTasks = useMemo(() => {
    let arr = tasks;
    if (filter !== 'all') arr = arr.filter(t => t.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(t => t.track.name.toLowerCase().includes(q) || t.track.artists.join(',').toLowerCase().includes(q) || String(t.track.id).includes(q));
    }
    return arr;
  }, [tasks, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const pageTasks = useMemo(() => filteredTasks.slice((page-1)*pageSize, page*pageSize), [filteredTasks, page]);

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t=>t.status==='pending').length,
    done: tasks.filter(t=>t.status==='done').length,
    error: tasks.filter(t=>t.status==='error').length,
    downloading: tasks.filter(t=>t.status==='downloading').length,
  };

  const statusBadge = (s: string) => {
    const m:any = { pending:{c:'#ff9800',t:'未下载'}, done:{c:'#4caf50',t:'已下载'}, downloading:{c:'#2196f3',t:'下载中'}, error:{c:'#f44336',t:'失败'}};
    const v = m[s]||{c:'#999',t:s};
    return <span style={{ background:v.c, color:'#fff', padding:'2px 6px', borderRadius:4, fontSize:12 }}>{v.t}</span>;
  };

  return (
    <div style={{ padding:16 }}>
      <h2>网易云歌单批量下载</h2>
      <div style={{ display:'flex', gap:8 }}>
        <input style={{ flex:1 }} value={url} onChange={e=>setUrl(e.target.value)} placeholder="粘贴分享链接" />
        <button onClick={load} disabled={loading}>{loading ? '拉取中...' : '解析歌单'}</button>
      </div>
      {info && <p style={{ margin:'8px 0' }}>{info.name} - {info.creator} | 官方 {info.trackCount}首 | 已拉取 {tracks.length} | <span style={{color:'#4caf50'}}>已下载 {counts.done}</span> / <span style={{color:'#ff9800'}}>未下载 {counts.pending}</span> / 失败 {counts.error}</p>}

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <button onClick={downloadAllUndownloaded} disabled={counts.pending===0 || isDownloading}>
          {isDownloading ? '下载中...' : `下载全部未下载 (${counts.pending})`} · 并发{concurrency}
        </button>
        <button onClick={()=>exportCsv(false)} disabled={tracks.length===0}>导出全部 CSV ({counts.all})</button>
        <button onClick={()=>exportCsv(true)} disabled={filteredTasks.length===0}>导出当前筛选 CSV ({filteredTasks.length})</button>
        {isDownloading && <button onClick={()=>cancelRef.current=true}>取消队列</button>}
        {counts.error>0 && <button onClick={()=>setTasks(prev=>prev.map(p=>p.status==='error'?{...p,status:'pending',error:undefined}:p))}>重试失败 ({counts.error})</button>}
      </div>

      <DownloadQueue tasks={tasks} concurrency={concurrency} />

      {/* 筛选 + 搜索 + 全量列表 */}
      <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:4 }}>
          {(['all','pending','done','error'] as FilterType[]).map(f=>(
            <button key={f} onClick={()=>{setFilter(f); setPage(1);}} style={{ background: filter===f ? '#2196f3' : '#eee', color: filter===f?'#fff':'#000', border:'none', padding:'6px 10px', borderRadius:6 }}>
              {f==='all'?`全部 ${counts.all}`:f==='pending'?`未下载 ${counts.pending}`:f==='done'?`已下载 ${counts.done}`:`失败 ${counts.error}`}
            </button>
          ))}
        </div>
        <input placeholder="搜索 歌名/歌手/id" value={search} onChange={e=>{setSearch(e.target.value); setPage(1);}} style={{ flex:1, minWidth:160, padding:6 }} />
        <span style={{ fontSize:12, color:'#666' }}>共 {filteredTasks.length} 条 / {totalPages} 页 · 每页 {pageSize}</span>
      </div>

      <div style={{ maxHeight:520, overflow:'auto', marginTop:8, border:'1px solid #eee', borderRadius:8 }}>
        <table width="100%" style={{ fontSize:13, borderCollapse:'collapse' }}>
          <thead style={{ position:'sticky', top:0, background:'#fafafa' }}><tr><th style={{textAlign:'left', padding:6}}>#</th><th>hash(id)</th><th>歌名</th><th>歌手</th><th>专辑</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {pageTasks.map((t, idx) => (
              <tr key={t.track.id} style={{ background: idx%2? '#fff':'#fcfcfc', borderTop:'1px solid #eee' }}>
                <td style={{padding:6}}>{(page-1)*pageSize+idx+1}</td>
                <td style={{fontFamily:'monospace'}}>{t.track.id}</td>
                <td>{t.track.name}</td>
                <td>{t.track.artists.join('/')}</td>
                <td style={{color:'#666', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{t.track.album}</td>
                <td>{statusBadge(t.status)}</td>
                <td>
                  {t.status==='pending' && <button style={{fontSize:12}} onClick={async()=>{
                    setTasks(prev=>prev.map(p=>p.track.id===t.track.id?{...p,status:'downloading'}:p));
                    try{
                      const {invoke}=await import('@tauri-apps/api/core').catch(()=>({invoke:null as any}));
                      if(invoke){ const r:any=await invoke('ncm_download',{id:t.track.id}); setTasks(prev=>prev.map(p=>p.track.id===t.track.id?{...p,status:'done',filePath:r.filePath}:p)); markDownloaded(t.track.id); }
                      else { const url=await fetchPlayerUrl(t.track.id); if(!url) throw new Error('无版权'); const a=document.createElement('a'); a.href=url; a.download=`${t.track.artists.join(',')} - ${t.track.name}.mp3`; a.click(); setTasks(prev=>prev.map(p=>p.track.id===t.track.id?{...p,status:'done'}:p)); markDownloaded(t.track.id); }
                    }catch(e:any){ setTasks(prev=>prev.map(p=>p.track.id===t.track.id?{...p,status:'error',error:e.message}:p)); }
                  }}>下载</button>}
                  {t.status==='done' && <span style={{fontSize:12, color:'#4caf50'}}>✓ {t.filePath? t.filePath.split('/').pop() : ''}</span>}
                  {t.status==='error' && <span title={t.error} style={{fontSize:12, color:'#f44336'}}>{t.error?.slice(0,20)}</span>}
                </td>
              </tr>
            ))}
            {pageTasks.length===0 && <tr><td colSpan={7} style={{textAlign:'center', padding:20, color:'#999'}}>无数据（切换筛选或清空搜索）</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:8, alignItems:'center' }}>
        <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>上一页</button>
        <span style={{fontSize:12}}>{page} / {totalPages} · 已拉取 {tracks.length} 首（官方 {info?.trackCount||0}）</span>
        <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>下一页</button>
        <button onClick={()=>setPage(1)}>回到首页</button>
      </div>
      <p style={{fontSize:12, color:'#888'}}>提示：hash 即网易云 song id，天然唯一；已下载状态存于 localStorage/SQLite，跨重启持久化；“输出所有歌单列表”即上表 + CSV 导出。</p>
    </div>
  );
}
