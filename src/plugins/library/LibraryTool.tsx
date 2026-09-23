import { useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { deleteBook, importBooks, loadCachedLibrary, openBook, scanLibrary, setReadStatus, updateMetadata } from './api';
import { buildLibraryTree, filterAndSortLibraryTree, type LibraryBook, type LibraryFilter, type LibraryNode, type SortField } from './tree';

const initialFilter: LibraryFilter = { query: '', priority: null, read: null, type: null, hasDescription: false, sort: { field: 'title', direction: 'asc' } };
const button = { cursor: 'pointer' };

export default function LibraryTool() {
  const [books, setBooks] = useState<LibraryBook[]>([]); const [filter, setFilter] = useState(initialFilter);
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const types = useMemo(() => [...new Set(books.map((book) => book.bookType).filter(Boolean))].sort(), [books]);
  const tree = useMemo(() => filterAndSortLibraryTree(buildLibraryTree(books), filter), [books, filter]);
  const refresh = async () => { setLoading(true); setError(''); try { setBooks(await scanLibrary()); } catch (reason) { setError(String(reason)); } finally { setLoading(false); } };
  useEffect(() => { void loadCachedLibrary().then((cached) => { if (cached.length > 0) setBooks(cached); }).catch(() => undefined).finally(() => void refresh()); }, []);
  useEffect(() => { const update = () => setShowBackToTop(window.scrollY > 320); window.addEventListener('scroll', update, { passive: true }); update(); return () => window.removeEventListener('scroll', update); }, []);
  const changeSort = (field: SortField) => setFilter((value) => ({ ...value, sort: { field, direction: value.sort.field === field && value.sort.direction === 'asc' ? 'desc' : 'asc' } }));
  const save = async (book: LibraryBook, patch: Partial<LibraryBook>) => { const next = { ...book, ...patch }; setBooks((list) => list.map((item) => item.path === book.path ? next : item)); try { await updateMetadata(next); return true; } catch (reason) { setBooks((list) => list.map((item) => item.path === book.path ? book : item)); setError(String(reason)); return false; } };
  const toggleRead = async (book: LibraryBook) => { if (!confirm(`确定将《${book.title}》标记为${book.read ? '未读' : '已读'}吗？快捷方式将移动到对应目录。`)) return; try { await setReadStatus(book.path, !book.read); await refresh(); } catch (reason) { setError(String(reason)); } };
  const remove = async (book: LibraryBook) => { if (!confirm(`确定删除《${book.title}》吗？这会永久删除 Library 原书、read/unread 快捷方式及其元数据。`)) return; try { await deleteBook(book.path); await refresh(); } catch (reason) { setError(String(reason)); } };
  return <section style={{ padding: 16 }}>
    <h2 style={{ marginTop: 0 }}>📚 图书馆</h2>
    <p style={{ color: '#666' }}>每次进入都会扫描 <code>~/important/books/Library</code>，阅读状态由 read/unread 快捷方式决定。</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <input aria-label="搜索图书" placeholder="搜索标题、类型、描述" value={filter.query} onChange={(event) => setFilter({ ...filter, query: event.target.value })} />
      <select aria-label="星级筛选" value={filter.priority ?? ''} onChange={(event) => setFilter({ ...filter, priority: event.target.value === '' ? null : Number(event.target.value) })}><option value="">所有星级</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 星</option>)}</select>
      <select aria-label="阅读状态筛选" value={filter.read === null ? '' : String(filter.read)} onChange={(event) => setFilter({ ...filter, read: event.target.value === '' ? null : event.target.value === 'true' })}><option value="">全部状态</option><option value="true">已读</option><option value="false">未读</option></select>
      <select aria-label="类型筛选" value={filter.type ?? ''} onChange={(event) => setFilter({ ...filter, type: event.target.value || null })}><option value="">所有类型</option>{types.map((type) => <option key={type}>{type}</option>)}</select>
      <label><input type="checkbox" checked={filter.hasDescription} onChange={(event) => setFilter({ ...filter, hasDescription: event.target.checked })} /> 已有描述</label>
      <button onClick={() => setShowImport(true)} style={button}>导入书籍</button><button onClick={() => void refresh()} disabled={loading} style={button}>↻ 刷新</button>
    </div>
    {loading && <p role="status" style={{ color: '#666' }}>{books.length > 0 ? '正在后台更新图书馆…' : '正在扫描图书馆…'}</p>}
    {error && <p role="alert" style={{ color: '#b00020' }}>{error} <button onClick={() => void refresh()}>重试</button></p>}
    {(!loading || books.length > 0) && <LibraryTree node={tree} expanded={expanded} setExpanded={setExpanded} onSort={changeSort} onSave={save} onRead={toggleRead} onOpen={(book) => void openBook(book.path).catch((reason) => setError(String(reason)))} onDelete={remove} root />}
    {showBackToTop && <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="返回页面顶部" style={{ position: 'fixed', right: 24, bottom: 'max(56px, env(safe-area-inset-bottom))', zIndex: 20, border: 0, borderRadius: 999, padding: '10px 14px', background: '#2563eb', color: '#fff', boxShadow: '0 4px 14px rgba(0,0,0,.22)', cursor: 'pointer' }}>↑ 返回顶部</button>}
    {showImport && <ImportDialog onClose={() => setShowImport(false)} onDone={() => void refresh()} />}</section>;
}

