// Pasang tema sebelum halaman digambar, supaya tidak berkedip. Bawaan: terang.
(function () {
  try {
    var t = JSON.parse(localStorage.getItem('iup-theme') || '"light"');
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
