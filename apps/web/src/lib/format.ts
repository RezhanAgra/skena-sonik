export const rupiah = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID');
export const pad = (n: number) => String(n).padStart(2, '0');