function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [target, setTarget] = useState<boolean | null>(null); const [results, setResults] = useState<Array<{ source: string; status: string; message: string }>>([]);
  useEffect(() => { let unlisten: (() => void) | undefined; getCurrentWindow().onDragDropEvent((event) => { if (event.payload.type !== 'drop') return; const zone = document.elementFromPoint(event.payload.position.x, event.payload.position.y)?.closest<HTMLElement>('[data-import-read]'); if (!zone) return; const read = zone.dataset.importRead === 'true'; setTarget(read); void importBooks(event.payload.paths, read).then((value) => { setResults(value); onDone(); }).catch((reason) => setResults([{ source: '', status: 'failed', message: String(reason) }])); }).then((stop) => { unlisten = stop; }); return () => unlisten?.(); }, [onDone]);
  return <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,.35)', display: 'grid', placeItems: 'center', padding: 16 }}><div style={{ background: '#fff', width: 'min(720px,100%)', borderRadius: 12, padding: 20 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><h3 style={{ marginTop: 0 }}>导入书籍</h3><button onClick={onClose}>关闭</button></div><p>从资源管理器拖入文件或文件夹。内容将移动到 Library；同名项目会要求你检查，不会覆盖。</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><DropZone read={false} active={target === false} /><DropZone read active={target === true} /></div>{results.length > 0 && <ul>{results.map((item, index) => <li key={`${item.source}-${index}`} style={{ color: item.status === 'conflict' || item.status === 'failed' ? '#b00020' : undefined }}><b>{item.status}</b>：{item.message}</li>)}</ul>}</div></div>;
}
function DropZone({ read, active }: { read: boolean; active: boolean }) { return <div data-import-read={String(read)} style={{ minHeight: 170, border: `2px dashed ${active ? '#2563eb' : '#aaa'}`, borderRadius: 10, display: 'grid', placeItems: 'center', padding: 16, background: active ? '#eff6ff' : '#fafafa', textAlign: 'center' }}><div><strong>{read ? '✓ 已读' : '○ 未读'}</strong><p>把书籍文件或文件夹拖到这里</p></div></div>; }

function LibraryTree({ node, expanded, setExpanded, onSort, onSave, onRead, onOpen, onDelete, root = false }: { node: LibraryNode; expanded: Set<string>; setExpanded: (value: Set<string>) => void; onSort: (field: SortField) => void; onSave: (book: LibraryBook, patch: Partial<LibraryBook>) => Promise<boolean>; onRead: (book: LibraryBook) => Promise<void>; onOpen: (book: LibraryBook) => void; onDelete: (book: LibraryBook) => Promise<void>; root?: boolean }) {
  if (root) return <div style={{ border: '1px solid #ddd', borderRadius: 8 }}><div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'grid', gridTemplateColumns: 'minmax(180px,2fr) 115px 70px 130px minmax(200px,2fr) 130px', gap: 8, padding: 10, fontWeight: 700, background: '#f7f7f7', borderBottom: '1px solid #d5d5d5', boxShadow: '0 2px 5px rgba(0,0,0,.08)' }}>{(['title', 'priority', 'read', 'type', 'description'] as SortField[]).map((field) => <button key={field} onClick={() => onSort(field)} style={{ border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>{({ title: '标题', priority: '优先级', read: '已读', type: '类型', description: '描述' } as Record<SortField, string>)[field]} ↕</button>)}<span>操作</span></div>{node.children.map((child) => <LibraryTree key={child.kind === 'book' ? child.book!.path : child.name} {...{ node: child, expanded, setExpanded, onSort, onSave, onRead, onOpen, onDelete }} />)}</div>;
  if (node.kind === 'folder') { const id = node.key; const open = expanded.has(id); return <div><button onClick={() => { const next = new Set(expanded); open ? next.delete(id) : next.add(id); setExpanded(next); }} style={{ ...button, width: '100%', padding: '8px 10px', textAlign: 'left', border: 0, background: '#fafafa', fontWeight: 700 }}>📁 {open ? '▾' : '▸'} {node.name}</button>{open && <div style={{ paddingLeft: 18 }}>{node.children.map((child) => <LibraryTree key={child.key} {...{ node: child, expanded, setExpanded, onSort, onSave, onRead, onOpen, onDelete }} />)}</div>}</div>; }
  const book = node.book!; return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,2fr) 115px 70px 130px minmax(200px,2fr) 130px', gap: 8, alignItems: 'center', padding: 8, borderTop: '1px solid #eee' }}><span title={book.path}>{book.title}</span><RatingInput book={book} onSave={onSave} /><ReadSwitch book={book} onRead={onRead} /><input aria-label={`${book.title} 类型`} value={book.bookType} onChange={(event) => void onSave(book, { bookType: event.target.value })} /><DescriptionField book={book} onSave={onSave} /><span style={{ display: 'flex', gap: 6 }}><button onClick={() => onOpen(book)} style={button}>打开</button><button onClick={() => void onDelete(book)} style={{ ...button, color: '#b00020' }}>删除</button></span></div>;
}

