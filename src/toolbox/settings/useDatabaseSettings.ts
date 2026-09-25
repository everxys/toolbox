import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { getDatabaseLocation, migrateDatabase, useExistingDatabase, type DatabaseLocation } from './api';

export const databasePathIn = (directory: string) => `${directory.replace(/[\\/]+$/, '')}\\toolbox.db`;

export function useDatabaseSettings() {
  const [location, setLocation] = useState<DatabaseLocation | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    setLoading(true);
    try { setLocation(await getDatabaseLocation()); }
    catch (error) { setMessage(String(error)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const chooseDirectory = async () => {
    setMessage('');
    const selected = await open({ directory: true, multiple: false, title: '选择 Toolbox 数据库保存文件夹' });
    if (typeof selected === 'string') setSelectedDirectory(selected);
  };
  const useExisting = async () => {
    setMessage('');
    const selected = await open({ directory: false, multiple: false, title: '选择已有的 toolbox.db', filters: [{ name: 'Toolbox 数据库', extensions: ['db'] }] });
    if (typeof selected !== 'string') return;
    if (!selected.toLowerCase().endsWith('toolbox.db')) { setMessage('请选择名为 toolbox.db 的数据库文件。'); return; }
    if (!confirm(`使用已有数据库：\n${selected}\n\n当前数据库会先备份，然后 Toolbox 将切换到这个文件。继续吗？`)) return;
    setMigrating(true);
    try {
      const result = await useExistingDatabase(selected);
      setLocation(result.location); setSelectedDirectory(null);
      setMessage(result.backupPath ? `已切换到已有数据库。当前数据库已备份到：\n${result.backupPath}` : '已切换到已有数据库。');
    } catch (error) { setMessage(String(error)); }
    finally { setMigrating(false); }
  };
  const migrate = async () => {
    if (!selectedDirectory || migrating) return;
    const target = databasePathIn(selectedDirectory);
    if (!confirm(`将 Toolbox 数据库迁移到：\n${target}\n\n原数据库会保留，不会被删除。继续吗？`)) return;
    setMigrating(true); setMessage('');
    try { setLocation(await migrateDatabase(selectedDirectory)); setSelectedDirectory(null); setMessage('数据库已迁移。'); }
    catch (error) { setMessage(String(error)); }
    finally { setMigrating(false); }
  };
  return { location, selectedDirectory, loading, migrating, message, chooseDirectory, useExisting, migrate };
}
