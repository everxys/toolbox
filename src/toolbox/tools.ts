export type ToolId = 'ncm' | 'library' | 'skills';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  icon: string;
  quickActions: Array<{ id: string; label: string }>;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    id: 'ncm',
    name: '网易云音乐歌单',
    description: '解析歌单并批量下载歌曲',
    icon: '🎵',
    quickActions: [{ id: 'download-undownloaded', label: '解析歌单并下载所有未下载歌曲' }],
  },
  {
    id: 'library',
    name: '图书馆',
    description: '管理本地书籍、阅读状态与笔记',
    icon: '📚',
    quickActions: [],
  },
  {
    id: 'skills',
    name: 'Skill 管理',
    description: '扫描、分类和维护本地 Agent skills',
    icon: '🧩',
    quickActions: [],
  },
];

export const getToolById = (id: ToolId) => toolDefinitions.find((tool) => tool.id === id)!;
