export interface LibraryBook {
  path: string;
  relativePath: string;
  title: string;
  priority: number;
  read: boolean;
  bookType: string;
  description: string;
}

export interface LibraryNode {
  kind: 'folder' | 'book';
  name: string;
  key: string;
  children: LibraryNode[];
  book?: LibraryBook;
}

export type SortField = 'title' | 'priority' | 'read' | 'type' | 'description';
export interface LibraryFilter {
  query: string;
  priority: number | null;
  read: boolean | null;
  type: string | null;
  format: string | null;
  hasDescription: boolean;
  sort: { field: SortField; direction: 'asc' | 'desc' } | null;
}

export interface ImportResult { source: string; status: string; message: string }
