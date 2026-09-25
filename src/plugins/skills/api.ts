import { invoke } from '@tauri-apps/api/core';
import type { Skill, SkillCategory, SkillCategorySave } from './types';
export type { Skill, SkillCategory, SkillCategorySave } from './types';

export const scanSkills = () => invoke<Skill[]>('skills_scan');
export const updateSkillMetadata = (update: Pick<Skill, 'path' | 'customDescription'>) => invoke<void>('skills_update_metadata', { update });
export const listSkillCategories = () => invoke<SkillCategory[]>('skills_list_categories');
export const saveSkillCategory = (category: SkillCategorySave) => invoke<SkillCategory>('skills_save_category', { category });
export const deleteSkillCategory = (id: number) => invoke<void>('skills_delete_category', { id });
export const deleteSkill = (path: string) => invoke<void>('skills_delete_skill', { path });
