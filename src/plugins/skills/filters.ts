import type { Skill } from './types';

export const matchesSkillSearch = (skill: Skill, query: string) => {
  const needle = query.trim().toLocaleLowerCase();
  return !needle || [skill.name, skill.nativeDescription, skill.customDescription].some((value) => value.toLocaleLowerCase().includes(needle));
};
