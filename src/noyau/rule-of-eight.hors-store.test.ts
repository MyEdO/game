/**
 * Influences malfaisantes — « Règle du 8 » (LDB 46 l.89) : câblage du noyau. Près d'une source de
 * Corruption (flag de scène/campagne `corruption`), un Test de Langue (Magick) dont le dé des unités
 * vaut 8 déclenche une Incantation Imparfaite Mineure, même si le Sort réussit par ailleurs.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineEtLit } from './cascade.testkit';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { findSpellById } from '../data';
import type { CastResult } from '../engine/magic';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function castFrozen(casterId: string, spellId: string, roll: number, corruption: boolean) {
  const spell = findSpellById(spellId)!;
  const result: CastResult = { cast: true, roll, target: 60, sl: 2, isCritical: false, isFumble: false, log: `${spell.label} lancé.` };
  banc.setState({
    ...(corruption ? { flags: { corruption: true } } : { flags: {} }),
    pendingCast: { casterId, targetId: casterId, spellId: spell.id, missile: !!spell.missile, focused: false, result },
  });
  banc.getState().jetValider('incantation');
}

describe('Règle du 8 — câblage store (LDB 46 l.89)', () => {
  beforeEach(() => { banc.getState().ensemencerLeTirage(7); });

  it('dé des unités = 8 près d’une Corruption → Incantation Imparfaite', () => {
    const mage = herosDeScenario(idsDeTest, 'sorcier');
    banc.setState({ party: [mage] });
    castFrozen(mage.id, 'flechette', 38, true); // réussite, unités 8, lieu corrompu
    expect(draineEtLit(banc.getState).join('\n')).toMatch(/Imparfaite/);
  });

  it('même dé, mais AUCUNE Corruption à proximité → pas d’Imparfaite', () => {
    const mage = herosDeScenario(idsDeTest, 'sorcier');
    banc.setState({ party: [mage] });
    castFrozen(mage.id, 'flechette', 38, false);
    expect(draineEtLit(banc.getState).join('\n')).not.toMatch(/Imparfaite/);
  });

  it('Corruption à proximité mais dé des unités ≠ 8 → pas d’Imparfaite', () => {
    const mage = herosDeScenario(idsDeTest, 'sorcier');
    banc.setState({ party: [mage] });
    castFrozen(mage.id, 'flechette', 37, true);
    expect(draineEtLit(banc.getState).join('\n')).not.toMatch(/Imparfaite/);
  });
});
