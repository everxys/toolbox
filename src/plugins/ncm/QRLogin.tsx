import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { qrCreate, qrCheck } from './api';

export default function QRLogin({ onLogin }: { onLogin: (cookie: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unikey, setUnikey] = useState('');
  const [status, setStatus] = useState('加载中...');
  const timerRef = useRef<number | null>(null);

  const create = async () => {
    const { unikey, qrUrl } = await qrCreate();
    setUnikey(unikey);
    if (canvasRef.current) {
      await QRCode.toCanvas(canvasRef.current, qrUrl, { width: 180 });
    }
    setStatus('请用网易云音乐 App 扫码');
    // 轮询，借鉴 Binaryify 的 803 成功逻辑
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(async () => {
      const r = await qrCheck(unikey);
      if (r.code === 800) {
        setStatus('二维码已过期，点击刷新');
        window.clearInterval(timerRef.current!);
      } else if (r.code === 801) setStatus('待扫码');
      else if (r.code === 802) setStatus('待确认');
      else if (r.code === 803) {
        setStatus('登录成功');
        window.clearInterval(timerRef.current!);
        onLogin(r.cookie || '');
      }
    }, 2000) as unknown as number;
  };

  useEffect(() => {
    create();
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: 16, border: '1px solid #eee', borderRadius: 12 }}>
      <h3>扫码登录（借鉴 open-orpheus cookie 注入）</h3>
      <canvas ref={canvasRef} />
      <p>{status}</p>
      <button onClick={create}>刷新二维码</button>
      <p style={{ fontSize: 12, color: '#888' }}>unikey: {unikey.slice(0, 8)}... 轮询 /api/login/qrcode/check</p>
    </div>
  );
}
