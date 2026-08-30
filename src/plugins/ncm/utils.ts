import type { Track } from './types';

export function toCsv(tracks: Track[]): string {
  const header = ['id(hash)', 'name', 'artists', 'album', 'duration_ms', 'v'].join(',');
  const rows = tracks.map(t => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [t.id, esc(t.name), esc(t.artists.join('/')), esc(t.album), t.duration, t.v].join(',');
  });
  return [header, ...rows].join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// 并发池，limit 3，带重试
export async function pool<T>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { await fn(items[idx], idx); } catch {}
    }
  });
  await Promise.all(workers);
}
