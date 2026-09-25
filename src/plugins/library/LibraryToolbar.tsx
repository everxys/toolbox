import type { LibraryFilter } from './types';

const button = { cursor: 'pointer' };

interface LibraryToolbarProps {
  filter: LibraryFilter;
  types: string[];
  formats: string[];
  loading: boolean;
  onFilterChange: (filter: LibraryFilter) => void;
  onImport: () => void;
  onRefresh: () => void;
}

export default function LibraryToolbar({ filter, types, formats, loading, onFilterChange, onImport, onRefresh }: LibraryToolbarProps) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
    <input aria-label="搜索图书" placeholder="搜索标题、格式、分类、描述" value={filter.query} onChange={(event) => onFilterChange({ ...filter, query: event.target.value })} />
    <select aria-label="星级筛选" value={filter.priority ?? ''} onChange={(event) => onFilterChange({ ...filter, priority: event.target.value === '' ? null : Number(event.target.value) })}><option value="">所有星级</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 星</option>)}</select>
    <select aria-label="阅读状态筛选" value={filter.read === null ? '' : String(filter.read)} onChange={(event) => onFilterChange({ ...filter, read: event.target.value === '' ? null : event.target.value === 'true' })}><option value="">全部状态</option><option value="true">已读</option><option value="false">未读</option></select>
    <select aria-label="格式筛选" value={filter.format ?? ''} onChange={(event) => onFilterChange({ ...filter, format: event.target.value || null })}><option value="">所有格式</option>{formats.map((format) => <option key={format}>{format}</option>)}</select>
    <select aria-label="分类筛选" value={filter.type ?? ''} onChange={(event) => onFilterChange({ ...filter, type: event.target.value || null })}><option value="">所有分类</option>{types.map((type) => <option key={type}>{type}</option>)}</select>
    <label><input type="checkbox" checked={filter.hasDescription} onChange={(event) => onFilterChange({ ...filter, hasDescription: event.target.checked })} /> 已有描述</label>
    <button onClick={onImport} style={button}>导入书籍</button><button onClick={onRefresh} disabled={loading} style={button}>↻ 刷新</button>
  </div>;
}
