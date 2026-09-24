import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface DatabaseLocation {
  directory: string;
  databasePath: string;
  isDefault: boolean;
}

interface DatabaseSwitchResult {
  location: DatabaseLocation;
  backupPath: string | null;
}

const databasePathIn = (directory: string) => `${directory.replace(/[\\/]+$/, '')}\\toolbox.db`;

export default function SettingsPage() {
  const [location, setLocation] = useState<DatabaseLocation | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      setLocation(await invoke<DatabaseLocation>('database_location'));
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
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
    if (!selected.toLowerCase().endsWith('toolbox.db')) {
      setMessage('请选择名为 toolbox.db 的数据库文件。');
      return;
    }
    if (!confirm(`使用已有数据库：\n${selected}\n\n当前数据库会先备份，然后 Toolbox 将切换到这个文件。继续吗？`)) return;
    setMigrating(true);
    try {
      const result = await invoke<DatabaseSwitchResult>('database_use_existing', { path: selected });
      setLocation(result.location);
      setSelectedDirectory(null);
      setMessage(result.backupPath ? `已切换到已有数据库。当前数据库已备份到：\n${result.backupPath}` : '已切换到已有数据库。');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setMigrating(false);
    }
  };

  const migrate = async () => {
    if (!selectedDirectory || migrating) return;
    const target = databasePathIn(selectedDirectory);
    if (!confirm(`将 Toolbox 数据库迁移到：\n${target}\n\n原数据库会保留，不会被删除。继续吗？`)) return;
    setMigrating(true);
    setMessage('');
    try {
      const next = await invoke<DatabaseLocation>('database_migrate', { directory: selectedDirectory });
      setLocation(next);
      setSelectedDirectory(null);
      setMessage('数据库已迁移。');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setMigrating(false);
    }
  };

  return (
    <main style={{ padding: '24px 0', maxWidth: 760 }}>
      <h2 style={{ marginBottom: 6 }}>设置</h2>
      <p style={{ color: '#5d6673', marginTop: 0 }}>管理 Toolbox 的本地数据保存位置。</p>

      <section style={panel} aria-labelledby="database-heading">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h3 id="database-heading" style={{ margin: 0 }}>数据库存储</h3>
          {location && <span style={{ ...badge, background: location.isDefault ? '#e8f0fe' : '#e7f6ec', color: location.isDefault ? '#2456a6' : '#21663b' }}>{location.isDefault ? '默认位置' : '自定义位置'}</span>}
        </div>
        {loading ? <p>正在读取当前设置…</p> : location && <>
          <p style={label}>当前数据库文件</p>
          <code style={pathBox}>{location.databasePath}</code>
          <p style={{ color: '#5d6673', lineHeight: 1.6 }}>数据库保存书籍的标记与说明、Skill 分类和自定义说明，以及音乐下载记录。选择新文件夹后，Toolbox 将在其中固定使用 <code>toolbox.db</code>。</p>
        </>}

        <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 20, paddingTop: 20 }}>
          <p style={label}>新的保存文件夹</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => void chooseDirectory()} style={secondaryButton}>选择文件夹</button>
            <span style={{ color: selectedDirectory ? '#1f2937' : '#6b7280', overflowWrap: 'anywhere' }}>{selectedDirectory ?? '尚未选择'}</span>
          </div>
          {selectedDirectory && <p style={{ marginBottom: 0, color: '#5d6673' }}>迁移目标：<code>{databasePathIn(selectedDirectory)}</code></p>}
          <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button disabled={!selectedDirectory || migrating} onClick={() => void migrate()} style={{ ...primaryButton, opacity: !selectedDirectory || migrating ? 0.55 : 1 }}>{migrating ? '正在迁移…' : '迁移到此文件夹'}</button>
            <span style={{ color: '#5d6673', fontSize: 13 }}>不会覆盖目标中已有的 <code>toolbox.db</code>，原文件也会保留。</span>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 20, paddingTop: 20 }}>
          <p style={label}>已有数据库</p>
          <p style={{ color: '#5d6673', lineHeight: 1.6, marginTop: 0 }}>在另一台电脑上备份过数据库时，选择其中的 <code>toolbox.db</code> 即可直接使用。系统会先校验数据库，并备份当前数据库后再切换。</p>
          <button disabled={migrating} onClick={() => void useExisting()} style={{ ...secondaryButton, opacity: migrating ? 0.55 : 1 }}>使用已有数据库</button>
        </div>
        {message && <p role="status" style={{ marginTop: 18, padding: 12, borderRadius: 8, background: message.startsWith('数据库已') ? '#eaf7ee' : '#fff1f2', color: message.startsWith('数据库已') ? '#21663b' : '#a61b36', whiteSpace: 'pre-wrap' }}>{message}</p>}
      </section>
    </main>
  );
}

const panel = { border: '1px solid #d8dee8', borderRadius: 12, padding: 24, background: '#fff', boxShadow: '0 4px 16px rgba(31, 41, 55, 0.06)' };
const label = { color: '#4b5563', fontSize: 13, fontWeight: 600, marginBottom: 6 };
const pathBox = { display: 'block', padding: '10px 12px', borderRadius: 8, background: '#f4f6f8', color: '#172033', overflowWrap: 'anywhere' as const, lineHeight: 1.5 };
const badge = { borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 600 };
const primaryButton = { border: 0, borderRadius: 8, padding: '9px 14px', background: '#244a9a', color: '#fff', fontWeight: 600, cursor: 'pointer' };
const secondaryButton = { border: '1px solid #b8c2d1', borderRadius: 8, padding: '8px 12px', background: '#fff', color: '#172033', cursor: 'pointer' };
