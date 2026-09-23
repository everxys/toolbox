import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteSkill, deleteSkillCategory, listSkillCategories, saveSkillCategory, scanSkills, updateSkillMetadata, type Skill, type SkillCategory } from './api';
import { matchesSkillSearch } from './filters';

const button = { cursor: 'pointer' };

export default function SkillManagerTool() {
  const [skills, setSkills] = useState<Skill[]>([]); const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [query, setQuery] = useState(''); const [categoryFilter, setCategoryFilter] = useState<number | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SkillCategory | null | undefined>(undefined);
  const refresh = async () => { setLoading(true); setError(''); try { const [nextSkills, nextCategories] = await Promise.all([scanSkills(), listSkillCategories()]); setSkills(nextSkills); setCategories(nextCategories); } catch (reason) { setError(String(reason)); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { const update = () => setShowBackToTop(window.scrollY > 320); window.addEventListener('scroll', update, { passive: true }); update(); return () => window.removeEventListener('scroll', update); }, []);
  const shown = useMemo(() => skills.filter((skill) => matchesSkillSearch(skill, query) && (categoryFilter === null || skill.categoryIds.includes(categoryFilter))), [skills, query, categoryFilter]);
  const categoryNames = (skill: Skill) => categories.filter((category) => skill.categoryIds.includes(category.id));
  const saveDescription = async (skill: Skill, customDescription: string) => { try { await updateSkillMetadata({ path: skill.path, customDescription }); setSkills((list) => list.map((item) => item.path === skill.path ? { ...item, customDescription } : item)); return true; } catch (reason) { setError(String(reason)); return false; } };
  const remove = async (skill: Skill) => { if (!confirm(`确定删除 skill“${skill.name}”吗？\n\n将永久删除整个目录：\n${skill.path}\n\n同时会清理此工具中的自定义描述和分类关联。`)) return; try { await deleteSkill(skill.path); await refresh(); } catch (reason) { setError(String(reason)); } };
  const removeCategory = async (category: SkillCategory) => { if (!confirm(`确定删除分类“${category.name}”吗？关联会移除，但不会删除任何 skill。`)) return; try { await deleteSkillCategory(category.id); await refresh(); } catch (reason) { setError(String(reason)); } };
  return <section style={{ padding: 16 }}>
    <h2 style={{ marginTop: 0 }}>🧩 Skill 管理</h2>
    <p style={{ color: '#666' }}>扫描 <code>~/.agents</code> 下的 SKILL.md；分类与自定义描述只保存于 Toolbox，不会修改原始 skill。</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <input aria-label="搜索 skill" placeholder="搜索名称、原生说明、自定义描述" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button onClick={() => setEditingCategory(null)} style={button}>新建分类</button><button onClick={() => void refresh()} disabled={loading} style={button}>↻ 刷新</button>
    </div>
    <div aria-label="Skill 分类" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8, borderBottom: '1px solid #ddd', paddingBottom: 8 }}><button onClick={() => setCategoryFilter(null)} style={{ ...tabStyle, ...(categoryFilter === null ? activeTabStyle : {}) }}>全部</button>{categories.map((category) => <span key={category.id} style={{ display: 'inline-flex', alignItems: 'center', borderBottom: categoryFilter === category.id ? '2px solid #2563eb' : '2px solid transparent' }}><button onClick={() => setCategoryFilter(category.id)} style={{ ...tabStyle, ...(categoryFilter === category.id ? activeTabStyle : {}) }}>{category.name}</button><button aria-label={`编辑分类 ${category.name}`} onClick={() => setEditingCategory(category)} style={iconButton}>✎</button><button aria-label={`删除分类 ${category.name}`} onClick={() => void removeCategory(category)} style={{ ...iconButton, color: '#b00020' }}>×</button></span>)}</div>
    {!loading && !error && <p aria-live="polite" style={{ margin: '0 0 10px', color: '#666' }}>当前显示 {shown.length} 个 skill</p>}
    {loading ? <p>正在扫描 skills…</p> : error ? <p role="alert" style={{ color: '#b00020' }}>{error} <button onClick={() => void refresh()}>重试</button></p> : <SkillTable skills={shown} categoryNames={categoryNames} onSaveDescription={saveDescription} onDelete={remove} />}
    {editingCategory !== undefined && <CategoryDialog category={editingCategory} skills={skills} onClose={() => setEditingCategory(undefined)} onSaved={() => { setEditingCategory(undefined); void refresh(); }} onError={setError} />}
    {showBackToTop && <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="返回页面顶部" style={{ position: 'fixed', right: 24, bottom: 'max(56px, env(safe-area-inset-bottom))', zIndex: 20, border: 0, borderRadius: 999, padding: '10px 14px', background: '#2563eb', color: '#fff', boxShadow: '0 4px 14px rgba(0,0,0,.22)', cursor: 'pointer' }}>↑ 返回顶部</button>}
  </section>;
}

const tabStyle = { border: 0, padding: '6px 8px', background: 'transparent', cursor: 'pointer', borderRadius: 5 };
const activeTabStyle = { background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 };
const iconButton = { border: 0, padding: '2px 4px', background: 'transparent', cursor: 'pointer', fontSize: 12 };

