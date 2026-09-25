import { useEffect } from 'react';
import type { SkillCategory } from './types';

export interface CategoryMenuState { category: SkillCategory; x: number; y: number }

export default function SkillCategoryMenu({ state, onClose, onEdit, onDelete }: { state: CategoryMenuState; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [onClose]);
  return <div aria-label="分类操作菜单遮罩" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 35 }}><div role="menu" aria-label={`${state.category.name} 分类操作`} onClick={(event) => event.stopPropagation()} style={{ position: 'fixed', left: state.x, top: state.y, minWidth: 150, padding: 5, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', boxShadow: '0 10px 26px rgba(15,23,42,.2)' }}><button role="menuitem" onClick={onEdit} style={itemStyle}>编辑分类</button><button role="menuitem" onClick={onDelete} style={{ ...itemStyle, color: '#b00020' }}>删除分类</button></div></div>;
}
const itemStyle = { display: 'block', width: '100%', padding: '8px 10px', border: 0, borderRadius: 5, background: 'transparent', textAlign: 'left' as const, cursor: 'pointer' };
