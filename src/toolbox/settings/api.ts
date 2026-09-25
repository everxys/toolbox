import { invoke } from '@tauri-apps/api/core';

export interface DatabaseLocation {
  directory: string;
  databasePath: string;
  isDefault: boolean;
}

export interface DatabaseSwitchResult {
  location: DatabaseLocation;
  backupPath: string | null;
}

export const getDatabaseLocation = () => invoke<DatabaseLocation>('database_location');
export const migrateDatabase = (directory: string) => invoke<DatabaseLocation>('database_migrate', { directory });
export const useExistingDatabase = (path: string) => invoke<DatabaseSwitchResult>('database_use_existing', { path });
