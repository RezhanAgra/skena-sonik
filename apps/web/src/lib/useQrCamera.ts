// Hook kamera + pembaca QR (jsQR). Dipakai booth penukaran gelang.
import jsQR from 'jsqr';
import { useCallback, useEffect, useRef, useState } from 'react';

const SAME_CODE_COOLDOWN = 4000; // ms: QR yang sama tidak diproses ulang selama ini

export function useQrCamera(onCode: (text: string) => void, paused: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef({ text: '', at: 0 });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [state, setState] = useState<'off' | 'starting' | 'on' | 'error'>('off');
  const [error, setError] = useState('');

  useEffect(() => {
    if (state !== 'on') return;
    let frame = 0, last = 0;
    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      if (t - last < 140 || pausedRef.current) return;
      last = t;
      const video = videoRef.current, canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (!code?.data) return;
      const now = Date.now();
      if (code.data === lastRef.current.text && now - lastRef.current.at < SAME_CODE_COOLDOWN) return;
      lastRef.current = { text: code.data, at: now };
      onCode(code.data);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state, onCode]);

  const start = useCallback(async () => {
    setState('starting');
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState('on');
    } catch (err) {
      setState('error');
      setError((err as Error).name === 'NotAllowedError'
        ? 'Akses kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser.'
        : 'Kamera tidak bisa dibuka. Pastikan halaman dibuka lewat HTTPS dan perangkat punya kamera.');
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setState('off');
  }, []);
  useEffect(() => stop, [stop]);

  return { videoRef, canvasRef, state, error, start, stop };
}
