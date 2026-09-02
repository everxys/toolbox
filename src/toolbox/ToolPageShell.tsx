import type { ReactNode } from 'react';

export default function ToolPageShell({ children, onBackHome }: { children: ReactNode; onBackHome: () => void }) {
  return (
    <div>
      <div style={{ padding: '8px 16px 0' }}>
        <button onClick={onBackHome}>← 回到首页</button>
      </div>
      {children}
    </div>
  );
}
