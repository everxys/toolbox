import type { DownloadTask } from './types';

export default function DownloadQueue({ tasks, concurrency, onPause, onCancel }:{
  tasks: DownloadTask[];
  concurrency: number;
  onPause?: () => void;
  onCancel?: () => void;
}) {
  const stats = {
    pending: tasks.filter(t=>t.status==='pending').length,
    downloading: tasks.filter(t=>t.status==='downloading').length,
    done: tasks.filter(t=>t.status==='done').length,
    error: tasks.filter(t=>t.status==='error').length,
  };
  const progress = tasks.length ? Math.round((stats.done/tasks.length)*100) : 0;
  return (
    <div style={{ border:'1px solid #ddd', borderRadius:8, padding:12, marginTop:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <strong>下载队列</strong>
        <span style={{ fontSize:12, color:'#666' }}>并发 {concurrency} | 总 {tasks.length} | 进度 {progress}%</span>
      </div>
      <div style={{ height:8, background:'#eee', borderRadius:4, margin:'8px 0' }}>
        <div style={{ width:`${progress}%`, height:'100%', background:'#4caf50', borderRadius:4, transition:'width 0.3s' }} />
      </div>
      <div style={{ fontSize:12, display:'flex', gap:12 }}>
        <span>待下载 {stats.pending}</span><span style={{color:'#2196f3'}}>下载中 {stats.downloading}</span>
        <span style={{color:'#4caf50'}}>已完成 {stats.done}</span><span style={{color:'#f44336'}}>失败 {stats.error}</span>
      </div>
      {(onPause||onCancel) && <div style={{ marginTop:8, display:'flex', gap:8 }}>
        {onPause && <button onClick={onPause}>暂停</button>}
        {onCancel && <button onClick={onCancel}>取消</button>}
      </div>}
      <div style={{ maxHeight:200, overflow:'auto', marginTop:8, fontSize:12 }}>
        {tasks.filter(t=>t.status==='error').slice(0,20).map(t=>(
          <div key={t.track.id} style={{ color:'#f44336' }}>{t.track.id} {t.track.name} - {t.error}</div>
        ))}
      </div>
    </div>
  );
}
