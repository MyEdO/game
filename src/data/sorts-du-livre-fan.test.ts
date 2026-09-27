import { describe, it, expect } from 'vitest';
import { creatures, spells } from './index';
import { cellulesDeSortsFan, LIVRE_FAN } from '../../scripts/data/lib/cellulesDeSortsFan';
import { PONT, clesEnDouble, listesDerivees } from '../../scripts/data/lib/pontSortsFan';

/**
 * Garde de la CLASSE « identité d'un sort imprimé dans un profil du livre fan » (#1897) : chaque
 * cellule relue au `Source/` se résout par LE PONT (`scripts/data/lib/pontSortsFan.ts`), et la donnée
 * commitée en est la dérivée. Aucun cardinal : les écarts sont rendus NOMMÉS.
 */
const cellules = cellulesDeSortsFan(creatures);
const { parCreature, nonResolues } = listesDerivees(cellules);
const parId = new Map(spells.map((s) => [s.id, s]));

describe('sorts du livre fan — le pont résout chaque cellule, la donnée en dérive', () => {
  it('(c) aucune cellule imprimée sans id, aucune clé du pont en double, tout id du pont au catalogue', () => {
    expect(nonResolues.map((c) => `${c.fichier}:${c.ligne} « ${c.vf} » / « ${c.vo} » (${c.section})`),
      'cellule(s) que le pont ne résout pas — ajouter sa ligne au pont, jugée au Source').toEqual([]);
    expect(clesEnDouble()).toEqual([]);
    expect(PONT.filter((l) => !parId.has(l.id)).map((l) => `${l.section}|${l.vo} → ${l.id}`)).toEqual([]);
  });

  it('(a) la liste `spells` de chaque créature fan jointe est SA liste dérivée, sans doublon non déclaré', () => {
    const ecarts: string[] = [];
    for (const c of creatures) {
      const d = parCreature.get(c.id);
      if (!d) continue;
      if (JSON.stringify(c.spells) !== JSON.stringify(d.spells)) ecarts.push(`${c.id} : ${JSON.stringify(c.spells)} ≠ dérivée ${JSON.stringify(d.spells)}`);
      ecarts.push(...d.doublons);
    }
    expect(ecarts, 'rejouer `node scripts/migrations/2026-09-23-1897-sorts-fan-par-le-pont.mjs`').toEqual([]);
  });

  it(`(b) aucune entrée ${LIVRE_FAN} n'est la cible d'une clé marquée officielle — un ré-import ne recrée pas un doublon`, () => {
    const doublons = PONT
      .filter((l) => l.statut === 'officiel' && parId.get(l.id)?.source?.book === LIVRE_FAN)
      .map((l) => `${l.section}|${l.vo}${l.sigle ? ` ${l.sigle}` : ''} → ${l.id}`);
    expect(doublons).toEqual([]);
    const cibles = new Set(PONT.filter((l) => l.statut !== 'officiel').map((l) => l.id));
    const horsPont = spells.filter((s) => s.source?.book === LIVRE_FAN && !cibles.has(s.id)).map((s) => s.id);
    expect(horsPont, `entrée(s) ${LIVRE_FAN} qu'aucune clé fan ou variante du pont ne désigne`).toEqual([]);
  });
});
