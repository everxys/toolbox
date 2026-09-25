import QRLogin from './QRLogin';

interface NcmLoginDialogProps {
  onClose: () => void;
  onLogin: (cookie: string) => Promise<void>;
}

export default function NcmLoginDialog({ onClose, onLogin }: NcmLoginDialogProps) {
  return <div role="dialog" aria-modal="true" aria-label="网易云音乐登录" style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'grid', placeItems: 'center', background: 'rgba(0, 0, 0, 0.35)', padding: 16 }} onClick={onClose}>
    <div style={{ width: 'min(420px, 100%)', background: '#fff', borderRadius: 12, padding: 16 }} onClick={(event) => event.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button aria-label="关闭登录弹窗" onClick={onClose}>关闭</button></div>
      <QRLogin onLogin={onLogin} />
    </div>
  </div>;
}