function SkillTable({ skills, categoryNames, onSaveDescription, onDelete }: { skills: Skill[]; categoryNames: (skill: Skill) => SkillCategory[]; onSaveDescription: (skill: Skill, description: string) => Promise<boolean>; onDelete: (skill: Skill) => Promise<void> }) {
  if (skills.length === 0) return <p>没有找到匹配的 skill。</p>;
  return <div style={{ border: '1px solid #ddd', borderRadius: 8, overflowX: 'auto' }}><div style={{ minWidth: 760 }}><div style={{ display: 'grid', gridTemplateColumns: '150px minmax(200px, 1fr) minmax(200px, 1fr) 150px 72px', gap: 8, padding: 10, fontWeight: 700, background: '#f7f7f7', borderBottom: '1px solid #ddd' }}><span>名称</span><span>原生说明</span><span>自定义描述</span><span>分类</span><span>操作</span></div>{skills.map((skill) => <div key={skill.path} style={{ display: 'grid', gridTemplateColumns: '150px minmax(200px, 1fr) minmax(200px, 1fr) 150px 72px', gap: 8, padding: 10, alignItems: 'start', borderBottom: '1px solid #eee' }}><span title={skill.path}><b>{skill.name}</b>{skill.parseError && <small style={{ display: 'block', color: '#b45309', marginTop: 4 }}>{skill.parseError}</small>}</span><span title={skill.nativeDescription} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{skill.nativeDescription || '—'}</span><DescriptionEditor skill={skill} onSave={onSaveDescription} /><span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{categoryNames(skill).map((category) => <i key={category.id} style={{ padding: '2px 6px', borderRadius: 8, fontStyle: 'normal', fontSize: 12, background: '#eef2ff' }}>{category.name}</i>) || '—'}</span><button onClick={() => void onDelete(skill)} style={{ ...button, color: '#b00020' }}>删除</button></div>)}</div></div>;
}

function DescriptionEditor({ skill, onSave }: { skill: Skill; onSave: (skill: Skill, description: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(skill.customDescription); const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setDraft(skill.customDescription); }, [skill.customDescription]);
  const resize = () => { if (textarea.current) { textarea.current.style.height = 'auto'; textarea.current.style.height = `${textarea.current.scrollHeight}px`; } };
  useEffect(() => { if (editing) requestAnimationFrame(() => { resize(); textarea.current?.focus(); }); }, [editing]);
  const finish = async () => { const saved = draft === skill.customDescription || await onSave(skill, draft); if (saved) setEditing(false); };
  if (!editing) return <button aria-label={`${skill.name} 自定义描述，点击编辑`} onClick={() => setEditing(true)} style={{ width: '100%', minHeight: 36, padding: 5, border: '1px solid transparent', borderRadius: 4, background: skill.customDescription ? 'transparent' : '#f7f7f7', color: skill.customDescription ? '#222' : '#888', cursor: 'text', textAlign: 'left', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{skill.customDescription || '点击添加自定义描述'}</button>;
  return <textarea ref={textarea} aria-label={`${skill.name} 自定义描述`} value={draft} onInput={resize} onChange={(event) => setDraft(event.target.value)} onBlur={() => void finish()} placeholder="添加自己的描述" rows={1} style={{ width: '100%', boxSizing: 'border-box', minHeight: 36, overflow: 'hidden', resize: 'vertical' }} />;
}

function CategoryDialog({ category, skills, onClose, onSaved, onError }: { category: SkillCategory | null; skills: Skill[]; onClose: () => void; onSaved: () => void; onError: (message: string) => void }) {
  const [name, setName] = useState(category?.name ?? ''); const [query, setQuery] = useState(''); const [selected, setSelected] = useState(() => new Set(category?.skillPaths ?? [])); const [saving, setSaving] = useState(false);
  const visible = skills.filter((skill) => matchesSkillSearch(skill, query));
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [onClose]);
  const toggle = (path: string) => setSelected((current) => { const next = new Set(current); next.has(path) ? next.delete(path) : next.add(path); return next; });
  const save = async () => { setSaving(true); try { await saveSkillCategory({ ...(category ? { id: category.id } : {}), name, skillPaths: [...selected] }); onSaved(); } catch (reason) { onError(String(reason)); } finally { setSaving(false); } };
  return <div role="dialog" aria-modal="true" aria-label={category ? '编辑分类' : '新建分类'} style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,.35)' }} onClick={onClose}><div style={{ width: 'min(700px, 100%)', maxHeight: '85vh', overflow: 'auto', background: '#fff', borderRadius: 12, padding: 20 }} onClick={(event) => event.stopPropagation()}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><h3 style={{ marginTop: 0 }}>{category ? '编辑分类' : '新建分类'}</h3><button onClick={onClose}>关闭</button></div><label style={{ display: 'grid', gap: 5, marginBottom: 12 }}>分类名称<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：自媒体" /></label><input aria-label="搜索分类中的 skill" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、原生说明、自定义描述" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10 }} /><p style={{ color: '#666', margin: '4px 0 8px' }}>已选择 {selected.size} 个 skill；搜索不会清除已勾选内容。</p><div style={{ border: '1px solid #ddd', borderRadius: 8 }}>{visible.map((skill) => <label key={skill.path} style={{ display: 'flex', gap: 8, padding: 9, borderBottom: '1px solid #eee', cursor: 'pointer' }}><input type="checkbox" checked={selected.has(skill.path)} onChange={() => toggle(skill.path)} /><span><b>{skill.name}</b><small style={{ display: 'block', color: '#666' }}>{skill.nativeDescription}</small></span></label>)}{visible.length === 0 && <p style={{ padding: 10 }}>没有匹配的 skill。</p>}</div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}><button onClick={onClose}>取消</button><button disabled={saving || !name.trim()} onClick={() => void save()}>{saving ? '保存中…' : '保存分类'}</button></div></div></div>;
}
