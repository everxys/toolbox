import { invoke } from '@tauri-apps/api/core';
import type { LibraryBook } from './tree';

export const scanLibrary = () => invoke<LibraryBook[]>('library_scan');
export const updateMetadata = (update: Pick<LibraryBook, 'path' | 'priority' | 'bookType' | 'description'>) =>
  invoke<void>('library_update_metadata', { update });
export const setReadStatus = (path: string, read: boolean) => invoke<void>('library_set_read_status', { path, read });
export const openBook = (path: string) => invoke<void>('library_open_book', { path });
export const deleteBook = (path: string) => invoke<void>('library_delete_book', { path });
export const importBooks = (paths: string[], read: boolean) => invoke<Array<{ source: string; status: string; message: string }>>('library_import', { paths, read });
