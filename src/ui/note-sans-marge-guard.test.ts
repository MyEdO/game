/**
 * GARDE — une NOTE (`.rm-stake` de `StakeNote`/`OutcomeNote`, `.rm-note` et ses tons) ne porte aucune
 * marge externe, ni chez elle ni posée par un conteneur (`X > .rm-stake { margin-bottom }`) : c'est le
 * `gap` de la pile qui la reçoit (`Stack`, `docs/primitives.md`) qui la place. Verdict du juge B12, D5
 * et D6 (#1920).
 *
 * FORME : toute règle CSS de `src` (`readCorpus`, `.css`) dont le SUJET (dernier composé du sélecteur) nomme une note, et
 * qui déclare une propriété `margin*` de valeur non nulle, rougit.
 */
import { describe, it, expect } from 'vitest';
import { reglesCss, declarations } from '../../scripts/guards/lib/cssCouches.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

const NOTE = /\.rm-(stake|note)(?![\w-])/;
const NULLE = /^(0(px|rem|em)?\s*)+$/;

/** Le sujet d'un sélecteur : son dernier composé, arguments de pseudo-classes retirés. */
function sujet(sel: string): string {
  let prof = 0;
  let plat = '';
  for (const c of sel) {
    if (c === '(') { prof++; continue; }
    if (c === ')') { prof--; continue; }
    if (prof === 0) plat += c;
  }
  return plat.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() ?? '';
}

/** Sites fautifs d'une feuille, en `feuille | sélecteur | marge`. */
export function notesAMarge(text: string, rel: string): string[] {
  const out: string[] = [];
  for (const r of reglesCss(text)) {
    const marges = declarations(r.corps).filter((d) => d.prop.startsWith('margin') && !NULLE.test(d.valeur.trim()));
    if (!marges.length) continue;
    for (const sel of r.selecteurs) {
      if (NOTE.test(sujet(sel))) out.push(`${rel} | ${sel} | ${marges.map((d) => `${d.prop}: ${d.valeur}`).join('; ')}`);
    }
  }
  return out;
}

describe('note sans marge externe — le conteneur la place par son `gap`', () => {
  it('le détecteur mord sur la note et sur le conteneur qui la vise, et se tait sur ses enfants', () => {
    const css = [
      ".rm-note[data-ton='bloque'] { margin: 10px 0; }",
      '.modal-body > .rm-stake { margin-bottom: var(--sp-md); }',
      '.mrl > * > .rm-stake { margin-bottom: 6px; }',
      ".rm-note[data-ton='attente'] { margin: 0; padding: 8px 10px; }",
      '.rm-stake > .icon { margin-top: 2px; }',
      '.rm-stake-voisin { margin: 4px; }',
    ].join('\n');
    expect(notesAMarge(css, 'f.css').map((s) => s.split(' | ')[1])).toEqual([
      ".rm-note[data-ton='bloque']",
      '.modal-body > .rm-stake',
      '.mrl > * > .rm-stake',
    ]);
  });

  it('aucune feuille de `src` ne pose de marge à une note', () => {
    expect(readCorpus(['src'], { exts: ['.css'] }).flatMap((f) => notesAMarge(f.text, f.rel))).toEqual([]);
  });
});
