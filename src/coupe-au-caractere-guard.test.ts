/**
 * GARDE — aucun texte coupé au caractère puis ellipsé sous `src/` ni `scripts/` (#1806, R-M2 de
 * `docs/plans/2026-08-16-spec-hud-combat.md`) : la coupe d'un texte ellipsé est `coupeAuMot`
 * (`src/lib/coupeAuMot.mjs`). Tolérance zéro, sans registre ; tests compris.
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { coupesAuCaractere } from '../scripts/guards/lib/coupeAuCaractere.mjs';

const vus = (text: string, rel = 'temoin.tsx') => coupesAuCaractere([{ rel, text }]);

describe('coupe au caractère suivie d’une ellipse', () => {
  it('témoin : gabarit, concaténation, ternaire, `trimEnd`, ellipse en trois points — vus ; tableau et préfixe sans ellipse — non', () => {
    const texte = [
      'const a = `${s.slice(0, n)}…`;',
      "const b = s.substring(0, 12) + '...';",
      "const c = s.length > 9 ? `${s.slice(0, 9)}${s.length > 9 ? '…' : ''}` : s;",
      'const d = `${t.slice(0, 400).trimEnd()}…`;',
      "const e = (s.substr(0, 3)) + '…';",
      "const f = `${xs.slice(0, 3).join(', ')}…`;",
      'const g = s.slice(0, coupe).trimEnd();',
      "// `${s.slice(0, n)}…` en commentaire",
      "const h = '`${s.slice(0, n)}…`';",
    ].join('\n');
    expect(vus(texte, 'temoin.ts')).toEqual(['temoin.ts:1', 'temoin.ts:2', 'temoin.ts:3', 'temoin.ts:4', 'temoin.ts:5']);
  });

  it('témoin : chaque forme vue sans flux de données — texte JSX voisin, constante nommée, `padEnd`, `concat`, tableau de caractères, deux instructions', () => {
    expect(vus('const X = () => <span>{s.slice(0, 20)}…</span>;')).toEqual(['temoin.tsx:1']);
    expect(vus("const X = () => <span>{s.slice(0, 20)}{'…'}</span>;")).toEqual(['temoin.tsx:1']);
    expect(vus("const ELLIPSE = '…';\nconst a = s.slice(0, 20) + ELLIPSE;")).toEqual(['temoin.tsx:2']);
    expect(vus("const a = s.slice(0, 20).padEnd(21, '…');")).toEqual(['temoin.tsx:1']);
    expect(vus("const a = s.slice(0, 20).concat('…');")).toEqual(['temoin.tsx:1']);
    expect(vus("const a = [...s].slice(0, 20).join('') + '…';")).toEqual(['temoin.tsx:1']);
    expect(vus("const a = Array.from(s).slice(0, 20).join('') + '…';")).toEqual(['temoin.tsx:1']);
    expect(vus('const p = s.slice(0, 20);\nconst a = `${p}…`;')).toEqual(['temoin.tsx:1']);
    expect(vus('function f(s) {\n  const p = s.slice(0, 20).trimEnd();\n  return p.length < s.length ? `${p}…` : p;\n}')).toEqual(['temoin.tsx:2']);
    expect(vus("const X = () => <span title={s.slice(0, 20) + '…'} />;")).toEqual(['temoin.tsx:1']);
    expect(vus("const a = s.slice(0, 20) + '\\u2026';")).toEqual(['temoin.tsx:1']);
  });

  it('témoin : JSX sur plusieurs lignes, le texte fait de seuls blancs et l’expression vide entre la coupe et l’ellipse sont sautés', () => {
    expect(vus("const X = () => (\n  <span>\n    {s.slice(0, 20)}\n    {/* c */}\n    {'…'}\n  </span>\n);")).toEqual(['temoin.tsx:3']);
    expect(vus("const X = () => (\n  <span>\n    {s.slice(0, 20)}\n    {'…'}\n  </span>\n);")).toEqual(['temoin.tsx:3']);
    expect(vus('const X = () => (\n  <span>\n    {s.slice(0, 20)}\n    …\n  </span>\n);')).toEqual(['temoin.tsx:3']);
    expect(vus("const X = () => (\n  <span>\n    {s.slice(0, 20)}\n    <b>fin</b>\n    {'…'}\n  </span>\n);")).toEqual([]);
  });

  it('témoin : un nom se résout par son SYMBOLE — l’homonyme d’une autre portée n’est pas lui', () => {
    expect(vus("const E = 'x';\nfunction f() { const E = '…'; return E; }\nconst a = s.slice(0, 20) + E;"), 'constante ombrée').toEqual([]);
    expect(vus("const E = '…';\nfunction f() { const E = 'x'; return s.slice(0, 20) + E; }"), 'constante locale qui masque').toEqual([]);
    expect(vus("const E = '…';\nfunction f() { return s.slice(0, 20) + E; }"), 'constante du module vue d’une portée interne').toEqual(['temoin.tsx:2']);
    expect(vus('const p = s.slice(0, 20);\nfunction g(p) { return `${p}…`; }'), 'paramètre homonyme').toEqual([]);
    expect(vus('const p = s.slice(0, 20);\nfunction g() { return `${p}…`; }'), 'la coupe ellipsée d’une portée interne').toEqual(['temoin.tsx:1']);
  });

  it('témoin : ce qui n’est pas une coupe ellipsée reste muet', () => {
    expect(vus('const X = () => <span>{s.slice(0, 20)}</span>;')).toEqual([]);
    expect(vus("const X = () => <span>…{s.slice(0, 20)}</span>;")).toEqual([]);
    expect(vus("const NOM = 'un nom';\nconst a = s.slice(0, 20) + NOM;")).toEqual([]);
    expect(vus("const a = xs.slice(0, 20).join(', ') + ' et d’autres';")).toEqual([]);
    expect(vus('const p = s.slice(0, 20);\nfunction g() { const p = 1; }\nconst a = `${p} fin`;')).toEqual([]);
    expect(vus('let p = s.slice(0, 20);\nconst a = `${p}…`;'), 'liée à un `let` : hors portée (en-tête)').toEqual([]);
  });

  it('le FOYER (`coupeAuMot` elle-même) est seul hors de la garde : son corps, sous un autre chemin, est vu', () => {
    const [foyer] = readCorpus(['src/lib'], { exts: ['.mjs'] }).filter(({ rel }) => rel === 'src/lib/coupeAuMot.mjs');
    expect(foyer, 'le foyer existe').toBeTruthy();
    expect(coupesAuCaractere([foyer])).toEqual([]);
    expect(coupesAuCaractere([{ rel: 'copie.mjs', text: foyer.text }])).toHaveLength(1);
  });

  it('aucun site sous `src/` ni `scripts/`', { timeout: 30_000 }, () => {
    const corpus = readCorpus(['src', 'scripts'], { exts: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'], tests: true });
    expect(coupesAuCaractere(corpus)).toEqual([]);
  });
});
