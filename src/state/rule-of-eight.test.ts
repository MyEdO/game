/**
 * Influences malfaisantes — « Règle du 8 » (LDB 46 l.89) : câblage store. Près d'une source de
 * Corruption (flag de scène/campagne `corruption`), un Test de Langue (Magick) dont le dé des unités
 * vaut 8 déclenche une Incantation Imparfaite Mineure, même si le Sort réussit par ailleurs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { draineEtLit } from './cascade.testkit';
import { pregen, PREGEN } from '../data/pregens';
import { findSpellById } from '../data';
import type { CastResult } from '../engine/magic';

function castFrozen(casterId: string, spellId: string, roll: number, corruption: boolean) {
  const spell = findSpellById(spellId)!;
  const result: CastResult = { cast: true, roll, target: 60, sl: 2, isCritical: false, isFumble: false, log: `${spell.label} lancé.` };
  useGame.setState({
    ...(corruption ? { flags: { corruption: true } } : { flags: {} }),
    pendingCast: { casterId, targetId: casterId, spellId: spell.id, missile: !!spell.missile, focused: false, result },
  });
  useGame.getState().castConfirm();
}

describe('Règle du 8 — câblage store (LDB 46 l.89)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingCast: null, pendingCascade: null, journal: [], flags: {} });
    useGame.getState().seedRng(7);
  });

  it('dé des unités = 8 près d’une Corruption → Incantation Imparfaite', () => {
    const mage = pregen(PREGEN.sorcier);
    useGame.setState({ party: [mage] });
    castFrozen(mage.id, 'flechette', 38, true); // réussite, unités 8, lieu corrompu
    expect(draineEtLit(useGame.getState).join('\n')).toMatch(/Imparfaite/);
  });

  it('même dé, mais AUCUNE Corruption à proximité → pas d’Imparfaite', () => {
    const mage = pregen(PREGEN.sorcier);
    useGame.setState({ party: [mage] });
    castFrozen(mage.id, 'flechette', 38, false);
    expect(draineEtLit(useGame.getState).join('\n')).not.toMatch(/Imparfaite/);
  });

  it('Corruption à proximité mais dé des unités ≠ 8 → pas d’Imparfaite', () => {
    const mage = pregen(PREGEN.sorcier);
    useGame.setState({ party: [mage] });
    castFrozen(mage.id, 'flechette', 37, true);
    expect(draineEtLit(useGame.getState).join('\n')).not.toMatch(/Imparfaite/);
  });
});
