import { useEffect, useRef, useState } from 'react';
import type { NcmTracksDownloadResult } from './downloadQueue';
import { confirmNcmQuickDownload, createLatestRequestGate, loadNcmDownloadPreview, quickDownloadResultMessage } from './quickDownload';

type Preview = Awaited<ReturnType<typeof loadNcmDownloadPreview>>;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export function useQuickDownload({ open, initialUrl, loggedIn, validateLogin, onClose, onUrlSaved }: { open: boolean; initialUrl: string; loggedIn: boolean; validateLogin: () => Promise<boolean>; onClose: () => void; onUrlSaved: (url: string) => void }) {
  const [url, setUrl] = useState(initialUrl); const [level, setLevel] = useState('exhigh'); const [preview, setPreview] = useState<Preview | null>(null); const [parsing, setParsing] = useState(false); const [downloading, setDownloading] = useState(false); const [feedback, setFeedback] = useState(''); const [downloadResult, setDownloadResult] = useState<NcmTracksDownloadResult | null>(null); const gate = useRef(createLatestRequestGate());
  useEffect(() => { gate.current.invalidate(); if (!open) return; setUrl(initialUrl); setLevel('exhigh'); setPreview(null); setParsing(false); setDownloading(false); setFeedback(''); setDownloadResult(null); }, [initialUrl, open]);
  const parsePreview = async () => { const trimmedUrl = url.trim(); const current = gate.current.begin(); setParsing(true); setPreview(null); setFeedback(''); setDownloadResult(null); try { const nextPreview = await loadNcmDownloadPreview(trimmedUrl); if (!current()) return; setPreview(nextPreview); onUrlSaved(trimmedUrl); } catch (error) { if (current()) setFeedback(`解析失败：${errorMessage(error)}`); } finally { if (current()) setParsing(false); } };
  const confirmDownload = async () => { if (downloading) return; if (!preview) { setFeedback('请先解析待下载歌曲'); return; } if (preview.pending.length === 0) { setFeedback('没有待下载歌曲'); return; } setDownloading(true); setFeedback(''); setDownloadResult(null); try { const result = await confirmNcmQuickDownload({ loggedIn, url, pending: preview.pending, level, validateLogin, onUrlSaved }); if (result.status === 'logged-out') setFeedback('请先扫码登录后再下载'); else if (result.status === 'invalid-url') setFeedback('仅支持网易云音乐歌单分享链接'); else if (result.status === 'login-expired') setFeedback('登录已失效，请重新登录后再下载'); else if (result.status === 'no-pending') setFeedback('没有待下载歌曲'); else { setDownloadResult(result.result); setFeedback(quickDownloadResultMessage(result.result)); setPreview(null); } } catch (error) { setFeedback(`下载未完成：${errorMessage(error)}`); } finally { setDownloading(false); } };
  const changeUrl = (nextUrl: string) => { gate.current.invalidate(); setUrl(nextUrl); setPreview(null); setFeedback(''); setDownloadResult(null); };
  const close = () => { if (downloading) return; gate.current.invalidate(); onClose(); };
  return { url, level, setLevel, preview, parsing, downloading, feedback, downloadResult, parsePreview, confirmDownload, changeUrl, close };
}
