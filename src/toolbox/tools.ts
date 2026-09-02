export type ToolId = 'ncm' | 'vpn-monitor';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  icon: string;
  quickActions: Array<{ id: 'download-undownloaded' | 'vpn-open-monitor'; label: string }>;
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
    id: 'vpn-monitor',
    name: 'VPN 连接监控',
    description: '定时 curl google.com 检测 Clash 代理是否有效',
    icon: '🛡️',
    quickActions: [{ id: 'vpn-open-monitor', label: '打开悬浮监控栏' }],
  },
];

export const getToolById = (id: ToolId) => toolDefinitions.find((tool) => tool.id === id)!;

export const loadLastNcmPlaylistUrl = () =>
  localStorage.getItem('toolbox_last_ncm_playlist_url') ?? 'https://music.163.com/playlist?id=784204124';

export const saveLastNcmPlaylistUrl = (url: string) =>
  localStorage.setItem('toolbox_last_ncm_playlist_url', url);
