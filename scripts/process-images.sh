#!/usr/bin/env bash
# Potong latar gambar maskot dari Drive menjadi WebP transparan + PNG cadangan (butuh ImageMagick).
#   scripts/process-images.sh <folder-sumber> <folder-keluaran>
# Lalu salin <keluaran>/mascot, /illustrations, /brand ke web/public/.
#
# Nama file sumber yang diharapkan (judul asli di folder Drive gambar -> nama di <folder-sumber>):
#   Anak Kucing Dokter Ceria Berstetoskop        -> ceria-stetoskop.png      (idle)
#   Dokter Kucing Oranye Melambaikan Tangan      -> melambai.png             (wave)
#   Anak Kucing Dokter Membaca Buku              -> membaca-buku.png         (reading)
#   Kucing Dokter Berpikir dengan Tanda Tanya    -> berpikir-tanda-tanya.png (thinking)
#   Kucing Dokter Tabby Merayakan Kegembiraan    -> tabby-gembira.png        (excited)
#   Dokter Kucing Oranye yang Menggemaskan       -> menggemaskan.png         (head-tilt)
#   Kucing Dokter Mengantuk di Atas Buku         -> mengantuk.png            (sleeping)
#   Anak Kucing Dokter Merayakan Kemenangan      -> anak-merayakan-kemenangan.png (celebrating)
#   Kucing Dokter Ceria dengan Buku Catatan      -> buku-catatan.png         (empty-notes)
#   Anak Kucing Dokter dan Keranjang Belanja     -> keranjang-belanja.png    (empty-cart)
#   kosong bookmark                              -> kosong-bookmark.png      (empty-bookmark)
#   Kucing Dokter Menyelidiki Kotak Misterius    -> kotak-misterius.png      (empty-search)
#   Kucing Dokter Menghadapi Masalah Koneksi     -> koneksi.png              (offline)
#   Kucing Dokter Bingung Membaca Peta           -> bingung-peta.png         (lost)
#   Kartu Belajar Verbal / Belajar Bahasa Inggris / Belajar Numerik / Berpikir dalam Logika / Puzzle Bentuk
#                                                -> kartu-verbal, bahasa-inggris, belajar-numerik, berpikir-logika, puzzle-bentuk
#   Anak Kucing Dokter Penuh Semangat            -> penuh-semangat.png       (unit khusus / beranda)
#   Kucing Dokter Merayakan Kemenangan           -> merayakan-kemenangan.png
#   Maskot Kucing Menyambut di Kampus / Kampus Hijau / di Kampus -> menyambut-kampus, kampus-hijau, kampus
#   Ikon Kucing Dokter Ceria                     -> ikon-ceria.png           (logo & favicon)
set -euo pipefail
S="$1"; O="$2"
cut() { # src name outname maxsize fuzz
  local src="$S/$1.png" out="$2" size="$3" fuzz="${4:-7}"
  local bg; bg=$(convert "$src" -format '%[pixel:p{3,3}]' info:)
  convert "$src" -alpha set -bordercolor "$bg" -border 2 -fuzz ${fuzz}% -fill none -floodfill +0+0 "$bg" -shave 2x2 \
    -channel A -morphology Erode Diamond:1 -blur 0x0.6 +channel -trim +repage \
    -resize "${size}x${size}>" -strip "$out.png"
  convert "$out.png" -quality 86 -define webp:alpha-quality=95 "$out.webp"
}
keep() { # src out width
  convert "$S/$1.png" -resize "$3x>" -strip -quality 82 "$2.webp"
  convert "$S/$1.png" -resize "$3x>" -strip -quality 84 "$2.jpg"
}
M="$O/mascot"; I="$O/illustrations"; B="$O/brand"
cut ceria-stetoskop "$M/idle" 512
cut melambai "$M/wave" 512
cut membaca-buku "$M/reading" 512
cut berpikir-tanda-tanya "$M/thinking" 512
cut tabby-gembira "$M/excited" 512
cut menggemaskan "$M/head-tilt" 512
cut mengantuk "$M/sleeping" 512
cut anak-merayakan-kemenangan "$M/celebrating" 512
cut buku-catatan "$M/empty-notes" 640
cut keranjang-belanja "$M/empty-cart" 640
cut kosong-bookmark "$M/empty-bookmark" 640
cut kotak-misterius "$M/empty-search" 640
cut koneksi "$M/offline" 640
cut bingung-peta "$M/lost" 640
cut kartu-verbal "$I/unit-verbal" 600
cut bahasa-inggris "$I/unit-english" 600
cut belajar-numerik "$I/unit-numerik" 600
cut berpikir-logika "$I/unit-logika" 600
cut puzzle-bentuk "$I/unit-nonverbal" 600
cut penuh-semangat "$I/unit-khusus" 900
cut merayakan-kemenangan "$I/hasil-merayakan" 900
keep menyambut-kampus "$I/hero" 1600
keep kampus-hijau "$I/kampus-unair" 1200
keep kampus "$I/kampus-ugm" 1200
keep menyambut-kampus "$I/kampus-ui" 1200
# brand icon: remove white corners
convert "$S/ikon-ceria.png" -alpha set -bordercolor white -border 2 -fuzz 6% -fill none -floodfill +0+0 white -shave 2x2 -trim +repage "$B/logo-full.png"
for s in 32 180 192 512; do convert "$B/logo-full.png" -resize ${s}x${s} -strip "$B/icon-$s.png"; done
convert "$B/logo-full.png" -resize 256x256 -quality 90 "$B/logo.webp"
rm "$B/logo-full.png"
# OG image 1200x630
convert "$S/kampus-hijau.png" -resize 1200x -gravity center -crop 1200x630+0+0 +repage -strip -quality 84 "$B/og-image.jpg"
