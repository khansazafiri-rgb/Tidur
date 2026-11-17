#!/usr/bin/env node
// Jadikan pengguna terdaftar sebagai pemilik atau kontributor.
//   npm run make-admin -- email@contoh.id [owner|contributor]
import { getDb } from '../server/db.js';

const [email, role = 'owner'] = process.argv.slice(2);
if (!email || !['owner', 'contributor', 'user'].includes(role)) {
  console.error('Pemakaian: npm run make-admin -- <email> [owner|contributor|user]');
  process.exit(1);
}
const db = getDb();
const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
if (!u) {
  console.error(`Pengguna ${email} belum terdaftar. Daftar dulu lewat web, lalu jalankan perintah ini lagi.`);
  process.exit(1);
}
db.prepare('UPDATE profiles SET role = ? WHERE user_id = ?').run(role, u.id);
console.log(`${email} sekarang berperan sebagai ${role}.`);
