export interface Skill { path: string; name: string; nativeDescription: string; customDescription: string; parseError: string | null; categoryIds: number[] }
export interface SkillCategory { id: number; name: string; skillPaths: string[] }
export interface SkillCategorySave { id?: number; name: string; skillPaths: string[] }
