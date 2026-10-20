// Pembayaran simulasi untuk development & demo: tidak ada uang yang berpindah.
// Halaman /pesanan/KODE menampilkan tombol "bayar berhasil / gagal" yang memanggil /api/payments/mock.
import type { PaymentProvider } from './types.ts';

export function createMock(siteUrl: string): PaymentProvider {
  return {
    name: 'mock',
    async createSession(order) {
      return { token: null, redirectUrl: `${siteUrl}/pesanan/${order.code}`, snap: null };
    },
    async fetchStatus() {
      return null;
    }
  };
}
