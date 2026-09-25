import type { DownloadTask } from './types';

export type TaskFilter = 'all' | 'pending' | 'done' | 'error';
export const filterTasks = (tasks: DownloadTask[], filter: TaskFilter, search: string) => {
  let result = filter === 'all' ? tasks : tasks.filter((task) => task.status === filter);
  const query = search.trim().toLowerCase();
  return query ? result.filter((task) => task.track.name.toLowerCase().includes(query) || task.track.artists.join(',').toLowerCase().includes(query) || String(task.track.id).includes(query)) : result;
};
export const taskCounts = (tasks: DownloadTask[]) => { let pending = 0, done = 0, error = 0, downloading = 0; for (const task of tasks) { if (task.status === 'pending') pending++; else if (task.status === 'done') done++; else if (task.status === 'error') error++; else if (task.status === 'downloading') downloading++; } return { all: tasks.length, pending, done, error, downloading }; };
export const taskPage = (tasks: DownloadTask[], page: number, pageSize: number) => tasks.slice((page - 1) * pageSize, page * pageSize);
