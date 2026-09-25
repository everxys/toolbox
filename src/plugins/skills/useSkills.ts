import { useEffect, useState } from 'react';
import { deleteSkill, deleteSkillCategory, listSkillCategories, scanSkills, updateSkillMetadata } from './api';
import type { Skill, SkillCategory } from './types';

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]); const [categories, setCategories] = useState<SkillCategory[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const refresh = async () => { setLoading(true); setError(''); try { const [nextSkills, nextCategories] = await Promise.all([scanSkills(), listSkillCategories()]); setSkills(nextSkills); setCategories(nextCategories); } catch (reason) { setError(String(reason)); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  const saveDescription = async (skill: Skill, customDescription: string) => { try { await updateSkillMetadata({ path: skill.path, customDescription }); setSkills((list) => list.map((item) => item.path === skill.path ? { ...item, customDescription } : item)); return true; } catch (reason) { setError(String(reason)); return false; } };
  const remove = async (skill: Skill) => { if (!confirm(`确定删除 skill“${skill.name}”吗？\n\n将永久删除整个目录：\n${skill.path}\n\n同时会清理此工具中的自定义描述和分类关联。`)) return; try { await deleteSkill(skill.path); await refresh(); } catch (reason) { setError(String(reason)); } };
  const removeCategory = async (category: SkillCategory) => { if (!confirm(`确定删除分类“${category.name}”吗？关联会移除，但不会删除任何 skill。`)) return; try { await deleteSkillCategory(category.id); await refresh(); } catch (reason) { setError(String(reason)); } };
  return { skills, categories, loading, error, setError, refresh, saveDescription, remove, removeCategory };
}
