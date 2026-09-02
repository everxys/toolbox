import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdaterState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'up-to-date' }
  | { status: 'available'; version: string; notes?: string }
  | { status: 'downloading'; version: string }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string };

export async function checkForUpdate(): Promise<UpdaterState> {
  try {
    const update = await check();
    if (!update) return { status: 'up-to-date' };
    return { status: 'available', version: update.version, notes: update.body };
  } catch (e) {
    const msg = String(e);
    if (msg.includes('fallback platforms') || msg.includes('not found in the response platforms')) {
      return { status: 'error', message: 'Windows 安装包构建中，请稍后重试' };
    }
    throw e;
  }
}

export async function downloadAndInstall(onEvent?: (downloaded: number, total?: number) => void): Promise<void> {
  const update = await check();
  if (!update) throw new Error('暂无可用更新');
  let downloaded = 0;
  let contentLength: number | undefined;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        contentLength = event.data.contentLength;
        onEvent?.(0, contentLength);
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        onEvent?.(downloaded, contentLength);
        break;
      case 'Finished':
        break;
    }
  });
  await relaunch();
}
