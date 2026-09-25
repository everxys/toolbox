import { invoke } from '@tauri-apps/api/core';
import type { ImportResult, LibraryBook } from './types';

export const scanLibrary = () => invoke<LibraryBook[]>('library_scan');
export const loadCachedLibrary = () => invoke<LibraryBook[]>('library_cached');
export const updateMetadata = (update: Pick<LibraryBook, 'path' | 'priority' | 'bookType' | 'description'>) =>
  invoke<void>('library_update_metadata', { update });
export const setReadStatus = (path: string, read: boolean) => invoke<void>('library_set_read_status', { path, read });
export const openBook = (path: string) => invoke<void>('library_open_book', { path });
export const renameBook = (path: string, title: string) => invoke<void>('library_rename_book', { path, title });
export const deleteBook = (path: string) => invoke<void>('library_delete_book', { path });
export const importBooks = (paths: string[], read: boolean) => invoke<ImportResult[]>('library_import', { paths, read });
