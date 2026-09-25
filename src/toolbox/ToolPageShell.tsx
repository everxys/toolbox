import type { ReactNode } from 'react';

export default function ToolPageShell({ children, onBackHome, title }: { children: ReactNode; onBackHome: () => void; title: string }) {
  return (
    <div style={{ paddingTop: 12 }}>
      <button
        onClick={onBackHome}
        aria-label="回到工具首页"
        title="回到首页"
        style={{
          position: 'fixed',
          top: 'max(14px, env(safe-area-inset-top))',
          left: 'max(14px, env(safe-area-inset-left))',
          zIndex: 40,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          minHeight: 38,
          padding: '0 14px 0 11px',
          border: '1px solid rgba(37, 99, 235, .22)',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, .94)',
          color: '#1d4ed8',
          boxShadow: '0 5px 18px rgba(15, 23, 42, .16)',
          backdropFilter: 'blur(10px)',
          cursor: 'pointer',
          fontWeight: 650,
          transition: 'transform 150ms ease, box-shadow 150ms ease, background 150ms ease',
        }}
        onMouseEnter={(event) => { event.currentTarget.style.transform = 'translateY(-2px)'; event.currentTarget.style.boxShadow = '0 8px 24px rgba(15, 23, 42, .22)'; event.currentTarget.style.background = '#eff6ff'; }}
        onMouseLeave={(event) => { event.currentTarget.style.transform = ''; event.currentTarget.style.boxShadow = '0 5px 18px rgba(15, 23, 42, .16)'; event.currentTarget.style.background = 'rgba(255, 255, 255, .94)'; }}
      >
        <span aria-hidden="true" style={{ fontSize: 19, lineHeight: 1 }}>←</span>
        <span>回到首页</span>
      </button>
      <header style={{ minHeight: 62, display: 'grid', placeItems: 'center', padding: '8px 80px', borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.35, textAlign: 'center' }}>{title}</h1>
      </header>
      {children}
    </div>
  );
}
