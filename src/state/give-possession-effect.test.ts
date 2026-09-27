/**
 * Effet `givePossession` (#617/#618 Lot 1) — donne
 * une possession (bête/serviteur/véhicule) à un héros via le registre `GameState.possessions` (#615).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { EFFECT_HANDLERS } from './combatEffects';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

describe('Effet givePossession (#617/#618 Lot 1)', () => {
  beforeEach(() => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [h], journal: [], possessions: [] });
  });

  it('nature bete + ref creatureId + heroId → une possession bete au registre, owner = heroId, uid pos-N', () => {
    const heroId = useGame.getState().party[0].id;
    applyEffects(useGame.getState, useGame.setState, [
      { type: 'givePossession', nature: 'bete', ref: { creatureId: 'mule' }, heroId },
    ]);
    const { possessions } = useGame.getState();
    expect(possessions).toHaveLength(1);
    expect(possessions[0].uid).toMatch(/^pos-\d+$/);
    expect(possessions[0].ownerId).toBe(heroId);
    expect(possessions[0].nature).toBe('bete');
    expect(possessions[0].nature === 'bete' && possessions[0].ref).toEqual({ creatureId: 'mule' });
    expect(possessions[0].location).toEqual({ kind: 'avec-le-groupe' });
  });

  it('heroId absent → propriétaire = le premier héros du groupe', () => {
    applyEffects(useGame.getState, useGame.setState, [
      { type: 'givePossession', nature: 'vehicule', ref: { vehicleId: 'chariot-leger' } },
    ]);
    const { possessions, party } = useGame.getState();
    expect(possessions).toHaveLength(1);
    expect(possessions[0].ownerId).toBe(party[0].id);
    expect(possessions[0].nature).toBe('vehicule');
    expect(possessions[0].nature === 'vehicule' && possessions[0].vehicleId).toBe('chariot-leger');
  });

  it('nature vehicule → possession vehicule (vehicleId, pas ref)', () => {
    applyEffects(useGame.getState, useGame.setState, [
      { type: 'givePossession', nature: 'vehicule', ref: { vehicleId: 'chariot-leger' } },
    ]);
    const p = useGame.getState().possessions[0];
    expect(p.nature).toBe('vehicule');
    expect('ref' in p).toBe(false);
  });
});

/** La bête donnée est une RÉFÉRENCE (#1882) : sa fiche est celle que spawne la monture de combat —
 *  une réf. vide ou morte se DIT à l'auteur (`validateScene`, via `refs`), jamais au spawn. */
describe('Effet givePossession — la réf. est tenue à sa porte (#1882)', () => {
  const refs = EFFECT_HANDLERS.givePossession.refs!;
  const ctx = {} as never;
  it('créature vide ou inconnue → erreur nommée ; créature du bestiaire → rien', () => {
    expect(refs({ type: 'givePossession', nature: 'bete', ref: { creatureId: '' } } as never, ctx)).toEqual([{ level: 'error', message: 'Possession → créature inexistante « (aucune) »' }]);
    expect(refs({ type: 'givePossession', nature: 'bete', ref: { creatureId: 'licorne-mauve' } } as never, ctx)).toEqual([{ level: 'error', message: 'Possession → créature inexistante « licorne-mauve »' }]);
    expect(refs({ type: 'givePossession', nature: 'bete', ref: { creatureId: 'mule' } } as never, ctx)).toEqual([]);
  });
});
