import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { importBooks } from './api';
import type { ImportResult } from './types';

export function useLibraryImport(onDone: () => void) {
  const [target, setTarget] = useState<boolean | null>(null); const targetRef = useRef<boolean | null>(null); const onDoneRef = useRef(onDone); const [results, setResults] = useState<ImportResult[]>([]); const [importing, setImporting] = useState(false);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  const selectTarget = (read: boolean | null) => { targetRef.current = read; setTarget(read); };
  const zoneAt = (position: { x: number; y: number }) => { const scale = window.devicePixelRatio || 1; const zone = document.elementFromPoint(position.x / scale, position.y / scale)?.closest<HTMLElement>('[data-import-read]'); return zone ? zone.dataset.importRead === 'true' : null; };
  const runImport = (paths: string[], read: boolean) => { selectTarget(read); setImporting(true); setResults([]); void importBooks(paths, read).then((value) => { setResults(value); onDoneRef.current(); }).catch((reason) => setResults([{ source: '', status: 'failed', message: String(reason) }])).finally(() => setImporting(false)); };
  useEffect(() => { let unlisten: (() => void) | undefined; let disposed = false; getCurrentWindow().onDragDropEvent((event) => { if (event.payload.type === 'leave') { selectTarget(null); return; } const hovered = zoneAt(event.payload.position); if (event.payload.type === 'enter' || event.payload.type === 'over') { selectTarget(hovered); return; } const read = hovered ?? targetRef.current; if (read === null) { setResults([{ source: '', status: 'failed', message: '请将文件放到“未读”或“已读”区域中；也可以先点击选择目标区域。' }]); return; } runImport(event.payload.paths, read); }).then((stop) => { if (disposed) stop(); else unlisten = stop; }); return () => { disposed = true; unlisten?.(); }; }, []);
  return { target, results, importing, selectTarget };
}
