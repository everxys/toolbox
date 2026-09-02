import { useRef, useState } from 'react';
import { markDownloaded, markDownloadedMany } from './store';
import { pool } from './utils';
import { downloadNcmTrack } from './download';
import type { DownloadTask } from './types';
import { useNcmAuth } from './NcmAuthContext';

export function useDownloadActions(
  tasks: DownloadTask[],
  setTasks: React.Dispatch<React.SetStateAction<DownloadTask[]>>,
  level: string,
  concurrency = 3,
) {
  const { logged, validateForDownload } = useNcmAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const downloadAllUndownloaded = async () => {
    setFeedback(null);
    if (!(await validateForDownload())) {
      setFeedback('登录已失效，请重新登录后再下载');
      return;
    }
    const pending = tasks.filter((t) => t.status === 'pending');
    if (pending.length === 0) {
      setFeedback('已全部下载');
      return;
    }
    setIsDownloading(true);
    cancelRef.current = false;
    const update = (id: number, patch: Partial<DownloadTask>) => {
      setTasks((prev) => prev.map((p) => (p.track.id === id ? { ...p, ...patch } : p)));
    };
    await pool(pending, concurrency, async (task) => {
      if (cancelRef.current) {
        update(task.track.id, { status: 'pending' });
        return;
      }
      update(task.track.id, { status: 'downloading', progress: 10 });
      let retries = 3;
      while (retries-- > 0) {
        try {
          const r = await downloadNcmTrack(task.track, level);
          update(task.track.id, { status: 'done', progress: 100, filePath: r.filePath });
          void markDownloaded(task.track.id);
          return;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (retries === 0) update(task.track.id, { status: 'error', error: msg });
          else await new Promise((r) => setTimeout(r, 500 * (3 - retries)));
        }
      }
    });
    setIsDownloading(false);
  };

  const downloadTrack = async (task: DownloadTask) => {
    setFeedback(null);
    if (!(await validateForDownload())) {
      setFeedback('登录已失效，请重新登录后再下载');
      return;
    }
    setTasks((prev) => prev.map((p) => (p.track.id === task.track.id ? { ...p, status: 'downloading' } : p)));
    try {
      const result = await downloadNcmTrack(task.track, level);
      setTasks((prev) =>
        prev.map((p) =>
          p.track.id === task.track.id ? { ...p, status: 'done', progress: 100, filePath: result.filePath } : p,
        ),
      );
      void markDownloaded(task.track.id);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setTasks((prev) =>
        prev.map((p) => (p.track.id === task.track.id ? { ...p, status: 'error', error: msg } : p)),
      );
    }
  };

  const markFromThisTrack = (id: number) => {
    const start = tasks.findIndex((task) => task.track.id === id);
    if (start < 0) return;
    const ids = tasks.slice(start).map((task) => task.track.id);
    void markDownloadedMany(ids);
    setTasks((previous) =>
      previous.map((task, index) =>
        index >= start ? { ...task, status: 'done', progress: 100, error: undefined } : task,
      ),
    );
  };

  return {
    logged,
    isDownloading,
    feedback,
    setFeedback,
    cancelRef,
    downloadAllUndownloaded,
    downloadTrack,
    markFromThisTrack,
  };
}
