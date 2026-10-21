// Kartu e-tiket di halaman pesanan. Tampilannya sama dengan halaman PDF supaya pembeli tidak bingung.
import type { ETicket, OrderView } from '../lib/types';

const DAY_SHORT: Record<number, string> = { 1: 'Sabtu', 2: 'Minggu' };

function Field({ id, en, value, note }: { id: string; en: string; value: string; note?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <span className="text-[0.72rem] text-neutral-500">{id} / <i>{en}</i></span>
      <b className="wrap-anywhere text-[0.95rem] font-bold text-neutral-900">{value}</b>
      {note && <span className="text-xs font-semibold text-red-600">{note}</span>}
    </div>
  );
}

export function pdfUrl(orderCode: string, ticketCode?: string) {
  const base = `/api/orders/${encodeURIComponent(orderCode)}/tickets.pdf`;
  return ticketCode ? `${base}?ticket=${encodeURIComponent(ticketCode)}` : base;
}

export default function ETicketCard({ order, ticket }: { order: OrderView; ticket: ETicket }) {
  const used = ticket.checkIns.map(c => DAY_SHORT[c.day] ?? `Hari ${c.day}`).join(' & ');
  const total = order.tickets.length;

  return (
    <li className="overflow-hidden rounded-[14px] bg-white text-neutral-900 shadow-[0_10px_40px_rgb(0_0_0/0.45)]">
      {/* header */}
      <div className="flex items-center justify-between gap-3 border-b-[3px] border-flare bg-ink px-4 py-3">
        <span className="logo-type text-2xl">Skena Sonik</span>
        <span className="text-xs font-extrabold tracking-widest text-white">E-TIKET</span>
      </div>

      <div className="relative grid gap-4 p-4 sm:p-5">
        {/* watermark */}
        <span aria-hidden="true" className="logo-type pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] text-[5.5rem] whitespace-nowrap opacity-[0.06] [text-shadow:none]">
          Skena Sonik
        </span>

        <img src="/og.png" alt="Poster Skena Sonik Tour 2026" width={1200} height={630}
          className="aspect-[1200/470] w-full rounded-[10px] object-cover object-[center_45%]" loading="lazy" />

        <h3 className="text-[1.15rem] normal-case sm:text-xl">{order.event.name}</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field id="Lokasi" en="Location" value={order.event.location} /></div>
          <Field id="Tanggal" en="Date" value={ticket.dateLabel} />
          <Field id="Waktu" en="Time" value={order.event.hours} />
        </div>

        <hr className="m-0 border-0 border-t border-dashed border-neutral-300" />

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="grid content-start gap-3">
            <Field id="ID Pesanan" en="Order ID" value={order.code} />
            <Field id="Nama" en="Name" value={ticket.holderName} />
            <Field id="Kategori Tiket" en="Ticket Category" value={ticket.tierName.toUpperCase()} note={ticket.access} />
          </div>
          <div className="grid justify-items-center gap-2">
            <span className="text-sm font-bold">Tiket {ticket.seq} dari {total}</span>
            {/* SVG QR dibuat oleh API sendiri (bukan input pengguna), aman disisipkan */}
            <div className="w-[176px] rounded-lg border border-neutral-200 bg-white p-1.5 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
              role="img" aria-label={`QR tiket ${ticket.code}`} dangerouslySetInnerHTML={{ __html: ticket.qrSvg }} />
            <span className="font-mono text-[0.95rem] font-bold tracking-wider">{ticket.code}</span>
            {used && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Sudah masuk: {used}</span>}
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-100 px-4 py-3">
        <span className="text-xs text-neutral-500">Tunjukkan QR di gerbang · 1 QR untuk 1 orang</span>
        <a href={pdfUrl(order.code, ticket.code)} download
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-xs font-extrabold tracking-wide text-white uppercase no-underline hover:bg-flare">
          <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true"><path d="M12 3a1 1 0 011 1v9.6l3.3-3.3a1 1 0 111.4 1.4l-5 5a1 1 0 01-1.4 0l-5-5a1 1 0 111.4-1.4l3.3 3.3V4a1 1 0 011-1zM5 19a1 1 0 100 2h14a1 1 0 100-2H5z" /></svg>
          Download PDF
        </a>
      </div>
    </li>
  );
}
