import { useEffect, useState } from 'react';
import { isPrimaryToolClick, runQuickAction } from './home';
import { toolDefinitions, type ToolDefinition, type ToolId } from './tools';

type QuickActionId = ToolDefinition['quickActions'][number]['id'];

interface HomePageProps {
  onOpenTool: (toolId: ToolId) => void;
  onQuickAction: (toolId: ToolId, actionId: QuickActionId) => void;
}

interface ContextMenuState {
  tool: ToolDefinition;
  x: number;
  y: number;
}

export default function HomePage({ onOpenTool, onQuickAction }: HomePageProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  return (
    <main style={{ padding: '24px 0' }}>
      <h2>工具首页</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {toolDefinitions.map((tool) => (
          <article
            key={tool.id}
            role="button"
            tabIndex={0}
            aria-label={`打开${tool.name}`}
            onClick={(event) => {
              if (isPrimaryToolClick(event.button)) onOpenTool(tool.id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenTool(tool.id);
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ tool, x: event.clientX, y: event.clientY });
            }}
            style={{ cursor: 'pointer', border: '1px solid #ddd', borderRadius: 12, padding: 20, background: '#fff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}
          >
            <div style={{ fontSize: 32 }} aria-hidden="true">{tool.icon}</div>
            <h3 style={{ marginBottom: 8 }}>{tool.name}</h3>
            <p style={{ margin: 0, color: '#666' }}>{tool.description}</p>
          </article>
        ))}
      </div>

      {contextMenu && (
        <div
          aria-label="工具快捷菜单遮罩"
          onClick={() => setContextMenu(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 20 }}
        >
          <div
            role="menu"
            aria-label={`${contextMenu.tool.name}快捷操作`}
            onClick={(event) => event.stopPropagation()}
            style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, minWidth: 220, padding: 6, border: '1px solid #ddd', borderRadius: 8, background: '#fff', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)' }}
          >
            {contextMenu.tool.quickActions.map((action) => (
              <button
                key={action.id}
                role="menuitem"
                onClick={() => {
                  runQuickAction(
                    () => setContextMenu(null),
                    () => onQuickAction(contextMenu.tool.id, action.id),
                  );
                }}
                style={{ display: 'block', width: '100%', border: 0, borderRadius: 4, padding: '8px 10px', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
