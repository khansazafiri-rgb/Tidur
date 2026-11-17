import { config } from '../config.js';

/**
 * Kirim email lewat Resend bila RESEND_API_KEY diisi.
 * Tanpa kunci (pengembangan), isi email dicetak ke log server.
 */
export async function sendMail({ to, subject, text }) {
  if (!config.resendApiKey) {
    console.log(`\n[email] kepada: ${to}\n[email] subjek: ${subject}\n${text}\n`);
    return { ok: true, dev: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.mailFrom, to, subject, text }),
    });
    if (!res.ok) console.error('[email] gagal mengirim:', res.status, await res.text());
    return { ok: res.ok };
  } catch (e) {
    console.error('[email] gagal mengirim:', e.message);
    return { ok: false };
  }
}

export function verifyEmailText(link) {
  return `Halo!\n\nKlik tautan ini untuk memverifikasi email kamu:\n${link}\n\nTautan berlaku 48 jam. Kalau kamu tidak merasa mendaftar, abaikan email ini.\n\nSalam,\nWeb Persiapan IUP`;
}

export function resetPasswordText(link) {
  return `Halo!\n\nKami menerima permintaan untuk mengatur ulang kata sandi akunmu. Klik tautan ini:\n${link}\n\nTautan berlaku 1 jam. Kalau kamu tidak memintanya, abaikan email ini dan kata sandimu tetap aman.\n\nSalam,\nWeb Persiapan IUP`;
}
