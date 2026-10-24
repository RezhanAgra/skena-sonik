// Gelang yang dicetak. Ukuran dalam milimeter supaya pas di gelang thermal 25,4 × 254 mm.
import type { WristbandView } from '../../lib/types';

// warna gelang per jenis tiket. Printer thermal hanya mencetak hitam,
// jadi warna dipakai sebagai petunjuk stok gelang yang harus dipasang di printer.
export const BAND_COLOR: Record<string, { name: string; hex: string; ink: string }> = {
  'two-day': { name: 'Merah', hex: '#e11d2a', ink: '#ffffff' },
  daily: { name: 'Kuning', hex: '#facc15', ink: '#111111' },
  pit: { name: 'Ungu', hex: '#7c3aed', ink: '#ffffff' },
  'early-bird': { name: 'Biru', hex: '#2563eb', ink: '#ffffff' }
};
const fallback = { name: 'Putih', hex: '#e5e5e5', ink: '#111111' };
export const bandColor = (tier: string) => BAND_COLOR[tier] ?? fallback;

export default function WristbandPrint({ band, color }: { band: WristbandView; color: boolean }) {
  const c = bandColor(band.tierSlug);
  const block = color ? { background: c.hex, color: c.ink } : { background: '#000', color: '#fff' };

  return (
    <div style={{
      width: '254mm', height: '25.4mm', display: 'flex', alignItems: 'stretch', background: '#fff', color: '#000',
      fontFamily: "'Archivo', 'Helvetica Neue', Arial, sans-serif", boxSizing: 'border-box', overflow: 'hidden',
      border: color ? '0.3mm dashed #bbb' : 'none'
    }}>
      {/* ekor gelang (bagian yang masuk ke pengait), dikosongkan */}
      <div style={{ width: '40mm', flex: 'none' }} />

      <div style={{ ...block, width: '24mm', flex: 'none', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '1mm' }}>
        <div style={{ fontFamily: "'Pirata One', Georgia, serif", fontSize: '4.2mm', lineHeight: 1, textTransform: 'uppercase' }}>Skena<br />Sonik</div>
      </div>

      <div style={{ flex: 1, minWidth: 0, padding: '1.6mm 3mm', display: 'grid', alignContent: 'center', gap: '0.6mm' }}>
        <div style={{ fontSize: '5.2mm', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {band.tierName}
        </div>
        <div style={{ fontSize: '3.1mm', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{band.holderName}</div>
        <div style={{ fontSize: '2.6mm' }}>Berlaku: <b>{band.validLabel}</b> · {band.validDates}</div>
      </div>

      <div style={{ width: '23.4mm', flex: 'none', display: 'grid', placeItems: 'center', padding: '1mm' }}>
        {/* SVG QR dibuat oleh API sendiri, aman disisipkan */}
        <div style={{ width: '21.4mm', height: '21.4mm' }} className="[&>svg]:block [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: band.qrSvg }} />
      </div>

      <div style={{ width: '30mm', flex: 'none', display: 'grid', alignContent: 'center', gap: '0.8mm', padding: '0 2mm', fontFamily: "'JetBrains Mono', Menlo, monospace" }}>
        <div style={{ fontSize: '3mm', fontWeight: 700, letterSpacing: '0.2mm' }}>{band.code}</div>
        <div style={{ fontSize: '2.2mm' }}>Skena Sonik 2026</div>
        <div style={{ fontSize: '2mm' }}>Tidak bisa dipindahtangankan</div>
      </div>

      {/* area pengait / kancing gelang */}
      <div style={{ width: '20mm', flex: 'none' }} />
    </div>
  );
}
