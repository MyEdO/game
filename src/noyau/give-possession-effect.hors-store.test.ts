/**
 * Effet `givePossession` (#617/#618 Lot 1) — donne
 * une possession (bête/serviteur/véhicule) à un héros via le registre `GameState.possessions` (#615).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { EFFECT_HANDLERS, applyEffects } from './combatEffects';
import { createHero } from '../engine/character';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('Effet givePossession (#617/#618 Lot 1)', () => {
  beforeEach(() => {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [h] });
  });

  it('nature bete + ref créature + heroId → une possession bete au registre, owner = heroId, uid pos-N', () => {
    const heroId = banc.getState().party[0].id;
    applyEffects(banc.getState, banc.setState, [
      { type: 'givePossession', nature: 'bete', ref: { id: 'mule', type: 'creature' }, heroId },
    ]);
    const { possessions } = banc.getState();
    expect(possessions).toHaveLength(1);
    expect(possessions[0].uid).toMatch(/^pos-\d+$/);
    expect(possessions[0].ownerId).toBe(heroId);
    expect(possessions[0].nature).toBe('bete');
    expect(possessions[0].nature === 'bete' && possessions[0].ref).toEqual({ id: 'mule' });
    expect(possessions[0].location).toEqual({ kind: 'avec-le-groupe' });
  });

  it('heroId absent → propriétaire = le premier héros du groupe', () => {
    applyEffects(banc.getState, banc.setState, [
      { type: 'givePossession', nature: 'vehicule', ref: { id: 'chariot-leger', type: 'vehicle' } },
    ]);
    const { possessions, party } = banc.getState();
    expect(possessions).toHaveLength(1);
    expect(possessions[0].ownerId).toBe(party[0].id);
    expect(possessions[0].nature).toBe('vehicule');
    expect(possessions[0].nature === 'vehicule' && possessions[0].vehicleId).toBe('chariot-leger');
  });

  it('nature vehicule → possession vehicule (vehicleId, pas ref)', () => {
    applyEffects(banc.getState, banc.setState, [
      { type: 'givePossession', nature: 'vehicule', ref: { id: 'chariot-leger', type: 'vehicle' } },
    ]);
    const p = banc.getState().possessions[0];
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
    expect(refs({ type: 'givePossession', nature: 'bete', ref: { id: '', type: 'creature' } } as never, ctx)).toEqual([{ level: 'error', message: 'Possession → créature inexistante « (aucune) »' }]);
    expect(refs({ type: 'givePossession', nature: 'bete', ref: { id: 'licorne-mauve', type: 'creature' } } as never, ctx)).toEqual([{ level: 'error', message: 'Possession → créature inexistante « licorne-mauve »' }]);
    expect(refs({ type: 'givePossession', nature: 'bete', ref: { id: 'mule', type: 'creature' } } as never, ctx)).toEqual([]);
  });
});
