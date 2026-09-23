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
  hasDescription: boolean;
  sort: { field: SortField; direction: 'asc' | 'desc' };
}

export function buildLibraryTree(books: LibraryBook[]): LibraryNode {
  const root: LibraryNode = { kind: 'folder', name: '', key: '', children: [] };
  for (const book of books) {
    const parts = book.relativePath.replace(/\\/g, '/').split('/');
    let current = root;
    for (const part of parts.slice(0, -1)) {
      let child = current.children.find((node) => node.kind === 'folder' && node.name === part);
      if (!child) {
        child = { kind: 'folder', name: part, key: current.key ? `${current.key}/${part}` : part, children: [] };
        current.children.push(child);
      }
      current = child;
    }
    current.children.push({ kind: 'book', name: book.title, key: book.path, children: [], book });
  }
  return root;
}

function matches(book: LibraryBook, filter: LibraryFilter) {
  const haystack = `${book.title}\n${book.bookType}\n${book.description}`.toLowerCase();
  return (!filter.query || haystack.includes(filter.query.toLowerCase()))
    && (filter.priority === null || book.priority === filter.priority)
    && (filter.read === null || book.read === filter.read)
    && (!filter.type || book.bookType === filter.type)
    && (!filter.hasDescription || book.description.trim().length > 0);
}

function value(book: LibraryBook, field: SortField): string | number | boolean {
  if (field === 'title') return book.title;
  if (field === 'priority') return book.priority;
  if (field === 'read') return book.read;
  if (field === 'type') return book.bookType;
  return book.description;
}

export function filterAndSortLibraryTree(node: LibraryNode, filter: LibraryFilter): LibraryNode {
  if (node.kind === 'book') return node.book && matches(node.book, filter) ? node : { ...node, children: [] };
  const folders = node.children
    .filter((child) => child.kind === 'folder')
    .map((child) => filterAndSortLibraryTree(child, filter))
    .filter((child) => child.children.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  const books = node.children
    .filter((child) => child.kind === 'book' && child.book && matches(child.book, filter))
    .sort((a, b) => {
      const left = value(a.book!, filter.sort.field);
      const right = value(b.book!, filter.sort.field);
      const order = typeof left === 'string' ? left.localeCompare(String(right), 'zh-CN') : Number(left) - Number(right);
      return filter.sort.direction === 'asc' ? order : -order;
    });
  return { ...node, children: [...folders, ...books] };
}