function DescriptionField({ book, onSave }: { book: LibraryBook; onSave: (book: LibraryBook, patch: Partial<LibraryBook>) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(book.description); const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = `${ref.current.scrollHeight}px`; } };
  useEffect(() => { if (editing) { setDraft(book.description); requestAnimationFrame(() => { resize(); ref.current?.focus(); }); } }, [editing]);
  const finish = async () => { const saved = draft === book.description || await onSave(book, { description: draft }); if (saved) setEditing(false); };
  if (!editing) return <button aria-label={`${book.title} 描述，点击编辑`} onClick={() => setEditing(true)} style={{ minHeight: 30, border: '1px solid transparent', borderRadius: 4, background: book.description ? 'transparent' : '#f7f7f7', color: book.description ? '#222' : '#888', cursor: 'text', textAlign: 'left', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{book.description || '点击添加描述'}</button>;
  return <textarea ref={ref} aria-label={`${book.title} 描述`} rows={1} value={draft} onInput={resize} onChange={(event) => setDraft(event.target.value)} onBlur={() => void finish()} style={{ resize: 'vertical', overflow: 'hidden', boxSizing: 'border-box', minHeight: 30 }} />;
}

function ReadSwitch({ book, onRead }: { book: LibraryBook; onRead: (book: LibraryBook) => Promise<void> }) {
  return <button role="switch" aria-checked={book.read} aria-label={`${book.title}：${book.read ? '已读' : '未读'}`} onClick={() => void onRead(book)} style={{ position: 'relative', width: 58, height: 30, padding: 0, border: 0, borderRadius: 999, cursor: 'pointer', background: book.read ? '#22a35a' : '#a8adb4', transition: 'background 160ms ease' }}><span aria-hidden="true" style={{ position: 'absolute', top: 3, left: book.read ? 31 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left 160ms ease' }} /></button>;
}

function RatingInput({ book, onSave }: { book: LibraryBook; onSave: (book: LibraryBook, patch: Partial<LibraryBook>) => Promise<boolean> }) {
  const [hovered, setHovered] = useState<number | null>(null); const [celebrating, setCelebrating] = useState(false); const [message, setMessage] = useState('');
  const shown = hovered ?? book.priority;
  const choose = async (star: number) => { const next = star === book.priority ? 0 : star; const saved = await onSave(book, { priority: next }); if (!saved) return; setCelebrating(true); setMessage(`已标记为 ${next} 星`); window.setTimeout(() => { setCelebrating(false); setMessage(''); }, 800); };
  return <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', transform: celebrating ? 'scale(1.16)' : 'scale(1)', transition: 'transform 140ms cubic-bezier(.2,1.4,.5,1)' }} onMouseLeave={() => setHovered(null)}>{[1,2,3,4,5].map((star) => <button key={star} aria-label={`${star} 星`} onMouseEnter={() => setHovered(star)} onFocus={() => setHovered(star)} onBlur={() => setHovered(null)} onClick={() => void choose(star)} style={{ border: 0, cursor: 'pointer', background: 'transparent', color: star <= shown ? '#f5a400' : '#cbd5e1', fontSize: 20, lineHeight: 1, padding: 1, textShadow: star <= shown ? '0 1px 5px rgba(245,164,0,.35)' : undefined }}>★</button>)}{message && <span role="status" style={{ position: 'absolute', top: 26, left: 0, zIndex: 3, whiteSpace: 'nowrap', padding: '3px 6px', borderRadius: 5, background: '#1f7a3d', color: '#fff', fontSize: 12 }}>{message}</span>}</span>;
}
