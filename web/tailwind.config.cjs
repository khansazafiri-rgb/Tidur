const path = require('node:path');

// Warna dibaca dari variabel CSS berisi tiga angka RGB (lihat src/styles.css),
// sehingga mode gelap cukup menimpa variabel di satu tempat.
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: [path.join(__dirname, 'index.html'), path.join(__dirname, 'src/**/*.{js,jsx}')],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        sunken: c('sunken'),
        line: c('line'),
        ink: c('ink'),
        muted: c('muted'),
        primary: { DEFAULT: c('primary'), soft: c('primary-soft'), ink: c('primary-ink') },
        accent: { DEFAULT: c('accent'), soft: c('accent-soft'), ink: c('accent-ink') },
        success: { DEFAULT: c('success'), soft: c('success-soft'), ink: c('success-ink') },
        danger: { DEFAULT: c('danger'), soft: c('danger-soft'), ink: c('danger-ink') },
        warn: { DEFAULT: c('warn'), soft: c('warn-soft'), ink: c('warn-ink') },
        verbal: { DEFAULT: c('verbal'), soft: c('verbal-soft'), ink: c('verbal-ink') },
        english: { DEFAULT: c('english'), soft: c('english-soft'), ink: c('english-ink') },
        numerik: { DEFAULT: c('numerik'), soft: c('numerik-soft'), ink: c('numerik-ink') },
        logika: { DEFAULT: c('logika'), soft: c('logika-soft'), ink: c('logika-ink') },
        nonverbal: { DEFAULT: c('nonverbal'), soft: c('nonverbal-soft'), ink: c('nonverbal-ink') },
        khusus: { DEFAULT: c('khusus'), soft: c('khusus-soft'), ink: c('khusus-ink') },
      },
      fontFamily: {
        display: ['Fredoka', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'ui-rounded', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        meta: ['0.8125rem', { lineHeight: '1.4' }],
        eyebrow: ['0.8125rem', { lineHeight: '1.3', letterSpacing: '0.06em' }],
        body: ['1rem', { lineHeight: '1.6' }],
        'card-title': ['1.125rem', { lineHeight: '1.35' }],
        section: ['1.375rem', { lineHeight: '1.3' }],
        intro: ['1.125rem', { lineHeight: '1.6' }],
        page: ['clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem)', { lineHeight: '1.15' }],
        hero: ['clamp(2.1rem, 1.5rem + 3vw, 3.5rem)', { lineHeight: '1.08' }],
      },
      borderRadius: { card: '1.5rem', xl2: '1rem', blob: '2rem' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 4px 16px rgb(var(--shadow) / 0.06)',
        lift: '0 2px 4px rgb(var(--shadow) / 0.08), 0 12px 32px rgb(var(--shadow) / 0.12)',
        chunky: '0 4px 0 rgb(var(--line-strong))',
        lip: '0 4px 0 rgb(var(--lip, var(--line-strong)))',
      },
      screens: { xs: '360px' },
    },
  },
  plugins: [],
};
