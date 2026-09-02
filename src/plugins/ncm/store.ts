import { invoke } from '@tauri-apps/api/core';

export async function loadDownloadedIds(): Promise<Set<number>> {
  return new Set(await invoke<number[]>('ncm_list_downloaded'));
}

export function markDownloaded(id: number) {
  return invoke('ncm_mark_downloaded', { id });
}

export function markDownloadedMany(ids: Iterable<number>) {
  return invoke('ncm_mark_downloaded_many', { ids: [...ids] });
}

export async function isDownloaded(id: number): Promise<boolean> {
  return (await loadDownloadedIds()).has(id);
}
