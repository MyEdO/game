import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * CLIQUET — une étape de cascade QUI LANCE DIT sa Difficulté (#1112). Une étape-jet porte `base` et
 * `target` (cible déjà calculée) : sans `difficulty` en donnée, la ligne de jet affiche une cible sans
 * dire de quelle Difficulté elle est faite, et l'affichage n'a AUCUN moyen de la retrouver (le +N est
 * déjà fondu dans `target`). La Difficulté est produite par le PRODUCTEUR du jet, jamais devinée.
 *
 * Le scan est STRUCTUREL : littéral d'objet contenant `result: null` (signature d'une étape de cascade
 * non encore jouée) ET `target:` — commentaires et contenus de chaînes/gabarits neutralisés avant le
 * parcours d'accolades (sinon un `${…}` fausse l'appariement). Baseline NOMINATIVE par fichier,
 * DÉCROISSANTE : un site assaini doit ABAISSER sa baseline (cliquet à double sens).
 */

const RACINES = ['src/state', 'src/noyau'];

/** Neutralise commentaires, chaînes et gabarits (contenu remplacé par des espaces, sauts conservés) —
 *  les accolades d'un `${…}` ne doivent JAMAIS compter dans l'appariement du littéral. */
export function stripLiterals(src: string): string {
  const out = src.split('');
  let i = 0;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < src.length) {
    const c = src[i];
    const nxt = src[i + 1];
    if (c === '/' && nxt === '/') { const e = src.indexOf('\n', i); const end = e === -1 ? src.length : e; blank(i, end); i = end; continue; }
    if (c === '/' && nxt === '*') { const e = src.indexOf('*/', i + 2); const end = e === -1 ? src.length : e + 2; blank(i, end); i = end; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) break;
        j++;
      }
      blank(i + 1, j);
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.join('');
}

/** Littéraux d'étape-jet SANS `difficulty` : renvoie leurs numéros de ligne (1-based). */
export function stepsWithoutDifficulty(src: string): number[] {
  const s = stripLiterals(src);
  const lines: number[] = [];
  for (const m of s.matchAll(/result\s*:\s*null/g)) {
    const i = m.index!;
    let depth = 0;
    let start = -1;
    for (let j = i; j >= 0; j--) {
      if (s[j] === '}') depth++;
      else if (s[j] === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    depth = 0;
    let end = -1;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (start < 0 || end < 0) continue;
    const lit = s.slice(start, end);
    if (!/\btarget\s*[:,}]/.test(lit)) continue; // étape sans jet : rien à dire (`target:` OU raccourci `target,`)
    if (/\bdifficulty\s*[,:]/.test(lit)) continue; // Difficulté déclarée (clé ou raccourci)
    // SEUIL PUR (#1426, #2389) : le TYPE lui interdit toute Difficulté (`pendings.LectureDuDe`). Exemption
    // STRUCTURELLE (le champ `evaluation` du littéral), jamais une baseline.
    // (lu sur la source ORIGINALE : `stripLiterals` a effacé la valeur `'seuil'`, pas la clé.)
    if (/\bevaluation\s*:\s*'seuil'/.test(src.slice(start, end))) continue;
    lines.push(src.slice(0, start).split('\n').length);
  }
  return lines;
}

/** Baseline NOMINATIVE (fichier → nombre d'étapes-jet encore sans Difficulté). ZÉRO = assaini. */
const BASELINE: Record<string, number> = {};

describe('cliquet — une étape de cascade qui LANCE dit sa Difficulté (#1112)', () => {
  it('aucun nouveau site sans Difficulté, et toute baseline assainie est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const { rel, text } of readCorpus(RACINES, { exts: ['.ts'] })) {
      const found = stepsWithoutDifficulty(text);
      // La CLÉ de la baseline est relative à `src/`.
      if (found.length) counts[rel.slice('src/'.length)] = found;
    }
    const over: string[] = [];
    for (const [f, l] of Object.entries(counts)) {
      const b = BASELINE[f] ?? 0;
      if (l.length > b) over.push(`${f} : ${l.length} (baseline ${b}) — lignes ${l.join(', ')}`);
    }
    expect(over, `Étape(s) de cascade SANS Difficulté déclarée — la poser au PRODUCTEUR du jet :\n${over.join('\n')}`).toEqual([]);
    const stale: string[] = [];
    for (const [f, b] of Object.entries(BASELINE)) {
      const n = counts[f]?.length ?? 0;
      if (n < b) stale.push(`${f} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, `Baseline(s) PÉRIMÉE(s) :\n${stale.join('\n')}`).toEqual([]);
  });

  it('FAIL-CLOSED : une étape-jet synthétique sans Difficulté est DÉTECTÉE, avec Difficulté elle ne l’est pas', () => {
    const sans = `const s = { id: \`x-\${a}\`, kind: 'k', base: 40, target: 40, result: null };`;
    const avec = `const s = { id: \`x-\${a}\`, kind: 'k', base: 40, difficulty: 'intermediaire', target: 40, result: null };`;
    const raccourci = `const s = { id: 'x', kind: 'k', base: 40, difficulty, target: 40, result: null };`;
    expect(stepsWithoutDifficulty(sans)).toHaveLength(1);
    expect(stepsWithoutDifficulty(avec)).toHaveLength(0);
    expect(stepsWithoutDifficulty(raccourci)).toHaveLength(0);
    // Une étape SANS jet (aucune cible) n'est pas concernée.
    expect(stepsWithoutDifficulty(`const s = { id: 'x', kind: 'reveal', result: null };`)).toHaveLength(0);
    // Raccourcis d'objet (`base, target,`) : une étape-jet reste détectée.
    expect(stepsWithoutDifficulty(`const s = { id: 'x', kind: 'k', base, target, result: null };`)).toHaveLength(1);
    // Le contenu d'un gabarit ne fausse pas l'appariement d'accolades.
    expect(stepsWithoutDifficulty(`const s = { label: \`a \${x ? '{' : '}'} b\`, base: 1, target: 1, result: null };`)).toHaveLength(1);
  });
});
