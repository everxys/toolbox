import { useMemo, useState } from 'react';
import type { DownloadTask } from './types';

export type FilterType = 'all' | 'pending' | 'done' | 'error';

export function useTaskFiltering(tasks: DownloadTask[], pageSize = 100) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filteredTasks = useMemo(() => {
    let arr = tasks;
    if (filter !== 'all') arr = arr.filter((t) => t.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.track.name.toLowerCase().includes(q) ||
          t.track.artists.join(',').toLowerCase().includes(q) ||
          String(t.track.id).includes(q),
      );
    }
    return arr;
  }, [tasks, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const pageTasks = useMemo(
    () => filteredTasks.slice((page - 1) * pageSize, page * pageSize),
    [filteredTasks, page, pageSize],
  );

  const counts = useMemo(() => {
    let pending = 0, done = 0, error = 0, downloading = 0;
    for (const task of tasks) {
      if (task.status === 'pending') pending++;
      else if (task.status === 'done') done++;
      else if (task.status === 'error') error++;
      else if (task.status === 'downloading') downloading++;
    }
    return { all: tasks.length, pending, done, error, downloading };
  }, [tasks]);

  const reset = () => {
    setFilter('all');
    setSearch('');
    setPage(1);
  };

  return {
    filter, setFilter,
    search, setSearch,
    page, setPage,
    pageSize,
    filteredTasks, pageTasks, totalPages,
    counts,
    reset,
  };
}
