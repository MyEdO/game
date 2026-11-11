/**
 * L'ISSUE D'UNE ACTIVITÉ AUX BANDES AUTOMATIQUES (LDB 12 l.25-28) : l'issue canonique du flux `activite`
 * (`FLOWS.activite.outcomeOf`) d'un Test simple ouvert par l'interlude, le dé posé par l'option des dés fixés
 * (`jetImposerLeResultat`). La cible est bornée à 01-99 par la ligne du jet ; seules les bandes départagent le dé.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { createHero } from '../engine/character';
import { addCondition } from '../engine/conditions';
import { CHAR_KEYS } from '../engine/types';
import { tableTotale } from '../lib/tableTotale';
import { testScene } from '../scenes/test-fixture';
import { FLOWS } from './rollFlowSpecs';
import { pratiquer } from './interlude.testkit';

/** Le Test de Revenus d'un héros dont chaque Caractéristique vaut `valeur`, Exténué de `extenue`, jeté puis fixé à `de`. */
function revenusAuDe(valeur: number, extenue: number, de: number) {
  const banc = ouvrirLeBanc({ desFixes: true });
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1, manualChars: tableTotale(CHAR_KEYS, () => valeur) });
  if (extenue) addCondition(h, 'extenue', extenue);
  banc.setState({ party: [h], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, journal: [] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().ouvrirLInterlude(3);
  draineCascade(banc.getState);
  const itl = banc.getState().interlude!;
  itl.perHero[h.id] = { ...itl.perHero[h.id], fx: undefined, left: 3 };
  banc.setState({ interlude: { ...itl } });
  pratiquer(banc.getState, h.id, 'revenus');
  banc.getState().jetLancer('activite');
  banc.getState().jetImposerLeResultat('activite', de);
  return FLOWS.activite.outcomeOf(banc.getState);
}

describe('flux `activite` : l’issue d’un Test simple suit les bandes automatiques (LDB 12 l.25-28)', () => {
  it('97 contre 99 est un échec', () => {
    expect(revenusAuDe(90, 0, 97)).toMatchObject({ roll: 97, target: 99, won: false });
  });

  it('03 contre 1 est une réussite', () => {
    expect(revenusAuDe(5, 3, 3)).toMatchObject({ roll: 3, target: 1, won: true });
  });
});
