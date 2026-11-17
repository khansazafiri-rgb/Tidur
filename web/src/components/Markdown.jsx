import { memo, useMemo } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Teks soal dan pembahasan di-render dari Markdown + KaTeX tanpa HTML mentah (PRD: Keamanan).
// 1) Rumus $...$ dan $$...$$ diganti penanda, 2) Markdown di-render dengan HTML mentah di-escape,
// 3) hasilnya disanitasi DOMPurify, 4) penanda diganti keluaran KaTeX (HTML + MathML untuk pembaca layar).

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html(token) {
      return escapeHtml(typeof token === 'string' ? token : token.text || token.raw || '');
    },
  },
});

const MATH_RE = /\$\$([\s\S]+?)\$\$|(?<!\\)\$((?:\\\$|[^$\n])+?)\$/g;

function renderMath(tex, display) {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore' });
  } catch {
    return escapeHtml(tex);
  }
}

export function renderMarkdown(src, { inline = false } = {}) {
  if (!src) return '';
  const maths = [];
  let text = String(src).replace(MATH_RE, (_m, block, inl) => {
    maths.push({ tex: block ?? inl, display: block != null });
    return `@@M${maths.length - 1}@@`;
  });
  text = text.replace(/\\\$/g, '$');
  let html = inline ? marked.parseInline(text) : marked.parse(text);
  html = DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'img', 'iframe'], FORBID_ATTR: ['style'] });
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  html = html.replace(/@@M(\d+)@@/g, (_m, i) => renderMath(maths[Number(i)].tex, maths[Number(i)].display));
  return html;
}

function MarkdownImpl({ children, inline = false, className = '', as: Tag = inline ? 'span' : 'div', ...rest }) {
  const html = useMemo(() => renderMarkdown(children, { inline }), [children, inline]);
  // eslint-disable-next-line react/no-danger
  return <Tag className={`md ${inline ? 'md-inline' : ''} ${className}`} dangerouslySetInnerHTML={{ __html: html }} {...rest} />;
}

export const Markdown = memo(MarkdownImpl);
