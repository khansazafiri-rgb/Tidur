# Deploy ke VPS (Caddy + systemd)

Langkah untuk satu VPS Ubuntu/Debian. Ganti `iup.example.com` dengan domainmu.

## 1. Siapkan server

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs caddy git
```

```bash
sudo useradd --system --home /opt/iup --shell /usr/sbin/nologin iup && sudo mkdir -p /var/lib/iup /var/backups/iup && sudo chown iup:iup /var/lib/iup /var/backups/iup
```

Node minimal **22.13** (butuh `node:sqlite`).

## 2. Ambil kode dan build

```bash
sudo git clone https://github.com/khansazafiri-rgb/Tidur.git /opt/iup && sudo chown -R iup:iup /opt/iup
```

```bash
cd /opt/iup && sudo -u iup npm ci && sudo -u iup npm run build
```

```bash
sudo -u iup cp /opt/iup/.env.example /opt/iup/.env
```

Isi `.env`: `PUBLIC_URL`, `DB_PATH=/var/lib/iup/iup.db`, dan (opsional) `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

## 3. Jalankan sebagai layanan

```bash
sudo cp /opt/iup/deploy/iup.service /opt/iup/deploy/iup-backup.service /opt/iup/deploy/iup-backup.timer /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now iup iup-backup.timer
```

```bash
sudo cp /opt/iup/deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

## 4. Isi bank soal dan buat admin

Salin `drive-manifest.tsv` (daftar file Drive, tidak ada di repo) ke `/opt/iup/data/`, lalu:

```bash
cd /opt/iup && sudo -u iup env DB_PATH=/var/lib/iup/iup.db npm run fetch-drive -- data/drive-manifest.tsv data/soal
```

```bash
cd /opt/iup && sudo -u iup env DB_PATH=/var/lib/iup/iup.db npm run import -- data/soal --report data/laporan-impor.md
```

Daftar lewat web, lalu jadikan dirimu pemilik:

```bash
cd /opt/iup && sudo -u iup env DB_PATH=/var/lib/iup/iup.db npm run make-admin -- emailkamu@contoh.id owner
```

Terbitkan soal per folder dari *Admin → Sumber soal*.

## Pembaruan

```bash
cd /opt/iup && sudo -u iup git pull && sudo -u iup npm ci && sudo -u iup npm run build && sudo systemctl restart iup
```

## Cadangan

Timer `iup-backup.timer` menyalin database setiap hari pukul 02.17 ke `/var/backups/iup` (14 terakhir disimpan).
Untuk memulihkan: hentikan layanan, salin file cadangan ke `DB_PATH`, lalu jalankan lagi.

## Masuk dengan Google (opsional)

Buat OAuth Client (jenis *Web application*) di Google Cloud Console dengan *Authorized redirect URI*
`<PUBLIC_URL>/api/auth/google/callback`, lalu isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`.
Tombol *Lanjut dengan Google* muncul otomatis setelah keduanya terisi.
