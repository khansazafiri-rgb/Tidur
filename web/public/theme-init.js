// Pasang tema dan ukuran teks sebelum halaman digambar, supaya tidak berkedip.
(function () {
  try {
    var t = localStorage.getItem('iup-theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
