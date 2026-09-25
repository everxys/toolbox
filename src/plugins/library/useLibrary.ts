import { useEffect, useState } from 'react';
import { deleteBook, loadCachedLibrary, openBook, renameBook, scanLibrary, setReadStatus, updateMetadata } from './api';
import type { LibraryBook } from './types';

export function useLibrary() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => { setLoading(true); setError(''); try { setBooks(await scanLibrary()); } catch (reason) { setError(String(reason)); } finally { setLoading(false); } };
  useEffect(() => { void loadCachedLibrary().then((cached) => { if (cached.length > 0) setBooks(cached); }).catch(() => undefined).finally(() => void refresh()); }, []);
  const saveMetadata = async (book: LibraryBook, patch: Partial<Pick<LibraryBook, 'priority' | 'bookType' | 'description'>>) => { const next = { ...book, ...patch }; setBooks((list) => list.map((item) => item.path === book.path ? next : item)); try { await updateMetadata(next); return true; } catch (reason) { setBooks((list) => list.map((item) => item.path === book.path ? book : item)); setError(String(reason)); return false; } };
  const setBookRead = async (book: LibraryBook) => { if (!confirm(`确定将《${book.title}》标记为${book.read ? '未读' : '已读'}吗？快捷方式将移动到对应目录。`)) return; try { await setReadStatus(book.path, !book.read); await refresh(); } catch (reason) { setError(String(reason)); } };
  const rename = async (book: LibraryBook, title: string) => { try { await renameBook(book.path, title); } catch (reason) { setError(String(reason)); } finally { await refresh(); } };
  const remove = async (book: LibraryBook) => { try { await deleteBook(book.path); } catch (reason) { setError(String(reason)); } finally { await refresh(); } };
  const open = async (book: LibraryBook) => { try { await openBook(book.path); } catch (reason) { setError(String(reason)); } };
  return { books, loading, error, setError, refresh, saveMetadata, setBookRead, rename, remove, open };
}
