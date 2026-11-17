// Komponen bersama untuk kurikulum dan soal.
import {
  ArrowLeftRight, BookOpen, Brain, Calculator, CircleDot, Equal, FileText, GitBranch, Hash, Languages, Link2, ListOrdered,
  MessageSquare, PenLine, Puzzle, Scale, Shapes, Sigma, SpellCheck, Table2, Triangle, Users, Workflow,
} from 'lucide-react';

export const UNIT_TONE = {
  VERBAL: { bg: 'bg-verbal-soft', ink: 'text-verbal-ink', fill: 'bg-verbal', ring: 'rgb(var(--verbal))', img: '/illustrations/unit-verbal' },
  ENGLISH: { bg: 'bg-english-soft', ink: 'text-english-ink', fill: 'bg-english', ring: 'rgb(var(--english))', img: '/illustrations/unit-english' },
  NUMERIK: { bg: 'bg-numerik-soft', ink: 'text-numerik-ink', fill: 'bg-numerik', ring: 'rgb(var(--numerik))', img: '/illustrations/unit-numerik' },
  LOGIKA: { bg: 'bg-logika-soft', ink: 'text-logika-ink', fill: 'bg-logika', ring: 'rgb(var(--logika))', img: '/illustrations/unit-logika' },
  NONVERBAL: { bg: 'bg-nonverbal-soft', ink: 'text-nonverbal-ink', fill: 'bg-nonverbal', ring: 'rgb(var(--nonverbal))', img: '/illustrations/unit-nonverbal' },
  KHUSUS: { bg: 'bg-khusus-soft', ink: 'text-khusus-ink', fill: 'bg-khusus', ring: 'rgb(var(--khusus))', img: '/illustrations/unit-khusus' },
};

export const toneOf = (unit) => UNIT_TONE[unit] || UNIT_TONE.KHUSUS;

const SUBTOPIC_ICON = {
  'VERBAL.SINONIM': Equal,
  'VERBAL.ANTONIM': ArrowLeftRight,
  'VERBAL.ANALOGI': Link2,
  'VERBAL.SENTENCE_COMPLETION': PenLine,
  'ENGLISH.READING': BookOpen,
  'ENGLISH.STRUCTURE': SpellCheck,
  'ENGLISH.PARAGRAF': FileText,
  'NUMERIK.BARISAN': ListOrdered,
  'NUMERIK.ARITMETIKA': Calculator,
  'NUMERIK.ALJABAR': Sigma,
  'NUMERIK.GEOMETRI': Triangle,
  'NUMERIK.PERBANDINGAN_KUANTITAS': Scale,
  'NUMERIK.HIMPUNAN': CircleDot,
  'NUMERIK.DATA': Table2,
  'LOGIKA.SILOGISME': Workflow,
  'LOGIKA.KONDISIONAL': GitBranch,
  'LOGIKA.URUTAN': Puzzle,
  'LOGIKA.PENALARAN_KRITIS': Brain,
  'LOGIKA.HUBUNGAN_KELUARGA': Users,
  'LOGIKA.BAHASA_BUATAN': Languages,
  'NONVERBAL.FIGURAL': Shapes,
  'NONVERBAL.DIAGRAM': Hash,
  'KHUSUS.SJT': MessageSquare,
  'KHUSUS.WAWANCARA': MessageSquare,
};

export function SubtopicIcon({ code, className = 'h-5 w-5' }) {
  const Icon = SUBTOPIC_ICON[code] || BookOpen;
  return <Icon className={className} aria-hidden="true" />;
}

/** Ilustrasi unit (WebP transparan + PNG cadangan, dimuat malas). */
export function UnitImage({ unit, className = '', eager = false }) {
  const t = toneOf(unit);
  return (
    <picture>
      <source srcSet={`${t.img}.webp`} type="image/webp" />
      <img src={`${t.img}.png`} alt="" className={className} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </picture>
  );
}
