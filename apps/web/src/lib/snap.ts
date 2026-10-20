// Memuat snap.js Midtrans sekali saja lalu membuka popup pembayaran.
// https://docs.midtrans.com/docs/snap-snap-integration-guide

interface SnapResult { order_id: string; transaction_status: string }
interface SnapCallbacks {
  onSuccess?: (r: SnapResult) => void;
  onPending?: (r: SnapResult) => void;
  onError?: (r: SnapResult) => void;
  onClose?: () => void;
}
declare global {
  interface Window { snap?: { pay: (token: string, callbacks: SnapCallbacks) => void } }
}

let loading: Promise<void> | null = null;

function loadSnap(scriptUrl: string, clientKey: string) {
  if (window.snap) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = scriptUrl;
    s.dataset.clientKey = clientKey;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('Halaman pembayaran gagal dimuat. Cek koneksi lalu coba lagi.'));
    };
    document.head.append(s);
  });
  return loading;
}

/** Buka popup Snap. Resolve dengan hasil akhir: 'success' | 'pending' | 'error' | 'closed'. */
export async function paySnap(token: string, snap: { scriptUrl: string; clientKey: string }) {
  await loadSnap(snap.scriptUrl, snap.clientKey);
  return new Promise<'success' | 'pending' | 'error' | 'closed'>(resolve => {
    window.snap!.pay(token, {
      onSuccess: () => resolve('success'),
      onPending: () => resolve('pending'),
      onError: () => resolve('error'),
      onClose: () => resolve('closed')
    });
  });
}
