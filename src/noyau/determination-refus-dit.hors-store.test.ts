/**
 * Détermination « Retirez un État » (`LDB 17 l.61`) : le geste `depenserLaDetermination` lit le verdict
 * `refusDeDetermination`, celui du gate `determination-en-reserve` — ouvert à tout porteur (PNJ compris),
 * et son refus se DIT au siège qui pilote le porteur.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { stacks } from '../engine/conditions';
import { t } from '../i18n';
import type { Combatant, ConditionInstance } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function setup() {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const E = b.combatants.find((c) => c.kind !== 'heros')!;
  return { H, E };
}

const vivant = (id: string): Combatant => banc.getState().battle!.combatants.find((c) => c.id === id)!;

describe('depenserLaDetermination — verdict `refusDeDetermination` (LDB 17 l.61)', () => {
  it('PNJ à Détermination 2, Sonné ×2 : un pion retiré, un point débité', () => {
    const { E } = setup();
    E.resolve = 2;
    E.conditions = [{ id: 'sonne', value: 2 }] as ConditionInstance[];
    banc.getState().depenserLaDetermination(E.id, 'retirerUnEtat', 'sonne');
    expect(stacks(vivant(E.id), 'sonne')).toBe(1);
    expect(vivant(E.id).resolve).toBe(1);
  });

  it('héros piloté à Détermination 0 : le refus est DIT, rien ne bouge', () => {
    const { H } = setup();
    H.resolve = 0;
    H.conditions = [{ id: 'sonne', value: 1 }] as ConditionInstance[];
    banc.getState().depenserLaDetermination(H.id, 'retirerUnEtat', 'sonne');
    expect(banc.getState().refus?.texte).toBe(t('agate.noResolve'));
    expect(stacks(vivant(H.id), 'sonne')).toBe(1);
  });

  it('héros piloté, État non porté : le refus est DIT, le point reste', () => {
    const { H } = setup();
    H.resolve = 1;
    H.conditions = [];
    banc.getState().depenserLaDetermination(H.id, 'retirerUnEtat', 'sonne');
    expect(banc.getState().refus?.texte).toBe(t('agate.stateNotCarried'));
    expect(vivant(H.id).resolve).toBe(1);
  });
});
