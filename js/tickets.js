// Pilihan tiket, kalkulator patungan, dan keranjang di header
(() => {
  const { $, rp, reduceMotion } = SS;
  const T = SS.data.TICKETS;
  let squad = 4;
  let cart = 0;

  const selectedTier = () => (document.querySelector('input[name="tier"]:checked') || {}).value || '2d';

  function calculate(tier, people, installment) {
    const squadDeal = tier === '2d' && people >= T.squadMin;
    const unit = squadDeal ? T.squadPrice : T.price[tier];
    const subtotal = unit * people;
    const fee = T.fee * people;
    const total = subtotal + fee;
    const perPerson = total / people;
    return { squadDeal, subtotal, fee, total, perPerson, perMonth: Math.ceil(perPerson / 3), installment };
  }

  function discountNote(tier, bill) {
    if (bill.squadDeal) return `Harga squad aktif: hemat ${rp((T.price['2d'] - T.squadPrice) * squad)}`;
    if (tier === '2d') return `Tambah ${T.squadMin - squad} orang lagi buat harga squad`;
    return '';
  }

  function render() {
    const tier = selectedTier();
    const bill = calculate(tier, squad, $('#inst').checked);

    $('#sq-n').textContent = squad;
    $('#faces').innerHTML = Array.from({ length: squad }, (_, i) => `<span>${i === 0 ? 'U' : i + 1}</span>`).join('');
    $('#b-tier').textContent = `${T.name[tier]} × ${squad}`;
    $('#b-sub').textContent = rp(bill.subtotal);
    $('#b-fee').textContent = rp(bill.fee);
    $('#b-disc').textContent = discountNote(tier, bill);
    $('#b-total').textContent = rp(bill.total);
    $('#b-per-lbl').textContent = bill.installment ? 'Per orang, per bulan (3×)' : 'Per orang';
    $('#b-per').textContent = rp(bill.installment ? bill.perMonth : bill.perPerson);
    $('#b-note').textContent = bill.installment
      ? `Total per orang ${rp(bill.perPerson)}, dibagi 3 bulan tanpa bunga.`
      : 'Dibayar sekali di muka.';
    $('#sq-minus').disabled = squad <= 1;
    $('#sq-plus').disabled = squad >= T.maxSquad;
    $('#checkout-msg').textContent = '';
  }

  function addToCart() {
    cart += squad;
    $('#cart-n').hidden = false;
    $('#cart-n').textContent = cart;
    $('#checkout-msg').textContent = `${squad} tiket masuk keranjang. Ini halaman demo, jadi belum ada pembayaran sungguhan.`;
  }

  SS.tickets = {
    init() {
      $('#sq-minus').addEventListener('click', () => { squad = Math.max(1, squad - 1); render(); });
      $('#sq-plus').addEventListener('click', () => { squad = Math.min(T.maxSquad, squad + 1); render(); });
      $('#tiers').addEventListener('change', render);
      $('#inst').addEventListener('change', render);
      $('#checkout').addEventListener('click', addToCart);
      $('#cart-btn').addEventListener('click', () => {
        $('#tiket').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      render();
    }
  };
})();
