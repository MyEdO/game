/**
 * GARDE DE VERBATIM — `oups.json` `label` ↔ `Source/` (AGENTS.md règle 5) : chaque bande du Tableau des Oups ! porte le
 * texte de SA ligne du livre (LDB 14 l.24-30), et l'Incident de Tir celui de son paragraphe (LDB 14 l.34). Les sauts de
 * ligne de cellule (`<br>`) du Markdown extrait se lisent comme une espace ; aucun autre caractère n'est réécrit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { oupsMisfire, oupsTable } from './oups';

const CHAPITRE = 'Source/Warhammer v4 - Livre de base version corrigee/14 - _GoBack.md';
const LIGNES = readFileSync(CHAPITRE, 'utf8').split('\n');

/** Les bandes du Tableau des Oups ! : `min-max` (00 vaut 100) → le texte de la cellule. */
function bandesDuLivre(): Map<string, string> {
  const bandes = new Map<string, string>();
  for (const l of LIGNES) {
    const m = /^\| (\d\d)-(\d\d)\s*\| (.*?)\s*\|$/.exec(l);
    if (m) bandes.set(`${Number(m[1])}-${m[2] === '00' ? 100 : Number(m[2])}`, m[3].split('<br>').join(' '));
  }
  return bandes;
}

describe('oups.json — chaque libellé est le VERBATIM de sa ligne du Tableau des Oups ! (règle 5)', () => {
  const bandes = bandesDuLivre();

  it('le livre porte les 7 bandes de la table', () => {
    expect([...bandes.keys()]).toEqual(['1-20', '21-40', '41-60', '61-70', '71-80', '81-90', '91-100']);
  });

  it.each(oupsTable().map((e) => [`${e.min}-${e.max}`, e.label] as const))('bande %s', (bande, label) => {
    expect(label).toBe(bandes.get(bande));
  });

  it('l’Incident de Tir est le paragraphe « INCIDENT DE TIR ! » du livre', () => {
    const titre = LIGNES.findIndex((l) => l.startsWith('#### INCIDENT DE TIR'));
    const paragraphe = LIGNES.slice(titre + 1).find((l) => l.trim());
    expect(oupsMisfire().label).toBe(paragraphe);
  });
});
