import { useState, type FormEvent } from 'react';
import { bookFormat } from './tree';
import type { LibraryBook } from './types';

const dialogBackdrop = { position: 'fixed' as const, inset: 0, zIndex: 30, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,.35)' };
const dialogPanel = { width: 'min(480px, 100%)', boxSizing: 'border-box' as const, background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 16px 48px rgba(0,0,0,.22)' };
const dialogActions = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 };

export function RenameDialog({ book, onClose, onConfirm }: { book: LibraryBook; onClose: () => void; onConfirm: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState(book.title); const [saving, setSaving] = useState(false); const format = bookFormat(book); const suffix = format === '无扩展名' ? '该文件没有扩展名。' : `将保留 .${format} 扩展名。`;
  const submit = async (event: FormEvent) => { event.preventDefault(); const next = title.trim(); if (!next || next === book.title) return; setSaving(true); await onConfirm(next); setSaving(false); };
  return <div role="dialog" aria-modal="true" aria-label="修改图书名称" style={dialogBackdrop} onMouseDown={onClose}><form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} style={dialogPanel}><h3 style={{ marginTop: 0 }}>修改图书名称</h3><p style={{ color: '#666' }}>只修改名称，{suffix}</p><input aria-label="新图书名称" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} /><div style={dialogActions}><button type="button" onClick={onClose} disabled={saving}>取消</button><button type="submit" disabled={saving || !title.trim() || title.trim() === book.title}>{saving ? '修改中…' : '确认修改'}</button></div></form></div>;
}

export function DeleteDialog({ book, onClose, onConfirm }: { book: LibraryBook; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false); const submit = async () => { setDeleting(true); await onConfirm(); setDeleting(false); };
  return <div role="dialog" aria-modal="true" aria-label="确认删除图书" style={dialogBackdrop} onMouseDown={onClose}><div onMouseDown={(event) => event.stopPropagation()} style={dialogPanel}><h3 style={{ marginTop: 0 }}>删除图书？</h3><p>确定删除《{book.title}》吗？这会永久删除 Library 原书、read/unread 快捷方式及其元数据。</p><div style={dialogActions}><button onClick={onClose} disabled={deleting}>取消</button><button onClick={() => void submit()} disabled={deleting} style={{ color: '#b00020' }}>{deleting ? '删除中…' : '删除'}</button></div></div></div>;
}
