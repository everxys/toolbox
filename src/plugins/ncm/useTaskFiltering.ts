import { useMemo, useState } from 'react';
import type { DownloadTask } from './types';
import { filterTasks, taskCounts, taskPage, type TaskFilter } from './taskSelectors';

export type FilterType = TaskFilter;

export function useTaskFiltering(tasks: DownloadTask[], pageSize = 100) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filteredTasks = useMemo(() => filterTasks(tasks, filter, search), [tasks, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const pageTasks = useMemo(
    () => taskPage(filteredTasks, page, pageSize),
    [filteredTasks, page, pageSize],
  );

  const counts = useMemo(() => taskCounts(tasks), [tasks]);

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
