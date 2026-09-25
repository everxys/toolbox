import { useEffect, useState } from 'react';

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 320);
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);
  if (!visible) return null;
  return <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="返回页面顶部" style={{ position: 'fixed', right: 24, bottom: 'max(56px, env(safe-area-inset-bottom))', zIndex: 20, border: 0, borderRadius: 999, padding: '10px 14px', background: '#2563eb', color: '#fff', boxShadow: '0 4px 14px rgba(0,0,0,.22)', cursor: 'pointer' }}>↑ 返回顶部</button>;
}
