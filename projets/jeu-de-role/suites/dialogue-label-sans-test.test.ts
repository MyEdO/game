/** #1869 sur les paquets livrés : le libellé d’une réponse ne dit pas le Test de son propre flux
 *  (`src/scenes/dialogue-label-sans-test.test.ts` en tient le détecteur et le commun). */
import { describe, expect, it } from 'vitest';
import { CHAR_LABELS, DIFFICULTY_LABELS } from '../../../src/engine/types';
import { formatMoney, spellMoney } from '../../../src/engine/money';
import { mesurerLibellesDeReponse } from '../../../scripts/guards/lib/dialogueLabelTest.mjs';
import { cheminsDesProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';

const VOC = { carac: CHAR_LABELS, difficultes: DIFFICULTY_LABELS, monnaie: { formater: formatMoney, epeler: spellMoney } };

describe('#1869 — paquets livrés', () => {
  it('aucun paquet livré ne recopie ce que le tag dérivé dira déjà', () => {
    expect(
      mesurerLibellesDeReponse(VOC, undefined, cheminsDesProjetsLivres()),
      'le tag « [Compétence — Difficulté] » et la puce de coût sont DÉRIVÉS de la donnée : retirer la mention du libellé',
    ).toEqual([]);
  });
});
