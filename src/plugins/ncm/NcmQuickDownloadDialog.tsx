import { useEffect, useRef, useState } from 'react';
import type { NcmTracksDownloadResult } from './download';
import {
  confirmNcmQuickDownload,
  createLatestRequestGate,
  loadNcmDownloadPreview,
  previewSummary,
  previewTrackLabels,
  quickDownloadResultMessage,
} from './quickDownload';
import { useNcmAuth } from './NcmAuthContext';

type NcmDownloadPreview = Awaited<ReturnType<typeof loadNcmDownloadPreview>>;

interface NcmQuickDownloadDialogProps {
  open: boolean;
  initialUrl: string;
  loggedIn?: boolean;
  validateLogin?: () => Promise<boolean>;
  onClose: () => void;
  onUrlSaved: (url: string) => void;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export default function NcmQuickDownloadDialog({
  open,
  initialUrl,
  loggedIn: loggedInProp,
  validateLogin: validateLoginProp,
  onClose,
  onUrlSaved,
}: NcmQuickDownloadDialogProps) {
  const { logged: loggedFromAuth, validateForDownload } = useNcmAuth();
  const loggedIn = loggedInProp ?? loggedFromAuth;
  const validateLogin = validateLoginProp ?? validateForDownload;
  const [url, setUrl] = useState(initialUrl);
  const [level, setLevel] = useState('exhigh');
  const [preview, setPreview] = useState<NcmDownloadPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [downloadResult, setDownloadResult] = useState<NcmTracksDownloadResult | null>(null);
  const previewRequestGate = useRef(createLatestRequestGate());

  useEffect(() => {
    previewRequestGate.current.invalidate();
    if (!open) return;
    setUrl(initialUrl);
    setLevel('exhigh');
    setPreview(null);
    setParsing(false);
    setDownloading(false);
    setFeedback('');
    setDownloadResult(null);
  }, [initialUrl, open]);

  if (!open) return null;

  const parsePreview = async () => {
    const trimmedUrl = url.trim();
    const isCurrentRequest = previewRequestGate.current.begin();
    setParsing(true);
    setPreview(null);
    setFeedback('');
    setDownloadResult(null);
    try {
      const nextPreview = await loadNcmDownloadPreview(trimmedUrl);
      if (!isCurrentRequest()) return;
      setPreview(nextPreview);
      onUrlSaved(trimmedUrl);
    } catch (error) {
      if (!isCurrentRequest()) return;
      setFeedback(`解析失败：${errorMessage(error)}`);
    } finally {
      if (isCurrentRequest()) setParsing(false);
    }
  };

  const confirmDownload = async () => {
    if (downloading) return;
    if (!preview) {
      setFeedback('请先解析待下载歌曲');
      return;
    }
    if (preview.pending.length === 0) {
      setFeedback('没有待下载歌曲');
      return;
    }

    setDownloading(true);
    setFeedback('');
    setDownloadResult(null);
    try {
      const confirmation = await confirmNcmQuickDownload({
        loggedIn,
        url,
        pending: preview.pending,
        level,
        validateLogin,
        onUrlSaved,
      });

      if (confirmation.status === 'logged-out') {
        setFeedback('请先扫码登录后再下载');
        return;
      }
      if (confirmation.status === 'invalid-url') {
        setFeedback('仅支持网易云音乐歌单分享链接');
        return;
      }
      if (confirmation.status === 'login-expired') {
        setFeedback('登录已失效，请重新登录后再下载');
        return;
      }
      if (confirmation.status === 'no-pending') {
        setFeedback('没有待下载歌曲');
        return;
      }

      setDownloadResult(confirmation.result);
      setFeedback(quickDownloadResultMessage(confirmation.result));
      setPreview(null);
    } catch (error) {
      setFeedback(`下载未完成：${errorMessage(error)}`);
    } finally {
      setDownloading(false);
    }
  };

  const changeUrl = (nextUrl: string) => {
    previewRequestGate.current.invalidate();
    setUrl(nextUrl);
    setPreview(null);
    setFeedback('');
    setDownloadResult(null);
  };

  const close = () => {
    if (downloading) return;
    previewRequestGate.current.invalidate();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="网易云快捷下载"
      onClick={close}
      style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0, 0, 0, 0.4)' }}
    >
      <section
        onClick={(event) => event.stopPropagation()}
        style={{ width: 'min(560px, 100%)', maxHeight: 'calc(100vh - 32px)', overflow: 'auto', borderRadius: 12, padding: 20, background: '#fff', boxShadow: '0 16px 48px rgba(0, 0, 0, 0.22)' }}
      >
        <h2 style={{ marginTop: 0 }}>解析歌单并下载未下载歌曲</h2>

        <label style={{ display: 'grid', gap: 6 }}>
          歌单分享链接
          <input
            value={url}
            onChange={(event) => changeUrl(event.target.value)}
            disabled={parsing || downloading}
            placeholder="粘贴网易云歌单分享链接"
          />
        </label>

        <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          下载音质
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            disabled={parsing || downloading}
          >
            <option value="standard">标准（128k）</option>
            <option value="higher">较高（192k）</option>
            <option value="exhigh">极高（320k）</option>
            <option value="lossless">无损 FLAC</option>
            <option value="hires">Hi-Res</option>
          </select>
        </label>

        <button
          onClick={() => void parsePreview()}
          disabled={parsing || downloading || url.trim().length === 0}
          style={{ marginTop: 12 }}
        >
          {parsing ? '解析中…' : '解析待下载歌曲'}
        </button>

        {preview && (
          <div style={{ marginTop: 16 }}>
            <strong>{preview.info.name}</strong>
            <p>{previewSummary(preview.pending)}</p>
            {preview.pending.length > 0 && (
              <ol>
                {previewTrackLabels(preview.pending).map((label, index) => (
                  <li key={preview.pending[index].id}>{label}</li>
                ))}
              </ol>
            )}
            {preview.pending.length > 10 && <p>仅展示前 10 首。</p>}
          </div>
        )}

        {feedback && (
          <p role="status" style={{ color: downloadResult?.failures.length || downloadResult?.callbackFailures.length ? '#b45309' : '#333' }}>
            {feedback}
          </p>
        )}

        {downloadResult && (downloadResult.failures.length > 0 || downloadResult.callbackFailures.length > 0) && (
          <ul style={{ color: '#b45309' }}>
            {downloadResult.failures.slice(0, 10).map(({ track, error }) => (
              <li key={`download-${track.id}`}>{track.name}：下载失败（{error}）</li>
            ))}
            {downloadResult.callbackFailures.slice(0, 10).map(({ track, error }) => (
              <li key={`record-${track.id}`}>{track.name}：已下载但记录失败（{error}）</li>
            ))}
          </ul>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={close} disabled={downloading}>取消</button>
          <button
            onClick={() => void confirmDownload()}
            disabled={!preview || preview.pending.length === 0 || parsing || downloading}
          >
            {downloading ? '下载中…' : '确认下载'}
          </button>
        </div>
      </section>
    </div>
  );
}
