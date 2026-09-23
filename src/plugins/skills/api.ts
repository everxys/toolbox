import { invoke } from '@tauri-apps/api/core';

export interface Skill { path: string; name: string; nativeDescription: string; customDescription: string; parseError: string | null; categoryIds: number[] }
export interface SkillCategory { id: number; name: string; skillPaths: string[] }
export interface SkillCategorySave { id?: number; name: string; skillPaths: string[] }

export const scanSkills = () => invoke<Skill[]>('skills_scan');
export const updateSkillMetadata = (update: Pick<Skill, 'path' | 'customDescription'>) => invoke<void>('skills_update_metadata', { update });
export const listSkillCategories = () => invoke<SkillCategory[]>('skills_list_categories');
export const saveSkillCategory = (category: SkillCategorySave) => invoke<SkillCategory>('skills_save_category', { category });
export const deleteSkillCategory = (id: number) => invoke<void>('skills_delete_category', { id });
export const deleteSkill = (path: string) => invoke<void>('skills_delete_skill', { path });
